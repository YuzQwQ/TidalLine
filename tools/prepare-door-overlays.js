const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'assets/source/doors-batch-03');
const record=require('../assets/source/prompts/front-door-overlays-v3.json');
(async()=>{
 fs.mkdirSync(path.join(folder,'sources'),{recursive:true});fs.mkdirSync(path.join(folder,'previous'),{recursive:true});
 const registry=path.join(root,'design/maps/shared/scene-assets.json'),spec=JSON.parse(fs.readFileSync(registry)),assets=[],openings={};
 for(const job of record.assets){
  const source=path.join(folder,'sources',job.id+'.png'),target=path.join(root,'assets/props',job.id+'.png'),previous=path.join(folder,'previous',job.id+'.png');
  if(!fs.existsSync(previous))fs.copyFileSync(target,previous);if(!fs.existsSync(source))fs.copyFileSync(job.originalSource,source);
  const{data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});let l=info.width,t=info.height,r=-1,b=-1;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=180){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
  if(r<l)throw Error('Empty '+job.id);
  const width=job.id.startsWith('sdoor')||job.id==='door_locked'?19:22,left=Math.floor((32-width)/2);
  const{data:p,info:s}=await sharp(data,{raw:info}).extract({left:l,top:t,width:r-l+1,height:b-t+1}).resize(width,26,{fit:'fill',kernel:'nearest'}).raw().toBuffer({resolveWithObject:true});for(let i=3;i<p.length;i+=4)p[i]=p[i]>=180?255:0;
  const png=await sharp({create:{width:32,height:32,channels:4,background:'#00000000'}}).composite([{input:p,raw:s,left,top:4}]).png({palette:true,colours:16,dither:0}).toBuffer();
  const{data:n,info:ni}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});await sharp(n,{raw:ni}).png().toFile(target);
  if(job.id.endsWith('_open')){
   const alpha=(x,y)=>n[(y*32+x)*4+3],spans=[];let last=null;
   for(let y=4;y<32;y++){
    if(alpha(16,y)){if(last)throw Error(job.id+' has ink inside its open passage');continue;}
    let left=15,right=16;while(left>=0&&!alpha(left,y))left--;while(right<32&&!alpha(right,y))right++;
    if(left>=0&&right<32&&right-left>6)last=[left+1,y,right-left-1,1];
    else if(last)last=[last[0],y,last[2],1];else continue;
    if(spans.length&&spans.at(-1)[0]===last[0]&&spans.at(-1)[2]===last[2])spans.at(-1)[3]++;else spans.push([...last]);
   }
   if(spans.reduce((a,v)=>a+v[3],0)<16)throw Error(job.id+' lacks an empty open passage');openings[job.id]=spans;
  }
  const a=spec.assets.find(a=>a.group==='props'&&a.id===job.id);if(!a)throw Error('Unregistered '+job.id);a.canvas=[32,32];a.generationManifest='assets/source/doors-batch-03/manifest.json';
  assets.push({id:job.id,source:'sources/'+job.id+'.png',target:'assets/props/'+job.id+'.png',canvas:[32,32],visibleBounds:[left,4,width,26],previous:'previous/'+job.id+'.png',generator:'built-in image_gen'});
 }
 fs.writeFileSync(registry,JSON.stringify(spec,null,2)+'\n');fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify({assets,openings},null,2)+'\n');
 const modulePath=path.join(root,'js/door-visual.js');let js=fs.readFileSync(modulePath,'utf8');js=js.replace(/\/\/ BEGIN PREPARED DOOR OPENINGS[\s\S]*?\/\/ END PREPARED DOOR OPENINGS/,'// BEGIN PREPARED DOOR OPENINGS\n    openings:'+JSON.stringify(openings)+',\n    // END PREPARED DOOR OPENINGS');fs.writeFileSync(modulePath,js);
 const layers=[];for(let i=0;i<assets.length;i++)layers.push({input:await sharp(path.join(root,assets[i].target)).resize(160,160,{kernel:'nearest'}).png().toBuffer(),left:i*176+8,top:8});
 await sharp({create:{width:assets.length*176,height:176,channels:4,background:'#253329'}}).composite(layers).png().toFile(path.join(folder,'preview.png'));
 console.log('Prepared six inset overlays and alpha-derived wall cutouts',JSON.stringify(openings));
})().catch(e=>{console.error(e);process.exitCode=1;});
