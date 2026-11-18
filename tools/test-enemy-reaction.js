/* 敌人反应链专项：视野覆盖、初次/二次举枪时间、受击转身与记忆点、举枪进度的保留窗口。
   node tools/test-enemy-reaction.js
   ─ 只加载 AI 需要的模块，Game / Firearms / Debuff 用最小 stub，
     不去碰实体与渲染，测的是「感知 → 举枪 → 受击反应」这条链本身。 */
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert/strict');
const ROOT = path.resolve(__dirname, '..');
const ctx = vm.createContext({ console, Math, performance: { now: () => Date.now() },
  Uint8Array, Float32Array, Int32Array, Set, Map, Array, Object, JSON });

for (const f of ['config.js', 'data.js', 'core.js', 'attachment-data.js', 'attachments.js', 'combat.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, { filename: f });
}
vm.runInContext(`
  globalThis.Game = { player: { x: 0, y: 0, r: 6 }, enemies: [], time: 0, sfx(){}, impact(){}, debug: false };
  globalThis.Firearms = { kick(){}, recover(){}, emit(){}, spread(){ return 0; } };
  globalThis.Debuff = { onHit(){}, enemyAttack(){ return null; }, spreadAdd(){ return 0; } };
  globalThis.Loot = { rollBonusMelee(){ return null; } };
  globalThis.canStand = () => true;
`, ctx, { filename: 'stubs' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'human-ai.js'), 'utf8'), ctx, { filename: 'human-ai.js' });

const G = vm.runInContext('({ HumanAI, HUMAN_UNIT_DEFS, ENEMY_TYPES, CFG, U, MAP_ROWS, M, Game })', ctx);
const { HumanAI, HUMAN_UNIT_DEFS, CFG } = G;
vm.runInContext('M.load(MAP_ROWS)', ctx);

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name + (extra ? '  ' + extra : '')); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  ' + extra : '')); }
}

const T = CFG.TILE;
function makeEnemy(key, x, y, angle = 0) {
  const d = HUMAN_UNIT_DEFS[key];
  const e = {
    key, t: d, x, y, angle, r: 6, hp: d.hp, maxHp: d.hp, dead: false,
    helmet: null, body: null, weaponId: d.weapons[0][0], gearLv: 2,
    homeX: x, homeY: y, patrolCd: 0, path: null, pathI: 0, patrolRadius: 2,
    moveAlongPath() { return false; }, setPathTo() { return true; },
    senseMult() { return 1; }, hearNoises() { return null; }
  };
  HumanAI.init(e, { id: 'probe' });
  e.ai.mag = d.reserve && d.reserve[1] ? Math.min(30, d.reserve[1]) : 30;
  e.ai.reserve = 90;
  e.angle = angle;
  return e;
}
const clearStub = () => true;

console.log('\n=== 索敌视野 ===');
{
  const e = makeEnemy('scav', 0, 0, 0);
  HumanAI.clear = clearStub;
  const front = { x: 12 * T, y: 0 };
  const farFront = { x: 15 * T, y: 0 };
  const side = { x: 0, y: 12 * T };
  const beside = { x: 0, y: 2 * T };
  ok('正前方 12 格可见（旧视野 11 格看不到）', HumanAI.sees(e, front));
  ok('15 格外不可见（超出 sight 14）', !HumanAI.sees(e, farFront));
  ok('身后 12 格不可见（超出 120° 扇形）', !HumanAI.sees(e, side));
  ok('贴身 2 格无视朝向', HumanAI.sees(e, beside), '3 格内全向');
}

console.log('\n=== 反应时间 ===');
{
  const scav = makeEnemy('scav', 0, 0, 0);
  const ret = makeEnemy('retriever', 0, 0, 0);
  const cold = HumanAI.aimDuration(scav);
  assert.equal(cold, scav.t.aim, '初次举枪应等于模板 aim');
  ok('拾荒者初次举枪 = 0.85s', Math.abs(cold - 0.85) < 1e-9);
  ok('回收员初次举枪 = 0.65s', Math.abs(HumanAI.aimDuration(ret) - 0.65) < 1e-9);
  scav.ai.aimPrep = true;
  ok('拾荒者锁定后举枪缩到 ' + (HumanAI.aimDuration(scav)).toFixed(3) + 's',
     Math.abs(HumanAI.aimDuration(scav) - 0.85 * HumanAI.WARM) < 1e-9, 'WARM=' + HumanAI.WARM);
  ret.ai.aimPrep = true;
  ok('回收员锁定后举枪 ' + (HumanAI.aimDuration(ret)).toFixed(3) + 's',
     Math.abs(HumanAI.aimDuration(ret) - 0.65 * HumanAI.WARM) < 1e-9);
}

console.log('\n=== 举枪进度保留 ===');
{
  const e = makeEnemy('scav', 0, 0, 0);
  e.ai.phase = 'aim'; e.ai.phaseT = 0.5; e.ai.phaseTotal = 0.85;
  HumanAI.clear = clearStub;
  // 目标丢失：obs 为空 → canShoot 假
  HumanAI.advancePhase(e, 0.2, null);
  ok('短暂丢失目标时 phase 仍是 aim', e.ai.phase === 'aim');
  ok('举枪进度不倒退', Math.abs(e.ai.phaseT - 0.5) < 1e-9, 'phaseT=' + e.ai.phaseT);
  HumanAI.advancePhase(e, HumanAI.AIM_LOST + 0.1, null);
  ok('丢失超过 AIM_LOST 后作废', e.ai.phase === null && e.ai.aimed === false);
}

console.log('\n=== 受击反应 ===');
const realObserve = HumanAI.observe;
{
  const e = makeEnemy('scav', 0, 0, Math.PI); // 背对 +x 方向
  HumanAI.observe = () => null;               // 假装没看见人（远距离点杀）
  const origin = { x: 300, y: 0 };
  HumanAI.hurt(e, 'player', origin);
  ok('受击后进入交战', e.ai.engaged === true);
  ok('记忆点指向来向而不是脚下', Math.abs(e.ai.memory.x - 300) < 1e-9 && Math.abs(e.ai.memory.y) < 1e-9,
     'memory=(' + e.ai.memory.x + ',' + e.ai.memory.y + ')');
  ok('转身朝向来向', Math.abs(U_angDiff(e.angle, 0)) < 1e-6);
  ok('触发一次慌乱位移', !!e.ai.flinch && e.ai.flinch.until > e.ai.clock);

  const blind = makeEnemy('scav', 0, 0, 0);
  HumanAI.hurt(blind, 'player', null);
  ok('没有方向信息也会转身', Math.abs(U_angDiff(blind.angle, 0)) > 0.3, 'angle=' + blind.angle.toFixed(2));
  ok('没有方向信息也会挪步', !!blind.ai.flinch);
}

console.log('\n=== 组间停顿不再立正 ===');
{
  const e = makeEnemy('scav', 160, 160, 0);
  HumanAI.clear = clearStub;
  e.ai.cd = 1.2;
  let moved = false;
  e.setPathTo = () => { moved = true; return true; };
  HumanAI.shuffle(e, { x: 320, y: 160 }, 0.016);
  ok('停顿期给出侧移路径', moved);
}

console.log('\n=== 端到端：站桩对枪 ===');
HumanAI.observe = realObserve;
{
  const play = (key, standoffTiles, frames) => {
    const e = makeEnemy(key, 320, 320, 0);
    HumanAI.clear = clearStub;
    G.Game.player.x = 320 + standoffTiles * T;
    G.Game.player.y = 320;
    G.Game.enemies = [e];
    let firstShot = null;
    for (let i = 0; i < frames; i++) {
      const before = e.ai.shots;
      HumanAI.update(e, 1 / 60);
      if (firstShot === null && e.ai.shots > before) firstShot = i / 60;
    }
    return { firstShot, shots: e.ai.shots, ai: e.ai };
  };
  const a = play('scav', 5, 240);
  ok('拾荒者 5 格内站桩会开火', a.shots > 0, '首发 ' + (a.firstShot ?? '无') + 's，共 ' + a.shots + ' 发');
  ok('首发不早于完整举枪时间', a.firstShot !== null && a.firstShot >= 0.85 * 0.95,
     (a.firstShot ?? 0).toFixed(2) + 's');
  const b = play('retriever', 5, 240);
  ok('回收员 5 格内站桩会开火', b.shots > 0, '首发 ' + (b.firstShot ?? '无') + 's');
  ok('回收员比拾荒者更快开火', b.firstShot < a.firstShot,
     b.firstShot.toFixed(2) + 's < ' + a.firstShot.toFixed(2) + 's');
  const c = play('scav', 20, 120);
  ok('20 格外不开火（超出视野 14 格）', c.shots === 0);
}

function U_angDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

console.log('\n---------------------------------------');
if (fail) { console.log('  失败 ' + fail + ' / 通过 ' + pass); process.exit(1); }
console.log('PASS: ' + pass + ' 项 —— 视野 14 格 / 贴身全向、初次与二次举枪、进度保留窗口、受击转身与侧移');
