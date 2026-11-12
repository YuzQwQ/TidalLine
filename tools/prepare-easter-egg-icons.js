/* 彩蛋立绘 → 48px 背包图标。
   node tools/prepare-easter-egg-icons.js            全部重做
   node tools/prepare-easter-egg-icons.js odd16 collect_secret01   只做指定几件

   和 tools/prepare-item-icons.js 的区别：那套素材是手绘 48px 像素图，缩小用最近邻；
   彩蛋的原稿是 1254px 的大图（平滑光照、半透明边缘），最近邻抽点会碎成一团噪点，
   所以这里用 Lanczos 重采样，再把 alpha 二值化，最后补 4px 透明边 —— 尺寸接口仍是
   40+4×2 的 48px，和别的图标同一接口。原稿不在这里生成，只做整理。

   原稿按批次存放：easter-eggs-v1 是首版四件，easter-eggs-v2 是 2026-11-08 新增三件，
   两批规格完全一致（1254×1254 RGBA），所以共用同一套处理参数。 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const OUT = path.join(root, 'assets/items');
/* id → 立绘批次；加新彩蛋时在这里登记一行即可 */
const EGG_ART = {
  odd13: 'easter-eggs-v1', odd14: 'easter-eggs-v1',
  odd15: 'easter-eggs-v1', odd16: 'easter-eggs-v1',
  collect_secret01: 'easter-eggs-v2', elec_secret01: 'easter-eggs-v2',
  elec_secret02: 'easter-eggs-v2'
};

async function prepare(id) {
  const batch = EGG_ART[id];
  if (!batch) throw new Error('未登记的彩蛋: ' + id);
  const file = path.join(root, 'assets/item-art', batch, 'sources', id + '.png');
  if (!fs.existsSync(file)) throw new Error('缺少原稿: ' + file);
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
  /* 边缘半透明像素在 40px 上会糊成一圈脏边：alpha 一刀切，
     颜色则用它自己的 alpha 预乘回去，避免透明区发黑。 */
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
  const only = process.argv.slice(2);
  const ids = only.length ? only : Object.keys(EGG_ART);
  for (const id of ids) await prepare(id);
})().catch(e => { console.error(e.message); process.exitCode = 1; });
