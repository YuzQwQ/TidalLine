/* 枪械口径 / 弹药等级 / 护甲穿透 / 耐久 / 霰弹 / 弹药守恒 的验收测试。
   全部跑真实逻辑（同一个 run-test 运行时），只是把随机伤害固定住。
   node tools/test-ballistics.js */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const harness = fs.readFileSync(path.join(root, 'run-test.js'), 'utf8').split('let pass = 0')[0];
const c = new Function('require', '__dirname', harness + '\nreturn ctx;')(require, root);
const { Game, Save, CFG, ITEMS, GEAR, WEAPONS, Bullet, U } = c;
const { AMMO_BY_ID, BALLISTICS, defaultAmmo, ITEM_BY_ID, EQUIP } = vm.runInContext(
  '({AMMO_BY_ID,BALLISTICS,defaultAmmo,ITEM_BY_ID,EQUIP})', c);

Game.init();
let checks = 0;
function test(name, fn) {
  try { fn(); checks++; console.log('OK: ' + name); }
  catch (e) { console.log('FAIL: ' + name + '\n      ' + e.message); process.exitCode = 1; }
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

/* 固定随机伤害，其余照常 */
function fixedDamage(v, fn) {
  const old = U.rand;
  U.rand = () => v;
  try { return fn(); } finally { U.rand = old; }
}

/* 开一局并摆好背包 */
function raid(weaponId, ammo) {
  Game.startRun({ ammo556: 0, ammo9mm: 0, ammo12g: 0, bandage: 0, stone: 0 });
  Game.enemies = [];
  Game.state = 'playing';
  Game.action = null;
  Game.lootOpen = null;
  const P = Game.player;
  P.hp = 100;
  P.bag.slots = [];
  P.weapons = [null, null, null];
  P.weapons[0] = Object.assign({}, WEAPONS[weaponId], { magCur: WEAPONS[weaponId].mag });
  P.slot = 0;
  P.mag = WEAPONS[weaponId].mag;
  P.fireCd = 0;
  P.reloadT = 0;
  P.dodgeT = 0;
  for (const [id, n] of (ammo || [])) P.bag.addAmmo(id, n);
  Game.bullets = [];
  return P;
}
/* 造一个靶子：指定护甲等级与耐久 */
function dummy(opts) {
  const e = new (c.Enemy)('scav', Game.player.x + 60, Game.player.y, 0);
  e.helmet = (opts && opts.helmet) ? GEAR.make('helmet', opts.helmet.lv, opts.helmet.dur) : null;
  e.body = (opts && opts.body) ? GEAR.make('body', opts.body.lv, opts.body.dur) : null;
  e.hp = (opts && opts.hp != null) ? opts.hp : 1000;
  e.maxHp = e.hp;
  e.dead = false;
  Game.enemies.push(e);          // 子弹只认 Game.enemies 里的目标
  return e;
}
/* 从靶子正上方打一条穿过圆心的线：必定命中身体（偏移让开头部内圆） */
function shoot(e, dmg, pen, part) {
  const off = part === 'head' ? 0 : 6;
  const x = e.x + off, y = e.y + 40;
  const b = new Bullet(x, y, -Math.PI / 2, 600, 'player', dmg, 600, pen);
  b.hitSegment(x, y, x, y - 80);
  return b;
}

/* ---------------------------------------------------------------- */
console.log('\n=== A. 枪械口径 ===');
test('四种枪绑定了正确的口径，不是靠名字猜的', () => {
  assert.equal(WEAPONS.rifle.caliber, '556');
  assert.equal(WEAPONS.shotgun.caliber, '12g');
  assert.equal(WEAPONS.smg.caliber, '9mm');
  assert.equal(WEAPONS.pistol.caliber, '9mm');
  for (const w of Object.values(WEAPONS)) {
    assert(AMMO_BY_ID[w.ammo], w.id + ' 的默认弹种不存在');
    assert.equal(AMMO_BY_ID[w.ammo].caliber, w.caliber, w.id + ' 默认弹种口径不一致');
  }
});

test('步枪装不进 9mm / 12g，冲锋枪与手枪共用 9mm', () => {
  const P = raid('rifle', [['ammo_9mm_1', 30], ['ammo_12g_1', 10], ['ammo_556_1', 30]]);
  assert.equal(P.loadAmmo('ammo_9mm_1'), false, '步枪不该吃 9mm');
  assert.equal(P.loadAmmo('ammo_12g_1'), false, '步枪不该吃 12 号');
  assert.equal(P.loadAmmo('ammo_556_3'), true, '同口径能换（换个等级）');

  const Q = raid('smg', [['ammo_9mm_3', 25]]);
  assert.equal(Q.loadAmmo('ammo_9mm_3'), true, '冲锋枪吃 9mm');
  Q.mag = 25;
  const R = raid('pistol', [['ammo_9mm_3', 12]]);
  assert.equal(R.loadAmmo('ammo_9mm_3'), true, '手枪也吃 9mm');
});

test('15 种弹药的 id、等级、价格与需求一致', () => {
  const expect = {
    ammo_556_1: [1, 60], ammo_556_2: [2, 140], ammo_556_3: [3, 320], ammo_556_4: [4, 800], ammo_556_5: [5, 2000],
    ammo_9mm_1: [1, 35], ammo_9mm_2: [2, 80], ammo_9mm_3: [3, 180], ammo_9mm_4: [4, 450], ammo_9mm_5: [5, 1100],
    ammo_12g_1: [1, 80], ammo_12g_2: [2, 180], ammo_12g_3: [3, 400], ammo_12g_4: [4, 900], ammo_12g_5: [5, 2200]
  };
  const ammo = ITEMS.filter(i => i.cat === 'ammo');
  assert.equal(ammo.length, 15);
  assert.equal(Object.keys(expect).length, 15);
  for (const item of ammo) {
    const [lv, price] = expect[item.id];
    assert.equal(item.level, lv, item.id + ' 等级');
    assert.equal(item.price, price, item.id + ' 价格');
    const t = BALLISTICS.tier(lv);
    assert.equal(item.dmgMul, t.dmgMul, item.id + ' 伤害系数应来自统一表');
    assert.equal(item.penLevel, t.pen, item.id + ' 穿透等级应来自统一表');
    assert(item.noLoot && item.noCodex, item.id + ' 不该进掉落/图鉴');
    assert.equal(item.stack, 120);
  }
  assert.equal(ITEMS.filter(i => i.id === 'ammo').length, 0, '老的通用弹药应该已经去掉');
});

console.log('\n=== B. 伤害系数 ===');
test('武器基础伤害 20 × 五档系数 = 18/20/21/22/23', () => {
  const want = [18, 20, 21, 22, 23];
  for (let lv = 1; lv <= 5; lv++) {
    const P = raid('rifle', []);
    P.weapons[0].ammo = 'ammo_556_' + lv;
    Game.bullets = [];
    fixedDamage(20, () => P.tryShoot());
    assert.equal(Game.bullets.length, 1, 'Lv' + lv + ' 应该只打出一颗');
    assert(near(Game.bullets[0].dmg, want[lv - 1], 1e-9),
      'Lv' + lv + ' 期望 ' + want[lv - 1] + '，实际 ' + Game.bullets[0].dmg);
    assert.equal(Game.bullets[0].pen, lv, 'Lv' + lv + ' 穿透等级应随子弹走');
  }
});

test('霰弹单颗弹丸也吃系数，六颗各自独立', () => {
  const P = raid('shotgun', []);
  P.weapons[0].ammo = 'ammo_12g_4';
  Game.bullets = [];
  fixedDamage(10, () => P.tryShoot());
  assert.equal(Game.bullets.length, 6);
  for (const b of Game.bullets) assert(near(b.dmg, 11, 1e-9), '10 × 1.10 = 11');
});

console.log('\n=== C. 穿透矩阵 ===');
test('需求里给出的 8 组对照全部命中', () => {
  const cases = [
    // [弹药等级, 护甲等级, 期望生命伤害]（基础伤害 20，已含弹药系数）
    [1, 1, 16], [1, 6, 3], [2, 4, 8], [3, 3, 16],
    [3, 5, 8], [4, 6, 8], [5, 6, 12], [5, 2, 20]
  ];
  for (const [pen, lv, want] of cases) {
    const r = BALLISTICS.resolve(20, pen, lv, 10000);   // 耐久够，不触发击毁
    assert(near(r.health, want, 1e-9),
      'Lv' + pen + ' 弹打 Lv' + lv + ' 甲：期望 ' + want + '，实际 ' + r.health);
  }
});

test('矩阵本身：行列都是单调的，且同格 100% 时不吃伤害', () => {
  for (let pen = 1; pen <= 5; pen++) {
    assert(near(BALLISTICS.ratio(pen, 0), 1), '没穿甲就是 100%');
    assert(near(BALLISTICS.ratio(pen, pen), 0.8), '同级 80%');
    if (pen > 1) assert(BALLISTICS.ratio(pen, pen - 1) >= 1 - 1e-9, '打低一级甲应完全穿透');
  }
  for (let lv = 1; lv <= 6; lv++) {
    let prev = -1;
    for (let pen = 1; pen <= 5; pen++) {
      const v = BALLISTICS.ratio(pen, lv);
      assert(v >= prev - 1e-9, '穿透越高保留比例不该下降');
      prev = v;
    }
  }
});

console.log('\n=== D/E/F. 耐久、击毁、完全穿透 ===');
test('D：20 伤害 / Lv3 弹 / Lv5 甲 → 8 生命、挡 12、耗 6 耐久', () => {
  const r = BALLISTICS.resolve(20, 3, 5, 150);
  assert(near(r.health, 8), 'health=' + r.health);
  assert(near(r.blocked, 12), 'blocked=' + r.blocked);
  assert(near(r.durabilityLoss, 6), 'durabilityLoss=' + r.durabilityLoss);
});

test('E：耐久只剩 3 时按比例挡，最终 14 伤害、耐久归零', () => {
  const r = BALLISTICS.resolve(20, 3, 5, 3);
  assert(near(r.health, 14), 'health=' + r.health);
  assert(near(r.durabilityLoss, 3), 'durabilityLoss=' + r.durabilityLoss);
});

test('F：完全穿透时护甲不掉耐久', () => {
  const r = BALLISTICS.resolve(20, 5, 2, 60);
  assert(near(r.health, 20));
  assert.equal(r.durabilityLoss, 0);
  const noArmor = BALLISTICS.resolve(20, 1, 0, 0);
  assert(near(noArmor.health, 20) && noArmor.durabilityLoss === 0, '没甲就是满伤害');
});

test('非法数值不会算出负数或 NaN', () => {
  for (const [base, pen, lv, dur] of [[-5, 3, 4, 10], [20, 0, 4, 10], [20, 9, 9, 10], [20, 3, 4, -1], [NaN, 3, 4, 10]]) {
    const r = BALLISTICS.resolve(base, pen, lv, dur);
    assert(Number.isFinite(r.health) && r.health >= 0, 'health=' + r.health);
    assert(Number.isFinite(r.durabilityLoss) && r.durabilityLoss >= 0, 'loss=' + r.durabilityLoss);
  }
});

console.log('\n=== G. 霰弹枪 ===');
test('一次开火 = 1 发弹药 + 6 颗弹丸', () => {
  const P = raid('shotgun', [['ammo_12g_1', 10]]);
  Game.bullets = [];
  const before = P.bag.ammoCount('ammo_12g_1');
  P.tryShoot();
  assert.equal(Game.bullets.length, 6, '六颗');
  assert.equal(P.mag, 5, '弹匣只少 1');
  assert.equal(P.bag.ammoCount('ammo_12g_1'), before, '备弹不该在开火时就被扣');
});

test('六颗弹丸各自结算护甲：打穿之后剩下的吃满伤害', () => {
  const P = raid('shotgun', []);
  const e = dummy({ body: { lv: 4, dur: 3 }, hp: 500 });
  /* Lv1 弹打 Lv4 甲：留 25%，每颗 10 伤害挡 7.5、耗 3.75 耐久
     第 1 颗只挡得住 3/3.75，第 2 颗起护甲已碎，全额进血 */
  let total = 0;
  for (let i = 0; i < 6; i++) {
    const hp0 = e.hp;
    shoot(e, 10, 1, 'body');
    total += hp0 - e.hp;
  }
  const first = 10 - 7.5 * (3 / 3.75);
  assert(near(total, first + 10 * 5, 1e-9), '总伤害 ' + total);
  assert.equal(e.body.dur, 0, '护甲这一轮被打穿');
});

test('打空的弹丸不伤人也不磨甲', () => {
  const P = raid('shotgun', []);
  const e = dummy({ body: { lv: 4, dur: 115 }, hp: 500 });
  const dur0 = e.body.dur, hp0 = e.hp;
  const b = new Bullet(e.x + 40, e.y, -Math.PI / 2, 600, 'player', 10, 600, 1);
  b.hitSegment(e.x + 40, e.y, e.x + 40, e.y - 80);    // 明显偏离
  assert.equal(e.hp, hp0, '没打中就不掉血');
  assert.equal(e.body.dur, dur0, '没打中就不掉耐久');
});

console.log('\n=== H. 弹药守恒 ===');
test('换弹只吃当前弹种，不会顺手拿别的等级顶上', () => {
  const P = raid('rifle', [['ammo_556_1', 4], ['ammo_556_3', 30]]);
  P.mag = 0;
  P.weapons[0].ammo = 'ammo_556_1';
  P.tryReload();
  assert(P.reloadT > 0, '有 4 发 556_1，应该开始换弹');
  P.reloadT = 0; P.finishReloadIfDone();
  assert.equal(P.mag, 4, '只补 4 发');
  assert.equal(P.bag.ammoCount('ammo_556_1'), 0);
  assert.equal(P.bag.ammoCount('ammo_556_3'), 30, '别的等级一发都不许动');

  P.tryReload();
  assert.equal(P.reloadT, 0, 'Lv1 已经空了，不该假装能换弹');
});

test('切换弹种：弹匣里剩余的旧弹原样退回背包，总数不变', () => {
  const P = raid('rifle', [['ammo_556_1', 30], ['ammo_556_3', 30]]);
  P.mag = 5;                       // 手上这把还压着 5 发 Lv1
  P.weapons[0].ammo = 'ammo_556_1';
  const before = P.bag.ammoCount('ammo_556_1');
  assert.equal(P.loadAmmo('ammo_556_3'), true);
  assert.equal(P.mag, 0, '换种后弹匣是空的');
  assert.equal(P.weapons[0].ammo, 'ammo_556_3');
  assert.equal(P.bag.ammoCount('ammo_556_1'), before + 5, '5 发退回背包');
  /* 再换回去也一样 */
  P.loadAmmo('ammo_556_1');
  assert.equal(P.bag.ammoCount('ammo_556_3'), 30);
});

test('背包塞不下退回的弹药时，整个换种操作取消（不吞子弹）', () => {
  const P = raid('rifle', [['ammo_556_1', 30], ['ammo_556_3', 30]]);
  P.mag = 5;
  P.weapons[0].ammo = 'ammo_556_1';
  /* 把背包塞满到只剩 0 格，并且 556_1 那堆已经满到 120，退不进去 */
  P.bag.slots = [{ item: ITEM_BY_ID.ammo_556_1, n: 120 }, { item: ITEM_BY_ID.ammo_556_3, n: 30 }];
  while (P.bag.slots.length < CFG.BAG.SLOTS) {
    P.bag.slots.push({ item: ITEM_BY_ID['life01'], n: 1 });
  }
  assert.equal(P.loadAmmo('ammo_556_3'), false, '放不下就该拒绝');
  assert.equal(P.mag, 5, '弹匣没被动过');
  assert.equal(P.bag.ammoCount('ammo_556_1'), 120, '一发都没丢');
});

test('空弹匣且没有匹配弹药时打不出去', () => {
  const P = raid('rifle', [['ammo_9mm_1', 30]]);
  P.mag = 0;
  Game.bullets = [];
  assert.equal(P.tryShoot(), false);
  assert.equal(Game.bullets.length, 0);
  assert.equal(P.reloadT, 0, '没有 5.56 就不该进入换弹');
});

test('同口径不同等级在背包里是两条，不会并堆', () => {
  const P = raid('rifle', []);
  P.bag.addAmmo('ammo_556_1', 10);
  P.bag.addAmmo('ammo_556_3', 10);
  P.bag.addAmmo('ammo_556_1', 5);
  assert.equal(P.bag.slots.length, 2);
  assert.equal(P.bag.ammoCount('ammo_556_1'), 15);
  assert.equal(P.bag.ammoCount('ammo_556_3'), 10);
});

test('存盘再读回来，各口径各等级的数量一致', () => {
  Save.stash = [];
  Save.addStash('ammo_556_1', 37);
  Save.addStash('ammo_9mm_3', 12);
  Save.addStash('ammo_12g_5', 4);
  Save.save();
  Save.flush();
  Save.stash = [];
  Save.load();
  assert.equal(Save.stashCount('ammo_556_1'), 37);
  assert.equal(Save.stashCount('ammo_9mm_3'), 12);
  assert.equal(Save.stashCount('ammo_12g_5'), 4);
});

test('老存档的通用弹药按 5.56 Lv1 迁移，数量不变', () => {
  Save.stash = [{ id: 'ammo', n: 40 }];
  Save.normalizeStash();
  assert.equal(Save.stashCount('ammo_556_1'), 40, '40 发原样搬过去');
  assert.equal(Save.stashCount('ammo'), 0);
});

console.log('\n=== 其他 ===');
test('武器伪物品带着装填弹种，换枪不会换回默认弹', () => {
  const g = EQUIP.gun('rifle', 12, 'ammo_556_4');
  assert.equal(g.equip.ammo, 'ammo_556_4');
  assert.equal(g.equip.mag, 12);
  /* 口径对不上的弹种会被纠正 */
  const bad = EQUIP.gun('rifle', 12, 'ammo_9mm_1');
  assert.equal(bad.equip.ammo, 'ammo_556_1');
});

test('敌人护甲同样走新结算，尸体上留下的是打剩下的耐久', () => {
  const e = dummy({ body: { lv: 2, dur: 60 }, hp: 500 });
  shoot(e, 20, 1, 'body');            // Lv1 打 Lv2：留 60%
  assert(near(500 - e.hp, 12, 1e-9), '生命伤害 ' + (500 - e.hp));
  assert(near(e.body.dur, 60 - 8 * CFG.AMMO.DURABILITY_FACTOR, 1e-9), '耐久 ' + e.body.dur);
});

console.log('\n通过 ' + checks + ' 组弹药/护甲检查');
