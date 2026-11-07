/* 老公寓钥匙房 · 出红率与产出分布复核
   node tools/verify-keyroom.js
   用真实 Loot.fill 抽样，分别给出：
     · 单件：每抽一件是红的概率（= CONTAINER_QUALITY.pct 的 r6 档）
     · 单箱：件数、红件数、单箱「至少一红」概率
     · 整房：至少一红概率、产出分布
   目的：厘清「8.11% 是单件还是单箱」这个被质疑的点。 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.resolve(__dirname, '..');

function seeded(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}

const ctx = vm.createContext({ console, performance, Math: Object.create(Math) });
// 先注入种子随机，再加载游戏脚本，保证 Loot 内部用的是可复现序列
ctx.Math.random = seeded(20261107);
for (const f of ['config.js', 'data.js', 'core.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx);
}
// 在上下文内定义取箱函数，才能把 type 对象（含 itemPool/ammoPool）原样传进 fill
vm.runInContext(`
  simBox = (ch) => {
    const t = CONTAINER_TYPES[ch];
    return Loot.fill(t.q, t.cats || null, t);
  };
`, ctx);

const CFG = vm.runInContext('CFG', ctx);
const RED = (CFG.LOOT && CFG.LOOT.eggRarity) || 6;
const TYPES = vm.runInContext('CONTAINER_TYPES', ctx);
const BOX_COUNT = vm.runInContext('BOX_COUNT', ctx);
const QPCT = vm.runInContext('Object.fromEntries(Object.entries(CONTAINER_QUALITY).map(([k,v])=>[k,v.pct]))', ctx);

console.log('BOX_COUNT        =', JSON.stringify(BOX_COUNT));
console.log('CONTAINER_QUALITY.pct（r6 为最后一档）:');
for (const [q,p] of Object.entries(QPCT)) console.log('   ', q.padEnd(7), JSON.stringify(p), '→ 单件红率', p[p.length-1] + '%');
console.log('RED rarity =', RED, '\n');

const ROOM = ['V','B','O','I','Q'];
const perBox = {};
for (const ch of ROOM) perBox[ch] = { draws:0, redDraws:0, boxes:0, boxRed:0, items:0, value:0 };

function priceOf(it){
  if(!it) return 0;
  if(typeof it.price==='number' && it.price>0) return it.price;
  if(it.base && typeof it.base.price==='number') return it.base.price;
  return 0;
}

const N = 200000;
let roomRed = 0, roomValue = 0, unpriced = 0;
const vals = new Float64Array(N);

for (let i=0;i<N;i++){
  let anyRed = false, sumVal = 0;
  for (const ch of ROOM){
    const out = vm.runInContext(`simBox(${JSON.stringify(ch)})`, ctx);
    const st = perBox[ch];
    st.boxes++; st.items += out.length;
    let redInBox = 0;
    for (const r of out){
      st.draws++;
      const isRed = r.item && r.item.r === RED;
      if (isRed){ st.redDraws++; redInBox++; anyRed = true; }
      const p = priceOf(r.item);
      if (!(p > 0) && r.item && r.item.r !== undefined) unpriced++;
      sumVal += p;
      st.value += p;
    }
    if (redInBox > 0) st.boxRed++;
  }
  if (anyRed) roomRed++;
  roomValue += sumVal;
  vals[i] = sumVal;
}

const sorted = Array.from(vals).sort((a,b)=>a-b);
const pctile = q => sorted[Math.min(N-1, Math.floor(q*N))];
const mean = roomValue / N;

console.log('==================== 单箱 ====================');
console.log('容器'.padEnd(16), '单件红率', ' 单箱≥1红', ' 平均件数', ' 平均红件', ' 期望价值');
for (const ch of ROOM){
  const st = perBox[ch];
  const rate = st.redDraws/st.draws*100;
  const boxRed = st.boxRed/st.boxes*100;
  console.log(
    TYPES[ch].name.padEnd(16),
    (rate.toFixed(3)+'%').padStart(8),
    (boxRed.toFixed(2)+'%').padStart(9),
    (st.items/st.boxes).toFixed(2).padStart(9),
    (st.redDraws/st.boxes).toFixed(4).padStart(9),
    ('¥'+Math.round(st.value/st.boxes).toLocaleString()).padStart(12)
  );
}

console.log('\n==================== 整房 ====================');
console.log('至少一件红      :', (roomRed/N*100).toFixed(2) + '%');
console.log('平均产出        : ¥' + Math.round(mean).toLocaleString());
console.log('中位数          : ¥' + Math.round(pctile(0.50)).toLocaleString());
console.log('p10 / p25       : ¥' + Math.round(pctile(0.10)).toLocaleString() + ' / ¥' + Math.round(pctile(0.25)).toLocaleString());
console.log('p75 / p90       : ¥' + Math.round(pctile(0.75)).toLocaleString() + ' / ¥' + Math.round(pctile(0.90)).toLocaleString());
console.log('p95 / p99       : ¥' + Math.round(pctile(0.95)).toLocaleString() + ' / ¥' + Math.round(pctile(0.99)).toLocaleString());
console.log('未定价件数(装备等) :', unpriced);
