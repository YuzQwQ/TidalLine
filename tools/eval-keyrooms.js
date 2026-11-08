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
/* 物资刷新点＝单抽固定物品池容器：先按 chance 判定是否出现，再按六档权重抽一件。
   与 js/ground-spawns.js 的 candidates/roll 保持一致（缺档重归一）。 */
vm.runInContext(`globalThis.__spawnCache={};
spawnCandidates=(pool)=>{
 if(pool==='gun')return Object.values(WEAPONS).map(w=>EQUIP.gun(w.id,0));
 if(pool==='attachment')return Object.keys(ATTACHMENT_DEFS).map(id=>EQUIP.attachment(id));
 if(pool==='ammo')return Object.values(AMMO_BY_ID);
 if(pool==='medical')return ITEMS.filter(it=>it.cat==='medical'&&it.use===true);
 if(pool==='helmet'||pool==='body')return [1,2,3,4,5].flatMap(lv=>GEAR.atLevel(pool,lv).map(g=>EQUIP.armor(GEAR.make(pool,g.id))));
 if(pool==='bag')return [1,2,3,4,5].map(lv=>EQUIP.bag('bag0'+lv));
 return ITEMS.filter(it=>!it.noLoot&&!it.egg&&(pool==='all'?itemGroup(it)==='collectible':it.cat===pool));
};
simSpawn=(s)=>{
 const items=globalThis.__spawnCache[s.pool]||(globalThis.__spawnCache[s.pool]=spawnCandidates(s.pool).filter(Boolean));
 const groups=s.weights.map((w,i)=>({w,items:items.filter(it=>it.r===i+1)})).filter(g=>g.w>0&&g.items.length);
 if(!groups.length)return null;
 let n=Math.random()*groups.reduce((a,g)=>a+g.w,0),sel=groups[groups.length-1];
 for(const g of groups){n-=g.w;if(n<0){sel=g;break;}}
 const item=sel.items[Math.floor(Math.random()*sel.items.length)];
 const c=item.cat==='ammo'?(AMMO_POOL.count[item.caliber]||[10,20]):[1,1];
 return {item,n:c[0]+Math.floor(Math.random()*(c[1]-c[0]+1))};
};`, ctx);

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
  { key: 'bank',      name: '银行金库大门',      letters: ['V','V','B','B','I'] },
  { key: 'watch',     name: '钟表店私人收藏室',  letters: ['V','B','B','G','G'] },
  { key: 'warehouse', name: '仓库后勤储备室',    letters: ['h','h','g','g','g','I','K'] },
  { key: 'oldapt',    name: '老公寓3号房',        letters: ['V','B','O'] }
];

/* 刷新点归属：从钥匙门做「门当墙」的连通块，取面积小的一侧＝房间内部。 */
const LAYOUT = JSON.parse(fs.readFileSync(path.join(ROOT, 'design/maps/linhai-old-quarter/layout.json'), 'utf8'));
const KEY_DOOR = { clinic: 'door_key_clinic', bank: 'door_key_bank_vault', watch: 'door_key_watchshop', warehouse: 'door_key_warehouse', oldapt: 'door_key_old_apt' };
function roomLootSpawns(layout, keyId) {
  const W = layout.width, H = layout.height;
  const walkable = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return false; const v = layout.legend[layout.rows[y][x]]; return !!(v && v.walkable); };
  const doors = new Set(); for (const p of layout.portals) for (const [x, y] of p.cells) doors.add(x + ',' + y);
  const portal = layout.portals.find(p => p.keyId === keyId);
  if (!portal) return [];
  const [dx, dy] = portal.cells[0];
  const seen = new Set(), blocks = [];
  for (const [ax, ay] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const nx = dx + ax, ny = dy + ay;
    if (!walkable(nx, ny) || doors.has(nx + ',' + ny) || seen.has(nx + ',' + ny)) continue;
    const set = new Set([nx + ',' + ny]), q = [[nx, ny]];
    while (q.length) {
      const [x, y] = q.pop();
      for (const [sx, sy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const px = x + sx, py = y + sy, k = px + ',' + py;
        if (set.has(k) || !walkable(px, py) || doors.has(k)) continue;
        set.add(k); q.push([px, py]);
      }
    }
    for (const k of set) seen.add(k);
    blocks.push({ size: set.size, set });
  }
  if (!blocks.length) return [];
  blocks.sort((a, b) => a.size - b.size);
  return (layout.lootSpawns || []).filter(s => blocks[0].set.has(s.x + ',' + s.y));
}
for (const r of ROOMS) r.spawns = roomLootSpawns(LAYOUT, KEY_DOOR[r.key]);

const comp = r => {
  const c = {};
  for (const ch of r.letters) c[ch] = (c[ch] || 0) + 1;
  const box = Object.entries(c).map(([ch, n]) => n + '×' + TYPES[ch].name).join(' + ');
  return box + (r.spawns.length ? ' + ' + r.spawns.length + '×刷新点' : '');
};

const M = v => '¥' + Math.round(v).toLocaleString('en-US');
const q = (a, p) => a[Math.min(a.length - 1, Math.floor(p * a.length))];

console.log('样本/房 =', N.toLocaleString('en-US'), '\n');

const summary = [];
for (const room of ROOMS) {
  const tot = new Float64Array(N), goldRed = new Float64Array(N), all = new Float64Array(N), base6 = new Float64Array(N);
  const cash = new Float64Array(N);
  const byGroup = {};
  let redCnt = 0, itemSum = 0, wSum = 0, spawnSum = 0;
  const rnd = seeded(20261108);
  const spawnFns = room.spawns.map(s => vm.runInContext(`(function(){return simSpawn(${JSON.stringify(s)});})`, ctx));
  for (let i = 0; i < N; i++) {
    let items = [], tv = 0, vg = 0, anyRed = false, tw = 0, cashV = 0, spv = 0;
    const add = r => {
      items.push(r);
      const p = priceOf(r.item) * (r.n || 1);
      const w = (r.item && typeof r.item.w === 'number' ? r.item.w : 0) * (r.n || 1);
      tv += p; tw += w; cashV += sellOf(r.item) * (r.n || 1);
      const g = groupOf(r.item);
      (byGroup[g] = byGroup[g] || { v: 0, c: 0 });
      byGroup[g].v += p; byGroup[g].c++;
      if (r.item && r.item.r >= 5) vg += p;
      if (r.item && r.item.r === RED) anyRed = true;
      return p;
    };
    for (const ch of room.letters) {
      const out = vm.runInContext(`simBox(${JSON.stringify(ch)})`, ctx);
      for (const r of out) add(r);
    }
    /* 刷新点：每局对每个点独立判定一次，未出现就不计入本局。 */
    for (let k = 0; k < spawnFns.length; k++) {
      if (rnd() * 100 >= room.spawns[k].chance) continue;
      const e = spawnFns[k]();
      if (e) spv += add(e);
    }
    spawnSum += spv;
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
    spawnMean: spawnSum / N, spawns: room.spawns.length,
    byGroup,
    sAll, sGold, sB6
  };
  summary.push(row);

  console.log('【' + room.name + '】 ' + row.comp);
  console.log('  总值  均值 ' + M(row.mean) + ' | 中位 ' + M(row.med) + ' | p10 ' + M(row.p10) + ' | p90 ' + M(row.p90));
  console.log('  变现  均值 ' + M(row.cashMean) + '（装备按商人半价回收折算）');
  if (row.spawns) console.log('  刷新点 ' + row.spawns + ' 个 · 期望 ' + M(row.spawnMean) + ' / 局（含出现率判定，已计入上方总值）');
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
