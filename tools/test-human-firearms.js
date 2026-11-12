/* Player/NPC weapon parity and mandatory short-burst windows against the actual engine. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),h=fs.readFileSync(path.join(root,'run-test.js'),'utf8').split('let pass = 0')[0],c=new Function('require','__dirname',h+'\nreturn ctx;')(require,root);
const {Game,Save,Enemy,Player,WEAPONS,CFG,M,Corpse,Noise,EQUIP:E}=c,{HumanAI:H,Firearms:F,ENEMY_TYPES,Debuff}=vm.runInContext('({HumanAI,Firearms,ENEMY_TYPES,Debuff})',c);
const out=path.join(root,'design/enemies/shared-firearms-v1');fs.mkdirSync(out,{recursive:true});let passed=0;const failures=[],cadence=[];
function test(name,fn){try{fn();passed++;console.log('OK: '+name);}catch(e){failures.push({name,error:e.stack});process.exitCode=1;console.error('FAIL: '+name+'\n'+e.stack);}}
const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function arena(){Game.init();M.load(Array(45).fill('.'.repeat(50)),null,[],null);M.tideEnabled=false;c.Quiet.clear();Game.state='playing';Game.time=0;Game.enemies=[];Game.bullets=[];Noise.clear();Game.player=new Player(700,500);Game.player.hp=Game.player.maxHp=10000;Game.action=null;Game.bagOpen=false;Game.lootOpen=null;}
function npc(key='retriever',weapon){const e=new Enemy(key,550,500,0,{facing:'e'});Game.enemies.push(e);if(weapon){e.weaponId=weapon;e.gun=null;e.ai.mag=WEAPONS[weapon].mag;e.ammoId='ammo_'+WEAPONS[weapon].caliber+'_'+e.gearLv;}e.moveAlongPath=()=>false;return e;}
function tick(e,dt){Game.time+=dt;e.update(dt);Noise.tick(dt);}
function advance(e,t,fps=120){for(let n=0;n<Math.round(t*fps);n++)tick(e,1/fps);}
function bullets(){return Game.bullets.map(b=>[b.x,b.y,b.vx,b.vy,b.dmg,b.range,b.pen]);}
test('60/80/100HP; all humans have finite, weapon-sized magazines and actual corpse snapshots',()=>{
 arena();for(const [key,hp]of [['scav',90],['holdout',110],['retriever',145]]){const e=npc(key),w=H.weapon(e);assert.equal(e.hp,hp);assert.equal(e.ai.mag,w.mag);assert(e.ai.reserve>0);assert(e.t.tactical);const corpse=new Corpse(e.x,e.y,e),gun=corpse.loot.find(x=>x.gun).gun;assert.equal(gun.id,e.weaponId);assert.equal(gun.magCur,e.ai.mag);assert.equal(gun.ammo,e.ammoId);}
 assert.equal(ENEMY_TYPES.echo.hp,110);assert.equal(ENEMY_TYPES.guard.hp,175);
});
test('player/NPC emit identical damage, penetration, pellets, velocity, range and recoil for all 23 guns and five tiers',()=>{
 const random=c.Math.random;c.Math.random=()=>.75;try{for(const id of Object.keys(WEAPONS))for(let lv=1;lv<=5;lv++){
  arena();const w=WEAPONS[id],ammo='ammo_'+w.caliber+'_'+lv,p=Game.player;p.fillWeapons([E.gun(id,w.mag,ammo)]);p.fireCd=0;p.meleeActive=false;p.checkAimProfile();p.aimRemaining=0;p.syncSpread();p.updateAimPoint(p.x+200,p.y);assert(p.tryShoot());const expected=bullets(),kick=[p.recoil,p.rV,p.rH];
  Game.bullets=[];const e=npc('scav',id);e.x=p.x;e.y=p.y;e.gearLv=e.penLevel=lv;e.ammoId=ammo;e.ai.targetDistance=200;assert(H.shot(e,0));const got=bullets();assert.equal(got.length,expected.length);for(let i=0;i<got.length;i++)for(let k=0;k<got[i].length;k++)near(got[i][k],expected[i][k]);[e.ai.recoil,e.ai.rV,e.ai.rH].forEach((v,i)=>near(v,kick[i]));
 }}finally{c.Math.random=random;}
});
test('automatic groups stop at two/three rounds, then pause AND reacquire aim at 30/60/144FPS',()=>{
 for(const fps of [30,60,144])for(const [key,id]of [['scav','pp19_01'],['retriever','m4a1']]){
  arena();const e=npc(key,id),times=[];e.ai.reserve=0;let shots=0;
  for(let i=0;i<fps*12;i++){tick(e,1/fps);if(e.ai.shots!==shots){assert.equal(e.ai.shots-shots,1);times.push(Game.time);shots=e.ai.shots;}}
  const groups=[];for(const t of times){if(!groups.length||t-groups.at(-1).at(-1)>.5)groups.push([]);groups.at(-1).push(t);}
  assert(groups.length>=3);assert(times[0]>=H.aimDuration(e));
  for(let g=0;g<groups.length;g++){assert(groups[g].length<=3);if(g<groups.length-1)assert(groups[g].length>=2);for(let j=1;j<groups[g].length;j++)assert(groups[g][j]-groups[g][j-1]>=60/WEAPONS[id].rpm-1e-8);if(g>0){const gap=groups[g][0]-groups[g-1].at(-1);assert(gap>=e.t.pause[0]+H.aimDuration(e)-1e-8,`${key}@${fps} gap ${gap}`);}}
  assert(e.ai.mag>=WEAPONS[id].mag-3*groups.length);cadence.push({key,id,fps,groups});
 }
});
test('even an oversized AI burst setting is capped at three and semi/pump weapons fire once per group',()=>{
 arena();let e=npc('retriever');e.t={...e.t,burst:99};advance(e,1.2);assert.equal(e.ai.shots,3);assert.equal(e.ai.mag,WEAPONS[e.weaponId].mag-3);
 for(const id of ['glock17','mp155','rem870']){arena();e=npc('scav',id);advance(e,1.4);assert.equal(e.ai.shots,1,id);assert.equal(e.ai.mag,WEAPONS[id].mag-1);}
});
test('damage and temporary LOS loss cannot bypass rest or fire an unfinished group through cover',()=>{
 arena();const e=npc();while(e.ai.shots===0)tick(e,1/120);const observed=H.observe;H.observe=()=>null;
 try{tick(e,.02);assert.equal(e.ai.shots,1);assert.equal(e.ai.burstLeft,0);const until=e.ai.clock+e.ai.cd;H.observe=observed;e.hurt(1,'player','body',5);while(e.ai.clock<until+.3)tick(e,1/120);assert.equal(e.ai.shots,1);advance(e,.8);assert(e.ai.shots>1);}finally{H.observe=observed;}
});
test('tube reload commits one shell at weapon time; magazine reload commits once, death never creates ammo',()=>{
 for(const id of ['glock17','pp19_01','mp155','rem870','m4a1']){arena();const e=npc('scav',id),w=H.weapon(e);e.ai.mag=0;e.ai.reserve=4;tick(e,.001);assert.equal(e.ai.phase,'reload');tick(e,w.reloadTime-.001);assert.equal(e.ai.mag,0);tick(e,.002);assert.equal(e.ai.mag,w.reloadType==='tube'?1:4);assert.equal(e.ai.mag+e.ai.reserve,4);const corpse=new Corpse(e.x,e.y,e),gun=corpse.loot.find(x=>x.gun).gun,reserve=corpse.loot.filter(x=>x.item?.cat==='ammo').reduce((n,x)=>n+x.n,0);assert.equal(gun.magCur+reserve,4);e.hurt(99999,'player','body',5);advance(e,5);assert.equal(e.ai.mag+e.ai.reserve,4);}
});
test('finite budget is conserved every tick through shooting/reload/exhaustion for all three profiles',()=>{
 for(const key of ['scav','holdout','retriever']){arena();Game.player.x=620;const e=npc(key);e.ai.engaged=true;e.ai.mag=2;e.ai.reserve=1;for(let i=0;i<120*25;i++){tick(e,1/120);assert.equal(e.ai.mag+e.ai.reserve+e.ai.shots,3);assert(e.ai.mag>=0&&e.ai.reserve>=0);}assert.equal(e.ai.shots,3);assert.equal(e.ai.mag+e.ai.reserve,0);const shots=e.ai.shots;advance(e,5);assert.equal(e.ai.shots,shots);}
});
test('same weapon recoil/spread recover using the shared helper without resetting on a new group',()=>{
 arena();const e=npc();H.shot(e,0);const v=e.ai.rV,spread=F.spread(e.gun,e.ai.recoil);assert(v>0);assert(spread>F.derive(e.gun).spreadBase);e.ai.sinceShot=1;F.recover(e.ai,e.gun,.5);assert(e.ai.rV<v);assert(F.spread(e.gun,e.ai.recoil)<spread);
});
fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({passed,failures,cadence},null,2)+'\n');console.log(`Shared human firearms: ${passed} groups passed, ${failures.length} failed`);
