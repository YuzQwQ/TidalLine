/* 生成「更新补遗.html」：把四份数据清单之外的系统更新、设定补充录入 Wiki。
   四份清单直接读 js/data.js，改数据重跑就会同步；本页记录的是"清单装不下"的东西
   （玩法规则、音效、地图、人物设定、交互手势），按提交倒序手工维护。
   用法：node tools/gen-updates-sheet.js（或统一入口 node gen-wiki.js） */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { writeSheet } = require('./wiki-layout');

const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC_MAP[c]);

/* ---------- 覆盖检查：数字跟数据清单同源，不手写 ---------- */
const ctx = vm.createContext({ console, performance });
for (const f of ['js/config.js', 'js/data.js', 'js/attachment-data.js']) {
  vm.runInContext(read(f), ctx);
}
const stat = vm.runInContext(`({
  items: ITEMS.length,
  gear: Object.keys(WEAPONS).length + HELMETS.length + BODIES.length + BAGS.length + MELEE.length + Object.keys(ATTACHMENT_DEFS).length,
  types: Object.keys(CONTAINER_TYPES).length,
  instances: Object.keys(CONTAINER_TYPES).reduce((n, ch) => n + MAP_ROWS.join('').split(ch).length - 1, 0),
  remains: 3
})`, ctx);

/* ---------- 更新记录：从「商人档案页」成型到当前，逐条对齐 git log ----------
   c = 提交短号，k = 归类，d = 一句话说明，links = 详情落点。
   新增更新时往数组最前面加一条，重跑 gen-wiki.js 即可。 */
const UPDATES = [
  {
    c: '8299739', k: '玩法 / 美术', t: '飘字按伤害类型分色',
    d: '蓝色（Mana）给近战伤害，玩家专属紫色（Poison）退役。normal 骨白 / crit 橙金 / melee 蓝三色只认伤害类型、不认敌我；连击只合并同类型的数字。',
    links: [['装备清单', '装备清单.html'], ['玩法文档', 'DEVELOPMENT.md'], ['素材账', 'assets/audio/manifest.json']]
  },
  {
    c: '8f8d7a4', k: '操作', t: '取消鼠标不能穿过玩家的限制',
    d: '拆掉三层 keep=18px 夹取：虚拟光标可停在角色身上、也可穿到另一侧，准星跟着走；只保留 12px 的 AIM_DEAD 防抖死区。贴身近战甩枪不再被卡住。',
    links: [['玩法文档', 'DEVELOPMENT.md'], ['操作说明', 'README.md']]
  },
  {
    c: 'becb36a', k: '音效', t: '容器逐件搜索的循环翻找底声',
    d: '179670（rustle through chord box）切成 5.224s 的 search_rustle.wav：搜索进行中循环播放，全部搜完、单件搜完或关面板即淡出。容器材质音仍是一容器一声。',
    links: [['音效总览页', 'tools/audio-actions.html'], ['素材账', 'assets/audio/manifest.json'], ['玩法文档', 'DEVELOPMENT.md']]
  },
  {
    c: '65001d7', k: '交互', t: '统一物品手势',
    d: '单击看详情（局内带动作按钮）、双击做（使用 / 换装 / 拿走）、Ctrl+左键快速移动、右键出菜单（详情 / 使用·装备 / 丢弃）。装备槽保留单击切枪，双击才是详情。仓库页与备战页下一轮再收。',
    links: [['交互盘点', 'design/ui/ITEM_INTERACTION_AUDIT.md'], ['操作说明', 'README.md']]
  },
  {
    c: 'e0243dd', k: '设计', t: '物品交互现状盘点',
    d: '统计 21 处可点界面、5 种详情载体、10 条不一致，并给出三个统一方向；文末留有统一手势的实施矩阵。',
    links: [['交互盘点', 'design/ui/ITEM_INTERACTION_AUDIT.md']]
  },
  {
    c: '8b920de', k: '数据', t: 'IV 级头甲稀有度上调为「稀见」',
    d: 'gearRarity 映射从 [1,1,2,3,3,5,6] 改成 [1,1,2,3,4,5,6]，四级头 / 甲由蓝色上乘变为紫色稀见；只影响显示，不动价格与耐久。',
    links: [['装备清单', '装备清单.html'], ['稀有度说明', 'design/items/RARITY.md']]
  },
  {
    c: 'cceb91f', k: '设定', t: '玛拉·维恩的设定与台词补齐',
    d: '补人物简介五段、总览、人物核心与 8 条台词风格规范；进店 / 闲置 / 购买 / 出售 / 三档收购共 18 条运行台词接线，另有信任与交易失败预留条目。',
    links: [['商人档案', '商人档案.html'], ['设定稿', 'design/merchants/design-v1.json'], ['对话规范', 'design/merchants/DIALOGUE_V1.md']]
  },
  {
    c: '6b83060', k: '地图', t: '银行与钟表店按内容对调命名',
    d: '两栋楼的 id 与内容原本对调：按家具内容修正命名，rooms / portals / windows / region / 高价值掉落全部跟随，几何与家具一格不动。',
    links: [['地图布局', 'design/maps/linhai-old-quarter/layout.json'], ['容器清单', '容器清单.html']]
  },
  {
    c: '1e48a55', k: '地图', t: '载入新版临海路：银行旧址与钟表店',
    d: '右上角银行、右下角钟表铺成型：家具 176→210、容器 97→108、敌人 42→46、门 20→22；同步修敌人间距、地贴压墙与巡逻航点。',
    links: [['地图布局', 'design/maps/linhai-old-quarter/layout.json'], ['地图说明', 'MAP_LAYOUT.md'], ['容器清单', '容器清单.html']]
  },
  {
    c: '85c6429', k: 'Wiki', t: '新增商人档案页',
    d: '四位商人的设定、职责、货架、收购偏好与全部台词独立成页；数据来自设定稿、运行时配置与交易模块，只进导航不并进 wiki.html。',
    links: [['商人档案', '商人档案.html'], ['设定总则', 'design/merchants/BRIEF_V1.md']]
  }
];

/* ---------- 玩法速查：清单装不下、但查 Wiki 时最常问的几组规则 ---------- */
const QUICK = [
  {
    t: '物品手势（局内统一）',
    rows: [
      ['单击', '看详情；局内详情带动作按钮，局外只显示信息'],
      ['双击', '做：医疗品使用、弹药设弹种、枪械护甲换装、普通物品看详情；容器 / 尸体是拿走'],
      ['Ctrl + 左键', '快速移动：背包→安全箱、安全箱→背包、容器→背包'],
      ['右键', '菜单：详情 / 使用·装备 / 退弹·改装 / 丢弃'],
      ['装备槽例外', '单击仍是切枪、切近战；双击看详情，右键可把装备丢到脚边'],
      ['仓库与备战页', '暂沿旧手势，下一轮再收']
    ]
  },
  {
    t: '伤害飘字配色',
    rows: [
      ['normal', '骨白（Damage）· 普通枪伤，敌我同色'],
      ['crit', '橙金（Critical）· 爆头，敌我同色'],
      ['melee', '蓝（Mana）· 近战伤害，含玩家挥刀的无视护甲真伤'],
      ['合并', '同一目标短时间连击只合并同类型（字体相同）的数字']
    ]
  },
  {
    t: '搜索与瞄准',
    rows: [
      ['容器材质音', '交互那一刻按容器 art 响一声，不循环'],
      ['搜索循环底声', '逐件搜索进行中循环，全部搜完 / 关面板即淡出'],
      ['鼠标', '可压在角色身上、也可穿过到另一侧，准星跟着走'],
      ['AIM_DEAD', '12px 朝向死区，只防 atan2 在角色中心抖动']
    ]
  }
];

const linkHtml = links => links.map(([label, href]) =>
  `<a href="${esc(href)}">${esc(label)}</a>`).join(' · ');

const updateCards = UPDATES.map(u => `
    <div class="item">
      <div class="thumb"><span>COMMIT</span><b>${esc(u.c)}</b></div>
      <div class="meta">
        <div class="name">${esc(u.t)}<i class="tag">${esc(u.k)}</i></div>
        <div class="sub">${esc(u.d)}</div>
        <div class="vis">${linkHtml(u.links)}</div>
      </div>
    </div>`).join('');

const quickHtml = QUICK.map(q => `
  <section class="cat">
    <h2><span class="dot" style="background:#6fa093"></span>${esc(q.t)}<i>${q.rows.length} 条</i></h2>
    <div class="panel">${q.rows.map(([k, v]) =>
      `<p><b>${esc(k)}</b>　${esc(v)}</p>`).join('')}</div>
  </section>`).join('');

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>潮汐线 Wiki · 更新补遗</title>
</head>
<body>
<header>
  <div class="kicker">TIDELINE · UPDATE LOG</div>
  <h1>更新补遗</h1>
  <div class="lede">
    四份清单（物品 / 装备 / 容器 / 商人档案）直接由 <code>js/data.js</code> 等数据文件生成，改完数据重跑
    <code>node gen-wiki.js</code> 就会同步；本页收录清单装不下的系统更新、设定补充与玩法规则，
    按提交倒序排列，新增内容往 <code>tools/gen-updates-sheet.js</code> 里加一条即可。
  </div>
</header>

<div class="spec">
  <div class="panel">
    <h3>数据清单覆盖检查</h3>
    <p><b>物品清单</b>　${stat.items} 件（收集品 + 物资）· 源 <code>js/data.js</code> · 已录入</p>
    <p><b>装备清单</b>　${stat.gear} 张（枪 / 盔 / 甲 / 包 / 近战 / 配件）· 源 <code>js/data.js</code> + <code>attachment-data.js</code> · 已录入</p>
    <p><b>容器清单</b>　${stat.types} 种容器 / 当前地图 ${stat.instances} 个实例 / ${stat.remains} 类遗留物 · 源 <code>MAP_ROWS</code> + <code>CONTAINER_TYPES</code> · 已录入</p>
    <p><b>商人档案</b>　4 位（设定稿 + 运行时台词 + 货架 + 收购偏好）· 独立页，导航进入 · 已录入</p>
    <p><b>系统更新</b>　${UPDATES.length} 条（本页）· 手工维护 · 已录入</p>
  </div>
  <div class="panel">
    <h3>这一页补的是什么</h3>
    <p>清单回答「游戏里有什么」，本页回答「后来补了什么、现在怎么用」：地图改版、人物设定，
    以及音效、交互手势、瞄准与飘字这些不落在数据表里的玩法规则。</p>
    <p>每条更新都带提交短号与详情落点；下方速查表是这些规则的当前口径，
    和 <a href="DEVELOPMENT.md">玩法文档</a> / <a href="README.md">操作说明</a> 一致。</p>
    <p>范围：从「商人档案页」成型到当前的全部已提交更新。更早的改动见 git log 与
    <a href="DEVELOPMENT.md">DEVELOPMENT.md</a>。</p>
    <p><b>边界</b>　四份数据清单始终反映当前工作区的数据；本页的更新记录只收录已落地的提交。
    工作区里还在做的 WIP（新商人、新素材等）不提前写入，等落地后往数组里补一条再重跑生成。</p>
  </div>
</div>

<section class="item-group" data-item-group="updates">
  <h2 class="item-group-title">更新记录<span>${UPDATES.length} 条</span></h2>
  <p class="category-description">倒序排列。<b>归类</b>只用来速览，详情点每条下面的链接；带「数据」标签的条目已自动反映在对应清单里。</p>
  <div class="grid">${updateCards}
  </div>
</section>

${quickHtml}

<footer>潮汐线 Wiki · 更新补遗 ｜ 由 <code>node gen-wiki.js</code> 生成，勿手改 HTML。</footer>
</body>
</html>`;

writeSheet('更新补遗.html', html, 'updates');
console.log(`已生成 更新补遗.html（${UPDATES.length} 条更新 / ${QUICK.length} 组速查 / 物品 ${stat.items} · 装备 ${stat.gear} · 容器 ${stat.types} 种 ${stat.instances} 实例）`);
