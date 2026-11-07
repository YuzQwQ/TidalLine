const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'assets/source/containers-batch-01');
async function main(){
 const jobs=[{id:'crate_weapons',name:'武器箱',type:'g',fit:[28,24]},{id:'crate_equipment',name:'装备箱',type:'h',fit:[26,28]}],assets=[],preview=[];
 for(const [i,a] of jobs.entries()){
  const source='sources/'+a.id+'.png',{data,info}=await sharp(path.join(folder,source)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let left=info.width,top=info.height,right=-1,bottom=-1;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=160){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
  if(right<left)throw Error('Empty sprite '+a.id);
  const cropped=await sharp(data,{raw:info}).extract({left,top,width:right-left+1,height:bottom-top+1}).resize(...a.fit,{fit:'inside',kernel:'nearest'}).raw().toBuffer({resolveWithObject:true});
  for(let j=3;j<cropped.data.length;j+=4)cropped.data[j]=cropped.data[j]>=160?255:0;
  const target='assets/props/'+a.id+'.png';
  const png=await sharp({create:{width:32,height:32,channels:4,background:'#00000000'}}).composite([{input:cropped.data,raw:cropped.info,left:Math.floor((32-cropped.info.width)/2),top:30-cropped.info.height}]).png({palette:true,colours:16,dither:0}).toBuffer();
  await sharp(png).ensureAlpha().png().toFile(path.join(root,target));
  assets.push({...a,source,target,canvas:[32,32],footprint:[1,1],visibleSize:[cropped.info.width,cropped.info.height],processing:'alpha>=160 crop; nearest resize; 16-color palette; binary alpha; bottom aligned with 2px padding'});
  preview.push({input:await sharp(png).resize(256,256,{kernel:'nearest'}).png().toBuffer(),left:i*288+16,top:16});
 }
 const file=path.join(root,'design/maps/shared/scene-assets.json'),registry=JSON.parse(fs.readFileSync(file,'utf8'));
 for(const a of assets){if(registry.assets.some(e=>e.id===a.id&&e.group==='props'))continue;registry.assets.push({group:'props',id:a.id,name:a.name,role:'scene-component',containerType:a.type,footprint:[1,1]});}
 fs.writeFileSync(file,JSON.stringify(registry,null,2)+'\n');
 fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify({id:'containers-batch-01',generator:'built-in image_gen',promptFile:'assets/source/prompts/specialized-containers-v1.json',assets},null,2)+'\n');
 await sharp({create:{width:576,height:288,channels:4,background:'#18221e'}}).composite(preview).png().toFile(path.join(folder,'preview.png'));
 console.log('Prepared two native 32px container sprites and registry');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
