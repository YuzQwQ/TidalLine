/* 把 image_gen 原稿整理成场景资源规格（32×32）。
   node tools/prepare-scene-icons.js <原稿目录>
   依赖 sharp（和 prepare-item-icons.js 一样）。

   原稿匹配顺序：manifest 里的 source 字段 → {id}.png
   输出：assets/{group}/{id}.png —— 物体占 28×28，四周 2px 透明边。

   角色是三向图，一条 manifest 记录会展开成 3 个文件：
   player_s.png / player_n.png / player_e.png（朝左由引擎镜像，不需要 _w）。 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const manifest = require('../assets/asset-prompts.json');
const sourceDir = process.argv[2];

if (!sourceDir) {
  console.error('用法: node tools/prepare-scene-icons.js <原稿目录>');
  console.error('原稿文件名用 id.png，例如 player.png / crate_std.png');
  process.exit(1);
}

const SIZE = 32;        // 交付尺寸
const INNER = 28;       // 物体占的尺寸
const MARGIN = 2;       // 四周留边

function findSource(id, entry, dir) {
  const cands = [];
  const reference = dir && entry.sources ? entry.sources[dir] : entry.source;
  if (reference) cands.push(path.resolve(sourceDir, reference));
  cands.push(path.resolve(sourceDir, id + '.png'));
  for (const c of cands) if (fs.existsSync(c)) return c;
  return null;
}

async function prepare(entry, dir) {
  const id = dir ? entry.id + '_' + dir : entry.id;
  const source = findSource(id, entry, dir);
  if (!source) { console.log('跳过 ' + entry.group + '/' + id + '（没有原稿）'); return; }

  const outDir = path.join(root, 'assets', entry.group);
  fs.mkdirSync(outDir, { recursive: true });
  if (entry.group === 'tiles') {
    // 地形必须铺满格子；透明留边只适用于独立的角色和物件。
    await sharp(source).resize(SIZE, SIZE, { fit: 'fill', kernel: 'nearest' })
      .flatten({ background: '#31493f' }).png({ palette: true, colours: 32, dither: 0 })
      .toFile(path.join(outDir, id + '.png'));
    console.log(entry.group + '/' + id + ': ' + SIZE + '×' + SIZE + '（满幅地形）');
    return;
  }

  const { data, info } = await sharp(source).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });

  // 按 alpha 通道裁出实际内容
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] < 128) continue;
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  if (right < left) { console.log('跳过 ' + entry.id + '（原稿是空的）'); return; }

  const sprite = await sharp(data, { raw: info })
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .resize(INNER, INNER, { fit: 'contain', kernel: 'nearest', background: '#00000000' })
    .raw().toBuffer();

  // 像素画不要半透明抗锯齿
  for (let i = 3; i < sprite.length; i += 4) sprite[i] = sprite[i] >= 128 ? 255 : 0;

  await sharp(sprite, { raw: { width: INNER, height: INNER, channels: 4 } })
    .extend({ top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN, background: '#00000000' })
    .png({ palette: true, colours: 32, dither: 0 })
    .toFile(path.join(outDir, id + '.png'));

  console.log(entry.group + '/' + id + ': ' + SIZE + '×' + SIZE);
}

(async () => {
  for (const entry of [...manifest.assets, ...(manifest.optional || [])]) {
    if (entry.facing) {
      for (const d of (entry.dirs || ['s', 'n', 'e'])) await prepare(entry, d);
    } else {
      await prepare(entry, null);
    }
  }
  console.log('\n完成。刷新 美术清单.html 可以看到预览。');
})().catch(err => { console.error(err.message); process.exitCode = 1; });
