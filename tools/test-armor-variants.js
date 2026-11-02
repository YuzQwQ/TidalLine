const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),h=fs.readFileSync(path.join(root,'run-test.js'),'utf8').split('let pass = 0')[0];
const c=new Function('require','__dirname',h+'\nreturn ctx;')(require,root),{Game,Save,CFG,GEAR,Base,Player,Enemy,WEAPONS}=c;
const {EQUIP,ARMOR_VARIANTS,HELMETS,BODIES,M,BACKPACK,BALLISTICS,Loot}=vm.runInContext('({EQUIP,ARMOR_VARIANTS,HELMETS,BODIES,M,BACKPACK,BALLISTICS,Loot})',c);
const proposal=JSON.parse(fs.readFileSync(path.join(root,'design/equipment/armor-variants-v1/design.json')));let checks=0;
function test(name,fn){fn();checks++;console.log('OK: '+name);}
Game.init();
function fresh(body=null,weapon='rifle'){
 Save.hp=100;Save.bag=[];Save.stash=[];Save.gear={weapons:[EQUIP.gun(weapon,WEAPONS[weapon].mag),null,null],helmet:null,body:body?GEAR.make('body',body):null,back:null,melee:EQUIP.melee('melee01',true)};
 Game.startRun(null);M.load(Array(60).fill('.'.repeat(60)),null,[],null);M.tideEnabled=false;Game.enemies=[];Game.bullets=[];Game.action=null;Game.lootOpen=null;const p=Game.player;p.x=p.y=900;p.bag.slots=[];p.aimRemaining=0;p.meleeActive=false;return p;
}
test('20 unique models; legacy level lookup and exact 8 proposed definitions',()=>{
 assert.equal(HELMETS.length,10);assert.equal(BODIES.length,10);assert.equal(new Set([...HELMETS,...BODIES].map(d=>d.id)).size,20);
 for(const v of proposal.variants){const d=GEAR.def(v.type,v.id),g=GEAR.make(v.type,v.id,7);assert.equal(d.name,v.name);assert.equal(d.price,v.proposed.price);assert.equal(d.w,v.proposed.weight);assert.equal(d.dur,v.proposed.durability);assert.equal(g.id,v.id);assert.equal(g.dur,7);assert.equal(g.move,1);assert.equal(EQUIP.armor(g).icon,v.id);assert.equal(EQUIP.armor(g).desc,v.description);}
 for(let lv=1;lv<=6;lv++)for(const type of ['helmet','body'])assert.equal(GEAR.def(type,lv).id,type+lv);
 assert.equal(GEAR.def('body','unknown-model'),null);
});
test('all model IDs and durability survive repeated save/load, including stash/bag and legacy move',()=>{
 for(const d of ARMOR_VARIANTS){fresh();Save.credits=184652;Save.hp=71;const g=GEAR.make(d.type,d.id,11);Save.gear[d.type]=g;Save.stash=[{id:'legacy-entry',n:1,gear:EQUIP.armor(g)}];Save.bag=[{id:'legacy-entry',n:1,gear:EQUIP.armor(g)}];Save.save();Save.flush();for(let i=0;i<3;i++){Save.load();assert.equal(Save.gear[d.type].id,d.id);assert.equal(Save.gear[d.type].dur,11);assert.equal(Save.stash[0].gear.equip.gear.id,d.id);assert.equal(Save.bag[0].gear.equip.gear.id,d.id);assert.equal(Save.credits,184652);assert.equal(Save.hp,71);Save.save();Save.flush();}}
 Save.gear.body={type:'body',lv:6,dur:19,move:.88};Save.save();Save.flush();Save.load();assert.equal(Save.gear.body.id,'body6');assert.equal(Save.gear.body.dur,19);assert.equal(Save.gear.body.aimPenaltyPct,60);assert.equal(Save.gear.body.move,1);
});
test('variant equip, replace, unload, raid synchronization and failure preserve model semantics',()=>{
 fresh();Save.gear.body=GEAR.make('body',3,17);Save.addGearStash(EQUIP.armor(GEAR.make('body','body4_lightplate',41)));const entry=Save.stash[0];assert(Base.equipFromStash(entry,'body'));assert.equal(Save.gear.body.id,'body4_lightplate');assert.equal(Save.gear.body.dur,41);assert(Save.stash.some(e=>e.gear.equip.gear.id==='body3'&&e.gear.equip.gear.dur===17));Base.unequip('body');assert(Save.stash.some(e=>e.gear.equip.gear.id==='body4_lightplate'));
 Save.gear.body=GEAR.make('body','body4_lightplate',41);Game.startRun(null);assert.equal(Game.player.body.id,'body4_lightplate');Game.syncGear();assert.equal(Save.gear.body.dur,41);
});
test('public stock keeps I–III only; all six new public models buy at exact prices',()=>{
 fresh();Save.credits=1000000;for(const d of ARMOR_VARIANTS){const n=Save.stash.length,b=Save.credits;Base.buyArmor(d.type,d.id);if(d.lv<=3){assert.equal(Save.stash.length,n+1);assert.equal(Save.credits,b-d.price);assert.equal(Save.stash.at(-1).gear.equip.gear.id,d.id);}else{assert.equal(Save.stash.length,n);assert.equal(Save.credits,b);}}
});
test('level pools select both variants without changing level, quantity or penetration',()=>{
 for(const type of ['helmet','body'])for(let lv=1;lv<=6;lv++){const ids=new Set();for(let i=0;i<100;i++){const g=GEAR.random(type,lv);assert.equal(g.lv,lv);ids.add(g.id);}assert.equal(ids.size,lv<=4?2:1);}
 for(const d of ARMOR_VARIANTS){const a=BALLISTICS.hit(10,Math.min(6,d.lv+1),GEAR.make(d.type,d.lv)),b=BALLISTICS.hit(10,Math.min(6,d.lv+1),GEAR.make(d.type,d.id));assert.equal(a.health,b.health);assert.equal(a.durabilityLoss,b.durabilityLoss);}
});
const timing=[];
test('4 weapons × 10 bodies × 30/60/144FPS aiming follows the formula to within one frame',()=>{
 for(const id of Object.keys(WEAPONS))for(const d of BODIES)for(const fps of [30,60,144]){const p=new Player(900,900);p.weapons=[{...WEAPONS[id],magCur:30}];p.slot=0;p.body=GEAR.make('body',d.id);p.checkAimProfile();const expected=WEAPONS[id].aimTime*(1+d.aimPenaltyPct/100);let frames=0;while(p.aimRemaining>1e-10&&frames<300){p.updateAim(1/fps);frames++;}const elapsed=frames/fps;assert(Math.abs(elapsed-expected)<=1/fps+1e-8);timing.push({weapon:id,body:d.id,fps,expected,elapsed});}
});
test('settled accuracy, firing rate, reload and actual mouse direction remain independent of penalty',()=>{
 for(const id of ['body2','body2_concealed','body4','body4_lightplate']){const p=fresh(id);p.moving=true;p.updateAim(0);const n=p.mag;p.fireCd=0;assert(p.tryShoot());assert.equal(p.mag,n-1);assert.equal(p.fireCd,60/p.weapon.rpm);assert(p.aimRemaining>0);p.moving=false;p.aimRemaining=0;p.recoil=0;p.syncSpread();assert.equal(p.spread,p.weapon.spreadBase);p.update(1/60,{mx:0,my:0,sneak:false,sprint:false,dodge:false,aimAngle:1.1});assert.equal(p.angle,1.1);}
});
test('changing gun/body, dodging and reloading cannot erase remaining preparation',()=>{
 const p=fresh('body4');p.checkAimProfile();p.aimRemaining=.2;p.body=GEAR.make('body','body4_lightplate');p.fireCd=0;p.tryShoot();assert(p.aimRemaining>=p.aimTime);p.weapons[1]={...WEAPONS.pistol,magCur:12};p.switchWeapon(1);assert(p.aimRemaining>=p.aimTime);p.dodgeT=.1;p.updateAim(.05);assert(p.aimRemaining>=p.aimTime);p.dodgeT=0;p.reloadT=.3;p.updateAim(.05);assert(p.aimRemaining>=p.aimTime);
});
test('equal load tiers have equal movement; old move values ignored and overweight still slows',()=>{
 const dist=(id,total)=>{const p=fresh(id);p.body.move=.01;p.bag.slots=[{item:{id:'fixture',w:total-p.totalWeight},n:1}];const x=p.x;for(let i=0;i<60;i++)p.update(1/60,{mx:1,my:0,sneak:false,sprint:false,dodge:false,aimAngle:0});return p.x-x;};
 const base=dist('body1',25);for(const d of BODIES)assert(Math.abs(dist(d.id,25)-base)<1e-6);assert(dist('body4_lightplate',44)<dist('body4_lightplate',25));
});
test('variant damage still alerts/kills and true damage never wears variant armor',()=>{
 fresh();for(const d of ARMOR_VARIANTS){const e=new Enemy('guard',1000,900);e[d.type]=GEAR.make(d.type,d.id);e.hp=100;const before=e[d.type].dur;e.hurt(12,'player',d.type==='helmet'?'head':'body',1,'trueDamage');assert.equal(e.hp,88);assert.equal(e[d.type].dur,before);assert.equal(e.state,'chase');}
});
const report={status:'passed',groups:checks,models:20,variants:8,aimTiming:timing,limits:'Unit/engine checks, not a substitute for the paired combat probe or manual playtesting.'};fs.writeFileSync(path.join(root,'design/equipment/armor-variants-v1/runtime-validation.json'),JSON.stringify(report,null,2)+'\n');console.log('Passed '+checks+' armor/aim integration groups');
