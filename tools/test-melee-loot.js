/* 收藏近战额外池：概率边界、与原物资独立、尸体/容器来源及拿取存档。 */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),h=fs.readFileSync(path.join(root,'run-test.js'),'utf8').split('let pass = 0')[0];
const c=new Function('require','__dirname',h+'\nreturn ctx;')(require,root);
const {Game,Save}=c;
const {Loot,CONTAINER_TYPES:T,RARE_MELEE_POOL:pool,ENEMY_TYPES,Enemy,Corpse,EQUIP}=vm.runInContext('({Loot,CONTAINER_TYPES,RARE_MELEE_POOL,ENEMY_TYPES,Enemy,Corpse,EQUIP})',c);
Game.init();Game.startRun(null);Game.enemies=[];
const withRandom=(fn,random)=>{const original=Math.random;Math.random=random;try{return fn();}finally{Math.random=original;}};
function draw(prob,choice){let calls=0;return withRandom(()=>Loot.rollBonusMelee(pool),()=>++calls===1?prob:choice);}
assert.equal(pool.chance,.01);assert.deepEqual(Array.from(pool.ids),['melee03','melee07']);
assert.equal(T.K.bonusMeleePool,pool);assert.equal(ENEMY_TYPES.retriever.bonusMeleePool,pool);
assert.deepEqual(Object.keys(T).filter(k=>T[k].bonusMeleePool),['K']);
assert.deepEqual(Object.keys(ENEMY_TYPES).filter(k=>ENEMY_TYPES[k].bonusMeleePool),['retriever']);
assert.equal(draw(.01,0),null);assert.equal(draw(.999,0),null);
assert.equal(draw(.009999,0).item.equip.melee,'melee03');
assert.equal(draw(0,.999).item.equip.melee,'melee07');
let hits=0,counts={melee03:0,melee07:0};
for(let i=0;i<1000;i++){const bonus=draw(i/1000,i%2?0:.999);if(bonus){hits++;counts[bonus.item.equip.melee]++;assert.equal(bonus.n,1);assert.equal(bonus.item.equip.bound,false);}}
assert.equal(hits,10);assert.deepEqual(counts,{melee03:5,melee07:5});
withRandom(()=>assert.equal(Loot.rollBonusMelee(null),null),()=>{throw Error('No pool must not use RNG');});

// 先记录原有物资抽取的随机数，再回放，最后单独控制额外判定。
function record(fn){let seed=12345;const values=[];const result=withRandom(fn,()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed/4294967296;values.push(x);return x;});return {result,values};}
function replay(fn,values,tail){let i=0;return withRandom(fn,()=>{assert(i<values.length+tail.length,'Unexpected RNG call');return i<values.length?values[i++]:tail[i++-values.length];});}
const baseType={...T.K,bonusMeleePool:undefined};
const base=record(()=>Loot.fill(T.K.q,T.K.cats,baseType));
for(const [prob,choice,id]of [[0,0,'melee03'],[.009999,.999,'melee07'],[.01,0,null]]){
  const list=replay(()=>Loot.fill(T.K.q,T.K.cats,T.K),base.values,id?[prob,choice]:[prob]);
  assert.equal(JSON.stringify(list.slice(0,base.result.length)),JSON.stringify(base.result));
  assert.equal(list.length,base.result.length+(id?1:0));
  if(id)assert.equal(list.at(-1).item.equip.melee,id);
}
const enemy=new Enemy('retriever',300,300),definition=enemy.t;
enemy.t={...definition,bonusMeleePool:undefined};
const corpseBase=record(()=>new Corpse(enemy.x,enemy.y,enemy));
enemy.t=definition;
const corpse=replay(()=>new Corpse(enemy.x,enemy.y,enemy),corpseBase.values,[0,.999]);
assert.equal(JSON.stringify(corpse.loot.slice(0,-1)),JSON.stringify(corpseBase.result.loot));
assert.equal(corpse.bagLv,corpseBase.result.bagLv);
const bonus=corpse.loot.at(-1);assert.equal(bonus.item.equip.melee,'melee07');assert(bonus.fromBag);assert.notEqual(bonus.known,true);

// 开关面板仅复用已有战利品，不能给 1% 再抽一次的机会。
const original=Loot.rollBonusMelee;Loot.rollBonusMelee=()=>{throw Error('Reopening must not reroll');};
try{
  for(let i=0;i<2;i++){Game.openLoot(corpse,true,{silent:true});Game.closeLoot();}
  const box={x:300,y:300,tx:9,ty:9,name:T.K.name,kind:T.K.q,items:[{item:EQUIP.melee('melee03'),n:1}]};
  for(let i=0;i<2;i++){Game.openLoot(box,false,{silent:true});Game.closeLoot();}
}finally{Loot.rollBonusMelee=original;}

// 额外刀具沿用普通装备的拿取与保存路径，且不受是否商店出售限制。
const p=Game.player;p.melee=null;p.bag.slots=[];
bonus.known=true;Game.lootOpen=corpse;corpse.items=corpse.loot;
const index=corpse.items.indexOf(bonus);
assert(Game.takeGear(bonus,index));assert.equal(p.melee.equip.melee,'melee07');assert.equal(corpse.items[index],null);
Game.syncGear();Save.save();Save.flush();Save.load();assert.equal(Save.gear.melee.equip.melee,'melee07');
assert.equal(Save.gear.melee.price,1080000);
assert.equal(EQUIP.melee('melee03').sell,337500);assert.equal(EQUIP.melee('melee07').sell,540000);
console.log('PASS: 1% total/0.5% each, allowed sources only, original loot unchanged, one extra, no rerolls, pickup and save');
