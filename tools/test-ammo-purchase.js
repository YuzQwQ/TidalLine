const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),h=fs.readFileSync(path.join(root,'run-test.js'),'utf8').split('let pass = 0')[0],c=new Function('require','__dirname',h+'\nreturn ctx;')(require,root);
const {Base,Save,Game}=c,{AMMO_ITEMS,STASH_SLOTS}=vm.runInContext('({AMMO_ITEMS,STASH_SLOTS})',c);Game.init();Base.render=()=>{};
const offered=AMMO_ITEMS.filter(it=>it.level<=Base.SHOP_AMMO_MAX_LV);assert.equal(offered.length,18);
/* 购买价 = 原价 ×3（buyPrice）；回收价另算，不受影响。 */
const unit=it=>Math.round(it.price*3);
for(const it of offered){const max=it.stack*6;Save.stash=[];Save.credits=1000000;
 for(const n of [0,-1,1.5,NaN,Infinity,max+1]){const before=JSON.stringify([Save.credits,Save.stash]);assert(!Base.buyAmmo(it.id,n));assert.equal(JSON.stringify([Save.credits,Save.stash]),before);}
 for(const n of [1,it.stack,max]){Save.stash=[];Save.credits=1000000;assert(Base.buyAmmo(it.id,n));assert.equal(Save.credits,1000000-unit(it)*n);assert.equal(Save.stashCount(it.id),n);assert(Save.stash.every(e=>e.n<=it.stack));}
 assert.equal(Save.stash.length,6);Save.save();Save.flush();Save.load();assert.equal(Save.stashCount(it.id),max);assert.equal(Save.credits,1000000-unit(it)*max);
 Save.credits=unit(it)*2-1;const snapshot=JSON.stringify([Save.credits,Save.stash]);assert(!Base.buyAmmo(it.id,2));assert.equal(JSON.stringify([Save.credits,Save.stash]),snapshot);
}
console.log('OK: all 18 offered ammo types: per-round price (×3 buy), 1 round / 1 stack / 6 stacks, invalid limits, insufficient funds and saved totals');
Save.credits=1000000;Save.stash=Array.from({length:STASH_SLOTS-1},()=>({id:'life01',n:1}));Save.stash.push({id:'ammo_12g_1',n:19});assert(Base.buyAmmo('ammo_12g_1',1));const before=JSON.stringify([Save.credits,Save.stash]);assert(!Base.buyAmmo('ammo_12g_1',1));assert.equal(JSON.stringify([Save.credits,Save.stash]),before);
for(const id of ['ammo_12g_4','life01','missing'])assert(!Base.buyAmmo(id,1));
console.log('OK: partial-stack capacity is usable; full warehouse and unavailable ammunition reject without spending');
