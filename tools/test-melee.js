const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),h=fs.readFileSync(path.join(root,'run-test.js'),'utf8').split('let pass = 0')[0];
const c=new Function('require','__dirname',h+'\nreturn ctx;')(require,root);
const {Game,Save,CFG,Base,GEAR}=c;
const {EQUIP,MELEE,MeleeSystem:S,MeleeGeometry:G,BACKPACK,M,ENEMY_TYPES,Enemy,ITEM_BY_ID,STASH_SLOTS}=vm.runInContext('({EQUIP,MELEE,MeleeSystem,MeleeGeometry,BACKPACK,M,ENEMY_TYPES,Enemy,ITEM_BY_ID,STASH_SLOTS})',c);
let checks=0;function test(name,fn){try{fn();checks++;console.log('OK: '+name);}catch(e){console.error('FAIL: '+name+'\n'+e.stack);process.exitCode=1;}}
Game.init();
function fresh(id='melee01'){
  Save.gear.back=BACKPACK.make('bag05');Save.gear.melee=EQUIP.melee(id);Save.bag=[];Game.startRun(null);Game.enemies=[];
  const p=Game.player;p.x=p.y=320;p.bag.slots=[];p.angle=0;p.switchMelee();
  return p;
}
function openMap(fn){const original=G.blockers;G.blockers=()=>[];try{return fn();}finally{G.blockers=original;}}
function target(x,y,r=7,hp=100){return {x,y,r,hp,dead:false,hurt(d){this.hp-=d;}};}
test('gift is idempotent, bound, pending when full',()=>{
  Save.meleeGiftClaimed=false;Save.gear.melee=null;S.grant();assert(Save.meleeGiftClaimed);assert(Save.gear.melee.equip.bound);
  const before=Save.stash.length;S.grant();assert.equal(Save.stash.length,before);
  Save.meleeGiftClaimed=false;Save.gear.melee=EQUIP.melee('melee02');Save.stash=Array(STASH_SLOTS).fill({id:'life01',n:1});S.grant();assert(!Save.meleeGiftClaimed);
  Save.stash=[];S.grant();assert(Save.meleeGiftClaimed);assert.equal(Save.stash.length,1);
});
test('shop only sells first two knives; bound gift cannot be sold',()=>{
  Save.credits=100000;Save.stash=[];assert(Base.buyMelee('melee01'));assert(Base.buyMelee('melee02'));assert.equal(Base.buyMelee('melee03'),false);assert.equal(Save.credits,79000);
  Save.addGearStash(EQUIP.melee('melee01',true));const e=Save.stash.at(-1);Base.sell(e,1);assert(Save.stash.includes(e));assert.equal(Save.credits,79000);
});
test('bound metadata and equipped knife persist through save/migration',()=>{
  Save.gear.melee=EQUIP.melee('melee02');Save.save();Save.flush();Save.load();assert.equal(Save.gear.melee.equip.melee,'melee02');
  assert(Save.stash.some(e=>e.gear?.equip.bound));assert(Save.meleeGiftClaimed);
});
test('exact sector/circle front, rear, arc and radial-edge tangencies',()=>openMap(()=>{
  const p={x:320,y:320},d=MELEE[0],R=d.radius*CFG.TILE;
  assert(G.hit(p,target(320+R+7,320),d,0).point);
  assert(!G.hit(p,target(320+R+7.01,320),d,0).point);
  assert(!G.hit(p,target(290,320),d,0).point);
  assert(G.hit(p,target(350,320,15),d,0).point);
  const a=d.angle*Math.PI/360;assert(G.hit(p,target(320+15*Math.cos(a)-7*Math.sin(a),320+15*Math.sin(a)+7*Math.cos(a)),d,0).point);
}));
test('walls, north half-wall, closed doors and furniture block; water and open doors do not',()=>{
  const original=G.blockers,p={x:320,y:320},e=target(345,320),d=MELEE[2];
  G.blockers=()=>[[330,300,6,40]];assert(!G.hit(p,e,d,0).point);
  G.blockers=()=>[[330,315,6,5]];assert(G.hit(p,target(345,323,12),d,0).point,'visible part of a large target');G.blockers=original;
  const at=M.at;try{
    for(const blocker of [{solid:true},{door:{open:false}},{container:true},{prop:{ground:false}}]){M.at=(x,y)=>x===10&&y===10?blocker:{solid:false};assert(G.blockers({x:300,y:320},40).length);}
    for(const empty of [{permanentWater:true,solid:true},{door:{open:true}},{prop:{ground:true}}]){M.at=()=>empty;assert.equal(G.blockers(p,30).length,0);}
  }finally{M.at=at;}
});
test('each knife waits windup, reads impact aim, hits multiple targets once',()=>openMap(()=>{
  for(const d of MELEE){const p=fresh(d.id),a=target(340,320),b=target(339,321),behind=target(300,320);Game.enemies=[a,b,behind];
    assert(S.attack(p));S.tick(p,d.windup-.001);assert.equal(a.hp,100);S.tick(p,.001);assert.equal(a.hp,100-d.damage);assert.equal(b.hp,100-d.damage);assert.equal(behind.hp,100);
    S.tick(p,.001);assert.equal(a.hp,100-d.damage);assert.equal(S.attack(p),false);
  }
  const p=fresh(),e=target(320,340);Game.enemies=[e];S.attack(p);p.angle=Math.PI/2;S.tick(p,.12);assert.equal(e.hp,88);
}));
test('true damage ignores all armour levels without durability loss or attack interruption',()=>{
  fresh();for(let level=1;level<=6;level++){const e=new Enemy('guard',400,400);e.body=GEAR.make('body',level);e.helmet=GEAR.make('helmet',level);e.hp=100;e.state='chase';e.atkCd=.4;
    const dur=e.body.dur;e.hurt(18,'player','head',null,'trueDamage');assert.equal(e.hp,82);assert.equal(e.body.dur,dur);assert.equal(e.atkCd,.4);}
});
test('windup locks actions; recovery switch/equip cannot reset cooldown; death cancels impact',()=>openMap(()=>{
  const p=fresh();assert(S.attack(p));assert.equal(p.switchWeapon(2),false);assert.equal(Game.toggleBag(),false);assert.equal(p.tryReload(),false);
  S.tick(p,.12);assert(p.switchWeapon(2));p.switchMelee();assert.equal(S.attack(p),false);S.tick(p,.43);assert(S.attack(p));
  const e=target(340,320);Game.enemies=[e];p.dead=true;S.tick(p,1);assert.equal(e.hp,100);
}));
test('hold attacks never exceed interval at 30/60/144 FPS; no catch-up bursts',()=>openMap(()=>{
  for(const fps of [30,60,144])for(const d of MELEE){const p=fresh(d.id),starts=[];
    for(let i=0;i<fps*4;i++){S.tick(p,1/fps);if(S.attack(p))starts.push(p.meleeClock);}
    for(let i=1;i<starts.length;i++)assert(starts[i]-starts[i-1]>=d.interval-1e-8);
  }
}));
test('equipment transfers and unloading fail without loss when full',()=>{
  const p=fresh();p.bag.slots=Array.from({length:24},()=>({item:ITEM_BY_ID.life01,n:1}));const old=p.melee;assert.equal(S.unequipRaid(),false);assert.equal(p.melee,old);
  p.bag.slots=[{item:EQUIP.melee('melee02'),n:1}];assert(S.equipBag(0));assert.equal(p.melee.equip.melee,'melee02');assert.equal(p.bag.slots[0].item.equip.melee,'melee01');
});
test('dropped bound knives can be recovered and keep binding, without codex entries',()=>{
  const p=fresh();p.melee=null;const item=EQUIP.melee('melee01',true),entry={item,n:1};
  Game.lootOpen={items:[entry],tx:10,ty:10,pile:true,x:p.x,y:p.y};
  assert(Game.takeGear(entry,0));assert(p.melee.equip.bound);assert.equal(p.melee.noCodex,true);
});
console.log('Passed '+checks+' melee groups');
