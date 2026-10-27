const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),spec=require('../design/items/economy.json');
const harness=fs.readFileSync(path.join(root,'run-test.js'),'utf8').split('let pass = 0')[0];
const c=new Function('require','__dirname',harness+'\nreturn ctx;')(require,root);
const {Game,Save,Base,ITEMS,GEAR,EQUIP,WEAPONS,SUPPLY}=c;
const {Medical,formatMoney}=vm.runInContext('({Medical,formatMoney})',c);Game.init();
const medical=[2000,5000,12000,35000,95000,2500,6000,18000,3000,6000,40000,110000,25000,65000,180000,7000,55000,150000];
assert.equal(ITEMS.length,77);
for(const item of ITEMS){
 const row=spec.items.find(i=>i.id===item.id);assert(row);assert.equal(item.price,row.price);
 const {price,...rest}=JSON.parse(JSON.stringify(item));assert.deepEqual(rest,row.nonPrice,item.id+'价格之外字段变化');
 if(row.group==='collectible'){const band=spec.collectionBands.find(b=>b.rarity===item.r);assert(price>=band.min&&(band.max===null||price<=band.max));}
}
medical.forEach((price,n)=>assert.equal(ITEMS.find(i=>i.id==='heal'+String(n+1).padStart(2,'0')).price,price));
assert.equal(ITEMS.find(i=>i.id==='odd02').price,3000000);
for(const [type,prices]of [['helmet',[2000,6000,15000,48000,120000,350000]],['body',[3000,9000,28000,85000,220000,650000]]]){
 for(let lv=1;lv<=6;lv++){
  const g=GEAR.def(type,lv),old=spec.baseline[type==='helmet'?'helmets':'bodies'][lv-1];assert.equal(g.price,prices[lv-1]);
  const {price,...a}=JSON.parse(JSON.stringify(g)),{price:_old,...b}=old;assert.deepEqual(a,b,'防护数值不随价格变化');
 }
}
for(const [id,price,rarity]of [['pistol',5000,2],['shotgun',24000,3],['smg',38000,3],['rifle',45000,5]]){
 assert.equal(WEAPONS[id].price,price);assert.equal(EQUIP.gun(id,7).r,rarity);
 const {price:_p,rarity:_r,...a}=JSON.parse(JSON.stringify(WEAPONS[id]));const {price:_op,...b}=spec.baseline.weapons[id];assert.deepEqual(a,b);
}
assert.equal(c.START_CREDITS,60000);assert.equal(SUPPLY.ammo.price,200);assert.equal(SUPPLY.stone.price,500);assert.equal(SUPPLY.bandage.price,2000);
assert.equal(ITEMS.find(i=>i.id==='ammo').price,100);assert.equal(formatMoney(3000000),'¥3,000,000');
for(const [hp,price]of [[100,0],[80,3000],[50,7500],[1,12500]])assert.equal(Medical.quote(hp).total,price);
for(let missing=1;missing<=100;missing++)assert(Medical.quote(100-missing).total>Math.ceil(missing/20)*2000);
// 模拟旧版模板价格快照；余额不换算，装备恢复当前价格，耐久余弹保留。
const armor=JSON.parse(JSON.stringify(EQUIP.armor(GEAR.make('helmet',4,17))));armor.price=600;armor.sell=78;armor.equip.gear.price=600;
const gun=JSON.parse(JSON.stringify(EQUIP.gun('smg',7)));gun.price=420;gun.sell=210;gun.r=3;
c.localStorage.setItem(Save.key,JSON.stringify({v:3,credits:12345,hp:43,runs:6,stash:[{id:'g_helmet4',n:1,gear:armor},{id:'g_smg',n:1,gear:gun},{id:'life01',n:2}],gear:{weapons:['rifle','shotgun','pistol'],helmet:{lv:4,dur:13},body:{lv:5,dur:77}},loadout:{ammo:60,bandage:3,stone:3}}));
Save.load();assert.equal(Save.credits,12345);assert.equal(Save.hp,43);assert.equal(Save.runs,6);
let h=Save.stash.find(e=>e.id==='g_helmet4').gear,w=Save.stash.find(e=>e.id==='g_smg').gear;
assert.equal(h.price,48000);assert.equal(h.equip.gear.price,48000);assert.equal(h.equip.gear.dur,17);assert.equal(h.sell,Math.floor(48000*.5*17/65));
assert.equal(w.price,38000);assert.equal(w.sell,19000);assert.equal(w.equip.mag,7);assert.equal(w.r,3);
assert.equal(Save.gear.helmet.price,48000);assert.equal(Save.gear.helmet.dur,13);assert.equal(Save.gear.body.price,220000);assert.equal(Save.gear.body.dur,77);
Save.save();Save.flush();Save.load();assert.equal(Save.credits,12345);assert.equal(Save.stashCount('life01'),2);assert.equal(Save.stash.find(e=>e.id==='g_smg').gear.equip.mag,7);
Base.open();Save.credits=100000;Save.stash=[];Save.loadout={ammo:60,bandage:3,stone:3,medical:{}};assert.equal(Base.computeCost(),19500);
Save.credits=19999;assert.equal(Base.computeCost(),0);Save.credits=20000;assert.equal(Base.computeCost(),19500);
Save.credits=100000;Base.buyArmor('helmet',2);assert.equal(Save.credits,94000);assert.equal(Save.stash[0].gear.price,6000);
Base.sell(Save.stash[0],1);assert.equal(Save.credits,97000);
Base.buyMedical('heal01');assert.equal(Save.credits,95000);assert.equal(Save.stashCount('heal01'),1);
console.log('OK: 58件收集品价格带 / 18件指定医疗价 / 12件防具与4枪 / 属性与稀有度不变 / 医生报价 / 新档6万与救济2万 / 补给倍率 / 旧余额保留 / 旧装备按新价估值且耐久余弹保留 / 实际买卖');
