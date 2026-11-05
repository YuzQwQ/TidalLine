/* 爆头判定：真实子弹步进、边界、遮挡与靶场/正式战局一致性。
   node tools/test-range-headshots.js */
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const c = {
  console, WEAPONS: {},
  U: {
    clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
    dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
    rand: (lo, hi) => (lo + hi) / 2
  },
  M: { tx: x => x, ty: y => y, blocksShot: () => false },
  Game: { enemies: [], targets: [], player: {}, impact() {}, sfx() {}, toast() {} }
};
vm.createContext(c);
for (const f of ['config.js', 'entities.js', 'range.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), c, { filename: f });
}
vm.runInContext('globalThis.api = { Bullet, Range, RTarget, CFG };', c);
const { Bullet, Range, RTarget, CFG } = c.api;
let cases = 0;
function fire(angle, offset, speed, phase) {
  const t = new RTarget(100, 100);
  c.Game.targets = [t];
  const distance = 60 + phase * speed / 60 / 4;
  const b = new Bullet(t.x - Math.cos(angle) * distance - Math.sin(angle) * offset,
    t.y - Math.sin(angle) * distance + Math.cos(angle) * offset,
    angle, speed, 'player', 20, 640);
  for (let i = 0; i < 180 && !b.dead; i++) b.update(1 / 60);
  return t;
}
for (const rangeActive of [true, false]) {
 Range.active = rangeActive;
 for (const speed of [150, 480, 620, 1000, 1500]) {
  for (let direction = 0; direction < 8; direction++) {
    for (let phase = 0; phase < 10; phase++) {
      for (const offset of [0, 2.99, -2.99, 3.01, -3.01, 4.39, -4.39, 4.41, -4.41, 9.39, 9.41]) {
        const t = fire(direction * Math.PI / 4, offset, speed, phase / 10);
        const hit = Math.abs(offset) < 9.4;
        const head = Math.abs(offset) < 3;
        assert.equal(t.hits, hit ? 1 : 0, `hit ${speed}/${direction}/${phase}/${offset}`);
        assert.equal(t.headHits, head ? 1 : 0, `head ${speed}/${direction}/${phase}/${offset}`);
        assert(Math.abs(t.dmg - (head ? 30 : hit ? 20 : 0)) < 1e-6);
        cases++;
      }
    }
  }
}
}
// 老判定仅用于靶场对照；离开靶场后自动使用正式判定，即使保留旧版开关。
Range.active = true;
Range.preciseHits = false;
assert.equal(fire(0, 0, 620, 0).headHits, 0);
Range.active = false;
assert.equal(fire(0, 0, 620, 0).headHits, 1);
Range.preciseHits = true;
Range.active = true;
// 墙在身体接触点前则挡住；接触点在墙前则先命中角色。
for (const [wall, hits] of [[90, 0], [95, 1]]) {
  const t = new RTarget(100, 100);
  c.Game.targets = [t];
  c.M.blocksShot = x => x >= wall;
  new Bullet(0, 100, 0, 620, 'player', 20, 640).hitSegment(0, 100, 150, 100);
  assert.equal(t.hits, hits);
}
c.M.blocksShot = () => false;
// 按外圈首次接触排序，而非圆心投影排序；列表顺序不影响结果。
for (const reverse of [false, true]) {
  const small = new RTarget(100, 100), large = new RTarget(110, 100);
  large.r = 20;
  c.Game.targets = reverse ? [large, small] : [small, large];
  new Bullet(0, 100, 0, 620, 'player', 20, 640).hitSegment(0, 100, 150, 100);
  assert.equal(large.hits, 1);
  assert.equal(small.hits, 0);
}
// 移动靶使用本次更新的位置；每发只结算一次，统计/飘字可复位。
const moving = new RTarget(100, 110);
c.Game.targets = [moving];
const b = new Bullet(40, 100, 0, 620, 'player', 20, 640);
b.update(1 / 60);
moving.y = 100;
for (let i = 0; i < 20; i++) b.update(1 / 60);
assert.equal(moving.hits, 1);
assert.equal(moving.headHits, 1);
assert.equal(moving.pops[0].head, true);
moving.reset();
assert.equal(moving.hits + moving.headHits + moving.dmg + moving.pops.length, 0);
assert.equal(CFG.COMBAT.HEAD_MULT, 1.5);
console.log(`PASS: ${cases} stepped shots in range/raid; legacy isolation, walls, target order, moving target, damage and reset`);
