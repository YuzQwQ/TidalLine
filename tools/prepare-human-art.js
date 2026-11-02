/* Generated originals -> static 32px actors, anchored 64px strips and non-solid corpses. */
const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'design/enemies/human-units-v1/art');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
function bounds(data,w,h,predicate=()=>true){let l=w,t=h,r=-1,b=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>=128&&predicate(x,y)){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}if(r<l)throw Error('empty generated frame');return{left:l,top:t,width:r-l+1,height:b-t+1,bottom:b};}
function features(data,w,h){
 const b=bounds(data,w,h),l=Math.floor(w*.30),r=Math.ceil(w*.70),counts=[];
 for(let y=0;y<h;y++){let n=0;for(let x=l;x<r;x++)n+=data[(y*w+x)*4+3]>=128;counts.push(n);}
 const peak=Math.max(...counts);let headTop=b.top,foot=b.bottom;
 for(let y=b.top;y<b.top+b.height*.55;y++)if(counts[y]>=peak*.35){headTop=y;break;}
 const head=bounds(data,w,h,(x,y)=>x>l&&x<r&&y>=headTop&&y<headTop+(foot-headTop)*.22);
 return{b,headWidth:head.width,headTop,foot,center:head.left+head.width/2};
}
async function frame(file,left,width){const meta=await sharp(file).metadata();const {data,info}=await sharp(file).extract({left,top:0,width,height:meta.height}).ensureAlpha().raw().toBuffer({resolveWithObject:true});for(let i=3;i<data.length;i+=4)data[i]=data[i]>=128?255:0;return{data,info,...features(data,info.width,info.height)};}
async function saveCanvas(layers,w,h,target){await sharp({create:{width:w,height:h,channels:4,background:'#00000000'}}).composite(layers).png({palette:true,colours:32,dither:0}).toFile(path.join(root,target));}
async function fitFrame(f,scale,size,footY,allowShift=false){
 const b=f.b,w=Math.max(1,Math.round(b.width*scale)),h=Math.max(1,Math.round(b.height*scale));
 let x=Math.round(size/2-(f.center-b.left)*scale);const y=Math.round(footY-(f.foot-b.top)*scale);
 if(allowShift)x=Math.max(0,Math.min(size-w,x));
 if(x<0||y<0||x+w>size||y+h>size)throw Error('sprite exceeds canvas; revise original or padding: '+[x,y,w,h]);
 const png=await sharp(f.data,{raw:f.info}).extract(b).resize(w,h,{kernel:'nearest'}).png().toBuffer();return{input:png,left:x,top:y,anchorX:x+(f.center-b.left)*scale,bodyHeight:Math.round((f.foot-f.headTop)*scale)};
}
(async()=>{
 const jobs=fs.readdirSync(folder).filter(f=>f.endsWith('.json')&&!['manifest.json','quality.json'].includes(f)).map(f=>read(path.join(folder,f))).filter(j=>j.type&&j.id),assets=[],refs={};
 for(const j of jobs.filter(j=>j.type==='static')){
  const file=path.join(folder,'sources',j.id+'.png'),meta=await sharp(file).metadata(),f=await frame(file,0,meta.width);f.headTop=f.b.top;f.foot=f.b.bottom;const scale=26/(f.foot-f.headTop+1);
  const layer=await fitFrame(f,scale,32,28,true);j.target='assets/chars/'+j.id+'.png';await saveCanvas([{input:layer.input,left:layer.left,top:layer.top}],32,32,j.target);refs[j.id]={headWidth:f.headWidth*scale};assets.push({...j,frames:1,size:32,bodyHeight:layer.bodyHeight,anchor:[+layer.anchorX.toFixed(2),28]});
 }
 for(const j of jobs.filter(j=>j.type==='sheet')){
  const file=path.join(folder,'sources',j.id+'.png'),meta=await sharp(file).metadata(),frames=[];
  for(let i=0;i<j.frames;i++){const l=Math.round(i*meta.width/j.frames),r=Math.round((i+1)*meta.width/j.frames);frames.push(await frame(file,l,r-l));}
  const sorted=frames.map(f=>f.foot-f.headTop+1).sort((a,b)=>a-b),body=sorted[Math.floor(sorted.length/2)],scale=26/body;
  const layers=[],anchors=[];
  for(let i=0;i<frames.length;i++){let l;try{l=await fitFrame(frames[i],scale,64,44);}catch(e){throw Error(j.id+' frame '+i+': '+e.message);}layers.push({input:l.input,left:l.left+i*64,top:l.top});anchors.push({foot:[32,44],bodyHeight:l.bodyHeight});}
  j.target='assets/anim/'+j.id+'.png';await saveCanvas(layers,j.frames*64,64,j.target);assets.push({...j,size:64,normalization:'one scale per strip from median head-to-foot body height, excluding narrow weapon pixels; no per-frame resizing',anchors});
 }
 for(const j of jobs.filter(j=>j.type==='corpse')){
  const file=path.join(folder,'sources',j.id+'.png');j.target='assets/props/'+j.id+'.png';const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});for(let i=3;i<data.length;i+=4)data[i]=data[i]>=128?255:0;const b=bounds(data,info.width,info.height);const png=await sharp(data,{raw:info}).extract(b).resize(28,28,{fit:'inside',kernel:'nearest'}).png().toBuffer(),m=await sharp(png).metadata();await saveCanvas([{input:png,left:Math.floor((32-m.width)/2),top:Math.floor((32-m.height)/2)}],32,32,j.target);assets.push({...j,size:32});
 }
 fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify({generator:'image_gen',status:assets.length===35?'ready':'in_progress',static:assets.filter(x=>x.type==='static').length,strips:assets.filter(x=>x.type==='sheet').length,corpses:assets.filter(x=>x.type==='corpse').length,assets},null,2)+'\n');
 const registryPath=path.join(root,'design/maps/shared/scene-assets.json'),registry=read(registryPath);
 for(const j of assets.filter(x=>x.type==='corpse'))if(!registry.assets.some(a=>a.group==='props'&&a.id===j.id))registry.assets.push({group:'props',id:j.id,name:j.unit==='holdout'?'尸体 · 据点看守（人类）':'尸体 · 受雇回收员（人类）',role:'scene-component',usage:'运行时死亡尸体；无实体碰撞，不作为编辑器独立放置物块'});
 fs.writeFileSync(registryPath,JSON.stringify(registry,null,2)+'\n');
 const anchors=Object.fromEntries(assets.filter(x=>x.type==='static').map(j=>[j.id,j.anchor])),runtime=path.join(root,'js/human-ai.js');let source=fs.readFileSync(runtime,'utf8');const block='/* BEGIN HUMAN STATIC ANCHORS */\nconst HUMAN_ART_STATIC = '+JSON.stringify(anchors)+';\n/* END HUMAN STATIC ANCHORS */';source=source.includes('/* BEGIN HUMAN STATIC ANCHORS */')?source.replace(/\/\* BEGIN HUMAN STATIC ANCHORS \*\/[\s\S]*?\/\* END HUMAN STATIC ANCHORS \*\//,block):source+'\n'+block+'\n';fs.writeFileSync(runtime,source);
 const tiles=[];for(const [i,j]of assets.entries()){
  let first=await sharp(path.join(root,j.target)).extract({left:0,top:0,width:j.size,height:j.size}).png().toBuffer();
  if(j.size===32)first=await sharp({create:{width:64,height:64,channels:4,background:'#00000000'}}).composite([{input:first,left:j.anchor?Math.round(32-j.anchor[0]):16,top:16}]).png().toBuffer();
  first=await sharp(first).resize(128,128,{kernel:'nearest'}).png().toBuffer();tiles.push({input:first,left:(i%6)*180+26,top:Math.floor(i/6)*170+8});tiles.push({input:Buffer.from('<svg width="180" height="26"><text x="5" y="18" fill="#d5dfca" font-size="11">'+j.id+'</text></svg>'),left:(i%6)*180,top:Math.floor(i/6)*170+140});
 }await sharp({create:{width:1080,height:Math.ceil(assets.length/6)*170,channels:4,background:'#17231b'}}).composite(tiles).png().toFile(path.join(folder,'preview.png'));
 console.log('Prepared '+assets.length+' human art assets');
})().catch(e=>{console.error(e);process.exitCode=1;});
