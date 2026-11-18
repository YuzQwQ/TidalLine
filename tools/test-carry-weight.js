/* 负重口径专项：容量上限比的是「压在身上的总重」，不是背包内容。
   node tools/test-carry-weight.js

   背景：canAdd / add / addAmmo 曾经只比 bag.weight()，装备的重量完全不算，
   于是背着 15kg 装备还能把 75kg 背包塞满，实际 90kg 在跑 —— 移速早就掉到
   超载档（0.55），系统却还在说「放得下」。这里把四条链都钉住：

     1. Bag.carryWeight() 有 owner 时 = owner.totalWeight
     2. 装备占多少，背包就少装多少（此消彼长，总量恒为 75）
     3. add / addAmmo 与 canAdd 同一口径
     4. Player.totalWeight 把近战也算进去
*/
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.resolve(__dirname, '..');

const ctx = vm.createContext({
  console, Math, performance: { now: () => Date.now() },
  Uint8Array, Float32Array, Int32Array, Set, Map, Array, Object, JSON
});
for (const f of ['config.js', 'data.js', 'common.js', 'attachment-data.js', 'attachments.js', 'core.js', 'save.js', 'entities.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, { filename: f });
}
vm.runInContext(`
  globalThis.Debuff = { fresh(){ return {}; }, onHit(){}, spreadAdd(){ return 0; } };
  globalThis.AmmoQuick = { cancel(){} };
  globalThis.ITEM_CAPACITY = null;
  /* 格子数看的是 Save.gear.back（bagSlots() 的口径），先给一个 30 格包，
     否则会先撞「背包满了」，测不到重量这一关。 */
  Save.gear.back = { id: 'bag5', name: '远征模块包', slots: 30, w: 0 };
`, ctx, { filename: 'stubs' });

const G = vm.runInContext('({ Bag, Player, CFG, ITEMS, WEAPONS, AMMO_BY_ID, weightTier, Save, itemGroup })', ctx);
const { Bag, Player, CFG, ITEMS, AMMO_BY_ID, weightTier, Save } = G;

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name + (extra ? '  ' + extra : '')); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  ' + extra : '')); }
}
const near = (a, b, eps) => Math.abs(a - b) <= (eps == null ? 1e-6 : eps);
const CAP = CFG.BAG.CARRY;

console.log('\n=== 1. carryWeight 的两种口径 ===');
{
  const bare = new Bag();
  bare.slots.push({ item: { w: 2 }, n: 3 });
  ok('无 owner：carryWeight = 背包内容', near(bare.carryWeight(), 6), bare.carryWeight() + 'kg');
  ok('无 owner + extraWeight：把装备自重补上', near((() => {
    const b = new Bag(); b.slots.push({ item: { w: 2 }, n: 3 }); b.extraWeight = 15.4;
    return b.carryWeight();
  })(), 21.4), '21.4kg');
}

console.log('\n=== 2. 装备与背包此消彼长 ===');
{
  /* 一套真实顶配：RM277 3.8 + lv4 头 1.8 + lv4 甲 6 + 远征包 3.8 = 15.4 */
  const W = vm.runInContext('WEAPONS', ctx);
  const helmet = vm.runInContext('HELMETS.find(h=>h.lv===4)', ctx);
  const body = vm.runInContext('BODIES.find(b=>b.lv===4)', ctx);
  const back = vm.runInContext('BAGS[BAGS.length-1]', ctx);
  const player = new Player(0, 0);
  player.fillWeapons([{ equip: { kind: 'gun', gun: 'rm277', mag: 30 } }]);
  player.helmet = { w: helmet.w };
  player.body = { w: body.w };
  player.back = { w: back.w, slots: back.slots };
  const gearW = W.rm277.w + helmet.w + body.w + back.w;

  ok('装备自重按真实模板算', near(gearW, 15.4, 0.01), gearW.toFixed(1) + 'kg');
  ok('player.totalWeight 空包时等于装备自重', near(player.totalWeight, gearW, 0.01),
    player.totalWeight.toFixed(1) + 'kg');
  ok('bag.carryWeight 跟着 player 走', near(player.bag.carryWeight(), player.totalWeight, 0.01));

  /* 用 2kg 一件的物品把包装到装不下，看停在多少 */
  const item = { id: 'probe', name: '探针', w: 2, cat: 'life', r: 1 };
  let added = 0;
  while (added < 40 && player.bag.add(item, 1)) added++;

  const bagW = player.bag.weight();
  const total = player.totalWeight;
  ok('背包停在「总重不超上限」的位置', total <= CAP + 1e-6, '总重 ' + total.toFixed(1) + ' / ' + CAP);
  ok('再加一件会被拒', !player.bag.canAdd(item, 1).ok);
  ok('拒绝理由是「太重了」', player.bag.canAdd(item, 1).why === '太重了');
  ok('背包内容不超过「上限 − 装备自重」', bagW <= CAP - gearW + 1e-6,
    '背包 ' + bagW.toFixed(1) + 'kg ≤ ' + (CAP - gearW).toFixed(1) + 'kg');
  ok('再加一件就超上限', total + item.w > CAP,
    (total + item.w).toFixed(1) + ' > ' + CAP);
  ok('不再是「背包自己占满 75」的旧行为', bagW < CAP - 10, bagW.toFixed(1) + 'kg');

  const t = player.bag.tier();
  ok('档位按总重判（不是按背包内容）', t.name === weightTier(total).name,
    t.name + ' @ ' + total.toFixed(1) + 'kg');
}

console.log('\n=== 3. 边界：恰好到上限放行，多 0.1 拒绝 ===');
{
  vm.runInContext("Save.gear.back = { id:'bag5', slots:100, w:0 };", ctx);
  const player = new Player(0, 0);
  player.back = { w: 0, slots: 100 };
  const heavy = { id: 'probe', name: '探针', w: 1, cat: 'life', r: 1 };
  while (player.bag.add(heavy, 1)) { /* 装到 75kg */ }
  ok('装满后总重卡在上限', near(player.totalWeight, CAP, 0.01), player.totalWeight + 'kg');
  const one = player.bag.removeAt(player.bag.slots.length - 1);
  ok('回收后总重 74kg', near(player.totalWeight, 74, 0.01), player.totalWeight + 'kg');
  const exact = { id: 'probe2', name: '整一公斤', w: 1, cat: 'life', r: 1 };
  ok('74 + 1 = 75：刚好等于上限时放行', player.bag.canAdd(exact, 1).ok, player.totalWeight + 'kg');
  const over = { id: 'probe3', name: '超一点点', w: 1.1, cat: 'life', r: 1 };
  ok('74 + 1.1 = 75.1：超出则拒绝', !player.bag.canAdd(over, 1).ok);
}

console.log('\n=== 4. addAmmo 也要过重量关 ===');
{
  vm.runInContext("Save.gear.back = { id:'bag5', slots:100, w:0 };", ctx);
  const player = new Player(0, 0);
  player.back = { w: 0, slots: 100 };
  const ammo = Object.values(AMMO_BY_ID)[0];
  ok('有弹药定义可选', !!ammo, ammo && ammo.id + ' w=' + ammo.w);
  const bulk = ITEMS.find(i => !i.equip && i.w >= 5 && i.cat !== 'collect');
  while (player.bag.add(bulk, 1)) { /* 塞重物到上限 */ }
  /* 退掉一件，留出 5kg 左右的余量 */
  player.bag.removeAt(player.bag.slots.length - 1);
  const room = CAP - player.totalWeight;
  const rounds = Math.floor(room / ammo.w) + 300;
  ok('余量不足以容纳的弹量会被拒', !player.bag.addAmmo(ammo.id, rounds),
    '余量 ' + room.toFixed(1) + 'kg，想塞 ' + rounds + ' 发');
  const fits = Math.max(1, Math.floor(room / ammo.w) - 1);
  ok('余量放得下的弹量能进', player.bag.addAmmo(ammo.id, fits), fits + ' 发');
}

console.log('\n=== 5. totalWeight 把近战也算进去 ===');
{
  const player = new Player(0, 0);
  const before = player.totalWeight;
  player.melee = { id: 'melee_test', name: '测试近战', w: 1.6 };
  ok('装备近战后总重增加', near(player.totalWeight, before + 1.6, 1e-6),
    before.toFixed(1) + ' → ' + player.totalWeight.toFixed(1) + 'kg');
  player.melee = null;
  ok('卸下近战后回到原值', near(player.totalWeight, before, 1e-6));
  player.melee = { id: 'x' };
  ok('近战缺 w 字段不会算出 NaN', Number.isFinite(player.totalWeight), player.totalWeight);
}

console.log('\n=== 6. 局外口径对齐（Attachments.carriedWeight） ===');
{
  /* 装备栏存的是 EQUIP.gun 伪物品（带 w），不是裸 {equip}，两边都要用真实结构 */
  vm.runInContext(`
    Save.bag = [{ id: 'life01', n: 2 }];
    Save.safe = [];
    Save.gear.weapons = [EQUIP.gun('rm277', 30)];
    Save.gear.helmet = { type: 'helmet', w: 1.8 };
    Save.gear.body = { type: 'body', w: 6 };
    Save.gear.back = { id: 'bag5', slots: 30, w: 3.8 };
    Save.gear.melee = null;
  `, ctx);
  const Attachments = vm.runInContext('Attachments', ctx);
  const carried = Attachments.carriedWeight();

  const player = new Player(0, 0);
  player.fillWeapons(vm.runInContext('Save.gear.weapons', ctx));
  player.helmet = vm.runInContext('Save.gear.helmet', ctx);
  player.body = vm.runInContext('Save.gear.body', ctx);
  player.back = vm.runInContext('Save.gear.back', ctx);
  /* 把局外背包原样倒进来，两边才可比 */
  player.bag.slots.push({ item: vm.runInContext("ITEM_BY_ID['life01']", ctx), n: 2 });

  ok('局外 carriedWeight 与局内 totalWeight 同口径', near(carried, player.totalWeight, 1e-6),
    carried.toFixed(1) + ' vs ' + player.totalWeight.toFixed(1));
  ok('两边都含装备：枪 3.8 + 头 1.8 + 甲 6 + 包 3.8', near(carried - 0.8, 15.4, 0.01),
    '扣掉背包内容 0.8kg 后 ' + (carried - 0.8).toFixed(1) + 'kg');
}

console.log('\n---------------------------------------');
console.log('  通过 ' + pass + ' / 失败 ' + fail);
console.log('---------------------------------------');
process.exit(fail ? 1 : 0);
