/* 医疗图标审核页：像素放大图、实际48px尺寸与生成原稿入口。 */
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),spec=require('../design/items/medical.json'),c=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root,'js/config.js'),'utf8'),c);
const tiers=vm.runInContext('RARITY',c);
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const cards=spec.items.map(i=>{
 const file=path.join(root,'assets/items',i.id+'.png'),ready=fs.existsSync(file),t=tiers[i.r-1];
 return `<article style="--rc:${t.color}" data-art="${i.id}"><div class="images">${ready?`<a href="sources/${i.id}.png" title="查看生成原稿"><img class="large" src="../../items/${i.id}.png" alt="${esc(i.name)}"></a><img class="actual" src="../../items/${i.id}.png" alt="48像素实际尺寸">`:'<span>整理中</span>'}</div><h2>${esc(i.name)}</h2><p><code>${i.id}</code> · ${t.name} · ${spec.groups[i.medicalGroup]}</p></article>`;
}).join('');
const folder=path.join(root,'assets/item-art/medical');fs.mkdirSync(folder,{recursive:true});
fs.writeFileSync(path.join(folder,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>潮汐线 · 医疗品图标总览</title><style>
*{box-sizing:border-box}body{margin:0;padding:30px 36px;background:#0d1714;color:#cbdcd4;font:13px "Microsoft YaHei",sans-serif}header{display:flex;justify-content:space-between;gap:20px;align-items:center;margin-bottom:24px}h1{font-size:24px;margin:0 0 10px;letter-spacing:3px}header p{color:#829e90;margin:0;line-height:1.8}a{color:#a2c9b4}.grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px}article{min-width:0;border:1px solid #294137;border-left:3px solid var(--rc);background:#15251e;padding:8px}.images{height:156px;display:flex;align-items:center;justify-content:center;gap:4px}.images img{image-rendering:pixelated;object-fit:contain}.large{width:144px;height:144px}.actual{width:48px;height:48px}h2{font-size:13px;font-weight:500;margin:9px 0;color:#d9e7df;line-height:1.4}article p{font-size:10px;color:#809c8d;margin:0;line-height:1.7}code{color:var(--rc)}@media(max-width:1150px){.grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:620px){body{padding:20px 12px}header{align-items:flex-start;flex-direction:column}.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}article{padding:6px}.images{height:124px;gap:0}.large{width:96px;height:96px}.actual{width:48px;height:48px}h2{font-size:11px}.images a{min-width:0}.actual{flex-shrink:0}}
</style><header><div><h1>医疗品图标 · 18件</h1><p>大图为3倍最近邻放大，旁边展示48像素原尺寸。透明背景 · 统一左上光源 · 点击大图查看原稿。<br>仅恢复类5件已开放使用，其余13件保留“效果待开放”。</p></div><a href="../../../wiki.html#items">返回物品Wiki →</a></header><main class="grid">${cards}</main></html>`);
console.log('已生成医疗品图标总览：'+spec.items.length+'件');
