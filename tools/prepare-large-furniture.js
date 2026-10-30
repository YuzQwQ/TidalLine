/* 从生成原稿重新采样原生双格图，绝不放大旧32px成品。 */
const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'assets/scene-furniture-large'),m=require('../assets/scene-furniture-large/manifest.json');
(async()=>{for(const a of m.assets){
 const [w,h]=a.canvas,{data,info}=await sharp(path.join(folder,a.source)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let l=info.width,t=info.height,r=-1,b=-1;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=128){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}
 if(r<l||r-l<60||b-t<26)throw Error('原稿尺寸/透明度不符合要求 '+a.id);
 const {data:pixels,info:small}=await sharp(data,{raw:info}).extract({left:l,top:t,width:r-l+1,height:b-t+1}).resize(w-4,h-6,{fit:'inside',kernel:'nearest'}).raw().toBuffer({resolveWithObject:true});
 for(let i=3;i<pixels.length;i+=4)pixels[i]=pixels[i]>=128?255:0;
 const indexed=await sharp({create:{width:w,height:h,channels:4,background:'#00000000'}}).composite([{input:pixels,raw:small,left:Math.floor((w-small.width)/2),top:h-3-small.height}]).png({palette:true,colours:16,dither:0}).toBuffer();
 await sharp(indexed).ensureAlpha().png({palette:false}).toFile(path.join(root,a.target));a.status='ready';a.sourceSize=[info.width,info.height];a.contentSize=[small.width,small.height];
 }fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(m,null,2)+'\n');console.log('27张双格家具原生尺寸已导出');})().catch(e=>{console.error(e);process.exitCode=1;});
