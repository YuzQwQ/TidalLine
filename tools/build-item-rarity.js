
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
function build(){
 const c=vm.createContext({});for(const f of ['config.js','data.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',f),'utf8'),c);
 const {items,tiers,groupOf,economy}=vm.runInContext('({items:ITEMS,tiers:RARITY,groupOf:itemGroup,economy:ECONOMY})',c),review=require('../design/items/rarity.json');
 const collectibles=items.filter(i=>groupOf(i)==='collectible');
 assert.equal(review.items.length,collectibles.length);
 for(const row of review.items)assert.equal(items.find(i=>i.id===row.id)?.r,row.rarity);

 const first=review.items.filter(r=>r.batch==='first'),second=review.items.filter(r=>r.batch==='life-2'),third=review.items.filter(r=>r.batch==='life-3'),fourth=review.items.filter(r=>r.batch==='elec-1'),fifth=review.items.filter(r=>r.batch==='ind-1'),sixth=review.items.filter(r=>r.batch==='med-1'),seventh=review.items.filter(r=>r.batch==='collect-1'),eighth=review.items.filter(r=>r.batch==='mil-1'),ninth=review.items.filter(r=>r.batch==='intel-1'),tenth=review.items.filter(r=>r.batch==='occ-1');
 const colorNames=['白','绿','蓝','紫','金','红'];
 const ratio=[6,10,25,27,23,9];
 const countBy=(list,k)=>list.filter(r=>r.rarity===k).length;

 const table=tiers.map(t=>{const list=collectibles.filter(i=>i.r===t.k);return `| ${t.k} | ${t.name} | ${colorNames[t.k-1]} | ${list.length} | ${list.map(i=>i.name).join('、')} |`;}).join('\n');

 const distHead=`| 等级 | ${tiers.map(t=>t.k+' '+t.name).join(' | ')} | 合计 |\n| --- | ${tiers.map(()=>'---:').join(' | ')} | ---: |`;
 const distRow=(name,list)=>`| ${name} | ${tiers.map(t=>countBy(list,t.k)).join(' | ')} | ${list.length} |`;
 const ratioRow=`| 目标比例 | ${ratio.map(r=>r+'%').join(' | ')} | 100% |`;
 const distTable=[distHead,distRow('第一批',first),distRow('第二批',second),distRow('第三批',third),distRow('第四批',fourth),distRow('第五批',fifth),distRow('第六批',sixth),distRow('第七批',seventh),distRow('第八批',eighth),distRow('第九批',ninth),distRow('第十批',tenth),distRow('合计',review.items),ratioRow].join('\n');

 /* 价格带直接读 ECONOMY（economy.json 生成），不再手写，避免文档与数值脱节 */
 const money=v=>'¥'+v.toLocaleString('en-US');
 const bandFlavor=['散碎杂物，一次搜刮的添头','完整的家用器物','还能用、还能修的机械与器具','成套、停产或手工制作的东西','材质与工艺都撑得住的高价物','现存仅此一件'];
 const bandTable=economy.collectionBands.map(b=>`| ${colorNames[b.rarity-1]} ${tiers[b.rarity-1].name} | ${money(b.min)}–${b.max==null?money(b.referenceUpper)+'+':money(b.max)} | ${bandFlavor[b.rarity-1]} |`).join('\n');
 const oddNote={odd01:'可重复获得，只有响声没有结构；机构按件收，不上拍卖',odd03:'成品机械加稳定异常特征，收藏者愿意为"每天都在同一秒停"多付',odd02:'全库最高：违反常规规律且没有第二台，只有极少数买家出得起'};
 const oddTable=items.filter(i=>i.cat==='odd').sort((a,b)=>a.price-b.price).map(i=>`| ${i.id} | ${i.name} | ${tiers[i.r-1].name} | ${money(i.price)} | ${oddNote[i.id]||''} |`).join('\n');

 const md=`# 六级稀有度与收集品重评

收集品采用 **寻常 → 良品 → 上乘 → 稀见 → 珍罕 → 孤品**，颜色为 **白 → 绿 → 蓝 → 紫 → 金 → 红**。

本文按十批记录：**第一批 ${first.length} 件**（原有物品的稀有度重评，只调整稀有度与依赖它的配置，ID、类别、描述、价格、重量和贴图保留）；
**第二批 ${second.length} 件**（生活器物首次扩充后仍然保留的部分，见 [生活器物](LIFE_COLLECTIBLES.md)）；
**第三批 ${third.length} 件**（生活用品库重构时新增的生活器物与消费电子）；
**第四批 ${fourth.length} 件**（电子产品扩充，见 [精选电子产品](ELECTRONICS.md)）；
**第五批 ${fifth.length} 件**（工业器材扩充，见 [工业器材](INDUSTRIAL.md)）；
**第六批 ${sixth.length} 件**（医疗收集品扩充，见 [医疗收集品](MEDICAL_COLLECTIBLES.md)）；
**第七批 ${seventh.length} 件**（文物藏品扩充，见 [文物藏品](COLLECTIBLES.md)）；
**第八批 ${eighth.length} 件**（军事收集品，见 [军事收集品](MILITARY_COLLECTIBLES.md)）；
**第九批 ${ninth.length} 件**（情报收集品，见 [情报收集品](INTEL_COLLECTIBLES.md)）；
**第十批 ${tenth.length} 件**（神秘学物品，见 [神秘学物品](OCCULT_COLLECTIBLES.md)）。当前共 **${collectibles.length} 件**收集品。

其中归属第一批的 13 件文物藏品在 2026-10 做过整批修订：稀有度不变，但文案全部重写、金条重量由 5kg 改为 1kg，
随后又补入第七批 8 件，文物藏品增至 21 件，
见 [文物藏品](COLLECTIBLES.md)。本文的「第一批……描述保留」只描述当轮重评，不约束后续修订。

## 十批的数量分布

${distTable}

第二批当初按 6 / 10 / 25 / 27 / 23 / 9 的目标比例铺开；第三批是按场景缺口补齐（交通、办公、公共服务、港口、旅馆、现代消费），
第四批是电子产品扩充（家用娱乐、记录器材、通信、科研仪器），两批都不再追求单批的比例形状，
而是让**全库**保持"白绿少、蓝紫金厚、红色极少"的结构。

第四批把电子产品从 6 件补到 15 件，新增 2 件孤品（工程原型与深海核心）：
电子类只有"原型机"这一种天然的唯一性来源。

红档（孤品）到第十批为止共 11 件，分布为生活 1、文物 2、电子 2、工业 1、医疗 1、军事 1、情报 1、神秘学 1、异常 1。
两个非电子类各自只有一种说得通的唯一性来源：文物是**工序母版**（釉色标准版、城市全景图原版刻版），
即"这门手艺只剩下这一件"；工业是**量值基准**（零号标准量块组），即"整个体系以它为原点"。
第八批给军事类补了第三种：**行动原件**（首潮撤离标图板）——它不是"只有一件"，而是"只有这一次"，
唯一性来自它参与过某个再也不会发生的事件。
第九批给情报类补的是第四种：**第一手观测记录**（首潮原始观测记录）——不是"只有一件"，而是"只有第一次"，
唯一性来自它记下了某件事第一次被测量的那一刻。
第十批给神秘学补的是第五种：**孤本残页**（第零页圣典）——不是"只有一件成品"，而是"整部书只剩下这一页"，
唯一性来自它属于一个已经散佚的文本体系。

第五批把工业器材从 3 件补到 15 件，形状是"底部厚、顶部薄"：6 件白绿耗材垫底，
蓝紫共 4 件支撑中段收益，只有 1 件金、1 件红（零号标准量块组）。
工业器材的价值天然随精度上升，而精度是可以被看见的（卡尺的刻线、阀组的油路、量块的划痕），
所以这一类的梯度比生活用品更容易读懂。

第六批把医疗收集品从 2 件补到 12 件，全部是**科室器材与科研标本**，没有一件能当药用：
白绿仍是注射器与 X 光片，蓝档是注射泵与心电图机，紫档是切片盒、监护仪、物镜组与除颤仪，
金档是瓣膜、循环辅助泵与呼吸机主机，红档是「初生」零号样本。
医疗类的稀缺理由很统一——**设备越贵，越救不了眼前这个人的命**，这是它和药品的分界。

第七批把文物藏品从 13 件补到 21 件，补的是**四个原本空缺的位置**：
绿档一件（彩绘陶瓷面具）让抽屉里也能翻到文物；蓝档两件（首映海报、菊石化石）接住"有版本、有出处"的普通收藏；
紫档两件（游戏卡带、手绘航海图）是这一批的骨干；金档两件（珐琅音乐盒、蓝宝石胸针）把"工艺"与"材质"两条线分别推高；
红档再加一件（环礁湾雕刻铜版），与釉色母版并列为**两块"工序母版"**——一块定颜色，一块定城市。

文物藏品由此成为金档最多的类别（5 件），因为金档只认三件事：贵金属、复杂工艺、限量身份，而文物三样都占。

第八批把军事收集品从 0 件补到 15 件。此前军事类**只有弹药，而且弹药是物资**，
所以这一类在收集品里一直是空的——图鉴里能看到"军事物资"的标题，下面没有一件东西。

十五件按"越靠近人越好懂、越靠近系统越贵"排：
白绿五件是单兵装具（弹链盒、水壶、身份牌、信号灯、封锁牌），
蓝紫六件是光学与通信（罗盘、野战电话、枪机、夜视仪、密钥模块、剂量仪），
金三件是系统级设备（测距仪、热成像、通信主机），红一件是行动原件（撤离标图板）。
军事类的价值曲线比别的类陡：**前五件加起来 ¥23,100，后四件从 ¥190,000 起**。

第九批把情报资料从 2 件补到 15 件（旧报纸、摄影底片保留）。前两件是**居民视角**——
一张报纸、一卷底片，谁都能有；新增的十三件把视角一路推到机构内部：
港口与市政记录 → 封锁与撤离名册 → 专业勘测与调查 → 首潮观测。
情报类的稀有度不跟材质走（全是纸和磁带），跟**"谁能拿到这份东西"**走：
电话簿人人都能买，勘测报告只有跨机构小组才有，首潮观测记录只有那一个观测站存在过。

第十批把神秘学物品从 0 件补到 15 件。这一类此前是**空类**：分类表里有"神秘学物品"，
下面一件东西都没有，因为一直没找到"是神秘学而不是异常"的判断标准。

标准现在很明确：**神秘学物品证明有人相信、实践并传承某种知识；异常遗物必须有可重复验证的超常性质。**
最典型的一条对照是无声祈祷铃（¥480,000）：它不是"违反物理规律所以不响"，而是**从来没有安装过铃舌**——
信仰观念直接写进了实物结构。同样，祷文卷不"诅咒"读者，它只是把句序倒过来；
符板不"预测"潮汐，它只是刻着谁都读不懂的弧线。

这一类的价格也不跟材质走，跟**"这套知识被保存到什么程度"**走：
一根三色棉绳 ¥1,800，同一套观念做成七环铜护符就值 ¥6,800，做成银针蜡印是 ¥34,000–38,000，
做成星盘核心与三环戒是 ¥260,000–340,000，而一页散佚圣典的残页值 ¥1,800,000。

目前全库孤品 7 件，分布在生活 1、文物 1、电子 2、工业 1、医疗 1、异常 1。

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
${bandTable}

价格带是**观察区间**，不是硬约束：电子类专业设备单价整体偏高，蓝紫之间约 2,000 元、紫金之间约 10,000 元的交叠，
稀有度仍按工艺、材质与保存状态判定，不由价格反推。

异常遗物不进入常规流通，标的是**研究样本收购价**：买主只有极少数收藏者与研究机构，
所以同类之间差距很大，而且和"好不好看"无关。

| ID | 物品 | 稀有度 | 价格 | 定价依据 |
| --- | --- | --- | ---: | --- |
${oddTable}

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
 console.log(`已生成六级稀有度说明：${collectibles.length} 件收集品（${first.length} + ${second.length} + ${third.length} + ${fourth.length} + ${fifth.length} + ${sixth.length} + ${seventh.length} + ${eighth.length} + ${ninth.length} + ${tenth.length}）`);
}
module.exports={build};if(require.main===module)build();
