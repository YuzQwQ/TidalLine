/* 把 tools/ 下的试听页打成自包含页面：
   内联 js/ui.js 与 assets/audio/bundle.js，这样丢进任何沙箱预览都能直接用，
   不需要起本地服务器、也不会有"../js/ui.js 404 → 按钮全死"的问题。
   声音参数仍然只有一份来源（js/ui.js），改完重跑本脚本即可。

   两个页面：
     audio-guns.html    枪声与音量试听
     audio-actions.html 局内交互音效总览
   用法：node tools/build-audio-page.js */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const inline = (relPath) => {
  const file = path.join(ROOT, relPath);
  if (!fs.existsSync(file)) {
    console.log('  跳过（文件不存在）：' + relPath);
    return null;
  }
  const code = fs.readFileSync(file, 'utf8');
  return '<script>\n/* ---- ' + relPath + ' ---- */\n' + code + '\n</script>';
};

/* 两个页面共用的依赖 */
const audioTag = inline('assets/audio/bundle.js');
const variantTag = inline('tools/rifle-variants.js');
/* 枪声按型号路由（SHOT_MODEL）要查 WEAPONS 表，data.js 顶层又会读 CFG ——
   这两份也得内联，否则自包含版点"单发"会 ReferenceError: WEAPONS is not defined */
const cfgTag = inline('js/config.js');
const dataTag = inline('js/data.js');
const uiTag = inline('js/ui.js');

/* bundle.js 可能是构建产物，没跑过 build.js 时不存在：那就只内联 ui.js，
   页面里的采样部分会自动退化成合成音，脚本本身照样能跑 */
function buildPage(srcName, outName, title) {
  const SRC = path.join(ROOT, 'tools', srcName);
  const OUT = path.join(ROOT, 'tools', outName);
  let html = fs.readFileSync(SRC, 'utf8');

  const audioRe = /<script src="\.\.\/assets\/audio\/bundle\.js"><\/script>/;
  if (audioTag) {
    html = html.replace(audioRe, () => audioTag);
  } else {
    html = html.replace(audioRe, '<!-- 没有 assets/audio/bundle.js：采样部分退化为合成音 -->');
  }
  const variantRe = /<script src="rifle-variants\.js"><\/script>/;
  html = html.replace(variantRe, () => variantTag || '<!-- 缺少 tools/rifle-variants.js -->');
  html = html.replace(
    /<script src="\.\.\/js\/config\.js"><\/script>/,
    () => cfgTag || '<!-- 缺少 js/config.js -->'
  );
  html = html.replace(
    /<script src="\.\.\/js\/data\.js"><\/script>/,
    () => dataTag || '<!-- 缺少 js/data.js -->'
  );
  html = html.replace(
    /<script src="\.\.\/js\/ui\.js"><\/script>/,
    () => uiTag || '<!-- 缺少 js/ui.js -->'
  );
  html = html.replace('<title>' + title + '</title>', '<title>' + title + '（自包含）</title>');

  fs.writeFileSync(OUT, html);
  const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
  console.log('已生成 tools/' + outName + '  ' + kb + ' KB');
  console.log('  （自包含：ui.js ' + (uiTag ? '已内联' : '缺失') + '，武器表 ' +
    (dataTag ? '已内联' : '缺失') + '，音频包 ' + (audioTag ? '已内联' : '缺失') + '）');
}

buildPage('audio-guns.html', 'audio-guns.standalone.html', '潮汐线 · 枪声与音量试听');
buildPage('audio-actions.html', 'audio-actions.standalone.html', '潮汐线 · 局内交互音效总览');
