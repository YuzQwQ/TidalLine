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
function target(x,y,r=7,hp=100){return {x,y,r,hp,dead:false,hurt(d){this.hp-=d;return d;}};}
test('gift is idempotent, bound, pending when full',()=>{
  Save.meleeGiftClaimed=false;Save.gear.melee=null;S.grant();assert(Save.meleeGiftClaimed);assert(Save.gear.melee.equip.bound);
  const before=Save.stash.length;S.grant();assert.equal(Save.stash.length,before);
  Save.meleeGiftClaimed=false;Save.gear.melee=EQUIP.melee('melee02');Save.stash=Array(STASH_SLOTS).fill({id:'life01',n:1});S.grant();assert(!Save.meleeGiftClaimed);
  Save.stash=[];S.grant();assert(Save.meleeGiftClaimed);assert.equal(Save.stash.length,1);
});
test('shop sells original knives plus rescue knife and crowbar; unavailable weapons stay blocked',()=>{
  Save.credits=10000000;Save.stash=[];assert(Base.buyMelee('melee01'));assert(Base.buyMelee('melee02'));assert.equal(Base.buyMelee('melee03'),false);assert.equal(Save.credits,9055000);
  Save.addGearStash(EQUIP.melee('melee01',true));const e=Save.stash.at(-1);Base.sell(e,1);assert(Save.stash.includes(e));assert.equal(Save.credits,9055000);
  assert(Base.buyMelee('melee05'));assert(Base.buyMelee('melee06'));assert.equal(Save.credits,8177500);
  for(const id of ['melee03','melee07'])assert.equal(Base.buyMelee(id),false);
  assert.equal(Save.credits,8177500);assert(Base.buyMelee('melee04'));assert.equal(Save.credits,6467500);
  assert.deepEqual(Array.from(MELEE.filter(d=>d.available),d=>d.id),['melee01','melee02','melee04','melee05','melee06']);
});

test('first expansion retains requested stats, rarity, descriptions and independent equipment',()=>{
  const expected=[
    ['melee04',4,.45,570000,32,1.65,.3,25,1,'melee_hit_stab'],
    ['melee05',2,.25,127500,10,.42,.1,65,.55,'melee_hit_small'],
    ['melee06',2,1.2,165000,22,1.2,.32,85,.85,'melee_hit_medium'],
    ['melee07',5,.75,1080000,30,1.5,.38,110,.85,'melee_hit_large']
  ];
  for(const [id,...values] of expected){
    const d=S.def(id),item=EQUIP.melee(id);
    assert.deepEqual([d.r,d.w,d.price,d.damage,d.interval,d.windup,d.angle,d.radius,d.hitSfx],values);
    assert.equal(item.desc,d.desc);assert.equal(item.equip.kind,'melee');assert(!item.equip.gun);
    Save.gear.melee=item;Save.save();Save.flush();Save.load();assert.equal(Save.gear.melee.equip.melee,id);
  }
  for(const d of MELEE){assert.equal(EQUIP.melee(d.id).sell,d.price/2);assert.equal(EQUIP.melee(d.id,true).sell,0);}
  const item=EQUIP.melee('melee06');assert(item.desc.includes('二十四根撬棍'));assert(item.desc.includes('物理学圣剑'));assert(item.desc.endsWith('「科研」。'));
  assert.equal(vm.runInContext("itemDescriptionHtml(EQUIP.melee('melee06'),EQUIP.melee('melee06').desc)",c).endsWith('<strong>「科研」。</strong>'),true);
});

test('spike requires precise aim while kukri covers wide flank; rescue knife has shortest reach',()=>openMap(()=>{
  const p={x:320,y:320},enemyAt=a=>target(320+31*Math.cos(a),320+31*Math.sin(a),1);
  assert(G.hit(p,enemyAt(0),S.def('melee04'),0).point);
  assert(!G.hit(p,enemyAt(Math.PI/6),S.def('melee04'),0).point);
  const side=target(320+26*Math.cos(Math.PI/4),320+26*Math.sin(Math.PI/4),1);
  assert(G.hit(p,side,S.def('melee07'),0).point);
  assert(!G.hit(p,side,S.def('melee04'),0).point);
  assert(!G.hit(p,target(346,320),S.def('melee05'),0).point);
  assert(G.hit(p,target(346,320),S.def('melee01'),0).point);
}));
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

test('weapon-specific impact audio plays once at contact, never on misses, blockers or cancellation',()=>openMap(()=>{
  const real=Game.sfx,blockers=G.blockers;
  let calls=[];
  try {
    Game.sfx=(id,opts)=>calls.push({id,opts});
    for(const [id,sound] of [['melee01','small'],['melee02','medium'],['melee03','large'],['melee04','stab'],['melee05','small'],['melee06','medium'],['melee07','large']]) {
      const p=fresh(id),d=S.def(p.melee);calls=[];
      Game.enemies=[target(340,320),target(339,321)];
      assert(S.attack(p));S.tick(p,d.windup-.001);
      assert.deepEqual(calls.map(c=>c.id),['melee']);
      S.tick(p,.001);S.tick(p,.001);
      assert.deepEqual(calls.map(c=>c.id),['melee','melee_hit_'+sound]);
      assert(calls[1].opts.rate>=.97&&calls[1].opts.rate<=1.03);
    }
    for(const scenario of ['miss','blocked','cancelled','dead','zeroDamage']) {
      const p=fresh();calls=[];Game.enemies=[target(340,320)];
      if(scenario==='miss')Game.enemies=[target(290,320)];
      if(scenario==='blocked')G.blockers=()=>[[325,300,6,40]];
      if(scenario==='zeroDamage')Game.enemies[0].hurt=()=>0;
      S.attack(p);
      if(scenario==='cancelled')S.cancel(p);
      if(scenario==='dead')p.dead=true;
      S.tick(p,.2);
      assert.deepEqual(calls.map(c=>c.id),['melee'],scenario);
      G.blockers=blockers;
    }
    // 未来刺刀只需指定 hitSfx，不需要新增战斗分支。
    const def=MELEE[0],old=def.hitSfx;
    try {
      def.hitSfx='melee_hit_stab';
      const p=fresh();calls=[];Game.enemies=[target(340,320)];
      S.attack(p);S.tick(p,.12);
      assert.deepEqual(calls.map(c=>c.id),['melee','melee_hit_stab']);
    } finally {def.hitSfx=old;}
  } finally {Game.sfx=real;G.blockers=blockers;}
}));
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
