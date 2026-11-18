/* 一次性脚本：按稀有度系数重定标收集品价格，并同步 design/items/economy.json。
   用法 node tools/_rescale-collectibles.js [--apply] */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

const COEF = { 1: 1, 2: 0.8, 3: 0.6, 4: 0.45, 5: 0.3, 6: 0.18 };
const STEP = { 1: 100, 2: 10, 3: 50, 4: 100, 5: 500, 6: 10000 };
const apply = process.argv.includes('--apply');

const spec = JSON.parse(fs.readFileSync(path.join(root, 'design/items/economy.json'), 'utf8'));
let src = fs.readFileSync(path.join(root, 'js/data.js'), 'utf8');

const rows = [];
for (const row of spec.items) {
  if (row.group !== 'collectible') continue;
  const r = row.rarity;
  const next = Math.max(STEP[r], Math.round(row.price * COEF[r] / STEP[r]) * STEP[r]);
  rows.push({ id: row.id, r, old: row.price, next });
}

let replaced = 0;
const missed = [];
for (const row of rows) {
  if (row.old === row.next) continue;
  const anchor = "id:'" + row.id + "'";
  const at = src.indexOf(anchor);
  if (at < 0) { missed.push(row.id + '(anchor)'); continue; }
  const priceAt = src.indexOf('price:', at);
  if (priceAt < 0 || priceAt - at > 900) { missed.push(row.id + '(price)'); continue; }
  const numStart = priceAt + 6;
  let numEnd = numStart;
  while (numEnd < src.length && /[0-9]/.test(src[numEnd])) numEnd++;
  const current = Number(src.slice(numStart, numEnd));
  if (current !== row.old) { missed.push(row.id + '(' + current + '≠' + row.old + ')'); continue; }
  src = src.slice(0, numStart) + row.next + src.slice(numEnd);
  replaced++;
}

const bands = {
  1: { min: 1000, max: 3000 },
  2: { min: 3000, max: 8000 },
  3: { min: 5000, max: 25000 },
  4: { min: 9000, max: 55000 },
  5: { min: 20000, max: 150000 },
  6: { min: 70000, max: null },
};

let over = [];
for (const row of rows) {
  const b = bands[row.r];
  if (row.next < b.min || (b.max !== null && row.next > b.max)) over.push(row.id + ':' + row.next + ' 不在 r' + row.r + ' 区间');
}

console.log('替换 ' + replaced + ' 处，未命中 ' + missed.length + (missed.length ? ' → ' + missed.slice(0, 6).join(', ') : ''));
if (over.length) console.log('超出新价位区间 ' + over.length + ' 项 → ' + over.slice(0, 8).join(', '));

if (apply) {
  fs.writeFileSync(path.join(root, 'js/data.js'), src);
  for (const row of rows) {
    const target = spec.items.find(i => i.id === row.id);
    if (target) target.price = row.next;
  }
  spec.collectionBands = spec.collectionBands.map(b => ({
    ...b,
    min: bands[b.rarity].min,
    ...(bands[b.rarity].max === null ? {} : { max: bands[b.rarity].max }),
  }));
  spec.date = '2026-11-18';
  fs.writeFileSync(path.join(root, 'design/items/economy.json'), JSON.stringify(spec, null, 2) + '\n');
  console.log('已写入 js/data.js 与 design/items/economy.json');
}
