/* 从 data.js 生成物品清单页（贴图用）。
   以后加物品，重跑一次即可：node gen-item-sheet.js */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { writeSheet } = require('./tools/wiki-layout');

const dir = __dirname;
const money=n=>'¥'+Number(n).toLocaleString('en-US');
require('./tools/build-economy.js').build();
const ctx = { console, Math, Object, Array };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(dir, 'js/config.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(dir, 'js/data.js'), 'utf8'), ctx);
vm.runInContext('globalThis.ITEMS=ITEMS;globalThis.CATS=CATS;globalThis.RARITY=RARITY;globalThis.COLLECTION_CATS=COLLECTION_CATS;globalThis.ITEM_GROUPS=ITEM_GROUPS;globalThis.itemGroup=itemGroup;globalThis.itemCategoryLabel=itemCategoryLabel;globalThis.MEDICAL_GROUPS=MEDICAL_GROUPS;', ctx);

const { ITEMS, CATS, RARITY, COLLECTION_CATS, ITEM_GROUPS, itemGroup, itemCategoryLabel } = ctx;
const classification=require('./design/items/classification.json');
const classificationById=new Map(classification.items.map(item=>[item.id,item]));
const iconId = id => ITEMS.find(i=>i.id===id)?.iconId || id;
const hasIcon = id => fs.existsSync(path.join(dir, 'assets', 'items', iconId(id) + '.png'));
const iconCount = ITEMS.filter(it => hasIcon(it.id)).length;

/* 每个物品的「视觉提示」——画图时看这一句就够了 */
const VISUAL = {
  life01: '白底蓝边的搪瓷缸，口沿磕掉一块瓷，露出深色铁胎',
  life02: '发黄的旧报纸折了一角，头版有大字标题，纸面有水渍',
  life03: '绿色玻璃灯罩的台灯，灯罩内侧熏黑，底座是深色胶木',
  life04: '圆角铁皮饼干盒，红绿花纹褪色，盖子上有个凹痕',
  life05: '带透明塑料包装的叠好的毛巾，包装印褪色的商标',

  /* 生活用品：29 件。基础层＝工业时代通用器物；文化层＝不同传统交汇；
     独有层＝环礁湾自己的机构、商业与工艺史。 */
  life06: '扁方形铝饭盒，盖子上有一排钉出来的工号数字，边角磕凹',
  life08: '圆柱形玻璃糖罐，金属螺旋盖，罐底结着一块深褐色糖块',
  life10: '布袋口散出十几颗玻璃弹珠，其中一颗内部有三道彩纹',
  life11: '双铃机械闹钟，圆形表盘加两只铃铛，指针停在 5:47，背面贴一张小纸条',
  life13: '发条铁皮小火车，绿漆掉了一半，烟囱歪向一侧',
  life15: '千禧年前的重金属电熨斗，胶木手柄，调温旋钮，底面磨得发亮',
  life19: '黑色铸铁缝纫机机头，侧面金色贴花磨淡，手轮裸露，无底座',
  life20: '白瓷礼盒部分展开，盘沿一圈海鸟与海浪印花，内衬纸泛黄',
  life22: '深色丝绸礼服，立领加一排盘扣，西式肩线，袖口一块同色补丁',
  life28: '木盒里的纯银刀叉勺，手柄背面打有成色印记，绒布内衬，金属发暗',
  life32: '深棕色真皮手提箱，黄铜锁扣，钥匙插在锁上',
  life33: '实金细框圆眼镜，折叠镜腿，内侧有细小成色戳记，镜片清晰',
  /* 城市公共生活 */
  life36: '折叠数层的米黄色城市地图，蓝色道路与红色地名标记，边缘磨损',
  life37: '深色金属检票钳，手钳结构，手柄包黑色胶木',
  life38: '米白色按键电话机，灰色卷线，十二个黑色数字键，顶部红色指示灯',
  life39: '银色圆柱保温杯，深蓝色塑料盖，底部一圈防滑橡胶',
  life41: '透明灰塑料磁带收纳盒半开，露出六盘黑色卡式磁带与彩色手写标签',
  life43: '小型红白条纹旋转木马，金色微型立柱，底座带黄铜发条钥匙',
  life44: '褪色海军蓝帆布圆筒行李包，白色粗绳束口，侧面三层印刷编号',
  life45: '桌面机械呼叫铃，圆形金属底座，顶部圆钮，黄铜与银色两种版本',
  life46: '深棕色拉链洗漱包半敞，露出金属剃须刀、折叠牙刷和小镜子',
  life47: '深绿色皮面日程簿，金色书角，黑色束带，夹一支细长圆珠笔',
  life48: '深蓝色紧凑机械打字机，银色按键，前部金属铭牌，侧面折叠把手',
  life49: '小型黄铜机械打火机，外露齿轮与点火轮，底部敲着 000 编号，表面自然氧化',

  elec01: '米黄色塑料外壳的便携收音机，拉出半截天线，刻度盘发黄',
  elec02: '深蓝或银色的方形随身听，透明观察窗里能看见一盒磁带',
  elec03: '黑灰塑料计算器，太阳能条发暗，屏幕显示一个「0」',
  elec04: '绿色电路板，上面有几颗电容和插槽，边缘有小缺口',
  elec05: '淡黄色塑料掌机，墨绿色液晶屏，红色方向键与两个圆形按钮',
  elec06: '黑银双色方形即时成像相机，突出镜头与前部白色相纸出口',
  elec07: '半透明湖蓝色蛋形电子宠物机，墨绿色点阵屏，三颗黄色按钮，顶部银色钥匙链',
  elec08: '银灰色扁平录像机，透明磁带舱、黑色功能键与侧面接口，旁边一小盘录像带',
  elec09: '深黑色小型寻呼机，绿色长条液晶屏，金色功能按钮，侧面凸起的安全模块',
  elec10: '米灰色厚重笔记本电脑，展开的墨绿色显示屏，密集实体键盘，侧面软盘驱动器',
  elec11: '军绿色金属短波电台，伸缩天线、数个大型调节旋钮和一只黑色手持话筒',
  elec12: '深蓝灰色导航终端，绿色单色显示屏、右侧大旋钮、底部金属安装支架',
  elec13: '银灰色仪器箱，正面八个整齐的信号接口，窄绿色显示屏，顶部折叠提手',
  elec14: '黑银双色实验终端，厚重金属机壳，正面小型绿色 CRT 屏，左右不对称模块插槽，红色机械电源开关',
  elec15: '短圆柱钛合金深海探测核心，三道深灰耐压固定环，中段狭长观察窗露出墨绿电路板与铜色线圈，正面深蓝珐琅铭牌刻着 VII，底部三角合金支架',

  ind01: '一段截断的黄铜管，切面发亮，管身氧化发暗绿',
  ind02: '金属轴承，外圈锈斑，内圈还能看见打磨的亮面',
  ind03: '圆形压力表，白色表盘，红色指针顶在最大刻度',
  ind04: '四五颗灰黑色六角螺栓散放，带红褐锈迹，其中一颗套着拧不下来的螺母',
  ind05: '灰色方形混凝土试块，表面粗糙带气孔，侧面白色油漆编号，右上角磕损',
  ind06: '三段长短不一的深灰色螺纹钢筋斜向叠放，表面红褐浮锈，其中一根弯了',
  ind07: '两卷黑色绝缘胶带，一卷扯出短截，内圈贴黄色纸质标签',
  ind08: '黄铜截止阀，红色圆形手轮，两端螺纹接口，阀体有一道扳手划痕',
  ind09: '黑色弧面手持电焊面罩，深绿色矩形滤光窗，底部短手柄，边缘焊渣灼痕',
  ind10: '银灰不锈钢游标卡尺，量爪微张，刻度清晰，搁在打开的木盒上',
  ind11: '乳白色厚壁陶瓷轴套，中心圆孔，边缘精密，嵌在深蓝泡棉包装里',
  ind12: '深灰矩形液压阀组，顶部多个黄铜接头，侧面钢管接口，局部残留机油',
  ind13: '银灰色梯形钛合金锭，表面细密铸造纹理与深色钢印，边缘有金属光泽',
  ind14: '精密陀螺组件，银色双层万向环包着中央金色转子，深灰底座带刻度',
  ind15: '打开的深色收藏箱，银灰长方体量块按尺寸排在深蓝绒布凹槽内，中央一块有极浅划痕，盒盖内侧黄色校准证书',
  ammo:   '散装步枪弹，黄铜弹壳配铜色弹头，三发并排',

  med01: '卷起的白色绷带，外层有一小块暗红污渍',
  med02: '透明塑料注射器，黑色刻度，白色推杆，带针头保护套，斜向摆放',
  med03: '深灰色半透明 X 光胶片，中央白灰色胸腔骨骼影像，后面露出一角棕色档案袋',
  med06: '深棕木质标本盒半开，内部排列透明玻璃载片，部分带紫色染色区与白色编号标签，盒盖内侧有小型分类表',
  med07: '米白医疗监护仪，正面黑色显示屏上显示绿色心电波形与数字读数，右侧一列灰蓝色按键，侧边垂下导联线',
  med08: '黑色硬质收纳盒内排列四枚银黑双色金属物镜，镜筒长度不同，带彩色倍率环与细密刻字',
  med09: '深蓝无菌器械盒，内放银黑环形机械瓣膜，中央两片深色瓣叶，外围缝合环，白色保护泡棉',
  med10: '浅灰长条形注射泵，侧面固定一支透明注射器，前面板绿色数字窗与蓝色功能键，机械推进滑轨清晰',
  med11: '银灰紧凑圆形机械泵，中央透明观察窗，外围精密金属环、两根短接管与蓝色固定支架',
  med12: '透明厚壁六棱柱树脂标本，内部淡粉色分枝状人工组织，深灰金属展示座，正面金色 00 铭牌',
  med13: '米白便携式除颤仪，顶部提手，正面小屏与能量调节旋钮，两只黑色电极板用卷线连接，带橙色按钮',
  med15: '米白紧凑型心电图机，顶部小屏，前端伸出一截印有黑色心电波形的白色热敏纸，侧面接彩色电极导线',
  med14: '米白厚重金属控制主机，面板多个黑色旋钮、拨杆与绿色数字窗，底部排列气路与电路接口',

  antiq01: '木质外壳的座钟，圆形白表盘 + 罗马数字，钟摆停在中间',
  antiq02: '黄铜怀表，表盖半开，内盖刻着两个磨掉一个的字母',
  antiq03: '一枚发黑的小硬币，边缘磨损，图案已经看不清',
  antiq04: '同上的硬币但图案明显压偏，边齿不齐，表面反而更亮',
  antiq05: '一块长方形的绿锈铜门牌，上面刻着「临海路 7 号」',
  antiq06: '长方形铁皮釉色母版，分格烧了十几种釉，每格边上漆写编号，最后一格颜色停在半路',

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
const catOrder = Object.values(ITEM_GROUPS).flatMap(group=>group.cats);

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function card(it) {
  const r = RARITY[it.r - 1];
  const cat = CATS[it.cat];
  const isStack = it.stack > 1;
  const vis = it.visual || VISUAL[it.id] || '';
  return `
    <div class="item" data-item="${it.id}" style="--rc:${r.color}">
      <div class="thumb">
        ${hasIcon(it.id) ? `<img src="assets/items/${esc(iconId(it.id))}.png" width="48" height="48" alt="${esc(it.name)}">` : '<span>待绘制</span><b>48×48</b>'}
      </div>
      <div class="meta">
        <div class="name">${esc(it.name)}${isStack ? '<i class="tag">可堆叠 ' + it.stack + '</i>' : ''}${it.noCodex ? '<i class="tag dim">不进图鉴</i>' : ''}</div>
        <div class="sub"><code>${esc(it.id)}</code> · <span style="color:${cat.color}">${itemCategoryLabel(it)}</span> · <span style="color:${r.color}">${r.name}</span> · ${it.w}kg · ${it.price > 0 ? money(it.price) : '不定价'}${it.short ? ' · 背包简称 <b style="color:#a8c4ba">' + esc(it.short) + '</b>' : ''}</div>
        <div class="desc">${esc(it.desc)}</div>
        ${it.medicalGroup ? `<div class="vis"><b>${esc(ctx.MEDICAL_GROUPS[it.medicalGroup])} · ${esc(it.source)}</b>${it.heal ? `恢复 ${it.heal} HP · 局内 ${it.useTime} 秒 · 局外立即 · 已开放` : `效果待开放 · 预留：${esc(it.reservedEffect)} · 本轮不掉落`}<br>品牌与历史叙事来自医疗产业提案，尚未并入正式世界观。</div>` : ''}
        ${classificationById.has(it.id)?`<div class="vis"><b>分类依据</b>${esc(classificationById.get(it.id).reason)}</div>`:''}
        ${vis ? `<div class="vis"><b>画什么</b>${esc(vis)}</div>` : ''}
      </div>
    </div>`;
}

let body = '';
for (const [groupId,group] of Object.entries(ITEM_GROUPS)) {
  const groupItems=ITEMS.filter(item=>itemGroup(item)===groupId);
  body+=`<section class="item-group" data-item-group="${groupId}"><h2 class="item-group-title">${group.name}<span>${groupItems.length} 件</span></h2><p class="category-description">${groupId==='collectible'?'按九类组织，用于探索、交易与图鉴收集。':'用于装填与治疗，不计入收集图鉴。'}</p>`;
  for (const k of group.cats) {
  const list = byCat[k] || [];
  const cat = CATS[k];
  body += `
  <section class="cat" data-item-category="${k}">
    <h3><span class="dot" style="background:${cat.color}"></span>${cat.name}<em>${k}</em><i>${list.length} 件</i></h3>
    <p class="category-description"><b>${cat.theme}</b> · ${cat.desc}</p>
    ${!list.length?'<p class="category-empty">目前没有符合此类别的既有物品，保留分类供后续扩充。</p>':''}
    ${k==='medical' ? Object.entries(ctx.MEDICAL_GROUPS).map(([key,label])=>`<section class="medical-group" data-medical-group="${key}"><h4>${label} · ${list.filter(i=>i.medicalGroup===key).length} 件</h4><div class="grid">${list.filter(i=>i.medicalGroup===key).map(card).join('')}</div></section>`).join('') : `<div class="grid">${list.map(card).join('')}</div>`}
  </section>`;
  }
  body+='</section>';
}

const rarityBar = RARITY.map(r =>
  `<div class="sw" data-rarity="${r.k}"><span style="background:${r.color}"></span>${r.name}<em>${r.k} · ${ITEMS.filter(i=>itemGroup(i)==='collectible'&&i.r===r.k).length} 件收集品</em></div>`).join('');

const catBar = catOrder.map(k =>
  `<div class="sw"><span style="background:${CATS[k].color}"></span>${CATS[k].name}<em>${k}</em></div>`).join('');

const total = ITEMS.filter(i => !i.noCodex).length;
const economy=vm.runInContext('ECONOMY',ctx);
const valueBands=economy.collectionBands.map(b=>`<div class="value-band" data-value-band="${b.rarity}" style="--rc:${RARITY[b.rarity-1].color}"><span class="value-stripe"></span><b>${RARITY[b.rarity-1].name}</b><span>${b.role}</span><strong>${money(b.min)}–${b.max===null?money(b.referenceUpper)+'+':money(b.max)}</strong></div>`).join('');

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
    共 ${ITEMS.length} 件：${ITEMS.filter(i=>itemGroup(i)==='collectible').length} 件收集品、${ITEMS.filter(i=>itemGroup(i)==='supply').length} 件物资；${total} 件进图鉴。这份清单直接从 <code>js/data.js</code> 生成，
    和游戏里的数据完全一致；改完物品表重跑 <code>node gen-item-sheet.js</code> 就会更新。<br>
    已配置图标 <b>${iconCount} / ${ITEMS.length}</b>，下方预览与游戏共用 <code>assets/items/</code> 中的贴图。<a href="assets/item-art/collectibles/index.html">新增收集品图标总览</a> · <a href="assets/item-art/electronics/index.html">新增电子产品9件</a> · <a href="assets/item-art/medical-collectibles/index.html">新增医疗收集品10件</a>。
    <br>收集品保留九类，物资单独分为弹药类与医疗物品。<a href="design/items/CLASSIFICATION.md">逐件分类与世界观依据</a>。
    <br>医疗品18件图标已全部绘制，5件开放恢复HP，其余效果待开放。<a href="assets/item-art/medical/index.html">查看医疗图标总览</a>。<a href="design/items/MEDICAL.md">医疗系统说明</a> · <a href="design/world setting/医疗产业提案.md">医疗产业提案（非正式历史）</a>。
    <br>稀有度采用白、绿、蓝、紫、金、红六级。<a href="design/items/RARITY.md">查看 ${ITEMS.filter(i=>itemGroup(i)==='collectible').length} 件收集品的稀有度评级</a>；
    生活用品按"工业通用 / 多传统交汇 / 环礁湾独有"三层收敛为 ${ITEMS.filter(i=>i.cat==='life').length} 件，说明见 <a href="design/items/LIFE_COLLECTIBLES.md">生活器物</a>。
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

<section class="economy-guide"><h2>收集品价值体系</h2><p>单位：游戏货币 ¥。色条仅表示稀有度层次，不按金额线性缩放。医疗品与装备采用各自定价。<a href="design/items/ECONOMY.md">逐件价格与经济说明</a></p><div class="value-bands">${valueBands}</div></section>

${body}

<footer>
  清单由 <code>gen-item-sheet.js</code> 生成。价格源为 <code>design/items/economy.json</code>，重跑生成脚本或构建后同步游戏与页面。
</footer>

</body>
</html>`;

writeSheet('物品清单.html', html, 'items');
console.log('已生成 物品清单.html（' + ITEMS.length + ' 件）');
