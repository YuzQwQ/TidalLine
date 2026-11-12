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

test('30 种弹药的 id、等级、价格与固定 B/P 一致', () => {
  const expect = {
    ammo_556_1: [1, 60], ammo_556_2: [2, 140], ammo_556_3: [3, 320], ammo_556_4: [4, 800], ammo_556_5: [5, 2000],
    ammo_9mm_1: [1, 35], ammo_9mm_2: [2, 80], ammo_9mm_3: [3, 180], ammo_9mm_4: [4, 450], ammo_9mm_5: [5, 1100],
    ammo_12g_1: [1, 80], ammo_12g_2: [2, 180], ammo_12g_3: [3, 400], ammo_12g_4: [4, 900], ammo_12g_5: [5, 2200]
  };
  for(const [cal,prices] of Object.entries({'762x39':[80,180,420,1000,2500],'45acp':[50,110,250,600,1500],'545x39':[70,160,370,900,2250]}))prices.forEach((price,i)=>expect['ammo_'+cal+'_'+(i+1)]=[i+1,price]);
  const ammo = ITEMS.filter(i => i.cat === 'ammo');
  assert.equal(ammo.length, 30);
  assert.equal(Object.keys(expect).length, 30);
  for (const item of ammo) {
    const [lv, price] = expect[item.id];
    assert.equal(item.level, lv, item.id + ' 等级');
    assert.equal(item.price, price, item.id + ' 价格');
    assert.equal(item.dmgMul, 1, item.id + ' V1 起不再有等级伤害成长');
    const spec = BALLISTICS.flesh(item.caliber, lv);
    assert.equal(item.B, spec.B, item.id + ' 固定肉伤');
    assert.equal(item.P, spec.P, item.id + ' 穿透力');
    assert(item.noLoot && item.noCodex, item.id + ' 不该进掉落/图鉴');
    assert.equal(item.stack, { '12g':20, '556':60, '9mm':90, '762x39':60, '45acp':90, '545x39':60 }[item.caliber]);
  }
  assert.equal(ITEMS.filter(i => i.id === 'ammo').length, 0, '老的通用弹药应该已经去掉');
});

console.log('\n=== B. 固定肉伤 / 穿透力 ===');
test('五档弹药固定 B/P，武器随机伤害与等级系数已取消', () => {
  for (let lv = 1; lv <= 5; lv++) {
    const P = raid('rifle', []);
    P.weapons[0].ammo = 'ammo_556_' + lv;
    Game.bullets = [];
    fixedDamage(20, () => P.tryShoot());     // 把 U.rand 钉成 20，也不该改变子弹伤害
    const spec = BALLISTICS.flesh('556', lv);
    assert.equal(Game.bullets.length, 1, 'Lv' + lv + ' 应该只打出一颗');
    assert.equal(Game.bullets[0].dmg, spec.B, 'Lv' + lv + ' 基础肉伤');
    assert.equal(Game.bullets[0].pen, spec.P, 'Lv' + lv + ' 穿透力随子弹走');
  }
});

test('霰弹六颗弹丸共享同一份兼容 B/P，各自独立', () => {
  const P = raid('shotgun', []);
  P.weapons[0].ammo = 'ammo_12g_4';
  Game.bullets = [];
  fixedDamage(10, () => P.tryShoot());
  const spec = BALLISTICS.flesh('12g', 4);
  assert.equal(Game.bullets.length, 6);
  for (const b of Game.bullets) {
    assert.equal(b.dmg, spec.B);
    assert.equal(b.pen, spec.P);
  }
});

console.log('\n=== C. 遗留比例矩阵（仅历史 API 自检，不参与运行时结算）===');
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

console.log('\n=== D/E/F. 有效防护值、钝伤、磨甲 ===');
const Combat = vm.runInContext('Combat', c);
test('D：A = 10L − 10(1−D/Dmax)，满耐久 / 半耐久 / 失效', () => {
  for (let L = 1; L <= 6; L++) {
    const g = GEAR.make('body', L);
    assert.equal(Combat.effectiveArmor(g), 10 * L, 'Lv' + L + ' 满耐久');
    g.dur = g.max / 2;
    assert.equal(Combat.effectiveArmor(g), 10 * L - 5, 'Lv' + L + ' 半耐久');
    g.dur = 0;
    assert.equal(Combat.effectiveArmor(g), 0, 'Lv' + L + ' 失效');
  }
});

test('E：P≥A 全额 B，P<A 只吃 0.08·B·Kb，不叠加；磨甲与穿透无关', () => {
  const g = GEAR.make('body', 4);            // A=40，陶瓷 Kb .55 Kd 1.35
  const pen = Combat.resolve({ B: 31, P: 40, part: 'body', armor: g });
  const blunt = Combat.resolve({ B: 31, P: 39, part: 'body', armor: g });
  assert(pen.penetrated && near(pen.health, 31));
  assert(blunt.blunt && near(blunt.health, 0.08 * 31 * 0.55));
  assert(pen.durabilityLoss > 0 && blunt.durabilityLoss > 0, '穿透成功一样磨甲');
  const headFar = Combat.resolve({ B: 31, P: 40, part: 'head', armor: g, mul: 0.55 });
  assert.equal(headFar.durabilityLoss, pen.durabilityLoss, '磨甲与部位倍率、距离衰减无关');
  assert(near(headFar.health, 31 * CFG.COMBAT.HEAD_MULT * 0.55), '倍率只作用于生命伤害');
});

test('F：ΔD = min[D, B(0.035+0.009P)·Kd]，本发判定用命中前耐久', () => {
  const B = 40, P = 16, g = GEAR.make('body', 3, 0.4);
  const r = Combat.resolve({ B, P, part: 'body', armor: g });
  assert(r.blunt, '命中前 A≈20.05 > P=16，仍是钝伤');
  assert.equal(r.durabilityLoss, 0.4, '按剩余耐久封顶');
  assert(near(r.health, 0.08 * B * CFG.MATERIALS.aramid.Kb));
  Combat.applyDurability(r);
  assert.equal(g.dur, 0);
  const next = Combat.resolve({ B, P, part: 'body', armor: g });
  assert(next.penetrated && near(next.health, B) && next.durabilityLoss === 0);
});

test('非法数值不会算出负数或 NaN', () => {
  for (const [B, P, part] of [[-5, 33, 'body'], [20, 0, 'body'], [NaN, 33, 'head'], [20, 999, 'body']]) {
    const r = Combat.resolve({ B, P, part, armor: GEAR.make('body', 4, 10) });
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
  assert.equal(P.mag, 4, '弹匣只少 1');
  assert.equal(P.bag.ammoCount('ammo_12g_1'), before, '备弹不该在开火时就被扣');
});

test('六颗弹丸各自结算：第一颗磨空甲，后续全额伤害', () => {
  raid('shotgun', []);
  const e = dummy({ body: { lv: 4, dur: 0.5 }, hp: 500 });   // 陶瓷 Kb .55 / Kd 1.35
  const spec = BALLISTICS.flesh('12g', 4);                      // B=11, P=18
  let total = 0;
  for (let i = 0; i < 6; i++) {
    const hp0 = e.hp;
    shoot(e, spec.B, spec.P, 'body');
    total += hp0 - e.hp;
  }
  const blunt = 0.08 * spec.B * CFG.MATERIALS.ceramic.Kb;
  assert(near(total, blunt + spec.B * 5, 1e-9), '总伤害 ' + total);
  assert.equal(e.body.dur, 0, '护甲这一轮被打穿');
});

test('打空的弹丸不伤人也不磨甲', () => {
  const P = raid('shotgun', []);
  const e = dummy({ body: { lv: 4, dur: 110 }, hp: 500 });
  const dur0 = e.body.dur, hp0 = e.hp;
  const b = new Bullet(e.x + 40, e.y, -Math.PI / 2, 600, 'player', 10, 600, 16);
  b.hitSegment(e.x + 40, e.y, e.x + 40, e.y - 80);    // 明显偏离
  assert.equal(e.hp, hp0, '没打中就不掉血');
  assert.equal(e.body.dur, dur0, '没打中就不掉耐久');
});

console.log('\n=== H. 弹药守恒 ===');
test('换弹优先当前弹种，其他同口径等级补满', () => {
  const P = raid('rifle', [['ammo_556_1', 4], ['ammo_556_3', 30]]);
  P.mag = 0;
  P.weapons[0].ammo = 'ammo_556_1';
  P.tryReload();
  assert(P.reloadT > 0);
  P.reloadT = 0; P.finishReloadIfDone();
  assert.equal(P.mag, 30);
  assert.equal(P.weapon.rounds.slice(0,4).every(id=>id==='ammo_556_1'), true);
  assert.equal(P.weapon.rounds.slice(4).every(id=>id==='ammo_556_3'), true);
  assert.equal(P.bag.ammoCount('ammo_556_1'), 0);
  assert.equal(P.bag.ammoCount('ammo_556_3'), 4);
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
  /* 把背包塞满到只剩 0 格，并且 556_1 那堆已经满到 60，退不进去 */
  P.bag.slots = [{ item: ITEM_BY_ID.ammo_556_1, n: 60 }, { item: ITEM_BY_ID.ammo_556_3, n: 30 }];
  while (P.bag.slots.length < c.bagSlots()) {
    P.bag.slots.push({ item: ITEM_BY_ID['life01'], n: 1 });
  }
  assert.equal(P.loadAmmo('ammo_556_3'), false, '放不下就该拒绝');
  assert.equal(P.mag, 5, '弹匣没被动过');
  assert.equal(P.bag.ammoCount('ammo_556_1'), 60, '一发都没丢');
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

test('敌人护甲与玩家同规则，尸体上留下的是打剩下的耐久', () => {
  const e = dummy({ body: { lv: 2, dur: 60 }, hp: 500 });
  const B = 20, P = 16;                    // A=20，P<A → 钝伤
  const mat = CFG.MATERIALS[e.body.material];
  shoot(e, B, P, 'body');
  assert(near(500 - e.hp, 0.08 * B * mat.Kb, 1e-9), '生命伤害 ' + (500 - e.hp));
  assert(near(e.body.dur, 60 - Math.min(60, B * (0.035 + 0.009 * P) * mat.Kd), 1e-9),
    '耐久 ' + e.body.dur);
});

console.log('\n通过 ' + checks + ' 组弹药/护甲检查');
