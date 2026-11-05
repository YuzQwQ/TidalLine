const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),h=fs.readFileSync(path.join(root,'run-test.js'),'utf8').split('let pass = 0')[0],c=new Function('require','__dirname',h+'\nreturn ctx;')(require,root);
const {Game,Save,Base,WEAPONS,CFG,U}=c,{EQUIP:E,Attachments:A,Gunplay:G,CALIBERS,AMMO_ITEMS,ATTACHMENT_DEFS:D,BACKPACK,Loot,CONTAINER_QUALITY}=vm.runInContext('({EQUIP,Attachments,Gunplay,CALIBERS,AMMO_ITEMS,ATTACHMENT_DEFS,BACKPACK,Loot,CONTAINER_QUALITY})',c);
const spec=require('../design/weapons/assault-batch-03/weapons.json'),baseline=require('../design/weapons/assault-batch-03/baseline.json'),plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);
Game.init();Base.render=()=>{};const input={mx:0,my:0,sneak:false,sprint:false,dodge:false,aimAngle:0},failures=[];let passed=0;
function test(name,fn){try{fn();passed++;console.log('OK: '+name);}catch(e){failures.push({name,error:e.stack});process.exitCode=1;console.error('FAIL: '+name+'\n'+e.stack);}}
function fresh(id,mag=30,parts={}){Save.hp=100;Save.stash=[];Save.bag=[];Save.gear.back=BACKPACK.make('bag05');Save.gear.melee=E.melee('melee01');Save.gear.weapons=[E.gun(id,mag,null,null,{attachments:parts}),null,E.gun('glock17',17)];Game.startRun(null);Game.enemies=[];Game.bullets=[];Game.action=null;Game.bagOpen=false;Game.lootOpen=null;Game.input.keys={};Game.input.mouseDown=Game.input.mousePressed=false;const p=Game.player;p.bag.slots=[];p.bag.safe=[];p.fireCd=0;p.aimRemaining=0;p.meleeActive=false;p.rV=p.rH=p.recoil=0;p.updateAimPoint(p.x+200,p.y);return p;}
function advance(p,t,fps=120,held=false){for(let i=0;i<Math.round(t*fps);i++){p.update(1/fps,input);G.trigger(p,held,false);}}
test('exactly three new guns, 14 rifles / 23 guns, original 20 and six calibers unchanged',()=>{
 assert.equal(Object.keys(WEAPONS).length,23);assert.equal(Object.values(WEAPONS).filter(w=>w.category==='rifle').length,14);assert.deepEqual(Object.keys(WEAPONS).filter(id=>!baseline.weapons[id]),spec.weapons.map(w=>w.id));
 for(const [id,w]of Object.entries(baseline.weapons))assert.deepEqual(plain(Object.fromEntries(Object.keys(w).map(k=>[k,WEAPONS[id][k]]))),w,id);assert.deepEqual(plain(CALIBERS),baseline.calibers);assert.equal(AMMO_ITEMS.length,30);assert.equal(Object.keys(D).length,35);
 for(const [id,a]of Object.entries(baseline.attachments)){const now=plain(D[id]);if(id.startsWith('att_mag_545x39_'))now.description=a.description;assert.deepEqual(now,a,id+' attachment mechanics');}
 for(const s of spec.weapons){const w=WEAPONS[s.id];for(const k of ['caliber','rpm','mag','rarity','price'])assert.equal(w[k],s[k]);assert.deepEqual(Array.from(w.modes),['semi','auto']);assert.equal(w.slot,'primary');assert.equal(E.gun(w.id).stack,1);}
});
test('roles differ through aim/spread/recoil only; no caliber damage bonus or exclusive mechanism',()=>{
 const {groza1:g,ak12:a,mk47_mod2:m,akm}=WEAPONS;
 assert(g.aimTime<akm.aimTime);assert(g.recoilVMul>akm.recoilVMul);assert(g.recoilHMul>akm.recoilHMul);assert(a.recoilVMul<WEAPONS.aks74u.recoilVMul);assert(a.recoilHMul<WEAPONS.aks74u.recoilHMul);assert(m.spreadBase<akm.spreadBase);assert(m.recoilHMul<akm.recoilHMul);
 for(const s of spec.weapons){const w=WEAPONS[s.id],ref=w.caliber==='545x39'?WEAPONS.aks74u:akm;assert.equal(w.dmgMin,ref.dmgMin);assert.equal(w.dmgMax,ref.dmgMax);assert.equal(w.range,ref.range);assert.equal(w.speed,ref.speed);assert(!w.burstRPM);near(w.aimTime,WEAPONS.m4a1.aimTime*s.aimTimeMul);}
 assert(m.desc.includes('环礁湾')&&m.desc.includes('工坊')&&m.desc.includes('试制')&&m.desc.includes('全自动'));assert(!/正式量产|原厂全自动|厂商量产/.test(m.desc));
});
test('semi requires fresh press, auto follows configured RPM at 30/60/144FPS, empty fire consumes nothing',()=>{
 for(const {id}of spec.weapons){let p=fresh(id);assert(G.setMode(p,'semi'));G.trigger(p,true,true);advance(p,.5,120,true);assert.equal(p.mag,29,id);G.trigger(p,false,false);G.trigger(p,true,true);assert.equal(p.mag,28,id);
  for(const fps of [30,60,144]){p=fresh(id);G.trigger(p,true,true);advance(p,1,fps,true);assert(Math.abs(30-p.mag-(1+WEAPONS[id].rpm/60))<=1.05,id+' @'+fps);assert(!p._deferredBurstRecoil);}
  p=fresh(id,0);assert(!G.trigger(p,true,true));advance(p,.2,120,true);assert.equal(p.mag,0);assert.equal(Game.bullets.length,0);
 }
});
test('both recoil axes use the shared family impulse and return normally',()=>{
 const random=c.Math.random;c.Math.random=()=>.75;try{for(const {id}of spec.weapons){const p=fresh(id),w=p.weapon;G.trigger(p,true,true);near(p.rV,w.recoilBaseV*w.recoilVMul);near(p.rH,(w.recoilBaseH+.5*CFG.RECOIL.axis.h.rand)*w.recoilHMul*(CFG.RECOIL.axis.h.bias<0?-1:1));const v=p.rV,h=Math.abs(p.rH);advance(p,1);assert(p.rV<v);assert(Math.abs(p.rH)<h);}}finally{c.Math.random=random;}
});
test('all five existing ammunition tiers produce shared damage/penetration, correct caliber reload',()=>{
 const rand=U.rand;U.rand=(a,b)=>(a+b)/2;try{for(const {id}of spec.weapons)for(let lv=1;lv<=5;lv++){const p=fresh(id,0),w=p.weapon,ammo='ammo_'+w.caliber+'_'+lv,other=w.caliber==='545x39'?'762x39':'545x39';p.bag.addAmmo('ammo_'+other+'_1',10);assert(!p.tryReload());p.bag.addAmmo(ammo,1);p.weapon.ammo=ammo;assert(p.tryReload());advance(p,w.reloadTime+.01);assert.equal(p.mag,1);G.trigger(p,true,true);const b=Game.bullets.at(-1),a=AMMO_ITEMS.find(x=>x.id===ammo);near(b.dmg,(w.dmgMin+w.dmgMax)/2*a.dmgMul);assert.equal(b.pen,lv);assert.equal(p.mag,0);assert.equal(p.bag.ammoCount(ammo),0);assert.equal(p.bag.ammoCountByCaliber(other),10);}}finally{U.rand=rand;}
});
test('magazines are shared with older same-caliber models; five-slot compatibility and exact capacity',()=>{
 for(const {id}of spec.weapons){const w=WEAPONS[id];assert.equal(Object.keys(w.attachmentSlots).length,5);assert.equal(A.compatible(id,'att_stock01'),id!=='groza1');for(const slot of ['optic','grip','muzzle','magazine'])assert(w.attachmentSlots[slot]);
  for(const a of Object.values(D).filter(a=>a.subtype==='magazine'))assert.equal(A.compatible(id,a.id),a.id.startsWith('att_mag_'+w.caliber+'_'),id+'/'+a.id);
  for(const type of ['ext','quick','quick_ext']){const part='att_mag_'+w.caliber+'_'+type,x=A.resolve(id,{magazine:part});assert.equal(x.mag,type==='quick'?30:39);near(x.reloadTime,w.reloadTime*(type==='ext'?1:.85));const p=fresh(id,0,{magazine:part});p.bag.addAmmo(w.ammo,50);p.tryReload();advance(p,x.reloadTime+.01);assert.equal(p.mag,x.mag);assert.equal(p.bag.ammoCount(w.ammo)+p.mag,50);assert(p.unloadWeapon());assert.equal(p.bag.ammoCount(w.ammo),50);}
 }
});
test('reload interruption and expanded mixed-grade save/equip/warehouse round trip conserve all rounds',()=>{
 for(const {id}of spec.weapons){let p=fresh(id,0),cal=p.weapon.caliber;p.bag.addAmmo('ammo_'+cal+'_1',40);p.tryReload();advance(p,.2);p.switchWeapon(2);advance(p,4);assert.equal(p.weapons[0].magCur,0);assert.equal(p.bag.ammoCountByCaliber(cal),40);
  const part='att_mag_'+cal+'_quick_ext',rounds=Array.from({length:39},(_,i)=>'ammo_'+cal+'_'+(i%5+1)),eq=E.gun(id,39,rounds[0],rounds,{attachments:{magazine:part,optic:'att_optic01'},fireMode:'semi'});Save.gear.weapons[0]=eq;Save.save();Save.flush();Save.load();assert.deepEqual(plain(Save.gear.weapons[0]),plain(eq));Game.state='base';Save.stash=[];Save.bag=[];Save.addGearStash(eq);assert.equal(Save.stash.length,1);assert(Base.toBag(Save.stash[0]));assert.equal(Save.bag.length,1);assert.equal(Save.stash.length,0);assert(Base.toStash(Save.bag[0]));assert.equal(Save.stash.length,1);assert.equal(Save.bag.length,0);assert.equal(Save.stash[0].gear.equip.mag,39);assert.deepEqual(Array.from(Save.stash[0].gear.equip.rounds),rounds);
 }
});
test('existing mod transaction attaches and detaches exactly one item per gun',()=>{
 for(const {id}of spec.weapons){fresh(id);Game.state='base';Save.stash=[];Save.addGearStash(E.attachment('att_optic01'));let t=A.targets().find(t=>t.owner==='base-equipped'&&t.index===0);let r=A.commit(t,'optic','att_optic01',Save.stash[0]);assert(r.ok,id);assert.equal(Save.stash.length,0);t=A.targets().find(t=>t.owner==='base-equipped'&&t.index===0);r=A.commit(t,'optic',null);assert(r.ok);assert.equal(Save.stash.length,1);assert.equal(Save.stash[0].gear.equip.attachment,'att_optic01');}
});
test('only AK-12 is offered, all three can be sold; every model is reachable via existing weighted gear pool',()=>{
 const random=c.Math.random;try{for(const s of spec.weapons){Game.state='base';Save.stash=[];Save.credits=1e6;assert.equal(Base.buyGun(s.id),s.id==='ak12');assert.equal(Save.credits,1e6-(s.id==='ak12'?s.price:0));Save.stash=[];const item=E.gun(s.id,0);Save.addGearStash(item);const sales=vm.runInContext('Sales',c);c.Safehouse={view:'merchant'};c.MerchantUI={key:'gun',mode:'sell'};const quote=sales.preview('gun',[{entry:Save.stash[0],n:1}]),before=Save.credits;assert(sales.commit(sales.authorize(quote)).ok);assert.equal(Save.credits-before,item.sell);assert.equal(Save.stash.length,0);
  const pct=CONTAINER_QUALITY.fine.pct,group=Object.values(WEAPONS).filter(w=>w.rarity===s.rarity),index=group.findIndex(w=>w.id===s.id),roll=(pct.slice(0,s.rarity-1).reduce((a,b)=>a+b,0)+pct[s.rarity-1]/2)/pct.reduce((a,b)=>a+b,0),draws=[roll,0,(index+.5)/group.length];c.Math.random=()=>draws.shift()??.5;const drop=Loot.rollGear('fine',{kinds:['gun']});assert.equal(drop.item.equip.gun,s.id);assert.equal(drop.n,1);assert.equal(drop.item.equip.mag,0);c.Math.random=random;
 }}finally{c.Math.random=random;delete c.Safehouse;delete c.MerchantUI;}
});
fs.writeFileSync(path.join(root,'design/weapons/assault-batch-03/verification.json'),JSON.stringify({passed,failures},null,2)+'\n');console.log(`Batch 03: ${passed} groups passed, ${failures.length} failed`);
