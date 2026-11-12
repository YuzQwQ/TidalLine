#!/usr/bin/env node
/* ============================================================
   把开发者靶场导出的 tide-tune.json 写回武器设计表

   靶场只调六项：rpm / aimTime / recoilVMul / recoilHMul /
   spreadGrowthMul / spreadMul。它们属于**单把枪**，所以写到
   design/weapons/arsenal-v1/arsenal.json，再重生成 js/data.js。

   全局物理参数（3.4/2.4/0.075/0.040/0.260、上限、回正速度…）
   不在这里改 —— 那是 js/config.js 的 CFG.RECOIL，直接手改。

   用法：
     node tools/apply-tune.js tide-tune.json             写入并重生成 data.js
     node tools/apply-tune.js tide-tune.json --dry       只列出会改什么
     node tools/apply-tune.js tide-tune.json --test      写完后跑 run-test.js
     node tools/apply-tune.js tide-tune.json --no-build  只改 arsenal.json
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SPEC = path.join(ROOT, 'design/weapons/arsenal-v1/arsenal.json');
const FIELDS = ['rpm', 'aimTime', 'recoilVMul', 'recoilHMul', 'spreadGrowthMul', 'spreadMul'];
const RANGE = {
  rpm: [30, 1200], aimTime: [0.05, 1.2],
  recoilVMul: [0.1, 3], recoilHMul: [0.1, 3],
  spreadGrowthMul: [0.1, 3], spreadMul: [0.2, 2.5]
};

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const dry = args.includes('--dry');
const runTests = args.includes('--test');
const noBuild = args.includes('--no-build');
if (!file) {
  console.error('用法: node tools/apply-tune.js <tide-tune.json> [--dry] [--test] [--no-build]');
  process.exit(1);
}

const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const tunePath = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
if (!fs.existsSync(tunePath)) {
  console.error('找不到文件: ' + tunePath);
  process.exit(1);
}

const tune = readJson(tunePath);
if (tune.version !== 2) {
  console.error('这份 JSON 是 v' + (tune.version == null ? '?' : tune.version) +
    '；六参数靶场导出的是 v2。旧文件请重新在靶场导出一次。');
  process.exit(1);
}

const spec = readJson(SPEC);
const byId = new Map(spec.weapons.map(w => [w.id, w]));
const changes = [];

for (const [id, diff] of Object.entries(tune.weapons || {})) {
  const w = byId.get(id);
  if (!w) { console.warn('arsenal.json 里没有武器 `' + id + '`，跳过'); continue; }
  for (const field of FIELDS) {
    if (!(field in diff)) continue;
    const v = Number(diff[field]);
    if (!Number.isFinite(v)) { console.warn(id + '.' + field + ' 不是数字，跳过'); continue; }
    const [lo, hi] = RANGE[field];
    const next = Math.min(hi, Math.max(lo, v));
    if (next !== v) console.warn(id + '.' + field + ' 超出 [' + lo + ', ' + hi + ']，按 ' + next + ' 写入');
    if (w[field] === next) continue;
    changes.push({ where: id + '.' + field, from: w[field], to: next });
    w[field] = next;
  }
}

if (!changes.length) {
  console.log('没有需要写入的改动。');
  process.exit(0);
}
for (const c of changes) {
  console.log((dry ? '将改 ' : '改 ') + c.where.padEnd(30) + c.from + ' → ' + c.to);
}

if (dry) {
  console.log('\n--dry：未写入任何文件。');
  process.exit(0);
}

fs.writeFileSync(SPEC, JSON.stringify(spec, null, 2) + '\n');
console.log('\n已写入 ' + path.relative(ROOT, SPEC) + '（' + changes.length + ' 项）');

if (noBuild) {
  console.log('--no-build：记得再跑 node tools/build-arsenal.js');
} else {
  require('./build-arsenal.js').build();
  console.log('已重生成 js/data.js');
}

if (runTests) {
  console.log('\n跑 run-test.js …');
  execFileSync(process.execPath, [path.join(ROOT, 'run-test.js')], { stdio: 'inherit', cwd: ROOT });
}
