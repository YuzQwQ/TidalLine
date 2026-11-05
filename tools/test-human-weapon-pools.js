const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),h=fs.readFileSync(path.join(root,'run-test.js'),'utf8').split('let pass = 0')[0],c=new Function('require','__dirname',h+'\nreturn ctx;')(require,root);
const {Game,Enemy,WEAPONS,M,Corpse,Save,EQUIP:E}=c,{HumanAI:H,HUMAN_UNIT_DEFS:D,MAP_CATALOG,ENEMY_LOADOUT,Gunplay,Noise}=vm.runInContext('({HumanAI,HUMAN_UNIT_DEFS,MAP_CATALOG,ENEMY_LOADOUT,Gunplay,Noise})',c);
const folder=path.join(root,'design/enemies/weapon-pools-v1'),baseline=require('../design/enemies/weapon-pools-v1/baseline.json'),plain=x=>JSON.parse(JSON.stringify(x)),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
let passed=0;const failures=[],samples={};function test(name,fn){try{fn();passed++;console.log('OK: '+name);}catch(e){failures.push({name,error:e.stack});process.exitCode=1;console.error('FAIL: '+name+'\n'+e.stack);}}
Game.init();Game.startRun(null);M.load(Array(40).fill('.'.repeat(50)),null,[],null);M.tideEnabled=false;Game.state='playing';Game.player.x=700;Game.player.y=500;Game.player.hp=10000;Game.enemies=[];Game.bullets=[];
function fixedWeapon(key,id,fn){const old=D[key].weapons;D[key].weapons=[[id,100]];try{return fn();}finally{D[key].weapons=old;}}
test('exact approved per-weapon weights; 13 scav / 3 shotgun / 9 retriever models, covering all 23 guns',()=>{
 const expected={scav:[['m16a1',17.5],['galil_arm',17.5],['glock17',18],['aks74u',12],['g36c',10],['pp19_01',5],['mp155',4],['rem870',3],['m1911a1',3],['beretta92',3],['fn_fnc',3],['sig550',2],['ak12',2]],holdout:[['rem870',50],['mp155',40],['saiga12',10]],retriever:[['akm',25],['an94',15],['mk47_mod2',13],['mp5a3',12],['ump45',10],['m4a1',10],['famas_f1',6],['aug_a1',5],['groza1',4]]};
 const all=new Set();for(const [key,rows]of Object.entries(expected)){assert.deepEqual(plain(D[key].weapons),rows);assert.equal(rows.reduce((n,r)=>n+r[1],0),100);assert.equal(new Set(rows.map(r=>r[0])).size,rows.length);for(const [id,w]of rows){assert(WEAPONS[id]);assert(w>0);all.add(id);if(key==='scav')assert(WEAPONS[id].rarity<=3);if(key==='holdout')assert.equal(WEAPONS[id].category,'shotgun');if(key==='retriever')assert([4,5].includes(WEAPONS[id].rarity));}}
 assert.equal(all.size,23);for(const [key,want]of [['scav',{1:35,2:40,3:25}],['retriever',{4:75,5:25}]]){const got={};for(const [id,p]of D[key].weapons)got[WEAPONS[id].rarity]=(got[WEAPONS[id].rarity]||0)+p;assert.deepEqual(got,want);}
});
test('weighted draw intervals select every model, including rare gold entries and endpoints',()=>{
 const random=c.Math.random;try{for(const d of Object.values(D)){let before=0;for(const [id,weight]of d.weapons){c.Math.random=()=>(before+weight/2)/100;assert.equal(H.rollWeapon(d),id);before+=weight;}c.Math.random=()=>0;assert.equal(H.rollWeapon(d),d.weapons[0][0]);c.Math.random=()=>.999999999;assert.equal(H.rollWeapon(d),d.weapons.at(-1)[0]);}}finally{c.Math.random=random;}
});
test('6000 actual spawns per profile follow the weights and bind caliber, ammo tier and magazine to held weapon',()=>{
 const random=c.Math.random;let seed=73983;c.Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 try{for(const key of Object.keys(D)){const counts={};for(let i=0;i<6000;i++){const e=new Enemy(key,500,500,0,{id:'pool-'+i});counts[e.weaponId]=(counts[e.weaponId]||0)+1;const w=WEAPONS[e.weaponId];assert.equal(e.ai.mag,w.mag);assert.equal(e.ammoId,'ammo_'+w.caliber+'_'+e.gearLv);assert.equal(e.squadId,'');assert(D[key].levels.some(r=>r[0]===e.gearLv));}for(const [id,weight]of D[key].weapons){const p=weight/100,tolerance=5*Math.sqrt(p*(1-p)/6000)+.003;assert(Math.abs((counts[id]||0)/6000-p)<tolerance,key+'/'+id);}samples[key]=counts;}}finally{c.Math.random=random;}
});
test('same draws for grouped and ungrouped retrievers; squad does not change weapon probabilities',()=>{
 const random=c.Math.random;try{for(let i=0;i<100;i++){c.Math.random=()=>(i+.5)/100;const a=new Enemy('retriever',500,500,0,{}),b=new Enemy('retriever',500,500,0,{squadId:'test-existing'});assert.equal(a.weaponId,b.weaponId);assert.equal(a.squadId,'');assert.equal(b.squadId,'test-existing');}}finally{c.Math.random=random;}
});
test('all pool weapons fire, conserve one cartridge, reload at real capacity and persist exact corpse state',()=>{
 const input={mx:0,my:0,sneak:false,sprint:false,dodge:false,aimAngle:0};
 for(const key of Object.keys(D))for(const [id]of D[key].weapons)fixedWeapon(key,id,()=>{
  Game.bullets=[];const e=new Enemy(key,500,500,0,{facing:'e'}),w=WEAPONS[id];assert.equal(e.weaponId,id);assert(H.shot(e,0));assert.equal(Game.bullets.length,w.pellets);assert.equal(e.ai.mag,w.mag-1);const group=H.groupSize(e);assert(w.modes.includes('auto')?(group>=2&&group<=3):group===1);
  const corpse=new Corpse(e.x,e.y,e),entry=corpse.loot.find(x=>x.gun),gun=Game.corpseGun(entry);assert.equal(gun.equip.gun,id);assert.equal(gun.equip.mag,e.ai.mag);assert.equal(gun.equip.ammo,e.ammoId);assert.equal(gun.stack,1);Save.stash=[];Save.addGearStash(gun);Save.save();Save.flush();Save.load();assert.equal(Save.stash[0].gear.equip.gun,id);assert.equal(Save.stash[0].gear.equip.mag,e.ai.mag);
  e.ai.mag=0;e.ai.reserve=2;e.ai.phase=null;H.startReload(e);H.advancePhase(e,w.reloadTime+.001,null);assert.equal(e.ai.mag,w.reloadType==='tube'?1:2);assert.equal(e.ai.mag+e.ai.reserve,2);
 });
});
test('equipment pools plus approved scav accuracy tuning; HP, timing, armor/ammo policy, weapon physics and every map/squad remain identical',()=>{
 for(const key of Object.keys(D)){const now=plain(D[key]),old=plain(baseline.profiles[key]);delete now.weapons;delete old.weaponPool;delete old.weapon;if(key==='scav'){assert.equal(now.aimError,.14);assert.equal(now.aimErrorMinPx,14);delete now.aimError;delete now.aimErrorMinPx;delete old.aimError;}assert.deepEqual(now,old,key);}
 assert.deepEqual(plain(ENEMY_LOADOUT),baseline.armorAmmo);assert.equal(hash(JSON.stringify(MAP_CATALOG)),baseline.mapHash);
 for(const [f,h]of Object.entries(baseline.files))assert.equal(hash(fs.readFileSync(path.join(root,f))),h,f+' changed');
 assert.deepEqual(plain(MAP_CATALOG.map(m=>({id:m.id,enemies:m.enemies}))),baseline.spawns);
});
fs.writeFileSync(path.join(folder,'verification.json'),JSON.stringify({passed,failures,spawnsPerProfile:6000,samples},null,2)+'\n');console.log(`Weapon pools: ${passed} groups passed, ${failures.length} failed`);
