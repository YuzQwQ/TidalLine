/* 规则级回归：18 条规则逐条喂一个针对性破坏，确认每条都真的会报。
 * 不只是"当前地图能过"——那只能证明校验器没拦错，不能证明它会拦。
 *
 * 两套规则：
 *   mapRules    图上现在用的（手工设计稿，设计类规则已关）→ 只用来验基线干净
 *   strictRules 全约束（配额按当前数据算、M1–M6 全开）→ 用来逐条破坏
 * 分开的原因：规则回归测的是"规则开着会不会拦"，与某张图关不关它无关。 */
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { validateMap, RULES } = require('../design/maps/shared/map-validator.js');

const mapRules = require('../design/maps/linhai-old-quarter/rules.json');
const base = JSON.parse(fs.readFileSync(path.join(__dirname, '../design/maps/linhai-old-quarter/layout.json'), 'utf8'));

const strictRules = Object.assign({}, mapRules, {
  id: 'strict-regression',
  expect: Object.assign({}, mapRules.expect, {
    width: base.width, height: base.height, tileSize: base.tileSize,
    buildings: base.buildings.length,
    containers: base.containers.length,
    enemies: base.enemies.length,
    containerTypes: Object.keys(base.containerTypes).length,
    containerTypesUsed: new Set(base.containers.map(c => c.type)).size,
    exits: base.exits.length,
    bridges: base.bridges.length,
    routes: base.routeSpecs.length,
    windowsMin: 1
  }),
  specialChecks: ['buildingEntrances', 'bridgeOnlyCrossing', 'bankSecurityChain', 'tideReserve', 'indoorRouting', 'clearanceWidth']
});

let failed = 0;
const check = (ok, label, detail) => {
  console.log((ok ? '  ok   ' : '  FAIL ') + label + (detail ? ' — ' + detail : ''));
  if (!ok) failed++;
};
const tile = (d, x, y, ch) => { d.rows[y] = d.rows[y].slice(0, x) + ch + d.rows[y].slice(x + 1); };
const clone = () => JSON.parse(JSON.stringify(base));

const cases = [
  ['G1', '宽度与行宽不符', d => { d.width = 73; }],
  ['G2', '图例缺颜色', d => { delete d.legend['.'].color; }],
  ['G3', '两个容器重叠', d => { d.containers[1].x = d.containers[0].x; d.containers[1].y = d.containers[0].y; }],
  ['G4', '分区标错', d => { d.containers[0].region = 'bank'; }, 'warn'],
  ['G5', '出生点落在墙里', d => { d.spawn = { id: 'spawn', name: 'x', x: 0, y: 0 }; }],
  ['G6', '容器四面封死', d => {
    const c = d.containers[0];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) tile(d, c.x + dx, c.y + dy, '#');
  }, 'warn'],
  ['G7', '敌人贴出生点', d => { const e = d.enemies.find(e => e.region === 'outdoors'); e.x = d.spawn.x + 1; e.y = d.spawn.y; }],
  ['G8', '门洞宽度与格数不符', d => { d.portals[0].width = 3; }],
  ['G9', '撤离点落在墙上', d => { const ex = d.exits[0]; const s = d.rows[ex.y]; d.exits[0] = Object.assign({}, ex, { x: s.indexOf('#'), y: ex.y }); }],
  ['G10', '路线航点不可通行', d => { d.routeSpecs[0].waypoints[0] = [0, 0]; }],
  ['G11', '容器数量与配额不符', d => { d.containers.pop(); }, 'warn'],
  ['G12', '编号重复', d => { d.enemies[1].id = d.enemies[0].id; }],
  ['M1', '橱窗改成可通行', d => { d.legend.w.walkable = true; }],
  ['M2', '净宽被容器占用', d => { d.containers[0].x = 10; d.containers[0].y = 16; }],
  ['M3', '第三条跨河通路', d => { for (let x = 29; x <= 36; x++) tile(d, x, 20, '='); }],
  ['M4', '绕开安保门的侧孔', d => { tile(d, 60, 38, '+'); }],
  ['M5', '潮汐被标记为已实现', d => { d.tide.implemented = true; }],
  ['M6', '封闭检查引用的门不存在', d => { d.portals = d.portals.filter(p => p.id !== 'clinic.pharmacy'); }]
];

console.log('=== 18 条规则逐条破坏 ===');
const covered = new Set();
for (const [code, label, mutate, level] of cases) {
  const want = level || 'error';
  const copy = clone();
  mutate(copy);
  const result = validateMap(copy, strictRules);
  const hit = result.issues.some(i => i.rule === code && i.level === want);
  covered.add(code);
  check(hit, code + ' ' + label + (want === 'warn' ? '（提醒）' : ''),
    hit ? '' : '未触发，实际：' + [...new Set(result.issues.filter(i => i.rule === code).map(i => i.level))].join(',') || '(无输出)');
}

console.log('\n=== 覆盖检查 ===');
const all = RULES.map(r => r.code);
const missing = all.filter(c => !covered.has(c));
check(missing.length === 0, '18 条规则全部有用例', missing.join(',') || '—');
check(new Set(cases.map(c => c[0])).size === all.length, '每个规则编号只对应一个用例');

console.log('\n=== 基线仍然干净 ===');
const clean = validateMap(base, mapRules);
check(clean.counts.errors === 0, '未改动的地图 0 error');
check(clean.checks.length === 18 && clean.checks.every(c => c.passed), '18 项验收全部 passed');

console.log(failed ? '\n规则回归失败 ' + failed + ' 项' : '\n规则回归全部通过');
process.exitCode = failed ? 1 : 0;
