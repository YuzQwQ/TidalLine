const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),batch='68x51-v1';
const prompts=['68x51-v1.json','68x51-25round.json'].flatMap(f=>require('../assets/source/prompts/'+f).prompts);
const results=require('../assets/source/prompts/68x51-art-results.json');
(async()=>{
 const dir=path.join(root,'assets/item-art',batch);fs.mkdirSync(path.join(dir,'sources'),{recursive:true});const tiles=[];
 for(const [i,p]of prompts.entries()){
  const source='assets/item-art/'+batch+'/sources/'+p.id+'.png',target='assets/'+p.group+'/'+p.id+'.png';
  fs.copyFileSync(results[p.id],path.join(root,source));
  const {data,info}=await sharp(path.join(root,source)).ensureAlpha().trim({threshold:5}).resize(40,40,{fit:'inside',kernel:'lanczos3'}).png().toBuffer({resolveWithObject:true});
  await sharp({create:{width:48,height:48,channels:4,background:'#00000000'}}).composite([{input:data,left:Math.floor((48-info.width)/2),top:Math.floor((48-info.height)/2)}]).png().toFile(path.join(root,target));
  fs.writeFileSync(path.join(dir,p.id+'.json'),JSON.stringify({...p,source,target,generator:'built-in image_gen'},null,2)+'\n');
  tiles.push({input:await sharp(path.join(root,target)).resize(144,144,{kernel:'nearest'}).png().toBuffer(),left:i%4*192+24,top:Math.floor(i/4)*192+24});
 }
 await sharp({create:{width:768,height:Math.ceil(prompts.length/4)*192,channels:4,background:'#26302c'}}).composite(tiles).png().toFile(path.join(dir,'preview.png'));
 console.log('Archived and prepared '+prompts.length+' transparent 48px icons');
})().catch(e=>{console.error(e);process.exitCode=1;});
