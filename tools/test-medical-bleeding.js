/* Real medical state machine: stop bleeding for 50 capacity, then continue healing. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),h=fs.readFileSync(path.join(root,'run-test.js'),'utf8').split('let pass = 0')[0],c=new Function('require','__dirname',h+'\nreturn ctx;')(require,root);
const {Game,Save,Base,CFG}=c,{Medical:M,Debuff:D,ITEM_BY_ID:I,MedQuick,HealHud}=vm.runInContext('({Medical,Debuff,ITEM_BY_ID,MedQuick,HealHud})',c);
Game.init();let passed=0;const failures=[];function test(name,fn){try{fn();passed++;console.log('OK: '+name);}catch(e){failures.push({name,error:e.stack});process.exitCode=1;console.error('FAIL '+name+'\n'+e.stack);}}
function fresh(hp=40,id='heal03',cap,where='bag'){
 Save.hp=hp;Game.startRun(null);Game.enemies=[];Game.bullets=[];Game.lootOpen=null;Game.action=null;Game.bagOpen=false;Game.input.keys={};Game.input.mouseDown=Game.input.mousePressed=false;
 const p=Game.player;p.hp=hp;p.reloadT=p.dodgeT=0;p.debuffs=D.fresh();p.debuffs.bleeding=true;p.bag.slots=[];p.bag.safe=[];const item=I[id],e={item,n:1,cap:cap??M.capOf(item)};(where==='safe'?p.bag.safe:p.bag.slots).push(e);return {p,e,item};
}
const tick=t=>Game.updateAction(t),near=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('four recovery products read their own start time, spend exactly 50 once, then heal at the original rate',()=>{
 for(const id of ['heal02','heal03','heal04','heal05']){const {p,e,item}=fresh(20,id);assert(M.use(e,'bag'));assert.equal(Game.action.phase,'stopBleed');tick(item.healStart-.01);assert(p.debuffs.bleeding);near(e.cap,item.healCap);near(p.hp,20);tick(.01);assert(!p.debuffs.bleeding);near(e.cap,item.healCap-50);near(p.hp,20);assert.equal(Game.action.phase,'active');tick(.25);near(p.hp,20+Math.min(item.healCap-50,item.healRate*.25));near(e.cap,Math.max(0,item.healCap-50-item.healRate*.25));}
});
test('20-capacity bandage and partial kits below 50 still heal without clearing bleeding',()=>{
 for(const [id,cap]of [['heal01',20],['heal03',49],['heal04',49.99]]){const {p,e,item}=fresh(20,id,cap);assert(M.use(e,'bag'));assert.equal(Game.action.phase,'start');tick(item.healStart);tick(.5);near(p.hp,20+item.healRate*.5);near(e.cap,cap-item.healRate*.5);assert(p.debuffs.bleeding);assert(M.actionLabel(item,'bag',p.hp,e).includes('无法止血'));}
});
test('capacity exactly 50 stops bleeding without HP gain and removes the empty item from bag or safe',()=>{
 for(const where of ['bag','safe']){const {p,e,item}=fresh(40,'heal03',50,where);assert(M.use(e,where));tick(item.healStart);assert(!p.debuffs.bleeding);near(p.hp,40);near(e.cap,0);assert(!M.entries(where).includes(e));assert.equal(Game.action,null);}
});
test('full health or severe recoverable cap can still stop bleeding; insufficient capacity cannot act there',()=>{
 for(const severe of [0,2]){const {p,e,item}=fresh();p.debuffs.severe=severe;p.hp=D.recoverableMax(p);const hp=p.hp;assert(M.canUse(item,'bag',hp,e));assert(M.use(e,'bag'));tick(item.healStart);assert(!p.debuffs.bleeding);near(e.cap,70);near(p.hp,hp);assert.equal(Game.action,null);p.debuffs.bleeding=true;e.cap=49;assert(!M.canUse(item,'bag',hp,e));assert(!M.use(e,'bag'));near(e.cap,49);}
});
test('cancel before completion preserves bleeding and all 50 capacity; cancel after completion keeps the completed treatment',()=>{
 let {p,e,item}=fresh();assert(M.use(e,'bag'));tick(item.healStart/2);M.cancel();assert(p.debuffs.bleeding);near(e.cap,120);
 assert(M.use(e,'bag'));tick(item.healStart);M.cancel();assert(!p.debuffs.bleeding);near(e.cap,70);near(p.hp,40);p.hp=30;assert(M.use(e,'bag'));tick(item.healStart);near(e.cap,70);tick(.1);near(e.cap,68.5);
});
test('external cure or lost capacity during the read does not charge an invalid bleeding treatment',()=>{
 let {p,e,item}=fresh();assert(M.use(e,'bag'));tick(.5);D.cure(p,'bleeding');tick(item.healStart);near(e.cap,120);assert.equal(Game.action.phase,'active');
 ({p,e,item}=fresh());assert(M.use(e,'bag'));e.cap=49;tick(item.healStart);assert(p.debuffs.bleeding);near(e.cap,49);tick(.1);near(e.cap,47.5);
});
test('new bleeding during active healing pauses HP gain for a new read and each distinct bleeding event costs 50',()=>{
 const {p,e,item}=fresh(10,'heal05');p.debuffs.bleeding=false;assert(M.use(e,'bag'));tick(item.healStart);tick(.2);const cap=e.cap,hp=p.hp;p.debuffs.bleeding=true;tick(.1);assert.equal(Game.action.phase,'stopBleed');near(e.cap,cap);near(p.hp,hp);tick(item.healStart-.1);near(e.cap,cap-50);assert(!p.debuffs.bleeding);p.debuffs.bleeding=true;tick(item.healStart);near(e.cap,cap-100);assert(!p.debuffs.bleeding);
});
test('quick use chooses a same-type kit with enough capacity; HUD clearly shows stop-bleeding time and cost',()=>{
 const {p,e}=fresh(100,'heal03',30),full={item:I.heal03,n:1,cap:120};p.bag.slots.push(full);MedQuick.typeId='heal03';assert.equal(MedQuick.pick().entry,full);assert(MedQuick.use());assert.equal(Game.action.unit,full);const state=HealHud.state();assert(state.show&&state.start&&state.top.includes('止血')&&state.top.includes('50容量'));tick(.3);assert(HealHud.state().pct>0);near(e.cap,30);M.cancel();
 p.hp=40;p.bag.slots=[e];assert.equal(MedQuick.pick().entry,e);assert(MedQuick.use());assert.equal(Game.action.phase,'start');
});
test('completed treatment keeps partial capacity through extraction and save/load',()=>{
 const {p,e,item}=fresh();assert(M.use(e,'bag'));tick(item.healStart);tick(1);near(e.cap,55);M.cancel();Game.showEnd(true);Save.save();Save.flush();Save.load();const saved=Save.bag.find(x=>x.id===item.id);assert(saved);near(saved.cap,55);assert(!p.debuffs.bleeding);
});
test('stash healing still consumes HP capacity only, with no bleeding surcharge',()=>{
 fresh();const render=Base.render;Base.render=()=>{};try{Game.state='base';Save.hp=70;Save.stash=[{id:'heal03',n:1,cap:120}];assert(M.use(Save.stash[0],'stash'));near(Save.hp,100);near(Save.stash[0].cap,90);}finally{Base.render=render;}
});
const out=path.join(root,'design/items/healing-bleed-v1');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({passed,failures,cost:CFG.DEBUFF.BLEED.HEAL_CAP_COST},null,2)+'\n');console.log(`Medical bleeding: ${passed} groups passed, ${failures.length} failed`);
