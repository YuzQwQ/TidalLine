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
    style: { setProperty(name, value) { this[name] = value; } },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    innerHTML: '', textContent: '', title: '',
    appendChild() {},
    querySelector() { const child = makeEl('query'); child.parentElement = this; return child; },
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

for (const f of ['config.js', 'combat.js', 'floatfont-data.js', 'floattext.js', 'data.js', 'attachment-data.js', 'attachments.js', 'attachment-migration.js', 'core.js', 'entities.js', 'gunplay.js', 'human-ai.js',
  'common.js', 'medical.js', 'art.js', 'durabar.js', 'slotdots.js', 'debuff.js', 'ui.js', 'save.js', 'base.js', 'base-keychain.js', 'mail.js', 'repair.js',
  'game.js', 'game-update.js', 'game-render.js', 'game-panels.js',
  'medhud.js', 'melee.js', 'range.js', 'buyback-data.js', 'sales.js', 'raid-value.js', 'door-visual.js', 'doors.js', 'sandbox.js', 'loot-spawn-data.js', 'ground-spawns.js', 'boot.js']) {
  try {
    vm.runInContext(fs.readFileSync(path.join(dir, 'js', f), 'utf8'), ctx, { filename: f });
  } catch (e) {
    console.log('  加载失败 ' + f + ': ' + e.message);
    process.exit(1);
  }
}

vm.runInContext(`
  globalThis.CFG = CFG; globalThis.M = M; globalThis.U = U; globalThis.Combat = Combat;
  globalThis.ITEMS = ITEMS; globalThis.Game = Game; globalThis.Save = Save;
  globalThis.Player = Player; globalThis.Enemy = Enemy; globalThis.Noise = Noise;
  globalThis.Quiet = Quiet; globalThis.SFX = SFX; globalThis.MeleeSystem = MeleeSystem;
  globalThis.Base = Base; globalThis.Art = Art; globalThis.ART = ART;
  globalThis.Corpse = Corpse; globalThis.Bullet = Bullet;
  globalThis.GEAR = GEAR; globalThis.WEAPONS = WEAPONS; globalThis.EQUIP = EQUIP; globalThis.HELMETS = HELMETS; globalThis.BODIES = BODIES; globalThis.SIDEARM_SLOT = SIDEARM_SLOT;
  globalThis.AMMO_ITEMS = AMMO_ITEMS; globalThis.Firearms = Firearms;
  globalThis.START_CREDITS = START_CREDITS;
  globalThis.Debuff = Debuff; globalThis.DebuffHud = DebuffHud;
  globalThis.Medical = Medical; globalThis.ITEM_BY_ID = ITEM_BY_ID;
  globalThis.Repair = Repair; globalThis.ARMOR_VARIANTS = ARMOR_VARIANTS;
  globalThis.DuraBar = DuraBar;
  globalThis.SlotDots = SlotDots; globalThis.ATTACHMENT_SLOTS = ATTACHMENT_SLOTS; globalThis.ATTACHMENT_DEFS = ATTACHMENT_DEFS; globalThis.Attachments = Attachments; globalThis.RARITY = RARITY;
  globalThis.MEDICAL_ITEMS = MEDICAL_ITEMS; globalThis.MELEE = MELEE;
  globalThis.ENEMY_TYPES = ENEMY_TYPES; globalThis.BALLISTICS = BALLISTICS;
  globalThis.MedQuick = MedQuick; globalThis.MedWheel = MedWheel;
  globalThis.MedBar = MedBar; globalThis.HealHud = HealHud; globalThis.MedHud = MedHud;
  globalThis.stackLimit = stackLimit; globalThis.isStackable = isStackable;
  globalThis.STASH_FILTERS = STASH_FILTERS; globalThis.stashFilterMatch = stashFilterMatch;
  globalThis.itemGroup = itemGroup; globalThis.itemCategoryLabel = itemCategoryLabel;
  globalThis.Range = Range; globalThis.RANGE_MAP = RANGE_MAP; globalThis.RANGE_GEO = RANGE_GEO;
  globalThis.RANGE_PARAMS = RANGE_PARAMS; globalThis.RANGE_DEF_W = RANGE_DEF_W;
  globalThis.magazineRounds = magazineRounds;
  globalThis.BACKPACK = BACKPACK; globalThis.bagSlots = bagSlots;
  globalThis.DoorSystem = DoorSystem; globalThis.BaseKeychain = BaseKeychain;
  globalThis.Mail = Mail; globalThis.MAIL_BATCHES = MAIL_BATCHES;
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
  Range, RANGE_MAP, RANGE_GEO, RANGE_PARAMS, RANGE_DEF_W, BACKPACK, bagSlots,
  Firearms, Attachments, ATTACHMENT_DEFS } = ctx;

console.log('\n=== 启动 ===');
noThrow('Save.load()', () => Save.load());
noThrow('Game.init()', () => Game.init());
ok('画布拿到 2d 上下文', Game.ctx === ctxMock);
noThrow('Game.startRun()', () => Game.startRun());
ok('玩家已创建', !!Game.player);
ok('敌人数量', Game.enemies.length === vm.runInContext('SPAWNS.length', ctx), Game.enemies.length + ' 个');
ok('容器数量', Game.boxes.filter(b => !b.groundLoot).length === vm.runInContext('MAP_ROWS.join(\'\').split(\'\').filter(ch => BOX_KIND[ch]).length', ctx), Game.boxes.filter(b => !b.groundLoot).length + ' 个（另 ' + Game.boxes.filter(b => b.groundLoot).length + ' 个物资刷新点）');
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
for (let i = 0; i < 150; i++) Game.update(1 / 60);
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
const pile = Game.boxes.find(b => b.pile && !b.groundLoot);
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
   Game.boxes.filter(b => b.pile && !b.groundLoot).length === 1 && pile.items.length === 2);

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

console.log('\n=== 尸体容器反复打开 · 交互滚轮选项 ===');
Game.startRun();
{
  const P = Game.player;
  Game.input.keys = {};
  Game.input.interactPressed = false;
  Game.enemies = [];
  Game.boxes = [];
  Game.corpses = [];
  Game.action = null;
  Game.closeLoot();
  const prize = ITEMS.find(i => i.id === 'life01');
  const cp = { x: P.x, y: P.y, opened: false, searched: false, enemy: null,
               loot: [{ item: prize, n: 1 }] };
  Game.corpses.push(cp);

  /* 同一格再放一扇开着的门：旧逻辑里「关门」会把尸体永久挡住 */
  M.at(M.tx(P.x), M.ty(P.y)).door = { open: true };
  const list = Game.findInteractables();
  ok('门和尸体同时进候选表', list.some(o => o.type === 'door') && list.some(o => o.type === 'corpse'));
  ok('尸体在未搜过时可交互', list.some(o => o.type === 'corpse' && o.obj === cp));

  Game.interactKey = Game.interactKeyOf(list[0]);
  Game.findInteractable();
  ok('默认选中项仍是旧优先级的第一项', Game.interactIndex === 0);
  ok('滚轮往下换一项', Game.scrollInteract(1) === true && Game.interactIndex === 1);
  ok('滚轮往上换回来', Game.scrollInteract(-1) === true && Game.interactIndex === 0);
  ok('滚到表头不循环', Game.scrollInteract(-1) === false && Game.interactIndex === 0);
  Game.interactKey = Game.interactKeyOf(list[list.length - 1]);
  ok('滚到表尾不循环', Game.scrollInteract(1) === false);

  /* 滚轮选到尸体后按 E：门不再抢走这次交互 */
  Game.interactKey = Game.interactKeyOf(list.find(o => o.type === 'corpse'));
  Game.handleInteract();
  ok('有门也能搜到尸体', !!Game.action && Game.action.type === 'corpse' && Game.action.target === cp);
  for (let i = 0; i < 40; i++) Game.update(1 / 60);
  ok('尸体首次搜完打开面板', Game.lootOpen === cp);
  ok('尸体标记为搜过但没摸空', cp.searched === true && cp.opened === false);
  Game.closeLoot();

  const again = Game.findInteractables().find(o => o.type === 'corpse');
  ok('关掉面板后尸体仍可交互', !!again && again.obj === cp);
  Game.interactKey = Game.interactKeyOf(again);
  Game.handleInteract();
  ok('第二次打开不再读条', Game.lootOpen === cp && !Game.action);
  Game.closeLoot();

  /* 尸体的装备格不带 item，剩下枪 / 头甲时也不能被误判成空 */
  cp.items = cp.loot = [{ gun: 'rifle' }];
  ok('只剩枪的尸体仍算有东西', Game.containerHasItems(cp));
  ok('只剩枪仍可交互', Game.findInteractables().some(o => o.type === 'corpse' && o.obj === cp));

  cp.items = cp.loot = [null];
  Game.syncBoxState(cp);
  ok('摸空后 opened 才置真', cp.opened === true);
  ok('摸空后才从候选表消失', !Game.findInteractables().some(o => o.type === 'corpse' && o.obj === cp));
}

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
ok('枪进空的主武器位', PG.weapons[1] && PG.weapons[1].id === 'pp19_01');
ok('尸体上的枪已拿走', corpseA.items[2] === null);
ok('尸体枪只给三成弹匣', PG.weapons[1].magCur === 9, PG.weapons[1].magCur + ' / 30 发');
ok('武器槽写回存档', Save.gear.weapons[1] && Save.gear.weapons[1].equip.gun === 'pp19_01',
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
ok('背包里的枪记住余弹', PG.bag.slots[bi].item.equip.mag === 9);

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

const body5 = EQUIP.armor(GEAR.make('body', 5));              // V1：135 耐久
const body5w = EQUIP.armor(GEAR.make('body', 5, GEAR.def('body', 5).dur / 2));
ok('耐久掉了回收价跟着掉', body5w.sell < body5.sell, body5.sell + ' → ' + body5w.sell);
ok('回收价跟着耐久等比算', body5w.sell === Math.floor(GEAR.def('body', 5).price * 0.5 * 0.5));

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

Game.state = 'base'; // 仓库交易只允许在局外进行。
const coin0 = Save.credits;
const eqEntry = Save.stash.find(e => e.gear);
Base.sell(eqEntry, 1);
ok('仓库出售入口不直接加钱', Save.credits === coin0);
ok('前往出售不扣除装备', Save.stash.filter(e => e.gear).length === 2);
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

/* 带入的东西不算收获：带一把 3000 万的钥匙进去、原样带出来，结算价值必须是 0 */
Game.startRun();
{
  const PY = Game.player, K = ctx.ITEM_BY_ID.door_key_old_apt, ART = ctx.ITEM_BY_ID.art01;
  PY.bag.slots.length = 0; PY.bag.safe.length = 0;
  PY.bag.slots.push({ item: K, n: 1, cap: 9 });
  Game.broughtIn = Game.snapshotBroughtIn();      // 只带了一把剩 9 次的钥匙
  PY.bag.slots.push({ item: ART, n: 1 });         // 局内又捡到一件藏品
  Save.stash = []; Save.bag = []; Save.codex = {}; Save.credits = 0;
  Game.showEnd(true);
  ok('带入的钥匙不计收获价值', Game._end.total === ART.price,
    '结算 ' + Game._end.total + '，期望只剩藏品 ' + ART.price);
  ok('带入的钥匙仍保留在背包', Save.bag.some(e => e.id === K.id));
  ok('新捡到的藏品照常计入', Game._end.lines.some(l => l.it.id === ART.id));
  ok('带入的钥匙不进结算清单', !Game._end.lines.some(l => l.it.id === K.id));
  ok('带出件数只算新捡的', Game._end.keptCount === 1, '件数 ' + Game._end.keptCount);
}
/* 同 id 堆叠（子弹）按数量抵扣：带 30 发、又捡 30 发，只该记 30 发 */
Game.startRun();
{
  const PY = Game.player, A = ctx.ITEMS.find(i => i.cat === 'ammo');
  PY.bag.slots.length = 0; PY.bag.safe.length = 0;
  PY.bag.slots.push({ item: A, n: 30 });
  Game.broughtIn = Game.snapshotBroughtIn();
  PY.bag.slots.push({ item: A, n: 30 });
  Save.stash = []; Save.bag = []; Save.codex = {};
  Game.showEnd(true);
  const line = Game._end.lines.find(l => l.it.id === A.id);
  ok('堆叠子弹只记新捡的那部分', !!line && line.n === 30, line ? '记了 ' + line.n + ' 发' : '没有结算行');
}

/* 钥匙链：6 格只收钥匙，不占背包格 / 负重 / 背包价值，局内只负责开门掉耐久 */
{
  const K = ctx.ITEM_BY_ID.door_key_old_apt, ART = ctx.ITEM_BY_ID.art01;
  ok('钥匙链容量 6 格', ctx.CFG.BAG.CHAIN === 6, 'CFG.BAG.CHAIN=' + ctx.CFG.BAG.CHAIN);

  Save.stash = [];
  Save.chain = [{ id: ART.id, n: 1 }];
  Save.normalizeChain();
  ok('非钥匙挂不上钥匙链', Save.chain.length === 0 && Save.stash.some(e => e.id === ART.id),
    '链 ' + Save.chain.length + ' / 仓库 ' + Save.stash.length);

  Save.stash = [];
  Save.chain = [{ id: K.id, n: 1, cap: 0 }];
  Save.normalizeChain();
  ok('耐久归零的钥匙不进钥匙链', Save.chain.length === 0);

  Save.stash = [];
  Save.chain = Array.from({ length: 8 }, () => ({ id: K.id, n: 1, cap: 10 }));
  Save.normalizeChain();
  ok('超出 6 格的部分退回仓库', Save.chain.length === 6 && Save.stash.length === 2,
    '链 ' + Save.chain.length + ' / 仓库 ' + Save.stash.length);
}
Game.startRun();
{
  const PY = Game.player, K = ctx.ITEM_BY_ID.door_key_old_apt;
  PY.bag.slots.length = 0; PY.bag.safe.length = 0;
  PY.bag.chain = [{ item: K, n: 1, cap: 10 }];
  ok('钥匙链不占背包格', PY.bag.count() === 0);
  ok('钥匙链不计背包负重', PY.bag.weight() === 0, '负重 ' + PY.bag.weight());
  ok('钥匙链不计背包价值', PY.bag.value() === 0, '价值 ' + PY.bag.value());

  const door = { doorType: 'locked', unlocked: false, keyId: K.id, cells: [[1, 1]] };
  ok('钥匙链上的钥匙能开门', ctx.DoorSystem.hasKey(door, PY));
  const before = PY.bag.chain[0].cap;
  const opened = ctx.DoorSystem.prepareOpen(door, PY);
  ok('用钥匙链开门正常扣耐久', opened.ok && PY.bag.chain[0].cap === before - 1,
    '耐久 ' + before + ' → ' + PY.bag.chain[0].cap);

  /* 同款钥匙同时挂在链上和背包里时，先扣链上的 */
  PY.bag.chain = [{ item: K, n: 1, cap: 3 }];
  PY.bag.slots = [{ item: K, n: 1, cap: 9 }];
  const door2 = { doorType: 'locked', unlocked: false, keyId: K.id, cells: [[2, 2]] };
  ctx.DoorSystem.prepareOpen(door2, PY);
  ok('同款钥匙优先扣钥匙链', PY.bag.chain[0].cap === 2 && PY.bag.slots[0].cap === 9,
    '链 ' + PY.bag.chain[0].cap + ' / 包 ' + PY.bag.slots[0].cap);
}
/* 撤离按剩余耐久写回；死亡整条链跟背包一起没了 */
Game.startRun();
{
  const PY = Game.player, K = ctx.ITEM_BY_ID.door_key_old_apt;
  PY.bag.slots.length = 0; PY.bag.safe.length = 0;
  PY.bag.chain = [{ item: K, n: 1, cap: 6 }];
  Save.chain = []; Save.stash = []; Save.bag = []; Save.codex = {};
  Game.showEnd(true);
  ok('撤离后钥匙链按剩余耐久写回', Save.chain.length === 1 && Save.chain[0].id === K.id && Save.chain[0].cap === 6,
    JSON.stringify(Save.chain));
  ok('钥匙链不结算成收获价值', Game._end.total === 0, '结算 ' + Game._end.total);
}
Game.startRun();
{
  const PY = Game.player, K = ctx.ITEM_BY_ID.door_key_old_apt;
  PY.bag.slots.length = 0; PY.bag.safe.length = 0;
  PY.bag.chain = [{ item: K, n: 1, cap: 8 }];
  Save.stash = []; Save.bag = []; Save.codex = {};
  Save.chain = [{ id: K.id, n: 1, cap: 8 }];
  /* 出发不再清空存档里的链条：局内拿到的是副本，刷新还能把钥匙捞回来 */
  ok('出发后存档里的钥匙链仍在', Save.chain.length === 1 && Save.chain[0].cap === 8,
    JSON.stringify(Save.chain));
  const door = { doorType: 'locked', unlocked: false, keyId: K.id, cells: [[2, 2]] };
  ctx.DoorSystem.prepareOpen(door, PY);
  ok('局内开锁把剩余耐久写回存档', Save.chain.length === 1 && Save.chain[0].cap === 7,
    JSON.stringify(Save.chain));
  ok('局内副本自己也扣了耐久', PY.bag.chain[0].cap === 7);
  /* 模拟局内刷新页面：内存清空，只从 localStorage 读回来 */
  Save.chain = []; Save.load();
  ok('刷新后钥匙链与耐久都还在', Save.chain.length === 1 && Save.chain[0].id === K.id && Save.chain[0].cap === 7,
    JSON.stringify(Save.chain));
  Game.showEnd(false, '阵亡');
  ok('死亡后钥匙链原样保留', Save.chain.length === 1 && Save.chain[0].id === K.id && Save.chain[0].cap === 7,
    JSON.stringify(Save.chain));
  ok('死亡后钥匙链不被打散进仓库', !Save.stash.some(e => e.id === K.id));
  /* 靶场 / 门测试没有把存档里的链条搬进局内，空链不能反过来覆盖存档 */
  Save.chain = [{ id: K.id, n: 1, cap: 4 }];
  Game.player.bag.chain = [];
  Game.syncRaidChain();
  ok('空链不会清掉存档里的钥匙', Save.chain.length === 1 && Save.chain[0].cap === 4, JSON.stringify(Save.chain));
}

console.log('\n=== 信箱 ===');
{
  const Mail = ctx.Mail, K = ctx.ITEM_BY_ID;
  Save.mail = []; Save.mailBatches = {}; Save.chain = []; Save.stash = [];
  Save.bag = []; Save.credits = 0;
  Save.existed = false;
  noThrow('Mail.init()', () => Mail.init());
  ok('新号默认收不到发放批次', Save.mail.length === 0, Save.mail.length + ' 封');
  Save.existed = true;
  ok('老存档补发四封信', Mail.applyBatches() === 4 && Save.mail.length === 4, Save.mail.length + ' 封');
  const ids = Save.mail.map(l => l.items[0] && l.items[0].id);
  ok('四把钥匙都在信里', ['door_key_bank_vault', 'door_key_watchshop', 'door_key_clinic', 'door_key_old_apt']
    .every(id => ids.includes(id)), ids.join(','));
  ok('附件耐久都是 5', Save.mail.every(l => l.items.length === 1 && l.items[0].cap === 5));
  ok('重复初始化不会重复寄信', Mail.applyBatches() === 0 && Save.mail.length === 4);
  ok('按剩余耐久折算附件价值',
    ctx.entryValue(K.door_key_bank_vault, Save.mail[0].items[0]) === Math.round(K.door_key_bank_vault.price / 2),
    ctx.entryValue(K.door_key_bank_vault, Save.mail[0].items[0]));
  ok('未领取计数', Mail.unclaimed() === 4 && Mail.unread() === 4);

  const bank = Save.mail.find(l => l.items[0].id === 'door_key_bank_vault');
  ok('领取后进仓库且保留耐久', Mail.claim(bank.id) === true &&
    Save.stash.some(e => e.id === 'door_key_bank_vault' && e.cap === 5) &&
    Save.mail.find(l => l.id === bank.id).claimed === true);
  ok('领完的信件不能再领', Mail.claim(bank.id) === false);
  ok('未领取计数跟着减', Mail.unclaimed() === 3);

  ok('没有附件也能收下', (() => {
    const l = Mail.push({ title: '只言片语', body: '空信一封' });
    return Mail.claim(l.id) === true;
  })());

  /* 仓库满时整封留着，不出现"领了一半" */
  const watch = Save.mail.find(l => !l.claimed && l.items.length === 1);
  const canAdd = Save.canAddStash;
  Save.canAddStash = () => false;
  ok('仓库放不下时拒绝领取', Mail.claim(watch.id) === false);
  ok('拒绝领取后附件原样留在信里', Save.mail.find(l => l.id === watch.id).items.length === 1 &&
    Save.mail.find(l => l.id === watch.id).claimed === false);
  Save.canAddStash = canAdd;

  /* 外部队列：读完即删，只收一次 */
  ctx.localStorage.setItem('tideline_pending_mail', JSON.stringify([{ id: 'q1', title: '投递测试', body: '队列' }]));
  ok('外部队列收进信箱', Mail.drain() === 1 && !!Save.mail.find(l => l.id === 'q1'));
  ok('队列读完即删', ctx.localStorage.getItem('tideline_pending_mail') === null);
  ok('再收一次不会重复', Mail.drain() === 0);

  /* 坏数据不炸：认不出的物品、归零的钥匙 */
  Save.mail = [{ id: 'bad', title: '坏信', items: [{ id: 'not_an_item' }, { id: 'door_key_clinic', cap: 0 }], credits: 0 }];
  noThrow('规范化丢弃无效附件', () => Save.normalizeMail());
  ok('无效附件被丢掉、信还留着', Save.mail.length === 1 && Save.mail[0].items.length === 0);
}

// 真实尸体：拾荒者手里那把枪要能掉出来、能捡起来
const scav2 = Game.enemies.find(e => e.key === 'scav');
ok('拾荒者身上配了枪', !!scav2.weaponId, scav2.weaponId);
const realCorpse = new ctx.Corpse(scav2.x, scav2.y, scav2);
const gunEntry = realCorpse.loot.find(e => e.gun);
ok('尸体掉落里有枪', !!gunEntry);
ok('拾荒者掉枪保留实际余弹', gunEntry.gun.id === scav2.weaponId && gunEntry.gun.magCur === scav2.ai.mag, JSON.stringify(gunEntry.gun));

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
M.load(Array(30).fill('.'.repeat(50)),null,[],null); // Isolate detection from editable map obstacles.
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

/* 回响体是全盲的（sight=0），以前只会在噪声点原地打转：
   进不了 chase，也就永远攻击不了 —— 贴到脸上都不动手。 */
{
  Game.startRun();
  const P9 = Game.player;
  P9.x = M.cx(23); P9.y = M.cy(13);
  P9.hp = 999; P9.maxHp = 999;
  const ec = Game.enemies.find(e => e.key === 'echo');
  for (const e of Game.enemies) if (e !== ec) e.dead = true;
  ec.x = P9.x + 64; ec.y = P9.y;
  ec.state = 'patrol'; ec.path = null; ec.atkCd = 0;
  const hp0 = P9.hp;
  let chased = false, close = 1e9;
  for (let i = 0; i < 180; i++) {
    Game.update(1 / 60);
    if (ec.state === 'chase') chased = true;
    close = Math.min(close, U.dist(ec.x, ec.y, P9.x, P9.y));
  }
  ok('回响体贴到近前会扑上来', chased, 'state=' + ec.state);
  ok('回响体近身能造成伤害', hp0 - P9.hp > 0, '扣血 ' + (hp0 - P9.hp).toFixed(1));
  ok('回响体会逼到近战距离', close < 45, '最近 ' + close.toFixed(0) + 'px');

  /* 反过来：离得远、又没声音，不许凭空察觉 */
  Game.startRun();
  const PA = Game.player;
  PA.x = M.cx(23); PA.y = M.cy(13);
  const far = Game.enemies.find(e => e.key === 'echo');
  for (const e of Game.enemies) if (e !== far) e.dead = true;
  far.x = PA.x + 420; far.y = PA.y;
  far.state = 'patrol'; far.path = null;
  Noise.events.length = 0;
  let chasedFar = false;
  for (let i = 0; i < 120; i++) {
    if (Noise.events.length) Noise.events.length = 0;
    Game.update(1 / 60);
    if (far.state === 'chase') chasedFar = true;
  }
  ok('回响体不会隔着老远察觉玩家', !chasedFar, 'state=' + far.state);
}

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
ok('角色三向共 18 个资源槽', ART.chars.length * ART.charDirs.length === 18,
   ART.chars.length + ' 角色 × ' + ART.charDirs.length + ' 方向');

console.log('\n=== 物品简称 ===');
/* 背包格子只有 48×42，名字超过四个字会显示不全，所以约定要写 short。
   真正约束的是显示宽度：半角字符只有汉字的一半宽，所以按「半角=1 / 全角=2，
   合计不超过 8（四个汉字）」判断。弹药的 "5.56·3"、彩蛋的 "6090Ti" 都是
   6 个半角字符，显示宽度和三个汉字相当，不该被按字数误判。 */
const shortWidth = s => [...s].reduce((a, ch) => a + (ch.charCodeAt(0) < 128 ? 1 : 2), 0);
ok('简称不超过四个字的显示宽度',
   ITEMS.filter(i => i.short).every(i => shortWidth(i.short) <= 8),
   ITEMS.filter(i => i.short && shortWidth(i.short) > 8).map(i => i.short).join(',') || '全部合规');

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

/* 战斗系统 V1：确定性穿透 A = 10L − 10(1−D/Dmax)，H 二选一，
   ΔD = min[D, B(0.035+0.009P)·Kd]。爆头倍率与距离衰减在结算之后乘，
   护甲磨损与穿透结果无关（穿透成功也磨甲）。 */
const freshHelmet = () => GEAR.make('helmet', 4);   // Lv4 / 65 / 芳纶 Kb1.25 Kd0.75
const durLoss = (B, P, Kd) => B * (CFG.COMBAT_MODEL.DUR_BASE + CFG.COMBAT_MODEL.DUR_PER_PEN * P) * Kd;
PE.helmet = freshHelmet(); PE.body = null; PE.hp = 100;
PE.hurt(20, 'head', 33);   // A=40，P=33 未穿透 → 钝伤 0.08×20×1.25=2，爆头 ×1.5 = 3
ok('未穿透只产生钝伤，爆头倍率在结算之后乘',
   Math.abs(PE.hp - 97) < 1e-6, PE.hp.toFixed(2));
ok('护甲磨损按 B/P/Kd 算，与是否穿透无关',
   Math.abs(PE.helmet.dur - (65 - durLoss(20, 33, 0.75))) < 1e-6,
   PE.helmet.dur.toFixed(2) + '/65');

/* P ≥ A → 全额基础肉伤，不再叠加钝伤；仍然磨甲 */
PE.helmet = freshHelmet(); PE.hp = 100;
PE.hurt(20, 'head', 40);   // P = A = 40，穿透
ok('P≥A 时造成全额基础肉伤，不再叠加钝伤',
   Math.abs(PE.hp - 70) < 1e-6, PE.hp.toFixed(2));
ok('穿透成功一样磨甲',
   Math.abs(PE.helmet.dur - (65 - durLoss(20, 40, 0.75))) < 1e-6,
   PE.helmet.dur.toFixed(2) + '/65');

/* 本发 ΔD 不影响本发判定：命中前耐久 0.5 → A≈30.08，P=1 仍是钝伤；
   本发理论 ΔD=0.66 > 剩余 0.5，按剩余耐久封顶打到 0 */
PE.helmet = GEAR.make('helmet', 4, 0.5); PE.hp = 100;
PE.hurt(20, 'head', 1);
ok('本发判定只按命中前耐久', Math.abs(PE.hp - 97) < 1e-6, PE.hp.toFixed(2));
ok('耐久损耗以剩余耐久封顶、不会低于 0', PE.helmet.dur === 0, PE.helmet.dur + '');

/* 失效：下一发直接全额 */
PE.hp = 100;
PE.hurt(20, 'head', 1);
ok('护甲失效后下一发全额伤害', Math.abs(PE.hp - 70) < 1e-6, PE.hp.toFixed(2));

/* 身体命中只吃身体护甲，头盔耐久不变 */
PE.helmet = freshHelmet();
PE.body = GEAR.make('body', 5);   // V1：Lv5 / 135 / 装甲钢 Kb0.75 Kd0.70
PE.hp = 100;
const hdBefore = PE.helmet.dur;
PE.hurt(20, 'body', 33);          // A=50，P=33 未穿透 → 钝伤 0.08×20×0.75 = 1.2
ok('身体命中按身体护甲判定', Math.abs(PE.hp - 98.8) < 1e-6, PE.hp.toFixed(2));
ok('身体命中不动头盔耐久', PE.helmet.dur === hdBefore);
ok('身体命中扣身体护甲耐久',
   Math.abs(PE.body.dur - (135 - durLoss(20, 33, 0.70))) < 1e-6,
   PE.body.dur.toFixed(2) + '/135');

/* 移速 / 负重 / 存档 */
PE.body = GEAR.make('body', 6);
ok('六级甲不再直接减速，改为瞄准时间 +45%', PE.armorMove===1 && PE.body.aimPenaltyPct===45);
ok('护甲重量计入总负重', PE.totalWeight >= 13, PE.totalWeight.toFixed(1) + 'kg');
PE.helmet = GEAR.make('helmet', 3);
PE.hurt(20, 'head', 2);
ok('耐久会写回存档',
   Save.gear.helmet && Save.gear.helmet.dur === PE.helmet.dur,
   Save.gear.helmet ? Save.gear.helmet.dur : 'null');

console.log('\n=== 武器槽 ===');
PE.fillWeapons(['rifle', 'shotgun', 'pistol']);
ok('三个武器槽都装上', PE.weapons.filter(Boolean).length === 3);
ok('默认拿第一把', PE.slot === 0 && PE.weapon.id === 'm4a1');
PE.mag = 12;
PE.switchWeapon(1);
ok('切到霰弹枪', PE.weapon.id === 'mp155');
ok('每把枪的弹匣各自记住', PE.mag === 5, 'mag=' + PE.mag);
PE.switchWeapon(0);
ok('切回来还是原来的余弹', PE.mag === 12, 'mag=' + PE.mag);
ok('霰弹一次打六颗', (() => {
  PE.switchWeapon(1);
  PE.mag = 6; PE.recoil = 0; PE.sinceShot = 99; PE.fireCd = 0;
  Game.bullets.length = 0;
  PE.tryShoot();
  return Game.bullets.length === 6;
})(), Game.bullets.length + ' 颗');
ok('霰弹连射增长比步枪大', WEAPONS.shotgun.spreadGrowthMul > WEAPONS.rifle.spreadGrowthMul);

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

// 人类尸体的容器：随机等级背包（包本身也能摸走），等级 = 能搜出几件普通物品
{
  const mk = k => new ctx.Corpse(0, 0, Game.enemies.filter(x => x.key === k)[0]);
  const many = [];
  for (let i = 0; i < 300; i++) many.push(mk('scav'));
  const bagOf = c => c.loot.filter(e => e.fromBag);
  const bagItem = c => c.loot.find(e => e.corpseBag);
  ok('人类尸体带 1~3 级背包', many.every(c => c.bagLv >= 1 && c.bagLv <= 3),
     '等级 ' + [...new Set(many.map(c => c.bagLv))].sort().join('/'));
  ok('三档背包都抽得到', [1, 2, 3].every(l => many.some(c => c.bagLv === l)),
     [1, 2, 3].map(l => l + '级 ' + many.filter(c => c.bagLv === l).length).join(' / '));
  ok('背包本身就是一件能摸走的装备',
     many.every(c => {
       const e = bagItem(c);
       return e && e.item.equip && e.item.equip.kind === 'bag' &&
              e.item.equip.bag === 'bag0' + c.bagLv;
     }),
     bagItem(many[0]) ? bagItem(many[0]).item.name : '（无）');
  ok('背包不与"物品件数"混在一起',
     many.every(c => bagOf(c).length === c.bagLv && !bagItem(c).fromBag));
  ok('搜出的普通物品件数 = 背包等级', many.every(c => bagOf(c).length === c.bagLv),
     many.map(c => c.bagLv + '→' + bagOf(c).length).slice(0, 6).join(' '));
  ok('子弹照掉、而且不占背包格',
     many.every(c => c.loot.some(e => e.item && e.item.cat === 'ammo') && bagOf(c).every(e => e.item.cat !== 'ammo')));
  ok('同一具尸体的背包里不重复', many.every(c => {
    const ids = bagOf(c).map(e => e.item.id);
    return new Set(ids).size === ids.length;
  }));
  ok('回响体没有背包（不是人型）',
     corpses[1].bagLv === 0 && corpses[1].loot.every(e => !e.fromBag && !e.corpseBag),
     'Lv' + corpses[1].bagLv);
  ok('机械守卫不背包（仍旧一件工业/电子件）', (() => {
    const g = mk('guard');
    return g.bagLv === 0 && !g.loot.some(e => e.corpseBag) &&
           g.loot.filter(e => e.item && e.item.cat !== 'ammo').length === 1;
  })());
  ok('拾荒者还带着自己的枪/甲（不占背包格）',
     many.every(c => c.loot.some(e => e.gun)),
     '样本 ' + many.length);

  /* 摸出来能直接背上：旧包丢在脚边 */
  {
    Game.startRun();
    const PB = Game.player;
    PB.back = BACKPACK.make('bag01');
    PB.bag.slots.length = 0;
    const scavE = Game.enemies.find(e => e.key === 'scav');
    let cb = null;
    for (let i = 0; i < 400 && !cb; i++) {           // 挑一具三级包的尸体，换包才看得出来
      const t = new ctx.Corpse(PB.x, PB.y, scavE);
      if (t.bagLv === 3) cb = t;
    }
    ok('抽得到三级背包的尸体', !!cb);
    Game.openLoot(cb, true);
    const bi = cb.loot.findIndex(e => e.corpseBag);
    cb.loot[bi].known = true;
    const wantId = cb.loot[bi].item.equip.bag;
    Game.takeGear(cb.loot[bi], bi);
    ok('尸体上的背包能直接背上', PB.back && PB.back.id === wantId, PB.back && PB.back.id);
    ok('换下来的旧包塞进背包，不再丢地上',
       PB.bag.slots.some(s => s.item && s.item.equip && s.item.equip.kind === 'bag' &&
         s.item.equip.bag === 'bag01') && !Game.boxes.some(b => b.pile && !b.groundLoot),
       '背包内 ' + PB.bag.slots.filter(s => s.item?.equip?.kind === 'bag').length + ' 只 / 地面堆 ' +
       Game.boxes.filter(b => b.pile).length);
    ok('背包容量立刻生效', bagSlots() === BACKPACK.def(wantId).slots,
       bagSlots() + ' 格 / 期望 ' + BACKPACK.def(wantId).slots);
  }
}

/* 背包也是能放进背包的装备：占 1 格、只加自重，容量不会变大 */
{
  const PB = Game.player;
  const sack = EQUIP.bag('bag01');
  const cells0 = PB.bag.slots.length, w0 = PB.bag.weight(), v0 = PB.bag.value();
  const cap0 = bagSlots();
  const chk = PB.bag.canAdd(sack, 1);
  ok('背包能放进背包', chk.ok, chk.why || '');
  ok('放进去后只占 1 格', PB.bag.add(sack, 1) && PB.bag.slots.length === cells0 + 1);
  ok('背包自重计入负重', PB.bag.weight() > w0, w0.toFixed(1) + ' → ' + PB.bag.weight().toFixed(1) + ' kg');
  ok('背包按售价计入价值', PB.bag.value() > v0, '¥' + v0 + ' → ¥' + PB.bag.value());
  ok('套包不会扩大携带容量', bagSlots() === cap0, bagSlots() + ' 格');

  /* 换更小的包会被拦下：身上的东西放不下 */
  const idx = PB.bag.slots.findIndex(s => s.item && s.item.equip &&
    s.item.equip.kind === 'bag' && s.item.equip.bag === 'bag01');
  while (PB.bag.slots.length < bagSlots()) PB.bag.slots.push({ item: ctx.ITEM_BY_ID.art01, n: 1 });
  const beforeCount = PB.bag.slots.length, beforeBack = PB.back && PB.back.id;
  const swapped = Game.equipFromBag(idx);
  ok('满包时换小包会被拦下', swapped === false && PB.back.id === beforeBack &&
     PB.bag.slots.length === beforeCount, '物品 ' + PB.bag.slots.length + ' 件');
}

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
ok('仓库入口不直接成交', Save.credits === credA,
   credA + ' → ' + Save.credits);
ok('导航不删除物品', Save.stashCount('antiq03') === 3);

// 卖寻常物
Save.stash = [];
Save.addStash('antiq03', 1);   // 寻常
Save.addStash('lux02', 1);     // 珍稀，不该被清
const c0 = Save.credits;
Base.sellJunk();
ok('旧快捷出售保留全部物品', Save.stashCount('antiq03') === 1 && Save.stashCount('lux02') === 1);
ok('快捷入口不改变资金', Save.credits === c0);

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
/* V1：低穿透的高肉伤会被护甲折成小额钝伤，死亡结算用例先卸甲 */
PX.helmet = null; PX.body = null;
PX.hurt(999, 'body', 999);
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

// 商人：只卖崭新的一~四级
Base.tab = 'shop';
noThrow('商人页渲染', () => Base.render());
const cBuy = Save.credits;
Base.buyArmor('helmet', 2);
ok('买下一顶二级头盔', Save.stash.filter(e => e.gear).length === 1);
ok('买来的是崭新（满耐久）',
  Save.stash.find(e => e.gear).gear.equip.gear.dur === GEAR.def('helmet', 2).dur);
ok('买东西扣钱', Save.credits === cBuy - Math.round(GEAR.def('helmet', 2).price * 3),
  cBuy + ' → ' + Save.credits);

const nShop = Save.stash.length;
Base.buyArmor('helmet', 5);
ok('商人卖不到四级以上', Save.stash.length === nShop, '仓库 ' + Save.stash.length + ' 条');

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
Save.stash = []; Save.credits = 1000000;
Save.gear.weapons = [EQUIP.gun('rifle', 18), null, EQUIP.gun('pistol', 7)];
ok('武器位存的是物品而不是 id',
  typeof Save.gear.weapons[0] === 'object' && Save.gear.weapons[0].equip.gun === 'm4a1');
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
ok('买枪扣钱', Save.credits === cGun - Math.round(WEAPONS.smg.price * 3), cGun + ' → ' + Save.credits);
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
ok('换上仓库里的冲锋枪', Save.gear.weapons[0].equip.gun === 'pp19_01');
ok('换下来的步枪回仓库（余弹也在）',
  Save.stash.some(e => e.gear && e.gear.equip.gun === 'm4a1' && e.gear.equip.mag === 18));
ok('原先那把不在身上了', Save.gear.weapons[0] !== rifleBefore);

// 卸下主武器：回仓库，不再是"只能换不能卸"
Save.addGearStash(EQUIP.gun('shotgun', 6));
const shotgunEntry = Save.stash.find(e => e.gear && e.gear.equip.gun === 'mp155');
Base.togglePicker('w1', null);
Base.equipFromStash(shotgunEntry, 'w1');
ok('第二个主武器位也能装', Save.gear.weapons[1].equip.gun === 'mp155',
  Save.gear.weapons[1] ? Save.gear.weapons[1].equip.gun : '空');
Base.unequip('w1');
ok('主武器能卸下', Save.gear.weapons[1] === null);
ok('卸下的枪回仓库', Save.stash.some(e => e.gear && e.gear.equip.gun === 'mp155'));

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
ok('老存档的 id 能迁成物品', migrated[0] && migrated[0].equip.gun === 'pp19_01');
ok('老存档迁移保留旧弹数，不额外补发', migrated[0].equip.mag === 25);
ok('迁移保留已有副武器', migrated[2].equip.gun === 'glock17');

console.log('\n=== 撤离 ===');
Game.startRun();
const P11 = Game.player;
/* 入场点本局封闭，测试要站在仍然开放的那个撤离点上 */
const ex = (M.openExtracts ? M.openExtracts() : M.extracts)[0];
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
/* 出生与寻路都使用格中心；墙顶的北侧半格投影不占用站位。 */
const SPAWN_PT = M.navigationPoint(7, 4);
const animator = new ctx.Player(SPAWN_PT.x, SPAWN_PT.y);
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
const gunner = new ctx.Player(SPAWN_PT.x, SPAWN_PT.y);
for (const id of ['rifle', 'shotgun', 'smg', 'pistol']) {
  gunner.fillWeapons([EQUIP.gun(id, 5), null, null]);
  gunner.fireCd = 0; gunner.reloadT = 0; gunner.fireCd = 0;
  sfxLog.length = 0;
  gunner.tryShoot();
  const call = sfxLog.find(c => c.name === 'shot');
  ok('开火带枪型：' + id, !!call && call.opts && call.opts.gun === vm.runInContext('canonicalWeaponId',ctx)(id));
}

/* ---- 脚步：同样的时间，越快步子越密 ---- */
const stepCount = (speedInput, seconds, sprint) => {
  const w = new ctx.Player(SPAWN_PT.x, SPAWN_PT.y);
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
const walkVol = (() => { const w = new ctx.Player(SPAWN_PT.x, SPAWN_PT.y); const x0 = w.x, y0 = w.y;
  sfxLog.length = 0;
  for (let i = 0; i < 120; i++) { w.update(1 / 60, { ...inpStill, mx: 1, my: 0 }); w.x = x0; w.y = y0; }
  return volOf(sfxLog); })();
const runVol = (() => { const w = new ctx.Player(SPAWN_PT.x, SPAWN_PT.y); const x0 = w.x, y0 = w.y;
  sfxLog.length = 0;
  for (let i = 0; i < 120; i++) { w.update(1 / 60, { ...inpStill, mx: 1, my: 0, sprint: true }); w.x = x0; w.y = y0; }
  return volOf(sfxLog); })();
ok('冲刺脚步比走路脚步响', runVol > walkVol, walkVol + ' → ' + runVol);

/* ---- 闪避：起步一声破风，收尾一下落步 ---- */
const dodger = new ctx.Player(SPAWN_PT.x, SPAWN_PT.y);
sfxLog.length = 0;
dodger.update(1 / 60, { ...inpStill, dodge: true });
ok('闪避触发破风声', sfxLog.some(c => c.name === 'dodge'));
for (let i = 0; i < 20; i++) dodger.update(1 / 60, inpStill);
ok('闪避收尾有落步声', sfxLog.some(c => /^step_stone_/.test(c.name)));

/* ---- 切枪：枪⇄刀两个方向都要有声 ---- */
const swapper = new ctx.Player(SPAWN_PT.x, SPAWN_PT.y);
swapper.fillWeapons([EQUIP.gun('rifle', 5), null, null]);
swapper.melee = ctx.MeleeSystem.normalize(EQUIP.melee('melee01'));
sfxLog.length = 0;
swapper.switchMelee();
/* 新素材是拔刃出鞘；SFX.play 在采样缺失时自己退回 shot_switch */
ok('枪 → 刀有声', sfxLog.some(c => c.name === 'switchMelee' || c.name === 'shot_switch'));
sfxLog.length = 0;
swapper.switchWeapon(0);
ok('刀 → 枪有声', sfxLog.filter(c => c.name === 'shot_switch').length === 1);

console.log('\n=== 新一批战斗人声：随机池 / 触发间隔 / 接战只在状态切换 ===');
{
  const log = [];
  const realPlay = ctx.SFX._playSample, realCtx = ctx.SFX.ctx, realOn = ctx.SFX.on;
  const realNow = ctx.performance.now;
  let clock = 1000;
  ctx.performance.now = () => clock;
  ctx.SFX.ctx = { state: 'running' }; ctx.SFX.on = true;
  ctx.SFX._poolAt = {}; ctx.SFX._poolLast = {};
  for (const id of ['hurt_player_1','hurt_player_2','hurt_player_3',
                    'hurt_enemy_1','hurt_enemy_2','echo_engage','echo_death','death_enemy_1'])
    ctx.SFX.samples[id] = {};
  ctx.SFX._playSample = (id) => { log.push(id); return true; };
  try {
    ctx.SFX.play('hurtPlayer');
    ok('玩家受伤从三条里随机抽一条', log.length === 1 && /^hurt_player_[123]$/.test(log[0]));
    ctx.SFX.play('hurtPlayer');
    ok('0.8 秒内连着挨打不再叠音', log.length === 1);
    clock += 900;
    ctx.SFX.play('hurtPlayer');
    ok('过了间隔才换下一条，且不与上一条重复',
       log.length === 2 && /^hurt_player_[123]$/.test(log[1]) && log[1] !== log[0]);
    ctx.SFX.play('hurtEnemy'); ctx.SFX.play('hurtEnemy');
    ok('敌人受伤走自己的池子和间隔', log.filter(x => /^hurt_enemy_/.test(x)).length === 1);

    /* 接战音：只在非 chase → chase 的那一次，且池间隔兜住抖动 */
    const e = new ctx.Enemy('echo', SPAWN_PT.x, SPAWN_PT.y);
    sfxLog.length = 0;
    e.enterCombat(); e.enterCombat();
    ok('接战音只在进入战斗那一次响', sfxLog.filter(c => c.name === 'echoEngage').length === 1);
    e.state = 'patrol';
    e.enterCombat();
    ok('退出战斗后重新接战会再响一次', sfxLog.filter(c => c.name === 'echoEngage').length === 2);
    const scav = new ctx.Enemy('scav', SPAWN_PT.x, SPAWN_PT.y);
    sfxLog.length = 0;
    scav.enterCombat();
    ok('人形敌人不吃异常生物接战音', sfxLog.every(c => c.name !== 'echoEngage'));
  } finally {
    ctx.SFX._playSample = realPlay; ctx.SFX.ctx = realCtx; ctx.SFX.on = realOn;
    ctx.performance.now = realNow;
    for (const id of ['hurt_player_1','hurt_player_2','hurt_player_3',
                      'hurt_enemy_1','hurt_enemy_2','echo_engage','echo_death','death_enemy_1'])
      delete ctx.SFX.samples[id];
  }
}

/* 切枪音按枪型走：霰弹枪是泵动上膛，其余沿用通用滑套 */
const sw2 = new ctx.Player(SPAWN_PT.x, SPAWN_PT.y);
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

/* 靶场七参数：增加实验用瞄准散布倍率，物理基准仍由 CFG.RECOIL 派生。 */
Range.equip('rifle');
ok('靶场七项调参包含瞄准精度', RANGE_PARAMS.length === 7 &&
  RANGE_PARAMS.map(p => p.key).join(',') === 'rpm,aimTime,recoilVMul,recoilHMul,spreadGrowthMul,spreadMul,adsPrecisionMul',
  RANGE_PARAMS.map(p => p.key).join(','));
Range.setDisp(RANGE_PARAMS.find(p => p.key === 'rpm'), 900);
Range.setDisp(RANGE_PARAMS.find(p => p.key === 'recoilVMul'), 1.5);
Range.setDisp(RANGE_PARAMS.find(p => p.key === 'spreadGrowthMul'), 2);
Range.apply();
ok('调参写进当前武器',
  Math.abs(Game.player.weapon.rpm - 900) < 1e-6 &&
  Math.abs(Game.player.weapon.recoilVMul - 1.5) < 1e-6 &&
  Math.abs(Game.player.weapon.spreadGrowthMul - 2) < 1e-6,
  Game.player.weapon.rpm + ' / ' + Game.player.weapon.recoilVMul + ' / ' + Game.player.weapon.spreadGrowthMul);
{
  const d = Firearms.derive(Game.player.weapon);
  ok('派生冲击 = 全局基准 × 倍率',
    Math.abs(d.vKick - CFG.RECOIL.axis.v.kick * 1.5) < 1e-9 &&
    Math.abs(d.growth - CFG.RECOIL.perShot * 2) < 1e-9,
    d.vKick.toFixed(2) + 'px / ' + d.growth.toFixed(4));
  ok('调参不再改写全局常量',
    CFG.RECOIL.axis.v.kick === 3.4 && CFG.RECOIL.perShot === 0.075,
    CFG.RECOIL.axis.v.kick + ' / ' + CFG.RECOIL.perShot);
}
Game.player.fireCd = 0; Game.player.windupShot = false; Game.player.mag = Game.player.weapon.mag;
Game.player.tryShoot();
ok('射速参与开火冷却', Math.abs(Game.player.fireCd - 60 / 900) < 1e-6, String(Game.player.fireCd));

/* 配件在靶场里改的是倍率，并且和调参叠加而不是互相覆盖 */
{
  const before = Game.player.weapon;
  const part = Object.values(ATTACHMENT_DEFS).find(a => a.subtype === 'muzzle' &&
    Attachments.compatible(before.id, a.id, 'muzzle'));
  Range.setPart('muzzle', part.id);
  const after = Game.player.weapon;
  const m = part.statModifiers || {};
  ok('靶场改装立即生效（倍率被配件改写）',
    (m.recoilVertical == null || Math.abs(after.recoilVMul - before.recoilVMul * (1 + m.recoilVertical)) < 1e-9) &&
    after.attachments.muzzle === part.id, part.name);
  ok('改装不会冲掉调参值', Math.abs(after.rpm - 900) < 1e-6 && Math.abs(after.spreadGrowthMul - 2) < 1e-6,
    after.rpm + ' / ' + after.spreadGrowthMul);
  Range.setPart('muzzle', null);
  ok('拆卸后回到未改装倍率', Math.abs(Game.player.weapon.recoilVMul - 1.5) < 1e-6, String(Game.player.weapon.recoilVMul));
}

/* 面板按钮与重置 */
Range.clearMarks();
ok('清弹孔后统计为空', Range.groupStats() === null);
Range.onClick({ target: { dataset: { act: 'reset' } } });
ok('重置本枪回到默认射速', Math.abs(Game.player.weapon.rpm - WEAPONS.rifle.rpm) < 1e-6, String(Game.player.weapon.rpm));

/* 换枪：四把枪都能在靶场里上膛 */
for (const id of ['shotgun', 'smg', 'pistol', 'rifle']) {
  noThrow('靶场换枪 ' + id, () => Range.equip(id));
  ok('靶场当前枪是 ' + id, Game.player.weapon.id === vm.runInContext('canonicalWeaponId',ctx)(id), Game.player.weapon.id);
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
   !!exp.weapons && !!exp.weapons.m4a1 && exp.weapons.m4a1.rpm === 600 &&
   !exp.weapons.pp19_01,
   JSON.stringify(exp.weapons));
ok('导出结构能被写回脚本识别', exp.version === 2 && !('recoil' in exp),
   Object.keys(exp).join(','));

/* 退出后全局常量原样不动（调参只存在于本局武器上） */
const decayBefore = CFG.RECOIL.decayHalfLife;
Range.exit();
ok('退出靶场不还原全局常量（本来就没改）', CFG.RECOIL.decayHalfLife === decayBefore, String(CFG.RECOIL.decayHalfLife));
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

  /* 鼠标可以穿过玩家：偏移量不再按"剩余距离"缩放，准星也不再有最小半径。
     贴身近战要往身后甩枪，光标与准星都得跟得过去。 */
  {
    aimAt(0, 200);
    PR.rV = AX.v.max; PR.rH = 0;
    let maxOffErr = 0;
    /* 从玩家右侧 40px 一路穿过玩家拉到左侧 40px */
    for (let dx = 40; dx >= -40; dx -= 1) {
      PR.updateAimPoint(PR.x + dx, PR.y);
      const R = PR.aimPoint;
      /* 没有夹取：准星与鼠标点的距离恒等于 rV，贴身、穿过都不会被缩放或顶开 */
      maxOffErr = Math.max(maxOffErr,
        Math.abs(Math.hypot(R.x - (PR.x + dx), R.y - PR.y) - PR.rV));
    }
    ok('偏移量不再被"离玩家还剩多少"缩放', maxOffErr < 1e-6,
       '最大偏差 ' + maxOffErr.toFixed(3) + 'px');
    ok('鼠标穿过玩家后准星跟到另一侧', PR.aimPoint.x < PR.x,
       'R 在玩家左侧 ' + (PR.x - PR.aimPoint.x).toFixed(1) + 'px');

    /* 无后坐力、鼠标压在玩家正中心：准星就该落在玩家身上，不再顶回身前 18px */
    PR.rV = 0; PR.rH = 0;
    PR.updateAimPoint(PR.x, PR.y);
    ok('准星可以贴到玩家身上（无最小半径）',
       Math.hypot(PR.aimPoint.x - PR.x, PR.aimPoint.y - PR.y) < 1e-6,
       'R 离玩家 ' + Math.hypot(PR.aimPoint.x - PR.x, PR.aimPoint.y - PR.y).toFixed(2) + 'px');
  }

  /* 锁定状态下的虚拟光标同样能穿过玩家：game-update 里不再按 keep 顶回去 */
  {
    const K = Game.input;
    /* 随机入场后每局出生点会变，这一段必须按当前 player 的坐标算，
       不能拿后坐力小节留下的旧 PR 引用（那会指向上一局的玩家）。 */
    const CUR = Game.player;
    const wasLocked = Game.pointerLocked;
    const mx0 = K.mx, my0 = K.my;
    Game.pointerLocked = true;
    /* 出生点每局随机，镜头可能还停在上一局的撤离点：先把镜头吸到当前玩家身上，
       否则 K.my 会被夹到画布外，这一段的坐标换算就没意义了。 */
    Game.updateCamera(true);
    Game.update(1 / 60);          // 先让镜头跟上，后面按稳定后的 cam 反推屏幕坐标
    K.mx = CUR.x - Game.cam.x;
    K.my = CUR.y - Game.cam.y;
    Game.update(1 / 60);
    ok('锁定时光标能停在玩家身上',
       Math.hypot(K.wx - CUR.x, K.wy - CUR.y) < 1e-6,
       '光标离玩家 ' + Math.hypot(K.wx - CUR.x, K.wy - CUR.y).toFixed(2) + 'px');
    K.mx = CUR.x - Game.cam.x - 40;
    K.my = CUR.y - Game.cam.y;
    Game.update(1 / 60);
    ok('锁定时光标能穿过玩家到另一侧', K.wx < CUR.x - 30,
       '光标在玩家左侧 ' + (CUR.x - K.wx).toFixed(1) + 'px');
    Game.pointerLocked = wasLocked;
    K.mx = mx0; K.my = my0;
  }

  /* 鼠标正好压在角色中心时朝向沿用上一次，避免 atan2 乱抖；
     离开死区就照常翻向另一侧（这一条不是"不许穿过"，只是防抖） */
  {
    PR.angle = 1.0;
    PR.update(1 / 60, { mx: 0, my: 0, aimAngle: Math.PI, aimX: PR.x + 6, aimY: PR.y });
    ok('鼠标在死区内不改朝向', Math.abs(PR.angle - 1.0) < 1e-9, PR.angle.toFixed(4));
    PR.update(1 / 60, { mx: 0, my: 0, aimAngle: Math.PI, aimX: PR.x + 60, aimY: PR.y });
    ok('鼠标离开死区才改朝向', Math.abs(PR.angle - Math.PI) < 1e-9, PR.angle.toFixed(4));
  }
}

/* ============================================================
   体力：冲刺持续消耗 / 闪避直接扣 / 负重放大消耗
   ============================================================ */
console.log('\n=== 体力 ===');
{
  Game.startRun();
  const PR = Game.player;
  const S = CFG.STAMINA;
  const dt = 1 / 60;
  PR.x = M.cx(23); PR.y = M.cy(13);

  const mk = (o) => Object.assign({
    mx: 1, my: 0, sneak: false, sprint: false, dodge: false,
    aimAngle: 0, aimX: PR.x + 200, aimY: PR.y
  }, o || {});
  const run = (n, o) => { for (let i = 0; i < n; i++) PR.update(dt, mk(o)); };
  /* 负重档位直接改 totalWeight：塞几十公斤东西进来太麻烦，挡位才是要看的 */
  const setW = (w) => Object.defineProperty(PR, 'totalWeight', { value: w, configurable: true });
  const clrW = () => { delete PR.totalWeight; };
  const reset = () => {
    PR.stamina = PR.maxStamina; PR.exhausted = false;
    PR.dodgeCd = 0; PR.dodgeT = 0; PR.stamHold = 0;
  };

  ok('开局满体力', PR.stamina === PR.maxStamina && PR.maxStamina === S.MAX, PR.maxStamina + '');
  ok('满体力时体力条不显示', PR.stamAlpha === 0);

  /* 冲刺：一直在掉，条要立刻亮起来 */
  reset();
  run(60, { sprint: true });
  ok('冲刺一秒持续掉体力', PR.stamina < S.MAX - S.SPRINT_DRAIN * 0.8 &&
     PR.stamina > S.MAX - S.SPRINT_DRAIN * 1.2, '剩 ' + PR.stamina.toFixed(1));
  ok('消耗后体力条显示出来', PR.stamAlpha > 0.9, PR.stamAlpha.toFixed(2));

  /* 站着按住空格不算冲刺消耗 */
  reset();
  run(60, { sprint: true, mx: 0, my: 0 });
  ok('原地按住冲刺不掉体力', PR.stamina === S.MAX, PR.stamina.toFixed(2));

  /* 负重：中载及以下不变，重载变贵，超载最贵 */
  const drainWith = (w) => {
    reset(); setW(w);
    run(60, { sprint: true });
    const d = S.MAX - PR.stamina;
    clrW();
    return d;
  };
  /* 取样点跟着 BAG.TIERS 走：三档门槛分别取「轻装中段 / 刚过中载线 / 刚过重载线」，
     上限以后再调也不用手改这里的数字。 */
  const BT = CFG.BAG.TIERS;
  const dLight = drainWith(BT[0][0] * 0.3), dMid = drainWith(BT[0][0] + 5),
        dHeavy = drainWith(BT[1][0] + 5), dOver = drainWith(BT[2][0] + 5);
  ok('轻装按基础速率消耗', Math.abs(dLight - S.SPRINT_DRAIN) < 0.6, dLight.toFixed(2) + '/s');
  ok('中载及以下不影响消耗', Math.abs(dMid - dLight) < 0.05,
     dMid.toFixed(2) + ' vs ' + dLight.toFixed(2));
  ok('重载提高消耗', Math.abs(dHeavy / dLight - S.LOAD_MULT[2]) < 0.03, (dHeavy / dLight).toFixed(3));
  ok('超载大幅提高消耗', Math.abs(dOver / dLight - S.LOAD_MULT[3]) < 0.03, (dOver / dLight).toFixed(3));

  /* 闪避：一次性扣 */
  reset();
  PR.update(dt, mk({ dodge: true }));
  ok('闪避直接扣一大截体力', Math.abs((S.MAX - PR.stamina) - S.DODGE_COST) < 0.01,
     '扣了 ' + (S.MAX - PR.stamina).toFixed(1));
  ok('闪避确实滑出去了', PR.dodgeT > 0);
  ok('闪避后体力条亮着', PR.stamAlpha > 0.9);

  /* 超载不可闪避（取重载线之上 5kg，正好落进超载档） */
  reset(); setW(CFG.BAG.TIERS[2][0] + 5);
  PR.update(dt, mk({ dodge: true }));
  ok('超载不能闪避', PR.dodgeT === 0 && PR.stamina === S.MAX);
  ok('超载闪避给出原因', PR.dodgeBlockedWhy() === '超载，闪不动', PR.dodgeBlockedWhy());
  clrW();

  /* 体力不够也闪不动 */
  reset();
  PR.stamina = S.DODGE_COST - 2;
  PR.update(dt, mk({ dodge: true }));
  ok('体力不足不能闪避', PR.dodgeT === 0 && !PR.canDodge());
  ok('体力不足也给出原因', PR.dodgeBlockedWhy() === '体力不够，闪不动', PR.dodgeBlockedWhy());

  /* 力竭：冲空了就冲不动，歇够才能再来 */
  reset();
  PR.stamina = 1;
  run(30, { sprint: true });
  ok('体力耗尽进入力竭', PR.exhausted && PR.stamina === 0, PR.stamina.toFixed(2));
  run(60, { sprint: true });
  /* 力竭期间体力照回（人还在慢慢挪），但没回到 EXHAUST_EXIT 之前蹬不起来 */
  ok('力竭时按住也冲不起来', PR.sprinting === false && PR.stamRatio < S.EXHAUST_EXIT,
     '回到 ' + PR.stamRatio.toFixed(2));
  run(180, {});
  ok('歇够后体力恢复', PR.stamina > S.MAX * S.EXHAUST_EXIT, PR.stamina.toFixed(1));
  ok('恢复过线后解除力竭', !PR.exhausted);
  run(30, { sprint: true });
  ok('解除后能重新冲刺', PR.sprinting === true && PR.stamina < S.MAX);

  /* 回满后淡出 */
  reset();
  run(240, {});
  ok('停手后回满体力', PR.stamina === S.MAX, PR.stamina.toFixed(2));
  ok('回满后体力条淡到消失', PR.stamAlpha < 0.01, PR.stamAlpha.toFixed(3));

  /* 上限决定弧长：满级就是整条，上限低的人条更短；弧度固定，短就短在长度上 */
  const lenOf = (max) => S.ARC.LEN * (Math.min(1, max / S.MAX) >= S.ARC.MIN
    ? Math.min(1, max / S.MAX) : S.ARC.MIN);
  ok('满级上限对应整条弧', Math.abs(lenOf(S.MAX) - S.ARC.LEN) < 1e-9, lenOf(S.MAX).toFixed(1) + 'px');
  ok('上限减半弧长减半', Math.abs(lenOf(S.MAX / 2) - S.ARC.LEN / 2) < 1e-9, lenOf(S.MAX / 2).toFixed(1) + 'px');
  ok('弧度收小后半径自动变大', S.ARC.LEN / S.ARC.SWEEP > S.ARC.GAP,
     'R=' + (S.ARC.LEN / S.ARC.SWEEP).toFixed(1) + 'px，圆心在玩家左侧 ' +
     (S.ARC.LEN / S.ARC.SWEEP - S.ARC.GAP).toFixed(1) + 'px');
  ok('弧比半圆平得多', S.ARC.SWEEP < Math.PI * 0.5,
     (S.ARC.SWEEP * 180 / Math.PI).toFixed(0) + '° vs 半圆 180°');
  PR.maxStamina = S.MAX; PR.stamina = S.MAX;
  noThrow('体力条绘制不抛错', () => { PR.stamAlpha = 1; Game.drawStamina(ctxMock, 100, 100, PR); });
  PR.stamina = 1; PR.exhausted = true;
  noThrow('力竭时绘制不抛错', () => Game.drawStamina(ctxMock, 100, 100, PR));
}

console.log('\n=== 损伤状态与医疗 ===');
{
  const DB = ctx.Debuff, Med = ctx.Medical, byId = ctx.ITEM_BY_ID;
  const P = Game.player;
  ok('玩家有局内损伤状态', !!P.debuffs);
  ok('机械守卫不吃损伤状态', !new ctx.Enemy('guard', P.x + 60, P.y).debuffs);
  ok('人形敌人吃损伤状态', !!new ctx.Enemy('scav', P.x + 40, P.y).debuffs);

  P.debuffs = DB.fresh();
  P.hp = 100;
  for (let i = 0; i < 6; i++) DB.apply(P, 'severe');
  ok('重伤最多 4 层、可恢复上限 40%', P.debuffs.severe === 4 &&
     Math.abs(DB.recoverableMax(P) - 40) < 1e-6, '上限 ' + DB.recoverableMax(P).toFixed(1));
  ok('重伤截断不致死', P.hp >= 1 && !P.dead);

  P.debuffs.bleeding = true; P.hp = 2;
  DB.tickAll(10);
  ok('流血最低保留 1 HP 且不致死', P.hp === 1 && !P.dead);

  DB.applyAnalgesic(P, 90);
  ok('镇痛屏蔽疼痛与骨折的操作惩罚', DB.analgesicActive(P) &&
     !DB.penaltyOn(P) && DB.moveMult(P) === 1 && DB.spreadAdd(P) === 0);
  P.debuffs.fracture = true;
  const hp0 = P.hp;
  DB.onRoll(P);
  ok('骨折翻滚掉血不受镇痛免除', P.hp === Math.max(1, hp0 - CFG.DEBUFF.FRACTURE.ROLL_DMG));

  const opened = ['heal06','heal07','heal08','heal09','heal10','heal12'];
  ok('六件损伤处理品已开放且进入掉落池',
     opened.every(id => Med.ready(byId[id]) && !!byId[id].effect && !byId[id].noLoot));
  ok('未开放的七件仍不可用',
     ctx.ITEMS.filter(i => i.cat === 'medical' && !i.healCap && !i.effect).length === 7);

  P.debuffs.severe = 2; P.debuffs.fracture = true;
  const hpBefore = P.hp;
  ok('手术优先治一层重伤且不回血', DB.surgery(P) === 'severe' &&
     P.debuffs.severe === 1 && P.debuffs.fracture && P.hp === hpBefore);
  P.debuffs.severe = 0;
  ok('无重伤时手术解骨折', DB.surgery(P) === 'fracture' && !P.debuffs.fracture);

  Game.showEnd(true);
  ok('结算统一清除局内损伤', P.debuffs.severe === 0 && !P.debuffs.bleeding &&
     !P.debuffs.fracture && DB.recoverableMax(P) === P.maxHp);
}

console.log('\n=== 护甲修理 ===');
{
  const Repair = ctx.Repair, ARMOR_VARIANTS = ctx.ARMOR_VARIANTS;
  const defs = HELMETS.concat(BODIES, ARMOR_VARIANTS);
  ok('所有护甲都带耐修度与材质',
     defs.every(d => Number.isFinite(d.rep) && d.rep > 0 && d.rep <= 100 && !!CFG.MATERIALS[d.material]),
     '共 ' + defs.length + ' 件，' + Math.min(...defs.map(d => d.rep)) + '~' + Math.max(...defs.map(d => d.rep)));

  /* 战术防弹衣：V1 为 110 上限、防弹陶瓷 Kr=0.090，掉到 20 再修 */
  const g = GEAR.make('body', 4, 20);
  const q = Repair.quote(g);
  ok('缺失耐久按上限减当前耐久结算', q.max === 110 && q.dur === 20 && q.lost === 90);
  ok('上限损耗 = 缺失耐久 × 材质 Kr',
     q.Kr === 0.09 && Math.abs(q.capLoss - q.lost * q.Kr) < 1e-6 &&
     Math.abs(q.newMax - (q.max - q.capLoss)) < 1e-6 && q.newMax < q.max,
     '-' + q.capLoss + ' → 上限 ' + q.newMax);
  ok('修理费按原价 ÷ 原厂耐久 × 缺失耐久',
     q.fee === Math.max(CFG.REPAIR.MIN_FEE, Math.round(g.price / GEAR.def('body', 4).dur * q.lost * CFG.REPAIR.COST / 10) * 10),
     '¥' + q.fee);
  ok('修一次的上限损耗远小于补回的耐久', q.capLoss > 0 && q.capLoss < q.lost / 2);

  /* 缺口一样、材质不同：Kr 小的那件掉得更少 */
  const soft = Repair.quote(GEAR.make('body', 1, 20));      // 芳纶 Kr .035，缺口 20
  const hard = Repair.quote(GEAR.make('helmet', 5, 65));    // 陶瓷 Kr .090，缺口 20
  ok('材质 Kr 决定同样缺口的上限损耗', soft.lost === hard.lost && soft.capLoss < hard.capLoss,
     soft.capLoss + ' vs ' + hard.capLoss);

  ok('满耐久不需要修', !Repair.quote(GEAR.make('helmet', 3)).ok);
  ok('上限见底不再接受修理', !Repair.quote(GEAR.make('helmet', 3, 0, 4)).ok);

  const carried = GEAR.make('body', 4, 20, 77);
  ok('GEAR.make 带得住修理后的上限', carried.max === 77 && carried.dur === 20);
  const pseudo = EQUIP.armor(carried);
  ok('伪物品不把上限冲回模板值', pseudo.equip.gear.max === 77 && pseudo.equip.gear.dur === 20);
  ok('回收价按原厂上限折算', pseudo.sell === EQUIP.sellPrice(carried.price, 20, 77, GEAR.def('body', 4).dur) && pseudo.sell < 85000 * 0.5);

  Save.gear.body = GEAR.make('body', 4, 30, 70);
  Save.save(); Save.load();
  ok('读档后修理痕迹还在', Save.gear.body.max === 70 && Save.gear.body.dur === 30);

  /* 装回身上再卸下来，也不能把上限洗掉 */
  Save.stash = [{ id: 'g_body4', n: 1, gear: EQUIP.armor(GEAR.make('body', 4, 30, 70)) }];
  Save.gear.body = null;
  Base.equipFromStash(Save.stash[0], 'body');
  ok('从仓库穿上时保留上限', Save.gear.body && Save.gear.body.max === 70);
  const back = Base.gearItem('body');
  ok('卸下时伪物品保留上限', back.equip.gear.max === 70);
}

console.log('\n=== 异常遗物编号迁移 ===');
{
  /* 异常遗物补充批次把两件红品从 odd04/05 挪到 odd17/18。
     v3 存档里的 odd04/05 指的是红品，读档要搬；v4 起 odd04/05 是新样本，不能再搬。 */
  localStorageMock.setItem(Save.key, JSON.stringify({
    v: 3, stash: [{ id: 'odd04', n: 1 }, { id: 'odd05', n: 1 }], bag: [], safe: [], codex: { odd04: true }, gear: {}
  }));
  Save.load();
  ok('v3 存档把旧 odd04/05 迁到 odd17/18',
     Save.stash.length === 2 && Save.stash.every(e => e.id === 'odd17' || e.id === 'odd18'));
  ok('旧图鉴键跟着搬', Save.codex.odd17 === true && !Save.codex.odd04);

  localStorageMock.setItem(Save.key, JSON.stringify({
    v: 4, stash: [{ id: 'odd04', n: 1 }], bag: [], safe: [], codex: {}, gear: {}
  }));
  Save.load();
  ok('v4 存档不再迁移，odd04 仍是潮盐团块', Save.stash[0] && Save.stash[0].id === 'odd04');
}

console.log('\n=== 护甲耐久条 ===');
{
  const D = ctx.DuraBar;
  const segs = html => [...html.matchAll(/class="(dg|ds|dr)" style="width:([\d.]+)%"/g)].map(m => [m[1], +m[2]]);
  const full = segs(D.html(GEAR.make('body',3)));            // 85/85，没修过
  ok('满耐久整条绿、无灰无红', full.length === 3 && full[0][1] === 100 && full[1][1] === 0 && full[2][1] === 0);

  const worn = segs(D.html(GEAR.make('body',3,10)));         // 10/85
  ok('打掉的部分变灰', Math.abs(worn[0][1] - 10 / 85 * 100) < 0.02 && Math.abs(worn[1][1] - 75 / 85 * 100) < 0.02 && worn[2][1] === 0);

  const base4 = GEAR.def('body', 4).dur;                    // V1：110
  const fixed = segs(D.html(GEAR.make('body',4,20,94)));     // 20/94，原厂 110
  ok('修掉的上限占红色', Math.abs(fixed[2][1] - (base4 - 94) / base4 * 100) < 0.02);
  ok('三段合计正好铺满一条', Math.abs(fixed.reduce((n, s) => n + s[1], 0) - 100) < 0.02);

  const preview = segs(D.html(GEAR.make('body',4,20,94), {cap: 78, dur: 20}));
  ok('修理预览按修完的上限画红色', Math.abs(preview[0][1] - 20 / base4 * 100) < 0.02 &&
     Math.abs(preview[1][1] - 58 / base4 * 100) < 0.02 &&
     Math.abs(preview[2][1] - (base4 - 78) / base4 * 100) < 0.02);

  ok('非护甲不画条', D.html(EQUIP.gun('rifle')) === '' && D.of(EQUIP.gun('rifle')) === null);
}

console.log('\n=== 枪械槽位点 ===');
{
  const D = ctx.SlotDots;
  const dots = html => [...html.matchAll(/<b class="(on|off)"(?: style="background:([^"]+)")?/g)]
    .map(m => [m[1], m[2] || '']);

  ok('步枪按 5 个可装槽位画点', D.slots('m4a1').join(',') === 'optic,grip,stock,muzzle,magazine');
  /* 手枪没有握把/枪托配件，数据里却标了这两槽 —— 不能画成永远灰的死点 */
  ok('手枪只画真能装的槽位', D.slots('glock17').join(',') === 'optic,muzzle,magazine', D.slots('glock17').join(','));
  ok('泵动霰弹没有握把/弹匣槽', D.slots('mp155').join(',') === 'optic,stock,muzzle', D.slots('mp155').join(','));
  ok('不认识的枪不画点', D.html({equip:{kind:'gun',gun:'不存在的枪'}}) === '' && D.slots('不存在的枪').length === 0);

  const bare = dots(D.html(EQUIP.gun('m4a1', 30)));
  ok('空枪每个槽一颗灰点', bare.length === 5 && bare.every(d => d[0] === 'off'));

  const one = dots(D.html(EQUIP.gun('m4a1', 30, null, null, {attachments:{optic:'att_optic04'}})));
  ok('装了配件的槽换成稀有度色', one[0][0] === 'on' && one[0][1] === ctx.RARITY[3].color && one.slice(1).every(d => d[0] === 'off'),
     '瞄具 ' + one[0][1]);
  ok('槽位顺序固定：瞄具在最左', one.length === 5);

  /* 三种输入都该画出同一排点：伪物品 / 解析后的枪 / 枪 id */
  const item = EQUIP.gun('akm', 30, null, null, {attachments:{stock:'att_stock01'}});
  const a = D.html(item), b = D.html(ctx.Attachments.resolve('akm', item.equip.attachments)), c = D.html('akm');
  ok('伪物品与解析后的枪点法一致', dots(a).length === 5 && dots(b).filter(d => d[0] === 'on').length === 1);
  ok('只传 id 也能画出槽位数（不认识具体配件）', dots(c).length === 5 && dots(c).every(d => d[0] === 'off'));

  ok('非枪不画点', D.html(EQUIP.armor(GEAR.make('body', 4))) === '' && D.of(EQUIP.gun('m4a1')) !== null);
  ok('点自带说明（悬停能看出装的是哪件）', D.html(item).includes('枪托：') && D.html(item).includes('空槽'));
  ok('详情那一行只列已装槽位', D.line(item).includes('枪托 ') && D.line(item).includes('配件 1/5') &&
     D.line(EQUIP.gun('m4a1',30)).includes('尚未安装配件'));
}

console.log('\n=== 彩蛋藏品 ===');
{
  const L = vm.runInContext('Loot', ctx), CFG = ctx.CFG;
  const eggs = ctx.ITEMS.filter(i => i.egg);
  const EGG_V2 = ['collect_secret01', 'elec_secret01', 'elec_secret02'];
  ok('七件彩蛋都在物品表里', eggs.length === 7 &&
     eggs.map(e => e.id).join(',') === 'odd13,odd14,odd15,odd16,' + EGG_V2.join(','),
     eggs.map(e => e.id).join(','));
  ok('彩蛋都是红色孤品、且都是收集品',
     eggs.every(e => e.r === 6 && e.name && e.short && e.w > 0 && e.price > 0 && e.desc.length > 80));
  ok('首版四件归异常遗物、新增三件按题材归位',
     eggs.slice(0,4).every(e => e.cat === 'odd') &&
     vm.runInContext('ITEM_BY_ID.collect_secret01.cat', ctx) === 'collect' &&
     vm.runInContext('ITEM_BY_ID.elec_secret01.cat', ctx) === 'elec' &&
     vm.runInContext('ITEM_BY_ID.elec_secret02.cat', ctx) === 'elec');
  ok('新增三件的价格与文案口径一致',
     vm.runInContext('ITEM_BY_ID.collect_secret01.price', ctx) === 20010000 &&
     vm.runInContext('ITEM_BY_ID.elec_secret01.price', ctx) === 60900000 &&
     vm.runInContext('ITEM_BY_ID.elec_secret02.price', ctx) === 33100000);
  /* 立绘按批次存放：v1 首版四件、v2 新增三件；两批都是 1254×1254 RGBA */
  const eggBatch = id => 'easter-eggs-' + (EGG_V2.includes(id) ? 'v2' : 'v1');
  ok('七件的 48px 图标与立绘原稿都在', eggs.every(e =>
     fs.existsSync(path.join(dir, 'assets/items', e.id + '.png')) &&
     fs.existsSync(path.join(dir, 'assets/item-art', eggBatch(e.id), 'sources', e.id + '.png'))));
  ok('七件都登记进详情原图通道', (() => {
    const artKeys = new Set(JSON.parse(fs.readFileSync(path.join(dir, 'assets/item-details/catalog.json'), 'utf8'))
      .assets.map(a => a.key));
    return eggs.every(e => artKeys.has('items/' + e.id));
  })(), 'catalog.json 里应有 items/<id> 原稿登记');

  /* 常规池必须过滤彩蛋：把概率关掉，抽一万次也不该出现 */
  const keep = CFG.LOOT.eggChance;
  CFG.LOOT.eggChance = 0;
  let leaked = 0;
  for (let i = 0; i < 20000; i++) if (L.roll('secret').item.egg) leaked++;
  ok('关掉概率后常规池永不出彩蛋', leaked === 0, leaked + ' 次泄漏');
  ok('尸体/敌人专属池也过滤彩蛋', L.pickFromPool(eggs) === null);
  CFG.LOOT.eggChance = keep;

  /* 中签率按容器品质分级：垃圾堆里没有彩蛋，越贵的箱子越可能 */
  ok('废弃/普通箱子中签率为 0', L.eggChanceFor('junk') === 0 && L.eggChanceFor('plain') === 0);
  ok('品质越高越容易中签',
     ['ample', 'fine', 'rich', 'secret'].every((q, i, arr) => !i || L.eggChanceFor(q) > L.eggChanceFor(arr[i - 1])),
     ['ample', 'fine', 'rich', 'secret'].map(q => q + ' ' + (L.eggChanceFor(q) * 100).toFixed(0) + '%').join(' / '));
  ok('秘藏箱红里四分之一换成彩蛋', Math.abs(L.eggChanceFor('secret') - 0.25) < 1e-9);
  ok('没有品质信息时回落到 eggChance 兜底', L.eggChanceFor(undefined) === CFG.LOOT.eggChance);
  let junkEgg = 0, plainEgg = 0;
  for (let i = 0; i < 20000; i++) { if (L.roll('junk').item.egg) junkEgg++; if (L.roll('plain').item.egg) plainEgg++; }
  ok('垃圾箱与普通箱实际摸不出彩蛋', junkEgg === 0 && plainEgg === 0, junkEgg + ' / ' + plainEgg);

  /* 概率拉满：红件必换彩蛋，非红件不动 */
  const keepTable = CFG.LOOT.eggByQuality;
  CFG.LOOT.eggByQuality = { junk: 1, plain: 1, ample: 1, fine: 1, rich: 1, secret: 1 };
  ok('红色物品会换成彩蛋', L.eggSwap({item: ctx.ITEM_BY_ID['odd02'], n: 1}, 'secret').item.egg === true);
  ok('非红物品不会被换掉', L.eggSwap({item: ctx.ITEM_BY_ID['life01'], n: 1}, 'secret').item.id === 'life01');
  ok('七件均分（拉满时都会出现）', (() => {
    const seen = new Set();
    for (let i = 0; i < 800; i++) seen.add(L.eggSwap({item: ctx.ITEM_BY_ID['odd02'], n: 1}, 'secret').item.id);
    return seen.size === eggs.length;
  })(), String(eggs.length));
  CFG.LOOT.eggByQuality = keepTable;

  /* 实测：秘藏箱 8% 红 × 25% = 2% 的彩蛋；红档总量不变 */
  const N = 120000, r = [0, 0, 0, 0, 0, 0];
  let egg = 0;
  for (let i = 0; i < N; i++) { const d = L.roll('secret'); if (d.item.egg) egg++; r[d.item.r - 1]++; }
  const eggPct = egg / N * 100, redPct = r[5] / N * 100;
  ok('秘藏箱彩蛋率 ≈ 8% × 25%', Math.abs(eggPct - 2) < 0.2, eggPct.toFixed(3) + '%');
  ok('红色总量仍是 8%（彩蛋从红里分，不额外增加）', Math.abs(redPct - 8) < 0.35, redPct.toFixed(2) + '%');
  ok('秘藏箱红里约 25% 是彩蛋', Math.abs(egg / Math.max(1, r[5]) * 100 - 25) < 1.6,
     (egg / Math.max(1, r[5]) * 100).toFixed(1) + '%');
}

console.log('\n=== 随机入场 / 入场点封闭 ===');
{
  const MM = ctx.M, GG = ctx.Game, R = vm.runInContext('RAID_MAP', ctx);
  const load = (exits) => {
    const map = Object.assign({}, R, exits ? { exits } : {});
    MM.load(map.rows, map.doorAxes, map.props, map);
    MM.chooseInfiltration();       // 局级规则由 startRun 调用，测试里显式走一遍
    return map;
  };
  ok('主图至少有两个撤离点', R.exits.length >= 2, R.exits.length + ' 个');
  load();
  ok('每次进图都会挑一个入场点', !!MM.infiltration && MM.infiltration.closed === true);
  ok('有且只有一个撤离点被封闭', MM.extracts.filter(e => e.closed).length === 1);
  ok('其余撤离点仍然开放', MM.openExtracts().length === MM.extracts.length - 1);
  ok('出生点被改到入场点那一格',
    MM.playerSpawn.x === MM.infiltration.x && MM.playerSpawn.y === MM.infiltration.y,
    JSON.stringify(MM.playerSpawn) + ' vs ' + MM.infiltration.id);

  const first = MM.chooseInfiltration(() => 0);
  ok('rng=0 选第一个候选', first.id === MM.extracts[0].id && first.closed === true, first.id);
  const last = MM.chooseInfiltration(() => 0.999999);
  const candidates = MM.extracts.filter(e => e.spawnable !== false);
  ok('rng→1 选最后一个候选', last.id === candidates[candidates.length - 1].id, last.id);
  ok('重挑时上一个入场点自动解封', MM.extracts.filter(e => e.closed).length === 1 && !first.closed);

  /* spawnable:false 的点只作撤离、不进随机池 */
  const three = R.exits.concat([{ id: 'Z', name: '备用撤离 Z', x: 10, y: 10, spawnable: false }]);
  load(three);
  ok('非入场候选不会被选中', MM.infiltration && MM.infiltration.spawnable !== false && MM.infiltration.id !== 'Z');
  ok('非入场候选仍然可以撤离', MM.openExtracts().some(e => e.id === 'Z'));
  load(three.map(e => Object.assign({}, e, { spawnable: e.id === 'Z' ? false : false })));
  ok('候选不足 2 个时退回固定出生点', MM.infiltration === null && MM.extracts.every(e => !e.closed),
    '入场点 ' + (MM.infiltration && MM.infiltration.id));

  /* 只有 1 个撤离点：不封闭，否则这一局没法通关 */
  load([R.exits[0]]);
  ok('只剩一个撤离点时不封闭', MM.infiltration === null && MM.extracts.length === 1 && !MM.extracts[0].closed);
  ok('固定出生点仍然来自 P 格',
    MM.playerSpawn.x === R.spawn.x && MM.playerSpawn.y === R.spawn.y, JSON.stringify(MM.playerSpawn));

  /* 真随机：连开 100 局，两个点都该被抽到 */
  load();
  const seen = new Set();
  for (let i = 0; i < 100; i++) { const p = MM.chooseInfiltration(); if (p) seen.add(p.id); }
  ok('随机入场会轮到不同撤离点', seen.size >= 2, [...seen].join(','));

  /* 局内：封闭的点进候选表但不给撤离，开放的照常 */
  GG.startRun();
  const closed = MM.extracts.find(e => e.closed);
  ok('开局玩家真的站在入场点上',
    Math.abs(GG.player.x - MM.cx(closed.x)) < 1 && Math.abs(GG.player.y - MM.cy(closed.y)) < 1,
    GG.player.x + ',' + GG.player.y + ' vs ' + MM.cx(closed.x) + ',' + MM.cy(closed.y));
  const near = GG.findInteractables().filter(it => it.type === 'extract');
  ok('封闭的入场点仍在候选表里并带 closed 标记',
    near.some(it => it.obj === closed && it.closed === true), JSON.stringify(near.map(it => [it.obj.id, it.closed])));
  const blocked = { type: 'extract', obj: closed, dist: 0, closed: true };
  ok('封闭点的提示写明已封闭', GG.interactLabel(blocked, true).includes('已封闭'));
  /* 把其它交互目标清掉，让 E 一定落在撤离点上 */
  GG.boxes = []; GG.corpses = []; GG.enemies = [];
  const moveToExit = ex => {
    GG.player.x = MM.cx(ex.x); GG.player.y = MM.cy(ex.y);
    GG.action = null; GG.interactKey = null; GG._interactAnchor = null;
    GG.handleInteract();
  };
  moveToExit(closed);
  ok('在封闭点上按 E 不会开始撤离读条', GG.action === null);
  const open = MM.extracts.find(e => !e.closed);
  moveToExit(open);
  ok('开放撤离点照常开始读条', !!GG.action && GG.action.type === 'extract');
  GG.action = null;
  ok('开放点的提示仍是撤离', GG.interactLabel({ type: 'extract', obj: open }, false).includes('撤离'));
}

console.log('\n=== 容量 / 次数 / 耐久条（CapBar）===');
{
  const CB = vm.runInContext('CapBar', ctx);
  const IC = vm.runInContext('ItemCapacity', ctx);
  const bar = CB.html({ id: 'heal03', n: 1 });
  ok('满容量医疗品画整条绿', /dbar-capacity/.test(bar) && /width:100\.00%/.test(bar) && /width:0\.00%/.test(bar), bar);
  ok('医疗条不画护甲那种红色损耗段', !/class="dr"/.test(bar));
  ok('满容量读数跟着条走', /当前容量 120 \/ 120/.test(bar) && CB.label({ id: 'heal03', n: 1 }) === '当前容量 120 / 120');
  const used = CB.html({ id: 'heal03', n: 1, cap: 30 });
  ok('残容量 30/120 → 绿 25% / 灰 75%', /width:25\.00%/.test(used) && /width:75\.00%/.test(used), used);
  const uses = CB.html({ id: 'heal12', n: 1, cap: 2 });
  ok('次数式 2/8 → 绿 25%，标题写剩余次数', /width:25\.00%/.test(uses) && /剩余次数 2 \/ 8/.test(uses), uses);
  ok('满次数式整条绿', /width:100\.00%/.test(CB.html({ id: 'heal12', n: 1 })));
  ok('容量 / 次数比例都取同一个 ratio', CB.ratio({ id: 'heal03', n: 1, cap: 30 }) === 0.25 &&
     CB.ratio({ id: 'heal12', n: 1, cap: 2 }) === 0.25 && CB.ratio({ id: 'heal03', n: 1 }) === 1);
  const keyBar = CB.html({ id: 'door_key_old_apt', n: 1, cap: 5 });
  ok('钥匙也挂同款耐久条（5/10 → 绿 50% / 灰 50%）',
     /dbar-capacity/.test(keyBar) && /width:50\.00%/.test(keyBar) && !/class="dr"/.test(keyBar), keyBar);
  ok('钥匙满耐久整条绿、每开一次锁短 10%',
     /width:100\.00%/.test(CB.html({ id: 'door_key_old_apt', n: 1 })) &&
     CB.ratio({ id: 'door_key_old_apt', n: 1, cap: 5 }) === 0.5 &&
     CB.ratio({ id: 'door_key_old_apt', n: 1, cap: 4 }) === 0.4);
  ok('钥匙条的读数写剩余耐久',
     /剩余耐久 5 \/ 10/.test(keyBar) &&
     /剩余耐久 5 \/ 10/.test(CB.readout({ id: 'door_key_old_apt', n: 1, cap: 5 })));
  ok('普通物品 / 效果未开放的医疗品都没有条',
     CB.html({ id: 'life01', n: 1 }) === '' && CB.html({ id: 'heal11', n: 1 }) === '' &&
     CB.readout({ id: 'life01', n: 1 }) === '');
  ok('cap 越界被夹住，不会出现负宽或超 100%',
     /width:100\.00%/.test(CB.html({ id: 'heal03', n: 1, cap: 999 })) &&
     /width:0\.00%/.test(CB.html({ id: 'heal03', n: 1, cap: -3 })));
  ok('详情表格口径统一成 N / 上限',
     IC.value({ id: 'heal12', n: 1, cap: 2 }) === '2 / 8' &&
     IC.value({ id: 'heal03', n: 1, cap: 30 }) === '30 / 120' &&
     IC.value({ id: 'door_key_old_apt', n: 1, cap: 5 }) === '5 / 10');
  ok('护甲耐久条和医疗条互不串味',
     !/dbar-capacity/.test(vm.runInContext('DuraBar.html(GEAR.make("helmet",3))', ctx)));
}

console.log('\n---------------------------------------');
console.log('  通过 ' + pass + ' / 失败 ' + fail);
console.log('---------------------------------------\n');
process.exit(fail > 0 ? 1 : 0);
