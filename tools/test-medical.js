/* 真实运行逻辑，复用主流程的浏览器 mock，避免另一套治疗实现。 */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const harness=fs.readFileSync(path.join(root,'run-test.js'),'utf8').split('let pass = 0')[0];
const c=new Function('require','__dirname',harness+'\nreturn ctx;')(require,root);
const {Game,Save,Base,CFG,ITEMS}=c;
const {Medical,Loot,byId}=vm.runInContext('({Medical,Loot,byId:ITEM_BY_ID})',c);
Game.init();
let checks=0;function test(name,fn){fn();checks++;console.log('OK: '+name);}
function raid(hp=5,id='heal01',where='bag'){
 Save.hp=hp;Game.startRun({ammo:0,bandage:0,stone:0});Game.enemies=[];Game.player.vx=Game.player.vy=0;
 Game.input.keys={};Game.input.mouseDown=false;Game.player.reloadT=0;Game.player.reloadPending=false;
 Game.player.hp=hp;const entry={item:byId[id],n:2};Game.player.bag[where==='safe'?'safe':'slots']=[entry];
 return entry;
}
test('77件唯一物品、18医疗品、58图鉴与准确参数',()=>{
 assert.equal(ITEMS.length,77);assert.equal(new Set(ITEMS.map(i=>i.id)).size,77);assert(!byId.med01);
 assert.equal(ITEMS.filter(i=>!i.noCodex).length,58);
 const spec=require('../design/items/medical.json');assert.equal(spec.items.length,18);
 for(const item of spec.items){const actual=byId[item.id];for(const key of ['name','r','w','price','stack','desc','visual'])assert.equal(actual[key],item[key]);assert(actual.noCodex);assert.equal(actual.cat,'medical');assert.equal(!!actual.noLoot,!actual.heal);}
 assert.equal(c.SUPPLY.bandage.itemId,'heal01');assert.equal(c.SUPPLY.bandage.price,2000);
});
test('五种恢复药实际时长、完成时消耗、精确回血与封顶',()=>{
 for(let n=1;n<=5;n++){
  const entry=raid(5,'heal0'+n),item=entry.item;assert(Medical.use(entry,'bag'));
  Game.updateAction(item.useTime-.01);assert.equal(entry.n,2);assert.equal(Game.player.hp,5);
  Game.updateAction(.02);assert.equal(entry.n,1);assert.equal(Game.player.hp,Math.min(100,5+item.heal));assert.equal(Save.hp,Game.player.hp);assert.equal(Game.action,null);
 }
});
test('移动、受伤、开火、换弹、换枪、闪避、投掷、交互、死亡均中断且不消耗',()=>{
 const actions=[()=>{Game.input.keys.w=true;Game.updateAction(.1);},()=>Game.player.hurt(1),()=>Game.player.tryShoot(),()=>Game.player.tryReload(),()=>Game.player.switchWeapon(1),()=>{Game.input.dodgePressed=true;Game.update(.01);},()=>Game.player.throwStone(),()=>Game.handleInteract(),()=>Game.beginDying(),()=>Medical.cancel()];
 for(const interrupt of actions){const entry=raid();assert(Medical.use(entry,'bag'));interrupt();assert(!Game.action||Game.action.type!=='heal');assert.equal(entry.n,2);assert(Game.player.hp<=5);}
});
test('安全箱治疗、关闭背包继续、并行动作和满血禁止',()=>{
 let e=raid(80,'heal01','safe');assert(Medical.use(e,'safe'));Game.bagOpen=true;Game.toggleBag();assert(Game.action);Game.updateAction(2);assert.equal(Game.player.hp,100);assert.equal(e.n,1);assert(!Medical.use(e,'safe'));
 e=raid();Game.action={type:'extract'};assert(!Medical.use(e,'bag'));Game.action=null;Game.lootOpen={};assert(!Medical.use(e,'bag'));Game.lootOpen=null;
});
test('移走治疗源与预留品绝不消耗，所有预留品不进入掉落',()=>{
 let e=raid();assert(Medical.use(e,'bag'));Game.player.bag.slots=[];Game.updateAction(2);assert.equal(e.n,2);assert.equal(Game.player.hp,5);
 for(const item of ITEMS.filter(i=>i.cat==='medical'&&!i.heal)){e=raid(5,item.id);assert(!Medical.use(e,'bag'));assert.equal(e.n,2);}
 for(const kind of ['junk','plain','ample','fine','rich','secret'])for(let n=0;n<3000;n++){const d=Loot.roll(kind,['medical']);assert(!d.item.noLoot);}
});
test('旧med01与heal01数量合并、旧存档满血、迁移幂等及其他物品不变',()=>{
 c.localStorage.setItem(Save.key,JSON.stringify({v:2,credits:888,stash:[{id:'med01',n:2},{id:'heal01',n:3},{id:'med02',n:1}],loadout:{ammo:60,bandage:3,stone:3},gear:{weapons:['rifle','shotgun','pistol']},codex:{med01:{count:2}}}));
 Save.load();assert.equal(Save.hp,100);assert.equal(Save.stashCount('heal01'),5);assert.equal(Save.stashCount('med02'),1);assert.equal(Save.credits,888);assert(Save.codex.med01);
 Save.save();Save.flush();Save.load();assert.equal(Save.stashCount('heal01'),5);assert.equal(Save.loadout.bandage,3);
 Save.setHP(37.5);Save.load();assert.equal(Save.hp,37.5);
});
test('局外立即用药、封顶、满血/预留品禁用、消费持久化',()=>{
 Base.open();Save.hp=85;Save.stash=[{id:'heal01',n:2},{id:'heal06',n:1}];const e=Save.stash[0];
 assert(Medical.use(e,'stash'));assert.equal(Save.hp,100);assert.equal(e.n,1);assert(!Medical.use(e,'stash'));assert(!Medical.use(Save.stash[1],'stash'));Save.load();assert.equal(Save.hp,100);assert.equal(Save.stashCount('heal01'),1);
});
test('诊费示例、全区间贵于绷带、余额不足与重复治疗不扣钱',()=>{
 for(const [d,p]of [[20,3000],[50,7500],[99,12500]])assert.equal(Medical.quote(100-d).total,p);
 for(let d=1;d<=100;d++)assert(Medical.quote(100-d).total>Math.ceil(d/20)*2000);
 assert.equal(Medical.quote(100).total,0);Base.open();Save.hp=1;Save.credits=12499;assert(!Base.treat(12500));assert.equal(Save.credits,12499);
 Save.credits=20000;assert(!Base.treat(3000));assert(Base.treat(12500));assert.equal(Save.hp,100);assert.equal(Save.credits,7500);assert(!Base.treat(12500));assert.equal(Save.credits,7500);
});
test('医生白绿蓝10件、购买单件与金额、高级品拒售',()=>{
 Base.open();Save.credits=1000000;Save.stash=[];const stock=ITEMS.filter(i=>i.cat==='medical'&&i.r<=3);assert.equal(stock.length,10);
 for(const it of stock){const old=Save.credits;assert(Base.buyMedical(it.id));assert.equal(Save.stashCount(it.id),1);assert.equal(Save.credits,old-it.price);}
 const credits=Save.credits;assert(!Base.buyMedical('heal04'));assert.equal(Save.credits,credits);
});
test('寻常清仓保留医疗及弹药',()=>{
 Save.stash=[{id:'heal01',n:2},{id:'heal06',n:1},{id:'ammo',n:20},{id:'life01',n:1}];Base.sellJunk();assert.equal(Save.stashCount('heal01'),2);assert.equal(Save.stashCount('heal06'),1);assert.equal(Save.stashCount('ammo'),20);assert.equal(Save.stashCount('life01'),0);
});
test('携带库存不足、格数不足、超重均无损；成功扣取并带入',()=>{
 Base.open();Save.credits=100000;Save.stash=[{id:'heal02',n:2}];Save.loadout={ammo:60,bandage:3,stone:3,medical:{heal02:3}};
 let snap=JSON.stringify([Save.stash,Save.credits]);Base.deploy();assert.equal(JSON.stringify([Save.stash,Save.credits]),snap);
 Save.loadout.medical.heal02=2;const slots=CFG.BAG.SLOTS;CFG.BAG.SLOTS=1;assert(!Base.previewCarry().ok);Base.deploy();assert.equal(JSON.stringify([Save.stash,Save.credits]),snap);CFG.BAG.SLOTS=slots;
 const carry=CFG.BAG.CARRY;CFG.BAG.CARRY=.1;assert(!Base.previewCarry().ok);Base.deploy();assert.equal(JSON.stringify([Save.stash,Save.credits]),snap);CFG.BAG.CARRY=carry;
 Save.hp=34;Base.deploy();assert.equal(Game.state,'playing');assert.equal(Game.player.hp,34);assert.equal(Save.stashCount('heal02'),0);assert.equal(Game.player.bag.slots.find(e=>e.item.id==='heal02').n,2);
});
test('撤离保留生命值、死亡与超时失败1HP、重新出发继承',()=>{
 raid(43);Game.showEnd(true);assert.equal(Save.hp,43);Game.startRun({ammo:0,bandage:0,stone:0});assert.equal(Game.player.hp,43);
 Game.player.hurt(1000);assert.equal(Save.hp,1);Game.showEnd(false);Save.load();assert.equal(Save.hp,1);
 raid(57);Game.showEnd(false,'行动时间已结束');assert.equal(Save.hp,1);
});
console.log('通过 '+checks+' 组医疗系统检查');
