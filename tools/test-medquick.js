/* 医疗快捷操作（5 / 快捷栏 / 轮盘 / 治疗进度）的验收测试。
   跑的是真实逻辑：键盘状态机用手动 press/tick/release 驱动，
   只有 DOM 那一层是主流程 mock 出来的空壳，不会碰真实布局。
   node tools/test-medquick.js */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const harness = fs.readFileSync(path.join(root, 'run-test.js'), 'utf8').split('let pass = 0')[0];
const c = new Function('require', '__dirname', harness + '\nreturn ctx;')(require, root);
const { Game, Save, CFG } = c;
const { Medical, byId, MedQuick, MedWheel, MedBar, HealHud, MedHud, ITEM_BY_ID } = vm.runInContext(
  '({Medical,byId:ITEM_BY_ID,MedQuick,MedWheel,MedBar,HealHud,MedHud,ITEM_BY_ID})', c);

Game.init();
let checks = 0;
function test(name, fn) {
  try { fn(); checks++; console.log('OK: ' + name); }
  catch (e) { console.log('FAIL: ' + name + '\n      ' + e.message); process.exitCode = 1; }
}
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

/* 开一局：指定 HP 与背包内容（按给定顺序摆进格子） */
function raid(hp, list) {
  Save.hp = hp;
  Game.startRun({ ammo: 0, bandage: 0, stone: 0, medical: {} });
  Game.enemies = [];
  Game.state = 'playing';
  Game.action = null;
  Game.lootOpen = null;
  if (Game.bagOpen) Game.toggleBag();
  const P = Game.player;
  P.vx = P.vy = 0;
  P.reloadT = 0; P.dodgeT = 0;
  P.hp = hp;
  Game.input.keys = {};
  Game.input.mouseDown = false;
  P.bag.slots = list.map(([id, n, cap]) => ({
    item: byId[id], n: n == null ? 1 : n,
    cap: cap == null ? byId[id].healCap : cap
  }));
  MedHud.reset();
  return P;
}
/* 模拟一次完整按键：按下 → 若干帧 → 松开 */
function tap(holdSec) {
  MedQuick.press();
  let t = 0;
  while (t < holdSec - 1e-9) { const dt = Math.min(1 / 60, holdSec - t); MedQuick.tick(dt); t += dt; }
  return MedQuick.release();
}
function advance(sec, step = 0.05) {
  let t = 0;
  while (Game.action && Game.action.type === 'heal' && t < sec - 1e-9) {
    const dt = Math.min(step, sec - t);
    Game.updateAction(dt); t += dt;
  }
  return t;
}

/* ---------------------------------------------------------------- */
test('短按 5 用背包排序最靠前的医疗品，并记住它', () => {
  const P = raid(30, [['heal03', 1], ['heal05', 1]]);
  assert.equal(MedQuick.typeId, null, '开局没有记忆');
  assert(MedQuick.press());
  MedQuick.tick(0.1);                       // 100ms < 250ms：还是短按
  assert(!MedWheel.isOpen(), '短按不该开轮盘');
  assert(MedQuick.release());
  assert.equal(Game.action && Game.action.type, 'heal');
  assert.equal(Game.action.item.id, 'heal03');
  assert.equal(MedQuick.typeId, 'heal03');
  assert(P.bag.slots.length >= 1);
});

test('长按 250ms 才开轮盘，且长按期间不先吃药', () => {
  raid(30, [['heal01', 3]]);
  MedQuick.HOLD_MS = 250;
  MedQuick.press();
  MedQuick.tick(0.2);                       // 200ms
  assert.equal(Game.action, null, '还没到阈值，不能先治疗');
  assert(!MedWheel.isOpen());
  MedQuick.tick(0.06);                      // 260ms
  assert(MedWheel.isOpen(), '过阈值要开轮盘');
  assert.equal(Game.action, null, '开轮盘不等于用药');
  assert.equal(Game.action, null);
  MedWheel.close();
  MedQuick.release();                       // 轮盘已关，松手什么都不做
  assert.equal(Game.action, null);
});

test('键盘自动重复不会重复开轮盘，也不会退化成短按', () => {
  raid(30, [['heal01', 3], ['heal03', 1]]);
  MedQuick.press();
  assert.equal(MedQuick.press(), false, '重复 keydown 被吞掉');
  MedQuick.tick(0.3);
  assert(MedWheel.isOpen());
  const n = MedWheel.sectors.length;
  MedQuick.tick(0.3);                       // 继续按住
  assert(MedWheel.isOpen() && MedWheel.sectors.length === n, '不会重开一次');
  MedWheel.close();
  MedQuick.release();
  assert.equal(Game.action, null, '这次按住自始至终没有用药');
});

test('同 ID 合并成一个扇区，不同 ID 分开；扇区数 = 种类数', () => {
  raid(30, [['heal01', 5], ['heal02', 2], ['heal02', 1], ['heal04', 1]]);
  const gs = MedQuick.groups();
  assert.equal(gs.length, 3, '绷带 / 敷料 / 野战包 三种');
  assert.equal(gs[0].id, 'heal01');
  assert.equal(gs[0].count, 5);
  assert.equal(gs[0].text, '×5');
  assert.equal(gs[1].count, 3, '两个敷料条目合成一组');
  assert.equal(gs[1].text, '×3');
  assert.equal(gs[2].text, '200/200', '单件显示剩余容量');
  MedWheel.open();
  assert.equal(MedWheel.sectors.length, 3);
});

test('扇区按正上方起、顺时针均分；鼠标在盘外也按方向命中', () => {
  raid(30, [['heal01', 5], ['heal02', 1], ['heal03', 1], ['heal04', 1], ['heal05', 1]]);
  MedWheel.open();
  assert.equal(MedWheel.sectors.length, 5);
  const { cx, cy } = MedWheel;
  assert.equal(MedWheel.hitTest(cx, cy - 120), 0, '正上方 = 第 1 扇区');
  assert.equal(MedWheel.hitTest(cx + 120, cy), 1, '正右 = 第 2 扇区（顺时针）');
  assert.equal(MedWheel.hitTest(cx, cy + 120), 3, '正下 = 第 4 扇区');
  assert.equal(MedWheel.hitTest(cx - 120, cy), 4, '正左 = 第 5 扇区');
  assert.equal(MedWheel.hitTest(cx + 900, cy + 8), 1, '鼠标在盘外，方向依旧有效');
  assert.equal(MedWheel.hitTest(cx - 900, cy - 8), 4);
  MedWheel.close();

  /* 4 种时步长变 90°，分界也跟着走 */
  raid(30, [['heal01', 1], ['heal02', 1], ['heal03', 1], ['heal04', 1]]);
  MedWheel.open();
  assert.equal(MedWheel.sectors.length, 4);
  assert.equal(MedWheel.hitTest(MedWheel.cx, MedWheel.cy - 120), 0);
  assert.equal(MedWheel.hitTest(MedWheel.cx + 120, MedWheel.cy), 1);
  assert.equal(MedWheel.hitTest(MedWheel.cx + 1, MedWheel.cy + 120), 2);
  assert.equal(MedWheel.hitTest(MedWheel.cx - 120, MedWheel.cy), 3);
  /* 2 种：上下两半 */
  MedWheel.close();
  raid(30, [['heal01', 1], ['heal04', 1]]);
  MedWheel.open();
  assert.equal(MedWheel.sectors.length, 2);
  assert.equal(MedWheel.hitTest(MedWheel.cx, MedWheel.cy - 120), 0);
  assert.equal(MedWheel.hitTest(MedWheel.cx, MedWheel.cy + 120), 1);
  /* 1 种：整圈都是一个扇区 */
  MedWheel.close();
  raid(30, [['heal01', 1]]);
  MedWheel.open();
  assert.equal(MedWheel.sectors.length, 1);
  assert.equal(MedWheel.hitTest(MedWheel.cx + 120, MedWheel.cy), 0);
  assert.equal(MedWheel.hitTest(MedWheel.cx - 120, MedWheel.cy), 0);
  MedWheel.close();
});

test('中心死区不选中；死区里松手＝取消，不用药也不改记忆', () => {
  raid(30, [['heal01', 1], ['heal03', 1]]);
  MedQuick.typeId = 'heal01';
  MedWheel.open();
  MedWheel.sel = MedWheel.hitTest(MedWheel.cx + 10, MedWheel.cy + 10);
  assert.equal(MedWheel.sel, -1, '圆心附近不选');
  assert.equal(MedWheel.hitTest(MedWheel.cx + 29, MedWheel.cy), -1);
  assert.equal(MedWheel.hitTest(MedWheel.cx + 31, MedWheel.cy), 1, '出死区就正常命中');
  assert.equal(MedWheel.confirm(), false);
  assert.equal(Game.action, null, '没选中就不吃药');
  assert.equal(MedQuick.typeId, 'heal01', '记忆不变');
});

test('轮盘松手：选中即用、记住类型、快捷栏跟着换', () => {
  const P = raid(20, [['heal01', 3], ['heal03', 1], ['heal05', 1]]);
  MedQuick.typeId = 'heal01';
  MedQuick.press();
  MedQuick.tick(0.3);
  assert(MedWheel.isOpen());
  /* 选中第 3 个扇区（heal05），正下方 */
  MedWheel.sel = MedWheel.hitTest(MedWheel.cx, MedWheel.cy + 130);
  assert.equal(MedWheel.sectors[MedWheel.sel].id, 'heal05');
  assert(MedQuick.release());
  assert.equal(Game.action.item.id, 'heal05', '用的是刚选的那种');
  assert.equal(MedQuick.typeId, 'heal05');
  assert(!MedWheel.isOpen(), '用完把轮盘关掉');
  assert.equal(MedBar.state().id, 'heal05');
  assert.equal(MedBar.state().text, '400/400');
  assert(P.bag.slots.length >= 1);
});

test('短按优先用记住的类型，而不是背包第一件', () => {
  raid(20, [['heal01', 3], ['heal03', 1]]);
  MedQuick.typeId = 'heal03';
  assert(MedQuick.use());
  assert.equal(Game.action.item.id, 'heal03');
});

test('记住的类型用完 → 同类型下一件 → 没有该类型就回退到最靠前的可用品', () => {
  /* 同类型多个实例：先用残容量的那件 */
  raid(20, [['heal03', 1, 120], ['heal03', 1, 40], ['heal01', 2]]);
  MedQuick.typeId = 'heal03';
  const p = MedQuick.pick();
  assert.equal(Medical.entryCap(p.entry), 40, '先消耗用剩的那件');
  assert(MedQuick.use());
  assert.equal(Medical.entryCap(Game.action.unit), 40);

  /* 该类型全空了 → 回退到背包里最靠前的可用品 */
  raid(20, [['heal01', 2], ['heal02', 1]]);
  MedQuick.typeId = 'heal04';           // 背包里根本没有的类型
  assert(MedQuick.use());
  assert.equal(Game.action.item.id, 'heal01', '回退到排序最前的');
  assert.equal(MedQuick.typeId, 'heal01');
});

test('没有可用医疗品时短按只提示，不崩也不空转', () => {
  raid(30, [['heal01', 1, 0]]);          // 容量已归零的残件
  assert.equal(MedQuick.groups().length, 0, '归零的不算可用');
  const st = MedBar.state();
  assert(st.show && st.empty);
  assert.equal(st.text, '无医疗品');
  assert.equal(MedQuick.use(), false);
  assert.equal(Game.action, null);
  assert.equal(MedQuick.press(), true);
  assert.equal(MedQuick.release(), false);
  assert.equal(Game.action, null);
});

test('治疗中短按同种不重启，进度和容量都不重置', () => {
  raid(30, [['heal03', 2]]);
  MedQuick.typeId = 'heal03';
  assert(MedQuick.use());
  const a = Game.action;
  const unit = a.unit;
  advance(1.8);                                   // 走过启动 + 回一点
  const cap0 = Medical.entryCap(unit);
  const hp0 = Game.player.hp;
  assert(hp0 > 30);
  assert.equal(MedQuick.use(), false, '同样的药不重复启动');
  assert.equal(Game.action, a, '还是同一个治疗动作');
  assert.equal(a.t, a.t, '进度没被清零');
  assert.equal(Medical.entryCap(unit), cap0, '容量没重复扣');
  assert.equal(Math.round(Game.player.hp), Math.round(hp0));
});

test('治疗中换药：先中断再启动新药，已恢复 HP 与已扣容量都保留', () => {
  raid(20, [['heal02', 2], ['heal04', 1]]);
  MedQuick.typeId = 'heal02';
  MedQuick.use();
  const oldUnit = Game.action.unit;
  advance(2.5);                                   // 启动 1.8 + 回一点
  const hpMid = Game.player.hp;
  const capMid = Medical.entryCap(oldUnit);
  assert(hpMid > 20 && capMid < 60);

  MedQuick.press();
  MedQuick.tick(0.3);
  MedWheel.sel = MedWheel.hitTest(MedWheel.cx + 130, MedWheel.cy);   // heal04 方向
  const target = MedWheel.sectors[MedWheel.sel].id;
  assert(target !== 'heal02');
  MedQuick.release();
  assert.equal(Game.action.item.id, target);
  assert.equal(Game.player.hp, hpMid, '中断不退还已恢复的 HP');
  assert.equal(Medical.entryCap(oldUnit), capMid, '中断不退还已扣的容量');
  const units = Game.player.bag.slots.filter(s => s.item.id === 'heal02').reduce((n, s) => n + s.n, 0);
  assert.equal(units, 2, '拆出来的那件还在背包里，总数不变');
});

test('治疗中开关背包：不中断、不重置、不重复触发', () => {
  raid(30, [['heal05', 1]]);
  MedQuick.typeId = 'heal05';
  MedQuick.use();
  const a = Game.action;
  advance(1.0);                                    // 启动结束，进入持续
  assert.equal(Game.action.phase, 'active');
  const hp0 = Game.player.hp;

  Game.toggleBag();                                // 打开背包
  assert(Game.bagOpen);
  assert.equal(Game.action, a, '开背包不该中断治疗');
  advance(0.5);
  assert(Game.player.hp > hp0, '背包开着治疗照常推进');
  Game.toggleBag();                                // 关掉
  assert(!Game.bagOpen);
  assert.equal(Game.action, a);
  advance(0.5);
  assert(Game.player.hp > hp0);
  /* 背包开着也能短按用药（这里换一局单独验，见下一条） */
  Medical.finish(Game.action);
});

test('背包打开时短按 5 也能用药，且不重复扣耐久', () => {
  raid(40, [['heal03', 1, 120]]);
  MedQuick.typeId = 'heal03';
  Game.toggleBag();
  assert(Game.bagOpen);
  assert(MedQuick.use());
  assert.equal(Game.action.item.id, 'heal03');
  const unit = Game.action.unit;
  advance(2.0);
  const cap = Medical.entryCap(unit);
  assert(cap < 120 && cap > 0);
  assert.equal(Game.player.bag.slots.filter(s => s.item.id === 'heal03').length, 1, '不会多出一条');
  Game.toggleBag();
});

test('快捷栏显示：单件给容量、多件给数量、残件给当前容量', () => {
  raid(30, [['heal01', 5]]);
  assert.equal(MedBar.state().text, '×5');
  assert.equal(MedBar.state().id, 'heal01');

  raid(30, [['heal05', 1]]);
  assert.equal(MedBar.state().text, '400/400');

  raid(30, [['heal05', 1, 330]]);
  assert.equal(MedBar.state().text, '330/400');

  raid(30, [['heal01', 3], ['heal01', 1, 8]]);
  assert.equal(MedBar.state().text, '×4 · 8/20', '堆叠和残容量都显示出来');

  raid(30, []);
  assert(MedBar.state().empty);
  Game.state = 'base';
  assert.equal(MedBar.state().show, false, '局外不显示快捷栏');
});

test('治疗进度：启动橙色段 → 持续绿色段，数值和 Medical 一致', () => {
  raid(30, [['heal05', 1]]);
  MedQuick.use();
  let st = HealHud.state();
  assert(st.show && st.start);
  assert(/启动/.test(st.top));
  MedHud.tick(0);
  for (let i = 0; i < 8; i++) Game.updateAction(0.05);   // 0.4s
  st = HealHud.state();
  assert(near(st.pct, 0.5, 0.02), '启动进度约一半，实际 ' + st.pct.toFixed(3));
  for (let i = 0; i < 8; i++) Game.updateAction(0.05);   // 0.8s 启动完毕
  st = HealHud.state();
  assert(!st.start, '启动结束');
  assert(/HP\/秒/.test(st.top));
  assert(st.pct < 0.05);
  for (let i = 0; i < 20; i++) Game.updateAction(0.05);  // 回 1 秒
  st = HealHud.state();
  assert(st.pct > 0.02 && st.pct < 0.15, '容量按实际回血扣，实际 ' + st.pct.toFixed(3));
  const cap = Medical.entryCap(Game.action.unit);
  assert(near(cap, 400 - (Game.player.hp - 30), 1.5), '扣掉的容量 = 实际恢复的 HP');

  /* 满血收工 → 进度条消失 */
  while (Game.action && Game.action.type === 'heal') Game.updateAction(0.05);
  assert.equal(HealHud.state().show, false);
});

test('Esc 只收轮盘，正在进行的治疗继续；松手也不会补一次短按', () => {
  raid(30, [['heal03', 2], ['heal05', 1]]);
  MedQuick.use();
  const a = Game.action;
  MedQuick.press();
  MedQuick.tick(0.3);
  assert(MedWheel.isOpen());
  assert(MedQuick.abortWheel());
  assert(!MedWheel.isOpen());
  assert.equal(Game.action, a, '治疗没被打断');
  assert.equal(MedQuick.release(), false, '松手什么都不做');
  assert.equal(Game.action, a);
});

test('页面失焦 / 死亡 / 重新开局都会清掉轮盘与按住状态', () => {
  raid(30, [['heal01', 1], ['heal03', 1]]);
  MedQuick.press();
  MedQuick.tick(0.3);
  assert(MedWheel.isOpen());
  MedQuick.cancel();                       // blur 走这条
  assert(!MedWheel.isOpen());
  assert.equal(MedQuick.pressing, false);

  MedQuick.press();
  MedQuick.tick(0.3);
  assert(MedWheel.isOpen());
  Game.player.hp = 0;
  Game.player.dead = true;
  Game.beginDying();
  assert(!MedWheel.isOpen(), '死亡时轮盘关掉');

  Game.player.dead = false;
  raid(30, [['heal01', 1]]);
  MedQuick.typeId = 'heal05';
  MedHud.reset();
  assert.equal(MedQuick.typeId, null, '新一局重新按背包顺序选');
});

test('边界：只剩残容量时按剩余容量治疗，归零后物品消失', () => {
  raid(95, [['heal01', 1, 3]]);
  MedQuick.use();
  while (Game.action && Game.action.type === 'heal') Game.updateAction(0.05);
  assert(near(Game.player.hp, 98, 0.2), '只回 3 HP，实际 ' + Game.player.hp.toFixed(2));
  assert.equal(Game.player.bag.slots.length, 0, '容量归零的物品被移除');
  assert(MedBar.state().empty);
});

test('背包打开时也能开轮盘、选药、用药', () => {
  raid(30, [['heal01', 2], ['heal03', 1, 120]]);
  Game.toggleBag();
  assert(Game.bagOpen);
  MedQuick.press();
  MedQuick.tick(0.3);
  assert(MedWheel.isOpen(), '背包开着不影响长按');
  MedWheel.sel = MedWheel.hitTest(MedWheel.cx + 130, MedWheel.cy);
  const want = MedWheel.sectors[MedWheel.sel].id;
  assert(MedQuick.release());
  assert.equal(Game.action.item.id, want);
  assert.equal(MedQuick.typeId, want);
  assert(!MedWheel.isOpen());
  Game.toggleBag();
});

test('满血短按不空转：提示而不扣容量', () => {
  const P = raid(100, [['heal05', 1, 400]]);
  assert.equal(MedQuick.use(), false);
  assert.equal(Game.action, null);
  assert.equal(Medical.entryCap(P.bag.slots[0]), 400, '容量不该被扣');
});
