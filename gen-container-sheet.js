/* 从游戏数据与美术清单生成容器页：node gen-container-sheet.js。 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { writeSheet } = require('./tools/wiki-layout');
const root = __dirname;
const ctx = vm.createContext({});
for (const file of ['config.js', 'data.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), ctx);
}
const { types, rows, counts, search, itemSearch, cats, enemies } = vm.runInContext(
  '({types:CONTAINER_TYPES,rows:MAP_ROWS,counts:BOX_COUNT,search:CFG.SEARCH,itemSearch:CFG.ITEM_SEARCH,cats:CATS,enemies:ENEMY_TYPES})', ctx);
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/asset-prompts.json'), 'utf8'));
const artwork = [...manifest.assets, ...(manifest.optional || [])];
const esc = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const tiers = {
  fast: { name: '快取容器', rule: '即开即取，适合快速搜刮。', color: '#7fae9f' },
  std: { name: '标准容器', rule: '需要短暂读条，走出交互范围会中断。', color: '#7e9fb3' },
  heavy: { name: '重型容器', rule: '读条期间必须站定，移动会中断；开箱会发出较大噪声。', color: '#c8b47a' }
};
const entries = Object.entries(types).map(([ch, type]) => {
  const positions = [];
  rows.forEach((row, y) => [...row].forEach((cell, x) => { if (cell === ch) positions.push([x, y]); }));
  return { ...type, ch, positions };
});
const total = entries.reduce((n, entry) => n + entry.positions.length, 0);

function thumb(id, name) {
  return fs.existsSync(path.join(root, 'assets/props', id + '.png'))
    ? `<img src="assets/props/${esc(id)}.png" width="96" height="96" alt="${esc(name)}">`
    : '<span>待绘制</span><b>32×32</b>';
}

function card(type) {
  const tier = tiers[type.kind];
  const time = search[type.kind].time;
  const preference = type.cats ? type.cats.map(cat => cats[cat].name).join(' / ') : '通用物品池';
  const visual = artwork.find(a => a.id === type.art);
  return `<article class="item container-card" data-container="${esc(type.ch)}" style="--rc:${tier.color}">
    <div class="thumb container-thumb">${thumb(type.art, type.name)}</div>
    <div class="meta">
      <div class="name">${esc(type.name)}<i class="tag">${tier.name}</i></div>
      <div class="sub"><code>${esc(type.art)}.png</code> · 地图标记 <code>${esc(type.ch)}</code></div>
      <dl class="container-facts">
        <div><dt>开箱</dt><dd>${time === 0 ? '即时打开' : time + ' 秒'}</dd></div>
        <div><dt>抽取次数</dt><dd>${counts[type.kind].join('–')} 次</dd></div>
        <div><dt>掉落偏好</dt><dd>${esc(preference)}</dd></div>
        <div><dt>占格</dt><dd>1 格 · 不可穿过</dd></div>
      </dl>
      <div class="desc">${tier.rule}${type.cats ? '偏好类别的抽取权重 ×4，也可能获得其他类别物品。' : ''}</div>
      <details class="container-positions"><summary>当前地图 ${type.positions.length} 个 · 查看位置</summary><p>${type.positions.map(([x, y]) => `<code>(${x}, ${y})</code>`).join(' ') || '当前地图尚未放置'}</p></details>
      ${visual ? `<div class="vis"><b>画什么</b>${esc(visual.subject)}</div>` : ''}
    </div>
  </article>`;
}

const remains = [
  { key: 'scav', title: '拾荒者尸体', drop: '1 件随机低稀有度物品（r1–r2）；65% 概率额外携带 6–14 发弹药。可搜出其实际穿戴的头盔、护甲和武器。' },
  { key: 'echo', title: '回响体残留', drop: '1 件随机异常遗物；50% 概率额外获得绷带。' },
  { key: 'guard', title: '潮汐守卫残骸', drop: '1 件随机工业器材或电子产品，另有 12 发弹药。' }
];
const body = Object.entries(tiers).map(([kind, tier]) => {
  const list = entries.filter(entry => entry.kind === kind);
  return `<section class="cat"><h2><span class="dot" style="background:${tier.color}"></span>${tier.name}<em>${kind}</em><i>${list.length} 种 · ${list.reduce((n, entry) => n + entry.positions.length, 0)} 个</i></h2><div class="grid container-grid">${list.map(card).join('\n')}</div></section>`;
}).join('\n');

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>潮汐线 · 容器清单</title></head>
<body>
<header>
  <div class="kicker">TIDELINE · CONTAINER SHEET</div>
  <h1>容器清单</h1>
  <div class="lede">所有可搜刮箱柜与遗留物，一处查看。箱柜的类型、数量、位置、搜刮时间与掉落偏好均取自当前游戏数据，预览共用游戏中的场景贴图。</div>
  <div class="wiki-stats"><span><b>${entries.length}</b> 种场景容器</span><span><b>${total}</b> 个地图实例</span><span><b>${remains.length}</b> 类可搜刮遗留物</span></div>
</header>
<div class="spec">
  <div class="panel"><h3>搜刮与掉落</h3>
    <p>靠近后按 <code>E</code> 搜刮。开箱后，物品仍需逐件搜索：按稀有度耗时 ${itemSearch.timeByRarity.join(' / ')} 秒。</p>
    <p>抽取次数是随机抽取的轮数，同一箱内重复物品会被跳过，因此最终件数可能少于抽取次数。类别偏好提高权重，不保证掉落。</p>
    <p>箱柜打开、拿空后仍占一个完整格子。尸体与残骸可通行；桌椅、货架、油桶属于场景摆设，不能搜刮。</p>
  </div>
  <div class="panel"><h3>贴图与透视</h3>
    <p><b>规格</b>　32×32 透明 PNG，主体位于中央 28×28，四周留 2px。下方按整数倍最近邻放大预览。</p>
    <p><b>视角</b>　75° 倾斜俯视，顶面为主、南侧短立面可见，统一左上光源。与角色和其他场景物件保持一致。</p>
    <p><b>位置</b>　贴图来自 <code>assets/props/</code>。地图位置使用从 0 开始的格坐标 <code>(x, y)</code>，x 向右，y 向下。</p>
  </div>
</div>
${body}
<section class="cat"><h2>可搜刮遗留物<em>remains</em><i>${remains.length} 类 · 击败敌人后生成</i></h2>
  <p class="section-note">遗留物不计入上述 ${total} 个固定容器。当前搜刮读条为 0.35 秒；物品仍按逐件搜索规则揭示。</p>
  <div class="grid container-grid">${remains.map(entry => `<article class="item container-card" data-remains="${entry.key}">
    <div class="thumb container-thumb">${thumb('corpse_' + entry.key, entry.title)}</div>
    <div class="meta"><div class="name">${entry.title}<i class="tag dim">可通行</i></div>
      <div class="sub"><code>corpse_${entry.key}.png</code> · 来源：${esc(enemies[entry.key].name)}</div>
      <div class="desc">${entry.drop}</div>
    </div></article>`).join('\n')}</div>
</section>
<footer>由 <code>gen-container-sheet.js</code> 生成。箱柜数据来自 <code>js/data.js</code>，搜刮时间来自 <code>js/config.js</code>，遗留物规则对应 <code>js/entities.js</code>。<br>运行 <code>node gen-wiki.js</code> 可统一更新三份清单与 Wiki；单独重新生成任一清单也会同步更新 Wiki。</footer>
</body></html>`;
writeSheet('容器清单.html', html, 'containers');
console.log(`已生成 容器清单.html（${entries.length} 种容器 / ${total} 个实例 / ${remains.length} 类遗留物）`);
