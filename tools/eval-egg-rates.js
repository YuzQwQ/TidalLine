/* 彩蛋产出评估：把「红后再掷一次」换算成玩家真实能撞见的频率
   node tools/eval-egg-rates.js [抽样容器数]
   ─ 解析口径：每个容器实例按 (品质, 偏好, 专属池) 算一张权重表，
     彩蛋概率 = 红档总量 × eggChance，再除以容器抽数（rolls）得到单抽概率。
   ─ 同时给出「全图摸一遍」「摸 N 个容器」的期望与撞见概率，方便定 eggChance。
*/
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ctx = vm.createContext({ console, performance });
for (const f of ['config.js', 'data.js', 'attachment-data.js', 'attachments.js', 'core.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx);
}
const G = vm.runInContext(
  '({ITEMS, CONTAINER_TYPES, CONTAINER_QUALITY, BOX_COUNT, MAP: RAID_MAP, Loot, CFG, itemGroup, QUALITY_ORDER})', ctx);
const { ITEMS, CONTAINER_TYPES, CONTAINER_QUALITY, BOX_COUNT, MAP, Loot, CFG, itemGroup, QUALITY_ORDER } = G;
const RED_R = (CFG.LOOT && CFG.LOOT.eggRarity) || 6;
const EGGS = ITEMS.filter(i => i.egg);

/* 与 Loot.roll 同源：pct[r] × catW / ΣcatW × tierWeight / ΣtierWeight */
function eggRate(quality, prefCats, itemPool) {
  const Q = CONTAINER_QUALITY[quality];
  if (!Q) return 0;
  const bias = r => Q.pct[r - 1] || 0;
  const inPool = it => {
    if (!itemPool) return true;
    if (itemPool.redAllCollectibles && it.r === RED_R) return itemGroup(it) === 'collectible';
    return itemPool.cats.indexOf(it.cat) >= 0;
  };
  const CAT_PREF = (CFG.LOOT && CFG.LOOT.catPref) || 9;
  const catW = it => {
    if (itemPool) return 1;
    let v = (prefCats && prefCats.includes(it.cat)) ? CAT_PREF : 1;
    if (Q.lv >= 5 && it.cat === 'collect') v *= 1.35;
    else if (Q.lv <= 2 && (it.cat === 'ind' || it.cat === 'life')) v *= 1.25;
    return v;
  };
  const pool = ITEMS.filter(it => !it.noLoot && !it.egg && bias(it.r) > 0 && inPool(it));
  const cellW = {}, cellT = {};
  for (const it of pool) {
    if (!cellW[it.r]) { cellW[it.r] = 0; cellT[it.r] = {}; }
    if (cellT[it.r][it.cat] == null) { cellW[it.r] += catW(it); cellT[it.r][it.cat] = 0; }
    cellT[it.r][it.cat] += Loot.tierWeight(it);
  }
  let total = 0, red = 0;
  for (const it of pool) {
    const v = bias(it.r) * catW(it) / cellW[it.r] * Loot.tierWeight(it) / cellT[it.r][it.cat];
    total += v;
    if (it.r === RED_R) red += v;
  }
  return total > 0 ? (red / total) * Loot.eggChanceFor(quality) : 0;
}

/* 实例表：容器 + 物资刷新点（刷新点不吃彩蛋，只用来算「摸到的件数」口径） */
const instances = MAP.containers.map(b => {
  const type = CONTAINER_TYPES[b.type];
  if (!type) return null;
  const fromType = Array.isArray(type.cats) && type.cats.length > 0;
  const prefCats = type.itemPool ? null : (fromType ? type.cats : (Array.isArray(b.preference) ? b.preference : null));
  const rolls = type.rolls || BOX_COUNT[type.q] || [1, 2];
  return {
    ch: b.type, region: b.region, quality: type.q, name: type.name,
    itemPool: type.itemPool || null, prefCats,
    draws: (rolls[0] + rolls[1]) / 2,
    p: eggRate(type.q, prefCats, type.itemPool || null)
  };
}).filter(Boolean);

const totalDraws = instances.reduce((s, i) => s + i.draws, 0);
const lambda = instances.reduce((s, i) => s + i.draws * i.p, 0);
const byQ = {};
for (const i of instances) {
  const q = byQ[i.quality] || (byQ[i.quality] = { boxes: 0, draws: 0, lambda: 0, p: i.p });
  q.boxes++; q.draws += i.draws; q.lambda += i.draws * i.p;
}

const pct = v => (v * 100).toFixed(v >= 0.01 ? 2 : 4) + '%';
const per = l => l > 0 ? (1 / l).toFixed(1) + ' 次' : '∞';

console.log('彩蛋池：' + EGGS.map(e => e.short + ' ¥' + (e.price / 1e4).toFixed(0) + '万').join(' / '));
console.log('红后中签率（按容器品质）：' + QUALITY_ORDER.map(q => q + ' ' +
  (Loot.eggChanceFor(q) * 100).toFixed(1) + '%').join(' · ') + '\n');
console.log('品质        箱数   单抽彩蛋率    每箱期望抽数   全图 λ');
for (const q of QUALITY_ORDER) {
  const r = byQ[q];
  if (!r) continue;
  console.log(
    (CONTAINER_QUALITY[q].name + ' ' + q).padEnd(10) +
    String(r.boxes).padStart(4) + String(r.draws.toFixed(0)).padStart(9) +
    ('   ' + pct(r.p)).padStart(14) +
    ('   ' + (r.draws / Math.max(1, r.boxes)).toFixed(1)).padStart(14) +
    ('   ' + r.lambda.toFixed(4)).padStart(9));
}
console.log('\n全图容器 ' + instances.length + ' 个，单局期望抽取 ' + totalDraws.toFixed(0) + ' 件');
console.log('全图摸一遍：期望彩蛋 ' + lambda.toFixed(3) + ' 个，撞见至少一个 ' +
  ((1 - Math.exp(-lambda)) * 100).toFixed(1) + '%（约 ' + per(lambda) + '）');
for (const n of [40, 80, 120, 200]) {
  const l = n * (lambda / totalDraws);
  console.log('  摸 ' + String(n).padStart(3) + ' 件 → 期望 ' + l.toFixed(3) + '，撞见 ' +
    ((1 - Math.exp(-l)) * 100).toFixed(1) + '%');
}

/* 敏感性：整张表按倍率缩放后，全图期望与撞见概率会变成多少 */
console.log('\n倍率敏感性（整张表 ×k，红档不变）：');
for (const k of [0.5, 1, 1.5, 2, 3]) {
  const l = lambda * k;
  console.log('  ×' + k.toFixed(1) + ' → 全图期望 ' + l.toFixed(2) + ' 个，撞见 ' +
    ((1 - Math.exp(-l)) * 100).toFixed(0) + '%（约 ' + per(l) + '）');
}

/* 蒙特卡洛校验：真实 Loot.fill 抽样，确认解析值与实测一致 */
const N = parseInt(process.argv[2], 10) || 0;
if (N > 0) {
  let hits = 0, items = 0;
  const pool = instances.map(i => i.ch);
  for (let i = 0; i < N; i++) {
    const ch = pool[Math.floor(Math.random() * pool.length)];
    const type = CONTAINER_TYPES[ch];
    const fromType = Array.isArray(type.cats) && type.cats.length > 0;
    const pref = type.itemPool ? null : (fromType ? type.cats : null);
    const got = Loot.fill(type.q, pref, type);
    for (const e of got) { items++; if (e.item.egg) hits++; }
  }
  console.log('\n实测：' + N + ' 个随机容器 → ' + items + ' 件，彩蛋 ' + hits + ' 个（' +
    (items ? (hits / items * 100).toFixed(4) : '0') + '%）');
}
