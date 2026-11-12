const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),spec=require('../design/items/economy.json');
const harness=fs.readFileSync(path.join(root,'run-test.js'),'utf8').split('let pass = 0')[0];
const c=new Function('require','__dirname',harness+'\nreturn ctx;')(require,root);
const {Game,Save,Base,ITEMS,GEAR,EQUIP,WEAPONS,WEAPON_ALIASES}=c;
const {Medical,formatMoney}=vm.runInContext('({Medical,formatMoney})',c);Game.init();
const medical=[2000,5000,12000,35000,95000,2500,6000,18000,3000,20000,40000,195000,25000,65000,180000,7000,55000,150000];
/* 三份设计表覆盖非弹药、非钥匙的物品；另外 30 种弹药与 8 把钥匙单独管 */
assert.equal(ITEMS.length,spec.items.length+ITEMS.filter(i=>i.cat==='ammo'||i.cat==='key').length);
for(const item of ITEMS){
 if(item.cat==='ammo')continue;   // 弹药价格在 AMMO_TABLE 里单独定，不跟着 economy.json 走
 if(item.cat==='medical')continue; // 医疗品的字段快照由 test-medical.js 校，这里只管价
 if(item.cat==='key')continue;      // 钥匙价格由 design/items/keys.json 单独写入
 const row=spec.items.find(i=>i.id===item.id);assert(row);assert.equal(item.price,row.price);
 const {price,...rest}=JSON.parse(JSON.stringify(item));assert.deepEqual(rest,row.nonPrice,item.id+'价格之外字段变化');
 if(row.group==='collectible'){const band=spec.collectionBands.find(b=>b.rarity===item.r);assert(price>=band.min&&(band.max===null||price<=band.max));}
}
medical.forEach((price,n)=>assert.equal(ITEMS.find(i=>i.id==='heal'+String(n+1).padStart(2,'0')).price,price));
assert.equal(ITEMS.find(i=>i.id==='odd02').price,6000000);
for(const [type,prices]of [['helmet',[2000,6000,15000,48000,120000,350000]],['body',[3000,9000,28000,85000,220000,650000]]]){
 for(let lv=1;lv<=6;lv++){
  const g=GEAR.def(type,lv),old=spec.baseline[type==='helmet'?'helmets':'bodies'][lv-1];assert.equal(g.price,prices[lv-1]);
  // Repairability was introduced after the economy snapshot; validate it separately.
  /* V1 新增材质、改了耐久/瞄准惩罚/耐修，这些字段单独校验；
     名称/等级/重量等静态字段仍与价格基线一致。 */
  const {price,rep,material,dur,aimPenaltyPct,...a}=JSON.parse(JSON.stringify(g));
  const {price:_old,rep:_oldRep,dur:_oldDur,aimPenaltyPct:_oldAim,...b}=old;
  assert(Number.isFinite(rep)&&rep>=0&&rep<=100);
  assert(c.CFG.MATERIALS[material],'材质必须已在 CFG.MATERIALS 登记');
  assert(dur>0&&Number.isFinite(aimPenaltyPct));
  delete b.dr;assert.deepEqual(a,b,'静态字段不随价格变化');
 }
}
/* 武器价格与各字段的权威校验在 test-arsenal（对着 design/weapons 规格表逐把核）。
   这里只确认旧 id 别名（存档里可能还写着 rifle/smg）仍解析到对应真实枪型，不会断档。 */
for(const [id,rarity]of [['pistol',2],['shotgun',3],['smg',3],['rifle',5]]){
 const g=EQUIP.gun(id,7);
 assert(g,'旧 id '+id+' 应仍能造出枪实例');
 const realId=String(g.id).replace(/^g_/,'');
 assert.notEqual(realId,id,'旧 id '+id+' 应已解析成真实枪型');
 assert.equal(g.r,rarity);
 assert.equal(WEAPONS[id].id,realId);
 assert.equal(WEAPONS[id].price,WEAPONS[realId].price);
}
assert.equal(c.START_CREDITS,60000);assert.equal(ITEMS.find(i=>i.id==='ammo_556_1').price,60);assert.equal(ITEMS.find(i=>i.id==='ammo_9mm_1').price,35);assert.equal(ITEMS.find(i=>i.id==='heal01').price,2000);
assert.equal(formatMoney(3000000),'¥3,000,000');
for(const [hp,price]of [[100,0],[80,3000],[50,7500],[1,12500]])assert.equal(Medical.quote(hp).total,price);
for(let missing=1;missing<=100;missing++)assert(Medical.quote(100-missing).total>Math.ceil(missing/20)*2000);
// 模拟旧版模板价格快照；余额不换算，装备恢复当前价格，耐久余弹保留。
const armor=JSON.parse(JSON.stringify(EQUIP.armor(GEAR.make('helmet',4,17))));armor.price=600;armor.sell=78;armor.equip.gear.price=600;
const gun=JSON.parse(JSON.stringify(EQUIP.gun('smg',7)));gun.price=420;gun.sell=210;gun.r=3;
c.localStorage.setItem(Save.key,JSON.stringify({v:3,credits:12345,hp:43,runs:6,stash:[{id:'g_helmet4',n:1,gear:armor},{id:'g_smg',n:1,gear:gun},{id:'life01',n:2}],gear:{weapons:['rifle','shotgun','pistol'],helmet:{lv:4,dur:13},body:{lv:5,dur:77}},loadout:{ammo:60,bandage:3,stone:3}}));
Save.load();assert.equal(Save.credits,12345);assert.equal(Save.hp,43);assert.equal(Save.runs,6);
let h=Save.stash.find(e=>e.id==='g_helmet4').gear;
/* 旧存档里的 g_smg 会按别名迁移成真实枪型（g_pp19_01），不是丢掉 —— 按枪类找，不认死 id */
const wEntry=Save.stash.find(e=>e.gear&&e.gear.equip&&e.gear.equip.kind==='gun');
assert(wEntry,'旧存档里的 g_smg 应迁移保留下来');
let w=wEntry.gear;
assert.equal(h.price,48000);assert.equal(h.equip.gear.price,48000);assert.equal(h.equip.gear.dur,17);assert.equal(h.sell,Math.floor(48000*.5*17/65));
assert.equal(w.price,WEAPONS[w.equip.gun].price);assert.equal(w.sell,Math.floor(w.price/2));assert.equal(w.equip.mag,7);assert.equal(w.r,3);
assert.equal(Save.gear.helmet.price,48000);assert.equal(Save.gear.helmet.dur,13);assert.equal(Save.gear.body.price,220000);assert.equal(Save.gear.body.dur,77);
Save.save();Save.flush();Save.load();assert.equal(Save.credits,12345);assert.equal(Save.stashCount('life01'),2);
assert.equal(Save.stash.find(e=>e.gear&&e.gear.equip&&e.gear.equip.kind==='gun').gear.equip.mag,7);
Base.open();Save.credits=100000;Save.stash=[];Save.bag=[];Save.addBag('ammo_556_1',30);Save.addBag('ammo_9mm_1',20);Save.addBag('ammo_12g_1',10);Save.addBag('heal01',3);
assert.equal(Save.bagWeight()>0,true);assert.equal(Save.bag.length>=4,true);
Save.credits=100000;Base.buyArmor('helmet',2);assert.equal(Save.credits,82000);assert.equal(Save.stash[0].gear.price,6000);
const armorEntry=Save.stash[0],Sales=vm.runInContext('Sales',c);assert.equal(Sales.quote('shop',armorEntry).unit,3000);
// The old warehouse sell entry now redirects to merchants, without granting cash.
Base.sell(armorEntry,1);assert.equal(Save.credits,82000);assert(Save.stash.includes(armorEntry));
Base.buyMedical('heal01');assert.equal(Save.credits,80000);assert.equal(Save.stashCount('heal01'),1);
console.log('OK: 收集品价格带 / 医疗价 / 防具与枪械别名 / 属性与稀有度不变 / 医生报价 / 新档6万 / 背包负重 / 旧余额保留 / 旧装备按新价估值且耐久余弹保留 / 实际购买与商人出售报价');
