/* Archive AI art; trim transparent margins and fit its silhouette into a 48px icon. */
const fs=require('fs'),path=require('path'),sharp=require('sharp');
const [source,id]=process.argv.slice(2),root=path.resolve(__dirname,'..');
if(!/^att_[a-z0-9_]+$/.test(id))throw Error('Invalid attachment ID');
const archive=path.join(root,'assets/item-art/attachments-v2/sources',id+'.png');
fs.mkdirSync(path.dirname(archive),{recursive:true});fs.copyFileSync(source,archive);
(async()=>{const {data,info}=await sharp(archive).ensureAlpha().trim({threshold:5}).resize(40,40,{fit:'inside',kernel:'lanczos3'}).png().toBuffer({resolveWithObject:true});
await sharp({create:{width:48,height:48,channels:4,background:'#00000000'}}).composite([{input:data,left:Math.floor((48-info.width)/2),top:Math.floor((48-info.height)/2)}]).png().toFile(path.join(root,'assets/gear',id+'.png'));console.log(id);})().catch(e=>{console.error(e);process.exitCode=1});
