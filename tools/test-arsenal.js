/* Exercise actual controller, inventory and migration, without browser timing noise. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),h=fs.readFileSync(path.join(root,'run-test.js'),'utf8').split('let pass = 0')[0];
const c=new Function('require','__dirname',h+'\nreturn ctx;')(require,root),{Game,Save,Player,WEAPONS,U,CFG,Base}=c;
const {EQUIP,Gunplay,CALIBERS,AMMO_ITEMS,AMMO_BY_ID,BACKPACK,Loot,CONTAINER_TYPES,Medical,MELEE,MAP_CATALOG}=vm.runInContext('({EQUIP,Gunplay,CALIBERS,AMMO_ITEMS,AMMO_BY_ID,BACKPACK,Loot,CONTAINER_TYPES,Medical,MELEE,MAP_CATALOG})',c);
const spec=require('../design/weapons/arsenal-v1/arsenal.json');
Game.init();let count=0;const reports=[];
function test(name,fn){try{fn();count++;console.log('OK: '+name);}catch(e){console.error('FAIL: '+name+'\n'+e.stack);process.exitCode=1;}}
function fresh(id='m4a1',n=WEAPONS[id].mag){
 Save.hp=100;Save.bag=[];Save.gear.melee=EQUIP.melee('melee01');Save.gear.back=BACKPACK.make('bag05');Save.gear.weapons=[EQUIP.gun(id,n),null,EQUIP.gun('glock17',17)];
 Game.startRun(null);Game.enemies=[];Game.bullets=[];Game.bagOpen=false;Game.lootOpen=null;Game.action=null;Game.input.mouseDown=false;Game.input.mousePressed=false;Game.input.keys={};
 const p=Game.player;p.bag.slots=[];p.fireCd=0;p.dodgeT=0;p.meleeActive=false;p.aimRemaining=0;p.updateAimPoint(p.x+200,p.y);return p;
}
const input={mx:0,my:0,sneak:false,sprint:false,dodge:false,aimAngle:0};
function tick(p,dt=1/60,held=false,pressed=false){p.update(dt,input);Gunplay.trigger(p,held,pressed);}
function advance(p,t,held=false,fps=60){for(let n=0;n<Math.round(t*fps);n++)tick(p,1/fps,held,false);}
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('25 models / 16 rifles / seven calibers / 32 actual ammo grades',()=>{
 assert.equal(Object.keys(WEAPONS).length,25);assert.equal(Object.keys(CALIBERS).length,7);assert.equal(AMMO_ITEMS.length,32);
 for(const cat of ['rifle','smg','shotgun','pistol'])assert.equal(Object.values(WEAPONS).filter(w=>w.category===cat).length,cat==='rifle'?16:3);
 for(const s of spec.weapons){const w=WEAPONS[s.id];assert.equal(w.rpm,s.rpm);assert.equal(w.mag,s.mag);assert.equal(w.reloadTime,s.reloadTime);assert.equal(w.price,s.price);assert.equal(w.dmgMin,CALIBERS[w.caliber].damage[0]);assert.equal(w.dmgMax,CALIBERS[w.caliber].damage[1]);assert.equal(w.slot,w.category==='pistol'?'secondary':'primary');assert.equal(EQUIP.gun(w.id).stack,1);}
});
test('semi/pump require a fresh press; automatic only repeats in auto mode',()=>{
 for(const id of ['mp155','saiga12','glock17','m1911a1','beretta92','rem870']){const p=fresh(id);Gunplay.trigger(p,true,true);advance(p,2,true);assert.equal(p.mag,WEAPONS[id].mag-1,id);Gunplay.trigger(p,false,false);Gunplay.trigger(p,true,true);assert.equal(p.mag,WEAPONS[id].mag-2,id);}
 const p=fresh();assert(Gunplay.setMode(p,'semi'));Gunplay.trigger(p,true,true);advance(p,1,true);assert.equal(p.mag,29);assert(Gunplay.setMode(p,'auto'));advance(p,.6,true);assert(p.mag<25);
});
test('three-round burst respects cadence, stops at available rounds, never consumes cancelled shots',()=>{
 for(const fps of [30,60,144]){const p=fresh('famas_f1');Gunplay.setMode(p,'burst3');Gunplay.trigger(p,true,true);advance(p,.5,true,fps);assert.equal(p.mag,22);assert.equal(p._burstPending,0);Gunplay.trigger(p,false,false);Gunplay.trigger(p,true,true);advance(p,.3,true,fps);assert.equal(p.mag,19);}
 let p=fresh('famas_f1',2);Gunplay.setMode(p,'burst3');Gunplay.trigger(p,true,true);advance(p,.3,false);assert.equal(p.mag,0);
 for(const why of ['bag','loot','death','switch','dodge','reload','melee']){
  p=fresh('famas_f1');p.bag.addAmmo('ammo_556_1',30);Gunplay.setMode(p,'burst3');Gunplay.trigger(p,true,true);
  if(why==='bag')Game.bagOpen=true;if(why==='loot')Game.lootOpen={};if(why==='death')p.dead=true;if(why==='switch')p.switchWeapon(2);if(why==='dodge')p.update(.01,{...input,dodge:true});if(why==='reload')p.tryReload();if(why==='melee')p.switchMelee();
  advance(p,.3,false);assert.equal(p.weapons[0].magCur,24,why);assert.equal(p._burstPending,0,why);
 }
});
test('30/60/144 FPS automatic cadence matches RPM within one round; low FPS never catches up in one tick',()=>{
 for(const fps of [30,60,144])for(const id of ['m4a1','akm','famas_f1','pp19_01','mp5a3','ump45']){
  const p=fresh(id);p.weapons[0].mag=100;p.mag=p.weapon.magCur=100;Gunplay.trigger(p,true,true);advance(p,1,true,fps);const shots=100-p.mag,want=1+WEAPONS[id].rpm/60;assert(Math.abs(shots-want)<=1.05,`${id}@${fps}: ${shots}/${want}`);reports.push({id,fps,shots,seconds:1});
 }
 let p=fresh('famas_f1');Gunplay.trigger(p,true,true);for(let n=0;n<4;n++){const m=p.mag;tick(p,.3,true,false);assert.equal(m-p.mag,1);}
});
test('pump cycle is independent and persists through switching, snapshot, save and re-equip',()=>{
 let p=fresh('rem870');Gunplay.trigger(p,true,true);assert.equal(Gunplay.state(p),'cycling');advance(p,.4);const n=p.mag;Gunplay.trigger(p,true,true);assert.equal(p.mag,n);
 p.switchWeapon(2);advance(p,1);p.switchWeapon(0);p.fireCd=0;Gunplay.trigger(p,true,true);assert.equal(p.mag,n);assert(p.weapon.cycleRemaining>0);
 Game.syncGear();Save.save();Save.flush();Save.load();const eq=Save.gear.weapons[0];assert(eq.equip.cycleRemaining>0);p.fillWeapons(Save.gear.weapons);advance(p,.5);p.fireCd=0;assert(p.tryShoot());assert.equal(p.mag,n-1);
});
test('all magazine reload times and both per-shell commits are exact and conserve ammunition',()=>{
 for(const w of Object.values(WEAPONS)){
  const p=fresh(w.id,0);p.bag.addAmmo(w.ammo,50);assert(p.tryReload());advance(p,w.reloadTime-.01,false,100);assert.equal(p.mag,0,w.id);tick(p,.011);assert.equal(p.mag,w.reloadType==='tube'?1:w.mag,w.id);assert.equal(p.mag+p.bag.ammoCount(w.ammo),50,w.id);
  if(w.reloadType==='tube'){advance(p,w.reloadTime+.01,false,100);assert.equal(p.mag,2,w.id);p.switchWeapon(2);advance(p,1);assert.equal(p.weapons[0].magCur,2);assert.equal(p.bag.ammoCount(w.ammo),48);}
 }
});
test('tube firing request commits current shell then fires once; interruption keeps prior shells only',()=>{
 let p=fresh('mp155',0);p.bag.addAmmo('ammo_12g_1',10);p.tryReload();advance(p,.7);assert.equal(p.mag,1);Gunplay.trigger(p,true,true);advance(p,.7);assert.equal(p.reloadPending,false);assert.equal(p.mag,1);assert.equal(p.bag.ammoCount('ammo_12g_1'),8);assert.equal(Game.bullets.length,6);
 p=fresh('mp155',0);p.bag.addAmmo('ammo_12g_1',10);p.tryReload();advance(p,.7);p.dead=true;advance(p,1);assert.equal(p.mag,1);assert.equal(p.bag.ammoCount('ammo_12g_1'),9);
});
test('mixed grades and priority work for all six calibers; unloading is exact and repeat-safe',()=>{
 for(const id of ['m4a1','akm','aks74u','mp5a3','ump45','saiga12']){
  const p=fresh(id,0),cal=p.weapon.caliber,a='ammo_'+cal+'_3',b='ammo_'+cal+'_1';p.weapon.ammo=a;p.bag.addAmmo(a,2);p.bag.addAmmo(b,3);p.tryReload();advance(p,p.weapon.reloadTime+.1);assert.equal(p.weapon.rounds.join(','),[a,a,b,b,b].join(','));assert.equal(p.bag.ammoCountByCaliber(cal),0);assert(p.unloadWeapon());assert.equal(p.bag.ammoCount(a),2);assert.equal(p.bag.ammoCount(b),3);assert(p.unloadWeapon());assert.equal(p.bag.ammoCountByCaliber(cal),5);
 }
});
test('old IDs, mixed ammo and excess shotgun shell migrate idempotently without grants or balance changes',()=>{
 const raw={credits:12345,hp:57,meleeGiftClaimed:true,gear:{weapons:[{equip:{kind:'gun',gun:'shotgun',mag:6,ammo:'ammo_12g_1',rounds:['ammo_12g_5',...Array(5).fill('ammo_12g_1')]}},'smg','pistol']},stash:[{id:'gun_rifle',n:1,gear:{equip:{kind:'gun',gun:'rifle',mag:8,ammo:'ammo_556_4'}}}],bag:[]};
 c.localStorage.setItem(Save.key,JSON.stringify(raw));Save.load();assert.equal(Save.credits,12345);assert.equal(Save.hp,57);assert.deepEqual(Array.from(Save.gear.weapons,e=>e.equip.gun),['mp155','pp19_01','glock17']);assert.deepEqual(Array.from(Save.gear.weapons,e=>e.equip.mag),[5,25,12]);assert.equal(Save.stashCount('ammo_12g_1'),1);assert.equal(Save.gear.weapons[0].equip.rounds[0],'ammo_12g_5');assert.equal(Save.stash.find(e=>e.gear).gear.equip.gun,'m4a1');Save.save();Save.flush();const saved=JSON.stringify(Save.stash);Save.load();Save.save();Save.flush();Save.load();assert.equal(JSON.stringify(Save.stash),saved);
});
test('firing mode persists through warehouse and raid; all shop prices and class-slot restrictions remain valid',()=>{
 let p=fresh();Gunplay.setMode(p,'semi');Game.syncGear();Save.save();Save.flush();Save.load();assert.equal(Save.gear.weapons[0].equip.fireMode,'semi');p.fillWeapons(Save.gear.weapons);assert.equal(p.weapon.fireMode,'semi');
 Save.stash=[];Save.credits=1e7;for(const w of Object.values(WEAPONS)){const cash=Save.credits;if(w.shopAvailable===false){assert.equal(Base.buyGun(w.id),false);assert.equal(Save.credits,cash);continue;}assert(Base.buyGun(w.id));const item=Save.stash.at(-1).gear;assert.equal(cash-Save.credits,Math.round(w.price*3));assert.equal(item.equip.mag,w.mag);assert.equal(item.sell,Math.floor(w.price/2));assert.equal(Base.equipFromStash(Save.stash.at(-1),w.slot==='secondary'?'w0':'w2'),false);}
});
test('loot only uses existing special pools, with all new calibers and exact tier/color semantics',()=>{
 assert.equal(CONTAINER_TYPES.Q.ammoPool.chance,.25);assert.equal(CONTAINER_TYPES.K.gearPool.chance,.1);assert(!CONTAINER_TYPES.Z.ammoPool);assert(!CONTAINER_TYPES.Z.gearPool);
 const seen=new Set(),cal=new Set();for(let i=0;i<5000;i++){const r=Loot.rollGear('fine',{kinds:['gun']});if(r.item.equip?.kind==='gun'){seen.add(r.item.equip.gun);assert.equal(r.n,1);assert.equal(r.item.equip.mag,0);}const a=Loot.rollAmmo('fine',CONTAINER_TYPES.Q.ammoPool);cal.add(a.item.caliber);assert(a.item.r<=5);}
 assert.equal(seen.size,25);assert.equal(cal.size,7);
});
test('local recoil axes remain independent; V alone never changes direction, damage or random spread',()=>{
 const p=fresh(),rand=U.rand;U.rand=(a,b)=>(a+b)/2;
 try{p.spread=0;p.rV=0;p.rH=0;p.updateAimPoint(p.x,p.y+200);const a=p.shootAngle;p.rV=40;p.updateAimPoint(p.x,p.y+200);near(p.shootAngle,a);near(p.aimPoint.x,p.x);assert(p.aimPoint.y>p.y+200);p.rH=12;p.updateAimPoint(p.x,p.y+200);assert(p.aimPoint.x<p.x);p.rH=0;p.fireCd=0;p.tryShoot();const b=Game.bullets.at(-1);near(Math.atan2(b.vy,b.vx),a);near(b.dmg,c.BALLISTICS.flesh(p.weapon.caliber,1).B);}
 finally{U.rand=rand;}
});
test('each model applies its family impulse and independent V/H multipliers exactly',()=>{
 const random=c.Math.random;c.Math.random=()=>.75;
 try{for(const w of Object.values(WEAPONS)){const p=fresh(w.id);p.rV=p.rH=0;p.fireCd=0;assert(p.tryShoot());near(p.rV,CFG.RECOIL.axis.v.kick*w.recoilVMul);near(p.rH,(CFG.RECOIL.axis.h.kick*w.recoilHMul+.5*CFG.RECOIL.axis.h.rand)*(CFG.RECOIL.axis.h.bias<0?-1:1));}}
 finally{c.Math.random=random;}
});
test('shotgun center error is sampled once independently from six pellet offsets',()=>{
 const p=fresh('saiga12'),rand=U.rand,angles=[];p.spread=.09;p.rV=p.rH=0;p.updateAimPoint(p.x+200,p.y);U.rand=(a,b)=>{if(a===-p.spread&&b===p.spread){angles.push('center');return .06;}if(a===-p.weapon.pelletSpread){angles.push('pellet');return .02;}return(a+b)/2;};
 try{p.tryShoot();assert.equal(angles.filter(s=>s==='center').length,1);assert.equal(angles.filter(s=>s==='pellet').length,6);for(const b of Game.bullets)near(Math.atan2(b.vy,b.vx),.08);}finally{U.rand=rand;}
});
test('real Game input still attacks with melee and cancels medical use before shooting',()=>{
 let p=fresh();p.switchMelee();Game.input.mouseDown=true;Game.input.mousePressed=true;Game.update(.01);assert(p.meleeAttack,'left click must dispatch melee');
 p=fresh();p.hp=50;p.bag.add(vm.runInContext('ITEM_BY_ID.heal01',c),1);assert(Medical.use(p.bag.slots[0],'bag'));Game.input.mouseDown=true;Game.input.mousePressed=true;Game.update(.01);assert(!Game.action);assert.equal(p.mag,29);
});
const baseline=require('../design/weapons/arsenal-v1/baseline.json');
test('formal maps match the current authored map snapshots',()=>{require('./check-elena-map-snapshots.js').check();});
fs.writeFileSync(path.join(root,'design/weapons/arsenal-v1/verification.json'),JSON.stringify({groupsPassed:count,failed:!!process.exitCode,cadence:reports},null,2)+'\n');
console.log(`Passed ${count} arsenal integration groups`);
