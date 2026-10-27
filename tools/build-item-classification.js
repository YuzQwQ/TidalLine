
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'design/items');
function build(){
 const review=JSON.parse(fs.readFileSync(path.join(dir,'classification.json'),'utf8')),context=vm.createContext({});
 for(const f of ['config.js','data.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',f),'utf8'),context);
 const {items,cats,groups,groupOf}=vm.runInContext('({items:ITEMS,cats:CATS,groups:ITEM_GROUPS,groupOf:itemGroup})',context);
 assert.equal(items.length,review.items.length);
 for(const r of review.items){const item=items.find(i=>i.id===r.id);assert.equal(item?.cat,r.category);assert.equal(groupOf(item),r.group);}
 const esc=s=>String(s).replace(/\|/g,'／').replace(/\n/g,' '),codex=items.filter(i=>!i.noCodex).length;
 const nCollect=items.filter(i=>groupOf(i)==='collectible').length,nSupply=items.filter(i=>groupOf(i)==='supply').length;
 const summaries=Object.entries(groups).map(([id,g])=>{
  const rows=g.cats.map(k=>{const list=items.filter(i=>i.cat===k);return `| ${cats[k].name} | ${list.length} | ${list.map(i=>i.name).join('、')||'暂无'} |`;});
  return `### ${g.name} ${items.filter(i=>groupOf(i)===id).length} 件\n\n| 子分类 | 数量 | 物品 |\n| --- | ---: | --- |\n${rows.join('\n')}`;
 }).join('\n\n');
 const md=`# 物品分类说明\n\n现有 ${items.length} 件物品分为 **收集品 ${nCollect} 件** 和 **物资 ${nSupply} 件**。收集品沿用九类，其中“收藏品”标签改为“文物藏品”；物资分为弹药类与医疗物品。${codex} 件收集品计入图鉴。\n\n世界观依据仍为 [设定档案 v0.1](<../world setting/TidalLine_世界观设定档案_v0.1.docx>) 第 1、4、5、7 节；高层分类与物资拆分依据本轮用户要求。装备维持独立功能系统，不混入此处 ${items.length} 件物品。\n\n## 当前层级\n\n${summaries}\n\n## 分类边界\n\n- 收集品中的“医疗物资”目前为注射器、X 光片；物资中的“医疗物品”为18件恢复、止痛、损伤、针剂及异常处理用品，当前5件开放恢复HP。\n- 收集品中的“军事物资”暂空；弹药改为物资 / 弹药类。保留通用弹药 ID，后续再按枪械和口径细分，本轮不新增弹种。\n- 弹药和绷带不计收集图鉴。旧存档中的绷带图鉴记录保留，当前进度按有效收集品计算；仓库、堆叠、治疗、装填和补给流程保留。\n- 神秘学仍按制作传统和仪式用途判断，不为填满空类而虚构新物品。普通钟表与文物藏品按原定位区分；贵重钢笔沿用原贵重器具定位。\n- 旧 ID 的 antiq、art、lux、spec 前缀保留；绷带 med01 迁为 heal01，收集品 med02/med03 保留，不再用于推断当前分类。分类不改既有图标、价格、重量和描述；稀有度已独立按六级制重评，见 [稀有度说明](RARITY.md)。\n\n## 世界观判断原则\n\n${review.principles.map(p=>'- '+p).join('\n')}\n\n## 逐件归类\n\n| ID | 物品 | 大类 | 子分类 | 理由 |\n| --- | --- | --- | --- | --- |\n${review.items.map(r=>`| ${r.id} | ${r.name} | ${groups[r.group].name} | ${cats[r.category].name} | ${esc(r.reason)} |`).join('\n')}\n\n## 接入范围\n\n物品详情显示完整路径，仓库分别筛选收集品和物资；Wiki按两层分组。医疗柜及诊所偏好同时涵盖医用收集品和治疗物资，绷带继续参与随机掉落，弹药仍保持noLoot。地图、容器数量和掉落数量不变。旧绷带库存无损迁移；生命值和医疗携带配置持久化，详见 [医疗系统](MEDICAL.md)。\n\n[逐件审查与原始字段](classification.json) · [浏览 Wiki](../../wiki.html#items)\n`;
 fs.writeFileSync(path.join(dir,'CLASSIFICATION.md'),md);
 console.log(`已生成分类说明：${nCollect} 收集品 / ${nSupply} 物资 / ${codex} 图鉴`);
}
module.exports={build};if(require.main===module)build();
