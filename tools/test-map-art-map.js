#!/usr/bin/env node
/* 美术登记表与磁盘上真实存在的贴图对齐。
 * 编辑器不能读目录（浏览器里没有 fs），所以"哪些家具带 _large 放大版""哪些朝向有变体"
 * 只能写死在 map-art-map.js 里。这个测试就是那份写死的兜底：声明了必须有文件，
 * 有 _large 文件也必须声明——两边任何一边漏了都会在这里红。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const Art = require('../design/maps/shared/map-art-map.js');

const ROOT = path.join(__dirname, '..');
const PROP_DIR = path.join(ROOT, 'assets/props');
const files = new Set(fs.readdirSync(PROP_DIR).filter(f => f.endsWith('.png')).map(f => f.slice(0, -4)));

let failed = 0;
const check = (ok, label, detail) => {
  console.log((ok ? '  ok   ' : '  FAIL ') + label + (detail ? ' — ' + detail : ''));
  if (!ok) failed++;
};

/* ---------- 1. 容器贴图与 js/data.js 同源 ---------- */
console.log('=== 容器贴图 ===');
{
  const src = fs.readFileSync(path.join(ROOT, 'js/data.js'), 'utf8');
  const m = /const CONTAINER_TYPES = (\{[\s\S]*?\n\});/.exec(src);
  check(!!m, '能从 js/data.js 取到 CONTAINER_TYPES');
  const game = vm.runInNewContext('(' + m[1] + ')', {});
  const diff = Object.keys(game).filter(k => Art.CONTAINER_ART[k] !== game[k].art);
  check(diff.length === 0, '25 种容器的贴图名与游戏一致', diff.map(k => k + ':' + Art.CONTAINER_ART[k] + '≠' + game[k].art).join(' '));
  check(Object.keys(Art.CONTAINER_ART).length === Object.keys(game).length, '类型数量一致',
    Object.keys(Art.CONTAINER_ART).length + ' vs ' + Object.keys(game).length);

  const missing = Object.values(Art.CONTAINER_ART).filter(a => !files.has(a));
  check(missing.length === 0, '每个容器贴图文件都在', missing.join(' '));
}

/* ---------- 2. _large 放大版：声明与文件双向对齐 ---------- */
console.log('\n=== 多格放大版 ===');
{
  const onDisk = new Set([...files].filter(f => f.includes('_large')).map(f => f.split('_large')[0]));
  const declared = [...Art.LARGE_BASES];
  const notDeclared = [...onDisk].filter(b => !declared.includes(b));
  const noFile = declared.filter(b => !onDisk.has(b));
  check(notDeclared.length === 0, '磁盘上的 _large 都在 LARGE_BASES 里', notDeclared.join(' '));
  check(noFile.length === 0, 'LARGE_BASES 里的都有 _large 文件', noFile.join(' '));

  for (const base of declared) {
    for (const suffix of ['', '_back', '_side']) {
      check(files.has(base + '_large' + suffix), base + '_large' + suffix + ' 存在');
    }
  }
}

/* ---------- 3. 朝向变体：声明了就得有文件 ---------- */
console.log('\n=== 朝向变体 ===');
{
  const missing = [];
  for (const [base, list] of Object.entries(Art.FACING_VARIANTS)) {
    if (!files.has(base)) missing.push(base);
    for (const f of list) if (!files.has(base + '_' + f)) missing.push(base + '_' + f);
  }
  check(missing.length === 0, '声明的变体文件全部存在', missing.join(' '));

  /* 反向：单格基名的 _side / _back 文件不能被漏声明（排除门、栏杆、台阶那类结构资源） */
  const structural = new Set(Object.keys(Art.ROT_FAMILIES));
  const undeclared = [...files].filter(f => {
    const m = /^(.+)_(side|back)$/.exec(f);
    if (!m) return false;
    const base = m[1];
    if (structural.has(base) || base.startsWith('canal_') || base.startsWith('bridge_')) return false;
    if (base.endsWith('_large') || base.startsWith('door') || base.startsWith('sdoor')) return false;
    return !(Art.FACING_VARIANTS[base] || []).includes(m[2]);
  });
  check(undeclared.length === 0, '磁盘上没有漏登记的朝向变体', undeclared.join(' '));
}

/* ---------- 4. 多格家具选到放大版 ---------- */
console.log('\n=== 选图规则 ===');
{
  const bed = { type: 'bed', name: '床', footprint: [1, 2] };
  check(Art.propVariant(bed, 'front') === 'bed_home_large', '1×2 的床用竖版放大图', Art.propVariant(bed, 'front'));
  check(Art.propVariant(bed, 'side') === 'bed_home_large_side', '横过来的床用横版放大图', Art.propVariant(bed, 'side'));
  check(Art.propVariant(bed, 'back') === 'bed_home_large_back', '背面的床用放大背面图', Art.propVariant(bed, 'back'));

  const wide = { type: 'bench', name: '长凳', footprint: [2, 1] };
  check(Art.propVariant(wide, 'front') === 'bench_wood_large', '2×1 的长凳用横版放大图', Art.propVariant(wide, 'front'));
  check(Art.propVariant(wide, 'side') === 'bench_wood_large_side', '竖过来的长凳用竖版放大图', Art.propVariant(wide, 'side'));

  const chair = { type: 'chair', name: '椅子', footprint: [1, 1] };
  check(Art.propVariant(chair, 'front') === 'chair', '单格椅子用基图', Art.propVariant(chair, 'front'));
  check(Art.propVariant(chair, 'back') === 'chair_back', '单格椅子背面有独立图', Art.propVariant(chair, 'back'));

  const tree = { type: 'tree', name: '院落树木', footprint: [3, 3] };
  check(Art.propVariant(tree, 'front') === 'tree_courtyard_canopy', '3×3 的树用树冠图', Art.propVariant(tree, 'front'));
  check(Art.propVariant(tree, 'back') === 'tree_courtyard_canopy_back', '树冠有背面图', Art.propVariant(tree, 'back'));

  /* 缺图的降级：家具已三向齐全，用不存在的基名验证 fallback 路径 */
  check(Art.resolveFacing('no_such_prop', 'back').exact === false, '缺变体时标记 exact:false');
  check(Art.resolveFacing('no_such_prop', 'back').art === 'no_such_prop', '缺图退回基名');
  check(Art.resolveFacing('no_such_prop', 'back').missing === 'no_such_prop_back', '缺图报出缺的是哪张');

  /* 所有产出的文件名都必须在磁盘上 */
  const produced = new Set();
  for (const t of ['bed', 'bench', 'chair', 'shelf', 'desk', 'sofa', 'counter', 'display', 'stove', 'barrel', 'tree']) {
    for (const fp of [[1, 1], [1, 2], [2, 1], [3, 3]]) {
      for (const f of Art.FACINGS) {
        produced.add(Art.propVariant({ type: t, footprint: fp }, f));
      }
    }
  }
  const bad = [...produced].filter(a => !files.has(a));
  check(bad.length === 0, '所有类型的产图都在磁盘上', bad.join(' '));
}

/* ---------- 5. 屏幕朝向与旋转步进 ---------- */
console.log('\n=== 朝向运算 ===');
{
  check(Art.screenFacing('front', 0) === 'front', '正 + 0° = 正');
  check(Art.screenFacing('front', 90) === 'side', '正 + 90° = 侧');
  check(Art.screenFacing('front', 180) === 'back', '正 + 180° = 背');
  check(Art.screenFacing('front', 270) === 'side', '正 + 270° = 侧');
  check(Art.screenFacing('side', 90) === 'back', '侧 + 90° = 背');
  check(Art.screenFacing('side', 180) === 'side', '侧 + 180° = 侧');
  check(Art.screenFacing('back', 180) === 'front', '背 + 180° = 正');

  check(Art.nextFacing('front', 2) === 'side', '多格件 正 → 侧');
  check(Art.nextFacing('side', 2) === 'front', '多格件 侧 → 正（矩形只有两种长相）');
  check(Art.nextFacing('front', 1) === 'side', '单格件 正 → 侧');
  check(Art.nextFacing('side', 1) === 'back', '单格件 侧 → 背');
  check(Art.nextFacing('back', 1) === 'front', '单格件 背 → 正');

  /* 多格件转两圈必须回到原状：占地与朝向都复原 */
  let facing = 'front', fp = [1, 2];
  for (let i = 0; i < 2; i++) {
    facing = Art.nextFacing(facing, 2);
    fp = [fp[1], fp[0]];
  }
  check(facing === 'front' && fp[0] === 1 && fp[1] === 2, '多格件转 180° 回到原状', facing + ' ' + fp.join('×'));
}

console.log(failed ? '\n美术登记表检查失败 ' + failed + ' 项' : '\n美术登记表检查全部通过');
process.exitCode = failed ? 1 : 0;
