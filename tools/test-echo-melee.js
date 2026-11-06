/* Regression: AI position snapshots must never receive melee health damage. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),h=fs.readFileSync(path.join(root,'run-test.js'),'utf8').split('let pass = 0')[0],c=new Function('require','__dirname',h+'\nreturn ctx;')(require,root);
const {Game,Enemy,Player,GEAR,M,Noise,CFG}=c,{BALLISTICS}=vm.runInContext('({BALLISTICS})',c);let groups=0;
function arena(){Game.init();M.load(Array(40).fill('.'.repeat(40)),null,[],null);M.tideEnabled=false;c.Quiet.clear();Game.state='playing';Game.time=0;Game.enemies=[];Game.bullets=[];Game.corpses=[];Game.particles=[];Game.toasts=[];Game.stats={kills:0,found:0,newItems:[]};Noise.clear();Game.player=new Player(1000,1000);}
function enemy(k,x=300,y=300){const e=new Enemy(k,x,y,0);Game.enemies.push(e);return e;}
function test(name,fn){arena();fn();groups++;console.log('OK: '+name);}
test('normal AI acquires and damages a nearby scav while the player is distant',()=>{
 const echo=enemy('echo'),scav=enemy('scav',320,300);scav.body=null;const hp=scav.hp,playerHP=Game.player.hp;
 echo.update(1/60);assert.equal(echo.target.ref,scav);assert.equal(scav.hp,hp-echo.t.dmg);assert.equal(Game.player.hp,playerHP);assert(scav.ai.engaged);assert.equal(scav.ai.memory.ref,echo);
 const after=scav.hp;echo.update(1/60);assert.equal(scav.hp,after,'cooldown prevents duplicate hits');
});
test('actual victim hurt applies torso armor, durability and melee injury metadata',()=>{
 const echo=enemy('echo'),scav=enemy('scav',320,300);scav.body=GEAR.make('body',3);echo.target={kind:'enemy',ref:scav};const snapshot=echo.currentTargetPos(),hp=scav.hp,dur=scav.body.dur,expected=BALLISTICS.hit(echo.t.dmg,CFG.AMMO.UNARMED_PEN,scav.body);
 const hurt=scav.hurt;let args;scav.hurt=function(...a){args=a;return hurt.apply(this,a);};echo.attack(snapshot);
 assert.equal(scav.hp,hp-expected.health);assert.equal(scav.body.dur,Math.max(0,dur-expected.durabilityLoss));assert.equal(args[1],'echo');assert.equal(args[2],'body');assert.equal(args[4],'melee');assert(args[5]);assert(!Object.hasOwn(snapshot,'hp'));
});
test('lethal NPC melee creates exactly one corpse through the normal death pipeline',()=>{
 const echo=enemy('echo'),scav=enemy('scav',320,300);scav.body=null;scav.hp=1;echo.target={kind:'enemy',ref:scav};echo.attack(echo.currentTargetPos());assert(scav.dead);assert.equal(scav.hp,0);assert.equal(Game.corpses.length,1);assert(Game.corpses[0].loot.some(e=>e.gun));echo.attack({x:scav.x,y:scav.y});assert.equal(Game.corpses.length,1);
});
test('missing/dead/allied/out-of-range targets and stale coordinates cannot receive damage',()=>{
 const echo=enemy('echo'),scav=enemy('scav',320,300);scav.body=null;const hp=scav.hp;echo.target={kind:'enemy',ref:scav};const snapshot=echo.currentTargetPos();scav.x=600;echo.attack(snapshot);assert.equal(scav.hp,hp);scav.x=320;scav.dead=true;echo.attack(snapshot);assert.equal(scav.hp,hp);echo.target=null;echo.attack(snapshot);const friend=enemy('echo',320,300),friendHP=friend.hp;echo.target={kind:'enemy',ref:friend};echo.attack({x:320,y:300});assert.equal(friend.hp,friendHP);
});
test('a wall prevents melee damage, and the player branch still uses Player.hurt',()=>{
 const echo=enemy('echo',M.cx(10)-10,M.cy(10)),scav=enemy('scav',M.cx(10)+10,M.cy(10));scav.body=null;echo.target={kind:'enemy',ref:scav};const hp=scav.hp,los=M.lineOfSight;M.lineOfSight=()=>false;try{echo.attack(echo.currentTargetPos());assert.equal(scav.hp,hp);}finally{M.lineOfSight=los;}
 Game.player.x=echo.x+20;Game.player.y=echo.y;Game.player.body=null;echo.target={kind:'player'};const playerHP=Game.player.hp;echo.attack(echo.currentTargetPos());assert.equal(Game.player.hp,playerHP-echo.t.dmg);assert.equal(scav.hp,hp);
});
console.log('Echo melee: '+groups+' groups passed');
