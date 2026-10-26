/* ---------------- 程序化像素字体 ----------------
   思路：不去找字体文件，而是把系统字体栅格化成 1 位点阵，再按像素块画回画布。
   笔画边缘一律硬切（二值化），不保留任何抗锯齿 —— 这样它和 720×480 的画面、
   像素贴图是同一套视觉语言，而不是"贴上去的矢量字"。

   三层缓存：
     mask  每个字符在该字号下的点阵位图（裁剪到实际像素范围）
     tint  点阵 + 颜色合成好的小画布，绘制时一次 drawImage
   缓存命中后每帧只是若干次 drawImage，开销可以忽略。
*/

const Pix = (function () {
  const FAMILY = '"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", sans-serif';
  /* 两个关键参数放在 config.js 的 PIXEL_FONT 里，方便直接调 */
  const OPT = (typeof CFG !== 'undefined' && CFG.PIXEL_FONT) || {};
  const TH = OPT.TH != null ? OPT.TH : 0.5;    // 覆盖率阈值
  const SS = OPT.SS || 3;                      // 超采样倍数
  const LIMIT = 1200;       // 着色调色板缓存上限，超了整批丢掉重建

  let capable = null;
  const cache = new Map();
  const scratch = {};

  /* node 里的假 canvas 没有真的像素，检测不过就整体降级成原生 fillText */
  function canRaster() {
    if (capable !== null) return capable;
    capable = false;
    try {
      const t = document.createElement('canvas');
      t.width = t.height = 4;
      const c = t.getContext('2d');
      if (!c || typeof c.getImageData !== 'function') return capable;
      const d = c.getImageData(0, 0, 1, 1);
      if (!d || !d.data || d.data.length < 4) return capable;
      capable = true;
    } catch (e) { capable = false; }
    return capable;
  }

  /* 字号吸附：中文点阵在 12px 以下几乎不可读（笔画挤在一起），
     所以最小一档就定 12，再往上取 16 / 24 */
  function snap(size) {
    if (size <= 12) return 12;
    if (size <= 17) return 16;
    return 24;
  }

  /* 全角 1em、半角 0.5em —— 像素字体就是这两种宽度，比实际字宽整齐得多 */
  function advance(ch, px) {
    return ch.codePointAt(0) > 0x2e7f ? px : Math.max(3, Math.round(px * 0.5));
  }

  function parseFont(str) {
    const bold = /bold|[6-9]00/.test(str || '');
    const m = /([\d.]+)px/.exec(str || '');
    return { size: snap(m ? parseFloat(m[1]) : 12), bold: bold };
  }

  /* 单个字符 → 着色后的点阵画布。
     关键：先在 SS 倍尺寸下栅格化，再按块求平均降采样。
     直接按目标尺寸二值化会丢掉细笔画（"装""盔"这类字最明显），
     超采样相当于把抗锯齿的灰度当"覆盖率"用，笔画分配更接近人工点阵。 */
  function glyph(ch, px, bold, color) {
    const key = ch + '|' + px + (bold ? 'B' : '') + '|' + color;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;

    const pad = 4;
    const gw = px * 2 + pad * 2;              // 目标（降采样后）画布尺寸
    const gh = Math.round(px * 2.6) + pad * 2;
    const W = gw * SS, H = gh * SS;
    const baseY = (px + pad) * SS;            // 基线在放大画布里的位置

    if (!scratch.cv) {
      scratch.cv = document.createElement('canvas');
      scratch.ctx = scratch.cv.getContext('2d');
    }
    const cv = scratch.cv, c = scratch.ctx;
    if (cv.width < W || cv.height < H) { cv.width = W; cv.height = H; }
    else { c.clearRect(0, 0, W, H); }

    c.font = (bold ? 'bold ' : '') + (px * SS) + 'px ' + FAMILY;
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    c.fillStyle = '#fff';
    c.fillText(ch, pad * SS, baseY);

    let img;
    try { img = c.getImageData(0, 0, W, H); } catch (e) { return null; }
    const d = img.data;
    const thr = TH * SS * SS;                 // 每块 SS×SS 个像素的 alpha 之和阈值

    /* 降采样成 1 位点阵 */
    const bits = new Uint8Array(gw * gh);
    let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        let sum = 0;
        for (let dy = 0; dy < SS; dy++) {
          const row = (y * SS + dy) * W;
          for (let dx = 0; dx < SS; dx++) {
            sum += d[(row + x * SS + dx) * 4 + 3];
          }
        }
        if (sum / 255 > thr) {
          bits[y * gw + x] = 1;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) { cache.set(key, null); return null; }   // 空白字符

    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    const out = document.createElement('canvas');
    out.width = bw; out.height = bh;
    const oc = out.getContext('2d');
    const od = oc.createImageData(bw, bh);
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        if (bits[(y + minY) * gw + (x + minX)]) {
          const i = (y * bw + x) * 4;
          od.data[i] = 255; od.data[i + 1] = 255; od.data[i + 2] = 255; od.data[i + 3] = 255;
        }
      }
    }
    oc.putImageData(od, 0, 0);

    /* 用 source-in 把点阵整体染成当前文字颜色 */
    oc.globalCompositeOperation = 'source-in';
    oc.fillStyle = color;
    oc.fillRect(0, 0, bw, bh);

    const g = { cv: out, w: bw, h: bh, base: baseY / SS - minY };
    /* 淘汰按插入顺序删最早的一批 —— 整表清空会让下一帧重建全部字形 */
    if (cache.size > LIMIT) {
      let n = 0;
      for (const k of cache.keys()) {
        cache.delete(k);
        if (++n > 240) break;
      }
    }
    cache.set(key, g);
    return g;
  }

  function width(text, spec) {
    let w = 0;
    for (const ch of String(text)) w += advance(ch, spec.size);
    return w;
  }

  function drawText(c, text, x, y, spec, align, color) {
    const px = spec.size;
    const total = width(text, spec);
    let sx = x;
    if (align === 'center') sx -= total / 2;
    else if (align === 'right') sx -= total;
    sx = Math.round(sx);
    const by = Math.round(y);

    const prevSmooth = c.imageSmoothingEnabled;
    c.imageSmoothingEnabled = false;      // 关键：放大走最近邻，保住硬边
    for (const ch of String(text)) {
      const a = advance(ch, px);
      if (ch !== ' ') {
        const g = glyph(ch, px, spec.bold, color);
        if (g) c.drawImage(g.cv, sx + Math.round((a - g.w) / 2), by - g.base);
      }
      sx += a;
    }
    c.imageSmoothingEnabled = prevSmooth;
  }

  /* 接管一个 2D 上下文：font 只记录不生效，fillText / measureText 全走点阵 */
  function attach(c) {
    if (!c || c.__pix || !canRaster()) return false;
    c.__pix = true;
    c.__font = '10px monospace';
    c.__spec = parseFont(c.__font);

    let proto = Object.getPrototypeOf(c);
    let desc = null;
    while (proto && !desc) {
      desc = Object.getOwnPropertyDescriptor(proto, 'font');
      proto = Object.getPrototypeOf(proto);
    }
    const native = {
      fillText: desc ? null : c.fillText,
      measureText: c.measureText.bind(c)
    };

    Object.defineProperty(c, 'font', {
      configurable: true,
      get() { return this.__font; },
      set(v) { this.__font = v; this.__spec = parseFont(v); }
    });

    c.fillText = function (text, x, y) {
      drawText(this, text, x, y, this.__spec || { size: 12, bold: false },
        this.textAlign, this.fillStyle);
    };
    c.measureText = function (text) {
      return { width: width(String(text), this.__spec || { size: 12, bold: false }) };
    };
    c.strokeText = function (text, x, y) {   // 用两遍错位当描边
      const sp = this.__spec || { size: 12, bold: false };
      const old = this.fillStyle;
      this.fillStyle = 'rgba(0,0,0,0.75)';
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        drawText(this, text, x + dx, y + dy, sp, this.textAlign, this.fillStyle);
      }
      this.fillStyle = old;
      drawText(this, text, x, y, sp, this.textAlign, old);
    };
    void native;
    return true;
  }

  return { attach, width, snap, canRaster, _cache: cache };
})();
