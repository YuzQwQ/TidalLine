/* Paired engine probes: real Player/Enemy AI/projectiles, controlled open arena, no balance writes. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),h=fs.readFileSync(path.join(root,'run-test.js'),'utf8').split('let pass = 0')[0],c=new Function('require','__dirname',h+'\nreturn ctx;')(require,root);
const {Game,Save,Player,Enemy,GEAR,WEAPONS,Noise}=c,{M,ITEM_BY_ID}=vm.runInContext('({M,ITEM_BY_ID})',c);
Game.init();M.load(Array(60).fill('.'.repeat(60)),null,[],null);M.tideEnabled=false;
const pairs=[{type:'helmet',base:'helmet1',variant:'helmet1_motorcycle'}, {type:'body',base:'body1',variant:'body1_leather'}, {type:'body',base:'body2',variant:'body2_concealed'}, {type:'body',base:'body4',variant:'body4_lightplate'}];
function seed(n){let s=n>>>0;c.Math.random=()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296;};}
const random=c.Math.random;
function player(type,id,total=25){
 const p=new Player(900,900);Game.player=p;Game.state='playing';Game.time=0;Game.action=null;Game.lootOpen=null;Game.bullets=[];Game.particles=[];Game.toasts=[];p.weapons=[{...WEAPONS.rifle,magCur:WEAPONS.rifle.mag,ammo:WEAPONS.rifle.ammo},null,null];p.slot=0;p.mag=p.weapon.mag;p[type]=GEAR.make(type,id);p.meleeActive=false;
 p.bag.slots=Array.from({length:5},()=>({item:ITEM_BY_ID.ammo_556_1,n:60}));const ballast=total-p.totalWeight;p.bag.slots.push({item:{id:'probe_ballast',w:Math.max(0,ballast),name:'配重'},n:1});return p;
}
const samples=[];
try{
 for(const pair of pairs)for(const mode of ['stationary','move_stop'])for(let trial=1;trial<=30;trial++)for(const id of [pair.base,pair.variant]){
  seed(trial);const p=player(pair.type,id);const e=new Enemy('guard',1100,900);e.helmet=e.body=null;e.hp=e.maxHp=100000;e.state='chase';e.target={kind:'player'};e.canSee=()=>true;e.penLevel=GEAR.def(pair.type,id).lv;Game.enemies=[e];let firstShot=null,firstHit=null,shots=0,time=0;
  for(let frame=0;frame<600&&!p.dead;frame++){
   time=(frame+1)/60;Game.time=time;const phase=time%2,moving=mode==='move_stop'&&phase<.45,dir=Math.floor(time/2)%2?1:-1;
   p.update(1/60,{mx:0,my:moving?dir:0,sneak:false,sprint:false,dodge:false,aimAngle:Math.atan2(e.y-p.y,e.x-p.x)});
   if(p.mag===0&&p.reloadT<=0)p.tryReload();
   if(!moving&&p.aimRemaining<=1e-9&&p.tryShoot()){shots++;if(firstShot===null)firstShot=time;}
   e.update(1/60);for(const b of Game.bullets)if(!b.dead)b.update(1/60);Game.bullets=Game.bullets.filter(b=>!b.dead);if(firstHit===null&&e.hp<e.maxHp)firstHit=time;
   Noise.tick(1/60);Game.particles=[];Game.toasts=[];
  }
  samples.push({type:pair.type,id,mode,trial,firstShot,firstHit,shots,damageDealt:e.maxHp-e.hp,hp:p.hp,alive:!p.dead,seconds:time,armorLeft:p[pair.type]?.dur??0});
 }
}finally{c.Math.random=random;}
const q=(rows,key,pct)=>{const a=rows.map(x=>x[key]).filter(x=>typeof x==='number').sort((a,b)=>a-b);return a.length?+a[Math.min(a.length-1,Math.floor((a.length-1)*pct))].toFixed(4):null;};
const summary=[];for(const pair of pairs)for(const id of [pair.base,pair.variant])for(const mode of ['stationary','move_stop']){const rows=samples.filter(x=>x.id===id&&x.mode===mode);summary.push({id,mode,n:rows.length,firstShotMedian:q(rows,'firstShot',.5),firstShotP90:q(rows,'firstShot',.9),firstHitMedian:q(rows,'firstHit',.5),damageMedian:q(rows,'damageDealt',.5),hpMedian:q(rows,'hp',.5),survived:rows.filter(x=>x.alive).length});}
const haul=[];for(const pair of pairs){const otherWeight=pair.base==='body4'?25:pair.base==='body2'?28:pair.type==='body'?13.3:14.3;for(const id of [pair.base,pair.variant]){const g=GEAR.def(pair.type,id),p=player(pair.type,id,otherWeight+g.w),x=p.x;Game.enemies=[];for(let i=0;i<300;i++)p.update(1/60,{mx:1,my:0,sneak:false,sprint:false,dodge:false,aimAngle:0});haul.push({id,totalWeight:+p.totalWeight.toFixed(2),tier:p.tier.name,distance5s:+(p.x-x).toFixed(2),weight:g.w,price:g.price,durabilityPer1000:+(g.dur/g.price*1000).toFixed(4)});}}
const sustained=[];for(const pair of pairs)for(let trial=1;trial<=30;trial++)for(const id of [pair.base,pair.variant]){seed(trial);const p=player(pair.type,id);let hits=0;while(!p.dead&&hits<100){p.hurt(12+c.Math.random()*6,pair.type==='helmet'?'head':'body',GEAR.def(pair.type,id).lv);hits++;}sustained.push({id,trial,hitsToDeath:hits});}
const sustainedSummary=[...new Set(sustained.map(x=>x.id))].map(id=>({id,medianHits:q(sustained.filter(x=>x.id===id),'hitsToDeath',.5),p90Hits:q(sustained.filter(x=>x.id===id),'hitsToDeath',.9)}));
c.Math.random=random;
// Isolate durability over repeated treated encounters; deliberately not a survival claim.
const durabilityStress=[];
for(const pair of pairs)for(let trial=1;trial<=30;trial++)for(const id of [pair.base,pair.variant]){
 seed(trial);const p=player(pair.type,id);let hits=0;
 while(p[pair.type].dur>0&&hits<1000){p.hp=100;p.hurt(12+c.Math.random()*6,pair.type==='helmet'?'head':'body',GEAR.def(pair.type,id).lv);hits++;}
 durabilityStress.push({id,trial,hitsToBreak:hits});
}
c.Math.random=random;
const durabilityStressSummary=[...new Set(durabilityStress.map(x=>x.id))].map(id=>({id,medianHitsToBreak:q(durabilityStress.filter(x=>x.id===id),'hitsToBreak',.5)}));
const report={kind:'paired_controlled_engine_probe',environment:'60Hz, 10s open flat arena, real guard AI and projectiles; same-tier total load25kg; player fires only once preparation complete; 30 starting seeds per pair/mode. Not a manual production-map playtest.',weapon:{id:'rifle',aimTime:WEAPONS.rifle.aimTime,rpm:WEAPONS.rifle.rpm},summary,haul,sustainedSummary,sustained,durabilityStressMethod:'HP reset to100 before each same-grade hit to isolate wear across treated encounters; artificial, not normal survival.',durabilityStressSummary,durabilityStress,samples};
fs.writeFileSync(path.join(root,'design/equipment/armor-variants-v1/balance-probe.json'),JSON.stringify(report,null,2)+'\n');console.table(summary);console.table(haul);console.table(sustainedSummary);
