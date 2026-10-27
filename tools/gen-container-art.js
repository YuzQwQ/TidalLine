/* 容器贴图生成器
   32×32 像素风，与既有 crate_* 一致：亮顶面 + 暗南立面 + 深色描边 + 斑驳噪点。
   纯 node 手写 PNG（项目里没有 sharp / PIL）。
   用法：node tools/gen-container-art.js [名字...]   不传名字则全部重画。 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const W = 32, H = 32;

/* ---------- PNG 编码 ---------- */
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(rgba) {
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0;
    rgba.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---------- 画布 ---------- */
const INK = [20, 22, 17];

function hash(x, y, seed) {
  let h = (seed * 374761393 + x * 668265263 + y * 1274126177) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}
const clamp = v => v < 0 ? 0 : v > 255 ? 255 : v | 0;

function Canvas() {
  const d = Buffer.alloc(W * H * 4);
  const api = {
    d,
    px(x, y, c, a = 255) {
      x |= 0; y |= 0;
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = (y * W + x) * 4;
      d[i] = clamp(c[0]); d[i + 1] = clamp(c[1]); d[i + 2] = clamp(c[2]); d[i + 3] = a;
    },
    get(x, y) {
      if (x < 0 || y < 0 || x >= W || y >= H) return null;
      const i = (y * W + x) * 4;
      return d[i + 3] ? [d[i], d[i + 1], d[i + 2]] : null;
    },
    /* 带噪点的实心填充 */
    fill(x0, y0, x1, y1, c, jit = 8, seed = 1) {
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
          const k = (hash(x, y, seed) - 0.5) * 2 * jit;
          api.px(x, y, [c[0] + k, c[1] + k, c[2] + k]);
        }
    },
    /* 纯色填充，不加噪点（细节用） */
    solid(x0, y0, x1, y1, c) { api.fill(x0, y0, x1, y1, c, 0); },
    hline(x0, x1, y, c, jit = 0, seed = 1) { api.fill(x0, y, x1, y, c, jit, seed); },
    vline(x, y0, y1, c, jit = 0, seed = 1) { api.fill(x, y0, x, y1, c, jit, seed); },
    ellipse(cx, cy, rx, ry, c, jit = 0, seed = 1) {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) {
          const k = (hash(x, y, seed) - 0.5) * 2 * jit;
          api.px(x, y, [c[0] + k, c[1] + k, c[2] + k]);
        }
      }
    },
    round(x0, y0, x1, y1, r, c, jit = 8, seed = 1) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = Math.min(x - x0, x1 - x), dy = Math.min(y - y0, y1 - y);
        if (dx < r && dy < r) {
          const ox = r - dx, oy = r - dy;
          if (ox * ox + oy * oy > r * r + r * 0.8) continue;
        }
        const k = (hash(x, y, seed) - 0.5) * 2 * jit;
        api.px(x, y, [c[0] + k, c[1] + k, c[2] + k]);
      }
    },
    /* 只在已有像素上压暗/提亮，用来做褶皱、磨损 */
    tone(x0, y0, x1, y1, k, a = 1) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const c = api.get(x, y); if (!c) continue;
        api.px(x, y, [c[0] + k, c[1] + k, c[2] + k], Math.round(255 * a));
      }
    },
    /* 斜线（Bresenham），用于背带、线缆 */
    line(x0, y0, x1, y1, c, w = 1) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
      for (let i = 0; i <= n; i++) {
        const x = Math.round(x0 + (x1 - x0) * i / n);
        const y = Math.round(y0 + (y1 - y0) * i / n);
        for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < w; dy++) api.px(x + dx, y + dy, c);
      }
    },
    /* 统一外描边 */
    outline() {
      const copy = Buffer.from(d);
      const alpha = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : copy[(y * W + x) * 4 + 3];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!alpha(x, y)) continue;
        if (!alpha(x - 1, y) || !alpha(x + 1, y) || !alpha(x, y - 1) || !alpha(x, y + 1)) {
          api.px(x, y, INK);
        }
      }
    }
  };
  return api;
}

/* ---------- 各容器 ---------- */

/* 1 级 · 废纸篓（网格金属，倒锥，露纸） */
function wastepaper() {
  const c = Canvas();
  const metal = [150, 156, 147], metalLit = [190, 195, 184], metalDark = [104, 111, 104], inner = [26, 31, 26];
  // 桶身：竖向条 + 两道横箍，网格做得疏一些，免得缩到 32px 变成一团
  for (let y = 12; y <= 27; y++) {
    const half = Math.round(9 - (y - 11) * 0.3);
    for (let x = 16 - half; x <= 16 + half; x++) {
      const k = (hash(x, y, 7) - 0.5) * 12;
      const rib = (x % 4 === 0) || (y === 12 || y === 19 || y === 26);
      const base = rib ? metalDark : (x % 4 === 1 ? metalLit : metal);
      c.px(x, y, [base[0] + k, base[1] + k, base[2] + k]);
    }
  }
  // 开口：外圈亮边 → 内壁
  c.ellipse(16, 11, 9, 4, metalLit);
  c.ellipse(16, 11, 8, 3.2, metalDark);
  c.ellipse(16, 11, 7, 2.6, inner);
  // 揉皱的纸团：三块，留出黑缝
  const paper = [225, 222, 204], paper2 = [196, 192, 174];
  c.fill(12, 10, 14, 12, paper, 5, 3);
  c.px(11, 11, paper2); c.px(15, 11, inner);
  c.fill(17, 9, 19, 11, paper, 5, 4);
  c.px(17, 12, paper2); c.px(20, 11, paper);
  c.px(13, 13, paper2); c.px(18, 12, paper2);
  c.tone(6, 25, 26, 27, -14);
  c.outline();
  return c;
}

/* 1 级 · 遗弃纸箱（瓦楞，盖片外翻，胶带，运输印章） */
function cardboard() {
  const c = Canvas();
  const kraft = [169, 132, 88], kraftDark = [125, 94, 59], kraftLit = [191, 154, 108];
  c.fill(7, 9, 25, 20, kraft, 9, 11);            // 顶面
  c.fill(7, 21, 25, 27, kraftDark, 8, 12);       // 南立面
  // 盖片外翻
  for (let i = 0; i < 5; i++) {
    c.fill(7 - 4 + i, 9 + i, 7 - 1, 16 + i, kraftDark, 7, 13);
    c.fill(26, 9 + i, 29 - i, 16 + i, kraftDark, 7, 14);
  }
  // 瓦楞
  for (let y = 11; y < 20; y += 3) c.hline(8, 24, y, kraftLit, 4, 15);
  // 胶带
  c.fill(15, 9, 17, 27, [203, 192, 165], 5, 16);
  c.vline(15, 9, 27, [216, 205, 178]);
  // 运输印章
  c.fill(18, 23, 24, 25, [141, 74, 60], 6, 17);
  c.hline(19, 23, 24, [168, 96, 78]);
  // 边角压痕
  c.tone(7, 19, 25, 20, -12);
  c.outline();
  return c;
}

/* 1 级 · 遗落的工作服（软塌，双胸袋，一袋鼓起） */
function workwear() {
  const c = Canvas();
  const denim = [59, 74, 102], denimLit = [78, 96, 128], denimDark = [38, 49, 70];
  // 两只袖子先铺出来，躯干再压上去，轮廓才是"摊开的衣服"而不是一团方块
  for (let i = 0; i <= 9; i++) {
    const lx = 10 - Math.round(i * 0.45), rx = 22 + Math.round(i * 0.3);
    c.fill(lx - 3, 13 + i, lx, 13 + i, denim, 10, 21);
    c.fill(rx, 13 + i, rx + 3, 13 + i, denim, 10, 21);
  }
  c.fill(4, 19, 7, 24, denimDark, 9, 22);        // 左袖口
  c.fill(24, 17, 28, 21, denimDark, 9, 22);      // 右袖口
  // 躯干
  c.fill(11, 11, 21, 26, denim, 10, 23);
  // 领口 V
  for (let i = 0; i < 5; i++) c.hline(13 + i, 19 - i, 11 + i, denimDark, 5, 24);
  c.hline(12, 20, 11, denimLit, 4, 25);
  // 拉链
  c.vline(16, 16, 25, denimDark, 4, 26);
  // 胸袋：右袋鼓起
  c.fill(12, 18, 15, 22, denimLit, 7, 27);
  c.fill(18, 17, 21, 21, denimLit, 7, 28);
  c.fill(18, 16, 21, 16, [96, 114, 146], 4, 29);  // 鼓起的袋口高光
  c.hline(12, 15, 18, denimDark, 4, 30);
  c.hline(18, 21, 17, denimDark, 4, 31);
  // 下摆褶皱
  c.tone(11, 24, 21, 26, -14);
  for (let x = 12; x < 21; x += 4) c.vline(x, 23, 25, denimDark, 4, 32);
  c.outline();
  return c;
}

/* 2 级 · 床头柜（窄柜，单抽屉，木纹） */
function bedside() {
  const c = Canvas();
  const wood = [125, 92, 63], woodLit = [146, 111, 78], woodDark = [73, 52, 36];
  c.fill(9, 8, 23, 19, wood, 8, 31);             // 顶面
  c.fill(9, 20, 23, 27, woodDark, 7, 32);        // 立面
  c.fill(22, 19, 23, 27, [58, 41, 28], 5, 33);   // 东侧薄侧面
  for (let y = 10; y < 19; y += 4) c.hline(10, 22, y, woodLit, 4, 34);
  // 抽屉
  c.fill(12, 21, 20, 24, [106, 74, 50], 6, 35);
  c.hline(12, 20, 21, [138, 104, 72], 4, 36);
  c.ellipse(16, 22.5, 1.4, 1.2, [185, 160, 108]);
  // 顶面靠墙压暗
  c.tone(9, 8, 23, 9, -10);
  c.outline();
  return c;
}

/* 2 级 · 员工储物盒（扁平金属，锁扣，白标签） */
function staff() {
  const c = Canvas();
  const steel = [98, 114, 129], steelLit = [132, 147, 160], steelDark = [56, 68, 81];
  c.fill(7, 14, 25, 20, steel, 8, 41);
  c.fill(7, 21, 25, 25, steelDark, 7, 42);
  // 盖沿：一条亮边把顶面和立面分开，轮廓才读得出"盒盖"
  c.hline(7, 25, 20, steelLit, 4, 43);
  c.hline(8, 24, 15, [116, 131, 145], 5, 44);
  // 散热孔
  for (const y of [17, 18]) c.hline(10, 16, y, [46, 57, 70], 3, 45);
  c.hline(10, 16, 19, [64, 76, 90], 4, 46);
  // 白色工号标签
  c.fill(20, 16, 24, 18, [219, 216, 202], 4, 47);
  c.px(21, 17, [150, 148, 136]); c.px(23, 17, [150, 148, 136]);
  // 锁扣
  c.fill(12, 21, 16, 25, [160, 169, 177], 4, 48);
  c.hline(13, 15, 22, [92, 98, 104], 3, 49);
  // 锈斑
  c.px(9, 24, [124, 92, 64]); c.px(21, 24, [124, 92, 64]); c.px(10, 21, [112, 84, 60]);
  c.outline();
  return c;
}

/* 2 级 · 帆布挎包（翻盖，弯背带，金属搭扣） */
function satchel() {
  const c = Canvas();
  const khaki = [154, 138, 98], khakiLit = [175, 159, 118], khakiDark = [110, 97, 66];
  c.round(8, 12, 24, 26, 3, khaki, 9, 51);
  // 翻盖
  c.fill(8, 12, 24, 19, khakiLit, 8, 52);
  c.hline(9, 23, 19, khakiDark, 5, 53);
  c.line(8, 17, 12, 26, khakiDark, 1);
  c.line(24, 17, 20, 26, khakiDark, 1);
  // 搭扣
  c.fill(14, 19, 17, 22, [107, 106, 95], 4, 54);
  c.fill(15, 20, 16, 21, [200, 194, 174], 3, 55);
  // 背带向外弯出
  c.line(23, 14, 29, 8, [86, 64, 46], 3);
  c.line(22, 16, 26, 11, [110, 84, 60], 2);
  // 布褶
  c.tone(9, 22, 23, 25, -12);
  c.outline();
  return c;
}

/* 3 级 · 旅行箱（硬壳，纵向压纹，护角，行李牌） */
function luggage() {
  const c = Canvas();
  const wine = [113, 47, 57], wineLit = [138, 62, 73], wineDark = [78, 31, 39];
  c.fill(5, 12, 26, 20, wine, 9, 61);
  c.fill(5, 21, 26, 25, wineDark, 8, 62);
  // 纵向压纹
  c.vline(11, 12, 24, [88, 35, 44], 6, 63);
  c.vline(20, 12, 24, [88, 35, 44], 6, 64);
  c.vline(12, 12, 24, wineLit, 4, 65);
  c.vline(21, 12, 24, wineLit, 4, 66);
  // 提手
  c.fill(13, 9, 19, 11, [62, 34, 28], 6, 67);
  c.hline(14, 18, 9, [94, 58, 46], 4, 68);
  // 锁扣
  c.fill(13, 21, 15, 25, [169, 139, 82], 5, 69);
  c.fill(18, 21, 20, 25, [169, 139, 82], 5, 70);
  c.px(14, 23, [92, 74, 44]); c.px(19, 23, [92, 74, 44]);
  // 护角
  for (const [x, y] of [[5, 12], [25, 12], [5, 24], [25, 24]]) c.fill(x, y, x, y, [58, 28, 24]);
  c.fill(23, 13, 26, 16, [214, 203, 176], 5, 71);   // 行李牌
  c.px(24, 14, [150, 138, 116]);
  c.outline();
  return c;
}

/* 3 级 · 办公文件柜（低矮，两层抽屉，标签框 + 把手） */
function filing() {
  const c = Canvas();
  const green = [109, 122, 99], greenLit = [132, 145, 120], greenDark = [74, 84, 66];
  c.fill(6, 10, 25, 15, green, 8, 81);
  c.fill(6, 16, 25, 25, greenDark, 7, 82);
  // 两层抽屉
  c.fill(8, 16, 23, 20, [90, 101, 82], 7, 83);
  c.fill(8, 21, 23, 25, [90, 101, 82], 7, 84);
  c.hline(8, 23, 20, [68, 77, 61], 4, 85);
  // 标签框 + 把手
  for (const y of [17, 22]) {
    c.fill(10, y, 13, y + 2, [199, 198, 182], 4, 86);
    c.hline(16, 21, y + 1, [169, 173, 166], 4, 87);
  }
  // 掉漆
  c.px(7, 12, [146, 142, 120]); c.px(24, 11, [146, 142, 120]); c.px(9, 24, [120, 118, 100]);
  c.outline();
  return c;
}

/* 3 级 · 运动包（竖立圆角，主拉链袋，露纸角） */
function schoolbag() {
  const c = Canvas();
  const nylon = [90, 106, 124], nylonLit = [108, 125, 143], nylonDark = [64, 77, 92];
  c.round(9, 8, 23, 27, 4, nylon, 9, 91);
  // 主袋
  c.round(11, 13, 21, 24, 2, nylonLit, 8, 92);
  c.hline(11, 21, 13, nylonDark, 4, 93);
  // 拉链 + 拉头
  c.hline(12, 20, 14, [76, 82, 84], 5, 94);
  c.px(15, 14, [186, 182, 164]); c.px(16, 14, [186, 182, 164]);
  // 拉链半开，露出纸角
  c.fill(12, 11, 16, 14, [228, 223, 206], 4, 95);
  c.fill(17, 12, 18, 14, [204, 199, 182], 3, 96);
  c.px(13, 11, [242, 238, 222]); c.px(15, 12, [196, 191, 174]);
  // 肩带垂落
  c.line(9, 10, 6, 15, [64, 77, 92], 2);
  c.line(23, 10, 26, 16, [64, 77, 92], 2);
  c.fill(11, 22, 21, 23, [70, 84, 100], 5, 97);   // 底部织带
  // 底部暗
  c.tone(9, 25, 23, 27, -14);
  c.outline();
  return c;
}

/* 4 级 · 急救器材箱（扁长，白十字，密封条，搭扣） */
function emergency() {
  const c = Canvas();
  const box = [95, 113, 96], boxLit = [116, 134, 116], boxDark = [65, 79, 66];
  c.fill(5, 11, 27, 19, box, 8, 101);
  c.fill(5, 20, 27, 24, boxDark, 7, 102);
  // 密封胶条内框
  c.solid(7, 12, 25, 12, [125, 138, 118]);
  c.solid(7, 18, 25, 18, [112, 126, 108]);
  // 白十字
  c.fill(15, 12, 17, 18, [223, 226, 214], 4, 103);
  c.fill(12, 14, 20, 16, [223, 226, 214], 4, 104);
  // 搭扣
  c.fill(10, 20, 12, 24, [168, 175, 161], 5, 105);
  c.fill(20, 20, 22, 24, [168, 175, 161], 5, 106);
  // 折叠把手
  c.fill(14, 20, 18, 22, [52, 63, 53], 4, 107);
  c.hline(14, 18, 20, [138, 146, 132], 4, 108);
  // 划痕
  c.px(7, 15, boxLit); c.px(24, 16, boxLit); c.px(9, 21, [96, 84, 66]);
  c.outline();
  return c;
}

/* 4 级 · 通讯设备箱（厚壁，波纹标识，护角，线缆） */
function comms() {
  const c = Canvas();
  const wall = [60, 76, 96], wallLit = [80, 98, 120], wallDark = [43, 55, 70];
  c.fill(6, 9, 25, 19, wall, 8, 111);
  c.fill(6, 20, 25, 24, wallDark, 7, 112);
  // 波纹标识：三层弧线，缩到 32px 也读得出"信号"
  const wave = [150, 170, 190];
  c.px(16, 11, wave); c.px(16, 12, wave);
  for (let i = 0; i < 3; i++) {
    const spread = i * 2;
    c.hline(13 - spread, 18 + spread, 14 + i, wave, 3, 111);
  }
  // 银色护角
  for (const [x, y] of [[6, 9], [24, 9], [6, 23], [24, 23]]) c.fill(x, y, x + 1, y + 1, [154, 163, 173]);
  // 搭扣
  c.fill(10, 20, 12, 24, [154, 163, 173], 5, 113);
  c.fill(19, 20, 21, 24, [154, 163, 173], 5, 114);
  // 线缆
  c.line(25, 17, 29, 22, [30, 33, 36], 2);
  c.line(29, 22, 29, 26, [30, 33, 36], 2);
  c.outline();
  return c;
}

/* 4 级 · 救援人员背心（摊开，反光条，多袋，小十字） */
function rescuevest() {
  const c = Canvas();
  const orange = [178, 106, 58], orangeDark = [138, 78, 40], grey = [76, 81, 87];
  c.fill(9, 13, 23, 27, orange, 9, 121);
  // 肩带
  c.fill(10, 8, 13, 14, orange, 8, 122);
  c.fill(19, 8, 22, 14, orange, 8, 123);
  // V 领
  for (let i = 0; i < 5; i++) c.hline(14 + i, 18 - i, 13 + i, [52, 56, 60], 6, 124);
  // 深灰侧条
  c.fill(9, 13, 10, 27, grey, 6, 125);
  c.fill(22, 13, 23, 27, grey, 6, 126);
  // 反光条
  c.fill(11, 16, 21, 16, [214, 216, 206], 4, 127);
  c.fill(11, 23, 21, 23, [214, 216, 206], 4, 128);
  // 口袋
  c.fill(11, 18, 14, 21, orangeDark, 6, 129);
  c.fill(15, 18, 18, 21, orangeDark, 6, 130);
  c.fill(11, 25, 14, 26, orangeDark, 6, 131);
  // 胸口小十字
  c.solid(19, 18, 20, 20, [226, 228, 218]);
  c.solid(18, 19, 21, 19, [226, 228, 218]);
  c.outline();
  return c;
}

/* 5 级 · 珠宝匣（硬木，黄铜包角，金线，锁孔） */
function jewelry() {
  const c = Canvas();
  const rosewood = [95, 47, 38], roseLit = [118, 61, 50], roseDark = [61, 29, 24];
  c.fill(9, 12, 23, 20, rosewood, 8, 141);
  c.fill(9, 21, 23, 25, roseDark, 7, 142);
  // 顶面木纹
  c.hline(10, 22, 14, roseLit, 5, 143);
  c.hline(10, 22, 18, [82, 40, 32], 4, 144);
  // 金线 + 锁面
  c.solid(11, 16, 21, 17, [206, 172, 96]);
  c.fill(14, 15, 18, 18, [188, 154, 84], 3, 145);
  c.solid(15, 16, 17, 17, [120, 96, 52]);
  // 黄铜包角
  for (const [x, y] of [[9, 12], [22, 12], [9, 24], [22, 24]]) c.fill(x, y, x + 1, y + 1, [188, 152, 80]);
  // 锁孔
  c.fill(15, 21, 17, 24, [176, 140, 74], 5, 146);
  c.px(16, 22, [48, 26, 20]); c.px(16, 23, [48, 26, 20]);
  c.outline();
  return c;
}

/* 5 级 · 皮质旅行包（圆筒横置，黄铜拉链，宽提手，口微张） */
function leatherbag() {
  const c = Canvas();
  const leather = [79, 52, 35], leatherLit = [103, 71, 48], leatherDark = [52, 33, 22];
  // 圆筒：上下边缘收窄
  for (let y = 12; y <= 25; y++) {
    const inset = y < 15 ? 15 - y : (y > 22 ? y - 22 : 0);
    for (let x = 5 + inset; x <= 26 - inset; x++) {
      const k = (hash(x, y, 151) - 0.5) * 16;
      c.px(x, y, [leather[0] + k, leather[1] + k, leather[2] + k]);
    }
  }
  // 包口微张
  c.fill(13, 11, 18, 13, [42, 26, 17], 6, 152);
  c.hline(13, 18, 11, [96, 66, 44], 4, 153);
  // 黄铜拉链
  c.hline(7, 24, 14, [160, 130, 70], 5, 154);
  c.px(24, 14, [196, 168, 100]);
  // 提手
  c.fill(12, 8, 19, 10, [62, 40, 27], 6, 155);
  c.hline(13, 18, 8, [88, 58, 38], 4, 156);
  // 磨损高光
  c.fill(8, 19, 12, 21, leatherLit, 6, 157);
  c.fill(19, 20, 23, 22, leatherLit, 6, 158);
  c.tone(5, 24, 26, 25, -12);
  c.outline();
  return c;
}

/* 6 级 · 机密封存箱（厚钢，加固筋，三锁扣，红封条，编号牌） */
function sealed() {
  const c = Canvas();
  const steel = [77, 83, 87], steelLit = [99, 105, 109], steelDark = [49, 55, 58];
  c.fill(6, 8, 25, 19, steel, 8, 161);
  c.fill(6, 20, 25, 26, steelDark, 7, 162);
  // 两条加固筋
  c.fill(10, 9, 11, 26, steelLit, 6, 163);
  c.fill(20, 9, 21, 26, steelLit, 6, 164);
  c.vline(10, 9, 26, [58, 64, 68], 4, 165);
  c.vline(20, 9, 26, [58, 64, 68], 4, 166);
  // 编号牌
  c.fill(7, 10, 10, 13, [216, 216, 206], 4, 167);
  c.px(8, 11, [90, 90, 84]); c.px(9, 12, [90, 90, 84]);
  // 三个锁扣
  for (const x of [7, 14, 22]) {
    c.fill(x, 21, x + 1, 25, [163, 169, 173], 4, 168);
    c.px(x, 23, [82, 88, 92]);
  }
  // 红色防拆封条
  c.fill(16, 8, 17, 26, [163, 58, 50], 6, 169);
  c.px(16, 14, [204, 92, 80]); c.px(17, 21, [204, 92, 80]);
  c.outline();
  return c;
}

/* 6 级 · 密封公文包（硬壳，金属边框，双锁扣，红封条，铜铭牌） */
function diplomatic() {
  const c = Canvas();
  const shell = [38, 38, 44], shellLit = [56, 56, 64], shellDark = [23, 23, 28];
  c.fill(7, 11, 24, 19, shell, 7, 171);
  c.fill(7, 20, 24, 24, shellDark, 6, 172);
  // 金属边框
  c.hline(7, 24, 11, [135, 139, 146], 4, 173);
  c.hline(7, 24, 19, [116, 120, 128], 4, 174);
  c.vline(7, 11, 24, [128, 132, 140], 4, 175);
  c.vline(24, 11, 24, [128, 132, 140], 4, 176);
  // 提手
  c.fill(12, 8, 19, 10, [26, 26, 32], 5, 177);
  c.hline(13, 18, 8, [120, 124, 132], 4, 178);
  // 双锁扣
  for (const x of [10, 19]) {
    c.fill(x, 20, x + 2, 24, [168, 173, 181], 4, 179);
    c.px(x + 1, 22, [66, 70, 78]);
  }
  // 红封条
  c.fill(15, 11, 16, 24, [166, 56, 46], 6, 180);
  c.px(15, 17, [206, 90, 78]);
  // 铜铭牌
  c.fill(8, 21, 10, 23, [160, 130, 70], 4, 181);
  c.outline();
  return c;
}

const DRAW = {
  crate_wastepaper: wastepaper,
  crate_cardboard: cardboard,
  crate_workwear: workwear,
  crate_bedside: bedside,
  crate_staff: staff,
  crate_satchel: satchel,
  crate_luggage: luggage,
  crate_filing: filing,
  crate_schoolbag: schoolbag,
  crate_emergency: emergency,
  crate_comms: comms,
  crate_rescuevest: rescuevest,
  crate_jewelry: jewelry,
  crate_leatherbag: leatherbag,
  crate_sealed: sealed,
  crate_diplomatic: diplomatic
};

const outDir = path.join(__dirname, '..', 'assets', 'props');
const wanted = process.argv.slice(2);
const names = wanted.length ? wanted : Object.keys(DRAW);
for (const name of names) {
  const fn = DRAW[name];
  if (!fn) { console.error('未知容器贴图：' + name); process.exitCode = 1; continue; }
  const cv = fn();
  fs.writeFileSync(path.join(outDir, name + '.png'), encodePNG(cv.d));
  console.log('已写入', name + '.png');
}
