
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
function build(){
 const c=vm.createContext({});for(const f of ['config.js','data.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',f),'utf8'),c);
 const {items,tiers,groupOf}=vm.runInContext('({items:ITEMS,tiers:RARITY,groupOf:itemGroup})',c),review=require('../design/items/rarity.json');
 const collectibles=items.filter(i=>groupOf(i)==='collectible');
 assert.equal(review.items.length,collectibles.length);
 for(const row of review.items)assert.equal(items.find(i=>i.id===row.id)?.r,row.rarity);

 const first=review.items.filter(r=>r.batch==='first'),second=review.items.filter(r=>r.batch==='life-2'),third=review.items.filter(r=>r.batch==='life-3');
 const colorNames=['白','绿','蓝','紫','金','红'];
 const ratio=[6,10,25,27,23,9];
 const countBy=(list,k)=>list.filter(r=>r.rarity===k).length;

 const table=tiers.map(t=>{const list=collectibles.filter(i=>i.r===t.k);return `| ${t.k} | ${t.name} | ${colorNames[t.k-1]} | ${list.length} | ${list.map(i=>i.name).join('、')} |`;}).join('\n');

 const distHead=`| 等级 | ${tiers.map(t=>t.k+' '+t.name).join(' | ')} | 合计 |\n| --- | ${tiers.map(()=>'---:').join(' | ')} | ---: |`;
 const distRow=(name,list)=>`| ${name} | ${tiers.map(t=>countBy(list,t.k)).join(' | ')} | ${list.length} |`;
 const ratioRow=`| 目标比例 | ${ratio.map(r=>r+'%').join(' | ')} | 100% |`;
 const distTable=[distHead,distRow('第一批',first),distRow('第二批',second),distRow('第三批',third),distRow('合计',review.items),ratioRow].join('\n');

 const md=`# 六级稀有度与收集品重评

收集品采用 **寻常 → 良品 → 上乘 → 稀见 → 珍罕 → 孤品**，颜色为 **白 → 绿 → 蓝 → 紫 → 金 → 红**。

本文按三批记录：**第一批 ${first.length} 件**（原有物品的稀有度重评，只调整稀有度与依赖它的配置，ID、类别、描述、价格、重量和贴图保留）；
**第二批 ${second.length} 件**（生活器物首次扩充后仍然保留的部分，见 [生活器物](LIFE_COLLECTIBLES.md)）；
**第三批 ${third.length} 件**（生活用品库重构时新增的生活器物与消费电子）。当前共 **${collectibles.length} 件**收集品。

## 三批的数量分布

${distTable}

第二批当初按 6 / 10 / 25 / 27 / 23 / 9 的目标比例铺开；第三批是按场景缺口补齐（交通、办公、公共服务、港口、旅馆、现代消费），
不再追求单批的比例形状，而是让**全库**保持"白绿少、蓝紫金厚、红色极少"的结构。

## 全量分级结果

| 等级 | 名称 | 颜色 | 收集品数量 | 收集品 |
| --- | --- | --- | ---: | --- |
${table}

弹药与绷带仍为一级寻常物资，不计入上表 ${collectibles.length} 件收集品。

## 判断原则

${review.principles.map(p=>'- '+p).join('\n')}

## 逐件评级

| ID | 物品 | 旧级别 | 新级别 | 依据 |
| --- | --- | --- | --- | --- |
${review.items.map(r=>`| ${r.id} | ${r.name} | ${r.previousRarity!=null?r.previousRarity+' '+r.previousName:'—（新增）'} | ${r.rarity} ${tiers[r.rarity-1].name} | ${r.reason} |`).join('\n')}

## 价格口径

价格是**交易锚点**，不是稀有度的换算结果：稀有度看工艺、材质与保存状态，价格看"有没有人买、肯出多少"。
同一档里可以差一倍，跨档不会倒挂。

| 档位 | 常见区间 | 在这座城市里对应什么 |
| --- | ---: | --- |
| 白 寻常 | ¥9–24 | 散碎杂物，一次搜刮的添头 |
| 绿 良品 | ¥22–88 | 完整的家用器物 |
| 蓝 上乘 | ¥120–340 | 还能用、还能修的机械与器具 |
| 紫 稀见 | ¥480–980 | 成套、停产或手工制作的东西 |
| 金 珍罕 | ¥1250–2400 | 材质与工艺都撑得住的高价物 |
| 红 孤品 | ¥2600–3800 | 现存仅此一件 |

异常遗物不进入常规流通，标的是**研究样本收购价**：买主只有极少数收藏者与研究机构，
所以同类之间差距很大，而且和"好不好看"无关。

| ID | 物品 | 稀有度 | 价格 | 定价依据 |
| --- | --- | --- | ---: | --- |
| odd01 | 回响结晶 | 稀见 | ¥680 | 可重复获得，只有响声没有结构；机构按件收，不上拍卖 |
| odd03 | 停摆的怀表 | 稀见 | ¥980 | 成品机械加稳定异常特征，收藏者愿意为"每天都在同一秒停"多付 |
| odd02 | 潮汐仪 | 孤品 | ¥3800 | 全库最高：违反常规规律且没有第二台，只有极少数买家出得起 |

## 接入与兼容

- 六级边框及背景用于搜刮、背包、安全箱和仓库；Wiki共用等级名与颜色。
- 搜索时间依次为 0.45、0.85、1.4、1.8、2.1、3 秒；插入紫级后，金/红搜索时间和原上限保持对应。
- 掉落由**容器品质**决定：六档品质各自给出一整条稀有度曲线（见 [容器品质](CONTAINER_QUALITY.md)），
  档内再按类别、件数平分。加物品只增加花样，不改变任何一档的总概率；连废弃垃圾桶也保留 0.02% 的孤品。
- 价格口径见下节；容器品质与稀有度的关系只体现在掉落曲线，不改变物品本身的定价。
- 医疗品按各自设计采用白至金等级，弹药与绷带维持寻常等级。装备的战斗等级、耐久和价格不变，原金/红显示索引映射到新五/六级；旧仓库装备快照按当前定义重算稀有度，保留耐久和弹匣。
- 旧仓库与图鉴通过原ID读取当前收集品评级，无需迁移物品数量。

[机器可读逐件评级](rarity.json) · [物品分类](CLASSIFICATION.md) · [Wiki](../../wiki.html#items)
`;
 fs.writeFileSync(path.join(root,'design/items/RARITY.md'),md);
 console.log(`已生成六级稀有度说明：${collectibles.length} 件收集品（${first.length} + ${second.length} + ${third.length}）`);
}
module.exports={build};if(require.main===module)build();
