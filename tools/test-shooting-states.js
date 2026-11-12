/* Shared engine baseline plus the actual production stance module. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),h=fs.readFileSync(path.join(root,'run-test.js'),'utf8').split('let pass = 0')[0];
const c=new Function('require','__dirname',h+'\nreturn ctx;')(require,root);vm.runInContext(fs.readFileSync(path.join(root,'js/aim.js'),'utf8'),c);
const {A,G,S,W,E,F,CFG,M,Range,RANGE_MAP}=vm.runInContext('({A:ShootingStance,G:Game,S:Save,W:WEAPONS,E:EQUIP,F:Firearms,CFG,M,Range,RANGE_MAP})',c);
let checks=0;const ok=(b,m)=>{assert(b,m);checks++;},near=(a,b)=>ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
G.init();G.startRun(null);G.enemies=[];G.rangeMode=false;Range.active=false;
for(const gun of Object.keys(W)){
 const p=G.player;p.fillWeapons([E.gun(gun,W[gun].mag)]);p.dead=false;p.meleeActive=false;p.sprinting=false;p.frameTravel=0;p.recoil=p.rV=p.rH=0;G.bagOpen=false;G.lootOpen=null;G.action=null;A.clear();p.updateAim(.01);
 const w=p.weapon,d=F.derive(w),s=A.state(p);ok(A.active(),'formal active');
 for(const progress of [0,.55,1]){s.a=progress;p.syncSpread();near(p.spread,d.spreadBase*(1+((w.adsPrecisionMul??.5)-1)*progress));}
 s.a=1;p.recoil=.6;p.syncSpread();near(p.spread,(d.spreadBase+(d.spreadMax-d.spreadBase)*.6)*w.adsPrecisionMul);near(p.recoil,.6);
 p.frameTravel=CFG.P.SPEED/60;near(A.spread(p),(d.spreadBase+(d.spreadMax-d.spreadBase)*.6)*w.adsPrecisionMul*1.35);
 p.frameTravel=0;p.recoil=0;p.rV=0;p.rH=0;F.kick(p,w);near(p.recoil,d.growth*.7);near(p.rV,d.vKick*.85);near(w.rpm,W[gun].rpm);
}
const p=G.player;p.fillWeapons([E.gun('m4a1',30,null,null,{attachments:{optic:'att_optic08',grip:'att_grip05'}})]);p.sprinting=false;p.frameTravel=0;p.recoil=0;A.clear();p.updateAim(.01);
const w=p.weapon,d=F.derive(w),s=A.state(p);s.a=0;near(A.spread(p),d.spreadBase*.94);s.a=.55;near(A.spread(p),d.spreadBase*.725);s.a=1;near(A.spread(p),d.spreadBase*.5*.65);
near(A.opticZoom(w),1.4);near(A.opticView(w),2.4);
// Explicitly retain accumulated recoil when aim progress changes.
p.recoil=.7;p.rV=9;p.rH=4;A.right=true;s.a=1;s.profile='';p.updateAim(.01);near(p.recoil,.7);near(p.rV,9);near(p.rH,4);
// A held space cannot keep ADS; a pending short tap cannot become a sprint early.
A.spaceAt=c.performance.now();A.spaceUsed=false;p.update(1/60,{mx:1,my:0,aimAngle:0});ok(!p.sprinting&&A.state(p).a===0,'space pending blocks ADS but does not sprint');
A.spaceAt=c.performance.now()-250;p.update(1/60,{mx:1,my:0,aimAngle:0});ok(p.sprinting&&A.spaceUsed,'long space sprints');A.clear();
// Range-only sliders and disable toggle cannot change live rules.
Range.active=true;G.rangeMode=true;const map=M.map;M.map=RANGE_MAP;A.settings={...A.defaults,scopeZoom:1.9,adsV:.3};A.enabled=false;ok(!A.active(),'range comparison mode can disable');
Range.active=false;G.rangeMode=false;M.map=map;ok(A.active(),'comparison toggle does not disable formal controls');near(A.settings.scopeZoom,1.4);near(A.settings.adsV,.85);
A.enabled=true;A.right=true;A.spaceAt=100;G.beginDying();ok(!A.right&&A.spaceAt===null&&A.zoom()===1,'death clears camera and pending input');
G.state='playing';p.dead=false;p.fillWeapons([]);p.meleeActive=false;A.reset();A.right=true;p.updateAim(1);near(A.state(p).a,0);near(A.zoom(),1);
console.log('PASS: '+checks+' production stance checks across all 25 weapons, conditional optics, retained recoil, movement, space timing, defaults isolation and death cleanup');
