// Normalize generated side doors to plan-view tiles and retain the previous runtime art.
const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'assets/source/doors-batch-02');
const record=require('../assets/source/prompts/side-doors-v2.json');
(async()=>{
  fs.mkdirSync(path.join(folder,'sources'),{recursive:true});fs.mkdirSync(path.join(folder,'previous'),{recursive:true});
  const registry=path.join(root,'design/maps/shared/scene-assets.json'),spec=JSON.parse(fs.readFileSync(registry));
  const assets=[];
  for(const job of record.assets){
    const source=path.join(folder,'sources',job.id+'.png'),target=path.join(root,'assets/props',job.id+'.png'),previous=path.join(folder,'previous',job.id+'.png');
    if(!fs.existsSync(previous))fs.copyFileSync(target,previous);
    if(!fs.existsSync(source))fs.copyFileSync(job.originalSource,source);
    const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let l=info.width,t=info.height,r=-1,b=-1;
    for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=180){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
    if(r<l)throw Error('Empty sprite '+job.id);
    // Align the south jamb, not the whole silhouette: the open leaf extends east.
    let jl=info.width,jr=-1;
    for(let y=Math.floor(b-(b-t)*.12);y<=b;y++)for(let x=l;x<=r;x++)if(data[(y*info.width+x)*4+3]>=180){jl=Math.min(jl,x);jr=Math.max(jr,x);}
    const center=(jl+jr)/2,scale=Math.min(28/(b-t+1),13.5/(center-l+.5),13.5/(r-center+.5));
    const w=Math.max(1,Math.round((r-l+1)*scale)),h=Math.max(1,Math.round((b-t+1)*scale));
    const {data:p,info:s}=await sharp(data,{raw:info}).extract({left:l,top:t,width:r-l+1,height:b-t+1}).resize(w,h,{kernel:'nearest'}).raw().toBuffer({resolveWithObject:true});
    for(let i=3;i<p.length;i+=4)p[i]=p[i]>=180?255:0;
    const left=Math.round(15.5-(center-l)*w/(r-l+1)),top=30-h;
    const png=await sharp({create:{width:32,height:32,channels:4,background:'#00000000'}}).composite([{input:p,raw:s,left,top}]).png({palette:true,colours:16,dither:0}).toBuffer();
    await sharp(png).ensureAlpha().png().toFile(target);
    const a=spec.assets.find(a=>a.group==='props'&&a.id===job.id);if(!a)throw Error('Unregistered '+job.id);
    a.canvas=[32,32];a.generationManifest='assets/source/doors-batch-02/manifest.json';
    assets.push({id:job.id,source:'sources/'+job.id+'.png',target:'assets/props/'+job.id+'.png',canvas:[32,32],generator:'built-in image_gen',previous:'previous/'+job.id+'.png'});
  }
  fs.writeFileSync(registry,JSON.stringify(spec,null,2)+'\n');
  fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify({assets},null,2)+'\n');
  const layers=[];
  for(let i=0;i<assets.length;i++)for(let row=0;row<2;row++)layers.push({input:await sharp(path.join(row?root:folder,row?'assets/props/'+assets[i].id+'.png':'previous/'+assets[i].id+'.png')).resize({height:192,kernel:'nearest'}).png().toBuffer(),left:i*160+16,top:row*224+16});
  await sharp({create:{width:assets.length*160,height:448,channels:4,background:'#253329'}}).composite(layers).png().toFile(path.join(folder,'comparison.png'));
  console.log('Prepared '+assets.length+' plan-view door tiles; old art retained in doors-batch-02/previous');
})().catch(e=>{console.error(e);process.exitCode=1;});
