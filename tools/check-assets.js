/* 素材目录体检：把 design/maps/SCENE_ASSET_SPEC.md 里的规矩变成可执行检查。
   和 tools/build-scene-library.js 的分工：
     - 构建（build-scene-library）管"能不能编译"，错了游戏就跑不起来；
     - 体检（本脚本）管"放得对不对"，只读不写，报告式输出，CI / 交接前跑。
   用法：node tools/check-assets.js
   退出码 0 = 没有错误（可能有提示），1 = 有错误。 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const errors = [];
const warns = [];
const err = m => errors.push(m);
const warn = m => warns.push(m);
const exists = p => fs.existsSync(path.join(root, p));

/* ---------- 1. assets 根目录只允许这些目录 ---------- */
const RUNTIME_DIRS = {
  tiles: { ext: ['.png'], desc: '地块（地面/墙体/水面），登记在 scene-assets.json role=ground/terrain-component' },
  props: { ext: ['.png'], desc: '场景物件（家具/贴花/门/容器/方向变体），登记在 scene-assets.json' },
  chars: { ext: ['.png'], desc: '角色贴图' },
  anim: { ext: ['.png'], desc: '角色动画帧' },
  items: { ext: ['.png', '.md'], desc: '物品 48px 图标' },
  gear: { ext: ['.png', '.md'], desc: '装备 48px 图标' },
  effects: { ext: ['.png'], desc: '特效（飘字图集等）' },
  ui: { ext: ['.css', '.webp', '.png'], desc: '界面样式与图片' },
  audio: { ext: ['.wav', '.ogg', '.mp3', '.json', '.js'], desc: '音频：成品采样 + manifest + bundle.js' },
  'item-art': { ext: [], desc: '物品原稿（按分类子目录，含 sources 与审核页）' },
  'item-details': { ext: ['.json'], desc: '物品详情图索引' },
  'npc-art': { ext: [], desc: 'NPC 立绘（按批分子目录）' },
  source: { ext: [], desc: '素材来源归档：生成批次、提示词、旧版本，不参与打包' }
};

for (const e of fs.readdirSync(path.join(root, 'assets'), { withFileTypes: true })) {
  if (!e.isDirectory()) {
    err('assets 根目录不允许放文件：' + e.name + '（提示词放 assets/source/prompts/，成品图放对应运行时目录）');
    continue;
  }
  if (!RUNTIME_DIRS[e.name]) err('assets 根目录出现未登记目录：' + e.name + '（新批次请放 assets/source/，见 SCENE_ASSET_SPEC.md）');
}
for (const name of Object.keys(RUNTIME_DIRS)) {
  if (!exists('assets/' + name)) warn('规范里列了 assets/' + name + '，但目录不存在（' + RUNTIME_DIRS[name].desc + '）');
}

/* ---------- 2. 运行时目录的文件类型 ---------- */
for (const [name, spec] of Object.entries(RUNTIME_DIRS)) {
  const dir = path.join(root, 'assets', name);
  if (!fs.existsSync(dir) || !spec.ext.length) continue;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) continue;                       // 子目录（sources/ 等）不在这里判
    const ext = path.extname(e.name).toLowerCase();
    if (!spec.ext.includes(ext)) {
      err('assets/' + name + '/' + e.name + ' 类型不对：这个目录只收 ' + spec.ext.join(' / '));
    }
  }
}

/* ---------- 3. 运行时 PNG 必须登记 ---------- */
let spec = null;
try {
  spec = JSON.parse(fs.readFileSync(path.join(root, 'design/maps/shared/scene-assets.json'), 'utf8'));
} catch (e) {
  err('读不到 design/maps/shared/scene-assets.json：' + e.message);
}
if (spec) {
  const registered = new Set(spec.assets.map(a => a.group + '/' + a.id));
  for (const group of ['tiles', 'props']) {
    for (const f of fs.readdirSync(path.join(root, 'assets', group)).filter(f => f.endsWith('.png'))) {
      if (!registered.has(group + '/' + f.slice(0, -4))) {
        err('未登记素材：assets/' + group + '/' + f + ' → 请在 scene-assets.json 里登记（缺失=永远加载不到）');
      }
    }
  }
  /* 登记了但图不在：构建也会拦，这里给出更直白的定位 */
  for (const a of spec.assets) {
    if (!exists('assets/' + a.group + '/' + a.id + '.png')) err('登记了但没有图：' + a.group + '/' + a.id);
  }

  /* ---------- 4. 可放置家具的元数据 ---------- */
  const ids = new Set(spec.assets.map(a => a.id));
  for (const a of spec.assets.filter(x => x.role === 'prop')) {
    const p = a.paint || {};
    if (!Array.isArray(p.footprint) || p.footprint.length !== 2) err('家具缺少 footprint：' + a.id);
    if (a.variantOf) err('可放置家具不能是方向变体：' + a.id);
    if (a.large) {
      for (const sfx of ['_large', '_large_side', '_large_back']) {
        if (!exists('assets/props/' + a.id + sfx + '.png')) err(a.id + ' 标了 large，但缺 ' + a.id + sfx + '.png');
      }
    }
    for (const f of ['side', 'back']) {
      if (!ids.has(a.id + '_' + f)) warn(a.id + ' 没有 ' + f + ' 方向图（旋转视图时会退回正面图）');
    }
  }
  for (const a of spec.assets.filter(x => x.variantOf)) {
    if (!ids.has(a.variantOf)) err('方向变体的基名不存在：' + a.id + ' → ' + a.variantOf);
  }

  /* ---------- 5. 素材来源目录的命名 ---------- */
  const SRC_OK = /^([a-z]+-batch-\d{2}|archive|prompts)$/;
  /* 2026-11 之前的历史批次：命名不合现在这套（那时还没约定），
     已随代码/文档/审核页引用固化了，改名收益小于风险，显式豁免。
     新批次一律走 <类别>-batch-NN。 */
  const SRC_LEGACY = new Set([
    'container-large-safe', 'container-military-supply', 'container-redraw', 'container-small-safe',
    'door-redraw', 'scene-furniture', 'scene-furniture-batch-02', 'scene-furniture-directions',
    'scene-furniture-large', 'tree-canopy', 'wall-volume'
  ]);
  const srcDir = path.join(root, 'assets/source');
  if (fs.existsSync(srcDir)) {
    for (const e of fs.readdirSync(srcDir, { withFileTypes: true })) {
      if (!e.isDirectory()) {
        if (e.name !== 'README.md') err('assets/source 下不要放散文件：' + e.name);
        continue;
      }
      if (!SRC_OK.test(e.name) && !SRC_LEGACY.has(e.name)) {
        err('assets/source/' + e.name + ' 命名不规范：应为 <类别>-batch-01 形式，或 archive / prompts');
      }
      if (e.name !== 'prompts' && e.name !== 'archive') {
        if (!fs.existsSync(path.join(srcDir, e.name, 'manifest.json'))) {
          warn('assets/source/' + e.name + ' 没有 manifest.json（批次应记录来源与提示词）');
        }
      }
    }
  }
}

/* ---------- 6. 输出 ---------- */
const count = d => fs.readdirSync(d).length;
console.log('\n素材目录体检');
console.log('assets/  ' + Object.keys(RUNTIME_DIRS).map(n => n + '(' + (exists('assets/' + n) ? count(path.join(root, 'assets', n)) : 0) + ')').join('  '));
for (const w of warns) console.log('  提示  ' + w);
for (const e of errors) console.log('  错误  ' + e);
console.log(errors.length
  ? '\n' + errors.length + ' 个错误，' + warns.length + ' 条提示。规范见 design/maps/SCENE_ASSET_SPEC.md'
  : '\n通过：0 错误，' + warns.length + ' 条提示。');
process.exitCode = errors.length ? 1 : 0;
