#!/usr/bin/env node
/* 新建地图落地：把 map-templates 生成的骨架写成 design/maps/<id>/ 三件套。
 * 编辑器里"新建"只能下载 layout.json（浏览器写不了目录），要一次生成
 * layout + rules + README 就用这个脚本，两边用的是同一份生成器。
 *
 *   node tools/new-map.js --id clinic-draft --size 48x36 --template building --title "临海路诊所"
 *   node tools/new-map.js --id canal-test --size 40x30 --template canal --out design/maps/tmp/canal-test --force
 */
'use strict';

const fs = require('fs');
const path = require('path');
const Tpl = require('../design/maps/shared/map-templates.js');
const Core = require('../design/maps/shared/map-core.js');
const { validateMap } = require('../design/maps/shared/map-validator.js');

const ROOT = path.join(__dirname, '..');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  if (i < 0) return fallback;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
}
const flag = name => process.argv.includes('--' + name);

function parseSize(raw) {
  const m = /^(\d+)\s*[x×*]\s*(\d+)$/i.exec(String(raw || ''));
  if (!m) throw new Error('--size 要写成 48x36 这种形式');
  return { width: Number(m[1]), height: Number(m[2]) };
}

function readme(out) {
  const { data, notes, spec } = out;
  const tpl = Tpl.TEMPLATES.find(t => t.id === spec.template);
  const used = Object.keys(data.legend).map(ch => '`' + ch + '` ' + data.legend[ch].name).join(' · ');
  return [
    '# ' + data.title,
    '',
    '> 由 `tools/new-map.js` 按模板 **' + (tpl ? tpl.name : spec.template) + '** 生成，`status` 为 `draft`。',
    '> 重新生成会覆盖这三个文件，先提交再改。',
    '',
    '## 基本信息',
    '',
    '| 项 | 值 |',
    '| --- | --- |',
    '| id | `' + data.id + '` |',
    '| 尺寸 | ' + data.width + ' × ' + data.height + '（tileSize ' + data.tileSize + '） |',
    '| 建筑 / 房间 | ' + data.buildings.length + ' / ' + data.rooms.length + ' |',
    '| 门洞 | ' + data.portals.length + ' |',
    '| 出生点 | (' + data.spawn.x + ', ' + data.spawn.y + ') ' + data.spawn.name + ' |',
    '| 撤离点 | ' + data.exits.map(e => e.id + ' (' + e.x + ', ' + e.y + ')').join(' / ') + ' |',
    '',
    '坐标约定：' + data.coordinateConvention,
    '',
    '## 图例',
    '',
    used,
    '',
    '## 模板做了什么',
    '',
    notes.map(n => '- ' + n).join('\n'),
    '',
    '## 模板没做什么',
    '',
    '- 没有放容器、敌人、家具。这些是设计决策，模板不该替你定。',
    '- 容器**类型定义**已经预置了标准 25 种，调色板里能直接放箱子。',
    '- `rules.json` 的 `expect` 全是 `null`，`specialChecks` 是空的，所以只跑通用规则 G1–G12。',
    '',
    '## 验收清单（待填）',
    '',
    '- [ ] 动线：出生点 → 主要搜刮区 → 撤离点，不走回头路',
    '- [ ] 容器分布与品质配比',
    '- [ ] 敌人布防与间距（3 格内不重复，出生点 12 格内不刷）',
    '- [ ] 定稿后填 `rules.json` 的 `expect`，把 M1–M6 按需打开',
    ''
  ].join('\n');
}

function main() {
  let size;
  try {
    size = parseSize(arg('size', '48x36'));
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
    return;
  }

  const spec = {
    id: arg('id', ''),
    title: arg('title', ''),
    width: size.width,
    height: size.height,
    template: arg('template', 'blank')
  };

  let out;
  try {
    out = Tpl.create(spec);
  } catch (err) {
    console.error('× ' + err.message);
    process.exitCode = 1;
    return;
  }

  const dir = path.resolve(ROOT, String(arg('out', path.join('design/maps', out.data.id))));
  const files = {
    'layout.json': Core.serialize(out.data),
    'rules.json': JSON.stringify(out.rules, null, 2) + '\n',
    'README.md': readme(out)
  };

  if (fs.existsSync(dir) && !flag('force')) {
    console.error('× 目录已存在：' + path.relative(ROOT, dir) + '\n  确认要覆盖就加 --force');
    process.exitCode = 1;
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text, 'utf8');

  const result = validateMap(out.data, out.rules);
  const c = result.counts;
  console.log('已生成 ' + path.relative(ROOT, dir) + '/');
  console.log('  layout.json  ' + out.data.width + '×' + out.data.height + ' · ' + out.data.rows.length + ' 行');
  console.log('  rules.json   expect 全 null（只跑通用规则）');
  console.log('  README.md    验收清单占位');
  console.log('校验：' + c.errors + ' 错误 / ' + c.warnings + ' 提醒');
  if (c.errors || c.warnings) {
    for (const i of result.issues.slice(0, 8)) console.log('  ' + i.level + ' ' + i.rule + ' ' + i.message);
    process.exitCode = 1;
  }
}

main();
