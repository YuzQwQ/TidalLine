/* 损伤状态 / 医疗效果的无头验收：跑真实运行逻辑，复用 run-test 的浏览器 mock。
   node tools/test-debuff.js */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const harness=fs.readFileSync(path.join(root,'run-test.js'),'utf8').split('let pass = 0')[0];
const c=new Function('require','__dirname',harness+'\nreturn ctx;')(require,root);
const {Game,Save,CFG,ITEMS}=c;
const {Debuff,DebuffHud,Medical,ITEM_BY_ID,ENEMY_TYPES,Enemy,Loot,MeleeGeometry}=vm.runInContext(
  '({Debuff,DebuffHud,Medical,ITEM_BY_ID,ENEMY_TYPES,Enemy,Loot,MeleeGeometry})',c);
Game.init();
let checks=0;function test(name,fn){fn();checks++;console.log('OK: '+name);}
const near=(a,b,eps=1e-6)=>Math.abs(a-b)<=eps;

/* 每局重开，状态与背包都干净 */
function fresh(){
  Save.hp=100;
  Game.startRun({ammo:0,bandage:0,stone:0});
  Game.enemies=[];Game.bullets=[];Game.time=0;Game.state='playing';
  Game.action=null;Game.lootOpen=null;Game.bagOpen=false;
  const P=Game.player;
  P.hp=100;P.dead=false;P.dodgeT=0;P.dodgeCd=0;P.reloadT=0;
  P.stamina=P.maxStamina;
  P.debuffs=Debuff.fresh();
  return P;
}
/* 定向元数据：chance=1 保证命中，单键权重保证损伤类型确定 */
function meta(type,chance,weights){
  return {attackId:Debuff.nextAttackId(),injuryType:type||'bullet',
          injuryChance:chance==null?1:chance,
          injuryWeights:weights||{bleeding:1}};
}
function bag(id,cap){
  const item=ITEM_BY_ID[id];
  const entry={item,n:1,cap:cap==null?(item.healCap||item.effect.uses):cap};
  Game.player.bag.slots=[entry];
  Game.player.bag.safe=[];
  return entry;
}
function finishAction(sec=12){
  let t=0;
  while(Game.action&&Game.action.type==='heal'&&t<sec-1e-9){
    const dt=Math.min(0.05,sec-t);
    Game.updateAction(dt);t+=dt;
  }
  return t;
}

/* ---------- 1. 配置与数据 ---------- */
test('CFG.DEBUFF 数值与攻击类型权重齐备',()=>{
  const D=CFG.DEBUFF;
  assert.equal(D.SEVERE.MAX_LAYERS,4);
  assert.equal(D.SEVERE.PER_LAYER,0.15);
  assert.equal(D.SEVERE.TRUNCATE_ENEMIES,false);
  assert.equal(D.BLEED.MIN_HP,1);
  assert.equal(D.ANALGESIC.WATER_MULT,1);
  assert.equal(Array.from(D.INTERRUPT_ON_HIT).join(','),'surgery');
  for(const k of ['bullet','shotgun','sharp','blunt','heavy']){
    const a=D.ATTACK_TYPES[k];
    assert(a&&a.chance>0&&a.chance<1,k+' 致残率');
    assert(a.weights.bleeding>0||a.weights.severe>0||a.weights.fracture>0,k+' 权重');
  }
  for(const id of ['heal06','heal07','heal08','heal09','heal10','heal12']){
    const it=ITEM_BY_ID[id];
    assert(it.effect,id+' 有 effect');
    assert(Medical.ready(it),id+' 可用');
    assert(!it.noLoot,id+' 进掉落池');
  }
  const reserved=ITEMS.filter(i=>i.cat==='medical'&&!i.healCap&&!i.effect);
  assert.equal(reserved.length,7,'仍有 7 件效果待开放');
  for(const it of reserved){assert(!Medical.ready(it));assert(it.noLoot);}
  let dropped=false;
  for(let i=0;i<4000&&!dropped;i++){
    const d=Loot.roll('rich',['medical']);
    if(d&&['heal06','heal07','heal08','heal09','heal10','heal12'].includes(d.item.id))dropped=true;
  }
  assert(dropped,'效果品确实能被容器抽出来');
  assert.equal(ENEMY_TYPES.scav.human,true);
  assert.equal(ENEMY_TYPES.holdout.human,true);
  assert.equal(ENEMY_TYPES.retriever.human,true);
  assert(!ENEMY_TYPES.guard.human);
  assert(!ENEMY_TYPES.echo.human);
});

/* ---------- 2. 唯一致伤入口与去重 ---------- */
test('霰弹 6 弹丸同一 attackId 只判一次',()=>{
  const P=fresh(),m=meta('shotgun',1,{bleeding:1});
  for(let i=0;i<6;i++)Debuff.onHit(P,{dealt:5,meta:m,now:Game.time});
  assert.equal(P.debuffs.bleeding,true);
  assert(near(P.debuffs._judgeReadyAt,CFG.DEBUFF.INJURY_JUDGE_CD),'判定只推进了一次节流时钟');
});
test('高射速连打受每目标致伤冷却压制',()=>{
  const P=fresh();let hits=0;
  for(let i=0;i<60;i++){
    Game.time=i/60;
    const before=P.debuffs.severe;
    Debuff.onHit(P,{dealt:5,meta:meta('bullet',1,{severe:1}),now:Game.time});
    if(P.debuffs.severe>before)hits++;
  }
  assert(hits<=3,'1 秒内最多约 2~3 次判定，实际 '+hits);
  assert(hits>=1);
});
test('零伤害 / 微小蹭伤 / 无 meta 都不触发致残',()=>{
  const P=fresh();
  Debuff.onHit(P,{dealt:0,meta:meta(),now:0});
  Debuff.onHit(P,{dealt:0.3,meta:meta(),now:0});
  Debuff.onHit(P,{dealt:5,meta:null,now:0});
  assert.equal(P.debuffs.bleeding,false);
  assert.equal(P.debuffs._judgeReadyAt,0,'没进入判定就不该锁冷却');
  Debuff.onHit(P,{dealt:0.6,meta:meta('bullet',1,{bleeding:1}),now:0});
  assert.equal(P.debuffs.bleeding,true,'现有护甲最低蹭伤 0.6 仍能判');
});
test('一次挥砍命中多目标：按 (attackId, 目标) 各判一次',()=>{
  const P=fresh();
  const a=new Enemy('scav',P.x+40,P.y),b=new Enemy('scav',P.x+80,P.y);
  Game.enemies=[a,b];
  const m=meta('sharp',1,{bleeding:1});
  Debuff.onHit(a,{dealt:5,meta:m,now:0});
  Debuff.onHit(b,{dealt:5,meta:m,now:0});
  assert(a.debuffs.bleeding&&b.debuffs.bleeding);
  assert.equal(P.debuffs.bleeding,false,'玩家没挨打');
});
test('只有人形敌人吃状态；机械/异常体免疫',()=>{
  const P=fresh();
  const e=new Enemy('scav',P.x+50,P.y);
  const g=new Enemy('guard',P.x+70,P.y);
  const x=new Enemy('echo',P.x+90,P.y);
  assert(e.debuffs,'scav 有状态对象');
  assert.equal(g.debuffs,undefined,'潮汐守卫免疫');
  assert.equal(x.debuffs,undefined,'回响体免疫');
  const hp0=x.hp;
  Debuff.onHit(x,{dealt:9,meta:meta(),now:0});
  assert.equal(x.hp,hp0);
  e.debuffs.fracture=true;
  assert(near(Debuff.moveMult(e),CFG.DEBUFF.PAIN.MOVE_MULT),'人形敌人骨折会减速');
  assert.equal(Debuff.moveMult(g),1,'机械体不受减速');
});

/* ---------- 3. 状态叠加与生命周期 ---------- */
test('流血/骨折不叠层，重伤每次 +1 且封顶 4 层',()=>{
  const P=fresh();
  assert.equal(Debuff.apply(P,'bleeding'),'bleeding');
  assert.equal(Debuff.apply(P,'bleeding'),null,'重复触发不新增同类实例');
  assert.equal(Debuff.apply(P,'fracture'),'fracture');
  assert.equal(Debuff.apply(P,'fracture'),null);
  for(let i=0;i<6;i++)Debuff.apply(P,'severe');
  assert.equal(P.debuffs.severe,4);
  assert(near(Debuff.recoverableMax(P),40));
  assert.equal(P.debuffs.bleeding,true);
  assert.equal(P.debuffs.fracture,true);
});
test('重伤截断当前 HP 但不额外扣血、不致死',()=>{
  const P=fresh();P.hp=100;
  Debuff.apply(P,'severe');assert(near(P.hp,85));
  Debuff.apply(P,'severe');assert(near(P.hp,70));
  Debuff.apply(P,'severe');assert(near(P.hp,55));
  Debuff.apply(P,'severe');assert(near(P.hp,40));
  assert.equal(P.dead,false);assert(Save.hp>=1);
  const Q=fresh();Q.hp=3;
  Debuff.apply(Q,'severe');
  assert.equal(Q.hp,3,'当前 HP 低于新上限时不该再掉血');
});
test('流血按帧掉血、最低保留 1 HP，人形敌人一致',()=>{
  const P=fresh();P.hp=2;P.debuffs.bleeding=true;
  const e=new Enemy('scav',P.x+50,P.y);e.hp=2;e.debuffs.bleeding=true;
  Game.enemies=[e];
  Debuff.tickAll(10);
  assert.equal(P.hp,1);assert.equal(e.hp,1);
  assert.equal(P.dead,false);assert.equal(Save.hp,1);
  assert.equal(P.debuffs._judgeReadyAt,0,'DoT 不触发致残判定');
});
test('镇痛取较长者、到期后惩罚恢复',()=>{
  const P=fresh();P.debuffs.severe=1;
  assert.equal(Debuff.penaltyOn(P),true);
  assert(near(Debuff.moveMult(P),0.78));
  assert(near(Debuff.dodgeDistMult(P),0.75));
  assert(near(Debuff.dodgeCdMult(P),1.35));
  assert(near(Debuff.spreadAdd(P),CFG.DEBUFF.PAIN.SPREAD_ADD));
  Debuff.applyAnalgesic(P,90);
  assert.equal(Debuff.analgesicActive(P),true);
  assert.equal(Debuff.penaltyOn(P),false);
  assert.equal(Debuff.moveMult(P),1);
  assert.equal(Debuff.spreadAdd(P),0);
  Debuff.applyAnalgesic(P,180);
  assert.equal(Debuff.analgesicLeft(P),180);
  Debuff.applyAnalgesic(P,90);
  assert.equal(Debuff.analgesicLeft(P),180,'低级药不缩短已有药效');
  Game.time=181;
  assert.equal(Debuff.analgesicActive(P),false);
  assert.equal(Debuff.penaltyOn(P),true,'药效结束后未治愈的损伤重新产生惩罚');
});
test('骨折翻滚掉血不受镇痛免除，操作惩罚却被屏蔽',()=>{
  const P=fresh();P.hp=50;P.debuffs.fracture=true;
  Debuff.applyAnalgesic(P,300);
  const ready=P.debuffs._judgeReadyAt;
  Debuff.onRoll(P);
  assert.equal(P.hp,50-CFG.DEBUFF.FRACTURE.ROLL_DMG);
  assert.equal(P.debuffs._judgeReadyAt,ready,'自伤不走 onHit');
  assert.equal(Debuff.dodgeCdMult(P),1,'镇痛屏蔽了冷却惩罚');
  assert.equal(P.debuffs.fracture,true,'镇痛不治愈骨折');
});
test('showEnd / beginDying / startRun 都清掉局内状态',()=>{
  const P=fresh();
  P.debuffs.bleeding=true;P.debuffs.severe=2;P.debuffs.fracture=true;
  Debuff.applyAnalgesic(P,90);
  Game.showEnd(true);
  assert.equal(P.debuffs.bleeding,false);
  assert.equal(P.debuffs.severe,0);
  assert(near(Debuff.recoverableMax(P),100));
  const Q=fresh();Q.debuffs.bleeding=true;
  Game.beginDying();
  assert.equal(Q.debuffs.bleeding,false);
  const R=fresh();
  assert.equal(R.debuffs.bleeding,false,'新局天然重建状态');
  assert(!JSON.stringify(c.localStorage.getItem(Save.key)).includes('debuffs'),'不写跨局存档');
});

/* ---------- 4. 医疗物品分工 ---------- */
test('手术二选一且不回血；无适用损伤时不可用',()=>{
  const P=fresh();P.hp=50;P.debuffs.severe=2;P.debuffs.fracture=true;
  assert.equal(Debuff.surgery(P),'severe');
  assert.equal(P.debuffs.severe,1);
  assert.equal(P.debuffs.fracture,true);
  assert(near(P.hp,50));
  P.debuffs.severe=0;
  assert.equal(Debuff.surgery(P),'fracture');
  assert.equal(P.debuffs.fracture,false);
  assert(near(P.hp,50));
  assert.equal(Debuff.surgery(P),null);
  assert.equal(Debuff.surgeryAvailable(P),false);
  const e=bag('heal12',2);
  assert.equal(Medical.canUse(ITEM_BY_ID.heal12,'bag',P.hp),false);
  assert.equal(Medical.use(e,'bag'),false);
});
test('止血带直接解流血；不足50容量的绷带仍可回血但不止血',()=>{
  const P=fresh();P.debuffs.bleeding=true;
  for(const id of ['heal01','heal02','heal03','heal04','heal05']){
    assert(!ITEM_BY_ID[id].effect,id+' 恢复品沿用容量规则');
  }
  P.hp=60;
  const band=bag('heal01',20);
  assert(Medical.use(band,'bag'));
  finishAction(12);
  assert(P.debuffs.bleeding,'绷带不该解除流血');
  const tq=bag('heal09',1);
  assert(Medical.canUse(ITEM_BY_ID.heal09,'bag',P.hp));
  assert(Medical.use(tq,'bag'));
  finishAction(4);
  assert.equal(P.debuffs.bleeding,false);
  assert.equal(tq.cap,0,'止血带扣掉一次');
});
test('夹板解骨折；手术包有重伤时优先治重伤',()=>{
  const P=fresh();P.debuffs.fracture=true;
  const sp=bag('heal10',1);
  assert(Medical.use(sp,'bag'));finishAction(4);
  assert.equal(P.debuffs.fracture,false);
  P.debuffs.severe=1;P.debuffs.fracture=true;
  const kit=bag('heal12',2);
  assert(Medical.use(kit,'bag'));finishAction(10);
  assert.equal(P.debuffs.severe,0);
  assert.equal(P.debuffs.fracture,true,'还有重伤时手术不碰骨折');
  assert.equal(kit.cap,1,'一件手术包用掉一次');
});
test('止痛药可满血提前服；镇痛不治愈损伤也不恢复上限',()=>{
  const P=fresh();P.hp=100;
  P.debuffs.bleeding=true;P.debuffs.severe=2;P.debuffs.fracture=true;
  const cap0=Debuff.recoverableMax(P);
  const pill=bag('heal06',1);
  assert.equal(Medical.canUse(ITEM_BY_ID.heal06,'bag',100),true);
  assert(Medical.use(pill,'bag'));
  finishAction(2);
  assert.equal(Debuff.analgesicActive(P),true);
  assert.equal(P.debuffs.bleeding,true);
  assert.equal(P.debuffs.severe,2);
  assert(near(Debuff.recoverableMax(P),cap0));
  assert(near(P.hp,100),'镇痛不回血');
});
test('普通治疗只回到可恢复上限，满了就不让再用',()=>{
  const P=fresh();P.hp=50;P.debuffs.severe=2;   // 上限 70
  const e=bag('heal03',120);
  assert(Medical.use(e,'bag'));
  finishAction(20);
  assert(near(P.hp,70));
  assert.equal(Medical.canUse(ITEM_BY_ID.heal03,'bag',P.hp),false);
  assert.equal(Medical.use(e,'bag'),false);
});
test('效果品在局外明确禁用；残次数能存档',()=>{
  const P=fresh();
  const item=ITEM_BY_ID.heal12;
  assert.equal(Medical.canUse(item,'stash'),false);
  assert.equal(Medical.actionLabel(item,'stash'),'只能在行动中使用');
  Game.state='base';
  const e=bag('heal12',1);
  Save.stash=[{id:'heal12',n:1,cap:1}];
  Save.save();Save.flush();Save.load();
  assert.equal(Save.stash.find(x=>x.id==='heal12').cap,1,'残次数跨存档保留');
  assert.equal(Medical.use(Save.stash.find(x=>x.id==='heal12'),'stash'),false);
  Game.state='playing';
});
test('手术受击打断，其它医疗动作沿用不打断',()=>{
  const P=fresh();P.debuffs.severe=1;
  const kit=bag('heal12',2);
  assert(Medical.use(kit,'bag'));
  assert.equal(Game.action.kind,'surgery');
  assert.equal(Game.action.interruptOnHit,true);
  P.hurt(5,'body',0);
  assert.equal(Game.action,null,'手术被受击打断');
  const pill=bag('heal06',1);
  assert(Medical.use(pill,'bag'));
  assert.equal(Game.action.interruptOnHit,false);
  P.hurt(5,'body',0);
  assert(Game.action,'镇痛不因受击中断');
});

/* ---------- 5. HUD ---------- */
test('DebuffHud 输出五类 chip 并随状态变化',()=>{
  const P=fresh();
  DebuffHud.refresh();
  const box=c.document.getElementById('debuffBar');
  assert.equal(box.style.display,'none','无状态时不显示');
  P.debuffs.bleeding=true;P.debuffs.severe=2;P.debuffs.fracture=true;
  Debuff.applyAnalgesic(P,90);
  DebuffHud.refresh();
  assert.equal(box.style.display,'flex');
  const sig=box.innerHTML;
  assert(/db-bleed/.test(sig)&&/db-severe/.test(sig)&&/db-fract/.test(sig),'三种损伤图标');
  assert(/db-pain/.test(sig)&&/db-analg/.test(sig),'疼痛与镇痛提示');
  assert(/上限 70%/.test(sig),'可恢复上限直观表现');
  DebuffHud.hide();
  assert.equal(box.style.display,'none');
});

console.log('\n通过 '+checks+' 组损伤/医疗系统检查');
