/* 原稿裁切/采样/调色板量化；变体边界锁定为同组A，便于稳定混铺。 */
const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'assets/ground-batch-01'),file=path.join(folder,'manifest.json'),m=JSON.parse(fs.readFileSync(file,'utf8'));
const mean=data=>{const v=[0,0,0];for(let y=2;y<30;y++)for(let x=2;x<30;x++)for(let k=0;k<3;k++)v[k]+=data[(y*32+x)*4+k]/784;return v;};
(async()=>{const groups={};for(const a of m.assets){const source=path.join(folder,a.source);if(!fs.existsSync(source))throw Error('缺少原稿 '+a.id);const meta=await sharp(source).metadata();let data;
 if(a.kind==='ground'){
  data=await sharp(source).resize(32,32,{fit:'fill',kernel:'nearest'}).flatten({background:'#737D70'}).ensureAlpha().raw().toBuffer();
  if(groups[a.material]){const ref=groups[a.material],from=mean(data),to=mean(ref);for(let i=0;i<data.length;i+=4)for(let k=0;k<3;k++)data[i+k]=Math.max(0,Math.min(255,Math.round(data[i+k]+to[k]-from[k])));}
  let indexed=await sharp(data,{raw:{width:32,height:32,channels:4}}).png({palette:true,colours:16,dither:0}).toBuffer();data=await sharp(indexed).ensureAlpha().raw().toBuffer();
  if(groups[a.material]){const ref=groups[a.material],palette=[...new Map(Array.from({length:1024},(_,i)=>[ref.subarray(i*4,i*4+3).toString('hex'),[ref[i*4],ref[i*4+1],ref[i*4+2]]])).values()];for(let i=0;i<data.length;i+=4){let best=palette[0],dist=Infinity;for(const c of palette){const d=c.reduce((n,v,k)=>n+(v-data[i+k])**2,0);if(d<dist){best=c;dist=d;}}for(let k=0;k<3;k++)data[i+k]=best[k];}for(let y=0;y<32;y++)for(let x=0;x<32;x++)if(x<2||x>=30||y<2||y>=30)ref.copy(data,(y*32+x)*4,(y*32+x)*4,(y*32+x)*4+4);}
  else{for(let y=0;y<32;y++)for(let i=0;i<2;i++)data.copy(data,(y*32+31-i)*4,(y*32+i)*4,(y*32+i)*4+4);for(let i=0;i<2;i++)data.copy(data,(31-i)*128,i*128,(i+1)*128);groups[a.material]=Buffer.from(data);}
 }else{
  const {data:raw,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});let l=info.width,t=info.height,r=-1,b=-1;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(raw[(y*info.width+x)*4+3]>=128){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}if(r<l)throw Error('空贴花 '+a.id);
  const small=await sharp(raw,{raw:info}).extract({left:l,top:t,width:r-l+1,height:b-t+1}).resize(26,26,{fit:'inside',kernel:'nearest'}).png().toBuffer();const sm=await sharp(small).metadata();data=await sharp({create:{width:32,height:32,channels:4,background:'#00000000'}}).composite([{input:small,left:Math.floor((32-sm.width)/2),top:Math.floor((32-sm.height)/2)}]).raw().toBuffer();
  for(let i=3;i<data.length;i+=4)data[i]=data[i]<96?0:a.id.includes('damp')?96:192;
 }
 // A/B合并边界后使用原生RGBA封装，防止再次量化改变共同边界色。
 let output=sharp(data,{raw:{width:32,height:32,channels:4}});if(a.kind!=='ground'){const indexed=await output.png({palette:true,colours:16,dither:0}).toBuffer();output=sharp(indexed).ensureAlpha();}await output.png().toFile(path.join(root,a.target));a.status='ready';a.sourceSize=[meta.width,meta.height];a.processing=a.kind==='ground'?'32px nearest sampling; 16-color quantization; A periodic 2px rim; B mean-color alignment and shared A rim':'alpha crop; nearest contain26px; discrete alpha';
 }fs.writeFileSync(file,JSON.stringify(m,null,2)+'\n');console.log('6张通用地面素材已整理');})().catch(e=>{console.error(e);process.exitCode=1;});
