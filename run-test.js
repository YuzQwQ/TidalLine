/* 运行时测试：mock 掉浏览器环境，跑完整的局内逻辑 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const dir = __dirname;

/* ---------- DOM / Canvas mock ---------- */
const ctxCalls = {};
const ctxMock = new Proxy({}, {
  get(t, k) {
    if (k === 'measureText') return () => ({ width: 12 });
    if (k === 'canvas') return canvasEl;
    if (k in t) return t[k];
    if (k === 'globalAlpha' || k === 'lineWidth' || k === 'font') return t[k];
    return function () { ctxCalls[k] = (ctxCalls[k] || 0) + 1; };
  },
  set(t, k, v) { t[k] = v; return true; }
});

const els = {};
function makeEl(id) {
  return {
    id,
    style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    innerHTML: '', textContent: '', title: '',
    appendChild() {},
    querySelector() { return { style: {}, dataset: {} }; },
    querySelectorAll() { return []; },
    dataset: {},
    addEventListener() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 720, height: 480 }; },
    onclick: null,
    width: 720, height: 480,
    getContext() { return ctxMock; }
  };
}
const canvasEl = makeEl('game');

const documentMock = {
  getElementById(id) {
    if (!els[id]) els[id] = (id === 'game') ? canvasEl : makeEl(id);
    return els[id];
  },
  createElement() { return makeEl('tmp'); },
  addEventListener() {}
};

const store = {};
const localStorageMock = {
  getItem(k) { return k in store ? store[k] : null; },
  setItem(k, v) { store[k] = String(v); },
  removeItem(k) { delete store[k]; }
};

let rafQueue = [];
const ctx = {
  console,
  Math, Date, JSON, Object, Array, Set, Map,
  Uint8Array, Float32Array, Int32Array,
  performance: { now: () => Date.now() },
  document: documentMock,
  localStorage: localStorageMock,
  requestAnimationFrame: (cb) => { rafQueue.push(cb); return rafQueue.length; },
  setTimeout: (fn, ms) => { return 0; },
  setInterval: (fn, ms) => { return 0; },
  clearInterval: () => {},
  clearTimeout: () => {},
  window: {
    addEventListener() {},
    innerWidth: 1920,
    innerHeight: 1080,
    AudioContext: undefined,
    webkitAudioContext: undefined
  }
};
ctx.globalThis = ctx;
vm.createContext(ctx);

for (const f of ['config.js', 'data.js', 'core.js', 'entities.js', 'game.js']) {
  try {
    vm.runInContext(fs.readFileSync(path.join(dir, 'js', f), 'utf8'), ctx, { filename: f });
  } catch (e) {
    console.log('  加载失败 ' + f + ': ' + e.message);
    process.exit(1);
  }
}

vm.runInContext(`
  globalThis.CFG = CFG; globalThis.M = M; globalThis.U = U;
  globalThis.ITEMS = ITEMS; globalThis.Game = Game; globalThis.Save = Save;
  globalThis.Player = Player; globalThis.Enemy = Enemy; globalThis.Noise = Noise;
  globalThis.Quiet = Quiet; globalThis.SFX = SFX;
  globalThis.Base = Base; globalThis.SUPPLY = SUPPLY; globalThis.Art = Art; globalThis.ART = ART;
  globalThis.Corpse = Corpse; globalThis.Bullet = Bullet;
  globalThis.GEAR = GEAR; globalThis.WEAPONS = WEAPONS; globalThis.EQUIP = EQUIP; globalThis.HELMETS = HELMETS; globalThis.BODIES = BODIES;
  globalThis.START_CREDITS = START_CREDITS;
`, ctx, { filename: 'export' });

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name + (extra ? '  ' + extra : '')); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  ' + extra : '')); }
}
function noThrow(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '  →  ' + e.message + '\n       ' + (e.stack || '').split('\n')[1]); }
}

const { Game, M, CFG, U, Save, ITEMS, Noise, Quiet, Base, SUPPLY, Art, ART, GEAR, WEAPONS, HELMETS, BODIES, EQUIP } = ctx;

console.log('\n=== 启动 ===');
noThrow('Save.load()', () => Save.load());
noThrow('Game.init()', () => Game.init());
ok('画布拿到 2d 上下文', Game.ctx === ctxMock);
noThrow('Game.startRun()', () => Game.startRun());
ok('玩家已创建', !!Game.player);
ok('敌人数量', Game.enemies.length === vm.runInContext('SPAWNS.length', ctx), Game.enemies.length + ' 个');
ok('容器数量', Game.boxes.length === vm.runInContext('MAP_ROWS.join(\'\').split(\'\').filter(ch => BOX_KIND[ch]).length', ctx), Game.boxes.length + ' 个');
ok('巡逻半径来自出生配置', Game.enemies.every((enemy, i) => enemy.patrolRadius === vm.runInContext('SPAWNS', ctx)[i].patrolRadius));

const boxTile = Game.boxes[0];
ok('容器挡住走路', M.walkable(boxTile.tx, boxTile.ty) === false);
ok('容器不挡视野', M.opaque(boxTile.tx, boxTile.ty) === false);
ok('未配置巡逻半径时保持默认值', new ctx.Enemy('guard', M.cx(1), M.cy(1)).patrolRadius === 4);
ok('状态为 playing', Game.state === 'playing');

console.log('\n=== 移动 ===');
const P = Game.player;
const x0 = P.x, y0 = P.y;
Game.input.keys.d = true;
for (let i = 0; i < 40; i++) Game.update(1 / 60);
Game.input.keys.d = false;
ok('按 D 向右移动', P.x > x0 + 20, 'Δx=' + (P.x - x0).toFixed(1));

// 撞墙测试：往地图角落冲
P.x = CFG.TILE * 1.5; P.y = CFG.TILE * 1.5;
Game.input.keys.a = true; Game.input.keys.w = true;
for (let i = 0; i < 120; i++) Game.update(1 / 60);
Game.input.keys.a = false; Game.input.keys.w = false;
ok('撞墙不会穿出去', P.x > CFG.TILE * 0.9 && P.y > CFG.TILE * 0.9,
   'pos=' + P.x.toFixed(0) + ',' + P.y.toFixed(0));

console.log('\n=== 射击 ===');
Game.startRun();
Game.enemies.length = 0;      // 不让乱跑的敌人挡在弹道上，否则这条断言会随机失败
const P2 = Game.player;
P2.x = M.cx(16); P2.y = M.cy(19);
Game.input.aimAngle = 0;
Game.bullets.length = 0;
const fired = P2.tryShoot();
ok('开枪成功', fired === true);
ok('生成子弹', Game.bullets.length === 1, Game.bullets.length + ' 颗');
ok('弹药消耗', P2.mag === CFG.WEAPON.mag - 1, 'mag=' + P2.mag);
ok('发出噪声', Noise.events.length > 0, Noise.events.length + ' 个事件');
for (let i = 0; i < 60; i++) Game.update(1 / 60);
ok('子弹会消失（撞墙/超距）', Game.bullets.length === 0);

console.log('\n=== 后坐力 ===');
Game.startRun({ ammo: 60, bandage: 0, stone: 0 });
Game.enemies.length = 0;
const PR = Game.player;
PR.recoil = 0; PR.sinceShot = 99; PR.syncSpread();
Game.shakeAmt = 0;
PR.mag = 30; PR.fireCd = 0;

const r0 = PR.recoil, s0 = PR.spread;
PR.tryShoot();
ok('开火增加后坐力', PR.recoil > r0, r0.toFixed(3) + ' → ' + PR.recoil.toFixed(3));
ok('开火不再抖动屏幕', Game.shakeAmt === 0, 'shake=' + Game.shakeAmt.toFixed(2));
ok('准星产生抖动偏移', Math.abs(PR.crossKick.x) + Math.abs(PR.crossKick.y) > 0.5,
   'kick=' + PR.crossKick.x.toFixed(1) + ',' + PR.crossKick.y.toFixed(1));
ok('散布随后坐力放大', PR.spread > s0, s0.toFixed(3) + ' → ' + PR.spread.toFixed(3));

// 连射打满
for (let i = 0; i < 40; i++) { PR.fireCd = 0; PR.mag = 30; PR.tryShoot(); }
ok('后坐力有上限', PR.recoil <= CFG.RECOIL.max + 1e-9, PR.recoil.toFixed(3));
ok('满后坐力时散布到顶', Math.abs(PR.spread - CFG.RECOIL.spreadMax) < 1e-6, PR.spread.toFixed(3));

// 静止恢复
const rHigh = PR.recoil;
PR.moving = false; PR.sneaking = false; PR.sprinting = false;
for (let i = 0; i < 90; i++) Game.update(1 / 60);
ok('静止后后坐力衰减', PR.recoil < rHigh - 0.3,
   rHigh.toFixed(2) + ' → ' + PR.recoil.toFixed(2));

// 移动时单发增量更大
Game.startRun({ ammo: 60, bandage: 0, stone: 0 });
Game.enemies.length = 0;
const PA = Game.player;
PA.recoil = 0; PA.moving = false; PA.sneaking = false; PA.sprinting = false;
PA.fireCd = 0; PA.mag = 30; PA.tryShoot();
const gainStill = PA.recoil;

Game.startRun({ ammo: 60, bandage: 0, stone: 0 });
Game.enemies.length = 0;
const PB = Game.player;
PB.recoil = 0; PB.moving = true; PB.sneaking = false; PB.sprinting = false;
PB.fireCd = 0; PB.mag = 30; PB.tryShoot();
const gainMove = PB.recoil;
ok('移动时后坐力增长更快', gainMove > gainStill,
   '站立 ' + gainStill.toFixed(3) + ' / 移动 ' + gainMove.toFixed(3));

// 移动时恢复更慢（直接驱动 player.update，绕开全局循环）
Game.startRun({ ammo: 60, bandage: 0, stone: 0 });
Game.enemies.length = 0;
Game.bullets.length = 0;
const PC = Game.player;
const inpStill = { mx: 0, my: 0, sneak: false, sprint: false, dodge: false, aimAngle: 0 };
const inpWalk = { mx: 1, my: 0, sneak: false, sprint: false, dodge: false, aimAngle: 0 };

PC.recoil = 1; PC.sinceShot = 99; PC.syncSpread();
for (let i = 0; i < 30; i++) PC.update(1 / 60, inpStill);
const stillRec = PC.recoil;

PC.recoil = 1; PC.sinceShot = 99; PC.syncSpread();
for (let i = 0; i < 30; i++) PC.update(1 / 60, inpWalk);
const moveRec = PC.recoil;
ok('移动时恢复更慢', moveRec > stillRec,
   '静止剩 ' + stillRec.toFixed(3) + ' / 移动剩 ' + moveRec.toFixed(3));

// 命中测试：把敌人放到正前方（先清场，避免子弹打到路过的其他敌人）
Game.startRun();
const P3 = Game.player;
P3.x = M.cx(8); P3.y = M.cy(8);
Game.enemies.forEach((e, i) => { if (i > 0) e.dead = true; });
const dummy = Game.enemies[0];
dummy.x = P3.x + 120; dummy.y = P3.y;
dummy.hp = 999; dummy.maxHp = 999;
dummy.state = 'patrol'; dummy.path = null; dummy.homeX = dummy.x; dummy.homeY = dummy.y;
const hpBefore = dummy.hp;
P3.angle = 0;
Game.bullets.length = 0;
P3.mag = 30;
P3.recoil = 0; P3.syncSpread();
P3.tryShoot();
for (let i = 0; i < 20; i++) Game.update(1 / 60);
ok('子弹命中敌人', dummy.hp < hpBefore, 'hp ' + hpBefore + ' → ' + dummy.hp.toFixed(1));

console.log('\n=== 换弹 ===');
Game.startRun();
const P4 = Game.player;
P4.mag = 3;
const reserve0 = P4.bag.hasAmmo();
P4.tryReload();
ok('进入换弹', P4.reloadT > 0);
for (let i = 0; i < 120; i++) Game.update(1 / 60);
ok('换弹完成补满', P4.mag === CFG.WEAPON.mag, 'mag=' + P4.mag);
ok('储备弹药减少', P4.bag.hasAmmo() < reserve0,
   reserve0 + ' → ' + P4.bag.hasAmmo());

console.log('\n=== 搜刮 ===');
Game.startRun();
const P5 = Game.player;
// 找一个快取容器，把玩家挪到旁边
const fastBox = Game.boxes.find(b => b.kind === 'fast');
P5.x = fastBox.x; P5.y = fastBox.y + CFG.TILE / 2 + P5.r + 1;
Game.input.interactPressed = true;
Game.update(1 / 60);
// 快取容器是 0 秒读条，同一帧就会打开面板 —— 检查最终结果
ok('搜刮面板已打开', !!Game.lootOpen);
ok('容器已标记', fastBox.opened === true);

// 拿一件
const before = P5.bag.slots.length;
Game.renderLootList();     // 确保渲染不报错
if (Game.lootOpen && Game.lootOpen.items.length) {
  const entry = Game.lootOpen.items[0];
  const res = P5.bag.canAdd(entry.item, entry.n);
  if (res.ok) P5.bag.add(entry.item, entry.n);
  ok('可以拿取物品', P5.bag.slots.length >= before, '背包 ' + P5.bag.slots.length + ' 格');
}
Game.closeLoot();

console.log('\n=== 装备拾取 ===');
Game.startRun();
const PG = Game.player;
PG.helmet = null;
PG.body = null;
PG.weapons = [Object.assign({}, WEAPONS.rifle, { magCur: 30 }), null,
              Object.assign({}, WEAPONS.pistol, { magCur: 12 })];
PG.slot = 0;
PG.mag = 30;
PG.bag.slots.length = 0;

// 造一具带齐三件的尸体：三个槽位都空，应该全部直接穿上
const corpseA = {
  items: [
    { gear: GEAR.make('helmet', 1) },
    { gear: GEAR.make('body', 3) },
    { gun: 'smg' }
  ]
};
Game.openLoot(corpseA, true);
ok('尸体面板能打开', Game.lootOpen === corpseA);

Game.takeGear(corpseA.items[0], 0);
ok('空头盔位直接穿上', PG.helmet && PG.helmet.lv === 1);
ok('尸体上的头盔已拿走', corpseA.items[0] === null);

Game.takeGear(corpseA.items[1], 1);
ok('空护甲位直接穿上', PG.body && PG.body.lv === 3);

Game.takeGear(corpseA.items[2], 2);
ok('枪进空的主武器位', PG.weapons[1] && PG.weapons[1].id === 'smg');
ok('尸体上的枪已拿走', corpseA.items[2] === null);
ok('尸体枪只给三成弹匣', PG.weapons[1].magCur === 8, PG.weapons[1].magCur + ' / 25 发');
ok('武器槽写回存档', Save.gear.weapons[1] === 'smg');
ok('头盔写回存档', !!Save.gear.helmet && Save.gear.helmet.lv === 1);

// 已经有头盔了 → 这一件放进背包
const corpseB = { items: [{ gear: GEAR.make('helmet', 4) }] };
Game.openLoot(corpseB, true);
const bagN = PG.bag.slots.length;
Game.takeGear(corpseB.items[0], 0);
ok('已有同类装备时放进背包', PG.bag.slots.length === bagN + 1);
ok('身上的头盔没被换掉', PG.helmet.lv === 1);

const hi = PG.bag.slots.findIndex(s => s.item.equip && s.item.equip.kind === 'armor');
ok('背包里装备只占一格', hi >= 0 && PG.bag.slots[hi].n === 1);
ok('装备带着自己的耐久进包', PG.bag.slots[hi].item.equip.gear.dur === 65);

// 点背包里的头盔 → 穿上，换下来的留在这一格
Game.equipFromBag(hi);
ok('点背包里的装备能穿上', PG.helmet.lv === 4);
ok('换下的旧装备留在刚才那一格',
  !!PG.bag.slots[hi] && PG.bag.slots[hi].item.equip &&
  PG.bag.slots[hi].item.equip.gear.lv === 1);

// 武器位全满 → 枪只能进背包
PG.weapons = [Object.assign({}, WEAPONS.rifle, { magCur: 30 }),
              Object.assign({}, WEAPONS.shotgun, { magCur: 6 }),
              Object.assign({}, WEAPONS.pistol, { magCur: 12 })];
PG.slot = 0; PG.mag = 30;
const corpseC = { items: [{ gun: 'smg' }] };
Game.openLoot(corpseC, true);
const bn = PG.bag.slots.length;
Game.takeGear(corpseC.items[0], 0);
ok('武器位满了枪进背包', PG.bag.slots.length === bn + 1);
const bi = PG.bag.slots.findIndex(s => s.item.equip && s.item.equip.kind === 'gun');
ok('背包里的枪记住余弹', PG.bag.slots[bi].item.equip.mag === 8);

// 背包满 / 超重时不硬塞
const full = PG.bag.slots.slice();
const junkItem = ITEMS.find(i => i.id === 'life01');
while (PG.bag.slots.length < CFG.BAG.SLOTS) PG.bag.slots.push({ item: junkItem, n: 1 });
const corpseD = { items: [{ gear: GEAR.make('body', 2) }] };
Game.openLoot(corpseD, true);
Game.takeGear(corpseD.items[0], 0);
ok('背包满了拿不走', corpseD.items[0] !== null);
PG.bag.slots = full;

console.log('\n=== 装备回收价 ===');
const h4 = EQUIP.armor(GEAR.make('helmet', 4));
ok('头盔回收价不超过买价', h4.sell <= h4.price, h4.sell + ' ≤ ' + h4.price);
ok('满耐久按半价回收', h4.sell === Math.floor(600 * 0.5), '¥' + h4.sell);

const body5 = EQUIP.armor(GEAR.make('body', 5));              // 150 耐久
const body5w = EQUIP.armor(GEAR.make('body', 5, 75));         // 一半耐久
ok('耐久掉了回收价跟着掉', body5w.sell < body5.sell, body5.sell + ' → ' + body5w.sell);
ok('回收价跟着耐久等比算', body5w.sell === Math.floor(body5.sell / 2));

const broken = EQUIP.armor(GEAR.make('body', 6, 0));
ok('耐久归零只剩保底价', broken.sell === 1, '¥' + broken.sell);

const g1 = EQUIP.gun('rifle', 0);
ok('枪按半价回收', g1.sell === Math.floor(WEAPONS.rifle.value * 0.5), '¥' + g1.sell);
ok('枪的回收价也不超过买价', g1.sell <= g1.price);

console.log('\n=== 装备进仓库 ===');
Save.stash = [];
Save.credits = 1000;
Save.addGearStash(h4);
Save.addGearStash(EQUIP.armor(GEAR.make('helmet', 4, 30)));
ok('同型号不同耐久是两条', Save.stash.length === 2);
Save.addStash('lux01', 1);
Save.addStash('lux01', 2);
Save.normalizeStash();
ok('普通物品照常合并', Save.stashCount('lux01') === 3);
ok('装备不会被合并掉', Save.stash.filter(e => e.gear).length === 2);

const coin0 = Save.credits;
const eqEntry = Save.stash.find(e => e.gear);
Base.sell(eqEntry, 1);
ok('仓库里能卖装备', Save.credits === coin0 + eqEntry.gear.sell, '+' + eqEntry.gear.sell);
ok('卖掉的装备从仓库消失', Save.stash.filter(e => e.gear).length === 1);
ok('卖价没超过买价', eqEntry.gear.sell <= eqEntry.gear.price);

// 撤离：背包里的装备要原样进仓库（不许折算成钱就消失）
Game.startRun();
const PZ = Game.player;
PZ.bag.slots.length = 0;
PZ.bag.safe.length = 0;
const carriedArmor = EQUIP.armor(GEAR.make('body', 4, 40));
PZ.bag.slots.push({ item: carriedArmor, n: 1 });
Save.stash = [];
Save.credits = 500;
noThrow('撤离结算不报错', () => Game.showEnd(true));
const stashedGear = Save.stash.find(e => e.gear);
ok('撤离后装备进仓库', !!stashedGear);
ok('仓库里的装备保留耐久',
  !!stashedGear && stashedGear.gear.equip.gear.dur === 40,
  stashedGear ? '耐久 ' + stashedGear.gear.equip.gear.dur : '没进仓库');
ok('装备没被偷偷换成钱', Save.credits === 500, '余额 ' + Save.credits);

// 真实尸体：拾荒者手里那把枪要能掉出来、能捡起来
const scav2 = Game.enemies.find(e => e.key === 'scav');
ok('拾荒者身上配了枪', !!scav2.weaponId, scav2.weaponId);
const realCorpse = new ctx.Corpse(scav2.x, scav2.y, scav2);
const gunEntry = realCorpse.loot.find(e => e.gun);
ok('尸体掉落里有枪', !!gunEntry);
ok('掉落的枪存的是 id 字符串', typeof gunEntry.gun === 'string', String(gunEntry.gun));

Game.player.weapons = [null, null, null];
Game.player.slot = 0;
Game.openLoot(realCorpse, true);
const gi = realCorpse.loot.indexOf(gunEntry);
Game.takeGear(gunEntry, gi);
ok('真实尸体上的枪能装上', Game.player.weapons.filter(Boolean).length === 1,
  Game.player.weapons.map(w => (w ? w.name : '空')).join(' / '));

// 容器（非尸体）不该出现装备区
Game.closeLoot();
const crate = Game.boxes.find(b => b.kind === 'fast');
Game.openLoot(crate, false);
noThrow('容器面板渲染不报错', () => Game.renderLootList());
ok('容器没有装备区', !(crate.items || []).some(e => e && (e.gear || e.gun)));
Game.closeLoot();

console.log('\n=== 背包 ===');
noThrow('切换背包面板', () => Game.toggleBag());
noThrow('渲染背包', () => Game.renderBag());
ok('背包打开', Game.bagOpen === true);
noThrow('关闭背包', () => Game.toggleBag());

// 安全箱
const P6 = Game.player;
if (P6.bag.slots.length > 0) {
  const n0 = P6.bag.slots.length;
  Game.moveToSafe(0);
  ok('移入安全箱', P6.bag.safe.length === 1 && P6.bag.slots.length === n0 - 1);
}

console.log('\n=== 敌人 AI ===');
Game.startRun();
// 放一个拾荒者在玩家附近，看它是否会发现并靠近
const P7 = Game.player;
P7.x = M.cx(25); P7.y = M.cy(17); // 扩建后的堤顶横街，玩家与敌人之间没有墙体。
const scav = Game.enemies.find(e => e.key === 'scav');
scav.x = P7.x + 300; scav.y = P7.y;   // 在视野内、射程外
scav.angle = Math.PI;      // 面朝玩家方向
const d0 = U.dist(scav.x, scav.y, P7.x, P7.y);
let sawChase = false;
let minD = d0;
for (let i = 0; i < 180; i++) {
  Game.update(1 / 60);
  if (scav.state === 'chase') sawChase = true;
  minD = Math.min(minD, U.dist(scav.x, scav.y, P7.x, P7.y));
}
ok('拾荒者发现玩家', sawChase, 'state=' + scav.state);
ok('敌人会靠近', minD < d0 - 20, d0.toFixed(0) + ' → ' + minD.toFixed(0) + 'px');

// 噪声吸引
Game.startRun();
const P8 = Game.player;
const echo = Game.enemies.find(e => e.key === 'echo');
echo.x = P8.x + 250; echo.y = P8.y;
echo.state = 'patrol'; echo.path = null;
Noise.emit(P8.x, P8.y, 18, 'shot');
let echoSuspect = false;
for (let i = 0; i < 120; i++) {
  Game.update(1 / 60);
  if (echo.state === 'suspect' || echo.state === 'chase') echoSuspect = true;
}
ok('回响体被噪声吸引', echoSuspect, 'state=' + echo.state);

console.log('\n=== 投掷物 ===');
Game.startRun();
const P9 = Game.player;
const stones0 = P9.stones;
Game.input.aimAngle = 0;
P9.throwStone();
ok('石子数量减少', P9.stones === stones0 - 1);
ok('投掷物存在', Game.throwables.length === 1);
for (let i = 0; i < 90; i++) Game.update(1 / 60);
ok('投掷物落地消失', Game.throwables.length === 0);

console.log('\n=== 门 ===');
Game.startRun();
const doorTile = (() => {
  for (let y = 0; y < M.H; y++) for (let x = 0; x < M.W; x++) {
    const t = M.at(x, y);
    if (t.door) return { t, x, y };
  }
})();
ok('地图有门', !!doorTile);
if (doorTile) {
  const open0 = doorTile.t.door.open;
  Game.player.x = M.cx(doorTile.x); Game.player.y = M.cy(doorTile.y) + 10;
  Game.input.interactPressed = true;
  Game.update(1 / 60);
  ok('门状态可切换', doorTile.t.door.open !== open0,
     open0 + ' → ' + doorTile.t.door.open);
  // 关着的门应该阻挡通行
  if (!doorTile.t.door.open) {
    ok('关闭的门不可通行', M.walkable(doorTile.x, doorTile.y) === false);
  }
}

console.log('\n=== 潮汐 ===');
Game.startRun();
Game.time = 0;
Game.updateTide();
const lv0 = Game.tideLevel;
Game.time = 300;
Game.updateTide();
const lv1 = Game.tideLevel;
Game.time = 600;
Game.updateTide();
const lv2 = Game.tideLevel;
ok('水位随时间上升', lv0 < lv1 && lv1 < lv2,
   lv0.toFixed(2) + ' → ' + lv1.toFixed(2) + ' → ' + lv2.toFixed(2));
ok('平潮时核心低洼区不可进', (() => {
  M.tideLevel = lv2;
  return M.grid.flat().filter(tile => tile.ch === '~').every(tile => lv2 - tile.h > 1.05);
})());

console.log('\n=== 击杀与安静区 ===');
Game.startRun();
const P10 = Game.player;
const victim = Game.enemies[0];
victim.x = P10.x + 100; victim.y = P10.y;
victim.hurt(999, 'player');
ok('敌人死亡', victim.dead === true);
ok('生成尸体', Game.corpses.length === 1);
ok('触发安静区', Quiet.zones.length === 1);
ok('击杀计数', Game.stats.kills === 1);

console.log('\n=== 门洞方向 ===');
M.load(['.#.', '.+.', '.#.']);
ok('上下墙之间的门识别为侧向', M.at(1, 1).door.axis === 'vertical');
M.at(1, 1).door.open = false;
ok('侧向关门阻挡通行和视线', !M.walkable(1, 1) && M.opaque(1, 1));
M.at(1, 1).door.open = true;
ok('侧向开门允许通行和视线', M.walkable(1, 1) && !M.opaque(1, 1));
M.load(['...', '#+#', '...']);
ok('左右墙之间的门识别为正向', M.at(1, 1).door.axis === 'horizontal');
M.load(['.#.', '.S.', '.#.']);
ok('避难门也识别侧向', M.at(1, 1).door.safe && M.at(1, 1).door.axis === 'vertical');
M.load(['.#.', '.+.', '.#.'], { '1,1': 'horizontal' });
ok('门洞可显式覆盖方向', M.at(1, 1).door.axis === 'horizontal');
M.load(['...', '.+.', '...']);
ok('无相邻墙的门有确定默认方向', M.at(1, 1).door.axis === 'horizontal');
M.load(ctx.MAP_ROWS || vm.runInContext('MAP_ROWS', ctx));

console.log('\n=== 实体物件碰撞 ===');
M.load(['#########', '#.......#', '#..C....#', '#.......#', '#########']);
const obstacleX = 3 * CFG.TILE, obstacleY = 2 * CFG.TILE;
for (const [label, x, y, dx, dy, check] of [
  ['西侧', M.cx(2), M.cy(2), 200, 0, e => e.x <= obstacleX - 7],
  ['东侧', M.cx(4), M.cy(2), -200, 0, e => e.x >= obstacleX + CFG.TILE + 7],
  ['北侧', M.cx(3), M.cy(1), 0, 200, e => e.y <= obstacleY - 7],
  ['南侧', M.cx(3), M.cy(3), 0, -200, e => e.y >= obstacleY + CFG.TILE + 7]
]) {
  const actor = { x, y, r: 7 };
  ctx.moveEntity(actor, dx, dy);
  ok('大步移动不能从' + label + '穿过容器', check(actor) && ctx.canStand(actor.x, actor.y, actor.r));
}
ok('圆形碰撞检查物件拐角', !ctx.canStand(obstacleX - 4, obstacleY - 4, 7));
ok('圆形碰撞允许安全贴角', ctx.canStand(obstacleX - 6, obstacleY - 6, 7));
ok('寻路拒绝容器终点', M.findPath(1, 2, 3, 2) === null);
const detour = M.findPath(1, 2, 6, 2);
ok('寻路绕开容器', detour && detour.every(p => p.x !== 3 || p.y !== 2));
const walker = new ctx.Enemy('scav', M.cx(1), M.cy(2));
walker.path = detour; walker.pathI = 0;
let safeWalk = true;
for (let i = 0; i < 300; i++) {
  walker.moveAlongPath(1 / 60, 70);
  if (!ctx.canStand(walker.x, walker.y, walker.r)) safeWalk = false;
}
ok('敌人沿路移动也执行实体碰撞', safeWalk && U.dist(walker.x, walker.y, M.cx(6), M.cy(2)) < 1);
M.load(vm.runInContext('MAP_ROWS', ctx));
ok('实体家具不可站立', vm.runInContext('DECOR.filter(p => !p.ground).every(p => !canStand(M.cx(p.x), M.cy(p.y), 7))', ctx));
ok('地面贴花可站立', vm.runInContext('DECOR.filter(p => p.ground).every(p => canStand(M.cx(p.x), M.cy(p.y), 7))', ctx));
Game.buildBoxes();
const occupiedBox = Game.boxes[0];
occupiedBox.opened = true; occupiedBox.items = [];
ok('开空的容器仍不可穿过', !M.walkable(occupiedBox.tx, occupiedBox.ty));
ok('容器有独立外观和名称', Game.boxes.every(b => b.art && b.name));

console.log('\n=== 三向图 ===');
// 方向判定：0=朝右 / PI/2=朝下 / -PI/2=朝上 / PI=朝左（镜像，仍是侧图）
const dirAt = (a, holder) => {
  const h = holder || {};
  Art.char('player', a, h);
  return h._sprDir;
};
ok('朝右用侧面图', dirAt(0) === 'e');
ok('朝下用正面图', dirAt(Math.PI / 2) === 's');
ok('朝上用背面图', dirAt(-Math.PI / 2) === 'n');
ok('朝左也用侧面图（靠水平镜像）', dirAt(Math.PI) === 'e');
// 斜向按主轴分：横向明显占优才算侧面（阈值 ax-ay>0.10，约 42° 以内）
ok('斜向朝右仍用侧面图', dirAt(Math.PI / 4 - 0.15) === 'e');
ok('接近 45° 时归为正面', dirAt(Math.PI / 4 - 0.02) === 's');

// 迟滞：已经朝侧面时，偏一点不切回正面，避免 45° 边界闪
const hys = { _sprDir: 'e' };
ok('迟滞：侧面不会在边界抖动', dirAt(Math.PI / 4 + 0.05, hys) === 'e',
   'dir=' + hys._sprDir);

// 没有贴图时必须返回 null（渲染层据此退回圆点）
ok('无贴图时返回 null', Art.char('player', 0) === null);
ok('角色三向共 12 个资源槽', ART.chars.length * ART.charDirs.length === 12,
   ART.chars.length + ' 角色 × ' + ART.charDirs.length + ' 方向');

console.log('\n=== 物品简称 ===');
// 背包格子只有 48×42，名字超过四个字会显示不全，所以约定要写 short
const longNames = ITEMS.filter(i => i.name.replace(/\s/g, '').length > 4);
ok('长名字物品都写了简称',
   longNames.every(i => !!i.short),
   longNames.filter(i => !i.short).map(i => i.name).join(',') || '全部有');
ok('简称不超过 4 个字',
   ITEMS.filter(i => i.short).every(i => i.short.length <= 4),
   ITEMS.filter(i => i.short && i.short.length > 4).map(i => i.short).join(',') || '全部合规');

console.log('\n=== 逐件搜索 ===');
Game.startRun({ ammo: 0, bandage: 0, stone: 0 });
const sbox = Game.boxes.find(b => b.items && b.items.filter(Boolean).length >= 3);
Game.player.x = sbox.x; Game.player.y = sbox.y + 10;   // 站到旁边，否则会被"走远自动关"关掉
Game.openLoot(sbox);

ok('打开容器时背包一起开', Game.bagOpen === true);
ok('容器内容初始都是未搜索',
   sbox.items.filter(Boolean).every(e => e.known === false),
   sbox.items.filter(Boolean).map(e => e.known).join(','));

ok('稀有度越高搜得越久',
   Game.searchTime({ r: 1 }) === 0.45 && Game.searchTime({ r: 5 }) === 3.0,
   'r1=' + Game.searchTime({ r: 1 }) + 's r5=' + Game.searchTime({ r: 5 }) + 's');

// 打开就自己往下搜，不用点
ok('打开容器自动开始搜', Game.autoSearch === true && !!Game.search && Game.search.idx === 0);

const need = Game.search.total;
ok('计时长度跟稀有度对上',
   Math.abs(need - Game.searchTime(sbox.items[0].item)) < 1e-9, need + 's');

// 推到第一件搜完 → 自动接第二件
const frames = Math.ceil(need * 60) + 4;
for (let i = 0; i < frames; i++) Game.update(1 / 60);
ok('搜完第一件', sbox.items[0].known === true);
ok('自动接着搜下一件', !!Game.search && Game.search.idx === 1,
   Game.search ? '正在搜 idx=' + Game.search.idx : '停下了');
ok('已搜过的不再重复计时', Game.startItemSearch(0) === false);

/* 点某一件 = 我要先搜这个：中断自动，只搜目标这一件。
   拿一个后面几件里的下标，才能验证它真的插了队。 */
const lastIdx = sbox.items.length - 1;
Game.startItemSearch(lastIdx, true);
ok('点某件会中断自动搜索', Game.autoSearch === false);
ok('改搜指定的那一件', !!Game.search && Game.search.idx === lastIdx,
   Game.search ? 'idx=' + Game.search.idx : '没在搜');

const need2 = Game.search.total;
for (let i = 0; i < Math.ceil(need2 * 60) + 4; i++) Game.update(1 / 60);
ok('目标那件搜完了', sbox.items[lastIdx].known === true);
ok('手动模式下搜完就停，不再自动接下一件', Game.search === null);

// 搜到一半换一件，前一件的进度归零
const midIdx = sbox.items.findIndex(e => e && !e.known);
if (midIdx >= 0) {
  Game.startItemSearch(midIdx);
  Game.update(0.2);
  const half = Game.search ? Game.search.t : -1;
  Game.startItemSearch(midIdx);
  ok('重开同一件进度归零', Game.search.t === 0, '之前 ' + half.toFixed(2) + 's');
} else {
  ok('重开同一件进度归零', true, '这次容器已经搜空了，跳过');
}

Game.closeLoot();
ok('关面板时背包跟着收回', Game.bagOpen === false);
ok('关面板清掉搜索', Game.search === null);
ok('关面板停掉自动搜索', Game.autoSearch === false);

console.log('\n=== 命中部位与护甲 ===');
Game.startRun({ ammo: 0, bandage: 0, stone: 0 });
const PE = Game.player;
const TG = Game.enemies.filter(e => e.key === 'scav')[0];
TG.helmet = null; TG.body = null;

/* 挪到一片 5×5 全空的地方，否则竖直方向的弹道会先撞墙 */
let openTile = null;
for (let y = 2; y < M.H - 2 && !openTile; y++) {
  for (let x = 2; x < M.W - 2; x++) {
    let clear = true;
    for (let dy = -2; dy <= 2 && clear; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (!M.walkable(x + dx, y + dy)) { clear = false; break; }
      }
    }
    if (clear) { openTile = { x, y }; break; }
  }
}
TG.x = M.cx(openTile.x); TG.y = M.cy(openTile.y);

/* 从四个方向各打一条穿过圆心的弹道，都应是爆头 */
const shotThrough = (angle, offset) => {
  const d = 40;
  const off = offset || 0;
  const px = Math.cos(angle + Math.PI / 2) * off;
  const py = Math.sin(angle + Math.PI / 2) * off;
  const sx = TG.x + px - Math.cos(angle) * d;
  const sy = TG.y + py - Math.sin(angle) * d;
  const ex = TG.x + px + Math.cos(angle) * d;
  const ey = TG.y + py + Math.sin(angle) * d;
  const b = new ctx.Bullet(sx, sy, angle, 600, 'player', 20, 600);
  TG.hp = 100;
  b.hitSegment(sx, sy, ex, ey);
  return 100 - TG.hp;
};

const headDmg = [0, Math.PI / 2, Math.PI, -Math.PI / 2].map(a => shotThrough(a, 0));
ok('四向穿过圆心都是爆头', headDmg.every(d => Math.abs(d - 30) < 0.01),
   headDmg.map(d => d.toFixed(1)).join(' '));

const bodyDmg = shotThrough(0, 5.5);   // 偏 5.5px：在外圆内、内圆外
ok('偏心的命中算身体', Math.abs(bodyDmg - 20) < 0.01, bodyDmg.toFixed(1));

const missDmg = shotThrough(0, 12);    // 完全在外圆外
ok('明显偏离不造成伤害', missDmg === 0, missDmg.toFixed(1));

/* 玩家护甲：爆头 1.5 倍，头盔按百分比减伤，耐久只扣原始伤害 */
const freshHelmet = () => GEAR.make('helmet', 4);   // 32%
PE.helmet = freshHelmet(); PE.body = null; PE.hp = 100;
PE.hurt(20, 'head');
ok('爆头 ×1.5 后再吃头盔减伤',
   Math.abs(PE.hp - (100 - 20 * 1.5 * (1 - 0.32))) < 0.01, PE.hp.toFixed(1));
ok('头盔耐久只扣基础伤害', PE.helmet.dur === 45, PE.helmet.dur + '/65');

/* 破损：耐久 < 50% 时减伤砍半 */
PE.helmet.dur = 30; PE.hp = 100;
PE.hurt(20, 'head');
ok('破损后减伤减半',
   Math.abs(PE.hp - (100 - 30 * (1 - 0.16))) < 0.01, PE.hp.toFixed(1));

/* 失效：耐久归零后没有任何减伤 */
PE.helmet.dur = 20; PE.hp = 100;
PE.hurt(20, 'head');      // 扣 20 → 0，这一击仍按破损算
ok('清空耐久的这一击仍享受防护',
   Math.abs(PE.hp - (100 - 30 * 0.84)) < 0.01, PE.hp.toFixed(1));
ok('耐久归零', PE.helmet.dur === 0);
PE.hp = 100;
PE.hurt(20, 'head');
ok('失效后吃满伤害', Math.abs(PE.hp - 70) < 0.01, PE.hp.toFixed(1));

/* 身体命中只吃身体护甲，头盔耐久不变 */
PE.helmet = freshHelmet();
PE.body = GEAR.make('body', 5);   // 50%
PE.hp = 100;
const hdBefore = PE.helmet.dur;
PE.hurt(20, 'body');
ok('身体命中按身体护甲减伤', Math.abs(PE.hp - 90) < 0.01, PE.hp.toFixed(1));
ok('身体命中不动头盔耐久', PE.helmet.dur === hdBefore);
ok('身体命中扣身体护甲耐久', PE.body.dur === 130, PE.body.dur + '/150');

/* 移速 / 负重 / 存档 */
PE.body = GEAR.make('body', 6);
ok('六级甲移速 ×0.88', Math.abs(PE.armorMove - 0.88) < 1e-9);
ok('护甲重量计入总负重', PE.totalWeight >= 13, PE.totalWeight.toFixed(1) + 'kg');
PE.helmet = GEAR.make('helmet', 3);
PE.hurt(20, 'head');
ok('耐久会写回存档',
   Save.gear.helmet && Save.gear.helmet.dur === PE.helmet.dur,
   Save.gear.helmet ? Save.gear.helmet.dur : 'null');

console.log('\n=== 武器槽 ===');
PE.fillWeapons(['rifle', 'shotgun', 'pistol']);
ok('三个武器槽都装上', PE.weapons.filter(Boolean).length === 3);
ok('默认拿第一把', PE.slot === 0 && PE.weapon.id === 'rifle');
PE.mag = 12;
PE.switchWeapon(1);
ok('切到霰弹枪', PE.weapon.id === 'shotgun');
ok('每把枪的弹匣各自记住', PE.mag === 6, 'mag=' + PE.mag);
PE.switchWeapon(0);
ok('切回来还是原来的余弹', PE.mag === 12, 'mag=' + PE.mag);
ok('霰弹一次打六颗', (() => {
  PE.switchWeapon(1);
  PE.mag = 6; PE.recoil = 0; PE.sinceShot = 99; PE.fireCd = 0;
  Game.bullets.length = 0;
  PE.tryShoot();
  return Game.bullets.length === 6;
})(), Game.bullets.length + ' 颗');
ok('霰弹后坐力比步枪大', WEAPONS.shotgun.recoilPerShot > WEAPONS.rifle.recoilPerShot);

console.log('\n=== 尸体分类 ===');
// 三种敌人 -> 三种尸体图，缺图退通用 corpse，再缺退代码绘制
Game.startRun({ ammo: 0, bandage: 0, stone: 0 });
const corpses = ['scav', 'echo', 'guard'].map(k => {
  const e = Game.enemies.filter(x => x.key === k)[0];
  return new ctx.Corpse(0, 0, e);
});
ok('尸体记住敌人种类',
   corpses.map(c => c.key).join(',') === 'scav,echo,guard',
   corpses.map(c => c.key).join(','));
ok('尸体落地朝向取四向之一',
   corpses.every(c => [0, Math.PI / 2, Math.PI, -Math.PI / 2].indexOf(c.rot) >= 0));

// 图片解析的降级顺序
Art.map['props/corpse_scav'] = 'scav图像';
ok('有专属图时用专属图', Art.corpse('scav') === 'scav图像');
Art.map['props/corpse'] = '通用图';
ok('缺专属图时退回通用尸体', Art.corpse('echo') === '通用图');
Art.map['props/corpse'] = null;
ok('全缺时返回 null（渲染层退回色块）', Art.corpse('guard') === null);
Art.map['props/corpse_scav'] = null;

console.log('\n=== 藏身处 ===');
// 干净存档
Save.codex = {}; Save.stash = []; Save.credits = 1000;
Save.loadout = { ammo: 60, bandage: 3, stone: 3 };
Save.runs = 0;
Game.player = null;
noThrow('Base.open()', () => Base.open());
ok('状态切到 base', Game.state === 'base');

// 入库与合并
Save.addStash('antiq03', 1);
Save.addStash('antiq03', 2);
Save.normalizeStash();
ok('同类合并', Save.stash.length === 1 && Save.stash[0].n === 3,
   JSON.stringify(Save.stash));

// 出售
const credA = Save.credits;
const coin = ITEMS.find(i => i.id === 'antiq03');
Base.sell(Save.stash.find(e => e.id === 'antiq03'), 3);
ok('出售加钱', Save.credits === credA + coin.price * 3,
   credA + ' → ' + Save.credits);
ok('出售后清空', Save.stashCount('antiq03') === 0);

// 卖寻常物
Save.stash = [];
Save.addStash('antiq03', 1);   // 寻常
Save.addStash('lux02', 1);     // 珍稀，不该被清
const c0 = Save.credits;
Base.sellJunk();
ok('清寻常物只清 r1', Save.stashCount('antiq03') === 0 && Save.stashCount('lux02') === 1);
ok('清仓加钱', Save.credits > c0);

// 补给花费：仓库有 10 发弹药时只买 50 发
Save.stash = []; Save.credits = 1000;
Save.addStash('ammo', 10);
Save.loadout = { ammo: 60, bandage: 3, stone: 3 };
const cost = Base.computeCost();
ok('补给成本扣掉仓库存量', cost === (60 - 10) * SUPPLY.ammo.price
   + 3 * SUPPLY.bandage.price + 3 * SUPPLY.stone.price, '¥' + cost);

// 出发扣费
const c1 = Save.credits;
Base.deploy();
ok('出发后信用点扣除', Save.credits === c1 - cost, c1 + ' → ' + Save.credits);
ok('出发消耗仓库弹药', Save.stashCount('ammo') === 0);
ok('出发进入对局', Game.state === 'playing');
ok('弹药按配置带入', Game.player.bag.hasAmmo() === 60,
   '备弹 ' + Game.player.bag.hasAmmo());
ok('石子按配置带入', Game.player.stones === 3);

// 破产保护：钱见底时补给免费，但仍能出发（不能让人卡死）
Game.state = 'base';
Save.credits = 0;
Save.loadout = { ammo: 60, bandage: 3, stone: 3 };
Save.stash = [];
ok('信用点见底时补给免费', Base.computeCost() === 0);
noThrow('救济补给可出发', () => Base.deploy());
ok('救济补给确实进图', Game.state === 'playing');

// 结算入库：死亡只带回安全箱
Save.stash = []; Save.credits = 0;
Save.loadout = { ammo: 10, bandage: 1, stone: 0 };
Game.startRun(Save.loadout);
const PX = Game.player;
PX.bag.slots.length = 0;
PX.bag.safe.length = 0;
PX.bag.add(ITEMS.find(i => i.id === 'ind01'), 1);      // 会丢
PX.bag.safe.push({ item: ITEMS.find(i => i.id === 'lux02'), n: 1 });  // 保住
PX.hurt(999);
for (let i = 0; i < 60; i++) Game.update(1 / 60);
ok('死亡后只有安全箱入库',
   Save.stashCount('lux02') === 1 && Save.stashCount('ind01') === 0,
   JSON.stringify(Save.stash));

// 完整流程：死亡 → 结算 → 回藏身处
Game.state = 'base';
Game.startRun(Save.loadout);
Game.player.hurt(999);
ok('死亡先播放动画', Game.state === 'dying');
for (let i = 0; i < 60; i++) Game.update(1 / 60);
ok('死亡后进入结算', Game.state === 'ended');
const btn = ctx.document.getElementById('btnAgain');
ok('结算按钮已绑定', typeof btn.onclick === 'function');
noThrow('点「回藏身处」', () => btn.onclick());
ok('回到藏身处', Game.state === 'base');

console.log('\n=== 藏身处配装 ===');
Save.stash = []; Save.credits = 1000;
Save.gear.helmet = null; Save.gear.body = null;
Base.tab = 'stash'; Base.picker = null;
noThrow('藏身处渲染', () => Base.open());

// 空仓库时点护甲槽：列表能开，但里面没有东西
Base.togglePicker('helmet');
ok('点护甲槽能打开列表', Base.picker === 'helmet');
ok('仓库没头盔时列表是空的', Base.stashArmor('helmet').length === 0);
noThrow('空列表也能渲染', () => Base.renderPicker());
Base.togglePicker('helmet');
ok('再点一次收起', Base.picker === null);

// 商人：只卖崭新的一~三级
Base.tab = 'shop';
noThrow('商人页渲染', () => Base.render());
const cBuy = Save.credits;
Base.buyArmor('helmet', 2);
ok('买下一顶二级头盔', Save.stash.filter(e => e.gear).length === 1);
ok('买来的是崭新（满耐久）',
  Save.stash.find(e => e.gear).gear.equip.gear.dur === GEAR.def('helmet', 2).dur);
ok('买东西扣钱', Save.credits === cBuy - GEAR.def('helmet', 2).price,
  cBuy + ' → ' + Save.credits);

const nShop = Save.stash.length;
Base.buyArmor('helmet', 5);
ok('商人卖不到三级以上', Save.stash.length === nShop, '仓库 ' + Save.stash.length + ' 条');

Save.credits = 10;
Base.buyArmor('body', 3);
ok('钱不够买不了', Save.stash.length === nShop && Save.credits === 10);
Save.credits = 1000;

// 从列表里穿上一件
Base.togglePicker('helmet');
ok('列表里能看见买来的头盔', Base.stashArmor('helmet').length === 1);
const buyEntry = Base.stashArmor('helmet')[0];
Base.equipFromStash(buyEntry, 'helmet');
ok('穿上买来的头盔', !!Save.gear.helmet && Save.gear.helmet.lv === 2);
ok('仓库里那一件被取走', Save.stash.indexOf(buyEntry) < 0);
ok('穿完自动关闭列表', Base.picker === null);

// 降级：换成一级也要能换，旧件回仓库
Save.addGearStash(EQUIP.armor(GEAR.make('helmet', 1)));
Base.togglePicker('helmet');
const lowEntry = Base.stashArmor('helmet')[0];
ok('列表按等级从高到低', lowEntry.gear.equip.gear.lv === 1);
Base.equipFromStash(lowEntry, 'helmet');
ok('能降级更换（不再是只能升一级）', Save.gear.helmet.lv === 1);
ok('换下的旧件回到仓库',
  Save.stash.some(e => e.gear && e.gear.equip.gear.lv === 2 && e.gear.equip.gear.type === 'helmet'));

// 卸下
Base.togglePicker('helmet');
Base.unequip('helmet');
ok('卸下后槽位空了', Save.gear.helmet === null);
ok('卸下的回到仓库而不是消失', Save.stash.filter(e => e.gear).length === 2);

// 取消：什么也不改
const nGear = Save.stash.filter(e => e.gear).length;
Base.togglePicker('body');
Base.closePicker();
ok('取消能关掉列表', Base.picker === null);
ok('取消不会动装备', Save.gear.body === null && Save.stash.filter(e => e.gear).length === nGear);

// 装备只认自己的类型
Save.addGearStash(EQUIP.armor(GEAR.make('body', 3)));
ok('头盔位里不会列出护甲', Base.stashArmor('helmet').every(e => e.gear.equip.gear.type === 'helmet'));
ok('护甲位里能列出护甲', Base.stashArmor('body').length === 1);

console.log('\n=== 撤离 ===');
Game.startRun();
const P11 = Game.player;
const ex = M.extracts[0];
P11.x = M.cx(ex.x); P11.y = M.cy(ex.y);
Game.input.interactPressed = true;
Game.update(1 / 60);
ok('开始撤离读条', Game.action && Game.action.type === 'extract');
for (let i = 0; i < 60 * 7; i++) Game.update(1 / 60);
ok('撤离完成 → 结算', Game.state === 'ended', 'state=' + Game.state);
ok('结算写入仓库', Save.stash.length > 0, Save.stash.length + ' 条');
ok('存档已落盘', !!store['tideline_save_v1']);

console.log('\n=== 死亡 ===');
Game.state = 'playing';
Game.startRun();
const P12 = Game.player;
// 放一件东西进背包，再让他死
const testItem = ITEMS.find(i => i.id === 'antiq03');
P12.bag.add(testItem, 1);
P12.bag.safe.push({ item: ITEMS.find(i => i.id === 'antiq02'), n: 1 });
P12.hurt(999);
for (let i = 0; i < 60; i++) Game.update(1 / 60);
ok('死亡触发结算', Game.state === 'ended');
ok('安全箱物品保留', Save.stash.some(s => s.id === 'antiq02'));

console.log('\n=== 渲染 ===');
Game.state = 'playing';
Game.startRun();
noThrow('渲染 1 帧（无视野）', () => Game.render());
for (let i = 0; i < 20; i++) Game.update(1 / 60);
noThrow('渲染 30 帧（有视野）', () => { for (let i = 0; i < 30; i++) Game.render(); });
ok('渲染调用了 fillRect', (ctxCalls.fillRect || 0) > 100, (ctxCalls.fillRect || 0) + ' 次');

// 调试模式
Game.debug = true;
noThrow('调试模式渲染', () => Game.render());
Game.debug = false;

console.log('\n=== 玩家动画状态 ===');
Game.startRun();
const animator = new ctx.Player(M.cx(10), M.cy(10));
animator.tickAnimation(0.55, false);
ok('待机有呼吸计时', animator.anim.state === 'idle' && animator.anim.time > 0.5);
animator.update(1 / 60, inpWalk); animator.tickAnimation(1 / 60, false);
ok('实际移动触发行走', animator.anim.state === 'walk');
animator.x = Game.boxes[0].x; animator.y = Game.boxes[0].y + CFG.TILE / 2 + animator.r;
animator.vx = 0; animator.vy = -120;
animator.update(1 / 60, { ...inpStill, my: -1 }); animator.tickAnimation(1 / 60, false);
ok('顶住实体时停止迈步', animator.anim.state === 'idle');
animator.mag = 0; animator.fireCd = 0; animator.tryShoot(); animator.tickAnimation(0, false);
ok('空枪不触发射击动画', animator.anim.state !== 'shoot');
animator.mag = 30; animator.reloadT = 0; animator.fireCd = 0;
animator.tryShoot(); animator.tickAnimation(0, false);
ok('真实开火触发射击动画', animator.anim.state === 'shoot' && animator.anim.time === 0);
animator.tickAnimation(0.08, false); animator.fireCd = 0;
animator.tryShoot(); animator.tickAnimation(0, false);
ok('连射每一发重置射击帧', animator.anim.state === 'shoot' && animator.anim.time === 0);
animator.hurt(1); animator.tickAnimation(0, false);
ok('受击优先于射击', animator.anim.state === 'hurt');
animator.hurtAnimT = 0; animator.shotAnimT = 0; animator.dodgeCd = 0;
animator.update(1 / 60, { ...inpStill, dodge: true }); animator.tickAnimation(0, false);
ok('闪避开始即播放动画', animator.anim.state === 'dodge' && animator.anim.time === 0);
animator.dodgeT = 0; animator.frameTravel = 0;
animator.tickAnimation(0, true);
ok('搜刮上下文触发搜刮动作', animator.anim.state === 'loot');
animator.dead = true; animator.tickAnimation(0, true);
ok('死亡覆盖其他动画', animator.anim.state === 'death');

console.log('\n=== 长时间稳定性 ===');
Game.state = 'playing';
Game.startRun();
Game.input.keys.d = true;
Game.input.mouseDown = true;
noThrow('跑 1800 帧（30 秒）不崩', () => {
  for (let i = 0; i < 1800; i++) {
    if (i % 200 === 0) { Game.input.aimAngle = Math.random() * 6.28; }
    if (Game.state !== 'playing') break;
    Game.update(1 / 60);
    if (i % 30 === 0) Game.render();
  }
});
Game.input.keys.d = false;
Game.input.mouseDown = false;
console.log('    （结束时 state=' + Game.state + '，t=' + Game.time.toFixed(1) + 's）');

console.log('\n---------------------------------------');
console.log('  通过 ' + pass + ' / 失败 ' + fail);
console.log('---------------------------------------\n');
process.exit(fail > 0 ? 1 : 0);
