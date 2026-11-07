/* 钥匙房 · 携带模型实测（修正"按比例变现"的错误）
   node tools/verify-keyroom-carry.js [样本数]
   真实 Loot.fill 生成每局物品，再按玩家行为模拟装包：
     · 按价值从高到低挑（金红优先→紫→…），受「背包格数」与「承重 45kg」双约束
     · 安全箱 4 格单独计（必带出）
   输出各容量档的「实际带走」分布，与「产出总值」对比。
*/
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const N = parseInt(process.argv[2], 10) || 100000;

function seeded(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
const ctx = vm.createContext({ console, performance, Math: Object.create(Math) });
ctx.Math.random = seeded(20261107);
for (const f of ['config.js', 'data.js', 'core.js'])
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx);
vm.runInContext(`simBox=(ch)=>{const t=CONTAINER_TYPES[ch];return Loot.fill(t.q,t.cats||null,t);};`, ctx);

const CFG = vm.runInContext('CFG', ctx);
const BAG = CFG.BAG;
const ROOM = ['V','B','O','I','Q'];

const priceOf = it => {
  if (!it) return 0;
  if (typeof it.price === 'number' && it.price > 0) return it.price;
  if (it.base && typeof it.base.price === 'number') return it.base.price;
  return 0;
};

/* 玩家装包：按单价降序，跳过装不下的（超重），格满即停 */
function carry(items, slots, weightCap, safeSlots) {
  const arr = items.map(x => ({
    p: priceOf(x.item) * (x.n || 1),
    w: (x.item && typeof x.item.w === 'number' ? x.item.w : 0) * (x.n || 1)
  })).sort((a, b) => b.p - a.p);
  let s = 0, ws = 0, val = 0, taken = 0;
  for (const a of arr) {
    if (s >= slots) break;
    if (a.w > 0 && ws + a.w > weightCap) continue;   // 太重，跳过试下一件
    s++; ws += a.w; val += a.p; taken++;
  }
  return { val, ws, taken };
}

const SCEN = [
  { key: 'bag05-30格/45kg', slots: 30, wt: 45 },
  { key: 'bag03-22格/45kg', slots: 22, wt: 45 },
  { key: 'bag02-18格/45kg', slots: 18, wt: 45 },
  { key: 'bag01-14格/45kg', slots: 14, wt: 45 },
  { key: '基础-6格/45kg',   slots: 6,  wt: 45 },
  { key: '22格/37kg(留装备)', slots: 22, wt: 37 },
  { key: '22格/30kg(重装)', slots: 22, wt: 30 }
];

const acc = {};
for (const s of SCEN) acc[s.key] = new Float64Array(N);
const totalV = new Float64Array(N);
const totalW = new Float64Array(N);
const itemCnt = new Float64Array(N);
const byR = {};        // r -> { val, cnt }
const onlyPurple = new Float64Array(N);  // 只带 r>=4（紫以上）
const onlyGoldRed = new Float64Array(N); // 只带 r>=5（金红）

for (let i = 0; i < N; i++) {
  let items = [], tv = 0, tw = 0;
  let vPurple = 0, vGoldRed = 0;
  for (const ch of ROOM) {
    const out = vm.runInContext(`simBox(${JSON.stringify(ch)})`, ctx);
    for (const r of out) {
      items.push(r);
      const p = priceOf(r.item) * (r.n || 1);
      const w = (r.item && typeof r.item.w === 'number' ? r.item.w : 0) * (r.n || 1);
      tv += p; tw += w;
      const rr = r.item ? r.item.r : 0;
      if (!byR[rr]) byR[rr] = { val: 0, cnt: 0 };
      byR[rr].val += p; byR[rr].cnt++;
      if (rr >= 4) vPurple += p;
      if (rr >= 5) vGoldRed += p;
    }
  }
  onlyPurple[i] = vPurple; onlyGoldRed[i] = vGoldRed;
  totalV[i] = tv; totalW[i] = tw; itemCnt[i] = items.length;
  for (const s of SCEN) acc[s.key][i] = carry(items, s.slots, s.wt, BAG.SAFE).val;
}

const sorted = a => Array.from(a).sort((x, y) => x - y);
const q = (a, p) => a[Math.min(a.length - 1, Math.floor(p * a.length))];
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const M = v => '¥' + Math.round(v).toLocaleString('en-US');

const tv = sorted(totalV);
console.log('样本', N.toLocaleString('en-US'));
console.log('每局物品件数：均值', (mean(itemCnt)).toFixed(2), '| 总重均值', mean(totalW).toFixed(1) + 'kg', '| 总值均值', M(mean(totalV)));
console.log('');
console.log('容量档'.padEnd(22), '带走均值', '  中位', '      p10', '      实现率');
for (const s of SCEN) {
  const arr = sorted(acc[s.key]);
  const m = mean(acc[s.key]);
  console.log(
    s.key.padEnd(22),
    M(m).padStart(11),
    M(q(arr, .5)).padStart(11),
    M(q(arr, .10)).padStart(11),
    ((m / mean(totalV)) * 100).toFixed(1).padStart(7) + '%'
  );
}

console.log('\n=== 价值按稀有度分布（红=r6 金=r5 紫=r4）===');
const RARITY = vm.runInContext('RARITY', ctx);
const totValAll = Object.values(byR).reduce((s, x) => s + x.val, 0);
const totCntAll = Object.values(byR).reduce((s, x) => s + x.cnt, 0);
for (const r of Object.keys(byR).sort((a, b) => a - b)) {
  const x = byR[r];
  const nm = (RARITY[r - 1] && RARITY[r - 1].name) || ('r' + r);
  console.log(('r' + r + ' ' + nm).padEnd(10),
    '件数占比 ' + (x.cnt / totCntAll * 100).toFixed(1).padStart(5) + '%',
    '| 价值占比 ' + (x.val / totValAll * 100).toFixed(1).padStart(5) + '%');
}
console.log('\n只带紫以上(r>=4)：均值', M(mean(onlyPurple)), ' 实现率', (mean(onlyPurple) / mean(totalV) * 100).toFixed(1) + '%');
console.log('只带金红(r>=5)  ：均值', M(mean(onlyGoldRed)), ' 实现率', (mean(onlyGoldRed) / mean(totalV) * 100).toFixed(1) + '%');

console.log('\n=== 各"挑剔策略"在 ¥2.7M/次 的盈亏 ===');
function line(name, arr) {
  const m = mean(arr);
  const loss = Array.from(arr).filter(v => v < 2700000).length / N;
  console.log(name.padEnd(20), '均值', M(m).padStart(11), '| 亏损率', (loss * 100).toFixed(1).padStart(5) + '%', '| 净', (m - 2700000 >= 0 ? '+' : '') + M(m - 2700000));
}
line('全部带走', totalV);
line('只带紫以上', onlyPurple);
line('只带金红', onlyGoldRed);
line('6格基础包', acc['基础-6格/45kg']);

console.log('\n=== 以「bag03-22格/45kg」为例，不同钥匙单价的盈亏 ===');
const base = sorted(acc['bag03-22格/45kg']);
for (const price of [1600000, 1800000, 2200000, 2700000, 3000000, 3400000]) {
  const loss = base.filter(v => v < price).length / N;
  const net = mean(acc['bag03-22格/45kg']) - price;
  console.log(String(price).padStart(9), '| 亏损率', (loss * 100).toFixed(1).padStart(5) + '%', '| 净', (net >= 0 ? '+' : '') + M(net));
}
