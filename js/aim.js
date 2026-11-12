/* Shared player shooting states, controls and bounded ADS camera. */
const ShootingStance = {
 defaults: {shoulder:.55,shoulderZoom:1.08,exitTime:.15,tapTime:.18,adsV:.85,adsH:.75,
  adsGrowth:.70,moveV:1.10,moveH:1.10,moveGrowth:1.25,moveSpread:1.35,sprintSpread:1.80,
  ironZoom:1.15,scopeZoom:1.4,lowView:1.6,scopeView:2,prismView:1.45,variableView:1.8,longView:2.4,viewBase:1.4,viewGain:.8,panSpeed:1},
 rangeSettings:null, enabled:true, right:false, spaceAt:null, spaceUsed:false, roll:false,
 inRange(){return Range.active&&Game.rangeMode&&M.map?.id===RANGE_MAP.id;},
 get settings(){return this.inRange()?(this.rangeSettings||(this.rangeSettings={...this.defaults})):this.defaults;},
 set settings(value){this.rangeSettings=value;},
 active(){return !!Game.player&&Game.state==='playing'&&(!this.inRange()||this.enabled);},
 owns(p){return this.active()&&p===Game.player;},
 clear(){this.right=false;this.spaceAt=null;this.spaceUsed=false;this.roll=false;if(Game.player?._rangeAim)Game.player._rangeAim.anchor=null;if(Game.canvas)Game.canvas.style.cursor='';},
 reset(){this.clear();if(Game.player)delete Game.player._rangeAim;},
 state(p){return p._rangeAim||(p._rangeAim={a:0,zoom:1,focus:0,target:0,mode:'腰射',profile:''});},
 zoom(){return this.active()?this.state(Game.player).zoom:1;},
 visionRadius(p){
  const a=this.state(p).focus;if(!this.owns(p)||a<=0)return CFG.FOV.RADIUS;
  const bounds=this.observation(p,this.zoom());
  const radius=Math.ceil(Math.hypot(CFG.VIEW_W,CFG.VIEW_H)*bounds.coverage/(2*CFG.TILE))+1;
  return this.mix(CFG.FOV.RADIUS,Math.max(CFG.FOV.RADIUS,radius),a);
 },
 clipVision(p){
  if(!this.owns(p)||this.state(p).focus<=0)return;
  const b=this.observation(p,this.zoom()),size=CFG.TILE;
  for(let y=0;y<M.H;y++)for(let x=0;x<M.W;x++)if((x+.5)*size<b.left||(x+.5)*size>b.right||(y+.5)*size<b.top||(y+.5)*size>b.bottom)M.raw[M.idx(x,y)]=0;
 },
 observation(p,z,width=M.W*CFG.TILE,height=M.H*CFG.TILE,view=this.opticView(p.weapon||Game.player.weapon)){
  // Physical window scale and maximum observation reach are independent.
  const coverage=this.settings.viewBase+this.settings.viewGain*Math.max(0,view-1);
  const left=Math.max(0,p.x-CFG.VIEW_W*coverage/2),right=Math.min(width,p.x+CFG.VIEW_W*coverage/2);
  const top=Math.max(0,p.y-CFG.VIEW_H*coverage/2),bottom=Math.min(height,p.y+CFG.VIEW_H*coverage/2);
  const mapX=Math.max(0,width-CFG.VIEW_W/z),mapY=Math.max(0,height-CFG.VIEW_H/z);
  const minX=Math.min(left,mapX),minY=Math.min(top,mapY);
  return{left,right,top,bottom,coverage,minX,minY,maxX:U.clamp(right-CFG.VIEW_W/z,minX,mapX),maxY:U.clamp(bottom-CFG.VIEW_H/z,minY,mapY)};
 },
 worldPoint(game){
  const p=game.player,s=this.active()?this.state(p):null,a=s?.anchor,z=s?.zoom||1,K=game.input;
  if(!a)return{x:K.mx/z+game.cam.x,y:K.my/z+game.cam.y};
  const bounds=this.observation(p,z),speed=this.settings.panSpeed*bounds.coverage/z;
  a.x=U.clamp(a.x+p.x-a.px+(K.mx-(a.lastMx??a.mx))*speed,bounds.left,bounds.right);
  a.y=U.clamp(a.y+p.y-a.py+(K.my-(a.lastMy??a.my))*speed,bounds.top,bounds.bottom);
  a.lastMx=K.mx;a.lastMy=K.my;a.px=p.x;a.py=p.y;
  return{x:a.x,y:a.y};
 },
 screenCursor(camX,camY){const point=this.worldPoint(Game),z=this.zoom();return{x:(point.x-camX)*z,y:(point.y-camY)*z};},
 precision(w){return w.adsPrecisionMul??({pistol:.65,smg:.70,rifle:.50,dmr:.30,sniper:.15,shotgun:.70,lmg:.60}[w.category]??.50);},
 opticView(w){const key=({att_optic03:'lowView',att_optic04:'scopeView',att_optic06:'prismView',att_optic07:'variableView',att_optic08:'longView'})[w.attachments?.optic];return key?(this.settings[key]!==this.defaults[key]?this.settings[key]:(w.adsView??this.defaults[key])):1.15;},
 opticZoom(w){return this.opticView(w)>1.15?this.settings.scopeZoom:this.settings.ironZoom;},
 move(p){const speed=Number.isFinite(p.frameTravel)?p.frameTravel/(this.lastDt||1/60):Math.hypot(p.vx||0,p.vy||0);return p.sprinting?1:U.clamp(speed/Math.max(1,CFG.P.SPEED),0,1);},
 mix(a,b,t){return a+(b-a)*t;},
 smooth(t){t=U.clamp(t,0,1);return t*t*(3-2*t);},
 physics(w){
  return {...Firearms.derive(w),opticPrecision:w.adsSpread??1};
 },
 updateAim(p,dt){
  // tryShoot uses this legacy profile too. Synchronize before ADS can finish,
  // so the first trigger pull cannot reset an already settled camera.
  p.checkAimProfile();
  const s=this.state(p),w=p.weapon,C=this.settings;
  const profile=p.slot+':'+w.id+':'+JSON.stringify(w.attachments||{})+':'+(p.body?.id||'')+':'+(p.body?.aimPenaltyPct||0)+':'+!!p.meleeActive;
  if(s.profile!==profile){s.profile=profile;s.a=0;s.anchor=null;}
  const blocked=p.dead||!p.weapons[p.slot]||p.sprinting||this.spaceAt!==null||p.dodgeT>0||p.reloadT>0||p.reloadPending||p.meleeActive||Game.bagOpen||Game.lootOpen||Game.action||AmmoWheel.isOpen()||MedWheel.isOpen();
  const ads=this.right&&!blocked;
  // Freeze the pre-ADS world point as the zoom pivot. Never feed the moving camera
  // back into this target; otherwise a stationary cursor makes the focus drift.
  if(ads&&!s.anchor){const K=Game.input;s.anchor={x:K.mx/s.zoom+Game.cam.x,y:K.my/s.zoom+Game.cam.y,mx:K.mx,my:K.my,px:p.x,py:p.y};}
  if(!ads)s.anchor=null;
  s.target=blocked?0:ads?1:Game.input.keys.shift?C.shoulder:0;
  if(blocked)s.a=0;
  else {const rate=dt/(s.target>s.a?Math.max(.05,p.aimTime):C.exitTime);s.a+=U.clamp(s.target-s.a,-rate,rate);}
  p.aimRemaining=s.target>0?Math.max(0,s.target-s.a)*p.aimTime:0;
  s.mode=p.sprinting?'冲刺腰射':p.dodgeT>0?'闪避':ads?'瞄准':s.target>0?'肩射':'腰射';
  const desired=blocked?1:ads?this.mix(1,this.opticZoom(w),this.smooth(s.a)):this.mix(1,C.shoulderZoom,this.smooth(s.a/Math.max(.01,C.shoulder)));
  s.zoom+=(desired-s.zoom)*(1-Math.exp(-dt/0.06));
  s.focus+=(ads?this.smooth(s.a)-s.focus:-s.focus)*(1-Math.exp(-dt/.08));
  p.syncSpread();
 },
 spread(p){
  const d=this.physics(p.weapon),a=this.state(p).a;
  const shoulder=Math.max(.01,this.settings.shoulder),ads=U.clamp((a-shoulder)/(1-shoulder),0,1);
  const precision=this.mix(1,this.precision(p.weapon),a)*this.mix(1,p.weapon.adsSpread??1,ads)*this.mix(p.weapon.hipSpread??1,1,U.clamp(a/shoulder,0,1));
  const movement=p.sprinting?this.settings.sprintSpread:this.mix(1,this.settings.moveSpread,this.move(p));
  return (d.spreadBase+(d.spreadMax-d.spreadBase)*(p.recoil||0))*precision*movement+Debuff.spreadAdd(p);
 },
 kick(p,w){
  const C=this.settings,R=CFG.RECOIL,AX=R.axis,d=this.physics(w),a=this.state(p).a,m=this.move(p);
  const g=this.mix(1,C.adsGrowth,a)*(p.sprinting?R.sprintMult:this.mix(1,C.moveGrowth,m));
  const v=this.mix(1,C.adsV,a)*(p.sprinting?AX.v.sprintMult:this.mix(1,C.moveV,m));
  const h=this.mix(1,C.adsH,a)*(p.sprinting?AX.h.sprintMult:this.mix(1,C.moveH,m));
  p.recoil=Math.min(R.max,p.recoil+d.growth*g);p.sinceShot=0;
  p.rV=Math.min(AX.v.max,p.rV+d.vKick*v);
  const sign=AX.h.bias>0?1:AX.h.bias<0?-1:Math.random()<.5?-1:1;
  p.rH=U.clamp(p.rH+(d.hKick+(Math.random()+Math.random()-1)*AX.h.rand)*h*sign,-AX.h.max,AX.h.max);
 },
 recover(p,dt){
  const R=CFG.RECOIL,AX=R.axis;
  if(p.sinceShot>R.decayDelay){p.recoil*=Math.pow(.5,dt/R.decayHalfLife);if(p.recoil<.01)p.recoil=0;}
  for(const [key,axis]of [['rH',AX.h],['rV',AX.v]])if(p.sinceShot>axis.decayDelay){p[key]*=Math.exp(-axis.decay*dt);if(Math.abs(p[key])<.05)p[key]=0;}
 },
 camera(game,snap){
  const p=game.player,z=this.zoom(),vw=CFG.VIEW_W/z,vh=CFG.VIEW_H/z;
  const anchor=this.state(p).anchor;
  // The zoom window follows the cursor-owned world point inside a larger bounded
  // observation rectangle. Camera motion never feeds back into that world point.
  const focus=this.state(p).focus*(this.opticView(p.weapon)>1.15?1:0);
  const pivotX=anchor?this.mix(anchor.mx,CFG.VIEW_W/2,focus):0;
  const pivotY=anchor?this.mix(anchor.my,CFG.VIEW_H/2,focus):0;
  const point=this.worldPoint(game),bounds=this.observation(p,z);
  const targetX=anchor?point.x-pivotX/z:p.x-vw/2+Math.cos(game.input.aimAngle)*34;
  const targetY=anchor?point.y-pivotY/z:p.y-vh/2+Math.sin(game.input.aimAngle)*34;
  const x=U.clamp(targetX,anchor?bounds.minX:0,anchor?bounds.maxX:Math.max(0,M.W*CFG.TILE-vw));
  const y=U.clamp(targetY,anchor?bounds.minY:0,anchor?bounds.maxY:Math.max(0,M.H*CFG.TILE-vh));
  const k=snap?1:1-Math.exp(-(this.lastDt||1/60)/.08);
  game.cam.x+=(x-game.cam.x)*k;game.cam.y+=(y-game.cam.y)*k;
  if(anchor){game.cam.x=U.clamp(game.cam.x,bounds.minX,bounds.maxX);game.cam.y=U.clamp(game.cam.y,bounds.minY,bounds.maxY);}
  game.input.wx=point.x;game.input.wy=point.y;
  game.canvas.style.cursor=anchor?'none':'';
  p.updateAimPoint(game.input.wx,game.input.wy);
 },
};
// Kept for firing-range tools and existing diagnostic integrations.
const RangeAim = ShootingStance;
Object.freeze(ShootingStance.defaults);

{
 const original={update:Player.prototype.update,aim:Player.prototype.updateAim,spread:Player.prototype.syncSpread,reset:Player.prototype.resetAim,kick:Firearms.kick,recover:Firearms.recover,camera:Game.updateCamera};
 Player.prototype.update=function(dt,input){
  if(!RangeAim.owns(this))return original.update.call(this,dt,input);
  RangeAim.lastDt=dt;
  const moving=!!(input.mx||input.my),panels=Game.bagOpen||Game.lootOpen||AmmoWheel.isOpen()||MedWheel.isOpen();
  if(panels)RangeAim.clear();
  const held=RangeAim.spaceAt!==null&&(performance.now()-RangeAim.spaceAt)/1000>=RangeAim.settings.tapTime;
  if(held)RangeAim.spaceUsed=true;
  const dodge=RangeAim.roll&&!panels;RangeAim.roll=false;
  if(dodge)Medical.cancel();
  const sprint=held&&moving&&!panels;
  const sneak=!sprint&&!panels&&(Game.input.keys.shift||RangeAim.right);
  const next={...input,mx:panels?0:input.mx,my:panels?0:input.my,sneak:!!sneak,sprint,dodge,aimAngle:dodge&&moving?Math.atan2(input.my,input.mx):input.aimAngle};
  if(panels){Game.input.mouseDown=false;Game.input.mousePressed=false;Game.input.dodgePressed=false;}
  const result=original.update.call(this,dt,next);
  // The legacy dodge branch returns before updateAim; still release zoom during the roll.
  if(this.dodgeT>0)RangeAim.updateAim(this,dt);
  return result;
 };
 Player.prototype.updateAim=function(dt){return RangeAim.owns(this)?RangeAim.updateAim(this,dt):original.aim.call(this,dt);};
 Player.prototype.syncSpread=function(){if(RangeAim.owns(this))this.spread=RangeAim.spread(this);else return original.spread.call(this);};
 Player.prototype.resetAim=function(){if(RangeAim.owns(this)){RangeAim.state(this).a=0;this.aimRemaining=0;this.syncSpread();}else return original.reset.call(this);};
 Firearms.kick=function(p,w){return RangeAim.owns(p)?RangeAim.kick(p,w):original.kick.call(this,p,w);};
 Firearms.recover=function(p,w,dt){return RangeAim.owns(p)?RangeAim.recover(p,dt):original.recover.call(this,p,w,dt);};
 Game.updateCamera=function(snap){return RangeAim.active()?RangeAim.camera(this,snap):original.camera.call(this,snap);};
 for(const key of ['startRun','beginDying','showEnd']){const run=Game[key];Game[key]=function(...args){RangeAim.reset();const result=run.apply(this,args);if(key==='beginDying'&&this.player)original.camera.call(this,true);return result;};}
 const baseOpen=Base.open;Base.open=function(...args){if(Range.active)Range.exit();RangeAim.reset();return baseOpen.apply(this,args);};
 const typing=()=>/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)||document.activeElement?.isContentEditable;
 window.addEventListener('keydown',e=>{if(!RangeAim.active()||Game.state!=='playing'||typing())return;if(e.code==='Space'&&!e.repeat&&RangeAim.spaceAt===null&&!Game.bagOpen&&!Game.lootOpen&&!AmmoWheel.isOpen()&&!MedWheel.isOpen()){e.preventDefault();RangeAim.spaceAt=performance.now();RangeAim.spaceUsed=false;}},true);
 window.addEventListener('keyup',e=>{if(e.code!=='Space')return;if(RangeAim.active()&&RangeAim.spaceAt!==null){const short=(performance.now()-RangeAim.spaceAt)/1000<RangeAim.settings.tapTime;RangeAim.roll=short&&!RangeAim.spaceUsed&&!Game.bagOpen&&!Game.lootOpen&&Game.state==='playing';}RangeAim.spaceAt=null;RangeAim.spaceUsed=false;},true);
 window.addEventListener('mousedown',e=>{if(RangeAim.active()&&Game.state==='playing'&&e.target===Game.canvas&&e.button===2){e.preventDefault();e.stopImmediatePropagation();if(Game.action?.type==='unlock')Game.cancelUnlock('开锁中断');RangeAim.right=!Game.bagOpen&&!Game.lootOpen&&!AmmoWheel.isOpen()&&!MedWheel.isOpen();document.activeElement?.blur();}},true);
 window.addEventListener('mouseup',e=>{if(e.button===2)RangeAim.right=false;},true);
 window.addEventListener('blur',()=>RangeAim.clear());
}
