/* image_gen 2×2 原稿 -> 横向 32px 连续帧。需要 sharp。
   node tools/prepare-player-animations.js <原稿目录> */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const manifest = require('../assets/player-animation-prompts.json');
const sourceDir = process.argv[2];
if (!sourceDir) { console.error('请指定原稿目录'); process.exit(1); }

(async () => {
  const folder = path.join(root, 'assets/anim'); fs.mkdirSync(folder, { recursive: true });
  for (const clip of manifest.clips) {
    const file = path.resolve(sourceDir, clip.source);
    const metadata = await sharp(file).metadata();
    const w = Math.floor(metadata.width / 2), h = Math.floor(metadata.height / 2);
    const cells = [];
    const bounds = [];
    for (let frame = 0; frame < clip.frames; frame++) {
      const data = await sharp(file).extract({ left: frame % 2 * w, top: Math.floor(frame / 2) * h, width: w, height: h })
        .ensureAlpha().raw().toBuffer();
      let count = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4 + 3;
        data[i] = data[i] >= 128 ? 255 : 0;
        if (!data[i]) continue;
        count++;
      }
      if (count < 20) throw new Error(clip.id + ' 的第 ' + (frame + 1) + ' 帧为空');
      // 去除越过原稿格线的孤立碎片，保留与主体相邻的细节。
      const labels = new Int32Array(w * h), queue = new Int32Array(w * h), parts = [];
      for (let p = 0; p < labels.length; p++) {
        if (labels[p] || !data[p * 4 + 3]) continue;
        const part = { label: parts.length + 1, count: 0, left: w, top: h, right: -1, bottom: -1 };
        let first = 0, end = 1; queue[0] = p; labels[p] = part.label;
        while (first < end) {
          const pixel = queue[first++], x = pixel % w, y = Math.floor(pixel / w);
          part.count++; part.left = Math.min(part.left, x); part.right = Math.max(part.right, x);
          part.top = Math.min(part.top, y); part.bottom = Math.max(part.bottom, y);
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy, next = ny * w + nx;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h || labels[next] || !data[next * 4 + 3]) continue;
            labels[next] = part.label; queue[end++] = next;
          }
        }
        parts.push(part);
      }
      const main = parts.reduce((a, b) => a.count > b.count ? a : b);
      const kept = new Set(parts.filter(p => p.count >= main.count * 0.08 ||
        p.count >= 20 && Math.max(main.left - p.right, p.left - main.right, main.top - p.bottom, p.top - main.bottom) < Math.min(w, h) * 0.06).map(p => p.label));
      let left = w, top = h, right = -1, bottom = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (!kept.has(labels[p])) { data[p * 4 + 3] = 0; continue; }
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
      bounds.push({ left, top, width: right - left + 1, height: bottom - top + 1 });
      cells.push(data);
    }
    // 同一动作统一缩放，逐帧只校准平移和落脚点，绝不逐帧拉伸身体。
    const size = manifest.actions[clip.state].size || 32;
    const maxDimension = Math.max(...bounds.flatMap(b => [b.width, b.height]));
    const reference = clip.bodyReference;
    const bodyHeight = reference ? (reference.bottom - reference.top) * h : null;
    const scale = bodyHeight ? reference.targetHeight / bodyHeight
      : clip.state === 'death' ? Math.min(26 / bounds[0].height, (size - 4) / maxDimension) : 26 / maxDimension;
    const baseline = size / 2 + 12;
    const frames = [];
    for (const [i, data] of cells.entries()) {
      const box = bounds[i], width = Math.max(1, Math.round(box.width * scale)), height = Math.max(1, Math.round(box.height * scale));
      if (width > size - 4 || height > baseline - 2) throw new Error(clip.id + ' 画布无法容纳当前身体比例，请增加画布，不要缩小人物');
      const buffer = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
        .extract(box).resize(width, height, { fit: 'fill', kernel: 'nearest' }).png().toBuffer();
      const frame = await sharp({ create: { width: size, height: size, channels: 4, background: '#00000000' } })
        .composite([{ input: buffer, left: Math.round((size - width) / 2), top: baseline - height }]).png().toBuffer();
      frames.push({ input: frame, left: i * size, top: 0 });
    }
    await sharp({ create: { width: clip.frames * size, height: size, channels: 4, background: '#00000000' } })
      .composite(frames).png({ palette: true, colours: 32, dither: 0 }).toFile(path.join(folder, clip.id + '.png'));
    console.log(clip.id + ': ' + clip.frames + ' × ' + size + '×' + size);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
