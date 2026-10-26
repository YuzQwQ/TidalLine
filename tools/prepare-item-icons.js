/* 将 imagegen 原稿整理成游戏规格；需要 sharp。
   node tools/prepare-item-icons.js <原稿目录>
   文件映射与提示词见 assets/item-icon-prompts.json。 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const manifest = require('../assets/item-icon-prompts.json');
const sourceDir = process.argv[2];
const only = process.argv[3];
if (!sourceDir) {
  console.error('用法: node tools/prepare-item-icons.js <原稿目录>');
  process.exit(1);
}

async function prepare(entry) {
  const source = path.resolve(sourceDir, entry.source);
  if (!fs.existsSync(source)) throw new Error('找不到原稿: ' + source);
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // 仅做交付规格整理：按透明通道裁出物体，最近邻缩至 40px，四周留 4px。
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] < 128) continue;
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  if (right < left) throw new Error('空白原稿: ' + entry.id);
  const sprite = await sharp(data, { raw: info })
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .resize(40, 40, { fit: 'contain', kernel: 'nearest', background: '#00000000' })
    .raw().toBuffer();
  // 像素边缘不保留半透明抗锯齿。
  for (let i = 3; i < sprite.length; i += 4) sprite[i] = sprite[i] >= 128 ? 255 : 0;
  await sharp(sprite, { raw: { width: 40, height: 40, channels: 4 } })
    .extend({ top: 4, bottom: 4, left: 4, right: 4, background: '#00000000' })
    .png({ palette: true, colours: 32, dither: 0 })
    .toFile(path.join(root, 'assets', 'items', entry.id + '.png'));
  // 独立展示图不进入游戏内嵌表，保留既有 48px 图标接口。
  for (const size of entry.previewSizes || []) {
    const margin = Math.round(size / 12), inner = size - margin * 2;
    const folder = path.join(root, 'assets', 'item-art');
    fs.mkdirSync(folder, { recursive: true });
    await sharp(data, { raw: info }).extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
      .resize(inner, inner, { fit: 'contain', kernel: 'nearest', background: '#00000000' })
      .extend({ top: margin, bottom: margin, left: margin, right: margin, background: '#00000000' })
      .png().toFile(path.join(folder, entry.id + '-' + size + '.png'));
  }
  console.log(entry.id + ': 48×48');
}

(async () => {
  const entries = manifest.items.filter(entry => !only || entry.id === only);
  if (!entries.length) throw new Error('找不到物品 id: ' + only);
  for (const entry of entries) await prepare(entry);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
