/* 把 design/maps/shared/scene-assets.json（唯一登记表）编译成三样东西：
     1. design/maps/shared/scene-library.js  —— 编辑器 / 地图编译 / 测试共用的运行时目录
     2. js/data.js 里的 ART 追加块            —— 游戏加载清单
     3. design/maps/scene-library.html        —— 人类查看的素材总览页
   登记不全、图片缺失、目录里有未登记的 PNG，这里一律抛错：宁可构建失败，
   也不要让"地图上有、素材库里没有"这种半截状态进游戏。
   规范见 design/maps/SCENE_ASSET_SPEC.md。 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'design/maps/shared');

/* 角色说明。只改这里不够，还要同步 SCENE_ASSET_SPEC.md 与 palette 的分组。 */
const ROLES = {
  'terrain-component': '地块组件（墙体、桥面、水面…），由地图字符引用',
  ground: '基础地面：自带一个地图字符 ch，可在编辑器直接刷',
  decal: '地面贴花：可通行、不挡视线、无碰撞',
  prop: '可放置家具：必须声明 footprint，编辑器调色板就是照这份清单生成的',
  'scene-component': '组件：方向变体、门、尸体、集装箱、栏杆等，不单独放置'
};

function fail(msg) { throw new Error(msg); }

function readPng(file, key) {
  let b;
  try { b = fs.readFileSync(file); } catch (e) { fail('图片不存在：' + key + '（' + file + '）'); }
  if (b.toString('ascii', 1, 4) !== 'PNG') fail('不是有效 PNG：' + key);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function build() {
  const spec = JSON.parse(fs.readFileSync(path.join(dir, 'scene-assets.json'), 'utf8'));
  if (spec.schemaVersion !== 1) fail('scene-assets.json 的 schemaVersion 应为 1');
  if (!Array.isArray(spec.assets)) fail('scene-assets.json 缺少 assets 数组');

  const keys = new Set();
  const assets = spec.assets.map(a => {
    const key = a.group + '/' + a.id;
    if (!a.id || !a.group) fail('素材缺少 group/id：' + JSON.stringify(a).slice(0, 60));
    if (!['tiles', 'props'].includes(a.group)) fail('group 只能是 tiles 或 props：' + key);
    if (!a.name) fail('素材缺少 name（中文名，编辑器要显示它）：' + key);
    if (!ROLES[a.role]) fail('role 非法（可用：' + Object.keys(ROLES).join(' / ') + '）：' + key);
    if (keys.has(key)) fail('素材重复登记：' + key);
    keys.add(key);

    if (a.role === 'ground' && (!a.ch || a.ch.length !== 1 || !a.rule
      || a.rule.art !== a.id || a.rule.walkable !== true || a.rule.opaque !== false)) {
      fail('地面规则不完整（ch / rule.art / walkable=true / opaque=false）：' + key);
    }
    if (a.role === 'prop') {
      const p = a.paint;
      if (!p || p.kind !== 'prop' || p.type !== a.id) fail('家具缺少 paint{kind:prop,type:id}：' + key);
      if (!Array.isArray(p.footprint) || p.footprint.length !== 2
        || !p.footprint.every(n => Number.isInteger(n) && n > 0)) {
        fail('家具必须声明 footprint:[宽,高]（正整数格）：' + key);
      }
      /* visual：只改贴图绘制盒，不改占地与碰撞。落地钟这类"窄而高"的家具占 1 格，
         按 1 格等比换算会缩成一小撮，所以允许声明 1×1.5 的绘制盒。只放大不缩小。 */
      if (p.visual !== undefined) {
        if (!Array.isArray(p.visual) || p.visual.length !== 2
          || !p.visual.every(n => typeof n === 'number' && isFinite(n) && n > 0)) {
          fail('visual 必须是 [宽,高] 两个正数（单位：格）：' + key);
        }
        if (p.visual[0] < p.footprint[0] || p.visual[1] < p.footprint[1]) {
          fail('visual 只能放大贴图，不能小于 footprint：' + key);
        }
      }
      /* 多格家具靠 _large 把两格铺满，少一张就会退回单格图、留白一整格 */
      if (a.large) {
        for (const sfx of ['_large', '_large_side', '_large_back']) {
          if (!fs.existsSync(path.join(root, 'assets/props/' + a.id + sfx + '.png'))) {
            fail('登记了 large 但缺图：assets/props/' + a.id + sfx + '.png');
          }
        }
      }
    }
    if (a.role === 'decal' && (!a.paint || a.paint.ground !== true || a.paint.type !== a.id)) {
      fail('贴花须明确 ground=true 且 paint.type=id：' + key);
    }

    const png = readPng(path.join(root, 'assets', key + '.png'), key);
    return Object.assign({}, a, png, { path: 'assets/' + key + '.png' });
  });

  /* 方向变体：id = 基名 + _side / _back，基名必须存在且自己不是方向变体。
     这条规则让"某个家具缺哪一向"能直接从数据里问出来，不用再手写一份表。 */
  const byId = new Map(assets.filter(a => a.group === 'props').map(a => [a.id, a]));
  for (const a of assets) {
    if (!a.variantOf) continue;
    if (a.role !== 'scene-component') fail('方向变体必须是 scene-component：' + a.id);
    if (a.group !== 'props') fail('方向变体只能出现在 props 组：' + a.id);
    if (!['side', 'back'].includes(a.facing)) fail('方向只能是 side / back：' + a.id);
    if (a.id !== a.variantOf + '_' + a.facing) fail('方向变体的 id 必须是 基名_方向：' + a.id);
    const base = byId.get(a.variantOf);
    if (!base) fail('方向变体找不到基名：' + a.id + ' → ' + a.variantOf);
    if (base.variantOf) fail('方向变体的基名不能再是方向变体：' + a.id);
  }

  /* 目录里有一张没登记的 PNG = 画好了却永远加载不到，直接拦下 */
  for (const group of ['tiles', 'props']) {
    for (const file of fs.readdirSync(path.join(root, 'assets', group)).filter(f => f.endsWith('.png'))) {
      if (!keys.has(group + '/' + file.slice(0, -4))) {
        fail('新素材未登记：' + group + '/' + file + '。请先更新 design/maps/shared/scene-assets.json');
      }
    }
  }

  const grounds = assets.filter(a => a.role === 'ground');
  if (new Set(grounds.map(a => a.ch)).size !== grounds.length) fail('基础地面的 ch 不能重复');
  const placeables = assets.filter(a => a.role === 'prop');
  const decals = assets.filter(a => a.role === 'decal');

  const content = { assets, grounds, placeables, decals };
  fs.writeFileSync(path.join(dir, 'scene-library.js'),
    '/* 自动生成：node tools/build-scene-library.js；请编辑 scene-assets.json */\n' +
    '(function(root){const library=' + JSON.stringify(content) +
    ';if(typeof module===\'object\'&&module.exports)module.exports=library;else root.SceneLibrary=library;})(globalThis);\n');

  /* 游戏侧只需要"要加载哪些图"：可放置家具、贴花、地面、以及全部方向变体 */
  const dataFile = path.join(root, 'js/data.js');
  let data = fs.readFileSync(dataFile, 'utf8')
    .replace(/\n?\/\* BEGIN SCENE LIBRARY \*\/[\s\S]*?\/\* END SCENE LIBRARY \*\/\n?/g, '')
    .replace(/\n+$/, '');
  const extra = assets
    .filter(a => a.role === 'ground' || a.role === 'decal' || a.role === 'prop' || a.variantOf)
    .map(a => ({ group: a.group, id: a.id }));
  data += '\n/* BEGIN SCENE LIBRARY */\nfor(const a of ' + JSON.stringify(extra) +
    '){if(!ART[a.group].includes(a.id))ART[a.group].push(a.id);}\n/* END SCENE LIBRARY */\n';
  fs.writeFileSync(dataFile, data);

  writeGallery(assets, placeables.length, decals.length);
  console.log('已同步场景素材库：' + assets.length + ' 张，可放置家具 ' + placeables.length +
    '、贴花 ' + decals.length + '、地面 ' + grounds.length);
  return content;
}

/* 素材总览页：按角色分组，标出哪些能在编辑器里放 */
function writeGallery(assets, propCount, decalCount) {
  const file = path.join(root, 'design/maps/scene-library.html');
  const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  const GROUPS = [
    ['prop', '可放置家具'],
    ['decal', '地面贴花'],
    ['ground', '基础地面'],
    ['terrain-component', '地块组件'],
    ['scene-component', '组件（方向 / 门 / 尸体等）']
  ];
  const cards = [];
  for (const [role, title] of GROUPS) {
    const list = assets.filter(a => a.role === role);
    if (!list.length) continue;
    cards.push('<h2>' + title + ' <em>' + list.length + '</em></h2><div class="grid">' +
      list.map(a => {
        const foot = a.paint && a.paint.footprint ? ' · 占地 ' + a.paint.footprint.join('×') : '';
        const dir = a.variantOf ? ' · ' + a.variantOf + ' 的' + (a.facing === 'side' ? '侧面' : '背面') : '';
        return '<article data-search="' + esc(a.name + ' ' + a.id + ' ' + a.role) + '">' +
          '<img src="../../' + a.path + '" alt="' + esc(a.name) + '">' +
          '<h3>' + esc(a.name) + '</h3>' +
          '<small>' + a.id + ' · ' + a.width + '×' + a.height + foot + dir + '</small>' +
          '<small>' + a.role + (a.ch ? ' · 地面字符 ' + a.ch : '') + '</small></article>';
      }).join('') + '</div>');
  }
  const html = '<!doctype html><html lang="zh-CN"><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>场景素材库</title>' +
    '<style>body{background:#17261e;color:#d4dfd5;font:14px system-ui;margin:24px}a{color:#b5cfb8}' +
    'input{padding:10px;width:min(90%,440px);margin:15px 0}h2{font-size:17px;margin:26px 0 10px}h2 em{font-style:normal;color:#8fae9a;font-size:13px}' +
    '.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}' +
    'article{padding:14px;background:#23382a;overflow-wrap:anywhere}' +
    'img{image-rendering:pixelated;object-fit:contain;width:96px;height:96px}' +
    'small{display:block;color:#a9b9ae}</style>' +
    '<h1>场景素材库 · ' + assets.length + ' 张</h1>' +
    '<p><a href="../../design/maps/editor/index.html">打开地图编辑器</a> · ' +
    '<a href="../../design/maps/shared/scene-assets.json">登记表</a> · ' +
    '<a href="../../design/maps/SCENE_ASSET_SPEC.md">素材规范</a></p>' +
    '<p>这一页由 <code>node tools/build-scene-library.js</code> 生成。' +
    '可放置家具 ' + propCount + ' 种、贴花 ' + decalCount + ' 种；' +
    '其余是组件，由对应对象组合使用。</p>' +
    '<input id="search" placeholder="搜索名称、ID、角色"><div id="host">' + cards.join('') + '</div>' +
    '<script>search.oninput=()=>document.querySelectorAll("article").forEach(a=>a.hidden=!a.dataset.search.toLowerCase().includes(search.value.toLowerCase()));</script>' +
    '</html>';
  fs.writeFileSync(file, html);
}

module.exports = { build };
if (require.main === module) build();
