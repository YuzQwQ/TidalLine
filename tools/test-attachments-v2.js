const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),h=fs.readFileSync(path.join(root,'run-test.js'),'utf8').split('let pass = 0')[0];
const c=new Function('require','__dirname',h+'\nreturn ctx;')(require,root);
const {A,D,F,L,M,W,E,S,Combat,Noise}=vm.runInContext('({A:Attachments,D:ATTACHMENT_DEFS,F:ATTACHMENT_MAGAZINE_FAMILIES,L:ATTACHMENT_LEGACY_MAGAZINES,M:AttachmentMigration,W:WEAPONS,E:EQUIP,S:Save,Combat,Noise})',c);
let checks=0;const ok=(condition,message)=>{assert(condition,message);checks++;},near=(a,b)=>ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
ok(Object.keys(D).length===93,'93 live parts');ok(Object.keys(F).length===17,'17 magazine families');
const expected={stanag:[40,60],ak545:[45,60],ak762:[40,75],famas:[null,null],galil:[50,75],g36:[40,60],sig550:[40,60],aug:[42,60],vityaz:[40,50],mp5:[40,50],ump:[35,50],glock:[null,null],beretta92:[null,null],m1911:[null,null],saiga:[12,20],sr25_pattern:[25,null],rm277:[25,null]};
for(const [name,f]of Object.entries(F)){
 assert.deepEqual([f.extended,f.drum],expected[name]);
 for(const gun of f.weapons)for(const [kind,id]of Object.entries(f.parts)){
  ok(A.compatible(gun,id),'compatible '+gun+'/'+id);
  const after=A.resolve(gun,{magazine:id});
  ok(after.mag===(kind==='extended'?f.extended:kind==='drum'?f.drum:W[gun].mag),'actual capacity '+gun+'/'+kind);
  if(kind==='competition')near(after.reloadTime,W[gun].reloadTime*.82);
  if(kind==='polymer')near(after.aimTime,W[gun].aimTime*.9);
  for(const [other,w]of Object.entries(W))if(!f.weapons.includes(other))ok(!A.compatible(other,id),'reject cross-interface '+other+'/'+id);
 }
}
for(const old of Object.keys(L))ok(!D[old]&&!A.offer(old),'legacy absent '+old);
for(const a of Object.values(D))for(const key of Object.keys(a.statModifiers))ok(!/decay|recovery/i.test(key),'no recovery modifier');
const optic=A.resolve('m4a1',{optic:'att_optic04'});near(optic.spreadMul,W.m4a1.spreadMul);near(optic.adsSpread,.7);near(optic.adsZoom,1.4);near(optic.adsView,2);
const silenced=A.resolve('m4a1',{muzzle:'att_muzzle09'});near(silenced.noiseRadius,.4);
const heavy=A.resolve('m4a1',{muzzle:'att_muzzle10'});near(heavy.noiseRadius,1.15);
for(const d of Object.values(D))if(d.subtype==='magazine')ok(!('magazineCapacity' in d.statModifiers),'fixed or original capacity only');
// Raw migration preserves round order before any normalizer sees the old IDs.
const rounds=[...Array(25).fill('ammo_556_1'),...Array(7).fill('ammo_556_5')];
const raw={v:4,credits:100,hp:42,stash:[{id:'g_att_mag_9mm_quick',n:2}],bag:[],safe:[],gear:{weapons:[{equip:{kind:'gun',gun:'famas_f1',mag:32,ammo:'ammo_556_1',rounds,attachments:{magazine:'att_mag_556_quick_ext'}}},null,null]},mail:[{id:'legacy-mail',items:[{id:'g_att_mag_12g_quick',n:1}],claimed:false}],attachmentRecovery:[{id:'att_mag_545x39_ext',gun:'ak12'}]};
const migrated=M.convert(raw);
ok(migrated.gear.weapons[0].equip.mag===25,'special gun shrinks to original capacity');
ok(JSON.stringify(migrated.gear.weapons[0].equip.rounds)===JSON.stringify(rounds.slice(0,25)),'preserved round order');
ok(migrated.stash.filter(e=>e.id==='ammo_556_5').reduce((n,e)=>n+e.n,0)===7,'all overflow returned');
near(migrated.credits,100+L.att_mag_556_quick_ext.price+2*L.att_mag_9mm_quick.price);
ok(migrated.mail[0].items[0].gear.equip.attachment===F.saiga.parts.competition,'unclaimed mail converted');
ok(migrated.stash.some(e=>e.gear?.equip?.attachment===F.ak545.parts.extended),'recovery record converted');
ok(JSON.stringify(M.convert(migrated))===JSON.stringify(migrated),'raw migration is idempotent');
ok(!M.replacement('att_mag_12g_ext','m4a1'),'wrong caliber is compensated, not force-installed');
const claimed=M.convert({credits:0,mail:[{claimed:true,items:[{id:'g_att_mag_9mm_quick',n:1}]}]});near(claimed.credits,0);
const key='test_attachment_v2',original=JSON.stringify(raw);c.localStorage.setItem(key,original);
M.load(original,key);ok(c.localStorage.getItem(key+'_attachments_v1_backup')===original,'raw backup');
const once=c.localStorage.getItem(key);M.load(once,key);ok(c.localStorage.getItem(key)===once,'no duplicate refunds');
const set=c.localStorage.setItem;c.localStorage.setItem=function(k,v){if(k===key)throw Error('quota');return set.call(this,k,v);};
let failed=false;try{M.load(original,key);}catch(e){failed=e.attachmentMigrationFailed;}
ok(failed&&c.localStorage.getItem(key)===once,'failed atomic write preserves previous save');c.localStorage.setItem=set;
// Real Save.load must retain migrated mail gear, credits, inventory and oversize overflow.
c.localStorage.setItem(S.key,JSON.stringify({...raw,stash:[...Array(250).fill({id:'life01',n:1}),...raw.stash]}));S.load();
ok(S.stash.length>250,'migration keeps overflowing storage');ok(S.mail[0].items[0].gear?.equip.attachment===F.saiga.parts.competition,'mail normalization preserves equipment');
const snapshot=JSON.stringify([S.credits,S.stash,S.gear,S.mail]);S.save();S.flush();S.load();ok(JSON.stringify([S.credits,S.stash,S.gear,S.mail])===snapshot,'reload is idempotent');
// A failed upgrade must stop later autosaves from replacing the untouched old save.
c.localStorage.setItem(S.key,original);c.localStorage.setItem=function(k,v){if(k===S.key)throw Error('quota');return set.call(this,k,v);};
failed=false;try{S.load();}catch(e){failed=e.attachmentMigrationFailed;}
ok(failed&&S._loadBlocked,'real load blocks after migration storage failure');
ok(S.save()===false&&S.flush()===false,'autosave cannot bypass failed upgrade');
ok(c.localStorage.getItem(S.key)===original,'raw save survives failed upgrade and autosave');
c.localStorage.setItem=set;S.load();ok(!S._loadBlocked,'successful retry unblocks saving');
// Actual player and NPC shot paths must route the new acoustic multiplier.
const acoustic=vm.runInContext(`(()=>{
 const emit=Noise.emit,seen=[];Noise.emit=(x,y,radius,type)=>{if(type==='shot')seen.push(radius);};
 try{Game.init();M.load(Array(45).fill('.'.repeat(50)),null,[],null);Game.state='playing';Game.action=null;Game.bagOpen=false;Game.lootOpen=null;
 Game.player=new Player(700,500);const p=Game.player;
 p.fillWeapons([EQUIP.gun('m4a1',30,null,null,{attachments:{muzzle:'att_muzzle09'}})]);p.fireCd=0;p.meleeActive=false;p.updateAimPoint(900,500);p.tryShoot();
 const e=new Enemy('scav',550,500,0,{facing:'e'});e.weaponId='m4a1';e.gun=Attachments.resolve('m4a1',{muzzle:'att_muzzle08'});e.ai.mag=30;e.ai.fireCd=0;HumanAI.shot(e,0);
 return {seen,base:CFG.NOISE.shoot};
 }finally{Noise.emit=emit;}
})()`,c);
near(acoustic.seen[0],acoustic.base*.4);near(acoustic.seen[1],acoustic.base*.8*.55);
console.log('PASS: '+checks+' V2 compatibility, capacity, effects, migration, overflow, backup, idempotency and actual acoustic shot checks');
