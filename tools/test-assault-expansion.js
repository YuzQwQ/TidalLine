/* Actual controller/transactions, deterministic timing and ammunition conservation. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),h=fs.readFileSync(path.join(root,'run-test.js'),'utf8').split('let pass = 0')[0];
const c=new Function('require','__dirname',h+'\nreturn ctx;')(require,root);
const {Game,Save,Player,Base,WEAPONS,CFG,U}=c;
const {Gunplay:G,EQUIP:E,Attachments:A,BACKPACK,CALIBERS,AMMO_ITEMS,BALLISTICS,Loot,CONTAINER_TYPES,ATTACHMENT_DEFS:D,ART}=vm.runInContext('({Gunplay,EQUIP,Attachments,BACKPACK,CALIBERS,AMMO_ITEMS,BALLISTICS,Loot,CONTAINER_TYPES,ATTACHMENT_DEFS,ART})',c);
const spec=require('../design/weapons/assault-expansion-v1/weapons.json'),baseline=require('../design/weapons/assault-expansion-v1/baseline.json');
const ids=spec.weapons.map(w=>w.id),near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`),plain=x=>JSON.parse(JSON.stringify(x));
Game.init();Base.render=()=>{};let passed=0;const failures=[],timing=[];
function test(name,fn){try{fn();passed++;console.log('OK: '+name);}catch(e){failures.push({name,error:e.stack});console.error('FAIL: '+name+'\n'+e.stack);process.exitCode=1;}}
const input={mx:0,my:0,sneak:false,sprint:false,dodge:false,aimAngle:0};
function fresh(id='an94',mag=WEAPONS[id].mag,parts={}){
 Save.hp=100;Save.bag=[];Save.stash=[];Save.gear.melee=E.melee('melee01');Save.gear.back=BACKPACK.make('bag05');
 Save.gear.weapons=[E.gun(id,mag,null,null,{attachments:parts}),null,E.gun('glock17',17)];Game.startRun(null);
 Game.enemies=[];Game.bullets=[];Game.bagOpen=false;Game.lootOpen=null;Game.action=null;Game.input.keys={};Game.input.mouseDown=false;Game.input.mousePressed=false;
 const p=Game.player;p.bag.slots=[];p.bag.safe=[];p.fireCd=0;p.dodgeT=0;p.meleeActive=false;p.aimRemaining=0;p.updateAimPoint(p.x+200,p.y);p.rV=p.rH=p.recoil=0;p.syncSpread();return p;
}
function tick(p,dt,held=false){p.update(dt,input);G.trigger(p,held,false);}
function advance(p,seconds,fps=120,held=false){for(let i=0;i<Math.round(seconds*fps);i++)tick(p,1/fps,held);}
test('14 rifles with rarity counts 2/2/3/3/4, 23 total models; original 12 models unchanged',()=>{
 assert.equal(Object.keys(WEAPONS).length,23);const rifles=Object.values(WEAPONS).filter(w=>w.category==='rifle');assert.equal(rifles.length,14);
 assert.deepEqual([1,2,3,4,5].map(r=>rifles.filter(w=>w.rarity===r).length),[2,2,3,3,4]);
 /* 六参数模型：旧绝对字段改用倍率×全局基准核对（保留 ≤5e-3 的折算误差） */
 for(const [id,w]of Object.entries(baseline.weapons)){const now=WEAPONS[id],d=c.Firearms.derive(now);
  for(const k of Object.keys(w)){if(['spreadBase','spreadMax','recoilPerShot','recoilBaseV','recoilBaseH','recoilVMul','recoilHMul','spreadMul','spreadGrowthMul','aimTimeMul','aimTime'].includes(k))continue;assert.deepEqual(plain(now[k]),w[k],id+'/'+k);}
  const near5=(a,b)=>assert(Math.abs(a-b)<5e-3,`${id} ${a} != ${b}`);
  /* 基础/满散布共用 spreadMul：步枪零漂移，SMG/手枪 ≤16%（既定设计） */
  const rel=(u,v)=>Math.abs(u-v)/v;
  assert(rel(d.spreadBase,w.spreadBase)<0.16,`${id} spreadBase ${d.spreadBase} != ${w.spreadBase}`);
  assert(rel(d.spreadMax,w.spreadMax)<0.16,`${id} spreadMax ${d.spreadMax} != ${w.spreadMax}`);
  near5(d.growth,w.recoilPerShot);near5(now.aimTime,w.aimTime,1e-6);
  near5(d.vKick,w.recoilBaseV*w.recoilVMul);near5(d.hKick,w.recoilBaseH*w.recoilHMul);}
 for(const [id,cal]of Object.entries(baseline.calibers))assert.deepEqual(plain(CALIBERS[id]),cal,id+' original caliber');
 for(const s of spec.weapons){const w=WEAPONS[s.id];for(const k of ['rpm','mag','w','price','rarity','reloadTime','recoilVMul','recoilHMul'])assert.equal(w[k],s[k],s.id+'/'+k);near(w.aimTime,WEAPONS.m4a1.aimTime*(s.aimTimeMul??1));near(c.Firearms.derive(w).spreadBase,CFG.RECOIL.spreadBase*(s.spreadMul??1));assert(ART.gear.includes(s.id));}
});
test('six calibers / 30 tiers; 5.45 shares tier damage/penetration matrix without changing other ammunition',()=>{
 assert.equal(Object.keys(CALIBERS).length,6);assert.equal(AMMO_ITEMS.length,30);assert.equal(D.att_mag_545x39_ext.r,2);assert.equal(D.att_mag_545x39_quick.r,3);assert.equal(D.att_mag_545x39_quick_ext.r,4);
 for(let lv=1;lv<=5;lv++){const a=AMMO_ITEMS.find(a=>a.id==='ammo_545x39_'+lv),old=AMMO_ITEMS.find(a=>a.id==='ammo_556_'+lv);assert(a);assert.equal(a.iconId,'ammo_545x39');assert.equal(a.penLevel,lv);assert.equal(a.dmgMul,old.dmgMul);assert.equal(a.stack,60);assert.equal(a.w,.013);assert.equal(a.price,spec.caliber.prices[lv-1]);for(let armor=1;armor<=5;armor++)near(BALLISTICS.ratio(a.penLevel,armor),BALLISTICS.ratio(old.penLevel,armor));}
});
test('all eight equip, fire semi once while held, fire auto at configured rate, reject empty magazines',()=>{
 for(const id of ids){let p=fresh(id);assert(G.setMode(p,'semi'));assert(G.trigger(p,true,true));advance(p,.5,120,true);assert.equal(p.mag,WEAPONS[id].mag-1,id);G.trigger(p,false,false);G.trigger(p,true,true);assert.equal(p.mag,WEAPONS[id].mag-2,id);
  for(const fps of [30,60,144]){p=fresh(id);assert.equal(p.weapon.fireMode,'auto');G.trigger(p,true,true);advance(p,1,fps,true);const n=WEAPONS[id].mag-p.mag;assert(Math.abs(n-(1+WEAPONS[id].rpm/60))<=1.05,id+'@'+fps);}
  p=fresh(id,0);const before=Game.bullets.length;assert(!G.trigger(p,true,true));advance(p,.5,120,true);assert.equal(p.mag,0);assert.equal(Game.bullets.length,before);assert(!p._deferredBurstRecoil);
 }
});
test('AN-94 second shot occurs at 33.333ms, never early, with one pair per press at 30/60/144FPS',()=>{
 let p=fresh();G.setMode(p,'burst2');G.trigger(p,true,true);assert.equal(p.mag,29);near(p.fireCd,1/30);tick(p,.02);assert.equal(p.mag,29);tick(p,.013);assert.equal(p.mag,29);tick(p,.000334);assert.equal(p.mag,28);assert.equal(p._burstPending,0);assert(!p._deferredBurstRecoil);advance(p,.6,120,true);assert.equal(p.mag,28);G.trigger(p,false,false);G.trigger(p,true,true);advance(p,.1);assert.equal(p.mag,26);
 for(const fps of [30,60,144]){p=fresh();G.setMode(p,'burst2');G.trigger(p,true,true);let t=0;while(p.mag===29&&t<.1){tick(p,1/fps,true);t+=1/fps;}assert(t>=1/30-1e-9&&t<=1/30+1/fps+1e-9);assert.equal(p.mag,28);advance(p,.5,fps,true);assert.equal(p.mag,28);timing.push({fps,secondShotSeconds:t});}
});
test('second bullet precedes first-shot recoil: identical pre-kick angle, combined V/H kick after pair',()=>{
 const random=c.Math.random,rand=U.rand;c.Math.random=()=>.75;U.rand=(a,b)=>(a+b)/2;
 try{const p=fresh();G.setMode(p,'burst2');G.trigger(p,true,true);assert.equal(p.rV,0);assert.equal(p.rH,0);assert.equal(p.recoil,0);assert(p._deferredBurstRecoil);const a=Math.atan2(Game.bullets[0].vy,Game.bullets[0].vx);tick(p,1/30);const b=Math.atan2(Game.bullets[1].vy,Game.bullets[1].vx);near(a,b);near(p.rV,2*CFG.RECOIL.axis.v.kick*p.weapon.recoilVMul);near(p.rH,2*(CFG.RECOIL.axis.h.kick*p.weapon.recoilHMul+.5*CFG.RECOIL.axis.h.rand)*(CFG.RECOIL.axis.h.bias<0?-1:1));near(p.recoil,2*CFG.RECOIL.perShot*p.weapon.spreadGrowthMul);assert(!p._deferredBurstRecoil);
 }finally{c.Math.random=random;U.rand=rand;}
});
test('AN-94 one remaining round applies one kick; zero rounds cannot create a burst',()=>{
 for(const mag of [0,1,2]){const p=fresh('an94',mag);G.setMode(p,'burst2');G.trigger(p,true,true);if(mag===1){assert(p.rV>0);assert(!p._deferredBurstRecoil);}advance(p,.5,120,true);assert.equal(Game.bullets.length,mag);assert.equal(p.mag,0);assert.equal(p.weapon.rounds.length,0);assert(!p._deferredBurstRecoil);assert.equal(p._burstPending||0,0);}
});
test('burst interruptions cancel only unfired shots, settle fired recoil and leave no pending actions',()=>{
 for(const why of ['bag','loot','death','switch','dodge','reload','melee','unload']){const p=fresh();p.bag.addAmmo('ammo_545x39_1',30);G.setMode(p,'burst2');G.trigger(p,true,true);assert.equal(p.mag,29);
  if(why==='bag')Game.bagOpen=true;if(why==='loot')Game.lootOpen={};if(why==='death')p.dead=true;if(why==='switch')p.switchWeapon(2);if(why==='dodge')p.update(.001,{...input,dodge:true});if(why==='reload')p.tryReload();if(why==='melee')p.switchMelee();if(why==='unload')p.unloadWeapon();
  advance(p,.2);assert.equal(Game.bullets.length,1,why);assert.equal(p._burstPending,0,why);assert(!p._deferredBurstRecoil,why);assert.equal(p.weapons[0].magCur,why==='unload'?0:29,why);assert.equal(p.bag.ammoCountByCaliber('545x39')+p.weapons[0].magCur,59,why);
 }
});
test('AN-94 ordinary auto keeps 600RPM and ordinary recoil per shot; busy burst cannot change mode',()=>{
 const p=fresh();assert.equal(p.weapon.fireMode,'auto');G.trigger(p,true,true);assert(p.rV>0);near(p.fireCd,.1);assert(!p._deferredBurstRecoil);advance(p,1,120,true);assert(Math.abs((30-p.mag)-11)<=1);
 const q=fresh();G.setMode(q,'burst2');G.trigger(q,true,true);assert(!G.setMode(q,'auto'));advance(q,.15);assert(G.setMode(q,'auto'));
});
test('all eight reload exact capacity and time, mixed grades preserve order, interruption creates no ammunition',()=>{
 for(const id of ids){const p=fresh(id,0),cal=p.weapon.caliber,a='ammo_'+cal+'_5',b='ammo_'+cal+'_1';p.weapon.ammo=a;p.bag.addAmmo(a,2);p.bag.addAmmo(b,50);assert(p.tryReload());tick(p,p.weapon.reloadTime-.001);assert.equal(p.mag,0,id);tick(p,.002);assert.equal(p.mag,p.weapon.mag,id);assert.deepEqual(Array.from(p.weapon.rounds.slice(0,3)),[a,a,b]);assert.equal(p.mag+p.bag.ammoCountByCaliber(cal),52);assert(p.unloadWeapon());assert.equal(p.bag.ammoCountByCaliber(cal),52);assert(p.unloadWeapon());assert.equal(p.bag.ammoCountByCaliber(cal),52);
  assert(p.tryReload());tick(p,.2);p.switchWeapon(2);advance(p,4);assert.equal(p.weapons[0].magCur,0);assert.equal(p.bag.ammoCountByCaliber(cal),52);
 }
});
test('all five ammunition tiers use shared damage and penetration on AKS-74U and AN-94',()=>{
 const rand=U.rand;U.rand=(a,b)=>(a+b)/2;try{for(const id of ['aks74u','an94'])for(let lv=1;lv<=5;lv++){const ammo='ammo_545x39_'+lv,p=fresh(id,0),tier=AMMO_ITEMS.find(a=>a.id===ammo);p.bag.addAmmo(ammo,1);p.weapon.ammo=ammo;p.tryReload();tick(p,p.weapon.reloadTime+.001);p.fireCd=0;G.trigger(p,true,true);assert.equal(Game.bullets.length,1);near(Game.bullets[0].dmg,tier.B);assert.equal(Game.bullets[0].pen,tier.P);assert.equal(p.bag.ammoCount(ammo),0);}}finally{U.rand=rand;}
});
test('new magazines reject wrong calibers, extend both 5.45 models to 39 and apply reload once',()=>{
 for(const id of ids)for(const type of ['ext','quick','quick_ext']){const part='att_mag_545x39_'+type;assert.equal(A.compatible(id,part),WEAPONS[id].caliber==='545x39');}
 for(const id of ['aks74u','an94'])for(const type of ['ext','quick','quick_ext']){const x=A.resolve(id,{magazine:'att_mag_545x39_'+type});assert.equal(x.mag,type==='quick'?30:39);near(x.reloadTime,WEAPONS[id].reloadTime*(type==='ext'?1:.85));assert.equal(x.rpm,WEAPONS[id].rpm);assert.equal(x.dmgMin,17);}
 for(const id of ['m16a1','galil_arm','aug_a1'])assert.equal(A.slotState(id,{},'stock'),'disabled');
 for(const id of ids){const p=fresh(id,0);Game.state='base';Save.stash=[];Save.addGearStash(E.attachment('att_optic01'));let t=A.targets()[0];assert(A.commit(t,'optic','att_optic01',Save.stash[0]).ok,id+' attach');t=A.targets()[0];assert(A.commit(t,'optic',null).ok,id+' detach');assert.equal(Save.stash.filter(x=>x.gear?.equip.attachment==='att_optic01').length,1);}
});
test('expanded 5.45 mixed magazines survive save/load, warehousing, selling without duplication',()=>{
 for(const id of ids){fresh(id,0);const cal=WEAPONS[id].caliber,part='att_mag_'+cal+'_quick_ext',w=A.resolve(id,{magazine:part}),rounds=Array.from({length:w.mag},(_,i)=>'ammo_'+cal+'_'+(i%5+1));
  Save.gear.weapons[0]=E.gun(id,w.mag,rounds[0],rounds,{attachments:{magazine:part,optic:'att_optic01'},fireMode:id==='an94'?'burst2':'semi'});Save.credits=123456;Save.save();Save.flush();Save.load();const e=Save.gear.weapons[0];assert.equal(e.equip.gun,id);assert.equal(e.equip.mag,w.mag);assert.deepEqual(Array.from(e.equip.rounds),rounds);assert.equal(e.equip.attachments.magazine,part);assert.equal(e.equip.fireMode,id==='an94'?'burst2':'semi');assert.equal(Save.credits,123456);
  Game.state='base';Save.stash=[];Save.bag=[];Save.addGearStash(e);assert(Base.toBag(Save.stash[0]));assert.equal(Save.stash.length,0);assert(Base.toStash(Save.bag[0]));assert.equal(Save.bag.length,0);assert.equal(Save.stash.length,1);const start=Save.credits,sales=vm.runInContext('Sales',c);c.Safehouse={view:'merchant'};c.MerchantUI={key:'gun',mode:'sell'};const quote=sales.preview('gun',[{entry:Save.stash[0],n:1}]);assert(sales.commit(sales.authorize(quote)).ok);delete c.Safehouse;delete c.MerchantUI;assert.equal(Save.stash.length,0);assert.equal(Save.credits-start,e.sell);
 }
});
test('new shop offers respect rarity policy; all new guns and 5.45 grades enter existing loot pools',()=>{
 Game.state='base';Save.credits=1e7;Save.stash=[];for(const id of ids){const cash=Save.credits,n=Save.stash.length,allowed=WEAPONS[id].rarity<=3;assert.equal(Base.buyGun(id),allowed);assert.equal(cash-Save.credits,allowed?Math.round(WEAPONS[id].price*3):0);assert.equal(Save.stash.length-n,allowed?1:0);}
 const random=c.Math.random,pct=vm.runInContext('CONTAINER_QUALITY.fine.pct',c);try{for(const id of ids){const w=WEAPONS[id],group=Object.values(WEAPONS).filter(x=>x.rarity===w.rarity),index=group.findIndex(x=>x.id===id);const roll=(pct.slice(0,w.rarity-1).reduce((a,b)=>a+b,0)+pct[w.rarity-1]/2)/pct.reduce((a,b)=>a+b,0),draws=[roll,0,(index+.5)/group.length];c.Math.random=()=>draws.shift()??.5;const r=Loot.rollGear('fine',{kinds:['gun']});assert.equal(r.item.equip.gun,id);assert.equal(r.item.equip.mag,0);}}finally{c.Math.random=random;}
 assert(CONTAINER_TYPES.Q.gearPool);assert(CONTAINER_TYPES.K.gearPool);assert(!CONTAINER_TYPES.Z.gearPool);
});
fs.writeFileSync(path.join(root,'design/weapons/assault-expansion-v1/verification.json'),JSON.stringify({passed,failures,timing},null,2)+'\n');console.log(`Assault expansion: ${passed} groups passed, ${failures.length} failed`);
