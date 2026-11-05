/* Run with sharp: process AI originals into the shared 48px icon canvas. */
const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'design/weapons/arsenal-v1'),spec=require('../design/weapons/arsenal-v1/arsenal.json');
(async()=>{
 const ids=[...spec.weapons.map(w=>w.id),'ammo_762x39','ammo_45acp','ammo_545x39'],assets=[],tiles=[];
 for(const [i,id] of ids.entries()){
  const legacy=fs.existsSync(path.join(dir,'art',id+'.json'));
  const metaFile=legacy?path.join(dir,'art',id+'.json'):fs.readdirSync(path.join(root,'assets/item-art')).map(batch=>path.join(root,'assets/item-art',batch,id+'.json')).find(f=>fs.existsSync(f));
  if(!metaFile)throw Error('Missing original metadata: '+id);
  const meta=JSON.parse(fs.readFileSync(metaFile,'utf8').replace(/^\uFEFF/,''));
  const source=legacy?path.join(dir,'art/sources',id+'.png'):path.join(root,meta.source);
  const gun=spec.weapons.find(w=>w.id===id),limit=gun?.category==='pistol'?29:40;
  const {data,info}=await sharp(source).ensureAlpha().trim({threshold:8}).resize(limit,40,{fit:'inside',kernel:'nearest'}).raw().toBuffer({resolveWithObject:true});
  for(let n=0;n<data.length;n+=4){data[n+3]=data[n+3]>=128?255:0;if(!data[n+3])data.fill(0,n,n+3);}
  const target='assets/'+(gun?'gear':'items')+'/'+id+'.png';
  await sharp({create:{width:48,height:48,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:data,raw:{width:info.width,height:info.height,channels:4},left:Math.floor((48-info.width)/2),top:Math.floor((48-info.height)/2)}]).png({palette:true,colours:64,dither:0}).toFile(path.join(root,target));
  assets.push({id,name:meta.name,source:path.relative(dir,source).split(path.sep).join('/'),promptFile:path.relative(dir,metaFile).split(path.sep).join('/'),target,prompt:meta.prompt,size:[48,48],safeMargin:4});
  tiles.push({input:await sharp(path.join(root,target)).resize(144,144,{kernel:'nearest'}).png().toBuffer(),left:i%4*192+24,top:Math.floor(i/4)*192+24});
 }
 // Four legacy file paths remain valid for archived visual prototypes; they are not extra models.
 for(const [old,id] of Object.entries(spec.aliases))fs.copyFileSync(path.join(root,'assets/gear',id+'.png'),path.join(root,'assets/gear',old+'.png'));
 await sharp({create:{width:768,height:Math.ceil(ids.length/4)*192,channels:4,background:'#26302c'}}).composite(tiles).png().toFile(path.join(dir,'art/preview.png'));
 fs.writeFileSync(path.join(dir,'art/manifest.json'),JSON.stringify({generator:'image_gen',assets},null,2)+'\n');
 fs.writeFileSync(path.join(dir,'art/index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>枪械扩充 · 图标审阅</title><style>body{margin:0;background:#131b19;color:#d6d7c9;font:15px/1.7 system-ui}main{max-width:1100px;margin:auto;padding:24px}a{color:#d1b880}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}article{padding:18px;background:#26302c}img{image-rendering:pixelated;object-fit:contain}.large{width:144px;height:144px;display:block;margin:auto}.sizes{display:flex;align-items:center;gap:8px}.sizes span{background:#475047;display:grid;place-items:center;min-width:48px;height:48px}.sizes span:nth-child(2){background:#3a3051}.sizes span:nth-child(3){background:#53472e}h2{font-size:16px}code{font-size:12px}@media(max-width:800px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:400px){.grid{grid-template-columns:1fr}}</style><main><h1>枪械扩充 · ${spec.weapons.length}款武器与3种弹药</h1><p>透明48×48 PNG，4px安全边；不烘焙稀有度背景。长枪与手枪分别保持统一尺寸。四张旧路径兼容图已替换为对应新型号。</p><p><a href="../README.md">接入说明</a> · <a href="../../../../装备清单.html">装备清单</a></p><div class="grid">${assets.map(a=>`<article><img class="large" src="../../../../${a.target}" alt="${a.name}"><h2>${a.name}</h2><code>${a.id}</code><div class="sizes">${[48,34,24].map(n=>`<span><img src="../../../../${a.target}" width="${n}" height="${n}" alt="${n}px"></span>`).join('')}</div><p><a href="../${a.source}">原稿</a> · <a href="../${a.promptFile}">提示词</a></p></article>`).join('')}</div></main></html>`);
 console.log('Prepared arsenal icons, four legacy aliases and review gallery');
})().catch(e=>{console.error(e);process.exitCode=1;});
