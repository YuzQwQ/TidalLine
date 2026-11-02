const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'design/enemies/human-units-v1'),h=fs.readFileSync(path.join(root,'run-test.js'),'utf8').split('let pass = 0')[0],c=new Function('require','__dirname',h+'\nreturn ctx;')(require,root);
const {Game,Save,Enemy,Player,GEAR,Corpse,WEAPONS,EQUIP,CFG,M,Noise}=c;
const {HumanAI,HUMAN_UNIT_DEFS,ITEM_BY_ID}=vm.runInContext('({HumanAI,HUMAN_UNIT_DEFS,ITEM_BY_ID})',c);let groups=0;const reports=[];
function test(name,fn){fn();groups++;console.log('OK: '+name);}
function arena(rows){Game.init();M.load(rows||Array(50).fill('.'.repeat(50)),null,[],null);M.tideEnabled=false;c.Quiet.clear();Game.state='playing';Game.time=0;Game.enemies=[];Game.bullets=[];Game.particles=[];Game.toasts=[];Noise.clear();Game.player=new Player(600,400);Game.player.hp=10000;Game.player.maxHp=10000;Game.player.weapons=[{...WEAPONS.rifle,magCur:30},null,null];Game.player.slot=0;return Game.player;}
function enemy(key,x=600,y=600,opts={}){const e=new Enemy(key,x,y,0,{facing:'n',...opts});Game.enemies.push(e);return e;}
function tick(e,dt,n=1,bullets=false){for(let i=0;i<n;i++){Game.time+=dt;e.update(dt);if(bullets){for(const b of Game.bullets)b.update(dt);Game.bullets=Game.bullets.filter(b=>!b.dead);}Noise.tick(dt);Game.particles=[];Game.toasts=[];}}
test('profiles, finite equipment, worn variants and common human faction',()=>{
 arena();for(const key of ['holdout','retriever'])for(let i=0;i<80;i++){const e=enemy(key,600+i,600,{id:key+i});assert.equal(e.t.faction,'scav');assert.equal(e.ai.mag,e.t.mag);assert.equal(e.ai.reserve,e.t.reserve);assert.equal(e.ammoId,'ammo_'+WEAPONS[e.weaponId].caliber+'_'+e.gearLv);assert(HUMAN_UNIT_DEFS[key].levels.some(x=>x[0]===e.gearLv));for(const g of [e.helmet,e.body])if(g){assert.equal(g.lv,e.gearLv);assert(g.dur>=g.max*.6&&g.dur<=g.max*.9);}}
});
test('warning outside anchor never attacks; inside waits warning and aiming',()=>{
 const p=arena(),e=enemy('holdout');p.x=600;p.y=400;tick(e,1/60,240);assert.equal(e.ai.shots,0);assert.equal(e.state,'warning');
 p.y=520;let first=null;for(let i=0;i<130;i++){tick(e,1/60);if(e.ai.shots){first=(i+1)/60;break;}}assert(first>=.65-1/60);assert.equal(e.ai.mag,5);assert.equal(Game.bullets.length,6);
 arena();const e2=enemy('holdout');Game.player.y=520;tick(e2,1/60,90);assert.equal(e2.ai.shots,0);tick(e2,1/60,20);assert.equal(e2.ai.shots,1);
});
test('damage bypasses warning without removing aim or resetting attack phase',()=>{
 arena();Game.player.y=450;const e=enemy('holdout');e.hurt(1,'player','body',5);tick(e,1/60,30);assert.equal(e.ai.shots,0);tick(e,1/60,12);assert.equal(e.ai.shots,1);const cd=e.ai.cd,phase=e.ai.phase;e.hurt(1,'player','body',5);assert.equal(e.ai.cd,cd);assert.equal(e.ai.phase,phase);
});
test('actual geometry: north half-wall, glass, closed/open doors and water',()=>{
 arena();const e=enemy('retriever',300,300);let wall=M.at(10,10);wall.ch='#';wall.solid=true;wall.art='wall';wall.opaque=true;assert(!HumanAI.clear(300,310,360,310,true));assert(!HumanAI.clear(300,310,360,310,false));
 wall.solid=false;wall.opaque=false;wall.ch='.';wall.art='low';wall.terrainCh='w';assert(HumanAI.clear(300,336,360,336,false));assert(!HumanAI.clear(300,336,360,336,true));wall.terrainCh='.';wall.door={open:false};assert(!HumanAI.clear(300,336,360,336,true));wall.door.open=true;assert(HumanAI.clear(300,336,360,336,true));delete wall.door;wall.ch='~';wall.terrainCh='~';wall.h=0;assert(HumanAI.clear(300,336,360,336,true));
});
test('LOS memory never reads hidden player position or uses radio as firing permission',()=>{
 const p=arena(),e=enemy('retriever');tick(e,.1);const seen={...e.ai.memory};e.canSee=()=>false;const observe=HumanAI.observe;HumanAI.observe=()=>null;p.x=1200;p.y=1200;tick(e,.1,15);assert.equal(e.ai.memory.x,seen.x);assert.equal(e.ai.memory.y,seen.y);assert.equal(e.ai.shots,0);HumanAI.observe=observe;
});
test('same-squad snapshots only, 10 tile range, no relays and deterministic roles',()=>{
 arena();const a=enemy('retriever',600,600,{id:'a',squadId:'one'}),b=enemy('retriever',700,600,{id:'b',squadId:'one'}),other=enemy('retriever',710,600,{id:'c',squadId:'two'});
 HumanAI.radio(a,{x:600,y:400,kind:'player'});assert(b.ai.memory);assert(!other.ai.memory);const first=b.ai.memory.time;b.ai.clock=.3;HumanAI.radio(a,{x:400,y:400,kind:'player'});assert.equal(b.ai.memory.time,first);a.ai.clock=2;b.x=1100;HumanAI.radio(a,{x:400,y:400,kind:'player'});assert.equal(b.ai.memory.x,600);assert.deepEqual(HumanAI.teammates(a).map(e=>e.spawnId),['b']);
});
test('bounded cover paths have reachable world-space segments; no closed-door shortcuts',()=>{
 arena();const e=enemy('retriever',600,600),goal=HumanAI.cover(e,{x:600,y:350},true);assert(e.ai.coverNodes<=169);if(goal){assert(goal.path.length<=8);let p={x:e.x,y:e.y};for(const node of goal.path){const q=M.navigationPoint(node.x,node.y);assert(HumanAI.walkSegment(p.x,p.y,q.x,q.y,e.r));p=q;}}
 assert.equal(HumanAI.cover(e,{x:600,y:350},true),null);
});
test('30/60/144FPS burst cadence and holdout cadence never exceed limits',()=>{
 for(const fps of [30,60,144])for(const key of ['holdout','retriever']){
  arena();Game.player.y=450;const e=enemy(key);e.ai.engaged=true;e.ai.reserve=0;e.ai.mag=100;e.patrolRadius=0;const times=[];let last=0;
  // Keep the actor fixed to isolate attack scheduling from cover/path selection.
  const move=e.moveAlongPath;e.moveAlongPath=()=>false;
  for(let i=0;i<fps*5;i++){tick(e,1/fps);if(e.ai.shots>last){assert.equal(e.ai.shots-last,1);times.push((i+1)/fps);last=e.ai.shots;}}
  assert(times[0]>=e.t.aim-1/fps);for(let i=1;i<times.length;i++)assert(times[i]-times[i-1]>=(key==='holdout'?1.5:.16)-1/fps-1e-8);
  reports.push({key,fps,times});e.moveAlongPath=move;
 }
 arena();const e=enemy('retriever');e.ai.engaged=true;tick(e,2);tick(e,2);assert.equal(e.ai.shots,1);tick(e,2);assert.equal(e.ai.shots,2);
});
test('death cancels pending rounds; loss of sight cancels a partial burst',()=>{
 arena();const e=enemy('retriever');tick(e,1/60,37);assert.equal(e.ai.shots,1);const obs=HumanAI.observe;HumanAI.observe=()=>null;tick(e,.2);assert.equal(e.ai.shots,1);assert.equal(e.ai.burstLeft,0);HumanAI.observe=obs;e.hurt(999,'player','body',5);tick(e,1,2);assert.equal(e.ai.shots,1);
});
test('reload transfer and death in reload conserve loaded/reserve ammo',()=>{
 for(const key of ['holdout','retriever']){arena();const e=enemy(key);e.ai.mag=0;e.ai.reserve=4;tick(e,.01);assert.equal(e.ai.phase,'reload');tick(e,.1,Math.floor(e.t.reload/.1)-1);assert.equal(e.ai.mag,0);const corpse=new Corpse(e.x,e.y,e);assert.equal(corpse.loot.find(x=>x.gun).gun.magCur,0);assert.equal(corpse.loot.find(x=>x.item?.cat==='ammo').n,4);tick(e,.1,3);assert.equal(e.ai.mag,4);assert.equal(e.ai.reserve,0);}
});
test('new corpse actual magazine incl zero survives direct equip, carry and save; legacy stays 30%',()=>{
 for(const mag of [0,7]){arena();const e=enemy('retriever');e.ai.mag=mag;e.ai.reserve=3;const corpse=new Corpse(e.x,e.y,e),entry=corpse.loot.find(x=>x.gun);assert.equal(Game.corpseGun(entry).equip.mag,mag);assert.equal(Game.corpseGun(entry).equip.ammo,e.ammoId);Game.player.weapons=[null,null,null];Game.player.slot=0;Game.lootOpen={items:[entry]};Game.takeGear(entry,0);assert.equal(Game.player.weapons[0].magCur,mag);assert.equal(Game.player.mag,mag);assert.equal(Game.player.weapons[0].ammo,e.ammoId);Game.syncGear();Save.save();Save.flush();Save.load();assert.equal(Save.gear.weapons[0].equip.mag,mag);}
 arena();assert.equal(Game.corpseGun({gun:'rifle'}).equip.mag,9);
});
test('leash, finite budget and returning do not restore resources or introduce melee',()=>{
 arena();const e=enemy('holdout');e.ai.engaged=true;e.x=e.homeX+9*CFG.TILE;e.hp=30;tick(e,.1);assert(e.ai.holdHome);assert.equal(e.hp,30);e.ai.mag=e.ai.reserve=0;const before=Game.player.hp;tick(e,.1,40);assert.equal(e.ai.shots,0);assert.equal(Game.player.hp,before);assert.equal(e.ai.mag+e.ai.reserve,0);
});
test('an unprovoked warning resets after ten quiet seconds back in the home area',()=>{
 const p=arena(),e=enemy('holdout');p.y=400;tick(e,.1,12);assert.notEqual(e.ai.warningStart,null,JSON.stringify({ai:e.ai,p:{x:p.x,y:p.y,dead:p.dead},e:{x:e.x,y:e.y,angle:e.angle},obs:HumanAI.observe(e)}));p.x=p.y=1500;tick(e,.1,105);assert.equal(e.ai.warningStart,null);p.x=600;p.y=530;tick(e,.1,9);assert.equal(e.ai.shots,0);
});
test('human projectiles exclude allies while still targeting machines and echo',()=>{
 arena();const e=enemy('retriever'),friend=enemy('holdout',650,600),scav=enemy('scav',660,600),guard=enemy('guard',670,600),echo=enemy('echo',680,600);HumanAI.shot(e,0);const targets=Game.bullets[0].targets();assert(!targets.includes(friend));assert(!targets.includes(scav));assert(targets.includes(guard));assert(targets.includes(echo));assert(targets.includes(Game.player));
});
test('NPC damage/ammo coefficients are per projectile without changing player weapon definitions',()=>{
 arena();const before=JSON.stringify(WEAPONS);for(const key of ['holdout','retriever']){Game.bullets=[];const e=enemy(key);e.gearLv=e.penLevel=3;e.ammoId='ammo_'+WEAPONS[e.weaponId].caliber+'_3';assert(HumanAI.shot(e,0));assert.equal(Game.bullets.length,key==='holdout'?6:1);for(const b of Game.bullets){assert.equal(b.dmg,e.t.dmg*1.05);assert.equal(b.pen,3);}assert.equal(e.ai.mag,e.t.mag-1);}assert.equal(JSON.stringify(WEAPONS),before);
});
test('carried zero-magazine loot and full-bag failure preserve the exact NPC snapshot',()=>{
 arena();const e=enemy('retriever');e.ai.mag=0;e.ai.reserve=4;const entry=new Corpse(e.x,e.y,e).loot.find(x=>x.gun),p=Game.player;p.weapons=[{...WEAPONS.rifle,magCur:5},{...WEAPONS.shotgun,magCur:4},null];p.slot=0;p.mag=5;p.bag.slots=[];Game.lootOpen={items:[entry]};assert(Game.takeGear(entry,0));assert.equal(p.bag.slots[0].item.equip.mag,0);assert.equal(p.bag.slots[0].item.equip.ammo,e.ammoId);
 const another=new Corpse(e.x,e.y,e).loot.find(x=>x.gun);p.bag.slots=Array.from({length:p.slots},()=>({item:ITEM_BY_ID.heal01,n:1}));Game.lootOpen={items:[another]};assert.equal(Game.takeGear(another,0),false);assert.equal(Game.lootOpen.items[0],another);assert.equal(another.gun.magCur,0);assert.equal(e.ai.reserve,4);
});
fs.writeFileSync(path.join(folder,'runtime-validation.json'),JSON.stringify({status:'passed',groups,attackTiming:reports},null,2)+'\n');console.log('Passed '+groups+' human AI/ammo integration groups');
