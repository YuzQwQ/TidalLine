/* 内置 image_gen 原稿 -> 48×48 装备图标。需要 sharp。
   node tools/prepare-gear-icons.js <原稿目录> */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const manifest = require('../assets/gear-prompts.json');
const sourceDir = process.argv[2];
if (!sourceDir) { console.error('用法: node tools/prepare-gear-icons.js <原稿目录>'); process.exit(1); }
(async () => {
  const folder = path.join(root, 'assets/gear'); fs.mkdirSync(folder, { recursive: true });
  for (const icon of manifest.icons) {
    const { data, info } = await sharp(path.resolve(sourceDir, icon.source)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let left = info.width, top = info.height, right = -1, bottom = -1;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] < 128) continue;
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    if (right < left) throw new Error('空白装备原稿: ' + icon.id);
    const box = icon.box || 40;
    const pixels = await sharp(data, { raw: info }).extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
      .resize(box, box, { fit: 'contain', kernel: 'nearest', background: '#00000000' }).raw().toBuffer();
    for (let i = 3; i < pixels.length; i += 4) pixels[i] = pixels[i] >= 128 ? 255 : 0;
    const margin = (48 - box) / 2;
    await sharp(pixels, { raw: { width: box, height: box, channels: 4 } })
      .extend({ top: margin, bottom: margin, left: margin, right: margin, background: '#00000000' })
      .png({ palette: true, colours: 32, dither: 0 }).toFile(path.join(folder, icon.id + '.png'));
    console.log(icon.id + ': 48×48 / 主体 ' + box + 'px');
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
