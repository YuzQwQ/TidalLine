/* 红档扩充批次原稿 → 48px 背包图标。
   node tools/prepare-red-collectibles-icons.js [批次目录]

   原稿是 1254px 的大图（平滑光照、半透明边缘），和彩蛋那批同规格，所以沿用同一套处理：
   Lanczos 重采样 + alpha 二值化 + 四周 4px 透明边。最近邻在这批上会把细节抽成噪点，
   已经对比过，不用。原稿留在 assets/item-art/<批次>/sources/，这里只产出游戏用的 48px。 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const BATCH = process.argv[2] || 'assets/item-art/red-collectibles-v1';
const SRC = path.join(root, BATCH, 'sources');
const OUT = path.join(root, 'assets/items');

async function prepare(id) {
  const file = path.join(SRC, id + '.png');
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // 按 alpha 裁出主体，四周空白不参与缩放，主体才能占满 40px
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] < 24) continue;
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  if (right < left) throw new Error('空白原稿: ' + id);
  const sprite = await sharp(data, { raw: info })
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .resize(40, 40, { fit: 'contain', kernel: 'lanczos3', background: '#00000000' })
    .raw().toBuffer();
  /* 40px 上的半透明边缘会糊成一圈脏边：alpha 一刀切，颜色按自身 alpha 预乘回去，
     否则透明区会发黑。像素图标的二值透明接口不能破，测试也会查 invalidAlpha。 */
  for (let i = 0; i < sprite.length; i += 4) {
    const a = sprite[i + 3];
    if (a < 110) { sprite[i] = sprite[i + 1] = sprite[i + 2] = 0; sprite[i + 3] = 0; continue; }
    sprite[i + 3] = 255;
  }
  await sharp(sprite, { raw: { width: 40, height: 40, channels: 4 } })
    .extend({ top: 4, bottom: 4, left: 4, right: 4, background: '#00000000' })
    .png({ palette: true, colours: 64, dither: 0 })
    .toFile(path.join(OUT, id + '.png'));
  console.log(id + ': 48×48');
}

(async () => {
  const ids = fs.readdirSync(SRC).filter(f => f.endsWith('.png')).map(f => path.basename(f, '.png')).sort();
  if (!ids.length) throw new Error('批次里没有原稿: ' + SRC);
  for (const id of ids) await prepare(id);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
