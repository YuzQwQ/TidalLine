const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
function build(){
 const spec=JSON.parse(fs.readFileSync(path.join(root,'design/items/economy.json'),'utf8'));
 const money=n=>'¥'+n.toLocaleString('en-US'),names=['寻常','良品','上乘','稀见','珍罕','孤品'];
 const bands=spec.collectionBands.map(b=>`| ${names[b.rarity-1]} | ${b.role} | ${money(b.min)}–${money(b.max??b.referenceUpper)}${b.max===null?'+':''} |`).join('\n');
 const items=spec.items.filter(i=>i.group==='collectible').map(i=>`| ${i.id} | ${i.name} | ${names[i.rarity-1]} | ${money(i.price)} |`).join('\n');
 const medical=spec.items.filter(i=>i.group==='medical').map(i=>`| ${i.id} | ${i.name} | ${names[i.rarity-1]} | ${money(i.price)} |`).join('\n');
 const armor=spec.armor.helmet.map((p,n)=>`| ${n+1} | ${money(p)} | ${money(spec.armor.body[n])} |`).join('\n');
 const guns=Object.entries(spec.weapons).map(([id,v])=>`| ${spec.baseline.weapons[id].name} | ${money(v.price)} |`).join('\n');
 const text=`# 收集品与装备价值体系 · 初版\n\n价格源：[economy.json](economy.json)。这是游戏货币¥；各稀有度色条仅表示层次，不按金额线性缩放。收集品逐件定价，医疗品和装备使用独立价格表，不受收集品价格带限制。\n\n## 收集品价格带\n\n| 稀有度 | 定位 | 价格带 |\n| --- | --- | --- |\n${bands}\n\n孤品下限为¥200,000，¥3,000,000+是参考大奖区间，不是硬上限。目前釉色母版¥400,000、零号打火机¥900,000、潮汐仪¥3,000,000。\n\n## 防护与枪械\n\n| 防护等级 | 全新头盔 | 全新护甲 |\n| --- | --- | --- |\n${armor}\n\n目前每级只有一件，采用代表价；不新增随机浮价。未来同级变体可按定位上下浮动15%–30%。防御、耐久、重量和现有操作惩罚保持原值，本轮不引入新战斗参数。商人仍出售I–III级防具。\n\n| 枪械 | 全新售价 |\n| --- | --- |\n${guns}\n\n四把现有枪械分别放入基础手枪、霰弹枪、冲锋枪、基础突击步枪价格带。未新增高级手枪。枪械显示稀有度独立于价格，避免货币尺度变化把所有枪械变成金色。\n\n## 医疗品价格\n\n| ID | 医疗品 | 稀有度 | 售价 |\n| --- | --- | --- | --- |\n${medical}\n\n前五件恢复药仍可治疗，其余13件保留效果待开放。医生库存仍为白绿蓝10件。医生按现行绷带价格和治疗量报价：等效药费=ceil(缺失HP / 20)×¥2,000，服务费=max(绷带价格×50%, ceil(等效药费×25%))。缺20/50/99HP分别收¥3,000/¥7,500/¥12,500；满血不收费。\n\n## 初始资金、补给和存档\n\n- 新存档初始¥60,000；信用点低于¥20,000沿用救济补给规则。医生没有救济折扣。\n- 弹药补购¥200/发，出售¥100/发；石子¥500/颗；绷带补购与医生售价统一¥2,000。默认60发、3绷带、3石子，无库存时花费¥19,500。数量、负重和救济规则不变。\n- 旧余额原数保留，不乘100、不补差、不重置；HP、物品数量和图鉴不变。\n- 旧仓库装备快照及配装按现行模板重算价格，保留耐久与余弹；重复加载不会再次换算。\n- 装备回收仍以全新价50%为上限，护甲再乘耐久比例；普通物品按表中价格出售。\n- UI、物品/装备清单与离线版统一使用新价格，金额显示千位分隔符。\n\n## 逐件收集品定价\n\n| ID | 收集品 | 稀有度 | 售价 |\n| --- | --- | --- | --- |\n${items}\n\n构建：node tools/build-economy.js 同步运行价格；物品清单、装备清单和离线构建会自动调用。医疗源数据保留完整描述与药效，运行价格以经济表为准。验证：node tools/test-economy.js，以及双版本浏览器检查 tools/test-economy-browser.js。\n`;
 fs.writeFileSync(path.join(root,'design/items/ECONOMY.md'),text);console.log(`已生成价格体系说明：${spec.items.filter(i=>i.group==='collectible').length}收集品 / ${spec.items.filter(i=>i.group==='medical').length}医疗品 / 12防具 / 4枪`);
}
module.exports={build};if(require.main===module)build();
