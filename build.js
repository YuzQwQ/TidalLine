/* 把多文件版本打包成单个 HTML —— 双击就能玩，不需要本地服务器。
   会把 assets/ 下所有 png 转成 base64 内联，分享出去不会丢图。
   用法：node build.js */
const fs = require('fs');
const path = require('path');

const dir = __dirname;
require('./tools/build-scene-library.js').build();
if (!process.argv.includes('--assets-only')) require('./tools/build-economy.js').build();
// 地图由设计稿编译，避免多文件版与离线版使用不同点位。
// 纯素材更新沿用已编译的地图快照，不写入或绕过正在编辑的地图草稿。
if (!process.argv.includes('--assets-only')) require('./tools/build-linhai-map.js').build();
// 预计算家具透明边，file:// 无需读取可能受跨域限制的Canvas像素。
require('./tools/build-prop-bounds.js').build();
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

const JS_FILES = ['config.js', 'pixfont.js', 'data.js', 'core.js', 'entities.js',
  'common.js', 'medical.js', 'art.js', 'ui.js', 'save.js', 'base.js',
  'game.js', 'game-update.js', 'game-render.js', 'game-panels.js',
  'medhud.js', 'boot.js'];
const SPRITE_DIRS = ['items', 'chars', 'props', 'tiles', 'anim', 'gear'];

/* ---------- 1. 收集图片并转 base64 ---------- */
const sprites = {};
for (const d of SPRITE_DIRS) {
  const p = path.join(dir, 'assets', d);
  if (!fs.existsSync(p)) continue;
  for (const f of fs.readdirSync(p)) {
    if (!/\.png$/i.test(f)) continue;
    const key = d + '/' + f.replace(/\.png$/i, '');
    sprites[key] = 'data:image/png;base64,' +
      fs.readFileSync(path.join(p, f)).toString('base64');
  }
}

/* ---------- 2. 注入图片表（必须在替换脚本标签之前） ---------- */
let out = html;
const inlineTag = '<script>\nwindow.__SPRITES__ = ' +
  JSON.stringify(sprites) + ';\n</script>';
const anchor = '<script src="js/config.js"></script>';
if (!out.includes(anchor)) {
  console.error('找不到锚点: ' + anchor);
  process.exit(1);
}
out = out.replace(anchor, inlineTag + '\n' + anchor);

/* ---------- 3. 内联全部 js ---------- */
let total = 0;
for (const f of JS_FILES) {
  const code = fs.readFileSync(path.join(dir, 'js', f), 'utf8');
  // 内联脚本里出现 </script> 会提前闭合
  const safe = code.replace(/<\/script>/gi, '<\\/script>');
  const tag = '<script src="js/' + f + '"></script>';
  if (!out.includes(tag)) {
    console.error('找不到占位标签: ' + tag);
    process.exit(1);
  }
  out = out.replace(tag, '<script>\n/* ===== ' + f + ' ===== */\n' + safe + '\n</script>');
  total += code.length;
}

fs.writeFileSync(path.join(dir, '潮汐线.html'), out, 'utf8');

/* ---------- 4. 汇报 ---------- */
const count = Object.keys(sprites).length;
if (count) {
  const kb = (Object.values(sprites)
    .reduce((a, s) => a + s.length, 0) / 1024).toFixed(0);
  const byDir = {};
  for (const k of Object.keys(sprites)) {
    const d = k.split('/')[0];
    byDir[d] = (byDir[d] || 0) + 1;
  }
  console.log('内联图片 ' + count + ' 张（' +
    Object.entries(byDir).map(([d, n]) => d + ' ' + n).join(' / ') +
    '），共 ' + kb + ' KB');
}
const kb = (Buffer.byteLength(out, 'utf8') / 1024).toFixed(1);
console.log('已生成 潮汐线.html  ' + kb + ' KB  （内联脚本 ' + (total / 1024).toFixed(1) + ' KB）');
