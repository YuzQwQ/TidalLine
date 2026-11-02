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

for (const f of ['config.js', 'data.js', 'core.js', 'entities.js',
  'common.js', 'medical.js', 'art.js', 'ui.js', 'save.js', 'base.js',
  'game.js', 'game-update.js', 'game-render.js', 'game-panels.js',
  'medhud.js', 'melee.js', 'range.js', 'boot.js']) {
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
  globalThis.Quiet = Quiet; globalThis.SFX = SFX; globalThis.MeleeSystem = MeleeSystem;
  globalThis.Base = Base; globalThis.Art = Art; globalThis.ART = ART;
  globalThis.Corpse = Corpse; globalThis.Bullet = Bullet;
  globalThis.GEAR = GEAR; globalThis.WEAPONS = WEAPONS; globalThis.EQUIP = EQUIP; globalThis.HELMETS = HELMETS; globalThis.BODIES = BODIES; globalThis.SIDEARM_SLOT = SIDEARM_SLOT;
  globalThis.START_CREDITS = START_CREDITS;
  globalThis.MedQuick = MedQuick; globalThis.MedWheel = MedWheel;
  globalThis.MedBar = MedBar; globalThis.HealHud = HealHud; globalThis.MedHud = MedHud;
  globalThis.stackLimit = stackLimit; globalThis.isStackable = isStackable;
  globalThis.STASH_FILTERS = STASH_FILTERS; globalThis.stashFilterMatch = stashFilterMatch;
  globalThis.itemGroup = itemGroup; globalThis.itemCategoryLabel = itemCategoryLabel;
  globalThis.Range = Range; globalThis.RANGE_MAP = RANGE_MAP; globalThis.RANGE_GEO = RANGE_GEO;
  globalThis.RANGE_PARAMS = RANGE_PARAMS; globalThis.RANGE_DEF_G = RANGE_DEF_G;
  globalThis.magazineRounds = magazineRounds;
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

const { Game, M, CFG, U, Save, ITEMS, Noise, Quiet, Base, Art, ART, GEAR, WEAPONS, HELMETS, BODIES, EQUIP, SIDEARM_SLOT,
  Range, RANGE_MAP, RANGE_GEO, RANGE_PARAMS, RANGE_DEF_G } = ctx;

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
PR.recoil = 0; PR.sinceShot = 99; PR.checkAimProfile(); PR.aimRemaining=0; PR.syncSpread(); // isolate recoil after aiming has settled
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
// Find a clear 120px lane rather than depending on an editable map coordinate.
shotLane: for(let y=2;y<M.H-2;y++)for(let x=2;x<M.W-5;x++){
  const px=M.cx(x),py=M.cy(y);
  if(Array.from({length:61},(_,i)=>px+i*2).every(q=>!M.blocksShot(M.tx(q),M.ty(py),q,py))){P3.x=px;P3.y=py;break shotLane;}
}
Game.enemies.forEach((e, i) => { if (i > 0) e.dead = true; });
const dummy = Game.enemies[0];
dummy.x = P3.x + 120; dummy.y = P3.y;
dummy.hp = 999; dummy.maxHp = 999;
dummy.body=null;dummy.helmet=null;dummy.update=()=>{}; // projectile hit check; armor behavior has separate tests
dummy.state = 'patrol'; dummy.path = null; dummy.homeX = dummy.x; dummy.homeY = dummy.y;
const hpBefore = dummy.hp;
P3.angle = 0;
/* 弹道现在由"实际准星"决定：把准星指到正右方（后坐力为 0 时就是鼠标点） */
P3.updateAimPoint(P3.x + 200, P3.y);
Game.bullets.length = 0;
P3.mag = 30;
P3.recoil = 0; P3.aimRemaining=0; P3.syncSpread();
const shotRand=U.rand;U.rand=(a,b)=>(a+b)/2;P3.tryShoot();U.rand=shotRand;
for (let i = 0; i < 20; i++) Game.update(1 / 60);
ok('子弹命中敌人', dummy.hp < hpBefore, 'hp ' + hpBefore + ' → ' + dummy.hp.toFixed(1));

console.log('\n=== 换弹 ===');
Save.bag = [{ id: 'ammo_556_1', n: 40 }];
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
const fastBox = Game.boxes.find(b => b.kind === 'junk');
P5.x = fastBox.x; P5.y = fastBox.y + CFG.TILE / 2 + P5.r + 1;
Game.input.interactPressed = true;
Game.update(1 / 60);
// 快取容器是 0 秒读条，同一帧就会打开面板 —— 检查最终结果
ok('搜刮面板已打开', !!Game.lootOpen);
ok('容器标记为掀开过', fastBox.searched === true);
ok('还有东西时不算翻空', fastBox.opened === false && Game.boxHasItems(fastBox));

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

/* 拿走一部分之后必须还能再开：这是"一次性容器"改成"可反复搜刮"的关键 */
if (Game.boxHasItems(fastBox)) {
  P5.x = fastBox.x; P5.y = fastBox.y + CFG.TILE / 2 + P5.r + 1;
  const again = Game.findInteractable();
  ok('没搜空的容器仍可交互', !!again && again.type === 'box' && again.obj === fastBox);
  Game.handleInteract();
  ok('第二次打开不再读条', Game.lootOpen === fastBox);
  Game.closeLoot();
}

/* 翻干净 → 变暗、不再提示 */
fastBox.items = fastBox.items.map(() => null);
Game.syncBoxState(fastBox);
ok('翻空的容器标记为已清空', fastBox.opened === true);
P5.x = fastBox.x; P5.y = fastBox.y + CFG.TILE / 2 + P5.r + 1;
const afterEmpty = Game.findInteractable();
ok('翻空后不再提示交互', !afterEmpty || afterEmpty.obj !== fastBox);

console.log('\n=== 丢弃与遗落物品堆 ===');
Game.startRun();
const PD = Game.player;
const ammoItem = ITEMS.find(i => i.id === 'ammo_556_1');
const healItem = ITEMS.find(i => i.id === 'heal01');

const boxes0 = Game.boxes.length;
PD.bag.slots = [{ item: ammoItem, n: 12 }];
Game.dropFromBag(0);
const pile = Game.boxes.find(b => b.pile);
ok('丢弃生成物品堆', !!pile && Game.boxes.length === boxes0 + 1);
ok('物品堆落在脚下那一格',
   !!pile && Math.floor(PD.x / CFG.TILE) === pile.tx && Math.floor(PD.y / CFG.TILE) === pile.ty);
ok('丢出的物品进入物品堆',
   !!pile && pile.items.length === 1 && pile.items[0].n === 12 && pile.items[0].item.id === 'ammo_556_1');
ok('丢出的东西一开始就知道是什么', !!pile && pile.items.every(e => e.known === true));
ok('背包那一格已清掉', PD.bag.slots.length === 0);
ok('物品堆已掀开但未清空', !!pile && pile.searched === true && pile.opened === false);
ok('物品堆可以交互', !!pile && Game.boxHasItems(pile) &&
   (() => { const it = Game.findInteractable(); return !!it && it.obj === pile; })());

/* 同一个格子再丢：并进同一个堆，不刷第二个 */
PD.bag.slots = [{ item: healItem, n: 1 }];
Game.dropFromBag(0);
ok('同格丢弃并入同一堆',
   Game.boxes.filter(b => b.pile).length === 1 && pile.items.length === 2);

/* 可堆叠的同种物品并成一条，而不是堆里出现两条同名 */
PD.bag.slots = [{ item: ammoItem, n: 5 }];
Game.dropFromBag(0);
ok('同种可堆叠物品合并计数',
   pile.items.length === 2 && pile.items.find(e => e.item.id === 'ammo_556_1').n === 17);

/* 空格子丢弃是空操作 */
ok('空格丢弃无效', Game.dropFromBag(0) === false);

/* 搜干净 → 物品堆消失 */
Game.openLoot(pile);
ok('物品堆能打开', Game.lootOpen === pile);
pile.items = pile.items.map(() => null);
Game.syncBoxState(pile);
ok('物品堆搜空后消失', !Game.boxes.includes(pile));
ok('搜空后自动关掉面板', Game.lootOpen === null);
ok('格子上的引用也清掉了', M.at(pile.tx, pile.ty).box !== pile);

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
ok('武器槽写回存档', Save.gear.weapons[1] && Save.gear.weapons[1].equip.gun === 'smg',
  Save.gear.weapons[1] ? Save.gear.weapons[1].name : '空');
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
while (PG.bag.slots.length < ctx.bagSlots()) PG.bag.slots.push({ item: junkItem, n: 1 });
const corpseD = { items: [{ gear: GEAR.make('body', 2) }] };
Game.openLoot(corpseD, true);
Game.takeGear(corpseD.items[0], 0);
ok('背包满了拿不走', corpseD.items[0] !== null);
PG.bag.slots = full;

console.log('\n=== 装备回收价 ===');
const h4 = EQUIP.armor(GEAR.make('helmet', 4));
ok('头盔回收价不超过买价', h4.sell <= h4.price, h4.sell + ' ≤ ' + h4.price);
ok('满耐久按半价回收', h4.sell === Math.floor(GEAR.def('helmet',4).price * 0.5), '¥' + h4.sell);

const body5 = EQUIP.armor(GEAR.make('body', 5));              // 150 耐久
const body5w = EQUIP.armor(GEAR.make('body', 5, 75));         // 一半耐久
ok('耐久掉了回收价跟着掉', body5w.sell < body5.sell, body5.sell + ' → ' + body5w.sell);
ok('回收价跟着耐久等比算', body5w.sell === Math.floor(body5.sell / 2));

const broken = EQUIP.armor(GEAR.make('body', 6, 0));
ok('耐久归零只剩保底价', broken.sell === 1, '¥' + broken.sell);

const g1 = EQUIP.gun('rifle', 0);
ok('枪按半价回收', g1.sell === Math.floor(WEAPONS.rifle.price * 0.5), '¥' + g1.sell);
ok('枪的回收价也不超过买价', g1.sell <= g1.price);

console.log('\n=== 装备进仓库 ===');
Save.stash = [];
Save.credits = 100000;
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
const crate = Game.boxes.find(b => b.kind === 'junk');
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
P7.x = M.cx(23); P7.y = M.cy(13); // 北桥接街，合法站位与连续直线通路。
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
  Game.player.x = M.cx(doorTile.x); Game.player.y = M.cy(doorTile.y) - CFG.TILE;
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
ok('静态图水位保持稳定', lv0 === 0 && lv1 === 0 && lv2 === 0,
   lv0.toFixed(2) + ' → ' + lv1.toFixed(2) + ' → ' + lv2.toFixed(2));
ok('运河全程不可涉水', (() => {
  M.tideLevel = lv2;
  return M.grid.flat().filter(tile => tile.ch === '~').every(tile => tile.permanentWater && tile.obstacle);
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
  ['南侧', M.cx(3), M.navigationPoint(3,3).y, 0, -200, e => e.y >= obstacleY + CFG.TILE + 7]
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
/* 多格物件的实体格不一定在原点：院落树是 3×3 视觉 + 单格树干碰撞（树冠可走，靠近时淡出）。
   按 M.propCollisionCells 逐格检查，而不是只看原点。 */
ok('实体家具不可站立', vm.runInContext('DECOR.filter(p => !p.ground).every(p => M.propCollisionCells(p).every(c => !canStand(M.cx(c[0]), M.cy(c[1]), 7)))', ctx));
/* 贴花（ground）不产生碰撞格，所以踩得过去——哪怕它压在箱子或家具底下
   （美术上被家具盖住完全正常，不该要求贴花所在格一定站得下人）。 */
ok('地面贴花不产生碰撞格', vm.runInContext('DECOR.filter(p => p.ground).every(p => M.propCollisionCells(p).length === 0)', ctx));
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
/* 弹药简称是"口径·等级"（如 5.56·3），6 个字符但半角，实际宽度和四个汉字相当 */
ok('简称不超过 4 个字（弹药为口径·等级）',
   ITEMS.filter(i => i.short).every(i => i.short.length <= 4 || i.cat === 'ammo'),
   ITEMS.filter(i => i.short && i.short.length > 4 && i.cat !== 'ammo').map(i => i.short).join(',') || '全部合规');

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
   Game.searchTime({ r: 1 }) === 0.45 && Game.searchTime({ r: 6 }) === 3.0,
   'r1=' + Game.searchTime({ r: 1 }) + 's r6=' + Game.searchTime({ r: 6 }) + 's');

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

/* 玩家护甲：爆头倍率先并进伤害，再按"弹药穿透等级 vs 护甲等级"结算；
   耐久只掉"挡下来的那部分"，穿透干净的一发不磨甲。 */
const freshHelmet = () => GEAR.make('helmet', 4);   // Lv4 / 65
PE.helmet = freshHelmet(); PE.body = null; PE.hp = 100;
PE.hurt(20, 'head', 3);        // Lv3 弹打 Lv4 盔：矩阵留 60%
ok('爆头 ×1.5 后再按穿透结算',
   Math.abs(PE.hp - (100 - 30 * 0.6)) < 1e-6, PE.hp.toFixed(2));
ok('头盔耐久按挡下的伤害扣',
   Math.abs(PE.helmet.dur - (65 - 30 * 0.4 * CFG.AMMO.DURABILITY_FACTOR)) < 1e-6,
   PE.helmet.dur.toFixed(2) + '/65');

/* 穿透干净（同级弹打同级甲留 80%，那 Lv5 弹打 Lv4 甲是 100%）→ 不掉耐久 */
PE.helmet.dur = 65; PE.hp = 100;
PE.hurt(20, 'head', 5);
ok('完全穿透时护甲不掉耐久',
   Math.abs(PE.hp - 70) < 1e-6 && PE.helmet.dur === 65, PE.helmet.dur + '/65');

/* 击毁溢出：耐久不够挡，按剩余耐久折算，护甲被击穿但仍提供部分防护 */
PE.helmet.dur = 3; PE.hp = 100;
PE.hurt(20, 'head', 1);        // Lv1 打 Lv4：留 25%，理论耗甲 30*0.75*0.5 = 11.25
const expectHp = 100 - (30 - 30 * 0.75 * (3 / (30 * 0.75 * CFG.AMMO.DURABILITY_FACTOR)));
ok('护甲被打穿时仍挡住一部分',
   Math.abs(PE.hp - expectHp) < 1e-6, PE.hp.toFixed(2));
ok('这一击把耐久打空', PE.helmet.dur === 0, PE.helmet.dur + '');

/* 失效：没有防护 */
PE.hp = 100;
PE.hurt(20, 'head', 1);
ok('护甲失效后吃满伤害', Math.abs(PE.hp - 70) < 1e-6, PE.hp.toFixed(2));

/* 身体命中只吃身体护甲，头盔耐久不变 */
PE.helmet = freshHelmet();
PE.body = GEAR.make('body', 5);   // Lv5 / 150
PE.hp = 100;
const hdBefore = PE.helmet.dur;
PE.hurt(20, 'body', 3);           // Lv3 打 Lv5：留 40%
ok('身体命中按身体护甲穿透', Math.abs(PE.hp - (100 - 8)) < 1e-6, PE.hp.toFixed(2));
ok('身体命中不动头盔耐久', PE.helmet.dur === hdBefore);
ok('身体命中扣身体护甲耐久',
   Math.abs(PE.body.dur - (150 - 12 * CFG.AMMO.DURABILITY_FACTOR)) < 1e-6,
   PE.body.dur.toFixed(2) + '/150');

/* 移速 / 负重 / 存档 */
PE.body = GEAR.make('body', 6);
ok('六级甲不再直接减速，改为瞄准时间 +60%', PE.armorMove===1 && PE.body.aimPenaltyPct===60);
ok('护甲重量计入总负重', PE.totalWeight >= 13, PE.totalWeight.toFixed(1) + 'kg');
PE.helmet = GEAR.make('helmet', 3);
PE.hurt(20, 'head', 2);
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
Save.codex = {}; Save.stash = []; Save.credits = 100000;
Save.bag = [];
Save.runs = 0;
Game.player = null;
noThrow('Base.open()', () => Base.open());
ok('状态切到 base', Game.state === 'base');

// 入库与分条：只有子弹会并成一条，其它物品一件一条
Save.addStash('antiq03', 1);
Save.addStash('antiq03', 2);
Save.normalizeStash();
ok('同类不合并，一件一条', Save.stash.length === 3 && Save.stash.every(e => e.n === 1),
   JSON.stringify(Save.stash));
Save.stash = [];
Save.addStash('ammo_556_1', 90);
Save.addStash('ammo_556_1', 60);
ok('仓库弹药按每格上限分堆', Save.stash.length === 3 && Save.stashCount('ammo_556_1') === 150 && Save.stash.every(e=>e.n<=60),
   JSON.stringify(Save.stash));

// 出售
const credA = Save.credits;
const coin = ITEMS.find(i => i.id === 'antiq03');
Save.stash = [];
Save.addStash('antiq03', 3);
for (const e of Save.stash.slice()) Base.sell(e, e.n || 1);
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

// 背包制：带什么完全由包里的东西决定，出发不花钱
Save.stash = []; Save.credits = 100000;
Save.bag = [];
Save.addBag('ammo_556_1', 30);
Save.addBag('ammo_9mm_1', 20);
Save.addBag('ammo_12g_1', 10);
Save.addBag('heal01', 3);
Save.normalizeBag();
/* 子弹并成一条，绷带一件一格 */
ok('背包条目各自成条', Save.bag.length === 6, Save.bag.length + ' 条');
ok('背包里只有子弹是叠着的', Save.bag.filter(e => e.n > 1).length === 3 && Save.bag.filter(e => e.id === 'heal01').length === 3);
ok('背包能数出某弹种', Save.bagCount('ammo_556_1') === 30);
ok('背包算得出负重', Save.bagWeight() > 0, Save.bagWeight().toFixed(2) + ' kg');

const c1 = Save.credits;
Base.deploy();
ok('出发不扣信用点', Save.credits === c1, c1 + ' → ' + Save.credits);
ok('出发后背包清空（东西都带进图了）', Save.bag.length === 0);
ok('出发进入对局', Game.state === 'playing');
ok('弹药按背包带入', Game.player.bag.hasAmmo() === 60,
   '备弹 ' + Game.player.bag.hasAmmo());
ok('按口径分开记', Game.player.bag.ammoCountByCaliber('556') === 30
   && Game.player.bag.ammoCountByCaliber('9mm') === 20
   && Game.player.bag.ammoCountByCaliber('12g') === 10);

// 背包空了、钱也见底，照样能出发（出图不收费，不能把人卡死）
Game.state = 'base';
Save.credits = 0;
Save.bag = [];
Save.stash = [];
noThrow('空背包空钱包也能出发', () => Base.deploy());
ok('空背包确实进图', Game.state === 'playing');

// 结算入库：死亡只带回安全箱
Save.stash = []; Save.credits = 0;
Save.bag = [];
Game.startRun();
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
Game.startRun();
Game.player.hurt(999);
ok('死亡先播放动画', Game.state === 'dying');
for (let i = 0; i < 60; i++) Game.update(1 / 60);
ok('死亡后进入结算', Game.state === 'ended');
const btn = ctx.document.getElementById('btnAgain');
ok('结算按钮已绑定', typeof btn.onclick === 'function');
noThrow('点「回藏身处」', () => btn.onclick());
ok('回到藏身处', Game.state === 'base');

console.log('\n=== 藏身处配装 ===');
Save.stash = []; Save.credits = 100000;
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
Save.credits = 100000;

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

console.log('\n=== 武器位与军火商 ===');

// 武器位和护甲一样走"仓库挑选"，而且是真物品（带余弹）
Save.stash = []; Save.credits = 200000;
Save.gear.weapons = [EQUIP.gun('rifle', 18), null, EQUIP.gun('pistol', 7)];
ok('武器位存的是物品而不是 id',
  typeof Save.gear.weapons[0] === 'object' && Save.gear.weapons[0].equip.gun === 'rifle');
ok('余弹跟着枪存下来', Save.gear.weapons[0].equip.mag === 18);
ok('副武器默认有枪', !!Save.gear.weapons[SIDEARM_SLOT]);

Base.open();
Base.togglePicker('w0', null);
ok('点主武器槽能开列表', Base.picker === 'w0');
ok('空仓库时列表是空的', Base.stashEquip('w0').length === 0);

// 军火商：全新的枪，满弹匣
Base.tab = 'gun';
noThrow('军火商页渲染', () => Base.render());
const cGun = Save.credits;
Base.buyGun('smg');
ok('军火商能买到枪', Save.stash.filter(e => e.gear).length === 1);
const smgEntry = Save.stash.find(e => e.gear);
ok('买来的枪是满弹匣', smgEntry.gear.equip.mag === WEAPONS.smg.mag,
  smgEntry.gear.equip.mag + ' / ' + WEAPONS.smg.mag);
ok('买枪扣钱', Save.credits === cGun - WEAPONS.smg.price, cGun + ' → ' + Save.credits);
ok('枪的买价和回收价对得上',
  smgEntry.gear.sell === Math.floor(WEAPONS.smg.price * 0.5), '¥' + smgEntry.gear.sell);

// 类型要匹配：副武器位不列主武器
Save.addGearStash(EQUIP.gun('pistol', 9));
ok('主武器位只列主武器',
  Base.stashEquip('w0').every(e => WEAPONS[e.gear.equip.gun].slot === 'primary'));
ok('副武器位只列副武器',
  Base.stashEquip('w2').every(e => WEAPONS[e.gear.equip.gun].slot === 'secondary'));

// 换上主武器：仓库那件拿出来，身上那件回仓库
Base.togglePicker('w0', null);
const rifleBefore = Save.gear.weapons[0];
Base.equipFromStash(smgEntry, 'w0');
ok('换上仓库里的冲锋枪', Save.gear.weapons[0].equip.gun === 'smg');
ok('换下来的步枪回仓库（余弹也在）',
  Save.stash.some(e => e.gear && e.gear.equip.gun === 'rifle' && e.gear.equip.mag === 18));
ok('原先那把不在身上了', Save.gear.weapons[0] !== rifleBefore);

// 卸下主武器：回仓库，不再是"只能换不能卸"
Save.addGearStash(EQUIP.gun('shotgun', 6));
const shotgunEntry = Save.stash.find(e => e.gear && e.gear.equip.gun === 'shotgun');
Base.togglePicker('w1', null);
Base.equipFromStash(shotgunEntry, 'w1');
ok('第二个主武器位也能装', Save.gear.weapons[1].equip.gun === 'shotgun',
  Save.gear.weapons[1] ? Save.gear.weapons[1].equip.gun : '空');
Base.unequip('w1');
ok('主武器能卸下', Save.gear.weapons[1] === null);
ok('卸下的枪回仓库', Save.stash.some(e => e.gear && e.gear.equip.gun === 'shotgun'));

// 副武器现在允许卸下，死亡后也不补发
const sideBefore = Save.gear.weapons[SIDEARM_SLOT];
Base.unequip('w2');
ok('副武器可卸下且回到仓库', Save.gear.weapons[SIDEARM_SLOT] === null && Save.stash.some(e=>e.gear===sideBefore));
ok('副武器提供卸下入口', Base.canUnequip('w2') === true);
ok('主武器/护甲可以卸', Base.canUnequip('w0') && Base.canUnequip('helmet'));

Save.gear.weapons[SIDEARM_SLOT] = null;
Base.ensureSidearm();
ok('副武器空着不会自动补发', Save.gear.weapons[SIDEARM_SLOT] === null);

// 余弹一路带进带出
Save.gear.weapons = [EQUIP.gun('rifle', 18), null, EQUIP.gun('pistol', 3)];
Game.startRun({ ammo: 0, bandage: 0, stone: 0 });
const PW = Game.player;
ok('进局按存档的余弹装弹',
  PW.weapons[0].magCur === 18 && PW.weapons[2].magCur === 3,
  PW.weapons.map(w => (w ? w.magCur : '空')).join('/'));
ok('进局默认拿主武器', PW.slot === 0);
PW.mag = 5;
PW.switchWeapon(2);
ok('切枪读那把自己记着的余弹', PW.mag === 3);
Game.syncGear();
ok('未打空的枪余弹写回存档',
  Save.gear.weapons[0].equip.mag === 5 && Save.gear.weapons[2].equip.mag === 3,
  Save.gear.weapons.map(w => (w ? w.equip.mag : '空')).join('/'));

// 老存档：['rifle','shotgun','pistol'] 这种只有 id 的格式要能迁移
const migrated = Save.migrateWeapons(['smg', null, 'pistol']);
ok('老存档的 id 能迁成物品', migrated[0] && migrated[0].equip.gun === 'smg');
ok('老存档迁移后弹匣是满的', migrated[0].equip.mag === WEAPONS.smg.mag);
ok('迁移保留已有副武器', migrated[2].equip.gun === 'pistol');

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
const animator = new ctx.Player(M.cx(7), M.cy(4));
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
animator.fillWeapons([EQUIP.gun('rifle',10),null,null]);
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

console.log('\n=== 音效 ===');
/* 把 Game.sfx 换成记录器：node 里本来就没有 AudioContext，
   这样既不会真发声，又能断言"什么时候该响什么" */
const sfxLog = [];
Game.sfx = (name, opts) => { sfxLog.push({ name, opts }); };

ok('四把枪都有独立参数', ['rifle', 'shotgun', 'smg', 'pistol']
  .every(id => ctx.SFX.GUN[id] && ctx.SFX.GUN[id].body && ctx.SFX.GUN[id].sub));
ok('枪声参数各不相同', new Set(['rifle', 'shotgun', 'smg', 'pistol']
  .map(id => JSON.stringify(ctx.SFX.GUN[id]))).size === 4);
ok('响度表覆盖每条合成音', ['shot', 'enemyShot', 'melee', 'hit', 'headshot', 'break',
  'reload', 'switch', 'step', 'dodge', 'pickup', 'door', 'search', 'drop', 'hurt',
  'extract', 'death'].every(k => typeof ctx.SFX.LOUD[k] === 'number'));

/* ---- 开火：每把枪带上自己的 id ---- */
const gunner = new ctx.Player(M.cx(7), M.cy(4));
for (const id of ['rifle', 'shotgun', 'smg', 'pistol']) {
  gunner.fillWeapons([EQUIP.gun(id, 5), null, null]);
  gunner.fireCd = 0; gunner.reloadT = 0; gunner.fireCd = 0;
  sfxLog.length = 0;
  gunner.tryShoot();
  const call = sfxLog.find(c => c.name === 'shot');
  ok('开火带枪型：' + id, !!call && call.opts && call.opts.gun === id);
}

/* ---- 脚步：同样的时间，越快步子越密 ---- */
const stepCount = (speedInput, seconds, sprint) => {
  const w = new ctx.Player(M.cx(7), M.cy(4));
  const x0 = w.x, y0 = w.y;
  sfxLog.length = 0;
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    w.update(1 / 60, { ...inpStill, ...speedInput, sprint: !!sprint });
    w.x = x0; w.y = y0;          // 原地循环，别撞墙
  }
  return sfxLog.filter(c => /^step_stone_/.test(c.name)).length;
};
const walkSteps = stepCount({ mx: 1, my: 0 }, 3);
const runSteps = stepCount({ mx: 1, my: 0 }, 3, true);
const sneakSteps = stepCount({ mx: 1, my: 0, sneak: true }, 3);
ok('走路 3 秒约 6 步（每步 60px）', walkSteps >= 5 && walkSteps <= 7, walkSteps + ' 步');
ok('冲刺比走路密', runSteps > walkSteps, runSteps + ' vs ' + walkSteps);
ok('潜行比走路稀', sneakSteps < walkSteps, sneakSteps + ' vs ' + walkSteps);

/* 脚步音量跟速度挂钩：冲刺那一步更沉 */
const volOf = log => (log.find(c => /^step_stone_/.test(c.name)) || {}).opts?.vol;
const walkVol = (() => { const w = new ctx.Player(M.cx(7), M.cy(4)); const x0 = w.x, y0 = w.y;
  sfxLog.length = 0;
  for (let i = 0; i < 120; i++) { w.update(1 / 60, { ...inpStill, mx: 1, my: 0 }); w.x = x0; w.y = y0; }
  return volOf(sfxLog); })();
const runVol = (() => { const w = new ctx.Player(M.cx(7), M.cy(4)); const x0 = w.x, y0 = w.y;
  sfxLog.length = 0;
  for (let i = 0; i < 120; i++) { w.update(1 / 60, { ...inpStill, mx: 1, my: 0, sprint: true }); w.x = x0; w.y = y0; }
  return volOf(sfxLog); })();
ok('冲刺脚步比走路脚步响', runVol > walkVol, walkVol + ' → ' + runVol);

/* ---- 闪避：起步一声破风，收尾一下落步 ---- */
const dodger = new ctx.Player(M.cx(7), M.cy(4));
sfxLog.length = 0;
dodger.update(1 / 60, { ...inpStill, dodge: true });
ok('闪避触发破风声', sfxLog.some(c => c.name === 'dodge'));
for (let i = 0; i < 20; i++) dodger.update(1 / 60, inpStill);
ok('闪避收尾有落步声', sfxLog.some(c => /^step_stone_/.test(c.name)));

/* ---- 切枪：枪⇄刀两个方向都要有声 ---- */
const swapper = new ctx.Player(M.cx(7), M.cy(4));
swapper.fillWeapons([EQUIP.gun('rifle', 5), null, null]);
swapper.melee = ctx.MeleeSystem.normalize(EQUIP.melee('melee01'));
sfxLog.length = 0;
swapper.switchMelee();
ok('枪 → 刀有声', sfxLog.some(c => c.name === 'shot_switch'));
sfxLog.length = 0;
swapper.switchWeapon(0);
ok('刀 → 枪有声', sfxLog.filter(c => c.name === 'shot_switch').length === 1);

/* 切枪音按枪型走：霰弹枪是泵动上膛，其余沿用通用滑套 */
const sw2 = new ctx.Player(M.cx(7), M.cy(4));
sw2.fillWeapons([EQUIP.gun('rifle', 5), EQUIP.gun('shotgun', 6), null]);
sfxLog.length = 0;
sw2.switchWeapon(1);
ok('霰弹枪切枪走专属泵动音', sfxLog.some(c => c.name === 'shot_switch_shotgun'),
  sfxLog.map(c => c.name).join(','));
sfxLog.length = 0;
sw2.switchWeapon(0);
ok('步枪切枪仍走通用滑套音', sfxLog.some(c => c.name === 'shot_switch'),
  sfxLog.map(c => c.name).join(','));

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

console.log('\n=== 开发者靶场 ===');
Range.start();
ok('靶场地图尺寸正确', M.W === RANGE_MAP.width && M.H === RANGE_MAP.height, M.W + '×' + M.H);
ok('玩家在射击线上出生', Math.abs(Game.player.x - RANGE_GEO.spawn.x) < 1 && Math.abs(Game.player.y - RANGE_GEO.spawn.y) < 1,
  Game.player.x + ',' + Game.player.y);
ok('靶场里没有敌人', Game.enemies.length === 0);
ok('钢板靶已生成', Game.targets.length === 7, String(Game.targets.length));
ok('靶场模式不计时', (() => { Game.time = 9999; Game.updateTide(); return Game.state === 'playing'; })(), Game.state);

/* 击发延迟：扣扳机后先不出弹，延迟到点才出膛 */
const P0 = Game.player;
P0.weapons[P0.slot].windup = 0.12;
P0.fireCd = 0; P0.windupShot = false; P0.mag = P0.weapon.mag;
const b0 = Game.bullets.length;
ok('击发延迟：扣扳机当帧不出弹', P0.tryShoot() === false && Game.bullets.length === b0);
noThrow('击发延迟：延迟到点才出膛', () => {
  for (let i = 0; i < 12; i++) P0.update(1 / 60, { mx: 0, my: 0, aimAngle: 0 });
});
ok('击发延迟：延迟后子弹已发射', Game.bullets.length > b0, String(Game.bullets.length - b0));

/* 调参即时生效：射速 / 后坐力 / 回正 */
Range.equip('rifle');
Range.setDisp(RANGE_PARAMS.find(p => p.key === 'rpm'), 900);
Range.setDisp(RANGE_PARAMS.find(p => p.key === 'recoilPerShot'), 0.2);
Range.setDisp(RANGE_PARAMS.find(p => p.key === 'decay'), 1.5);
Range.apply();
ok('调参写进当前武器', Math.abs(Game.player.weapon.rpm - 900) < 1e-6 && Math.abs(Game.player.weapon.recoilPerShot - 0.2) < 1e-6,
  Game.player.weapon.rpm + ' / ' + Game.player.weapon.recoilPerShot);
ok('调参写进后坐力配置', Math.abs(CFG.RECOIL.decay - 1.5) < 1e-6, String(CFG.RECOIL.decay));
Game.player.fireCd = 0; Game.player.windupShot = false; Game.player.mag = Game.player.weapon.mag;
Game.player.tryShoot();
ok('射速参与开火冷却', Math.abs(Game.player.fireCd - 60 / 900) < 1e-6, String(Game.player.fireCd));

/* 面板按钮与重置 */
Range.clearMarks();
ok('清弹孔后统计为空', Range.groupStats() === null);
Range.onClick({ target: { dataset: { act: 'reset' } } });
ok('重置本枪回到默认射速', Math.abs(Game.player.weapon.rpm - WEAPONS.rifle.rpm) < 1e-6, String(Game.player.weapon.rpm));

/* 换枪：四把枪都能在靶场里上膛 */
for (const id of ['shotgun', 'smg', 'pistol', 'rifle']) {
  noThrow('靶场换枪 ' + id, () => Range.equip(id));
  ok('靶场当前枪是 ' + id, Game.player.weapon.id === id, Game.player.weapon.id);
}

/* 弹孔与散布统计 */
Range.clearMarks();
Range.hole(800, 270); Range.hole(802, 274); Range.hole(798, 268);
const gs = Range.groupStats();
ok('弹孔统计数量正确', gs && gs.n === 3, String(gs && gs.n));
ok('弹孔统计给出极值散布', gs && gs.es > 0, gs && gs.es.toFixed(2));

/* 导出只包含差异 */
Range.setDisp(RANGE_PARAMS.find(p => p.key === 'rpm'), 600);
Range.apply();
const exp = Range.exportJson();
ok('导出 JSON 只列改动项',
   !!exp.weapons && !!exp.weapons.rifle && exp.weapons.rifle.rpm === 600 &&
   !exp.weapons.smg,
   JSON.stringify(exp.weapons));
ok('导出结构能被写回脚本识别', exp.version === 1 && !('weaponDiff' in exp),
   Object.keys(exp).join(','));

/* 退出后还原后坐力配置 */
Range.exit();
ok('退出靶场还原后坐力配置', Math.abs(CFG.RECOIL.decay - RANGE_DEF_G.decay) < 1e-9, String(CFG.RECOIL.decay));
ok('退出靶场清空靶子', (Game.targets || []).length === 0);

/* ============================================================
   双轴后坐力（V1.1 验收 1~10）
   ============================================================ */
console.log('\n=== 双轴后坐力 ===');
{
  Game.startRun();
  const PR = Game.player;
  const AX = CFG.RECOIL.axis;
  PR.x = M.cx(23); PR.y = M.cy(13);
  /* 存档可能一件武器都没有（startRun 会默认切刀），先插一把步枪再测 */
  PR.weapons[0] = Range.makeWeapon('rifle');
  PR.slot = 0;
  PR.mag = PR.weapons[0].mag;
  PR.meleeActive = false;

  /* 瞄准 helper：把鼠标放到玩家周围某个方向 200px 处 */
  const aimAt = (ang, dist) => {
    dist = dist || 200;
    PR.rH = 0; PR.rV = 0;
    PR.updateAimPoint(PR.x + Math.cos(ang) * dist, PR.y + Math.sin(ang) * dist);
  };
  const M0 = () => ({ x: PR.aimPoint.x, y: PR.aimPoint.y });

  /* 1~4：垂直分量沿瞄准方向把准星推远（四个方向各验一次） */
  const dirCase = (ang, name, chk) => {
    aimAt(ang);
    const a = M0();
    PR.rV = 20;
    PR.updateAimPoint(PR.aimMouse.x, PR.aimMouse.y);
    const d = { x: PR.aimPoint.x - a.x, y: PR.aimPoint.y - a.y };
    ok(name, chk(d), 'Δ(' + d.x.toFixed(2) + ', ' + d.y.toFixed(2) + ')');
  };
  dirCase(0, '验收1 向右瞄准：准星被推向右', d => d.x > 19.9 && Math.abs(d.y) < 1e-6);
  dirCase(Math.PI, '验收2 向左瞄准：准星被推向左', d => d.x < -19.9 && Math.abs(d.y) < 1e-6);
  dirCase(-Math.PI / 2, '验收3 向上瞄准：准星被推向上', d => d.y < -19.9 && Math.abs(d.x) < 1e-6);
  dirCase(Math.PI / 2, '验收4 向下瞄准：准星被推向下', d => d.y > 19.9 && Math.abs(d.x) < 1e-6);

  /* 5：水平分量严格沿瞄准连线的垂线，且沿 D 方向没有分量 */
  {
    const ang = 0.7;
    aimAt(ang);
    const a = M0();
    PR.rH = 12;
    PR.updateAimPoint(PR.aimMouse.x, PR.aimMouse.y);
    const d = { x: PR.aimPoint.x - a.x, y: PR.aimPoint.y - a.y };
    const D = { x: Math.cos(ang), y: Math.sin(ang) };
    const N = { x: -D.y, y: D.x };
    const alongD = d.x * D.x + d.y * D.y;
    const alongN = d.x * N.x + d.y * N.y;
    ok('验收5 水平后坐力沿垂线偏移（无沿瞄准线分量）',
       Math.abs(alongD) < 1e-6 && Math.abs(alongN - 12) < 1e-6,
       'D 分量 ' + alongD.toFixed(9) + ' / N 分量 ' + alongN.toFixed(6));
  }

  /* 6：两个分量同时存在、分别累计、分别恢复 */
  {
    aimAt(0);
    PR.rH = 0; PR.rV = 0; PR.fireCd = 0; PR.mag = 30;
    const fire = n => {
      for (let i = 0; i < n; i++) {
        PR.fireCd = 0; PR.reloadT = 0; PR.windupShot = false; PR.mag = 30;
        PR._fireNow();
      }
    };
    fire(1);
    ok('验收6 单发后两个轴同时有量', PR.rH !== 0 && PR.rV > 0,
       'H ' + PR.rH.toFixed(2) + ' / V ' + PR.rV.toFixed(2));
    const v1 = PR.rV;
    fire(2);
    ok('验收6 连射让垂直分量继续累加', PR.rV > v1 + 1e-6,
       v1.toFixed(2) + ' → ' + PR.rV.toFixed(2));
    ok('验收6 水平单发落在 kick±rand 之间',
       Math.abs(PR.rH) > 0 && Math.abs(PR.rH) <= AX.h.max + 1e-9,
       String(PR.rH.toFixed(2)));
    /* 打满：两轴都必须封顶，不能无限长 */
    fire(300);
    ok('验收6 垂直分量封顶在上限', Math.abs(PR.rV - AX.v.max) < 1e-6, String(PR.rV.toFixed(2)));
    ok('验收6 水平分量夹在 ±上限 内', Math.abs(PR.rH) <= AX.h.max + 1e-9, String(PR.rH.toFixed(2)));

    /* 恢复：停火后两轴都往 0 走，而且互不影响 */
    const h0 = PR.rH, v0 = PR.rV;
    PR.sinceShot = 99;
    for (let i = 0; i < 30; i++) PR.update(1 / 60, { mx: 0, my: 0, aimAngle: 0 });
    ok('验收6 停火后两个轴都在恢复',
       Math.abs(PR.rH) < Math.abs(h0) && PR.rV < v0,
       'H ' + h0.toFixed(2) + '→' + PR.rH.toFixed(2) + ' / V ' + v0.toFixed(2) + '→' + PR.rV.toFixed(2));
  }

  /* 7：停火后准星回到鼠标点 */
  {
    const mx0 = PR.x + 200, my0 = PR.y;
    PR.rH = 9; PR.rV = 18; PR.sinceShot = 99;
    for (let i = 0; i < 240; i++) {
      PR.update(1 / 60, { mx: 0, my: 0, aimAngle: 0, aimX: mx0, aimY: my0 });
    }
    ok('验收7 停火后准星回到鼠标瞄准点',
       Math.abs(PR.aimPoint.x - mx0) < 0.2 && Math.abs(PR.aimPoint.y - my0) < 0.2,
       'R(' + PR.aimPoint.x.toFixed(2) + ', ' + PR.aimPoint.y.toFixed(2) + ') vs M(' + mx0 + ', ' + my0 + ')');
  }

  /* 8：不影响原有鼠标操作、弹药、射速与散布 */
  {
    aimAt(0.9);
    ok('验收8 位移为 0 时弹道方向等于鼠标方向',
       Math.abs(PR.shootAngle - 0.9) < 1e-6, PR.shootAngle.toFixed(8));
    const rpm0 = PR.weapon.rpm, spread0 = PR.spread;
    PR.mag = 30; PR.fireCd = 0; PR.reloadT = 0; PR.windupShot = false;
    const before = PR.mag;
    PR._fireNow();
    ok('验收8 开火仍然只扣一发', PR.mag === before - 1, before + ' → ' + PR.mag);
    ok('验收8 开火冷却仍按射速计算', Math.abs(PR.fireCd - 60 / rpm0) < 1e-9,
       PR.fireCd.toFixed(4) + ' vs ' + (60 / rpm0).toFixed(4));
    ok('验收8 散布仍由 recoil 驱动', PR.spread > 0 && PR.spread !== spread0 || PR.recoil === 0,
       'spread ' + PR.spread.toFixed(4));
  }

  /* 9：帧率无关 —— 同样 1 秒，不同 dt 的恢复结果必须一致 */
  {
    const saveDH = AX.h.decayDelay, saveDV = AX.v.decayDelay;
    AX.h.decayDelay = 0; AX.v.decayDelay = 0;   // 去掉延迟，单看指数衰减本身
    const run = (steps, dt) => {
      PR.rH = 10; PR.rV = 10; PR.sinceShot = 999;
      for (let i = 0; i < steps; i++) PR.update(dt, { mx: 0, my: 0, aimAngle: 0 });
      return { h: PR.rH, v: PR.rV };
    };
    const at60 = run(60, 1 / 60), at240 = run(240, 1 / 240), at30 = run(30, 1 / 30);
    AX.h.decayDelay = saveDH; AX.v.decayDelay = saveDV;
    const dh = Math.max(Math.abs(at60.h - at240.h), Math.abs(at60.h - at30.h));
    const dv = Math.max(Math.abs(at60.v - at240.v), Math.abs(at60.v - at30.v));
    ok('验收9 恢复过程与帧率无关', dh < 1e-3 && dv < 1e-3,
       'H 差 ' + dh.toExponential(1) + ' / V 差 ' + dv.toExponential(1) +
       '  (60Hz ' + at60.v.toFixed(4) + ' / 240Hz ' + at240.v.toFixed(4) + ' / 30Hz ' + at30.v.toFixed(4) + ')');
  }

  /* 10：垂直位移不改弹道 —— 只推远不偏角 */
  {
    aimAt(0.4);
    const a0 = PR.shootAngle;
    PR.rV = AX.v.max; PR.rH = 0;
    PR.updateAimPoint(PR.aimMouse.x, PR.aimMouse.y);
    const moved = Math.abs(PR.aimPoint.x - PR.aimMouse.x) + Math.abs(PR.aimPoint.y - PR.aimMouse.y);
    ok('验收10 垂直后坐力推远了准星', moved > AX.v.max * 0.9, '位移 ' + moved.toFixed(2) + 'px');
    ok('验收10 但弹道角度完全不变', Math.abs(PR.shootAngle - a0) < 1e-9,
       a0.toFixed(9) + ' → ' + PR.shootAngle.toFixed(9));
  }

  /* 水平位移才真正改弹道：同距离下偏离应约为 atan(H / 距离) */
  {
    const dist = 200;
    aimAt(0, dist);
    const a0 = PR.shootAngle;
    PR.rH = AX.h.max; PR.rV = 0;
    PR.updateAimPoint(PR.aimMouse.x, PR.aimMouse.y);
    const want = Math.atan2(AX.h.max, dist);
    ok('水平位移确实改变弹道角度',
       Math.abs((PR.shootAngle - a0) - want) < 1e-6,
       '实际 ' + ((PR.shootAngle - a0) * 180 / Math.PI).toFixed(3) + '° / 理论 ' +
       (want * 180 / Math.PI).toFixed(3) + '°');
  }

  /* 压枪：鼠标往玩家身上拉、甚至拉过头，准星不能甩到身后 */
  {
    aimAt(0, 200);
    PR.rV = AX.v.max; PR.rH = 0;
    PR.updateAimPoint(PR.aimMouse.x, PR.aimMouse.y);

    let prev = null, maxJump = 0, crossed = false, minDist = 1e9;
    /* 从玩家右侧 40px 一路拉到左侧 10px：压枪最容易踩到的那一段 */
    for (let dx = 40; dx >= -10; dx -= 1) {
      PR.updateAimPoint(PR.x + dx, PR.y);
      const R = PR.aimPoint;
      if (prev) maxJump = Math.max(maxJump, Math.hypot(R.x - prev.x, R.y - prev.y));
      prev = { x: R.x, y: R.y };
      if (R.x < PR.x) crossed = true;
      minDist = Math.min(minDist, Math.hypot(R.x - PR.x, R.y - PR.y));
    }
    ok('压枪拉过玩家时准星不翻到身后', !crossed,
       '最后停在玩家右侧 ' + (PR.aimPoint.x - PR.x).toFixed(1) + 'px');
    ok('准星逐像素移动时保持连续（无瞬移）', maxJump < 3.5,
       '单步最大跳变 ' + maxJump.toFixed(2) + 'px');
    ok('准星与玩家保持最小距离', minDist >= (AX.keep || 18) - 1e-6,
       '最近 ' + minDist.toFixed(2) + 'px / 下限 ' + (AX.keep || 18));
    /* 鼠标确实移到另一侧足够远时才应该转身 */
    PR.updateAimPoint(PR.x - 60, PR.y);
    ok('明确移到另一侧后才转身', PR.aimPoint.x < PR.x,
       'R 在玩家左侧 ' + (PR.x - PR.aimPoint.x).toFixed(1) + 'px');
  }

  /* 鼠标贴着玩家时朝向锁定，不会因为手抖/拉过头翻 180° */
  {
    PR.angle = 1.0;
    PR.update(1 / 60, { mx: 0, my: 0, aimAngle: Math.PI, aimX: PR.x + 6, aimY: PR.y });
    ok('鼠标在死区内不改朝向', Math.abs(PR.angle - 1.0) < 1e-9, PR.angle.toFixed(4));
    PR.update(1 / 60, { mx: 0, my: 0, aimAngle: Math.PI, aimX: PR.x + 60, aimY: PR.y });
    ok('鼠标离开死区才改朝向', Math.abs(PR.angle - Math.PI) < 1e-9, PR.angle.toFixed(4));
  }
}

console.log('\n---------------------------------------');
console.log('  通过 ' + pass + ' / 失败 ' + fail);
console.log('---------------------------------------\n');
process.exit(fail > 0 ? 1 : 0);
