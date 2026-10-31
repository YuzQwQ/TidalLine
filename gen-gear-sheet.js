/* 从 data.js 生成装备清单页（武器 + 头盔 + 护甲 图标贴图用）。
   以后改数值或加装备，重跑一次即可：node gen-gear-sheet.js */
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
vm.runInContext(
  'globalThis.WEAPONS=WEAPONS;globalThis.HELMETS=HELMETS;globalThis.BODIES=BODIES;' +
  'globalThis.BAGS=BAGS;globalThis.BASE_BAG_SLOTS=BASE_BAG_SLOTS;globalThis.RARITY=RARITY;', ctx);

const { WEAPONS, HELMETS, BODIES, BAGS, BASE_BAG_SLOTS, RARITY } = ctx;

const GEAR_DIR = path.join(dir, 'assets', 'gear');
const hasIcon = id => fs.existsSync(path.join(GEAR_DIR, id + '.png'));

/* 每把枪的图标文件名 */
const ICON_ID = { rifle: 'rifle', shotgun: 'shotgun', smg: 'smg', pistol: 'pistol' };
const lid = lv => 'helmet' + lv;
const bid = lv => 'body' + lv;

/* 画什么：等级越高越厚、覆盖越大、附件越多——光靠颜色区分不够，靠剪影 */
const VISUAL = {
  rifle: '侧视 3/4，枪口朝右上。深灰聚合物护木 + 短枪管 + 30 发弯弹匣 + 简易机械瞄具，折叠枪托收到枪身侧。全长约占画布 40px 的横向 90%。',
  shotgun: '侧视，枪口朝右上。短粗枪管，下方一根管状弹仓，中间是泵动护木，木质枪托发暗、有磕碰。整枪比步枪短一截、粗一圈。',
  smg: '侧视，明显比步枪小一圈。方正的机匣、细长的直弹匣、金属折叠托收在侧面，上机匣一颗拉机柄。剪影要"短、窄、密"。',
  pistol: '侧视，只占画布一半（约 28px 长）。套筒 + 握把 + 露出一小截枪管，套筒后端有防滑纹，扳机护圈完整。',

  helmet1: '软塌的深绿布帽，帽顶有压痕，短软檐，侧面缝过徽章的痕迹。完全没有硬壳的亮面——这是 Lv1 的辨识点。',
  helmet2: '亮黄硬塑安全帽，顶部两道加强筋，小前檐，两侧透气孔，表面有划痕和褪色。',
  helmet3: '深灰军绿硬壳，比安全帽厚，带侧护耳片和下颚带，没有面罩。轮廓开始往"圆壳"走。',
  helmet4: '圆润厚壳防弹盔，哑光涂层，侧导轨 + 前挂点，边缘包胶。壳厚明显大于 Lv3。',
  helmet5: '在 Lv4 基础上加厚：后颈护片、侧面配重/耳麦座、加宽前檐。整体轮廓变宽变沉。',
  helmet6: '全罩式：正面一整块略带反光的防弹面罩，两侧螺栓和配重块，下颌包住。剪影最高最重。',

  body1: '厚帆布护胸，土黄色，前面两块方块补丁、粗缝线，肩是布带。软材质，没有插板轮廓。',
  body2: '黑色多层纤维防刺背心，表面能看出层压纹路和缝线，肩部与侧面有绑带。比帆布硬，但仍软塌。',
  body3: '军绿战术背心，织带系统 + 竖排三个弹匣袋 + 一块魔术贴，里面是空的。整体贴身、窄。',
  body4: '战术防弹衣，能看出前后插板的硬边轮廓，侧腰收紧带，肩部有软垫。比上一级厚一格，肩线变方。',
  body5: '重型防弹衣，加厚插板 + 立领护颈 + 护裆片 + 一圈口袋。整件变宽、变方、有明显的厚度立面。',
  body6: '攻坚装甲，硬质外骨骼式：分块装甲片、硬领、肩甲、螺栓和液压管。剪影最宽最厚，一眼就是"重装"。',

  bag: '单格帆布/尼龙背包，正面一个翻盖 + 两条压缩带。（通用占位图）',

  /* 背包五档：剪影要能一眼分出容量大小 —— 从扁平小挎包一路长到带外挂仓的大包 */
  bag01: '一只旧军绿色或黄褐色帆布单肩挎包，包体偏扁，翻盖结构，正面一枚金属搭扣，肩带较长，边角有轻微磨损和褪色感。',
  bag02: '一只蓝灰色或深青色尼龙双肩背包，带前置拉链袋、双肩带和顶部提手，轮廓比 bag01 更饱满，结构更现代。',
  bag03: '一只墨绿色或灰绿色登山背包，包体较高，有顶盖、侧袋、卷带和少量外挂结构，整体更厚实，给人结实耐用的感觉。',
  bag04: '一只深橄榄绿或深灰绿色战术双肩包，正面横向织带、压缩带、厚实肩带和多个分仓，外形紧凑硬朗。',
  bag05: '一只大型深石墨色或黑灰色模块化背包，包体厚实，结构分明，带外挂仓、压缩带、金属支撑感和少量深翡翠色识别条，高端但仍在 90 年代科技水平内。'
};

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function thumb(id) {
  return hasIcon(id)
    ? `<img src="assets/gear/${esc(id)}.png" width="48" height="48" alt="${esc(id)}">`
    : '<span>待绘制</span><b>48×48</b>';
}

/* ---- 武器卡 ---- */
function weaponCard(key) {
  const w = WEAPONS[key];
  const id = ICON_ID[key] || key;
  const slotName = w.slot === 'primary' ? '主武器位' : '副武器位';
  return `
    <div class="item">
      <div class="thumb">${thumb(id)}</div>
      <div class="meta">
        <div class="name">${esc(w.name)}<i class="tag">${esc(slotName)}</i></div>
        <div class="sub"><code>${esc(id)}.png</code> · ${esc(w.short)} · ${w.dmgMin}–${w.dmgMax} 伤害 · 弹匣 ${w.mag} · ${w.rpm} 发/分 · ${w.w}kg · ${money(w.price)}</div>
        <div class="desc">${esc(w.desc || '')}</div>
        <div class="vis"><b>画什么</b>${esc(VISUAL[key] || '')}</div>
      </div>
    </div>`;
}

/* ---- 背包卡：一档一张，容量与重量各不同 ---- */
function bagCard(b) {
  const id = b.id;
  const tag = RARITY.find(r => r.k === b.r);
  const tagName = tag ? tag.name : '寻常';
  return `
    <div class="item lv${b.r}">
      <div class="thumb">${thumb(id)}</div>
      <div class="meta">
        <div class="name">${esc(b.name)}<i class="tag">${esc(tagName)} · ${b.slots} 格</i><i class="tag dim">${esc(b.short)}</i></div>
        <div class="sub"><code>${esc(id)}.png</code> · 携带容量 <b class="dr">${b.slots} 格</b> · ${b.w}kg · ${money(b.price)}</div>
        <div class="vis"><b>画什么</b>${esc(VISUAL[id] || '')}</div>
        <div class="vis"><b>说明</b>${esc(b.desc || '')}</div>
      </div>
    </div>`;
}

function armorCard(type, g) {
  const id = type === 'helmet' ? lid(g.lv) : bid(g.lv);
  const tag = type === 'helmet' ? '头盔' : '身体护甲';
  const move = type === 'body' ? ' · 移速 ×' + g.move.toFixed(2) : '';
  return `
    <div class="item lv${g.lv}">
      <div class="thumb">${thumb(id)}</div>
      <div class="meta">
        <div class="name">${esc(g.name)}<i class="tag">Lv${g.lv} ${tag}</i><i class="tag dim">${esc(g.short)}</i></div>
        <div class="sub"><code>${esc(id)}.png</code> · 防护 <b class="dr">Lv${g.lv}</b> · 耐久 ${g.dur} · ${g.w}kg${move} · ${money(g.price)}</div>
        <div class="vis"><b>画什么</b>${esc(VISUAL[id] || '')}</div>
      </div>
    </div>`;
}

const total = Object.keys(WEAPONS).length + HELMETS.length + BODIES.length + 1;
const done = Object.keys(WEAPONS).filter(k => hasIcon(ICON_ID[k] || k)).length
  + HELMETS.filter(g => hasIcon(lid(g.lv))).length
  + BODIES.filter(g => hasIcon(bid(g.lv))).length
  + (hasIcon('bag') ? 1 : 0);

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>潮汐线 · 装备清单（贴图用）</title>
</head>
<body>

<header>
  <div class="kicker">TIDELINE · GEAR SHEET</div>
  <h1>装备清单</h1>
  <div class="lede">
    这一批是新加的装备图标：<b>${Object.keys(WEAPONS).length} 把武器</b> + <b>${HELMETS.length} 级头盔</b> +
    <b>${BODIES.length} 级身体护甲</b>，另加 1 张可选背包。它们<b>不占背包格</b>，只出现在三处：
    局内背包顶部 6 格装备条、尸体面板顶部 3 格装备区（都是 24px 图标），藏身处装备区（34px 图标）。<br>
    已完成 <b>${done} / ${total}</b>。清单直接读 <code>js/data.js</code>，改完数值重跑
    <code>node gen-gear-sheet.js</code> 就会更新。
  </div>
</header>

<div class="spec">
  <div class="panel">
    <h3>贴图规格</h3>
    <p><b>尺寸</b>　48 × 48 像素，PNG，透明背景。主体占满中央 40 × 40，四周留 4px。</p>
    <p><b>显示尺寸</b>　局内装备条为 24px，藏身处为 34px，细节要粗、要能一眼认出，别画密集细花纹和小字。</p>
    <p><b>画法</b>　物品图标可以用比场景更适合辨识的展示角度，不必受 75° 俯视约束。左上光源，硬边像素，无抗锯齿、无外发光、不画投影。</p>
    <p><b>命名</b>　<code>rifle.png</code> <code>shotgun.png</code> <code>smg.png</code> <code>pistol.png</code>；<code>helmet1.png</code>～<code>helmet6.png</code>；<code>body1.png</code>～<code>body6.png</code>；<code>bag.png</code>。</p>
    <p><b>位置</b>　<code>tide/assets/gear/</code> 目录下。</p>
  </div>
  <div class="panel">
    <h3>等级递进原则</h3>
    <p><b>1 → 3 级</b>　能"看穿"的材料：布、纤维、织带。靠材质和缺口区分。</p>
    <p><b>4 → 6 级</b>　硬质插板/外壳轮廓，靠<b>厚度、覆盖面积、附件数量</b>区分，不要只换颜色。</p>
    <p><b>剪影优先</b>　六张摆在一起时，只看黑色剪影就该能排出 1～6 的顺序：越低越软塌越窄，越高越方越宽越重。</p>
    <p><b>调色</b>　低饱和旧化。头盔走灰绿/哑光黑，护甲走土黄→军绿→深灰，高级别加一点脏铜色螺栓当高光点。</p>
    <p>分级色只是辅助：<span style="color:#8a9a96">Lv1 灰绿</span> · <span style="color:#7fae9f">Lv2</span> · <span style="color:#9fc4b3">Lv3</span> · <span style="color:#c8b47a">Lv4</span> · <span style="color:#b5883a">Lv5</span> · <span style="color:#8d6a3a">Lv6</span></p>
  </div>
</div>

<section class="cat">
  <h2>武器<em>weapon</em><i>${Object.keys(WEAPONS).length} 张</i></h2>
  <div class="grid">${Object.keys(WEAPONS).map(weaponCard).join('')}</div>
</section>

<section class="cat">
  <h2>头盔<em>helmet</em><i>${HELMETS.length} 张 · Lv1–Lv6</i></h2>
  <div class="grid">${HELMETS.map(g => armorCard('helmet', g)).join('')}</div>
</section>

<section class="cat">
  <h2>身体护甲<em>body armor</em><i>${BODIES.length} 张 · Lv1–Lv6</i></h2>
  <div class="grid">${BODIES.map(g => armorCard('body', g)).join('')}</div>
</section>

<section class="cat">
  <h2>背包<em>backpack</em><i>${BAGS.length} 张 · 决定携带容量</i></h2>
  <div class="grid">
    ${BAGS.map(b => bagCard(b)).join('')}
  </div>
</section>

<footer>
  清单由 <code>gen-gear-sheet.js</code> 生成，数据来自 <code>js/data.js</code> 的 WEAPONS / HELMETS / BODIES。<br>
  图标共用 <code>assets/gear/</code>，已接入藏身处、局内装备槽和尸体装备区。更新贴图后重跑本脚本刷新进度，
  再执行 <code>node build.js</code> 打包单文件游戏；缺图时仍保留文字占位。
</footer>

</body>
</html>`;

fs.mkdirSync(GEAR_DIR, { recursive: true });
writeSheet('装备清单.html', html, 'gear');
console.log('已生成 装备清单.html（' + total + ' 张，已完成 ' + done + '）');
