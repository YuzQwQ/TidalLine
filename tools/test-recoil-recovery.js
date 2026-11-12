/* 散布恢复：线性 0.55/s → 半衰期 0.18s 的验收。
   验收点：
     1. 常量：decayHalfLife 存在，旧的线性 decay 已移除
     2. 静止：每 0.18s 减半，1.3s 内回到 0
     3. 延迟：停火 0.15s 内不恢复
     4. 移动：半衰期 = 0.18 / decayMoveMult（更慢）
     5. 潜行：半衰期 = 0.18 / decaySneakMult（更快）
     6. 潜行移动：按潜行优先，不被移动倍率抵消
     7. 帧率无关：30/60/144 FPS 结果一致
     8. 阈值：< 0.01 直接归零
     9. 集成：Player.update 走同一公式，spread 跟着回落
    10. 敌人共用同一个 Firearms.recover
   跑法：node tools/test-recoil-recovery.js */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const head = fs.readFileSync(path.join(root, 'run-test.js'), 'utf8').split('let pass = 0')[0];
const c = new Function('require', '__dirname', head + '\nreturn ctx;')(require, root);
const { CFG, Firearms, Game, Save, Base, EQUIP, BACKPACK, U } = c;

let count = 0; const failures = [];
function test(name, fn) {
  try { fn(); count++; console.log('OK: ' + name); }
  catch (e) { failures.push(name); console.error('FAIL: ' + name + '\n' + e.stack); process.exitCode = 1; }
}
const near = (a, b, t = 1e-9) => assert(Math.abs(a - b) < t, a + ' != ' + b);

/* 模拟真实的每帧顺序：sinceShot 先累加，再恢复（见 Player.update） */
function sim(frames, dt, opt = {}) {
  const s = {
    recoil: opt.recoil == null ? 1 : opt.recoil,
    sinceShot: opt.sinceShot == null ? 10 : opt.sinceShot,
    moving: !!opt.moving, sneaking: !!opt.sneaking,
    rH: 0, rV: 0
  };
  for (let i = 0; i < frames; i++) {
    s.sinceShot += dt;
    Firearms.recover(s, {}, dt);
  }
  return s.recoil;
}

const R = CFG.RECOIL;

test('常量：半衰期 0.18s 已就位，线性 decay 已移除', () => {
  assert.equal(R.decayHalfLife, 0.18);
  assert(!('decay' in R), '不应再保留线性恢复速度字段');
  assert.equal(R.decayDelay, 0.15);
  assert.equal(R.max, 1.0);
});

test('静止：每 0.18s 减半（0.18s→50%、0.36s→25%）', () => {
  near(sim(36, 1 / 200), 0.5, 1e-9);          // 0.18s
  near(sim(72, 1 / 200), 0.25, 1e-9);         // 0.36s
  near(sim(18, 1 / 200), Math.SQRT1_2, 1e-9); // 0.09s
});

test('静止：1.3s 后回到 0（越过 0.01 阈值直接清零）', () => {
  assert.equal(sim(260, 1 / 200), 0);
});

test('停火延迟 0.15s 内完全不恢复', () => {
  /* sinceShot 从 0 起：0.15s 内每帧都在延迟里，recoil 保持 1 */
  const s = { recoil: 1, sinceShot: 0, moving: false, sneaking: false, rH: 0, rV: 0 };
  for (let i = 0; i < 9; i++) { s.sinceShot += 1 / 60; Firearms.recover(s, {}, 1 / 60); }
  assert.equal(s.recoil, 1, '0.15s 内不该掉');
  /* 跨过延迟的第一帧才开始恢复 */
  s.sinceShot += 1 / 60; Firearms.recover(s, {}, 1 / 60);
  assert(s.recoil < 1 && s.recoil > 0.9, '跨过延迟后应开始下降，实际 ' + s.recoil);
});

test('移动：半衰期变长到 0.36s（更慢）', () => {
  near(sim(72, 1 / 200, { moving: true }), 0.5, 1e-9);
  const slow = sim(36, 1 / 200, { moving: true });
  assert(slow > 0.5, '移动中 0.18s 应只掉不到一半，实际 ' + slow);
});

test('潜行：半衰期缩短到 0.18/1.3≈0.138s（更快）', () => {
  near(sim(36, 1 / 200, { sneaking: true }), Math.pow(0.5, 1.3), 1e-9);
  const fast = sim(36, 1 / 200, { sneaking: true });
  const still = sim(36, 1 / 200);
  assert(fast < still, '潜行应比静止恢复更快：' + fast + ' vs ' + still);
});

test('潜行移动：按潜行优先，不被移动倍率抵消', () => {
  const both = sim(36, 1 / 200, { moving: true, sneaking: true });
  const sneak = sim(36, 1 / 200, { sneaking: true });
  near(both, sneak, 1e-12);
  assert(both < 0.5, '潜行挪动仍应快于静止（旧写法会变成 0.65×，反而更慢）实际 ' + both);
});

test('帧率无关：30/60/144 FPS 同一时刻结果一致', () => {
  const a = sim(15, 1 / 30);
  const b = sim(30, 1 / 60);
  const d = sim(72, 1 / 144);
  near(a, Math.pow(0.5, 0.5 / R.decayHalfLife), 1e-12);
  near(b, a, 1e-12);
  near(d, a, 1e-12);
});

test('阈值：低于 0.01 直接归零，避免无限拖尾', () => {
  const s = { recoil: 0.0099, sinceShot: 10, moving: false, sneaking: false, rH: 0, rV: 0 };
  Firearms.recover(s, {}, 1 / 60);
  assert.equal(s.recoil, 0);
});

test('集成：Player.update 实际走半衰期，spread 同步回落', () => {
  Game.init(); Base.render = () => {};
  Save.stash = []; Save.bag = []; Save.credits = 1e7; Save.hp = 100;
  Save.gear = {
    weapons: [EQUIP.gun('m4a1', 30, null, null, { attachments: {} }), null, null],
    back: BACKPACK.make('bag05'), helmet: null, body: null, melee: EQUIP.melee('melee01')
  };
  Save.meleeGiftClaimed = true;
  Game.startRun(null); Game.enemies = []; Game.bullets = [];
  const p = Game.player;
  const still = { mx: 0, my: 0, sneak: false, sprint: false, dodge: false, aimAngle: 0 };
  p.recoil = 0.8; p.sinceShot = R.decayDelay + 1e-6;
  p.syncSpread();                                        // 让 spread 先反映 0.8
  const spread0 = p.spread;
  for (let i = 0; i < 18; i++) p.update(0.01, still);   // 0.18s
  near(p.recoil, 0.4, 1e-6);
  near(p.spread, Firearms.spread(p.weapon, p.recoil), 1e-12);
  assert(p.spread < spread0, '散布应随之收拢：' + spread0 + ' → ' + p.spread);
});

test('敌人共用同一个恢复函数', () => {
  const src = fs.readFileSync(path.join(root, 'js/human-ai.js'), 'utf8');
  assert(/Firearms\.recover\(/.test(src), 'HumanAI 必须调用 Firearms.recover');
  const ent = fs.readFileSync(path.join(root, 'js/entities.js'), 'utf8');
  assert(/Firearms\.recover\(this,this\.weapon,dt\)/.test(ent), 'Player.update 必须调用 Firearms.recover');
});

console.log('\n通过 ' + count + ' 项，失败 ' + failures.length + ' 项');
if (failures.length) { console.error('失败：' + failures.join(' / ')); process.exitCode = 1; }
