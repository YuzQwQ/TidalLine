const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),h=fs.readFileSync(path.join(root,'run-test.js'),'utf8').split('let pass = 0')[0];
const c=new Function('require','__dirname',h+'\nreturn ctx;')(require,root),{Game,Save,Base,WEAPONS,CFG,Player,U}=c;
const {Attachments:A,ATTACHMENT_DEFS:D,ATTACHMENT_SLOTS:S,EQUIP,BACKPACK,ITEM_BY_ID,Bag,STASH_SLOTS,Loot,CONTAINER_TYPES,MAP_CATALOG,Gunplay}=vm.runInContext('({Attachments,ATTACHMENT_DEFS,ATTACHMENT_SLOTS,EQUIP,BACKPACK,ITEM_BY_ID,Bag,STASH_SLOTS,Loot,CONTAINER_TYPES,MAP_CATALOG,Gunplay})',c);
Game.init();let count=0;const failures=[];function test(name,fn){try{fn();count++;console.log('OK: '+name);}catch(e){failures.push({name,error:e.stack});console.error('FAIL: '+name+'\n'+e.stack);process.exitCode=1;}}
const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`),json=x=>JSON.stringify(x);
function base(id='m4a1',parts={},mag=0){Game.state='base';Game.action=null;Save.stash=[];Save.bag=[];Save.credits=1e7;Save.hp=100;Save.gear={weapons:[EQUIP.gun(id,mag,null,null,{attachments:parts}),null,null],back:BACKPACK.make('bag05'),helmet:null,body:null,melee:EQUIP.melee('melee01')};Save.meleeGiftClaimed=true;return A.targets()[0];}
function add(id){Save.addGearStash(EQUIP.attachment(id));return Save.stash.at(-1);}
function raid(id='m4a1',parts={},mag=0){base(id,parts,mag);Game.startRun(null);Game.enemies=[];Game.bullets=[];Game.bagOpen=false;Game.action=null;Game.lootOpen=null;const p=Game.player;p.bag.slots=[];p.bag.safe=[];p.fireCd=0;p.shotAnimT=0;p.meleeActive=false;p.aimRemaining=0;p.updateAimPoint(p.x+200,p.y);return p;}
function part(p,id){p.bag.add(EQUIP.attachment(id),1);return p.bag.slots.at(-1);}
const state=()=>json({stash:Save.stash,bag:Save.bag,gear:Save.gear,p:Game.player&&{weapons:Game.player.weapons,mag:Game.player.mag,bag:Game.player.bag,cd:Game.player.fireCd,rH:Game.player.rH,rV:Game.player.rV}});
const still={mx:0,my:0,sneak:false,sprint:false,dodge:false,aimAngle:0};
test('32 definitions, 24 public offers, fixed prices/weights and full 12×32 compatibility matrix',()=>{
 assert.equal(Object.keys(D).length,32);assert.equal(Object.values(D).filter(d=>d.r<=3).length,24);assert.equal(Object.values(D).filter(d=>d.r===4).length,8);assert.equal(D.att_optic04.price,30000);
 for(const w of Object.values(WEAPONS))for(const a of Object.values(D)){
  const pistol=w.category==='pistol',tube=w.reloadType==='tube';let yes;
  if(a.subtype==='optic')yes=!pistol||['att_optic01','att_optic02'].includes(a.id);
  if(a.subtype==='grip')yes=!pistol&&!tube;
  if(a.subtype==='stock')yes=!pistol&&w.id!=='famas_f1';
  if(a.subtype==='muzzle')yes=(w.category==='shotgun')===['att_muzzle05','att_muzzle06'].includes(a.id);
  if(a.subtype==='magazine')yes=!tube&&a.id.startsWith('att_mag_'+w.caliber+'_');
  assert.equal(A.compatible(w.id,a.id),yes,w.id+'/'+a.id);
  const item=EQUIP.attachment(a.id);assert.equal(item.stack,1);assert.equal(item.equip.kind,'attachment');assert(item.noCodex);assert.equal(item.sell,a.price/2);
 }
 assert.equal(A.slotState('famas_f1',{},'stock'),'disabled');assert.equal(A.slotState('m4a1',{},'stock'),'empty');assert.equal(A.slotState('m4a1',{stock:'att_stock01'},'stock'),'installed');
});
test('bare guns remain identical and 32 individual modifiers apply exactly once',()=>{
 const baseline=require('../design/weapons/attachments-v1/baseline.json');
 for(const w of Object.values(WEAPONS)){const x=A.resolve(w.id,{});for(const k of ['aimTime','spreadBase','spreadMax','recoilPerShot','recoilHMul','recoilVMul','reloadTime','pelletSpread','mag','w','price','rpm','dmgMin','dmgMax'])near(x[k],baseline.weapons[w.id][k]);}
 for(const a of Object.values(D)){const w=Object.values(WEAPONS).find(w=>A.compatible(w.id,a.id)),x=A.resolve(w.id,{[a.subtype]:a.id}),m=a.statModifiers;
  near(x.aimTime,w.aimTime*(1+(m.aimTime||0)));near(x.spreadBase,w.spreadBase*(1+(m.baseSpread||0)));near(x.spreadMax,w.spreadMax);near(x.recoilHMul,w.recoilHMul*(1+(m.recoilHorizontal||0)));near(x.recoilVMul,w.recoilVMul*(1+(m.recoilVertical||0)));near(x.reloadTime,w.reloadTime*(1+(m.reloadTime||0)));near(x.w,w.w+a.w);near(x.price,w.price+a.price);assert.equal(x.rarity,w.rarity);assert.equal(x.dmgMin,w.dmgMin);assert.equal(x.dmgMax,w.dmgMax);assert.equal(x.rpm,w.rpm);assert.equal(json(A.resolve(w.id,x.attachments)),json(x));
 }
});
test('additive positive/negative effects and independent safety floors',()=>{
 let x=A.resolve('m4a1',{grip:'att_grip01',muzzle:'att_muzzle01',optic:'att_optic01',stock:'att_stock01'});near(x.recoilVMul,WEAPONS.m4a1.recoilVMul*.55);near(x.aimTime,WEAPONS.m4a1.aimTime*.93);
 const old=D.att_optic01.statModifiers;D.att_optic01.statModifiers={aimTime:-2,baseSpread:-2,spreadGrowth:-2,recoilHorizontal:-2,recoilVertical:-2,reloadTime:-2,pelletSpread:-2};
 try{x=A.resolve('mp155',{optic:'att_optic01'});near(x.aimTime,WEAPONS.mp155.aimTime*.6);near(x.spreadBase,WEAPONS.mp155.spreadBase*.5);near(x.recoilPerShot,WEAPONS.mp155.recoilPerShot*.5);near(x.recoilVMul,WEAPONS.mp155.recoilVMul*.5);near(x.recoilHMul,WEAPONS.mp155.recoilHMul*.5);near(x.reloadTime,WEAPONS.mp155.reloadTime*.6);near(x.pelletSpread,WEAPONS.mp155.pelletSpread*.5);}finally{D.att_optic01.statModifiers=old;}
});
test('all ten expanded capacities and cross-model same-caliber magazines',()=>{
 const want={m4a1:39,akm:39,famas_f1:32,pp19_01:39,mp5a3:39,ump45:32,saiga12:10,glock17:22,m1911a1:9,beretta92:19};
 for(const [id,n]of Object.entries(want))for(const type of ['ext','quick_ext']){const w=A.resolve(id,{magazine:'att_mag_'+WEAPONS[id].caliber+'_'+type});assert.equal(w.mag,n);const eq=EQUIP.gun(id,n,w.ammo,null,{attachments:w.attachments});assert.equal(eq.equip.mag,n);assert.equal(eq.equip.rounds.length,n);}
 for(const id of ['mp155','rem870'])assert.equal(A.resolve(id,{magazine:'att_mag_12g_ext'}).mag,WEAPONS[id].mag);
});
test('warehouse installation, preview purity, same-model independence and stale/repeated rejection',()=>{
 let t=base();Save.gear.weapons[1]=EQUIP.gun('m4a1',0);const src=add('att_optic01'),before=state(),p=A.preview(t,'optic','att_optic01',src);assert(p.ok);assert.equal(state(),before);const r=A.commit(t,'optic','att_optic01',src);assert(r.ok);assert.equal(Save.stash.length,0);assert.equal(Save.gear.weapons[0].equip.attachments.optic,'att_optic01');assert.deepEqual(Object.keys(Save.gear.weapons[1].equip.attachments),[]);const saved=state();assert.equal(A.commit(t,'optic','att_optic01',src).ok,false);assert.equal(state(),saved);assert.equal(A.commit(r.target,'optic','att_optic01').ok,false);
});
test('full warehouse one-for-one replacement succeeds; detach and multi-grade overflow fail atomically',()=>{
 let t=base('m4a1',{optic:'att_optic01'});add('att_optic02');while(Save.stash.length<STASH_SLOTS)Save.stash.push({id:'life01',n:1});let r=A.commit(t,'optic','att_optic02',Save.stash[0]);assert(r.ok);assert.equal(Save.stash.length,STASH_SLOTS);assert(Save.stash.some(e=>e.gear?.equip.attachment==='att_optic01'));const s=state();assert.equal(A.commit(r.target,'optic',null).ok,false);assert.equal(state(),s);
 t=base('m4a1',{magazine:'att_mag_556_ext'},39);Save.gear.weapons[0].equip.rounds=[...Array(30).fill('ammo_556_1'),...Array(4).fill('ammo_556_3'),...Array(5).fill('ammo_556_5')];while(Save.stash.length<STASH_SLOTS-1)Save.stash.push({id:'life01',n:1});const b=state();assert.equal(A.commit(t,'magazine',null).ok,false);assert.equal(state(),b);
});
test('shrinking preserves first-round order and returns exact typed surplus; expansion never creates ammo',()=>{
 const t=base('m4a1',{magazine:'att_mag_556_ext'},39),eq=Save.gear.weapons[0].equip;eq.rounds=[...Array(15).fill('ammo_556_1'),...Array(19).fill('ammo_556_3'),...Array(5).fill('ammo_556_5')];const r=A.commit(t,'magazine',null);assert(r.ok);assert.equal(r.gun.equip.mag,30);assert.equal(r.gun.equip.rounds.join(','),eq.rounds.slice(0,30).join(','));assert.equal(Save.stashCount('ammo_556_3'),4);assert.equal(Save.stashCount('ammo_556_5'),5);const src=Save.stash.find(e=>e.gear);const rr=A.commit(r.target,'magazine','att_mag_556_ext',src);assert(rr.ok);assert.equal(rr.gun.equip.mag,30);assert.equal(Save.stashCount('ammo_556_3')+Save.stashCount('ammo_556_5'),9);
});
test('stash gun and base carried gun modify by exact instance and include equipped weight',()=>{
 base();Save.addGearStash(EQUIP.gun('m4a1',3));const src=add('att_optic01');let t=A.targets().find(t=>t.owner==='stash');let r=A.commit(t,'optic','att_optic01',src);assert(r.ok);assert.equal(Save.gear.weapons[0].equip.attachments.optic,undefined);assert.equal(r.gun.equip.mag,3);
 Save.addGearBag(EQUIP.gun('akm',9));const part=add('att_grip02');t=A.targets().find(t=>t.owner==='base-bag');r=A.commit(t,'grip','att_grip02',part);assert(r.ok);assert.equal(Save.bag[0].gear.equip.attachments.grip,'att_grip02');
 t=base();Save.gear.body={w:CFG.BAG.CARRY-WEAPONS.m4a1.w-Save.gear.back.w-Save.gear.melee.w};add('att_optic01');const before=state();assert.equal(A.commit(t,'optic','att_optic01').ok,false);assert.equal(state(),before);
});
test('raid transactions preserve cooldown/recoil, apply armor aiming, and reject action conflicts',()=>{
 let p=raid('m4a1',{},10),src=part(p,'att_optic01'),t=A.targets()[0];p.fireCd=.37;p.rH=8;p.rV=12;p.body=c.GEAR.make('body','body4');const r=A.commit(t,'optic','att_optic01',src);assert(r.ok);near(p.fireCd,.37);near(p.rH,8);near(p.rV,12);near(p.aimTime,WEAPONS.m4a1.aimTime*.88*(1+p.body.aimPenaltyPct/100));assert.equal(p.mag,10);assert(p.aimRemaining>0);
 const scenarios=[['reloadPending',true],['reloadT',1],['shotAnimT',.1],['windupShot',true],['_burstPending',2],['dodgeT',.1]];
 for(const [key,v]of scenarios){p=raid();src=part(p,'att_optic01');p[key]=v;t=A.targets()[0];const b=state();assert.equal(A.commit(t,'optic','att_optic01',src).ok,false,key);assert.equal(state(),b,key);}
 for(const type of ['heal','search','corpse','extract']){p=raid();part(p,'att_optic01');Game.action={type};assert.equal(A.commit(A.targets()[0],'optic','att_optic01').ok,false,type);}
 p=raid('rem870');part(p,'att_optic01');p.weapon.cycleRemaining=.4;assert.equal(A.commit(A.targets()[0],'optic','att_optic01').ok,false);
});
test('raid full-bag replace, detach, carried gun and safe-box exclusion',()=>{
 let p=raid('m4a1',{optic:'att_optic01'}),src=part(p,'att_optic02');while(p.bag.slots.length<c.bagSlots())p.bag.slots.push({item:ITEM_BY_ID.life01,n:1});let r=A.commit(A.targets()[0],'optic','att_optic02',src);assert(r.ok);assert.equal(p.bag.slots.length,c.bagSlots());let b=state();assert.equal(A.commit(r.target,'optic',null).ok,false);assert.equal(state(),b);
 p=raid();p.bag.safe.push({item:EQUIP.gun('m4a1',0),n:1},{item:EQUIP.attachment('att_optic01'),n:1});assert.equal(A.targets().length,1);assert.equal(A.commit(A.targets()[0],'optic','att_optic01',p.bag.safe[1]).ok,false);
 p.bag.slots.push({item:EQUIP.gun('glock17',4),n:1});src=part(p,'att_optic01');r=A.commit(A.targets().find(t=>t.owner==='raid-bag'),'optic','att_optic01',src);assert(r.ok);assert.equal(p.bag.slots.find(s=>s.item.equip?.kind==='gun').item.equip.attachments.optic,'att_optic01');
});
test('mixed expanded magazine survives equip, switches, reload, snapshot and warehouse unload',()=>{
 let p=raid('m4a1',{magazine:'att_mag_556_quick_ext'},39);p.weapon.rounds=[...Array(30).fill('ammo_556_1'),...Array(9).fill('ammo_556_5')];Game.syncGear();Save.save();Save.flush();Save.load();assert.equal(Save.gear.weapons[0].equip.mag,39);assert.equal(Save.gear.weapons[0].equip.rounds[38],'ammo_556_5');p.fillWeapons(Save.gear.weapons);assert.equal(p.weapon.mag,39);assert.equal(p.mag,39);p.bag.slots=[];assert(p.unloadWeapon());assert.equal(p.bag.ammoCount('ammo_556_5'),9);assert(p.tryReload());near(p.reloadT,WEAPONS.m4a1.reloadTime*.85);p.reloadT=0;p.finishReloadIfDone();assert.equal(p.mag,39);
 const gun=Gunplay.snapshot(p.weapon);Game.state='base';Save.bag=[];assert(Base.unloadGun(gun));assert.equal(Save.bag.reduce((n,e)=>n+e.n,0),39);assert.equal(gun.equip.mag,0);
});
test('migration salvages known incompatible parts and surplus; unknown IDs retained idempotently',()=>{
 const raw={credits:123456,hp:42,stash:[{gear:{equip:{kind:'attachment',attachment:'future_part'}},n:1}],bag:[],gear:{weapons:[{equip:{kind:'gun',gun:'rifle',mag:39,ammo:'ammo_556_3',attachments:{magazine:'att_mag_12g_ext',grip:'removed_part'}}},null,null]}};
 c.localStorage.setItem(Save.key,json(raw));Save.load();assert.equal(Save.credits,123456);assert.equal(Save.hp,42);assert.equal(Save.gear.weapons[0].equip.mag,30);assert.equal(Save.stashCount('ammo_556_3'),9);assert.equal(Save.stash.filter(e=>e.gear?.equip.attachment==='att_mag_12g_ext').length,1);assert.equal(Save.attachmentRecovery.length,2);Save.save();Save.flush();const s=json([Save.stash,Save.gear,Save.attachmentRecovery]);Save.load();assert.equal(json([Save.stash,Save.gear,Save.attachmentRecovery]),s);
});
test('30/60/144FPS dual-axis recovery changes alone; scalar spread decay unchanged',()=>{
 for(const fps of [30,60,144]){const p=raid('m4a1',{stock:'att_stock03'});p.rH=p.rV=20;p.recoil=.7;p.sinceShot=10;const old=.7;const n=Math.round(fps*.1),t=n/fps;for(let i=0;i<n;i++)p.update(1/fps,still);near(p.rH,20*Math.exp(-CFG.RECOIL.axis.h.decay*1.25*t));near(p.rV,20*Math.exp(-CFG.RECOIL.axis.v.decay*1.25*t));near(p.recoil,Math.max(0,old-CFG.RECOIL.decay*t));}
});
test('choke changes six pellet offsets but leaves center spread and damage unchanged',()=>{
 const w=A.resolve('saiga12',{muzzle:'att_muzzle05'});near(w.pelletSpread,WEAPONS.saiga12.pelletSpread*.8);near(w.spreadBase,WEAPONS.saiga12.spreadBase);assert.equal(w.pellets,6);assert.equal(w.dmgMin,WEAPONS.saiga12.dmgMin);
 const p=raid('saiga12',{muzzle:'att_muzzle06'},8);near(p.weapon.pelletSpread,WEAPONS.saiga12.pelletSpread*1.25);assert(p.tryShoot());assert.equal(Game.bullets.length,6);assert.equal(p.mag,7);
});
test('existing ammo/gear chances, attachment rarity fallback and fixed draw counts',()=>{
 const rand=c.Math.random;
 try{for(const [v,expected]of [[.1,'ammo'],[.3,'gear'],[.36,'attachment'],[.8,'item']]){c.Math.random=()=>v;assert.equal(Loot.pickPool(CONTAINER_TYPES.Q),expected);}c.Math.random=()=>0;assert(!Loot.rollAttachment('junk',[]).item.equip);}
 finally{c.Math.random=rand;}
 const seen=new Set();for(let i=0;i<3000;i++){const r=Loot.rollAttachment('fine',[]);if(r.item.equip?.kind==='attachment')seen.add(r.item.equip.attachment);}assert.equal(seen.size,32);
 for(const type of Object.values(CONTAINER_TYPES)){for(let i=0;i<5;i++){const out=Loot.fill(type.q,type.cats,type),bounds=type.rolls||vm.runInContext('CONTAINER_QUALITY',c)[type.q].count;assert(out.length>=bounds[0]&&out.length<=bounds[1]);}}
});
test('loose attachment pickup/drop/safe transfer and attached gun death follow existing ownership rules',()=>{
 const p=raid('m4a1',{optic:'att_optic01'},3),item=EQUIP.attachment('att_grip02'),box={items:[{item,n:1,known:true}],kind:'plain'};Game.openLoot(box);assert(Game.takeGear(box.items[0],0));assert.equal(p.bag.slots[0].item.equip.attachment,'att_grip02');Game.moveToSafe(0);assert.equal(p.bag.safe[0].item.equip.attachment,'att_grip02');const lost=Game.applyEquipmentLoss();assert.equal(lost[0].equip.attachments.optic,'att_optic01');assert.equal(p.bag.safe.length,1);assert.equal(Save.gear.weapons[0],null);
});
test('installed parts follow warehouse/bag transfers, resale and raid equip without copying',()=>{
 base();const gun=EQUIP.gun('m4a1',39,null,null,{attachments:{magazine:'att_mag_556_ext',optic:'att_optic01'}});Save.addGearStash(gun);const start=Save.credits;
 assert.equal(gun.sell,WEAPONS.m4a1.price/2+(D.att_mag_556_ext.price+D.att_optic01.price)/2);
 assert(Base.toBag(Save.stash[0]));assert.equal(Save.stash.length,0);assert.equal(Save.bag[0].gear.equip.mag,39);assert.equal(Save.bag[0].gear.equip.attachments.optic,'att_optic01');
 assert(Base.toStash(Save.bag[0]));assert.equal(Save.bag.length,0);assert.equal(Save.stash[0].gear.equip.mag,39);Base.sell(Save.stash[0],1);assert.equal(Save.credits,start+gun.sell);assert.equal(Save.stash.length,0);
 const p=raid();p.bag.slots.push({item:gun,n:1});Game.equipFromBag(0);assert(p.weapons.some(w=>w?.attachments.magazine==='att_mag_556_ext'));assert.equal(p.bag.slots.filter(e=>e.item.equip?.attachments?.optic==='att_optic01').length,0);
});
test('movement, death and held pump prevent stale or conflicting modification without loss',()=>{
 let t=base();Save.addGearStash(EQUIP.gun('glock17',0));t=A.targets().find(x=>x.owner==='stash');add('att_optic01');Save.stash.unshift({id:'life01',n:1});let before=state();assert(!A.commit(t,'optic','att_optic01').ok);assert.equal(state(),before);
 let p=raid();part(p,'att_optic01');t=A.targets()[0];p.dead=true;before=state();assert(!A.commit(t,'optic','att_optic01').ok);assert.equal(state(),before);
 p=raid('rem870');p.weapons[0].cycleRemaining=.2;p.bag.slots.push({item:EQUIP.gun('m4a1',0),n:1});part(p,'att_optic01');t=A.targets().find(x=>x.owner==='raid-bag');before=state();assert(!A.commit(t,'optic','att_optic01').ok);assert.equal(state(),before);
});
test('formal map snapshots and armor penetration matrix remain unchanged',()=>{const b=require('../design/weapons/attachments-v1/baseline.json');assert.equal(json(CFG.AMMO.MATRIX),json(b.matrix));for(const m of MAP_CATALOG)assert.equal(crypto.createHash('sha256').update(json(m)).digest('hex'),b.maps.find(x=>x.id===m.id).sha256);});
fs.writeFileSync(path.join(root,'design/weapons/attachments-v1/verification.json'),JSON.stringify({passed:count,failures,compatibilityPairs:12*32},null,2)+'\n');console.log(`Attachment groups passed ${count}, failed ${failures.length}`);
