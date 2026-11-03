/* AI originals stay archived. Only trim, scale and quantize; never rotate or mirror. */
const fs=require('fs'),path=require('path'),sharp=require('sharp'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'design/weapons/attachments-v1/art');
const spec=require('../design/weapons/attachments-v1/attachments.json');
const rows=spec.attachments||spec.items;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
(async()=>{
 const assets=[],missing=[],tiles=[];
 for(const [i,a]of rows.entries()){
  const source=path.join(dir,'sources',a.id+'.png'),metaFile=path.join(dir,a.id+'.json');
  if(!fs.existsSync(source)){missing.push(a.id);continue;}
  const meta=JSON.parse(fs.readFileSync(metaFile,'utf8').replace(/^\uFEFF/,''));
  const {data,info}=await sharp(source).ensureAlpha().trim({threshold:8}).resize(40,40,{fit:'inside',kernel:'nearest'}).raw().toBuffer({resolveWithObject:true});
  for(let n=0;n<data.length;n+=4){data[n+3]=data[n+3]>=128?255:0;if(!data[n+3])data.fill(0,n,n+3);}
  const target='assets/gear/'+a.id+'.png';
  await sharp({create:{width:48,height:48,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:data,raw:{width:info.width,height:info.height,channels:4},left:Math.floor((48-info.width)/2),top:Math.floor((48-info.height)/2)}]).png({palette:true,colours:64,dither:0}).toFile(path.join(root,target));
  assets.push({id:a.id,name:a.name,source:'sources/'+a.id+'.png',target,prompt:meta.prompt,size:[48,48],safeMargin:4,placement:a.subtype==='grip'||a.subtype==='magazine'?'upright':'front-left, rear-right',sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,target))).digest('hex')});
  tiles.push({input:await sharp(path.join(root,target)).resize(144,144,{kernel:'nearest'}).png().toBuffer(),left:i%4*224+40,top:Math.floor(i/4)*196+8});
  tiles.push({input:Buffer.from(`<svg width="224" height="36"><text x="112" y="18" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#ddd6bd">${esc(a.id)}</text></svg>`),left:i%4*224,top:Math.floor(i/4)*196+156});
 }
 await sharp({create:{width:896,height:Math.ceil(rows.length/4)*196,channels:4,background:'#26302c'}}).composite(tiles).png().toFile(path.join(dir,'preview.png'));
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({generator:'built-in image_gen',processing:'trim, nearest resize, hard alpha, palette; no rotation or mirror',orientation:'three-quarter front, slight top; front left foreground, rear right background; grips and magazines upright',assets,missing},null,2)+'\n');
 fs.writeFileSync(path.join(dir,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>枪械配件 · 图标审阅</title><style>body{margin:0;background:#131b19;color:#d6d7c9;font:15px/1.7 system-ui}main{max-width:1200px;margin:auto;padding:24px}a{color:#d1b880}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}article{padding:18px;background:#26302c;border-top:2px solid var(--rarity)}img{image-rendering:pixelated;object-fit:contain}.large{width:144px;height:144px;display:block;margin:auto}.sizes{display:flex;align-items:center;gap:8px}.sizes span{background:#475047;display:grid;place-items:center;min-width:48px;height:48px}.sizes span:nth-child(2){background:#3a3051}.sizes span:nth-child(3){background:#53472e}h2{font-size:16px}code{font-size:11px;overflow-wrap:anywhere}small{color:#aeb8ac}@media(max-width:900px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:430px){.grid{grid-template-columns:1fr}}</style><main><h1>枪械配件 · 32件正式图标</h1><p>固定三分之四前视角、轻微俯视；前侧朝左侧前景。握把、弹匣竖直摆放；其余配件前端在左下、后端在右上。不镜像、不左右翻转。</p><p>透明48×48 PNG，4px安全边，不烘焙稀有度背景。局外详情使用各自原稿，物品格和局内使用小图。</p><p><a href="../README.md">接入说明</a> · <a href="../../../../装备清单.html#attachments">装备清单</a> · <a href="preview.png">全套预览</a></p><div class="grid">${assets.map(a=>{const d=rows.find(x=>x.id===a.id);return `<article id="${a.id}" style="--rarity:${({2:'#75b477',3:'#639bc9',4:'#a880c9'})[d.r||d.rarity]||'#aaa'}"><img class="large" src="../../../../${a.target}" alt="${esc(a.name)}"><h2>${esc(a.name)}</h2><code>${a.id}</code><p><small>¥${Number(d.price).toLocaleString()} · ${d.weight??d.w}kg · ${a.placement==='upright'?'竖直摆放':'前左后右'}</small></p><div class="sizes">${[48,34,24].map(n=>`<span><img src="../../../../${a.target}" width="${n}" height="${n}" alt="${n}px"></span>`).join('')}</div><p><a href="${a.source}">原稿</a> · <a href="${a.id}.json">提示词</a></p></article>`;}).join('')}</div>${missing.length?'<p>待补齐：'+missing.join('、')+'</p>':''}</main></html>`);
 console.log(`Prepared ${assets.length}/32 attachment icons; missing: ${missing.join(', ')||'none'}`);
})().catch(e=>{console.error(e);process.exitCode=1;});
