/* 把 "Pixel Floating Text & Damage Numbers" 素材包的位图字体接进游戏。
   源：temp files/PixelFloatingText/Fonts/<Style>/<Style>_Big.{png,json}（CC0 1.0）
   产物：
     assets/effects/float_<id>.png     图集（16px 字形，含描边与投影像素）
     js/floatfont-data.js              字形矩形表（x/y/w/h/偏移/步进），供 FloatText 排版

   只取 Big 档：Regular 是 8px 字形，游戏逻辑画面 720×480 上要放大 2 倍才看得清，
   放大后笔画反而比 Big 档更粗更碎。Big 档原生 16px，正好和角色（14px 高）一个量级。

   素材包里的 25 段逐帧动画（"128"、"999!"、"LEVEL UP!" 这些）是定死内容的贴条，
   伤害数字是运行时才知道的数，用不上 —— 真正能用的就是这 8 套可任意排版字体。
   目前接了三套：damage（骨白，普通命中）、crit（橙金，爆头）、
   melee（蓝，近战真实伤害）。玩家受伤不再单配一套颜色，按伤害类型走同一张表。

   用法：node tools/build-floatfont.js */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'temp files', 'PixelFloatingText', 'Fonts');
const OUT_IMG = path.join(ROOT, 'assets', 'effects');
const OUT_JS = path.join(ROOT, 'js', 'floatfont-data.js');

/* id → 素材包里的字体名。加新颜色只要在这里加一行，再跑一次。 */
const STYLES = {
  damage: 'Damage',
  crit: 'Critical',
  /* 近战真实伤害：护甲不减免的那类单独给蓝色（Mana），
     和骨白、橙金都拉得开，一眼看出这一下没走护甲结算。
     原先玩家受伤专用的紫色（Poison）已退役：颜色一律按伤害类型分。 */
  melee: 'Mana'
};

function build() {
  if (!fs.existsSync(SRC)) {
    console.error('找不到素材包：' + SRC);
    process.exit(1);
  }
  fs.mkdirSync(OUT_IMG, { recursive: true });

  const fonts = {};
  for (const [id, style] of Object.entries(STYLES)) {
    const base = path.join(SRC, style, style + '_Big');
    const meta = JSON.parse(fs.readFileSync(base + '.json', 'utf8'));
    fs.copyFileSync(base + '.png', path.join(OUT_IMG, 'float_' + id + '.png'));

    /* [x, y, w, h, xoffset, yoffset, xadvance] —— 紧凑数组比对象省一半体积，
       一局里要画几千个数字，读字段也快一点 */
    const chars = {};
    for (const c of meta.chars) {
      chars[c.char] = [c.x, c.y, c.w, c.h, c.xoffset, c.yoffset, c.xadvance];
    }
    fonts[id] = {
      sheet: 'effects/float_' + id,
      line: meta.line_height,
      glyphH: meta.glyph_height,
      chars
    };
  }

  /* 一个字形一行：46 个字形 × 2 套，格式化展开会白占两屏，手翻也找不到重点 */
  const blocks = [];
  for (const [id, f] of Object.entries(fonts)) {
    const lines = [];
    lines.push('  ' + id + ': {');
    lines.push("    sheet: '" + f.sheet + "', line: " + f.line + ', glyphH: ' + f.glyphH + ',');
    lines.push('    chars: {');
    const rows = Object.entries(f.chars).map(([ch, g]) =>
      '      ' + JSON.stringify(ch) + ': [' + g.join(',') + ']');
    lines.push(rows.join(',\n'));
    lines.push('    }');
    lines.push('  }');
    blocks.push(lines.join('\n'));
  }
  const js = '/* 生成物，勿手改：node tools/build-floatfont.js\n' +
    '   源 = temp files/PixelFloatingText（CC0 1.0，Pixel Floating Text & Damage Numbers）\n' +
    '   每个字形 = [图集 x, y, 宽, 高, xoffset, yoffset, xadvance]。\n' +
    '   坐标以"文字左上角"为原点，FloatText 负责对齐与缩放。 */\n' +
    'const FLOAT_FONTS = {\n' + blocks.join(',\n') + '\n};\n' +
    "if (typeof module !== 'undefined') module.exports = FLOAT_FONTS;\n";
  fs.writeFileSync(OUT_JS, js, 'utf8');

  const n = Object.keys(fonts).length;
  console.log('位图字体 ' + n + ' 套 → assets/effects/float_*.png + js/floatfont-data.js');
  for (const [id, f] of Object.entries(fonts)) {
    console.log('  ' + id.padEnd(8) + Object.keys(f.chars).length + ' 个字形');
  }
  return fonts;
}

if (require.main === module) build();
module.exports = { build, STYLES };
