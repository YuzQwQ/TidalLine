#!/usr/bin/env node
/* 新建地图模板回归：15 组「预设 × 模板」必须建得出来、只跑通用规则、且立刻是干净的。
 * 重点是最后一条——新图一建就红一片的话，没人会用它开始画。
 */
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const Tpl = require('../design/maps/shared/map-templates.js');
const Core = require('../design/maps/shared/map-core.js');
const { validateMap, RULES } = require('../design/maps/shared/map-validator.js');

const ROOT = path.join(__dirname, '..');
const TEMPLATES = ['blank', 'canal', 'building'];
const SIZES = [[48, 36], [64, 48], [72, 56], [24, 24], [128, 128]];

let failed = 0;
const check = (ok, label, detail) => {
  console.log((ok ? '  ok   ' : '  FAIL ') + label + (detail ? ' — ' + detail : ''));
  if (!ok) failed++;
};
const build = (w, h, template, extra) =>
  Tpl.create(Object.assign({ id: 'test-map', title: '测试图', width: w, height: h, template }, extra || {}));

/* ---------- 1. 15 组全部建得出来，且一建就干净 ---------- */
console.log('=== 预设 × 模板 ===');
for (const [w, h] of SIZES) {
  for (const template of TEMPLATES) {
    const out = build(w, h, template);
    const res = validateMap(out.data, out.rules);
    const label = w + '×' + h + ' ' + template;
    check(res.counts.errors === 0, label + ' 0 错误', res.issues.filter(i => i.level === 'error').map(i => i.rule + ' ' + i.message).slice(0, 3).join(' | '));
    check(res.counts.warnings === 0, label + ' 0 提醒', res.issues.filter(i => i.level === 'warn').map(i => i.rule + ' ' + i.message).slice(0, 3).join(' | '));
    check(out.data.rows.length === h && out.data.rows.every(r => r.length === w), label + ' 行宽与尺寸一致');
  }
}

/* ---------- 2. 只跑通用规则 ---------- */
console.log('\n=== 只跑通用规则 ===');
{
  const out = build(72, 56, 'canal');
  const res = validateMap(out.data, out.rules);
  check(res.checks.length === 18, '18 项全部有结果', res.checks.length);
  check(res.checks.every(c => c.passed), '18 项全部通过');
  const mapRules = RULES.filter(r => r.scope === 'map').map(r => r.code);
  check(mapRules.every(code => !res.issues.some(i => i.rule === code)), 'M1–M6 没有报错（开关全关）');
  check(Object.values(out.rules.expect).every(v => v === null), 'rules.expect 全为 null');
  check(Array.isArray(out.rules.specialChecks) && out.rules.specialChecks.length === 0, 'specialChecks 为空');
}

/* ---------- 3. 边界与图例 ---------- */
console.log('\n=== 边界与图例 ===');
for (const template of TEMPLATES) {
  const { data } = build(48, 36, template);
  let open = 0;
  for (let x = 0; x < data.width; x++) {
    if (data.legend[data.rows[0][x]].walkable) open++;
    if (data.legend[data.rows[data.height - 1][x]].walkable) open++;
  }
  for (let y = 0; y < data.height; y++) {
    if (data.legend[data.rows[y][0]].walkable) open++;
    if (data.legend[data.rows[y][data.width - 1]].walkable) open++;
  }
  check(open === 0, template + ' 四周全部不可通行', open + ' 格可通行');

  const used = new Set(data.rows.join(''));
  const unused = Object.keys(data.legend).filter(ch => !used.has(ch));
  check(unused.length === 0, template + ' 图例没有多余条目', unused.join(' '));
  check(Object.keys(data.legend).every(ch => data.legend[ch].color && data.legend[ch].name), template + ' 图例字段齐全');
}

/* ---------- 4. 出生 / 撤离点 ---------- */
console.log('\n=== 出生与撤离 ===');
for (const template of TEMPLATES) {
  const { data } = build(48, 36, template);
  const walk = (x, y) => Core.isWalkableTerrain(data, x, y);
  check(walk(data.spawn.x, data.spawn.y), template + ' 出生点站得住');
  check(data.exits.length === 2, template + ' 两个撤离点', data.exits.length);
  check(data.exits.every(e => walk(e.x, e.y)), template + ' 撤离点站得住');
  check(data.exits.every(e => !(e.x === data.spawn.x && e.y === data.spawn.y)), template + ' 撤离点不与出生点重合');
  check(new Set(data.exits.map(e => e.id)).size === data.exits.length, template + ' 撤离点编号唯一');
}

/* ---------- 5. 运河模板的实质 ---------- */
console.log('\n=== 双岸运河 ===');
{
  const { data } = build(64, 48, 'canal');
  check(data.bridges.length === 2, '两座桥', data.bridges.length);
  check(data.bridges.every(b => b.tile === '=' && b.width === (b.rect[3] - b.rect[1] + 1)), '桥宽与 rect 一致');
  const canalCols = new Set();
  for (let y = 1; y < data.height - 1; y++) {
    for (let x = 1; x < data.width - 1; x++) if (data.rows[y][x] === '~') canalCols.add(x);
  }
  check(canalCols.size === 6, '运河 6 列', canalCols.size);
  const cols = [...canalCols].sort((a, b) => a - b);
  check(cols[cols.length - 1] - cols[0] === 5, '运河连续无缺口');

  /* 桥必须横跨整条运河，否则过不去 */
  for (const b of data.bridges) {
    let ok = true;
    for (let x = cols[0]; x <= cols[cols.length - 1]; x++) {
      if (data.rows[b.rect[1]][x] !== '=') ok = false;
    }
    check(ok, '桥 ' + b.id + ' 横跨整条运河');
  }
  check(data.plazas.length >= 2, '至少两处院落', data.plazas.length);
}

/* ---------- 6. 单栋建筑模板的实质 ---------- */
console.log('\n=== 单栋建筑 ===');
{
  const { data } = build(48, 36, 'building');
  check(data.buildings.length === 1, '一栋建筑', data.buildings.length);
  const b = data.buildings[0];
  check(b.footprint.length === (b.rect[2] - b.rect[0] + 1) * (b.rect[3] - b.rect[1] + 1), 'footprint 覆盖整个 rect');
  check(data.rooms.length === 5, '四间房 + 一条走廊', data.rooms.length);
  check(data.rooms.some(r => r.id === 'bld.hall'), '走廊登记为房间');
  check(data.portals.length === 6, '四道内门 + 南门 + 东侧门', data.portals.length);

  const outside = data.portals.filter(p => (p.connects || []).includes('outdoors'));
  check(outside.length === 2, '两处室外入口', outside.length);
  for (const p of outside) {
    const [x, y] = p.cells[0];
    check(data.rows[y][x] === '+', p.name + ' 落在门洞字符上', data.rows[y][x]);
  }
  /* 每个房间都至少有一道门 —— 否则室内动线断掉 */
  for (const r of data.rooms) {
    const doors = data.portals.filter(p => (p.connects || []).includes(r.id));
    check(doors.length >= 1, r.name + ' 至少一道门', doors.length);
  }
  check(typeof data.roomFlows.bld === 'string' && data.roomFlows.bld.length > 10, '写了室内动线说明');
}

/* ---------- 7. 尺寸与编号的输入校验 ---------- */
console.log('\n=== 输入校验 ===');
const throws = (spec, label) => {
  let threw = false, msg = '';
  try { Tpl.create(spec); } catch (err) { threw = true; msg = err.message; }
  check(threw, label, msg);
};
throws({ id: 'ok-map', width: 23, height: 36 }, '宽度 23 拒绝');
throws({ id: 'ok-map', width: 48, height: 129 }, '高度 129 拒绝');
throws({ id: 'ok-map', width: 48.5, height: 36 }, '非整数尺寸拒绝');
throws({ id: '', width: 48, height: 36 }, '空编号拒绝');
throws({ id: '地图', width: 48, height: 36 }, '纯中文编号拒绝');
check(Tpl.create({ id: 'My Draft', width: 48, height: 36 }).data.id === 'my-draft', '大写与空格被规范化');
check(Tpl.create({ id: 'ok-map', width: 24, height: 24 }).data.width === 24, '最小尺寸 24 可用');
check(Tpl.create({ id: 'ok-map', width: 128, height: 128 }).data.height === 128, '最大尺寸 128 可用');

/* ---------- 8. 序列化往返 ---------- */
console.log('\n=== 序列化 ===');
{
  const { data } = build(48, 36, 'building');
  const text = Core.serialize(data);
  const back = JSON.parse(text);
  check(Core.serialize(back) === text, '序列化幂等');
  check(!('routes' in back), '不含 routes');
  const missing = Core.FIELD_ORDER.filter(f => !(f in back));
  check(missing.length === 0, '29 个规范字段齐全', missing.join(' '));
  check(Object.keys(back).length === Core.FIELD_ORDER.length, '没有多余字段', Object.keys(back).length);
  check(back.schemaVersion === Core.SCHEMA_VERSION, 'schemaVersion 正确');
}

/* ---------- 9. 确定性 ---------- */
console.log('\n=== 确定性 ===');
{
  const a = Core.serialize(build(64, 48, 'canal').data);
  const b = Core.serialize(build(64, 48, 'canal').data);
  check(a === b, '同参数两次生成逐字节一致');
}

/* ---------- 10. 容器类型库与 js/data.js 同源 ---------- */
console.log('\n=== 容器类型库 ===');
{
  const src = fs.readFileSync(path.join(ROOT, 'js/data.js'), 'utf8');
  const m = /const CONTAINER_TYPES = (\{[\s\S]*?\n\});/.exec(src);
  check(!!m, '能从 js/data.js 取到 CONTAINER_TYPES');
  if (m) {
    const game = vm.runInNewContext('(' + m[1] + ')', {});
    const lib = Tpl.CONTAINER_TYPES;
    const gameKeys = Object.keys(game).sort();
    const libKeys = Object.keys(lib).sort();
    check(JSON.stringify(gameKeys) === JSON.stringify(libKeys), '类型代号完全一致', gameKeys.join('') + ' vs ' + libKeys.join(''));
    const diff = gameKeys.filter(k => !lib[k] || lib[k].name !== game[k].name || lib[k].q !== game[k].q);
    check(diff.length === 0, '名称与品质完全一致', diff.map(k => k + ':' + (lib[k] && lib[k].name) + '/' + game[k].name).join(' '));
  }
}

/* ---------- 11. 新图不会"一放东西就红" ---------- */
console.log('\n=== 建完就能用 ===');
{
  const out = build(48, 36, 'blank');
  const d = out.data;
  d.containers.push({ id: 'c01', region: 'outdoors', type: 'L', x: 5, y: 5, preference: ['life'] });
  d.enemies.push({ id: 'e01', region: 'outdoors', type: 'scav', x: 20, y: 20, patrolRadius: 2 });
  d.props.push({ id: 'p01', region: 'outdoors', type: 'barrel', name: '杂物桶', x: 6, y: 6, solid: true, footprint: [1, 1] });
  const res = validateMap(d, out.rules);
  check(res.counts.errors === 0, '放了一个容器 / 敌人 / 家具后仍然 0 错误',
    res.issues.filter(i => i.level === 'error').map(i => i.rule + ' ' + i.message).slice(0, 4).join(' | '));
  check(d.quotas.containers === null, 'quotas 初始为 null（不约束），点"同步配额"后才成为约束');
}

console.log(failed ? '\n模板回归失败 ' + failed + ' 项' : '\n模板回归全部通过');
process.exitCode = failed ? 1 : 0;
