/* 从 assets/asset-prompts.json 生成美术清单页。
   会顺便检测哪些图已经画好了（assets/chars|props|tiles 下有没有对应文件）。
   角色是三向图，一张卡片里同时给出 _s / _n / _e 三个缩略图，_e 还多显示一个镜像预览。
   用法：node gen-art-sheet.js */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/asset-prompts.json'), 'utf8'));

const GROUP_NAME = { chars: '角色', props: '场景物件', tiles: '地形' };
const GROUP_ORDER = ['chars', 'props', 'tiles'];
const DIR_LABEL = { s: '正 _s', n: '背 _n', e: '侧 _e' };
const DIR_TIP = { s: '朝画面下方', n: '朝画面上方', e: '朝画面右方（朝左自动镜像）' };

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ---- 文件定位 ---- */
function fileOf(group, id) {
  return path.join(root, 'assets', group, id + '.png');
}
function entriesOf(a) {
  // 一条目对应几个实际文件：角色 3 个（三向），其它 1 个
  if (a.facing) return (a.dirs || ['s', 'n', 'e']).map(d => ({ id: a.id + '_' + d, dir: d }));
  return [{ id: a.id, dir: null }];
}
function existsId(a, id) {
  return fs.existsSync(fileOf(a.group, id));
}
function progressOf(a) {
  const es = entriesOf(a);
  return { done: es.filter(e => existsId(a, e.id)).length, total: es.length };
}

const styleRaw = manifest.stylePrompt || '';
const styleChar = manifest.stylePromptChars || styleRaw;
const PRIO = { 1: '必要', 2: '建议', 3: '可选' };

/* ---- 进度 ---- */
const all = manifest.assets.slice();
const totalFiles = all.reduce((n, a) => n + progressOf(a).total, 0);
const doneFiles = all.reduce((n, a) => n + progressOf(a).done, 0);

/* ---- 卡片：普通资源 ---- */
function card(a, isOptional) {
  if (a.facing) return facingCard(a, isOptional);
  const has = existsId(a, a.id);
  const prompt = (a.group === 'tiles' ? manifest.stylePromptTiles || styleRaw
    : a.ground ? manifest.stylePromptGround || styleRaw : styleRaw) + a.subject;
  return `
  <div class="asset ${has ? 'done' : ''}">
    <div class="thumb${has ? '' : ' empty'}">
      ${has ? `<img src="assets/${a.group}/${a.id}.png" alt="">` : '<span>32×32</span><em>未画</em>'}
    </div>
    <div class="info">
      <div class="row1">
        <b>${esc(a.name)}</b>
        <code>${a.group}/${a.id}.png</code>
      </div>
      <div class="row2">
        ${isOptional
          ? '<span class="pill opt">可选</span>'
          : `<span class="pill p${a.priority}">${PRIO[a.priority] || ''}</span>`}
        <span class="used">${esc(a.usedFor || '')}</span>
      </div>
      <div class="subj">${esc(a.subject)}</div>
      <button class="copy" data-p="${esc(prompt)}">复制完整 prompt</button>
    </div>
  </div>`;
}

/* ---- 卡片：三向角色 ---- */
function facingCard(a, isOptional) {
  const dirs = a.dirs || ['s', 'n', 'e'];
  const p = progressOf(a);

  const slots = dirs.map(d => {
    const id = a.id + '_' + d;
    const has = existsId(a, id);
    const prompt = styleChar + (a.subjects && a.subjects[d] ? a.subjects[d] : '');
    return `
      <div class="dslot">
        <div class="thumb sm${has ? '' : ' empty'}">
          ${has ? `<img src="assets/${a.group}/${id}.png" alt="">` : '<span>32</span><em>未画</em>'}
        </div>
        <code>_${d}</code>
        <button class="copy mini" data-p="${esc(prompt)}">复制</button>
      </div>`;
  }).join('');

  // 侧面图的镜像预览：证明「只画朝右」够用
  const eFile = fileOf(a.group, a.id + '_e');
  const mirror = fs.existsSync(eFile)
    ? `<div class="dslot mirror">
         <div class="thumb sm"><img class="flip" src="assets/${a.group}/${a.id}_e.png" alt=""></div>
         <code>镜像</code><span class="mnote">朝左自动生成</span>
       </div>`
    : `<div class="dslot mirror">
         <div class="thumb sm empty"><span>←</span><em>镜像</em></div>
         <code>镜像</code><span class="mnote">由 _e 翻转</span>
       </div>`;

  return `
  <div class="asset facing ${p.done === p.total ? 'done' : ''}">
    <div class="thumbs">${slots}${mirror}</div>
    <div class="info">
      <div class="row1">
        <b>${esc(a.name)}</b>
        <code>${a.group}/${a.id}_{s,n,e}.png</code>
        ${p.done ? `<span class="prog">${p.done} / ${p.total}</span>` : '<span class="pill p1">三向图</span>'}
      </div>
      <div class="row2">
        ${isOptional ? '<span class="pill opt">可选</span>'
          : `<span class="pill p${a.priority}">${PRIO[a.priority] || ''}</span>`}
        <span class="used">${esc(a.usedFor || '')}</span>
      </div>
      <div class="subj">${dirs.map(d => `<b class="dl">${DIR_LABEL[d]}</b>${DIR_TIP[d]}：${esc(a.subjects && a.subjects[d] || '')}`).join('<br>')}</div>
    </div>
  </div>`;
}

/* ---- 分节 ---- */
let body = '';
for (const g of GROUP_ORDER) {
  const list = all.filter(a => a.group === g);
  if (!list.length) continue;
  const tf = list.reduce((n, a) => n + progressOf(a).total, 0);
  const df = list.reduce((n, a) => n + progressOf(a).done, 0);
  const tip = g === 'chars'
    ? '<p class="tip">角色是<b>三向图</b>：正 _s / 背 _n / 侧 _e。游戏里朝左直接把 _e 水平翻转，所以<b>不需要画 _w</b>。下面每个方向都有独立的复制按钮，prompt 已按方向写好。</p>'
    : '';
  body += `
  <section>
    <h2><span>${GROUP_NAME[g]}</span><em>${g}/</em><i>${df} / ${tf}</i></h2>
    ${tip}
    ${list.map(a => card(a, false)).join('')}
  </section>`;
}

if (manifest.optional && manifest.optional.length) {
  const of = manifest.optional.reduce((n, a) => n + progressOf(a).total, 0);
  const od = manifest.optional.reduce((n, a) => n + progressOf(a).done, 0);
  body += `
  <section class="optsec">
    <h2><span>可选（锦上添花）</span><em>props/</em><i>${od} / ${of}</i></h2>
    <p class="tip">摆设通过 <code>js/data.js</code> 的 <code>DECOR</code> 层装入地图；家具默认实体占一格，只有 <code>ground:true</code> 的血迹等地贴可通行。F1 可查看占格轮廓。</p>
    ${manifest.optional.map(a => card(a, true)).join('')}
  </section>`;
}

const pct = Math.round(doneFiles / totalFiles * 100);

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>潮汐线 · 美术资源清单</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 30px 34px 90px;
    background: #0b1210; color: #c6d2cd;
    font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 1280px; margin: 0 auto; }
  .kicker { font-size: 11px; letter-spacing: 3px; color: #4d7d70; margin-bottom: 6px; }
  h1 { font-size: 26px; margin: 0 0 8px; letter-spacing: 4px; color: #e2ece8; font-weight: 600; }
  .lede { font-size: 12.5px; color: #6d8780; line-height: 1.9; max-width: 880px; }
  .lede b { color: #a8c4ba; font-weight: 500; }

  .bar-wrap { display: flex; align-items: center; gap: 14px; margin: 20px 0 4px; }
  .pbar { flex: 1; height: 8px; background: #14201c; border-radius: 4px; overflow: hidden; }
  .pbar > i { display: block; height: 100%; background: linear-gradient(90deg, #14685C, #3fbf9b); }
  .pnum { font-size: 12px; color: #8fa79f; font-family: Consolas, monospace; white-space: nowrap; }

  .spec { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 18px; }
  .panel { background: #101a17; border: 1px solid #1c2e28; padding: 15px 18px; }
  .panel h3 { font-size: 11.5px; letter-spacing: 2px; color: #6fa093; margin: 0 0 10px; font-weight: 600; }
  .panel p { margin: 0 0 7px; font-size: 12px; line-height: 1.85; color: #8fa79f; }
  .panel p:last-child { margin-bottom: 0; }
  .panel b { color: #b9cac4; font-weight: 500; }
  code {
    background: #17241f; border: 1px solid #223a32; border-radius: 3px;
    padding: 1px 5px; font-size: 11px; color: #a8c4ba;
    font-family: Consolas, Menlo, monospace;
  }
  .warn { border-left: 3px solid #B5551F; background: #1a1310; }
  .warn h3 { color: #c98a5e; }

  section { margin-top: 34px; }
  h2 {
    display: flex; align-items: center; gap: 10px;
    font-size: 14px; letter-spacing: 1px; color: #cfdcd7; font-weight: 600;
    margin: 0 0 14px; padding-bottom: 9px; border-bottom: 1px solid #1a2a25;
  }
  h2 em { font-style: normal; font-size: 10.5px; color: #47645c; letter-spacing: 1px; }
  h2 i { margin-left: auto; font-style: normal; font-size: 11px; color: #4d7d70; }
  .tip { font-size: 11.5px; color: #7d9188; line-height: 1.8; margin: -4px 0 14px; }
  .tip b { color: #a8c4ba; font-weight: 500; }

  .asset {
    display: flex; gap: 13px; padding: 11px 13px; margin-bottom: 8px;
    background: #0f1916; border: 1px solid #1a2a25;
  }
  .asset.done { border-color: #24463d; }
  .thumb {
    flex: 0 0 64px; width: 64px; height: 64px;
    border: 1px dashed #2d4a41; border-radius: 2px; background: #0b1411;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 2px; overflow: hidden;
  }
  .thumb.empty { border-color: #24352f; }
  .asset.done .thumb { border-style: solid; border-color: #24463d; }
  .thumb img { width: 64px; height: 64px; image-rendering: pixelated; display: block; }
  .thumb span { font-size: 9px; color: #33544b; }
  .thumb em { font-style: normal; font-size: 9px; color: #33544b; }

  /* 三向图那一排 */
  .thumbs { flex: 0 0 auto; display: flex; gap: 9px; align-items: flex-start; }
  .dslot { display: flex; flex-direction: column; align-items: center; gap: 3px; width: 60px; }
  .thumb.sm { flex: 0 0 56px; width: 56px; height: 56px; }
  .thumb.sm img { width: 56px; height: 56px; }
  .dslot code { font-size: 9.5px; padding: 0 4px; }
  .dslot .mnote { font-size: 8.5px; color: #3d5b53; text-align: center; line-height: 1.2; }
  .dslot.mirror .thumb { border-color: #223a32; background: #0a1410; }
  .dslot.mirror img.flip { transform: scaleX(-1); opacity: 0.92; }

  .info { flex: 1; min-width: 0; }
  .row1 { display: flex; align-items: baseline; gap: 10px; margin-bottom: 3px; flex-wrap: wrap; }
  .row1 b { font-size: 13.5px; color: #dce7e3; font-weight: 500; }
  .row1 code { font-size: 10px; }
  .prog { font-size: 10px; color: #3fbf9b; font-family: Consolas, monospace; }
  .row2 { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; flex-wrap: wrap; }
  .pill {
    font-size: 9px; padding: 1px 6px; border-radius: 2px; letter-spacing: 0.5px;
    background: #1d3a31; color: #7fae9f;
  }
  .pill.p1 { background: #3a2a1c; color: #c98a5e; }
  .pill.p2 { background: #1d3a31; color: #7fae9f; }
  .pill.p3 { background: #1b2b26; color: #5f7a72; }
  .pill.opt { background: #232323; color: #6d6d6d; }
  .used { font-size: 11px; color: #5f7a72; }
  .subj { font-size: 11.5px; line-height: 1.85; color: #7d948c; }
  .subj b.dl { color: #8fb3a8; font-weight: 500; }
  .copy {
    margin-top: 7px; padding: 3px 10px; font-size: 10.5px;
    background: transparent; color: #6fa093; border: 1px solid #26403a;
    border-radius: 2px; cursor: pointer; letter-spacing: 0.5px;
  }
  .copy:hover { background: #16241f; color: #a8c4ba; }
  .copy.ok { color: #3fbf9b; border-color: #2f5a4f; }
  .copy.mini { margin-top: 0; padding: 1px 7px; font-size: 9.5px; }

  footer {
    margin-top: 40px; padding-top: 18px; border-top: 1px solid #1a2a25;
    font-size: 11.5px; color: #4d6b62; line-height: 1.9;
  }
</style>
</head>
<body>
<div class="wrap">

<header>
  <div class="kicker">TIDELINE · ART SHEET</div>
  <h1>美术资源清单</h1>
  <div class="lede">
    物品图标 <b>33 / 33 已完成</b>。下面展示场景资源与制作进度。<b>它们和物品图标最大的区别是视角</b>：
    物品是正面展示；角色与立体场景物件统一使用<b>约 75° 倾斜俯视</b>，地面贴花保持平坦。
    角色是<b>三向图</b>（正 / 背 / 侧），朝左直接用侧面图<b>水平镜像</b>，不用画第四张。
    每张卡右下角可以复制拼好的 prompt。
    玩家动作另见 <a href="玩家动画.html" style="color:#a8c4ba">玩家动画预览</a>（7 种动作、三向图、60 帧）。
  </div>
  <div class="bar-wrap">
    <div class="pbar"><i style="width:${pct}%"></i></div>
    <div class="pnum">场景资源 ${doneFiles} / ${totalFiles} 个文件</div>
  </div>
</header>

<div class="spec">
  <div class="panel">
    <h3>规格</h3>
    <p><b>尺寸</b>　32 × 32 像素。角色、物件占中间 28 × 28，四周留 2px 透明边；地形铺满 32 × 32，不留透明接缝。</p>
    <p><b>视角</b>　角色与有高度的物件统一为相对地面约 75° 的倾斜俯视正交投影，顶面为主，带短立面；地板和贴花保持贴地。</p>
    <p><b>规范</b>　完整要求见 <a href="ART_STYLE.md" style="color:#a8c4ba">ART_STYLE.md · 美术规范 v2</a>。门含正向/侧向、打开/关闭，按门洞墙体轴线自动选图。</p>
    <p><b>命名</b>　角色 <code>chars/player_s.png</code>、<code>_n</code>、<code>_e</code>；<br>物件 <code>props/crate_std.png</code>；地形 <code>tiles/wall.png</code>。</p>
    <p><b>处理</b>　原稿命名与成品相同，放进一个目录后跑 <code>node tools/prepare-scene-icons.js &lt;原稿目录&gt;</code>。</p>
  </div>
  <div class="panel warn">
    <h3>四条容易踩的</h3>
    <p><b>1. 侧面只画朝右的。</b>朝左由代码水平翻转。所以侧面图上不要写文字、编号、徽章——翻过来会是错的。单肩包、单侧枪套这类可以放心画。</p>
    <p><b>2. 三张要能一眼分出朝向。</b>靠帽檐位置、背带、背包、传感器这些线索区分，不要只换一下亮度。</p>
    <p><b>3. 地形不要求和邻居无缝。</b>地图是格子化的，每格独立画，格子之间有边界反而像地砖。</p>
    <p><b>4. 不要画投影和地面。</b>阴影由代码按视野亮度叠加，画进去会二次叠加变脏。</p>
  </div>
</div>

${body}

<footer>
  清单由 <code>gen-art-sheet.js</code> 从 <code>assets/asset-prompts.json</code> 生成。
  更新图片后重跑 <code>node gen-art-sheet.js</code> 刷新预览与进度，再运行 <code>node build.js</code> 打包游戏。缺某个方向时会自动借其它方向，全缺才退回代码绘制的临时图形。
</footer>

</div>
<script>
document.querySelectorAll('.copy').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var txt = btn.getAttribute('data-p');
    var done = function () {
      var old = btn.textContent;
      btn.textContent = '已复制';
      btn.classList.add('ok');
      setTimeout(function () { btn.textContent = old; btn.classList.remove('ok'); }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done, fallback);
    } else { fallback(); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = txt;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { alert('复制失败，请手动选择文本'); }
      document.body.removeChild(ta);
    }
  });
});
</script>
</body>
</html>`;

fs.writeFileSync(path.join(root, '美术清单.html'), html, 'utf8');
console.log('已生成 美术清单.html　场景资源 ' + doneFiles + ' / ' + totalFiles + ' 个文件' +
  (manifest.optional ? '（另有可选 ' + manifest.optional.length + ' 项）' : ''));
