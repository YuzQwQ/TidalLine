/* 四把钥匙房 · 产出与定价评估
   node tools/eval-keyrooms.js [每房样本数]
   按用户给定的容器组成，用真实 Loot.fill 抽样，
   计算：总值分布、出红率、件数/重量、携带模型下的实际带走分布，
   并反算「目标亏损率」对应的单次钥匙价。
*/
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const N = parseInt(process.argv[2], 10) || 60000;

function seeded(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
const ctx = vm.createContext({ console, performance, Math: Object.create(Math) });
ctx.Math.random = seeded(20261107);
for (const f of ['config.js', 'data.js', 'attachment-data.js', 'attachments.js', 'core.js'])
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx);
vm.runInContext(`simBox=(ch)=>{const t=CONTAINER_TYPES[ch];return Loot.fill(t.q,t.cats||null,t);};`, ctx);

const CFG = vm.runInContext('CFG', ctx);
const RARITY = vm.runInContext('RARITY', ctx);
const TYPES = vm.runInContext('CONTAINER_TYPES', ctx);
const RED = (CFG.LOOT && CFG.LOOT.eggRarity) || 6;

const priceOf = it => {
  if (!it) return 0;
  if (typeof it.price === 'number' && it.price > 0) return it.price;
  if (it.base && typeof it.base.price === 'number') return it.base.price;
  return 0;
};
/* 弹药/枪械/护甲/背包/配件在商人处按半价回收（item.sell），
   藏品按类别 60% 上下。这里只认显式 sell 字段，其余退回面值，
   用来区分「面值」与「真能变现的钱」——装备房的差别主要体现在这。 */
const sellOf = it => {
  if (!it) return 0;
  if (typeof it.sell === 'number' && it.sell > 0) return it.sell;
  return priceOf(it);
};
const groupOf = it => {
  if (!it) return 'other';
  if (it.equip && it.equip.kind) return it.equip.kind === 'armor' ? 'armor' : it.equip.kind;
  return it.cat || 'other';
};
function carry(items, slots, weightCap) {
  const arr = items.map(x => ({ p: priceOf(x.item) * (x.n || 1), w: (x.item && typeof x.item.w === 'number' ? x.item.w : 0) * (x.n || 1) }))
    .sort((a, b) => b.p - a.p);
  let s = 0, ws = 0, val = 0;
  for (const a of arr) {
    if (s >= slots) break;
    if (a.w > 0 && ws + a.w > weightCap) continue;
    s++; ws += a.w; val += a.p;
  }
  return val;
}

const ROOMS = [
  { key: 'clinic',    name: '诊所储藏室',        letters: ['M','M','K','B'] },
  { key: 'bank',      name: '银行金库大门',      letters: ['V','V','V','B','B','I'] },
  { key: 'watch',     name: '钟表店私人收藏室',  letters: ['V','B','B','G','G'] },
  { key: 'warehouse', name: '仓库后勤储备室',    letters: ['h','h','g','g','g','I','K'] },
  { key: 'oldapt',    name: '老公寓3号房（参照）', letters: ['V','B','O','I','Q'] }
];

const comp = r => {
  const c = {};
  for (const ch of r.letters) c[ch] = (c[ch] || 0) + 1;
  return Object.entries(c).map(([ch, n]) => n + '×' + TYPES[ch].name).join(' + ');
};

const M = v => '¥' + Math.round(v).toLocaleString('en-US');
const q = (a, p) => a[Math.min(a.length - 1, Math.floor(p * a.length))];

console.log('样本/房 =', N.toLocaleString('en-US'), '\n');

const summary = [];
for (const room of ROOMS) {
  const tot = new Float64Array(N), goldRed = new Float64Array(N), all = new Float64Array(N), base6 = new Float64Array(N);
  const cash = new Float64Array(N);
  const byGroup = {};
  let redCnt = 0, itemSum = 0, wSum = 0;
  for (let i = 0; i < N; i++) {
    let items = [], tv = 0, vg = 0, anyRed = false, tw = 0, cashV = 0;
    for (const ch of room.letters) {
      const out = vm.runInContext(`simBox(${JSON.stringify(ch)})`, ctx);
      for (const r of out) {
        items.push(r);
        const p = priceOf(r.item) * (r.n || 1);
        const w = (r.item && typeof r.item.w === 'number' ? r.item.w : 0) * (r.n || 1);
        tv += p; tw += w; cashV += sellOf(r.item) * (r.n || 1);
        const g = groupOf(r.item);
        (byGroup[g] = byGroup[g] || { v: 0, c: 0 });
        byGroup[g].v += p; byGroup[g].c++;
        if (r.item && r.item.r >= 5) vg += p;
        if (r.item && r.item.r === RED) anyRed = true;
      }
    }
    tot[i] = tv; goldRed[i] = vg; cash[i] = cashV; all[i] = carry(items, 22, 45); base6[i] = carry(items, 6, 45);
    if (anyRed) redCnt++;
    itemSum += items.length; wSum += tw;
  }
  const sTot = Array.from(tot).sort((a,b)=>a-b);
  const sGold = Array.from(goldRed).sort((a,b)=>a-b);
  const sAll = Array.from(all).sort((a,b)=>a-b);
  const sB6 = Array.from(base6).sort((a,b)=>a-b);
  const mean = a => a.reduce((x,y)=>x+y,0)/N;

  const row = {
    name: room.name, comp: comp(room),
    mean: mean(tot), med: q(sTot,.5), p10: q(sTot,.1), p90: q(sTot,.9),
    red: redCnt/N, items: itemSum/N, kg: wSum/N,
    allMean: mean(all), goldMean: mean(goldRed), b6Mean: mean(base6), cashMean: mean(cash),
    byGroup,
    sAll, sGold, sB6
  };
  summary.push(row);

  console.log('【' + room.name + '】 ' + row.comp);
  console.log('  总值  均值 ' + M(row.mean) + ' | 中位 ' + M(row.med) + ' | p10 ' + M(row.p10) + ' | p90 ' + M(row.p90));
  console.log('  变现  均值 ' + M(row.cashMean) + '（装备按商人半价回收折算）');
  console.log('  出红率 ' + (row.red*100).toFixed(1) + '% | 件数 ' + row.items.toFixed(1) + ' | 重量 ' + row.kg.toFixed(1) + 'kg');
  console.log('  带走  全部 ' + M(row.allMean) + ' | 只带金红 ' + M(row.goldMean) + ' | 6格 ' + M(row.b6Mean));
  const kinds = Object.entries(row.byGroup).sort((a,b)=>b[1].v-a[1].v);
  console.log('  构成  ' + kinds.map(([k,x]) => k + ' ' + (x.v/row.mean/N*100).toFixed(1) + '%').join(' | '));
  console.log('');
}

console.log('=== 目标亏损率 → 单次钥匙价（按「只带金红」分布）===');
console.log('房间'.padEnd(18), '30%'.padStart(10), '50%'.padStart(10), '65%'.padStart(10), '  均值');
for (const r of summary) {
  console.log(
    r.name.padEnd(18),
    M(q(r.sGold, .30)).padStart(10),
    M(q(r.sGold, .50)).padStart(10),
    M(q(r.sGold, .65)).padStart(10),
    ('  ' + M(r.goldMean))
  );
}

console.log('\n=== 同上（按「全部带走」分布）===');
console.log('房间'.padEnd(18), '30%'.padStart(10), '50%'.padStart(10), '65%'.padStart(10), '  均值');
for (const r of summary) {
  console.log(
    r.name.padEnd(18),
    M(q(r.sAll, .30)).padStart(10),
    M(q(r.sAll, .50)).padStart(10),
    M(q(r.sAll, .65)).padStart(10),
    ('  ' + M(r.allMean))
  );
}
