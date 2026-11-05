/* Actual AI aim completion -> shared firearm -> stepped Bullet collision, before/after. */
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'design/enemies/scav-accuracy-v1');
const h=fs.readFileSync(path.join(root,'run-test.js'),'utf8').split('let pass = 0')[0],c=new Function('require','__dirname',h+'\nreturn ctx;')(require,root);
const {Game,Player,Enemy,M,WEAPONS,CFG}=c,{HumanAI:H,HUMAN_UNIT_DEFS:D,MAP_CATALOG,ENEMY_LOADOUT,BALLISTICS,Noise}=vm.runInContext('({HumanAI,HUMAN_UNIT_DEFS,MAP_CATALOG,ENEMY_LOADOUT,BALLISTICS,Noise})',c);
const baseline=require('../design/enemies/scav-accuracy-v1/baseline.json'),plain=x=>JSON.parse(JSON.stringify(x));
let passed=0;const failures=[],rows=[];function test(name,fn){try{fn();passed++;console.log('OK: '+name);}catch(e){failures.push({name,error:e.stack});process.exitCode=1;console.error('FAIL: '+name+'\n'+e.stack);}}
Game.init();M.load(Array(45).fill('.'.repeat(50)),null,[],null);M.tideEnabled=false;Game.state='playing';Game.enemies=[];Game.player=new Player(700,500);Game.player.hp=10000;

test('only scav aim changes; every weapon, ammo tier, armor policy, trigger timing, map and squad remain unchanged',()=>{
 const profiles=plain(D),old=plain(baseline.profiles);assert.equal(profiles.scav.aimError,.14);assert.equal(profiles.scav.aimErrorMinPx,14);
 delete profiles.scav.aimError;delete profiles.scav.aimErrorMinPx;delete old.scav.aimError;assert.deepEqual(profiles,old);
 assert.deepEqual(plain(WEAPONS),baseline.weapons);assert.deepEqual(plain(CFG.AMMO),baseline.ammo);assert.deepEqual(plain(ENEMY_LOADOUT),baseline.loadout);assert.deepEqual(plain(MAP_CATALOG),baseline.maps);
 for(const [file,hash]of Object.entries(baseline.files))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),hash,file);
});

test('near-range error floor, zero-distance safety, all directions, and unchanged elite/holdout aim ranges',()=>{
 const random=c.Math.random;try{for(const key of Object.keys(D))for(const dist of [0,1,32,64,128,200])for(let i=0;i<8;i++){
  const direction=i*Math.PI/4,e=new Enemy(key,700-dist*Math.cos(direction),500-dist*Math.sin(direction),0),obs={x:700,y:500};
  const center=Math.atan2(obs.y-e.y,obs.x-e.x),error=Math.max(D[key].aimError,Math.atan2(D[key].aimErrorMinPx||0,Math.max(1,dist)));
  for(const draw of [0,.5,.999999]){c.Math.random=()=>draw;const a=H.aimAngle(e,obs);assert(Number.isFinite(a));assert(Math.abs(a-center-((draw*2-1)*error))<1e-8);}
 }}finally{c.Math.random=random;}
});

function sample(distance,policy,count=6000){
 const random=c.Math.random;let seed=9271;const oldHurt=Game.player.hurt;let part=null;
 c.Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};Game.player.hurt=(d,p)=>{part=p;return d;};
 let hits=0,heads=0;try{
  const e=new Enemy('scav',700-distance,500,0);e.weaponId='aks74u';e.gun=null;e.gearLv=3;e.t={...e.t,...policy};
  for(let i=0;i<count;i++){
   const angle=(i%8)*Math.PI/4,fps=[30,60,144][i%3];e.x=700-Math.cos(angle)*distance;e.y=500-Math.sin(angle)*distance;
   e.ai.mag=30;e.ai.fireCd=e.ai.recoil=e.ai.rH=e.ai.rV=0;e.ai.phase='aim';e.ai.phaseT=.001;Game.bullets=[];part=null;
   H.advancePhase(e,.001,{x:700,y:500});assert.equal(Game.bullets.length,1);
   const bullet=Game.bullets[0];for(let f=0;f<fps*2&&!bullet.dead;f++)bullet.update(1/fps);
   if(part){hits++;if(part==='head')heads++;}Noise.clear();
  }
 }finally{c.Math.random=random;Game.player.hurt=oldHurt;}
 return {shots:count,hits,heads,hitRate:hits/count,headRate:heads/count,headShareOfHits:heads/Math.max(1,hits)};
}
test('48000 real first shots: substantially fewer hits and headshots at 1/2/4/6.25 tiles across 8 directions and 30/60/144FPS',()=>{
 for(const distance of [32,64,128,200]){
  const before=sample(distance,{aimError:baseline.profiles.scav.aimError,aimErrorMinPx:0}),after=sample(distance,{});
  rows.push({tiles:distance/32,before,after});assert(after.hitRate<before.hitRate*.9,JSON.stringify(rows.at(-1)));assert(after.headRate<before.headRate*.65,JSON.stringify(rows.at(-1)));
  assert(after.headRate<.25);assert(after.headShareOfHits<.42);
 }
});
test('aim error stays locked within a burst, then is drawn again for the next trigger group',()=>{
 const e=new Enemy('scav',636,500,0);e.weaponId='aks74u';e.gun=null;e.ai.mag=30;
 const random=c.Math.random;let calls=0,phaseCalls=0;const aim=H.aimAngle;
 H.aimAngle=function(...args){calls++;return aim.apply(this,args);};
 try{c.Math.random=()=>.75;e.ai.phase='aim';e.ai.phaseT=.001;H.advancePhase(e,.001,{x:700,y:500});const angle=e.ai.shotAngle;
  while(e.ai.phase==='burst'&&phaseCalls++<5){e.ai.fireCd=0;H.advancePhase(e,1,{x:700,y:510});assert.equal(e.ai.shotAngle,angle);}
  assert.equal(calls,1);assert(e.ai.shots>=2&&e.ai.shots<=3);assert(e.ai.cd>=e.t.pause[0]);
  e.ai.cd=e.ai.fireCd=0;e.ai.phase='aim';e.ai.phaseT=.001;H.advancePhase(e,.001,{x:700,y:510});assert.equal(calls,2);assert.notEqual(e.ai.shotAngle,angle);
 }finally{c.Math.random=random;H.aimAngle=aim;}
});
fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({passed,failures,weapon:'aks74u',stationaryTarget:true,firstShotsOnly:true,fps:[30,60,144],directions:8,rows},null,2)+'\n');
console.log(JSON.stringify(rows.map(r=>({tiles:r.tiles,beforeHit:(r.before.hitRate*100).toFixed(1)+'%',afterHit:(r.after.hitRate*100).toFixed(1)+'%',beforeHead:(r.before.headRate*100).toFixed(1)+'%',afterHead:(r.after.headRate*100).toFixed(1)+'%'})),null,2));
console.log(`Scav accuracy: ${passed} groups passed, ${failures.length} failed`);
