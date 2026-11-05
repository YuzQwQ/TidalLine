/* Technical export only: preserve generated originals; nearest-neighbour 48px icons. */
const fs=require('fs'),path=require('path'),sharp=require('sharp'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),batch=process.argv.includes('--batch03')?'assault-batch-03':'assault-expansion',dir=path.join(root,'assets/item-art',batch);
const prompts=require('../assets/source/prompts/'+(batch==='assault-expansion'?'assault-expansion-v1':batch)+'.json');
const guns=require('../design/weapons/arsenal-v1/arsenal.json').weapons;
const parts=require('../design/weapons/attachments-v1/attachments.json').items;
(async()=>{
 fs.mkdirSync(path.join(dir,'sources'),{recursive:true});const assets=[],tiles=[];
 for(const [i,a] of prompts.assets.entries()){
  if(!a.prompt||!a.original)throw Error('Missing provenance: '+a.id);
  const source=path.join(dir,'sources',a.id+'.png');if(!fs.existsSync(source))fs.copyFileSync(a.original,source);
  const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let l=info.width,t=info.height,r=-1,b=-1,clear=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const alpha=data[(y*info.width+x)*4+3];if(alpha<128){clear++;continue;}l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
  if(clear<info.width*info.height*.1||r<l)throw Error('Source transparency invalid: '+a.id);
  const small=await sharp(source).trim({threshold:8}).resize(40,40,{fit:'inside',kernel:'nearest'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(let n=0;n<small.data.length;n+=4){small.data[n+3]=small.data[n+3]>=128?255:0;if(!small.data[n+3])small.data.fill(0,n,n+3);}
  const target='assets/'+(a.id.startsWith('ammo_')?'items':'gear')+'/'+a.id+'.png';
  await sharp({create:{width:48,height:48,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:small.data,raw:{width:small.info.width,height:small.info.height,channels:4},left:Math.floor((48-small.info.width)/2),top:Math.floor((48-small.info.height)/2)}]).png({palette:true,colours:64,dither:0}).toFile(path.join(root,target));
  const name=guns.find(w=>w.id===a.id)?.name||parts.find(w=>w.id===a.id)?.name||'5.45×39mm 弹药';
  const meta={id:a.id,name,generator:'image_gen',prompt:a.prompt,source:'assets/item-art/'+batch+'/sources/'+a.id+'.png',target,size:[48,48],safeMargin:4,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,target))).digest('hex')};
  assets.push(meta);fs.writeFileSync(path.join(dir,a.id+'.json'),JSON.stringify(meta,null,2)+'\n');
  tiles.push({input:await sharp(path.join(root,target)).resize(144,144,{kernel:'nearest'}).png().toBuffer(),left:i%4*192+24,top:Math.floor(i/4)*192+24});
 }
 await sharp({create:{width:768,height:Math.ceil(assets.length/4)*192,channels:4,background:'#26302c'}}).composite(tiles).png().toFile(path.join(dir,'preview.png'));
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({generator:'image_gen',assets},null,2)+'\n');
 fs.writeFileSync(path.join(dir,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>突击步枪扩充图标</title><style>body{background:#17211e;color:#ddd;font:15px system-ui;max-width:1100px;margin:auto;padding:24px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}article{background:#26302c;padding:16px}img{image-rendering:pixelated}.large{width:144px;height:144px;display:block;margin:auto}h2{font-size:16px}a{color:#d5b886}.sizes{display:flex;gap:16px;align-items:center}</style><h1>突击步枪扩充 · ${assets.length} 张图标</h1><p>48×48 透明画布，主体不超过40×40；下方同时展示48、34、24像素效果。</p><div class="grid">${assets.map(a=>`<article><img class="large" src="../../../${a.target}"><h2>${a.name}</h2><code>${a.id}</code><p class="sizes">${[48,34,24].map(n=>`<img src="../../../${a.target}" width="${n}" height="${n}">`).join('')}</p><a href="sources/${a.id}.png">生成原稿</a> · <a href="${a.id}.json">提示词</a></article>`).join('')}</div></html>`);
 console.log('Prepared '+assets.length+' '+batch+' icons and original archives');
})().catch(e=>{console.error(e);process.exitCode=1;});
