const fs=require('fs'),path=require('path'),vm=require('vm');const root=path.resolve(__dirname,'..'),h=fs.readFileSync(path.join(root,'run-test.js'),'utf8').split('let pass = 0')[0],c=new Function('require','__dirname',h+'\nreturn ctx;')(require,root);
const {Game,Player,Enemy,GEAR,WEAPONS,CFG,M,Noise,Corpse,EQUIP}=c,{ITEM_BY_ID,HumanAI}=vm.runInContext('({ITEM_BY_ID,HumanAI})',c),random=c.Math.random;const rows=[];
function seed(n){let x=n;c.Math.random=()=>{x=(x*1664525+1013904223)>>>0;return x/4294967296;};}
try{for(const type of ['holdout','retriever','pair'])for(const mode of ['stand','strafe'])for(let trial=1;trial<=30;trial++){
 seed(trial);Game.init();M.load(Array(40).fill('.'.repeat(50)),null,[],null);M.tideEnabled=false;c.Quiet.clear();Game.enemies=[];Game.bullets=[];Game.particles=[];Game.toasts=[];Game.state='playing';Game.time=0;Noise.clear();
 const p=new Player(500,500);Game.player=p;p.weapons=[{...WEAPONS.rifle,magCur:30,ammo:'ammo_556_2',rounds:Array(30).fill('ammo_556_2')},null,null];p.slot=0;p.mag=30;p.helmet=GEAR.make('helmet',2);p.body=GEAR.make('body',2);p.bag.slots=[{item:ITEM_BY_ID.ammo_556_2,n:60}];
 const kind=type==='pair'?'retriever':type;const a=new Enemy(kind,650,500,0,{id:'a',facing:'w',squadId:type==='pair'?'pair':''});Game.enemies.push(a);if(type==='pair')Game.enemies.push(new Enemy(kind,680,600,0,{id:'b',facing:'w',squadId:'pair'}));
 let elapsed=0,firstEnemyShot=null,playerShots=0;
 for(let i=0;i<60*20&&!p.dead&&Game.enemies.some(e=>!e.dead);i++){
  elapsed=(i+1)/60;Game.time=elapsed;const target=Game.enemies.find(e=>!e.dead),dy=mode==='strafe'?(Math.floor(elapsed/.8)%2?1:-1):0;
  p.update(1/60,{mx:0,my:dy,sneak:false,sprint:false,dodge:false,aimAngle:Math.atan2(target.y-p.y,target.x-p.x)});
  if(p.mag===0&&p.reloadT<=0)p.tryReload();if(p.tryShoot())playerShots++;
  for(const e of Game.enemies)if(!e.dead)e.update(1/60);for(const b of Game.bullets)b.update(1/60);Game.bullets=Game.bullets.filter(b=>!b.dead);
  if(firstEnemyShot===null&&Game.enemies.some(e=>e.ai.shots>0))firstEnemyShot=elapsed;
  Noise.tick(1/60);Game.particles=[];Game.toasts=[];
 }
 const loot=Game.enemies.filter(e=>e.dead).map(e=>new Corpse(e.x,e.y,e));let resale=0;for(const corpse of loot)for(const entry of corpse.loot){if(entry.gear)resale+=EQUIP.armor(entry.gear).sell;else if(entry.gun)resale+=Game.corpseGun(entry).sell;else if(entry.item)resale+=entry.item.price*(entry.n||1);}
 rows.push({type,mode,trial,seconds:+elapsed.toFixed(3),firstEnemyShot,playerShots,playerSurvived:!p.dead,playerHP:+p.hp.toFixed(2),kills:Game.enemies.filter(e=>e.dead).length,npcShots:Game.enemies.reduce((n,e)=>n+e.ai.shots,0),remainingAmmo:Game.enemies.reduce((n,e)=>n+e.ai.mag+e.ai.reserve,0),potentialResale:resale});
}}finally{c.Math.random=random;}
const q=(a,key,p)=>{const n=a.map(r=>r[key]).filter(x=>x!==null).sort((a,b)=>a-b);return n.length?+n[Math.floor((n.length-1)*p)].toFixed(3):null;};const summary=[];
for(const type of ['holdout','retriever','pair'])for(const mode of ['stand','strafe']){const a=rows.filter(r=>r.type===type&&r.mode===mode);summary.push({type,mode,n:a.length,win:a.filter(r=>r.playerSurvived&&r.kills===(type==='pair'?2:1)).length,playerDeaths:a.filter(r=>!r.playerSurvived).length,timeMedian:q(a,'seconds',.5),timeP90:q(a,'seconds',.9),firstEnemyShotMedian:q(a,'firstEnemyShot',.5),playerHPMedian:q(a,'playerHP',.5),resaleMedian:q(a,'potentialResale',.5)});}
fs.writeFileSync(path.join(root,'design/enemies/human-units-v1/combat-probe.json'),JSON.stringify({kind:'controlled_engine_probe',method:'180 trials, 30 seeds per unit/mode, 60FPS 20s open arena. Player rifle and tierII gear/ammo, stand or alternate strafing; real AI, projectiles and damage. Not manual map balance or a promise of TTK on all maps.',summary,rows},null,2)+'\n');console.table(summary);
