/* 物品索引（无图版）：从 js/data.js 直接导出，用于检索、统计和收集进度对照。
   输出 design/items/ITEM_INDEX.md。
   用法：node tools/gen-item-index.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const ctx = vm.createContext({ console, performance });
for (const f of ['config.js', 'data.js', 'core.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx);
}
const ITEMS = vm.runInContext('ITEMS', ctx);
const CATS = vm.runInContext('CATS', ctx);
const RARITY = vm.runInContext('RARITY', ctx);
const itemGroup = vm.runInContext('itemGroup', ctx);

/* “画什么”优先取清单页的视觉描述，其次取物品自带的 visual 字段 */
const sheetSrc = fs.readFileSync(path.join(root, 'gen-item-sheet.js'), 'utf8');
const visualBlock = sheetSrc.slice(sheetSrc.indexOf('const VISUAL = {'), sheetSrc.indexOf('\n};', sheetSrc.indexOf('const VISUAL = {')) + 3);
const VISUAL = vm.runInNewContext(visualBlock + '\nVISUAL;', {});

const esc = s => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
const money = n => n > 0 ? '¥' + Number(n).toLocaleString('en-US') : '—';
const wt = n => (Number.isInteger(n) ? n : Number(n)) + 'kg';

const catOrder = ['life', 'elec', 'ind', 'med', 'collect', 'mil', 'intel', 'occult', 'odd', 'ammo', 'medical'];
const label = it => (CATS[it.cat] && CATS[it.cat].name) || it.cat;
const visualOf = it => VISUAL[it.iconId || it.id] || it.visual || '—';

const rows = [...ITEMS].sort((a, b) => {
  const ca = catOrder.indexOf(a.cat), cb = catOrder.indexOf(b.cat);
  if (ca !== cb) return (ca < 0 ? 99 : ca) - (cb < 0 ? 99 : cb);
  if (a.r !== b.r) return b.r - a.r;
  return a.id.localeCompare(b.id);
});

const collectibles = ITEMS.filter(i => itemGroup(i) === 'collectible');
const supplies = ITEMS.filter(i => itemGroup(i) !== 'collectible');

/* ---------- 统计 ---------- */
const byCat = catOrder
  .filter(c => ITEMS.some(i => i.cat === c))
  .map(c => {
    const list = ITEMS.filter(i => i.cat === c);
    const dist = RARITY.map(t => list.filter(i => i.r === t.k).length);
    return {
      c, name: CATS[c].name, n: list.length, dist,
      weight: list.reduce((a, i) => a + i.w, 0),
      value: list.reduce((a, i) => a + (i.price || 0), 0)
    };
  });

const byRarity = RARITY.map(t => {
  const list = collectibles.filter(i => i.r === t.k);
  return { k: t.k, name: t.name, color: t.color, n: list.length, pct: collectibles.length ? list.length / collectibles.length * 100 : 0 };
});

const noLoot = ITEMS.filter(i => i.noLoot).length;
const noCodex = ITEMS.filter(i => i.noCodex).length;
const heavy = [...ITEMS].sort((a, b) => b.w - a.w)[0];
const pricey = [...ITEMS].sort((a, b) => (b.price || 0) - (a.price || 0))[0];

const distHead = `| 类别 | 条目 | ${RARITY.map(t => t.name).join(' | ')} | 合计重量 | 合计价值 |\n| --- | ---: | ${RARITY.map(() => '---:').join(' | ')} | ---: | ---: |`;
const distRows = byCat.map(r =>
  `| ${r.name} | ${r.n} | ${r.dist.map(v => v || '').join(' | ')} | ${r.weight.toFixed(2)}kg | ${r.value ? '¥' + r.value.toLocaleString('en-US') : '—'} |`
).join('\n');
const totalDist = RARITY.map(t => ITEMS.filter(i => i.r === t.k).length);
const distTotal = `| **合计** | **${ITEMS.length}** | ${totalDist.map(v => '**' + v + '**').join(' | ')} | ${ITEMS.reduce((a, i) => a + i.w, 0).toFixed(2)}kg | ¥${ITEMS.reduce((a, i) => a + (i.price || 0), 0).toLocaleString('en-US')} |`;

const rarityTable = [
  `| 等级 | 名称 | 颜色 | 收集品 | 占比 |`,
  `| ---: | --- | --- | ---: | ---: |`,
  ...byRarity.map(r => `| ${r.k} | ${r.name} | ${r.color} | ${r.n} | ${r.pct.toFixed(1)}% |`)
].join('\n');

const table = [
  `| 编号 | 类别 | 名称 | 稀有度 | 重量 | 价值 | 简称 | 描述 | 画什么 |`,
  `| --- | --- | --- | --- | ---: | ---: | --- | --- | --- |`,
  ...rows.map(it => {
    const r = RARITY[it.r - 1] || { name: '—' };
    return `| \`${it.id}\` | ${label(it)} | ${esc(it.name)} | ${r.name} | ${wt(it.w)} | ${money(it.price)} | ${esc(it.short || '—')} | ${esc(it.desc)} | ${esc(visualOf(it))} |`;
  })
].join('\n');

const md = `# 物品索引（无图版）

> 由 \`tools/gen-item-index.js\` 从 \`js/data.js\` 生成，改完物品重跑即可，不要手改本文件。
> 只保留编号、类别、名称、稀有度、重量、价值、简称、描述、画什么；贴图与分类依据见
> [物品清单](../../物品清单.html) 与 [分类依据](CLASSIFICATION.md)。

## 总览

- 共 **${ITEMS.length}** 件：收集品 **${collectibles.length}**、物资 **${supplies.length}**
- 其中 ${noLoot} 件只能购买或补给、不进入随机掉落；${noCodex} 件无图鉴条目
- 最重的是 **${heavy.name}**（${heavy.w}kg），最贵的是 **${pricey.name}**（${money(pricey.price)}）
- 简称列写 \`—\` 表示未配置简称，背包与商城里直接显示全名

### 按类别

${distHead}
${distRows}
${distTotal}

### 按稀有度（仅收集品）

${rarityTable}

## 全表

按类别排列，同类别内稀有度从高到低。

${table}

---

**字段说明**：编号为程序内唯一 ID，图鉴、存档与掉落配置都用它；重量单位为 kg，影响负重与移速；
价值为标价，非装备类物品出售时按标价结算；简称为背包格与商城中显示的短名；画什么是绘制 48×48 贴图时的视觉提要。
`;

const out = path.join(root, 'design', 'items', 'ITEM_INDEX.md');
fs.writeFileSync(out, md, 'utf8');
console.log(`已生成 design/items/ITEM_INDEX.md：${ITEMS.length} 件（收集品 ${collectibles.length} / 物资 ${supplies.length}）`);
