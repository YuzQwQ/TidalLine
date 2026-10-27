/* 分类有效性、存档标识及分类之外的字段保持不变。 */
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto'),path=require('path');
const root=path.resolve(__dirname,'..'),c=vm.createContext({console,performance});
for(const f of ['config.js','data.js','core.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',f),'utf8'),c);
const {items,cats,order,map,types,loot,groupOf,groups}=vm.runInContext('({items:ITEMS,cats:CATS,order:COLLECTION_CATS,map:RAID_MAP,types:CONTAINER_TYPES,loot:Loot,groupOf:itemGroup,groups:ITEM_GROUPS})',c);
const review=require('../design/items/classification.json');
const rarityReview=require('../design/items/rarity.json');
const economy=require('../design/items/economy.json');
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,review.worldSetting))).digest('hex'),review.worldSettingSha256,'世界观文件已变更，需要重审');
assert.deepEqual(Array.from(order,k=>cats[k].name),['生活用品','电子产品','工业器材','医疗物资','文物藏品','军事物资','情报资料','神秘学物品','异常遗物']);
assert.equal(new Set(review.items.map(r=>r.id)).size,items.length);assert.equal(items.length,108);
for(const item of items){
 const record=review.items.find(r=>r.id===item.id);assert(record&&record.reason);assert.equal(item.cat,record.category);assert.equal(groupOf(item),record.group);assert(groups[record.group].cats.includes(item.cat));
 const original={...record.original,cat:record.category};
 const grade=rarityReview.items.find(r=>r.id===item.id);if(grade)original.r=grade.rarity;
 original.price=economy.items.find(i=>i.id===item.id).price;
 assert.deepEqual(JSON.parse(JSON.stringify(item)),original,'分类之外的物品字段发生变动 '+item.id);
 // 仍在等贴图的器物，缺图不算错；其它物品必须有图
 const hasIcon=(item.iconId||item.id);
 const pendingArt=new Set(review.items.filter(r=>r.pendingArt).map(r=>r.id));
 assert((item.cat==='medical'&&!item.iconId)||fs.existsSync(path.join(root,'assets/items',hasIcon+'.png'))||pendingArt.has(item.id),'缺贴图 '+item.id);
}
assert.equal(items.filter(i=>!i.noCodex).length,89);assert.equal(items.filter(i=>i.cat==='occult').length,0);
assert.equal(items.filter(i=>groupOf(i)==='collectible').length,89);assert.equal(items.filter(i=>groupOf(i)==='supply').length,19);
for(const id of ['life02','art03'])assert.equal(items.find(i=>i.id===id).cat,'intel');
assert.equal(items.find(i=>i.id==='antiq03').cat,'life');assert.equal(items.find(i=>i.id==='elec01').cat,'elec');
const ammo=items.find(i=>i.id==='ammo');assert.equal(ammo.cat,'ammo');assert(ammo.noCodex&&ammo.noLoot);
const bandage=items.find(i=>i.id==='heal01');assert.equal(bandage.cat,'medical');assert(bandage.use&&bandage.noCodex&&!bandage.noLoot);
assert(types.M.cats.includes('med')&&types.M.cats.includes('medical'));
for(const k of ['antiq','art','lux','spec'])assert(!cats[k],'旧分类不应留在注册表');
for(const box of map.containers)for(const cat of box.preference)assert(cats[cat],'地图掉落偏好失效 '+box.id);
for(const box of Object.values(types))for(const cat of box.cats||[])assert(cats[cat]);
for(const kind of ['junk','plain','ample','fine','rich','secret'])for(let i=0;i<200;i++){const drop=loot.fill(kind,['collect']);assert(drop.length);for(const d of drop){assert(cats[d.item.cat]);assert(!d.item.noLoot);}}
console.log('OK: 文物藏品 / 89收集品与19物资 / 弹药和医疗子类 / 89图鉴 / ID贴图及原值不变 / 绷带治疗掉落语义 / 医疗偏好');
