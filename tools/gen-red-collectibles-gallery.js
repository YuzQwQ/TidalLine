/* 红档扩充 V1.0 的美术审核页：把 48px 图标放大对照，点击看 1254px 原稿。
   node tools/gen-red-collectibles-gallery.js
   只读 data.js 与批次目录，不参与游戏运行。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const BATCH = path.join(root, 'assets/item-art/red-collectibles-v1');
const ctx = vm.createContext({ console });
for (const f of ['config.js', 'data.js']) vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx);
const ITEMS = vm.runInContext('ITEMS', ctx);
const CATS = vm.runInContext('CATS', ctx);
const TIER = { 1: '普通红', 2: '良好红', 3: '稀有红' };

const ids = fs.readdirSync(path.join(BATCH, 'sources')).filter(f => f.endsWith('.png')).map(f => path.basename(f, '.png')).sort();
const money = n => '¥' + Number(n).toLocaleString('en-US');
const rows = ids.map(id => ITEMS.find(item => item.id === id)).filter(Boolean)
  .sort((a, b) => a.tier - b.tier || ITEMS.indexOf(a) - ITEMS.indexOf(b));

const cards = rows.map(item => `<article data-art="${item.id}">
<div class="images"><a href="sources/${item.id}.png" title="查看 1254px 原稿"><img class="large" src="../../items/${item.id}.png" alt="${item.name}"></a><img class="actual" src="../../items/${item.id}.png" alt="48 像素实际尺寸"></div>
<h2>${item.name}</h2>
<p><code>${item.id}</code> · ${TIER[item.tier]} · ${CATS[item.cat].name}</p>
<p class="price">${money(item.price)}</p></article>`).join('');

const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>潮汐线 · 高价值红色收集品 V1.0</title><style>
*{box-sizing:border-box}body{margin:0;padding:30px 36px;background:#140f0f;color:#dbc9c6;font:13px "Microsoft YaHei",sans-serif}header{display:flex;justify-content:space-between;gap:20px;align-items:center;margin-bottom:24px}h1{font-size:24px;margin:0 0 10px;letter-spacing:3px;color:#e6d8d4}header p{color:#9c8380;margin:0;line-height:1.8}a{color:#c99a92}.grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px}article{min-width:0;border:1px solid #402a28;border-left:3px solid #8d3a3a;background:#1e1616;padding:8px}.images{height:156px;display:flex;align-items:center;justify-content:center;gap:4px}.images img{image-rendering:pixelated;object-fit:contain}.large{width:144px;height:144px}.actual{width:48px;height:48px;flex-shrink:0}h2{font-size:13px;font-weight:500;margin:9px 0 5px;color:#f0e2de;line-height:1.4}article p{font-size:10px;color:#a08783;margin:0;line-height:1.7}.price{color:#c9a06a;margin-top:3px !important}code{color:#c9a06a}@media(max-width:1150px){.grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:620px){body{padding:20px 12px}header{align-items:flex-start;flex-direction:column}.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}article{padding:6px}.images{height:124px;gap:0}.large{width:96px;height:96px}h2{font-size:11px}}
</style><header><div><h1>高价值红色收集品 · ${rows.length}件</h1><p>普通红 ${rows.filter(i => i.tier === 1).length} · 良好红 ${rows.filter(i => i.tier === 2).length} · 稀有红 ${rows.filter(i => i.tier === 3).length}。放大图旁是 48 像素实际尺寸。<br>原稿 1254px，入库时按 alpha 裁主体、Lanczos 缩到 40px、二值化透明边；点击大图看原稿。</p></div><a href="../../../wiki.html#items">返回物品 Wiki →</a></header><main class="grid">${cards}</main></html>`;

fs.writeFileSync(path.join(BATCH, 'index.html'), html);
console.log(`红品审核页：${rows.length} 件 → assets/item-art/red-collectibles-v1/index.html`);
