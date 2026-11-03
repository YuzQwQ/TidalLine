const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),h=fs.readFileSync(path.join(root,'run-test.js'),'utf8').split('let pass = 0')[0];
const c=new Function('require','__dirname',h+'\nreturn ctx;')(require,root);
const {Save,Game,Base}=c,{AMMO_ITEMS,BACKPACK,Bag,ITEM_BY_ID,BASE_BAG_SLOTS,STASH_SLOTS}=vm.runInContext('({AMMO_ITEMS,BACKPACK,Bag,ITEM_BY_ID,BASE_BAG_SLOTS,STASH_SLOTS})',c);
Game.init();Save.gear.back=BACKPACK.make('bag05');
const limits={'12g':20,'556':60,'9mm':90,'762x39':60,'45acp':90};
for(const item of AMMO_ITEMS){
  assert.equal(item.stack,limits[item.caliber]);
  const bag=new Bag();assert(bag.add(item,item.stack+1));
  assert.deepEqual(Array.from(bag.slots,s=>s.n),[item.stack,1]);
}
console.log('OK: all 25 ammo definitions and runtime stacks use caliber-specific caps');
Save.stash=[];Save.bag=Object.keys(limits).map(caliber=>({id:'ammo_'+caliber+'_1',n:120}));
Save.normalizeBag();assert.equal(Save.bag.length,14);
for(const [caliber,limit] of Object.entries(limits)){
  const entries=Save.bag.filter(e=>e.id==='ammo_'+caliber+'_1');assert(entries.every(e=>e.n<=limit));assert.equal(entries.reduce((n,e)=>n+e.n,0),120);
}
console.log('OK: old 120-round stacks split into 2 rifle / 2 pistol / 6 shotgun slots');
Save.gear.back=null;Save.normalizeBag();assert(Save.bag.length<=BASE_BAG_SLOTS);
function totals(){return Object.keys(limits).map(caliber=>Save.bag.concat(Save.stash).filter(e=>e.id==='ammo_'+caliber+'_1').reduce((n,e)=>n+e.n,0));}
assert.deepEqual(totals(),[120,120,120,120,120]);Save.normalizeBag();assert.deepEqual(totals(),[120,120,120,120,120]);
Save.save();Save.flush();Save.load();assert.deepEqual(totals(),[120,120,120,120,120]);
console.log('OK: overflow returns to warehouse without loss; repeated migration and save/load preserve counts');
for(const item of AMMO_ITEMS){
  Save.stash=[{id:item.id,n:120}];Save.normalizeStash();
  assert.equal(Save.stashCount(item.id),120);assert(Save.stash.every(e=>e.n<=item.stack));
  const count=Save.stash.length;Save.normalizeStash();assert.equal(Save.stash.length,count);
  Save.addStash(item.id,item.stack+1);assert.equal(Save.stashCount(item.id),121+item.stack);assert(Save.stash.every(e=>e.n<=item.stack));
}
console.log('OK: warehouse migration and new deposits obey all 25 limits and retain exact totals');
Save.stash=[];Save.addStash('ammo_12g_1',100);Save.credits=100000;
Base.sell(Save.stash[0],20);assert.equal(Save.stashCount('ammo_12g_1'),80);assert.equal(Save.stash.length,4);
assert(Save.takeFull('ammo_12g_1',35));assert.equal(Save.stashCount('ammo_12g_1'),45);
console.log('OK: selling one stack and withdrawing across stacks only remove the requested count');
Save.stash=Array.from({length:STASH_SLOTS-1},()=>({id:'life01',n:1}));Save.stash.push({id:'ammo_12g_1',n:19});
Save.credits=100000;assert(Base.buyAmmo('ammo_12g_1',1));assert.equal(Save.stash.length,STASH_SLOTS);assert.equal(Save.stashCount('ammo_12g_1'),20);
let credits=Save.credits;assert.equal(Base.buyAmmo('ammo_12g_1',1),false);assert.equal(Save.credits,credits);
Save.bag=[{id:'ammo_12g_1',n:20}];assert.equal(Base.toStash(Save.bag[0]),false);assert.equal(Save.bag[0].n,20);
Save.stash.pop();credits=Save.credits;assert.equal(Base.buyAmmo('ammo_12g_1',30),false);assert.equal(Save.credits,credits);
console.log('OK: full warehouse can fill a partial stack; insufficient slots reject purchase/transfer without loss');
Save.stash=Array.from({length:STASH_SLOTS-1},()=>({id:'life01',n:1}));Save.stash.push({id:'ammo_12g_1',n:120});
Save.normalizeStash();assert.equal(Save.stash.length,STASH_SLOTS+5);Save.save();Save.flush();Save.load();assert.equal(Save.stashCount('ammo_12g_1'),120);assert.equal(Save.stash.length,STASH_SLOTS+5);
console.log('OK: legacy warehouse overflow is saved intact instead of truncating migrated ammunition');
