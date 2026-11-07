const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'assets/source/doors-batch-04'),record=require('../assets/source/prompts/side-door-study-v4.json');
(async()=>{
 fs.mkdirSync(path.join(folder,'sources'),{recursive:true});const source=path.join(folder,'sources/door_side_study.png');if(!fs.existsSync(source))fs.copyFileSync(record.originalSource,source);
 const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true}),regions=[[90,245,14,0,4,4],[245,850,15,4,2,24],[850,990,14,28,4,4],[990,1470,14,32,4,16]],layers=[];
 for(const[y0,y1,dx,dy,w,h]of regions){
  let l=info.width,t=info.height,r=-1,b=-1;for(let y=y0;y<Math.min(y1,info.height);y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=180){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
  if(r<l)throw Error('Missing source segment '+dy);
  const{data:p,info:s}=await sharp(data,{raw:info}).extract({left:l,top:t,width:r-l+1,height:b-t+1}).resize(w,h,{fit:'fill',kernel:'nearest'}).raw().toBuffer({resolveWithObject:true});for(let i=3;i<p.length;i+=4)p[i]=p[i]>=180?255:0;
  layers.push({input:p,raw:s,left:dx,top:dy});
 }
 const png=await sharp({create:{width:32,height:48,channels:4,background:'#00000000'}}).composite(layers).png({palette:true,colours:16,dither:0}).toBuffer();await sharp(png).ensureAlpha().png().toFile(path.join(root,'assets/props/door_side_study.png'));
 const file=path.join(root,'design/maps/shared/scene-assets.json'),spec=JSON.parse(fs.readFileSync(file));if(!spec.assets.some(a=>a.group==='props'&&a.id==='door_side_study'))spec.assets.push({group:'props',id:'door_side_study',name:'南北向门结构试验',role:'scene-component',footprint:[1,1],canvas:[32,48],generationManifest:'assets/source/doors-batch-04/manifest.json'});fs.writeFileSync(file,JSON.stringify(spec,null,2)+'\n');
 fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify({generator:'built-in image_gen',id:'door_side_study',source:'sources/door_side_study.png',target:'assets/props/door_side_study.png',canvas:[32,48],segments:regions.map(([a,b,x,y,w,h])=>({sourceY:[a,b],native:[x,y,w,h]})),backFrame:{source:[0,32,32,16],native:[0,4,32,24],opacity:0.85},wallCap:{source:'tiles/wall top half',offsetY:-32,height:16},scope:'door test only'},null,2)+'\n');
 await sharp(path.join(root,'assets/props/door_side_study.png')).resize(256,384,{kernel:'nearest'}).png().toFile(path.join(folder,'native-preview.png'));
 console.log('Prepared32x48 four-part side-door study; backing post reused from lower16px');
})().catch(e=>{console.error(e);process.exitCode=1;});
