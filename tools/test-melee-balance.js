/* Reproducible open-ground probes. Reports observations, never changes game balance. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),h=fs.readFileSync(path.join(root,'run-test.js'),'utf8').split('let pass = 0')[0];
const c=new Function('require','__dirname',h+'\nreturn ctx;')(require,root);
const {Game,Save,CFG}=c,{M,Enemy,EQUIP,MELEE,MeleeSystem:S}=vm.runInContext('({M,Enemy,EQUIP,MELEE,MeleeSystem})',c);
Game.init();const results=[];
for(const d of MELEE)for(const mode of ['stationary','backpedal','circle','group']){
  Save.hp=CFG.P.HP;Save.gear.melee=EQUIP.melee(d.id);Save.bag=[];Game.startRun(null);
  M.load(Array(40).fill('.'.repeat(40)),null,[],null);M.tideEnabled=false;
  const p=Game.player;p.x=p.y=640;p.bag.slots=[];p.helmet=p.body=null;p.switchMelee();
  const enemies=Array.from({length:mode==='group'?3:1},(_,i)=>{const e=new Enemy('echo',640+24,640+i*9);e.state='chase';e.target={kind:'player'};e.canSee=()=>true;return e;});
  Game.enemies=enemies;const hp=p.hp;let starts=0,t=0;
  for(;t<8&&!p.dead&&enemies.some(e=>!e.dead);t+=1/120){
    Game.time=t;const e=enemies.find(e=>!e.dead),dx=e.x-p.x,dy=e.y-p.y,dist=Math.hypot(dx,dy)||1;
    let mx=0,my=0;
    if(mode==='backpedal'&&dist<d.radius*CFG.TILE+6){mx=-dx/dist;my=-dy/dist;}
    if(mode==='circle'){mx=-dy/dist;my=dx/dist;}
    p.update(1/120,{mx,my,sneak:false,sprint:false,dodge:false,aimAngle:Math.atan2(dy,dx)});
    if(S.attack(p))starts++;for(const enemy of enemies)if(!enemy.dead)enemy.update(1/120);
  }
  results.push({weapon:d.id,mode,seconds:+t.toFixed(3),hpLost:+(hp-p.hp).toFixed(2),kills:enemies.filter(e=>e.dead).length,attackStarts:starts,playerDead:p.dead});
}
const report={scenario:'120Hz, open flat ground, unarmoured player, real echo AI (22HP), eight-second cap; no balance changes',results};
fs.writeFileSync(path.join(root,'assets/item-art/melee/balance.json'),JSON.stringify(report,null,2)+'\n');console.table(results);
