/* 从 data.js 生成物品清单页（贴图用）。
   以后加物品，重跑一次即可：node gen-item-sheet.js */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { writeSheet } = require('./tools/wiki-layout');

const dir = __dirname;
const ctx = { console, Math, Object, Array };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(dir, 'js/config.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(dir, 'js/data.js'), 'utf8'), ctx);
vm.runInContext('globalThis.ITEMS=ITEMS;globalThis.CATS=CATS;globalThis.RARITY=RARITY;', ctx);

const { ITEMS, CATS, RARITY } = ctx;
const hasIcon = id => fs.existsSync(path.join(dir, 'assets', 'items', id + '.png'));
const iconCount = ITEMS.filter(it => hasIcon(it.id)).length;

/* 每个物品的「视觉提示」——画图时看这一句就够了 */
const VISUAL = {
  life01: '白底蓝边的搪瓷缸，口沿磕掉一块瓷，露出深色铁胎',
  life02: '发黄的旧报纸折了一角，头版有大字标题，纸面有水渍',
  life03: '绿色玻璃灯罩的台灯，灯罩内侧熏黑，底座是深色胶木',
  life04: '圆角铁皮饼干盒，红绿花纹褪色，盖子上有个凹痕',
  life05: '带透明塑料包装的叠好的毛巾，包装印褪色的商标',

  elec01: '米黄色塑料外壳的便携收音机，拉出半截天线，刻度盘发黄',
  elec02: '深蓝或银色的方形随身听，透明观察窗里能看见一盒磁带',
  elec03: '黑灰塑料计算器，太阳能条发暗，屏幕显示一个「0」',
  elec04: '绿色电路板，上面有几颗电容和插槽，边缘有小缺口',

  ind01: '一段截断的黄铜管，切面发亮，管身氧化发暗绿',
  ind02: '金属轴承，外圈锈斑，内圈还能看见打磨的亮面',
  ind03: '圆形压力表，白色表盘，红色指针顶在最大刻度',
  ammo:   '散装步枪弹，黄铜弹壳配铜色弹头，三发并排',

  med01: '卷起的白色绷带，外层有一小块暗红污渍',
  med02: '透明玻璃注射器配金属推杆，针尖朝上，旁边一支小药瓶',
  med03: '深色半透明的 X 光片，对着光能看见一副肋骨的轮廓',

  antiq01: '木质外壳的座钟，圆形白表盘 + 罗马数字，钟摆停在中间',
  antiq02: '黄铜怀表，表盖半开，内盖刻着两个磨掉一个的字母',
  antiq03: '一枚发黑的小硬币，边缘磨损，图案已经看不清',
  antiq04: '同上的硬币但图案明显压偏，边齿不齐，表面反而更亮',
  antiq05: '一块长方形的绿锈铜门牌，上面刻着「临海路 7 号」',

  art01:  '黑色黑胶唱片，露出半张纸质封套，封套上有手写编号',
  art02:  '小幅油画，画的是灰蓝色的海面，画框掉漆，右下角有签名',
  art03:  '一条 35mm 摄影底片，四格画面，对着光能看到模糊的人影',

  lux01:  '机械腕表，银色表壳 + 深色表盘，秒针还在走',
  lux02:  '一小块金条，表面有铸造纹理和一串钢印编号',
  lux03:  '黑色树脂笔身的钢笔，笔帽扣着，笔夹有一道划痕',

  spec01: '一枚巴掌大的螺旋贝壳，螺纹清晰，边缘有一点破损',
  spec02: '不规则矿石标本，深色岩体上有一层蓝绿色结晶',
  spec03: '压平的干燥叶片，夹在一小片发黄的纸里，叶脉清晰',

  odd01:  '半透明的青色不规则结晶，内部有像声波一样的纹路',
  odd02:  '精致的复古黄铜天文仪，三重交错金属圆环，外环有刻度、齿轮和机械装饰，略带锈蚀与海盐结晶。中央悬浮深海蓝透明水球，内部可见微缩海洋、弯曲银白浪线和极小的白色灯塔剪影，下方为三足机械底座。古铜金、深海蓝、银白色为主，少量冷青反光；完整呈现、透明背景，不加文字、场景或大面积发光。',
  odd03:  '银色怀表，表盖敞开，指针停在同一个位置，表面有水痕'
};

const byCat = {};
for (const it of ITEMS) {
  (byCat[it.cat] = byCat[it.cat] || []).push(it);
}
const catOrder = Object.keys(CATS);

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function card(it) {
  const r = RARITY[it.r - 1];
  const cat = CATS[it.cat];
  const isStack = it.stack > 1;
  const vis = VISUAL[it.id] || '';
  return `
    <div class="item" style="--rc:${r.color}">
      <div class="thumb">
        ${hasIcon(it.id) ? `<img src="assets/items/${esc(it.id)}.png" width="48" height="48" alt="${esc(it.name)}">` : '<span>待绘制</span><b>48×48</b>'}
      </div>
      <div class="meta">
        <div class="name">${esc(it.name)}${isStack ? '<i class="tag">可堆叠 ' + it.stack + '</i>' : ''}${it.noCodex ? '<i class="tag dim">不进图鉴</i>' : ''}</div>
        <div class="sub"><code>${esc(it.id)}</code> · <span style="color:${cat.color}">${cat.name}</span> · <span style="color:${r.color}">${r.name}</span> · ${it.w}kg · ${it.price > 0 ? '¥' + it.price : '不定价'}${it.short ? ' · 背包简称 <b style="color:#a8c4ba">' + esc(it.short) + '</b>' : ''}</div>
        <div class="desc">${esc(it.desc)}</div>
        ${vis ? `<div class="vis"><b>画什么</b>${esc(vis)}</div>` : ''}
      </div>
    </div>`;
}

let body = '';
for (const k of catOrder) {
  const list = byCat[k];
  if (!list) continue;
  const cat = CATS[k];
  body += `
  <section class="cat">
    <h2><span class="dot" style="background:${cat.color}"></span>${cat.name}<em>${k}</em><i>${list.length} 件</i></h2>
    <div class="grid">${list.map(card).join('')}</div>
  </section>`;
}

const rarityBar = RARITY.map(r =>
  `<div class="sw"><span style="background:${r.color}"></span>${r.name}<em>${r.k}</em></div>`).join('');

const catBar = catOrder.map(k =>
  `<div class="sw"><span style="background:${CATS[k].color}"></span>${CATS[k].name}<em>${k}</em></div>`).join('');

const total = ITEMS.filter(i => !i.noCodex).length;

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>潮汐线 · 物品清单（贴图用）</title>
</head>
<body>

<header>
  <div class="kicker">TIDELINE · ITEM SHEET</div>
  <h1>物品清单</h1>
  <div class="lede">
    共 ${ITEMS.length} 件（含 1 件消耗品），其中 ${total} 件进图鉴。这份清单直接从 <code>js/data.js</code> 生成，
    和游戏里的数据完全一致；改完物品表重跑 <code>node gen-item-sheet.js</code> 就会更新。<br>
    已配置图标 <b>${iconCount} / ${ITEMS.length}</b>，下方预览与游戏共用 <code>assets/items/</code> 中的贴图。
  </div>
</header>

<div class="spec">
  <div class="panel">
    <h3>贴图规格</h3>
    <p><b>尺寸</b>　48 × 48 像素，PNG，透明背景。物品本体建议占满画布的 40×40，四周留 4px 空隙。</p>
    <p><b>风格</b>　像素画，关闭抗锯齿（游戏里用 <code>image-rendering: pixelated</code> 渲染）。深色背景下要看得清，尽量别用纯黑描边。</p>
    <p><b>命名</b>　文件名就是物品 id：<code>antiq03.png</code>、<code>lux01.png</code>。</p>
    <p><b>位置</b>　<code>tide/assets/items/</code> 目录下。</p>
    <p><b>游戏接入</b>　搜刮、背包、安全箱和仓库共用这套图标。执行 <code>node build.js</code> 后，单文件游戏也会内嵌所有贴图。</p>
  </div>
  <div class="panel">
    <h3>稀有度色（用于边框 / 角标）</h3>
    <div class="sws">${rarityBar}</div>
    <h3 style="margin-top:18px">类别色（用于图鉴分册 / 容器提示）</h3>
    <div class="sws">${catBar}</div>
  </div>
</div>

${body}

<footer>
  清单由 <code>gen-item-sheet.js</code> 生成。物品的重量、价格、稀有度都是首版基准值，可以随便改——
  改完重跑脚本，这份页面会跟着变。
</footer>

</body>
</html>`;

writeSheet('物品清单.html', html, 'items');
console.log('已生成 物品清单.html（' + ITEMS.length + ' 件）');
