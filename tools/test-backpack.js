/* 背包系统的验收测试：容量梯度 / 更换规则 / 不套娃 / 存档往返 / 商人供货。
   全部跑真实逻辑（复用 run-test 的运行时）。
   node tools/test-backpack.js */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const harness = fs.readFileSync(path.join(root, 'run-test.js'), 'utf8').split('let pass = 0')[0];
const c = new Function('require', '__dirname', harness + '\nreturn ctx;')(require, root);
const { Game, Save, CFG, Base, ITEMS, EQUIP, Player } = c;
const { BAGS, BACKPACK, BASE_BAG_SLOTS, bagSlots, ITEM_BY_ID, Medical } = vm.runInContext(
  '({BAGS,BACKPACK,BASE_BAG_SLOTS,bagSlots,ITEM_BY_ID,Medical})', c);

Game.init();
let checks = 0;
function test(name, fn) {
  try { fn(); checks++; console.log('OK: ' + name); }
  catch (e) { console.log('FAIL: ' + name + '\n      ' + e.message); process.exitCode = 1; }
}
/* 每次从干净的藏身处状态开始 */
function fresh() {
  Game.state = 'base';
  Save.stash = [];
  Save.bag = [];
  Save.gear.back = null;
  Save.credits = 10000000;
}

/* ---------- 1. 数据表与容量梯度 ---------- */
test('五档背包的容量与稀有度单调递增', () => {
  assert.equal(BAGS.length, 5);
  for (let i = 1; i < BAGS.length; i++) {
    assert.ok(BAGS[i].slots > BAGS[i - 1].slots, '容量要递增');
    assert.equal(BAGS[i].r, i + 1, '稀有度按白绿蓝紫金');
  }
  assert.equal(BAGS[0].slots, 8);
  assert.equal(BAGS[4].slots, 24);
  assert.equal(BASE_BAG_SLOTS, 4);
});

test('未装备背包时容量是基础 4 格', () => {
  fresh();
  assert.equal(bagSlots(), 4);
});

test('装备后的容量就是背包容量，不叠加基础格', () => {
  fresh();
  Save.gear.back = BACKPACK.make('bag03');
  assert.equal(bagSlots(), 16, '不是 4 + 16');
  Save.gear.back = BACKPACK.make('bag05');
  assert.equal(bagSlots(), 24);
});

/* ---------- 2. 伪物品与价格 ---------- */
test('EQUIP.bag 生成的伪物品字段齐全', () => {
  const it = EQUIP.bag('bag04');
  assert.equal(it.id, 'g_bag04');
  assert.equal(it.equip.kind, 'bag');
  assert.equal(it.equip.slots, 20);
  assert.equal(it.name, '战术突击背包');
  assert.equal(it.stack, 1);
  assert.equal(it.sell, Math.floor(110000 * 0.5), '回收价是半价');
  assert.ok(it.sell <= it.price);
});

/* ---------- 3. 更换规则 ---------- */
test('从仓库装上一个更大的背包：成功，旧的回仓库', () => {
  fresh();
  Save.gear.back = BACKPACK.make('bag01');           // 8 格
  Save.addGearStash(EQUIP.bag('bag04'));             // 仓库里有个 20 格的
  const entry = Save.stash.find(e => e.gear && e.gear.equip.kind === 'bag');
  assert.ok(Base.equipFromStash(entry, 'back'));
  assert.equal(Save.gear.back.slots, 20);
  const left = Save.stash.filter(e => e.gear && e.gear.equip.kind === 'bag');
  assert.equal(left.length, 1, '换下来的旧包回到仓库');
  assert.equal(left[0].gear.equip.slots, 8);
});

test('身上东西超过新容量时，禁止换更小的背包', () => {
  fresh();
  Save.gear.back = BACKPACK.make('bag04');           // 20 格
  for (let i = 0; i < 10; i++) Save.bag.push({ id: 'life01', n: 1 });
  Save.addGearStash(EQUIP.bag('bag01'));             // 想换成 8 格
  const entry = Save.stash.find(e => e.gear && e.gear.equip.kind === 'bag');
  assert.equal(Base.equipFromStash(entry, 'back'), false, '被拦下，不换');
  assert.equal(Save.gear.back.slots, 20, '槽位保持原样');
  assert.equal(Save.stash.length, 1, '仓库那件没被动');
});

test('东西正好等于新容量时可以换', () => {
  fresh();
  Save.gear.back = BACKPACK.make('bag04');
  for (let i = 0; i < 8; i++) Save.bag.push({ id: 'life01', n: 1 });
  Save.addGearStash(EQUIP.bag('bag01'));             // 8 格，刚好装下
  const entry = Save.stash.find(e => e.gear && e.gear.equip.kind === 'bag');
  Base.equipFromStash(entry, 'back');
  assert.equal(Save.gear.back.slots, 8);
});

/* ---------- 4. 卸下 ---------- */
test('卸下背包：东西不超过 4 件时成功，容量回到基础值', () => {
  fresh();
  Save.gear.back = BACKPACK.make('bag02');
  Save.bag = [{ id: 'life01', n: 1 }, { id: 'life06', n: 1 }];
  Base.unequip('back');
  assert.equal(Save.gear.back, null);
  assert.equal(bagSlots(), 4);
  assert.equal(Save.stash.filter(e => e.gear && e.gear.equip.kind === 'bag').length, 1, '背包进了仓库');
});

test('卸下背包：东西超过 4 件时拒绝', () => {
  fresh();
  Save.gear.back = BACKPACK.make('bag02');
  for (let i = 0; i < 5; i++) Save.bag.push({ id: 'life01', n: 1 });
  Base.unequip('back');
  assert.ok(Save.gear.back, '还在身上');
  assert.equal(Save.gear.back.slots, 12);
});

/* ---------- 5. 不套娃 ---------- */
test('背包不能放进背包格子', () => {
  fresh();
  Save.gear.back = BACKPACK.make('bag05');
  Game.startRun(null, 'linhai-old-quarter');
  const bp = EQUIP.bag('bag01');
  const chk = Game.player.bag.canAdd(bp, 1);
  assert.equal(chk.ok, false);
  assert.match(chk.why, /不能塞进背包/);
  assert.equal(Game.player.bag.add(bp, 1), false);
});

/* ---------- 6. 重量 ---------- */
test('背包重量计入总负重', () => {
  fresh();
  Save.gear.back = BACKPACK.make('bag05');           // 3.8kg
  Game.startRun(null, 'linhai-old-quarter');
  const P = Game.player;
  P.bag.slots = [];
  P.bag.safe = [];
  P.weapons = [null, null, null];
  P.helmet = null; P.body = null;
  assert.ok(Math.abs(P.totalWeight - 3.8) < 1e-6, '实际 ' + P.totalWeight);
});

/* ---------- 7. 存档往返 ---------- */
test('存档往返保留背包槽', () => {
  fresh();
  Save.gear.back = BACKPACK.make('bag04');
  Save.save(); Save.flush();
  Save.gear.back = null;
  Save.load();
  assert.ok(Save.gear.back, '读回来还在');
  assert.equal(Save.gear.back.id, 'bag04');
  assert.equal(Save.gear.back.slots, 20);
});

test('老存档没有背包槽时回落到基础容量', () => {
  fresh();
  Save.gear.back = null;
  assert.equal(bagSlots(), 4);
});

/* ---------- 8. 商人供货 ---------- */
test('护甲商人只卖前三档背包', () => {
  assert.equal(Base.SHOP_BAG_MAX_R, 3);
  fresh();
  for (const d of BAGS) {
    const ok = d.r <= Base.SHOP_BAG_MAX_R;
    Save.stash = [];
    if (ok) {
      assert.equal(Base.buyBag(d.id), true, d.name + ' 应该能买');
    } else {
      assert.equal(Base.buyBag(d.id), false, d.name + ' 不该卖');
    }
  }
});

test('买背包后进仓库、扣钱', () => {
  fresh();
  Save.credits = 20000;
  assert.equal(Base.buyBag('bag02'), true);
  assert.equal(Save.credits, 20000 - 18000);
  assert.equal(Save.stash.filter(e => e.gear && e.gear.equip.kind === 'bag').length, 1);
});

/* ---------- 9. 局内不换装 ---------- */
test('局内携带容量跟着装备走，且不因拾取而变', () => {
  fresh();
  Save.gear.back = BACKPACK.make('bag02');
  Game.startRun(null, 'linhai-old-quarter');
  assert.equal(bagSlots(), 12);
  assert.equal(Game.player.bag.slots.length, 0);
  const before = bagSlots();
  Game.player.bag.add(EQUIP.bag('bag05'), 1);        // 想塞个 24 格的进去
  assert.equal(bagSlots(), before, '塞不进去，容量不变');
});

console.log('\n通过 ' + checks + ' 组背包系统检查');
