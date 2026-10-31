/* 恢复治疗重构后的验收测试。
   真实运行逻辑，复用主流程的浏览器 mock，避免另一套治疗实现。
   node tools/test-medical.js */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const harness=fs.readFileSync(path.join(root,'run-test.js'),'utf8').split('let pass = 0')[0];
const c=new Function('require','__dirname',harness+'\nreturn ctx;')(require,root);
const {Game,Save,Base,CFG,ITEMS}=c;
const {Medical,Loot,byId}=vm.runInContext('({Medical,Loot,byId:ITEM_BY_ID})',c);
Game.init();
let checks=0;function test(name,fn){fn();checks++;console.log('OK: '+name);}
const near=(a,b,eps=1e-6)=>Math.abs(a-b)<=eps;

/* 准备一局：hp 指定，背包里放一堆指定医疗品 */
function raid(hp=5,id='heal01',where='bag'){
  Save.hp=hp;Game.startRun({ammo:0,bandage:0,stone:0});Game.enemies=[];
  Game.player.vx=Game.player.vy=0;
  Game.input.keys={};Game.input.mouseDown=false;
  Game.player.reloadT=0;Game.player.reloadPending=false;
  Game.player.hp=hp;
  const item=byId[id];
  const entry={item,n:Math.min(2,item.stack||1),cap:item.healCap};
  Game.player.bag[where==='safe'?'safe':'slots']=[entry];
  return entry;
}

/* 推进治疗，返回用掉的时间；action 结束时提前停 */
function advance(sec,step=0.05){
  let t=0;
  while(Game.action&&Game.action.type==='heal'&&t<sec-1e-9){
    const dt=Math.min(step,sec-t);
    Game.updateAction(dt);t+=dt;
  }
  return t;
}

test('159件唯一物品、18医疗品、140图鉴与准确参数',()=>{
  assert.equal(ITEMS.length,159);assert.equal(new Set(ITEMS.map(i=>i.id)).size,159);assert(!byId.med01);
  assert.equal(ITEMS.filter(i=>!i.noCodex).length,140);
  const spec=require('../design/items/medical.json');assert.equal(spec.items.length,18);
  for(const item of spec.items){const actual=byId[item.id];for(const key of ['name','r','w','price','stack','desc','visual'])assert.equal(actual[key],item[key]);assert(actual.noCodex);assert.equal(actual.cat,'medical');assert.equal(!!actual.noLoot,!actual.heal);}
  assert.equal(c.SUPPLY.bandage.itemId,'heal01');assert.equal(c.SUPPLY.bandage.price,2000);
});

test('五件恢复品的启动/速率/容量/堆叠与新需求一致',()=>{
  const want={heal01:[2,10,20,5],heal02:[1.8,12,60,5],heal03:[1.5,15,120,2],heal04:[1.2,20,200,1],heal05:[.8,25,400,1]};
  for(const [id,[start,rate,cap,stack]] of Object.entries(want)){
    const it=byId[id];
    assert.equal(it.healStart,start,id+' 启动');assert.equal(it.healRate,rate,id+' 速率');
    assert.equal(it.healCap,cap,id+' 容量');assert.equal(it.stack,stack,id+' 堆叠');
    assert.equal(it.use,true);
  }
});

test('启动阶段不回血也不扣容量；持续阶段按速率扣',()=>{
  for(const id of ['heal01','heal02','heal03','heal04','heal05']){
    const item=byId[id],e=raid(5,id);
    assert(Medical.use(e,'bag'));
    const unit=Game.action.unit;
    assert.equal(unit.n,1);
    assert.equal(unit.cap,item.healCap);
    Game.updateAction(item.healStart-0.01);
    assert.equal(Game.player.hp,5,id+' 启动期间不该回血');
    assert.equal(unit.cap,item.healCap,id+' 启动期间不该扣容量');
    Game.updateAction(0.02);
    assert.equal(Game.action.phase,'active');
    const hp0=Game.player.hp;
    Game.updateAction(1);
    const healed=Game.player.hp-hp0;
    assert(near(healed,Math.min(item.healRate,item.healCap,100-hp0),1e-6),id+' 一秒回血应等于速率');
    assert(near(unit.cap,item.healCap-healed,1e-6),id+' 容量按实际回血扣');
  }
});

test('验收1：30HP 用 HV-300，0.8 秒后开始、约 3.6 秒满血、剩 330',()=>{
  const item=byId.heal05,e=raid(30,'heal05');
  assert(Medical.use(e,'bag'));
  const unit=Game.action.unit;
  Game.updateAction(item.healStart-0.01);
  assert.equal(Game.player.hp,30,'启动没走完不回血');
  Game.updateAction(0.02);
  assert.equal(Game.action&&Game.action.phase,'active','0.8 秒后进入持续阶段');
  const t=advance(5);
  assert(near(Game.player.hp,100),'应满血，实际 '+Game.player.hp);
  assert(near(t,2.8,0.06),'持续阶段约 2.8 秒，实际 '+t.toFixed(2));
  assert(near(unit.cap,330,0.6),'剩余容量应约 330，实际 '+unit.cap);
  assert.equal(Game.action,null,'满血自动结束');
  assert(Game.player.bag.slots.includes(unit),'没用完的医疗品留在背包');
});

test('验收2：80HP 用野战医疗包恢复到 100，剩 180',()=>{
  const e=raid(80,'heal04');
  assert(Medical.use(e,'bag'));
  advance(5);
  assert(near(Game.player.hp,100));
  const unit=Game.player.bag.slots.find(s=>s.item.id==='heal04');
  assert(near(unit.cap,180,0.4),'剩余容量 '+unit.cap);
});

test('验收3：主动取消保留已恢复 HP 与剩余容量',()=>{
  const item=byId.heal05,e=raid(30,'heal05');
  assert(Medical.use(e,'bag'));
  const unit=Game.action.unit;
  Game.updateAction(item.healStart);
  advance(1);                       // 恢复 25
  const hp=Game.player.hp,cap=unit.cap;
  assert(hp>30&&cap<400);
  Medical.cancel();
  assert.equal(Game.action,null);
  assert(near(Game.player.hp,hp),'已恢复的 HP 保留');
  assert(near(unit.cap,cap),'剩余容量保留');
  assert(Game.player.bag.slots.includes(unit),'物品还在');
});

test('验收4：启动阶段被打断不消耗容量',()=>{
  const item=byId.heal04,e=raid(40,'heal04');
  assert(Medical.use(e,'bag'));
  Game.updateAction(item.healStart*0.5);
  Medical.cancel();
  const unit=Game.player.bag.slots.find(s=>s.item.id==='heal04');
  assert.equal(unit.cap,200,'容量不该被扣');
  assert.equal(Game.player.hp,40,'HP 不该变');
});

test('验收5：容量归零后物品被移除',()=>{
  const e=raid(1,'heal01');       // 容量 20，缺口 99
  assert(Medical.use(e,'bag'));
  const unit=Game.action.unit;
  advance(6);
  assert.equal(Game.action,null);
  assert(near(Game.player.hp,21),'只恢复容量允许的量，实际 '+Game.player.hp);
  assert(!Game.player.bag.slots.includes(unit),'用完应从背包移除');
  for(const s of Game.player.bag.slots)assert.notEqual(s,unit);
});

test('受击不中断，冲刺/攻击/切枪/闪避/换弹/投掷/死亡会中断',()=>{
  /* 受击：继续治疗 */
  let e=raid(30,'heal05');assert(Medical.use(e,'bag'));
  Game.action.phase='active';Game.action.t=0;
  Game.player.hurt(1);
  assert(Game.action&&Game.action.type==='heal','普通受击不该打断');

  const stops=[()=>{Game.input.keys[' ']=true;Game.player.update(.016,{mx:1,my:0,sprint:true,aimAngle:0});},
    ()=>Game.player.tryShoot(),()=>Game.player.tryReload(),()=>Game.player.switchWeapon(1),
    ()=>Game.player.throwStone(),()=>Game.player.hurt(1000)];
  for(const stop of stops){
    e=raid(30,'heal05');assert(Medical.use(e,'bag'));
    stop();
    assert(!Game.action||Game.action.type!=='heal','该动作应打断治疗');
  }
});

test('验收6：部分使用的医疗品能存、能读、容量不丢',()=>{
  Base.open();
  Save.stash=[{id:'heal03',n:1,cap:45},{id:'heal02',n:2}];
  Save.save();Save.flush();Save.load();
  const partial=Save.stash.find(x=>x.id==='heal03');
  assert(partial&&near(partial.cap,45),'部分容量应保留，实际 '+(partial&&partial.cap));
  assert.equal(partial.n,1);
  assert.equal(Save.stashCount('heal02'),2);
});

test('老存档迁移：没写 cap 的一律按满容量，归零的丢掉',()=>{
  Base.open();
  Save.stash=[{id:'heal05',n:1},{id:'heal02',n:2},{id:'heal01',n:1,cap:0}];
  Save.save();Save.flush();Save.load();
  assert.equal(Save.stashCount('heal05'),1);
  assert.equal(Medical.entryCap(Save.stash.find(x=>x.id==='heal05')),400,'老条目按满容量初始化');
  assert.equal(Save.stashCount('heal01'),0,'归零条目应被清掉');
});

test('验收7：背包没空位时，堆叠拆分不丢东西也不改容量',()=>{
  const e=raid(5,'heal03');                 // 两件装，容量 120
  const ammo=byId.ammo;
  const fill=[];for(let i=0;i<CFG.BAG.SLOTS-1;i++)fill.push({item:ammo,n:1});
  Game.player.bag.slots=[e].concat(fill);
  assert.equal(Game.player.bag.slots.length,CFG.BAG.SLOTS);
  assert(!Medical.use(e,'bag'),'没有空位应该拒绝使用');
  assert.equal(e.n,2,'原堆不该被扣');
  assert.equal(e.cap,120,'容量不该变');
  assert.equal(Game.action,null);
  /* 腾出一格后可以正常用 */
  Game.player.bag.slots.pop();
  assert(Medical.use(e,'bag'));
  assert.equal(e.n,1);
  assert.equal(Game.player.bag.slots.length,CFG.BAG.SLOTS);
});

test('验收8：局外立即治疗并按实际回血扣容量',()=>{
  Base.open();Save.hp=85;Save.stash=[{id:'heal01',n:2}];
  const e=Save.stash[0];
  assert(Medical.use(e,'stash'));
  assert.equal(Save.hp,100,'局外应立即满血');
  const partial=Save.stash.find(x=>x.id==='heal01'&&x.cap!=null&&x.cap<20);
  assert(partial&&near(partial.cap,5),'应剩 5 容量，实际 '+(partial&&partial.cap));
  assert.equal(Save.stashCount('heal01'),2,'一件完整 + 一件残的');
  assert(!Medical.use(partial,'stash'),'满血不能再用药');
});

test('验收9：反复取消不会刷出额外容量',()=>{
  const e=raid(10,'heal03');
  const cap=()=>Game.player.bag.slots.reduce((s,x)=>s+Medical.entryCap(x)*x.n,0);
  const initial=cap();
  assert(initial>0);
  for(let i=0;i<10;i++){
    if(!Medical.use(e,'bag'))break;
    Game.updateAction(byId.heal03.healStart+0.3);   // 启动 + 0.3 秒
    Medical.cancel();
  }
  const left=cap();
  assert(left<=initial+1e-6,'剩余总容量 '+left+' 不该超过初始 '+initial);
  /* 没满血的前提下：回的血 + 剩的容量 = 初始容量，一点都不能多 */
  assert(Math.abs((Game.player.hp-10)+left-initial)<0.01,
    '回血 '+ (Game.player.hp-10) +' + 剩余 '+left+' 应等于 '+initial);
});

test('满血不能开始；读条/搜刮/闪避/换弹期间不能开始',()=>{
  let e=raid(100,'heal01');assert(!Medical.use(e,'bag'));
  e=raid(50,'heal01');Game.action={type:'extract'};assert(!Medical.use(e,'bag'));Game.action=null;
  Game.lootOpen={};assert(!Medical.use(e,'bag'));Game.lootOpen=null;
  Game.player.dodgeT=0.2;assert(!Medical.use(e,'bag'));Game.player.dodgeT=0;
  Game.player.reloadT=0.4;assert(!Medical.use(e,'bag'));Game.player.reloadT=0;
});

test('同一时间只允许一种治疗在跑',()=>{
  const e=raid(30,'heal01');
  assert(Medical.use(e,'bag'));
  const slot2={item:byId.heal02,n:1,cap:60};
  Game.player.bag.slots.push(slot2);
  assert(!Medical.use(slot2,'bag'),'已经在治疗时不能再开一个');
  assert.equal(Game.action.item.id,'heal01');
});

test('安全箱也能治疗；把物品拿走会中断且不重复结算',()=>{
  const e=raid(80,'heal01','safe');
  assert(Medical.use(e,'safe'));
  Game.bagOpen=true;Game.toggleBag();
  advance(5);
  assert(near(Game.player.hp,100));assert.equal(Game.action,null);

  const e2=raid(5,'heal01');
  assert(Medical.use(e2,'bag'));
  Game.player.bag.slots=[];
  Game.updateAction(2);Game.updateAction(2);
  assert.equal(Game.player.hp,5,'物品被移走就不该继续回血');
});

test('预留医疗品不可用，也不进入掉落池',()=>{
  for(const item of ITEMS.filter(i=>i.cat==='medical'&&!i.healCap)){
    const e=raid(5,item.id);assert(!Medical.use(e,'bag'));assert.equal(e.n,Math.min(2,item.stack||1));
  }
  for(const kind of ['junk','plain','ample','fine','rich','secret'])
    for(let n=0;n<3000;n++){const d=Loot.roll(kind,['medical']);assert(!d.item.noLoot);}
});

test('旧med01与heal01合并、旧存档满血、迁移幂等',()=>{
  c.localStorage.setItem(Save.key,JSON.stringify({v:2,credits:888,stash:[{id:'med01',n:2},{id:'heal01',n:3},{id:'med02',n:1}],loadout:{ammo:60,bandage:3,stone:3},gear:{weapons:['rifle','shotgun','pistol']},codex:{med01:{count:2}}}));
  Save.load();assert.equal(Save.hp,100);assert.equal(Save.stashCount('heal01'),5);assert.equal(Save.stashCount('med02'),1);
  assert.equal(Save.credits,888);assert(Save.codex.med01);
  Save.save();Save.flush();Save.load();assert.equal(Save.stashCount('heal01'),5);assert.equal(Save.loadout.bandage,3);
  Save.setHP(37.5);Save.load();assert.equal(Save.hp,37.5);
});

test('诊费示例、全区间贵于绷带、余额不足与重复治疗不扣钱',()=>{
  for(const [d,p]of [[20,3000],[50,7500],[99,12500]])assert.equal(Medical.quote(100-d).total,p);
  for(let d=1;d<=100;d++)assert(Medical.quote(100-d).total>Math.ceil(d/20)*2000);
  assert.equal(Medical.quote(100).total,0);
  Base.open();Save.hp=1;Save.credits=12499;assert(!Base.treat(12500));assert.equal(Save.credits,12499);
  Save.credits=20000;assert(!Base.treat(3000));assert(Base.treat(12500));
  assert.equal(Save.hp,100);assert.equal(Save.credits,7500);
  assert(!Base.treat(12500));assert.equal(Save.credits,7500);
});

test('医生白绿蓝10件、购买单件与金额、高级品拒售',()=>{
  Base.open();Save.credits=1000000;Save.stash=[];const stock=ITEMS.filter(i=>i.cat==='medical'&&i.r<=3);
  assert.equal(stock.length,10);
  for(const it of stock){const old=Save.credits;assert(Base.buyMedical(it.id));assert.equal(Save.stashCount(it.id),1);assert.equal(Save.credits,old-it.price);}
  const credits=Save.credits;assert(!Base.buyMedical('heal04'));assert.equal(Save.credits,credits);
});

test('携带只算满容量；残的留仓库，库存不足会拦下',()=>{
  Base.open();Save.credits=100000;
  Save.stash=[{id:'heal02',n:1},{id:'heal02',n:1,cap:15}];
  Save.loadout={ammo:0,bandage:0,stone:0,medical:{heal02:1}};
  assert.equal(Save.fullCount('heal02'),1,'满容量只有一件');
  assert.equal(Save.stashCount('heal02'),2);
  assert(Base.previewCarry().ok);
  /* 想带两件但只有一件是满的 → 拦下 */
  Save.loadout.medical.heal02=2;
  assert(!Base.previewCarry().ok);
  Save.loadout.medical.heal02=1;
  Base.deploy();
  assert.equal(Game.state,'playing');
  const carried=Game.player.bag.slots.find(e=>e.item.id==='heal02');
  assert.equal(carried.n,1);
  assert.equal(carried.cap,60,'带下场的是满的那件');
  assert.equal(Save.stashCount('heal02'),1,'残的那件留在仓库');
});

test('撤离把残容量带回仓库；死亡只保安全箱',()=>{
  raid(43,'heal03');
  const unit=Game.player.bag.slots[0];
  unit.cap=50;unit.n=1;
  Game.showEnd(true);
  const back=Save.stash.find(x=>x.id==='heal03');
  assert(back&&near(back.cap,50),'撤离后残容量应保留，实际 '+(back&&back.cap));
});

test('寻常清仓保留医疗及弹药',()=>{
  Save.stash=[{id:'heal01',n:2},{id:'heal06',n:1},{id:'ammo',n:20},{id:'life01',n:1}];
  Base.sellJunk();
  assert.equal(Save.stashCount('heal01'),2);assert.equal(Save.stashCount('heal06'),1);
  assert.equal(Save.stashCount('ammo'),20);assert.equal(Save.stashCount('life01'),0);
});

console.log('通过 '+checks+' 组医疗系统检查');
