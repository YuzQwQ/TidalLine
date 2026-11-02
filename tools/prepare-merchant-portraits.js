/* Design portrait derivatives only. No runtime asset registration or game build. */
const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'assets/npc-art/merchants');
const design=JSON.parse(fs.readFileSync(path.join(root,'design/merchants/design-v1.json')));
(async()=>{
 const assets=[];
 for(const c of design.characters){
   const a=JSON.parse(fs.readFileSync(path.join(folder,c.id+'.json'))),source=path.join(folder,a.source),meta=await sharp(source).metadata();
   await sharp(source).resize(768,960,{fit:'contain',background:'#101a16'}).png().toFile(path.join(folder,c.id+'.png'));
   a.target='assets/npc-art/merchants/'+c.id+'.png';a.sourceSize=[meta.width,meta.height];a.size=[768,960];a.style='realistic painterly NPC concept portrait, pre-2000 industrial setting';assets.push(a);
 }
 fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify({generator:'Built-in image_gen',status:'design_only_not_integrated',assets},null,2)+'\n');
 fs.writeFileSync(path.join(folder,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>潮汐线 · 三位商人立绘</title><style>*{box-sizing:border-box}body{margin:0;background:#101a16;color:#d8e3db;font:15px/1.8 system-ui}main{max-width:1400px;margin:auto;padding:28px}a{color:#afcfbc}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}article{background:#1a2b21;padding:18px;min-width:0}img{width:100%;aspect-ratio:4/5;object-fit:contain}h2{margin:8px 0;font-size:23px}small{color:#aabfae}p{color:#b5c7bc}blockquote{margin:12px 0;padding-left:12px;border-left:2px solid #a88e60;color:#d7c9a7}code{font-size:11px;overflow-wrap:anywhere}@media(max-width:850px){.grid{grid-template-columns:1fr}main{padding:16px}img{max-height:650px}}</style><main><h1>三位商人 · NPC立绘概念稿</h1><p>依据新版角色方案：玛拉48岁、埃德加55岁、林岑41岁。写实概念风、90年代实用服装、统一左上光源与暗色职业背景。本轮仅设计与立绘，尚未加入游戏商人界面。</p><p><a href="../../../design/merchants/index.html">完整设计评审页</a> · <a href="manifest.json">实际提示词与原稿</a></p><div class="grid">${design.characters.map(c=>`<article><img src="${c.id}.png" alt="${c.name}，${c.age}岁，${c.role}"><h2>${c.name}</h2><small>${c.englishName} · ${c.age}岁</small><blockquote>${c.theme}</blockquote><p>${c.publicIdentity}</p><p>${c.biography}</p><p><a href="sources/${c.id}.png">生成原稿</a></p><code>${c.id}</code></article>`).join('')}</div></main></html>`);
 console.log('Prepared 3 design portraits at 768x960; runtime game untouched');
})().catch(e=>{console.error(e);process.exitCode=1;});
