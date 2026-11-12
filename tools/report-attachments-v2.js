const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
const d=require('../design/weapons/attachments-v1/attachments.json'),guns=require('../design/weapons/arsenal-v1/arsenal.json').weapons;
const names=Object.fromEntries(guns.map(w=>[w.id,w.name])),mags=Object.values(d.magazineFamilies),out=path.join(root,'design/weapons/attachments-v2');
fs.mkdirSync(out,{recursive:true});
const e=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const desc=a=>Object.entries(a.statModifiers).map(([k,v])=>k==='adsView'?`视距 ${v}×`:k==='adsZoom'?`镜头 ${v}×`:k==='magazineCapacityFixed'?`固定 ${v} 发`:`${k} ${v>0?'+':''}${Math.round(v*100)}%`).join('；');
const markdown=`# 配件系统 V2 · 实装记录

正式物品、交易、掉落、改枪及旧档迁移已接入；新姿态、键位、镜头与 ADS 专属精度已同步正式战局；靶场保留独立调参。
数据源沿用 design/weapons/attachments-v1/attachments.json（version 2），运行时 attachment-data.js 为构建产物。

## 逐枪接口表

| 接口族 | 兼容武器 | 原厂容量 | 扩容 | 弹鼓 |
|---|---|---|---:|---:|
${mags.map(f=>`| ${f.label} | ${f.weapons.map(id=>names[id]).join(' / ')} | ${f.weapons.map(id=>guns.find(g=>g.id===id).mag).join(' / ')} | ${f.extended||'—'} | ${f.drum||'—'} |`).join('\n')}

MP-155 与 Remington 870 为管式供弹，不开放弹匣槽。接口与容量是本游戏适配设定。
竞赛型只降低装填时间18%，聚合物只降低瞄准时间10%，容量均为该枪原厂容量。
扩容型固定容量，举枪+8%、装填+5%；弹鼓固定容量，举枪+20%、装填+25%。
军火商出售 r1–r3，r4–r5 沿用现有配件掉落渠道，未提高容器抽取占比。

## 迁移规则

迁移在任何旧件过滤、配件归一化、弹量裁剪之前执行，原文备份到 tideline_save_v1_attachments_v1_backup。
attachmentsVersion=2 与新存档原子写入；备份或存储失败中止加载，原存档不变。
安装中的 quick / ext / quick_ext 分别转接口竞赛型 / 扩容 / 弹鼓；不兼容或该族未开放则卸下并按旧基础售价补信用点。
散装旧件仅在口径可唯一确定接口时换新，否则补信用点。不根据当前背包中的枪猜测接口。
覆盖装备、仓库、背包、安全箱、未领取信件与恢复记录；已领取信件不再次补偿。
缩容保持先装入的混装弹药顺序，余弹完整退仓；迁移可产生超额仓库存量，正常购买/转入仍受容量约束。
既有伊莲娜委托的旧弹鼓奖励更新为 STANAG 60 发；未完成委托只替换奖励，不提前发放。

## 效果与测试

同属性加算后统一应用下限：双轴后坐、散布与连射增长最低0.5，举枪与装填最低0.6，噪声最低0.32（支持SLX −68%）。
adsSpread 在稳定进度55%之后渐入，hipSpread 在到达55%时退出；枪械自己的 adsPrecisionMul 单独插值一次。
正式战局同样在55%肩射节点后渐入瞄具精度；hipSpread在到达肩射节点前退出。噪声修正改变AI听觉半径，不改变音量。
瞄具倍率沿用已试玩版本；肩射1.08×；无镜、反射、全息、开放式机瞄画面1.15×；光学镜画面统一1.4×。视距独立于画面放大，远程战术镜2.4的视距参数提供最大的有限观察区，允许角色离屏。

验证命令：node tools/test-attachments-v2.js、node tools/test-attachments.js、node tools/test-attachments-v2-browser.js。
图标成品 assets/gear/，新原稿 assets/item-art/attachments-v2/sources/，提示词 assets/source/prompts/attachments-v2.json。

验收结果：V2及后续扩充专项、主回归通过；既有配件事务、装填、改枪、邮件、伊莲娜服务和人形枪械回归通过。
普通版与离线版均通过八种瞄具、远处聚焦和有限观察窗口测试，正式战局启用共享镜头与键位，并扩展实际可见距离，保留墙体遮挡。
新增68张图标均为48×48透明PNG，素材体检0错误、0警告；离线版已重建。
验收截图：[商店](runtime-shop.png)、[改枪](runtime-gunsmith.png)、[靶场](runtime-range.png)、[离线改枪](offline-gunsmith.png)、[图标总览](gallery.png)。
浏览器结构化记录见 [browser-verification.json](browser-verification.json)。

## 完整物品表（${d.items.length}件）

| ID | 名称 | r | kg | 售价 | 效果 |
|---|---|---:|---:|---:|---|
${d.items.map(a=>`| ${a.id} | ${a.name} | ${a.r} | ${a.w} | ${a.price} | ${desc(a)} |`).join('\n')}
`;
fs.writeFileSync(path.join(out,'README.md'),markdown);
fs.writeFileSync(path.join(out,'gallery.html'),`<!doctype html><meta charset="utf-8"><title>配件 V2 素材总览</title><style>body{background:#101a17;color:#c4d1c8;font:13px sans-serif;margin:24px}main{display:grid;grid-template-columns:repeat(8,minmax(110px,1fr));gap:12px}figure{margin:0;background:#18261f;border:1px solid #344d40;border-radius:6px;padding:12px;text-align:center}img{width:80px;height:80px;image-rendering:pixelated}small{display:block;overflow-wrap:anywhere;font:10px monospace;color:#80998d}h1{font-size:24px}</style><h1>配件 V2 · ${d.items.length}件 / ${mags.length}个弹匣接口族</h1><main>${d.items.map(a=>`<figure><img src="../../../assets/gear/${e(a.icon)}.png"><figcaption>${e(a.name)}</figcaption><small>${e(a.id)}</small></figure>`).join('')}</main>`);
const missing=d.items.filter(a=>!fs.existsSync(path.join(root,'assets/gear',a.icon+'.png'))).map(a=>a.id);
console.log(JSON.stringify({parts:d.items.length,magazines:d.items.filter(a=>a.subtype==='magazine').length,missing}));
if(process.argv.includes('--check')&&missing.length)process.exitCode=1;
