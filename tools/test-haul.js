/* 转运区专项：等级 → 负重上限 / 档位 / 满载惩罚，以及升级的费用与材料扣除。
   node tools/test-haul.js

   数值设计的来由：
   - 34 格（远征包 + 安全箱）装满约 66kg，所以负重上限超过 66 就没有实际意义。
     0 级定 45 才能真的卡住，75 落在 3 级(68) 与 4 级(78) 之间，是「中等偏上」。
   - 明面上限只加 45→78（+73%），真正拉开差距的是满载惩罚：
     移速 0.75→0.88、噪声 1.50→1.00。满级「背满也能潜行」才是它的价值。
*/
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.resolve(__dirname, '..');

/* localStorage 最小实现：Save.load/flush 都要用 */
const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};

const ctx = vm.createContext({
  console, Math, performance: { now: () => Date.now() },
  Uint8Array, Float32Array, Int32Array, Set, Map, Array, Object, JSON,
  localStorage, setTimeout, clearTimeout
});
for (const f of ['config.js', 'data.js', 'common.js', 'attachment-data.js', 'attachments.js', 'core.js', 'save.js', 'entities.js', 'haul.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, { filename: f });
}
vm.runInContext(`
  globalThis.Debuff = { fresh(){ return {}; }, onHit(){}, spreadAdd(){ return 0; } };
  globalThis.AmmoQuick = { cancel(){} };
  Save.gear.back = { id:'bag5', slots:30, w:3.8 };
  globalThis.Game = { sfx(){} };
`, ctx, { filename: 'stubs' });

const G = vm.runInContext('({ CFG, Save, Haul, Player, carryLimit, carryTiers, haulLevel, weightTier, ITEM_BY_ID })', ctx);
const { CFG, Save, Haul, carryLimit, carryTiers, weightTier, ITEM_BY_ID } = G;

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name + (extra ? '  ' + extra : '')); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  ' + extra : '')); }
}
const near = (a, b, e) => Math.abs(a - b) <= (e == null ? 1e-6 : e);

console.log('\n=== 1. 等级表本身 ===');
{
  const H = CFG.BAG.HAUL;
  ok('五档：0 徒手 → 4 电动绞盘', H.NAME.length === 5 && H.CAP.length === 5, H.NAME.join(' / '));
  ok('0 级 45kg（不再是 75）', H.CAP[0] === 45, H.CAP[0] + 'kg');
  ok('满级 78kg', H.CAP[4] === 78, H.CAP[4] + 'kg');
  ok('75kg 落在 3 级与 4 级之间（中等偏上）', H.CAP[3] < 75 && H.CAP[4] > 75,
    H.CAP[3] + ' < 75 < ' + H.CAP[4]);
  ok('上限逐级递增', H.CAP.every((v, i) => i === 0 || v > H.CAP[i - 1]));
  ok('满载移速逐级递增', H.MOVE.every((v, i) => i === 0 || v >= H.MOVE[i - 1]), H.MOVE.join(' → '));
  ok('满载噪声逐级递减，满级归 1.00', H.NOISE[4] === 1.00 && H.NOISE.every((v, i) => i === 0 || v <= H.NOISE[i - 1]),
    H.NOISE.join(' → '));
  ok('成本逐级递增', H.COST.every((v, i) => i === 0 || v > H.COST[i - 1]));
  ok('0 级不要材料', Object.keys(H.MATS[0]).length === 0);
  ok('材料都是存在的物品', H.MATS.slice(1).every(m => Object.keys(m).every(id => !!ITEM_BY_ID[id])),
    Object.keys(H.MATS[4]).join(','));
}

console.log('\n=== 2. 等级 → 上限 / 档位 ===');
{
  Save.facilities = { haul: 0 };
  ok('0 级上限 45', carryLimit() === 45);
  let t = carryTiers();
  ok('0 级重载门槛 = 45', t[2][0] === 45);
  ok('0 级满载移速 ×0.75 / 噪声 ×1.50', t[2][1] === 0.75 && t[2][2] === 1.50);
  ok('轻装 / 中载 门槛按比例缩放', near(t[0][0], 45 * 0.34, 1e-6) && near(t[1][0], 45 * 0.67, 1e-6),
    t[0][0].toFixed(1) + ' / ' + t[1][0].toFixed(1));

  Save.facilities = { haul: 4 };
  ok('4 级上限 78', carryLimit() === 78);
  t = carryTiers();
  ok('4 级重载门槛 = 78', t[2][0] === 78);
  ok('4 级满载移速 ×0.88 / 噪声 ×1.00', t[2][1] === 0.88 && t[2][2] === 1.00);
  ok('4 级轻装门槛跟着放大', near(t[0][0], 78 * 0.34, 1e-6), t[0][0].toFixed(1));

  /* weightTier 必须读动态表，而不是静态 CFG.BAG.TIERS */
  Save.facilities = { haul: 0 };
  ok('50kg 在 0 级是超载', weightTier(50).name === '超载', weightTier(50).name);
  Save.facilities = { haul: 4 };
  ok('50kg 在 4 级是中载', weightTier(50).name === '中载', weightTier(50).name);
  ok('78kg 在 4 级是重载', weightTier(78).name === '重载', weightTier(78).name);
  ok('79kg 在 4 级是超载', weightTier(79).name === '超载', weightTier(79).name);
}

console.log('\n=== 3. 玩家满载时的实际手感 ===');
{
  /* 这一组测的是「重量上限」本身，所以把格子放到 100 格，
     避免先撞背包格数（真实 30 格装满约 44kg，与 0 级 45kg 恰好在同一量级）。 */
  vm.runInContext("Save.gear.back = { id:'bag5', slots:100, w:3.8 };", ctx);
  const player = G.Player ? new G.Player(0, 0) : vm.runInContext('new Player(0,0)', ctx);
  Save.facilities = { haul: 0 };
  player.back = { id: 'bag5', slots: 100, w: 3.8 };
  player.helmet = { w: 1.8 }; player.body = { w: 6 };
  player.fillWeapons([vm.runInContext("EQUIP.gun('rm277',30)", ctx)]);
  const gearW = player.totalWeight;
  const item = { id: 'probe', name: '探针', w: 1, cat: 'life', r: 1 };
  while (player.bag.add(item, 1)) { /* 装到 45 */ }
  ok('0 级装到装不下为止，且不超 45', !player.bag.canAdd(item, 1).ok && player.totalWeight <= 45,
    player.totalWeight.toFixed(1) + 'kg');
  ok('0 级停在 45 附近（差不到一件）', 45 - player.totalWeight < item.w, player.totalWeight.toFixed(1) + 'kg');
  ok('0 级满载进入重载档', player.tier.name === '重载', player.tier.name);
  const slowMove = player.tier.move, loudNoise = player.tier.noise;

  Save.facilities = { haul: 4 };
  while (player.bag.add(item, 1)) { /* 继续装到 78 */ }
  ok('4 级能装到 78kg 附近', !player.bag.canAdd(item, 1).ok && 78 - player.totalWeight < item.w,
    player.totalWeight.toFixed(1) + 'kg');
  ok('同样满载，移速从 ×0.75 提到 ×0.88', player.tier.move === 0.88,
    '×' + slowMove + ' → ×' + player.tier.move + '（' + player.tier.name + '）');
  ok('同样满载，噪声从 ×1.50 降到 ×1.00', player.tier.noise < loudNoise,
    '×' + loudNoise + ' → ×' + player.tier.noise);
  ok('装备自重被算进上限里', gearW > 10, '装备 ' + gearW.toFixed(1) + 'kg');
}

console.log('\n=== 4. 升级：材料与费用 ===');
{
  Save.facilities = { haul: 0 };
  Save.credits = 100000000;
  Save.stash = [];
  const q = Haul.quote();
  ok('0 级报价是 1 级', q && q.level === 1, q && q.name);
  let r = Haul.check();
  ok('仓库空时材料不足', !r.ok && /材料不足/.test(r.why), r.why);

  for (const [id, need] of Object.entries(q.mats)) Save.stash.push({ id, n: need });
  r = Haul.check();
  ok('材料齐了就能升', r.ok, r.why);
  const before = Save.credits;
  const up = Haul.upgrade();
  ok('升级成功', up.ok && up.level === 1, up.name);
  ok('扣了对应信用点', Save.credits === before - q.cost, (before - Save.credits).toLocaleString());
  ok('材料被扣光', Save.stash.filter(e => e.id in q.mats).length === 0, '剩 ' + Save.stash.length + ' 条');
  ok('上限立刻变成 52', carryLimit() === 52, carryLimit() + 'kg');

  /* 钱不够 */
  Save.facilities = { haul: 1 };
  Save.credits = 1000;
  const q2 = Haul.quote();
  for (const [id, need] of Object.entries(q2.mats)) Save.stash.push({ id, n: need });
  ok('钱不够时拒绝', !Haul.check().ok && /信用点不足/.test(Haul.check().why));
  ok('拒绝时不扣材料', Save.stash.length > 0);

  /* 材料部分不足：一件都不该扣 */
  Save.facilities = { haul: 1 };
  Save.credits = 100000000;
  Save.stash = [];
  const q3 = Haul.quote();
  const first = Object.keys(q3.mats)[0];
  Save.stash.push({ id: first, n: q3.mats[first] });
  for (const id of Object.keys(q3.mats).slice(1)) Save.stash.push({ id, n: q3.mats[id] - 1 });
  const keep = Save.stash.map(e => e.n);
  ok('少一件就不允许升级', !Haul.check().ok);
  ok('未升级时仓库原样不动', Save.stash.map(e => e.n).join() === keep.join());

  /* 满级 */
  Save.facilities = { haul: 4 };
  ok('满级时 quote 为 null', Haul.quote() === null);
  ok('满级时 check 拒绝', !Haul.check().ok && /最高等级/.test(Haul.check().why));
  ok('满级时 upgrade 不改变等级', !Haul.upgrade().ok && Save.facilities.haul === 4);
}

console.log('\n=== 5. 存档读写与越界保护 ===');
{
  Save.facilities = { haul: 3 };
  Save.flush();
  ok('设施等级被写进存档', JSON.parse(store[Save.key]).facilities.haul === 3);

  /* 手改存档成越界值 */
  const raw = JSON.parse(store[Save.key]);
  raw.facilities = { haul: 99 };
  store[Save.key] = JSON.stringify(raw);
  Save.load();
  ok('越界等级被夹到满级', Save.facilities.haul === 4, 'haul=' + Save.facilities.haul);

  const raw2 = JSON.parse(store[Save.key]);
  raw2.facilities = { haul: -5 };
  store[Save.key] = JSON.stringify(raw2);
  Save.load();
  ok('负数等级被夹到 0', Save.facilities.haul === 0, 'haul=' + Save.facilities.haul);

  /* 老存档根本没有这个字段 */
  delete raw2.facilities;
  store[Save.key] = JSON.stringify(raw2);
  Save.load();
  ok('老存档缺字段时按 0 级', Save.facilities && Save.facilities.haul === 0);
  ok('老存档 0 级 = 45kg，不再是 75', carryLimit() === 45);
}

console.log('\n---------------------------------------');
console.log('  通过 ' + pass + ' / 失败 ' + fail);
console.log('---------------------------------------');
process.exit(fail ? 1 : 0);
