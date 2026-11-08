/* 把多文件版本打包成单个 HTML —— 双击就能玩，不需要本地服务器。
   会把 assets/ 下所有 png 转成 base64 内联，分享出去不会丢图。
   用法：node build.js
        node build.js --assets-only   跳过经济表与地图编译
        node build.js --audio-only    只刷新 assets/audio/bundle.js（改完音效素材时用） */
const fs = require('fs');
const path = require('path');

const dir = __dirname;
/* 只刷音频的时候，别的资源构建一个都不跑：它们会重写页面文件，
   而工作区里可能还有别人没提交的改动，不该被顺手卷进来。 */
const AUDIO_ONLY = process.argv.includes('--audio-only');
if (!AUDIO_ONLY) {
  require('./tools/build-keys.js').build();
  require('./tools/build-arsenal.js').build();
  require('./tools/build-attachments.js').build();
  require('./tools/build-buyback-data.js').build();
  require('./tools/build-music-data.js').build();
  require('child_process').execFileSync(process.execPath,[path.join(dir,'tools/build-detail-art.js')],{cwd:dir,stdio:'inherit'});
  require('./tools/build-scene-library.js').build();
  if (!process.argv.includes('--assets-only')) require('./tools/build-economy.js').build();
  // Validate against final prices, including any economy regeneration above.
  require('./tools/check-commissions.js').check();
  // 地图由设计稿编译，避免多文件版与离线版使用不同点位。
  // 纯素材更新沿用已编译的地图快照，不写入或绕过正在编辑的地图草稿。
  if (!process.argv.includes('--assets-only')) require('./tools/build-linhai-map.js').build();
  // 预计算家具透明边，file:// 无需读取可能受跨域限制的Canvas像素。
  require('./tools/build-prop-bounds.js').build();
}
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

const JS_FILES = ['config.js', 'pixfont.js', 'floatfont-data.js', 'floattext.js', 'data.js', 'attachment-data.js', 'attachments.js', 'core.js', 'entities.js', 'gunplay.js', 'human-ai.js',
  'common.js', 'medical.js', 'detail-art.js', 'art.js', 'durabar.js', 'slotdots.js', 'debuff.js', 'ui.js', 'music.js', 'music-player.js', 'save.js', 'base.js', 'repair.js',
  'game.js', 'game-update.js', 'game-render.js', 'game-panels.js',
  'medhud.js', 'melee.js', 'range.js', 'safehouse-config.js', 'safehouse.js', 'merchant-config.js', 'trader.js', 'merchant-ui.js', 'storage-config.js', 'inventory-view.js', 'storage-ui.js', 'attachment-ui.js', 'gunsmith-page.js', 'merchant-dialogue.js', 'storage-loadout.js', 'base-safe.js', 'base-keychain.js', 'mail.js', 'buyback-data.js', 'sales.js', 'merchant-sales.js', 'commission-data.js', 'commissions.js', 'elena-ui.js', 'doors.js', 'door-visual.js', 'door-test.js', 'raid-value.js', 'sandbox.js', 'loot-spawn-data.js', 'ground-spawns.js', 'boot.js'];
const SPRITE_DIRS = ['items', 'chars', 'props', 'tiles', 'anim', 'gear', 'effects'];

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

/* ---------- 1.5 收集音频并转 base64 ----------
   只收 assets/audio 顶层的 .wav：单文件版走 file:// 打开，WebAudio 的
   fetch() 会被 CORS 拦死，采样必须像图片一样内联成 data URI 才能解码。
   .ogg 只给长环境循环用，留在外部，单文件版降级为静音。 */
const audio = {};
const AUDIO_DIR = path.join(dir, 'assets', 'audio');
if (fs.existsSync(AUDIO_DIR)) {
  for (const f of fs.readdirSync(AUDIO_DIR)) {
    if (!/\.wav$/i.test(f)) continue;
    audio[f.replace(/\.wav$/i, '')] = 'data:audio/wav;base64,' +
      fs.readFileSync(path.join(AUDIO_DIR, f)).toString('base64');
  }
}

/* 背景音乐按独立登记表内联，不解码进SFX缓冲；单曲压缩后最多6MiB。
   超限应先压缩成品，不能让播放器显示曲目却在离线版静默丢失。 */
const BGM_INLINE_MAX = 6 * 1024 * 1024;
const bgm = {};
if (fs.existsSync(AUDIO_DIR)) {
  const registered=JSON.parse(fs.readFileSync(path.join(AUDIO_DIR,'manifest.json'),'utf8')).music;
  const tracks=registered?.length?registered:fs.readdirSync(AUDIO_DIR).filter(f=>/^bgm_.*\.mp3$/i.test(f)).map(file=>({file,id:file.replace(/^bgm_/i,'').replace(/\.mp3$/i,'')}));
  for (const {file:f,id} of tracks) {
    const buf = fs.readFileSync(path.join(AUDIO_DIR, f));
    if (buf.length > BGM_INLINE_MAX) {
      throw Error(f+' 超过音乐成品内联上限，请先压缩到6MiB以内');
    }
    /* key 去掉 bgm_ 前缀：这里存的是曲目 id（Music.TRACKS 的键） */
    bgm[id] =
      'data:audio/mp3;base64,' + buf.toString('base64');
  }
}

/* 多文件版（index.html）靠这个文件拿音频：<script src> 不受 file:// 的 CORS 限制，
   双击就能有声音。单文件版把整块条件加载删掉，改用下面的内联注入 —— 两边都只有一份数据。
   这份是构建产物，bundle 里就是 base64，不入库（见 .gitignore）。
   index.html 里用 @@AUDIO_BUNDLE_START@@ / @@AUDIO_BUNDLE_END@@ 包住那块条件加载，
   这里按标记整块摘掉 —— 别再改成匹配具体 <script> 字样，改写法就会漏。 */
const BUNDLE_BLOCK = /<!-- @@AUDIO_BUNDLE_START@@ -->[\s\S]*?<!-- @@AUDIO_BUNDLE_END@@ -->\r?\n?/;
const BUNDLE_LEGACY = /<script src="assets\/audio\/bundle\.js"><\/script>\r?\n?/;
fs.writeFileSync(path.join(AUDIO_DIR, 'bundle.js'),
  'window.__AUDIO__ = ' + JSON.stringify(audio) + ';\n' +
  /* 音乐也进 bundle：file:// 的多文件版同样 fetch 不到本地 mp3，
     双击打开要能听到，只能靠 data URI。这份是构建产物，不入库。 */
  'window.__MUSIC__ = ' + JSON.stringify(bgm) + ';\n', 'utf8');

if (AUDIO_ONLY) {
  console.log('bundle.js 已刷新：' + Object.keys(audio).length + ' 段采样' +
    (Object.keys(bgm).length ? '、' + Object.keys(bgm).length + ' 首 BGM' : ''));
  process.exit(0);
}

/* ---------- 2. 注入资源表（必须在替换脚本标签之前） ---------- */
let out = html.replace(BUNDLE_BLOCK, '').replace(BUNDLE_LEGACY, '');
if (/assets\/audio\/bundle\.js/.test(out)) {
  console.error('单文件版仍然引用了外置 audio/bundle.js —— 标记块可能被改坏了');
  process.exit(1);
}
const uiAssets = {};
for (const [id, file] of Object.entries({room:'room',armor:'merchant_armor',guns:'merchant_guns',doctor:'merchant_doctor',viktor:'merchant_viktor',elena:'merchant_elena',gunsmith:'gunsmith'})) {
  uiAssets[id] = 'data:image/webp;base64,' + fs.readFileSync(path.join(dir,'assets/ui/safehouse',file+'.webp')).toString('base64');
}
out = out.replace('<link rel="stylesheet" href="assets/ui/safehouse.css">', '<style>\n'+fs.readFileSync(path.join(dir,'assets/ui/safehouse.css'),'utf8')+'\n</style>');
out = out.replace('<link rel="stylesheet" href="assets/ui/music.css">', '<style>\n'+fs.readFileSync(path.join(dir,'assets/ui/music.css'),'utf8')+'\n</style>');
out = out.replace('<link rel="stylesheet" href="assets/ui/merchant.css">', '<style>\n'+fs.readFileSync(path.join(dir,'assets/ui/merchant.css'),'utf8')+'\n</style>');
out = out.replace('<link rel="stylesheet" href="assets/ui/merchant-sales.css">', '<style>\n'+fs.readFileSync(path.join(dir,'assets/ui/merchant-sales.css'),'utf8')+'\n</style>');
out = out.replace('<link rel="stylesheet" href="assets/ui/elena.css">', '<style>\n'+fs.readFileSync(path.join(dir,'assets/ui/elena.css'),'utf8')+'\n</style>');
out = out.replace('<link rel="stylesheet" href="assets/ui/storage.css">', '<style>\n'+fs.readFileSync(path.join(dir,'assets/ui/storage.css'),'utf8')+'\n</style>');
out = out.replace('<link rel="stylesheet" href="assets/ui/attachments.css">','<style>\n'+fs.readFileSync(path.join(dir,'assets/ui/attachments.css'),'utf8')+'\n</style>');
const inlineTag = '<script>\nwindow.__SELF_CONTAINED__ = true;\nwindow.__UI_ASSETS__ = '+JSON.stringify(uiAssets)+';\nwindow.__SPRITES__ = ' +
  JSON.stringify(sprites) + ';\n' +
  (Object.keys(audio).length
    ? 'window.__AUDIO__ = ' + JSON.stringify(audio) + ';\n'
    : '') +
  (Object.keys(bgm).length
    ? 'window.__MUSIC__ = ' + JSON.stringify(bgm) + ';\n'
    : '') + '</script>';
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
const ac = Object.keys(audio).length;
if (ac) {
  const akb = (Object.values(audio)
    .reduce((a, s) => a + s.length, 0) / 1024).toFixed(0);
  console.log('内联音频 ' + ac + ' 个，共 ' + akb + ' KB');
}
const bc = Object.keys(bgm).length;
if (bc) {
  console.log('内联音乐 ' + bc + ' 首，共 ' +
    (Object.values(bgm).reduce((a, s) => a + s.length, 0) / 1024).toFixed(0) + ' KB');
}
const kb = (Buffer.byteLength(out, 'utf8') / 1024).toFixed(1);
console.log('已生成 潮汐线.html  ' + kb + ' KB  （内联脚本 ' + (total / 1024).toFixed(1) + ' KB）');
