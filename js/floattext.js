/* ============================================================
   位图飘字：素材包的像素字体排版
   ------------------------------------------------------------
   和 pixfont.js 的分工：
     pixfont.js  把系统字体栅格化成点阵，负责**所有界面文字**（中文、HUD、提示）。
                 中文字库太大，只能现场栅格化。
     本文件      只负责**数字与英文短词**，用的是素材包自带的位图字体
                 （16px 字形，描边和投影已经在图里）。伤害数字要一眼看清、
                 还要在暗色场景上立住，现成的点阵图比栅格化的系统字体更硬。

   一套字体 = 一张图集 + 每个字形在图集里的矩形。排版时按 xadvance 推进，
   drawImage 一次画一个字 —— 没有 fillText，所以和画布上被 pixfont 接管的
   fillText 互不干扰。
   ============================================================ */

const FloatText = (function () {
  const DEF = (typeof FLOAT_FONTS !== 'undefined') ? FLOAT_FONTS : {};
  const cache = new Map();     // "字体|文字" → 排好版的字形序列
  const LIMIT = 400;          // 伤害数字的组合有限（几千种），400 条足够兜住一局

  function sheet(font) {
    /* Art 在开局前异步加载 effects/*；还没到位就静默跳过这一帧。
       这里直接查 map：键就是 'effects/float_damage' 这种全路径，
       走 Art.get(group,id) 还要拆一次，没必要。 */
    if (typeof Art === 'undefined' || !Art.map) return null;
    const f = DEF[font];
    return f ? (Art.map[f.sheet] || null) : null;
  }

  /* 排版：把字符串拆成一串"图集矩形 + 落点"，并求出整串的实际包围盒。
     包围盒按真实字形算（不是按 xadvance 累加）—— 数字 1 比 8 窄一半，
     按步进算会让整串偏右，连打时数字看起来在抖。 */
  function layout(font, text) {
    const f = DEF[font];
    if (!f) return null;
    const key = font + '|' + text;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;

    const glyphs = [];
    let pen = 0, minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const ch of String(text)) {
      const g = f.chars[ch];
      if (!g) continue;
      if (ch !== ' ') {                       // 空格只有步进，不占包围盒
        const [sx, sy, w, h, ox, oy] = g;
        glyphs.push([sx, sy, w, h, pen + ox, oy]);
        if (pen + ox < minX) minX = pen + ox;
        if (pen + ox + w > maxX) maxX = pen + ox + w;
        if (oy < minY) minY = oy;
        if (oy + h > maxY) maxY = oy + h;
      }
      pen += g[6];
    }
    const out = glyphs.length
      ? { glyphs, w: maxX - minX, h: maxY - minY, nx: minX, ny: minY }
      : null;

    if (cache.size > LIMIT) {
      let n = 0;
      for (const k of cache.keys()) { cache.delete(k); if (++n > 100) break; }
    }
    cache.set(key, out);
    return out;
  }

  /* 画一串字。x/y 是锚点，默认锚在**底边中点**（伤害数字要"从目标身上冒起来"），
     所以 y 传目标头顶即可，字会整串向上长。
     opts.scale  缩放（整数倍最清晰，动画里短暂的非整数倍看不出来）
     opts.align  'center'（默认）| 'left' | 'right'
     opts.alpha  0~1
     返回实际占用的宽（缩放后），方便调用方排布。 */
  function draw(c, font, text, x, y, opts) {
    const lay = layout(font, text);
    const img = sheet(font);
    if (!lay || !img) return 0;
    const o = opts || {};
    const s = o.scale || 1;
    const w = lay.w * s, h = lay.h * s;
    let x0 = x, y0 = y - h;
    if (o.align === 'left') x0 = x;
    else if (o.align === 'right') x0 = x - w;
    else x0 = x - w / 2;

    const prevSmooth = c.imageSmoothingEnabled;
    const prevA = c.globalAlpha;
    c.imageSmoothingEnabled = false;         // 放大走最近邻，保住硬边
    if (o.alpha != null) c.globalAlpha = prevA * Math.max(0, Math.min(1, o.alpha));
    /* 整数倍时吸附到整像素（像素块严格对齐）；非整数倍（弹出那一瞬间）
       吸附到半像素，免得整串字在纸面上左右抖一格 */
    const snap = Math.abs(s - Math.round(s)) < 1e-3
      ? Math.round
      : (v) => Math.round(v * 2) / 2;
    for (const [sx, sy, gw, gh, gx, gy] of lay.glyphs) {
      const dx = snap(x0 + (gx - lay.nx) * s);
      const dy = snap(y0 + (gy - lay.ny) * s);
      c.drawImage(img, sx, sy, gw, gh, dx, dy, gw * s, gh * s);
    }
    c.globalAlpha = prevA;
    c.imageSmoothingEnabled = prevSmooth;
    return w;
  }

  function width(font, text, scale) {
    const lay = layout(font, text);
    return lay ? lay.w * (scale || 1) : 0;
  }

  function height(font, text, scale) {
    const lay = layout(font, text);
    return lay ? lay.h * (scale || 1) : 0;
  }

  function ready(font) { return !!sheet(font); }

  return { draw, width, height, ready, layout, _cache: cache, fonts: DEF };
})();
