/* Shared trigger/reload/cycle rules; weapon model records own all numerical values. */
const Gunplay={
  labels:{semi:'半自动',auto:'全自动',burst3:'三连发',pump:'泵动'},
  prepare(p){const w=p.weapons[p.slot];if(w){if(!w.modes.includes(w.fireMode))w.fireMode=w.defaultMode;w.cycleRemaining=Math.max(0,Number(w.cycleRemaining)||0);}return w;},
  blocked(p){return p.dead||p.meleeActive||Game.bagOpen||!!Game.lootOpen||Game.action?.type==='heal'||(typeof AmmoWheel!=='undefined'&&AmmoWheel.isOpen())||(typeof MedWheel!=='undefined'&&MedWheel.isOpen());},
  state(p){const w=p.weapons[p.slot];return p.reloadPending?'reloading':w?.cycleRemaining>0?'cycling':p._burstPending>0||p.windupShot||p.shotAnimT>0?'firing':'ready';},
  cancel(p,reload=false){p._burstPending=0;p._burstStarting=false;p._tubeShot=false;p._automaticHeld=false;p.windupShot=false;p.windupT=0;if(reload){p.reloadPending=false;p.reloadT=0;SFX.stopSeq('reload');}},
  trigger(p,held,pressed){
    if(p.meleeActive)return (held||pressed)?p.tryShoot():false;
    if(pressed||held)Medical.cancel();
    const w=this.prepare(p);if(!w||this.blocked(p)){this.cancel(p);return false;}
    p._automaticHeld=!!held&&w.fireMode==='auto';if(pressed||(held&&w.fireMode==='auto'))return p.tryShoot();return false;
  },
  setMode(p,mode){const w=this.prepare(p);if(!w||p.meleeActive)return false;if(!w.modes.includes(mode))return false;if(p.reloadPending||w.cycleRemaining>0||p.windupShot||p._burstPending>0){Game.toast('先完成当前枪械动作');return false;}w.fireMode=mode;this.cancel(p);Game.syncGear();Game.toast('射击模式：'+this.labels[mode]);return true;},
  nextMode(p){const w=this.prepare(p);if(!w||w.modes.length<2){Game.toast('该武器只有一种射击模式');return false;}return this.setMode(p,w.modes[(w.modes.indexOf(w.fireMode)+1)%w.modes.length]);},
  before(p,dt,input){
    p._cadenceOvershoot=p.fireCd>0?Math.max(0,dt-p.fireCd):0;
    const w=this.prepare(p);if(this.blocked(p))this.cancel(p,p.dead||p.meleeActive||Game.action?.type==='heal');
    if(input.dodge&&p.dodgeCd<=0)this.cancel(p,true);
    if(w?.cycleRemaining>0){w.cycleRemaining=Math.max(0,w.cycleRemaining-dt);if(w.cycleRemaining===0)Game.syncGear();}
  },
  after(p){
    if(this.blocked(p)||p.dodgeT>0){this.cancel(p);return;}
    if(p._burstPending>0&&p.fireCd<=1e-9&&!p.reloadPending&&!p.windupShot){if(p.mag<=0){p._burstPending=0;return;}this.single.call(p);}
  },
  startReload(p){
    Medical.cancel();const w=this.prepare(p);if(!w||p.dead||p.meleeActive||w.cycleRemaining>0||p.reloadPending||p.mag>=w.mag)return false;
    if(!p.bag.ammoCountByCaliber(w.caliber)){Game.toast('没有同口径备弹');return false;}
    this.cancel(p);p.reloadPending=true;p.reloadSlot=p.slot;p.reloadT=w.reloadTime;Game.sfx('reload',{model:w.id});Noise.emit(p.x,p.y,CFG.NOISE.reload,'reload');return true;
  },
  finishReload(p){
    if(!p.reloadPending||p.reloadT>1e-9)return;
    if(p.dead||p.reloadSlot!==p.slot){this.cancel(p,true);return;}
    const w=this.prepare(p),rounds=p.roundsFor(w,p.mag),tube=w.reloadType==='tube';
    const priority=AMMO_BY_ID[w.ammo]?.caliber===w.caliber?w.ammo:p.ammoId;
    const ids=[...new Set([priority,...p.bag.ammoStacks(w.caliber).map(s=>s.item.id)])];
    let room=Math.min(w.mag-rounds.length,tube?1:w.mag);
    for(const id of ids){const n=Math.min(room,p.bag.ammoCount(id));if(n>0){p.bag.useAmmo(id,n);rounds.push(...Array(n).fill(id));room-=n;}if(room<=0)break;}
    p.mag=w.magCur=rounds.length;const shoot=p._tubeShot;p._tubeShot=false;p.reloadPending=false;
    Game.syncGear();if(Game.bagOpen)Game.renderBag();
    if(shoot&&p.mag>0&&!this.blocked(p)){this.single.call(p);return;}
    if(tube&&p.mag<w.mag&&p.bag.ammoCountByCaliber(w.caliber)>0&&!shoot){p.reloadPending=true;p.reloadT=w.reloadTime;Game.sfx('reload',{model:w.id});}
  },
  snapshot(w,mag){return EQUIP.gun(w.id,mag??w.magCur,w.ammo,w.rounds,w);}
};
Gunplay.single=Player.prototype.tryShoot;
const gunOriginal={update:Player.prototype.update,shoot:Player.prototype._fireNow,switch:Player.prototype.switchWeapon,unload:Player.prototype.unloadWeapon};
Player.prototype.tryShoot=function(){
  const w=Gunplay.prepare(this);if(!w||this.dead||this.meleeActive)return false;
  if(w.cycleRemaining>0)return false;
  if(this.reloadPending&&w.reloadType==='tube'){this._tubeShot=true;return false;}
  if(this._burstPending>0)return false;
  if(this.fireCd>1e-9||this.windupShot)return false;
  this._burstStarting=w.fireMode==='burst3';
  const fired=Gunplay.single.call(this);if(!this.windupShot)this._burstStarting=false;return fired;
};
Player.prototype._fireNow=function(){
  const w=Gunplay.prepare(this);if(!w||Gunplay.blocked(this)||w.cycleRemaining>0){this.windupShot=false;this._burstStarting=false;return false;}
  const continuous=this._automaticHeld||this._burstPending>0;
  const fired=gunOriginal.shoot.call(this);if(!fired)return false;
  if(continuous&&!w.windup&&this._cadenceOvershoot>0)this.fireCd=Math.max((60/w.rpm)*.01,this.fireCd-Math.min(this._cadenceOvershoot,60/w.rpm));
  this._cadenceOvershoot=0;
  if(this._burstStarting){this._burstPending=Math.min(2,this.mag);this._burstStarting=false;}
  else if(this._burstPending>0)this._burstPending--;
  if(w.fireMode==='pump')w.cycleRemaining=w.cycleTime;
  Game.syncGear();return true;
};
Player.prototype.update=function(dt,input){Gunplay.before(this,dt,input);const result=gunOriginal.update.call(this,dt,input);Gunplay.after(this);return result;};
Player.prototype.tryReload=function(){return Gunplay.startReload(this);};
Player.prototype.finishReloadIfDone=function(){return Gunplay.finishReload(this);};
Player.prototype.switchWeapon=function(i){const result=gunOriginal.switch.call(this,i);if(result)Gunplay.cancel(this,true);return result;};
Player.prototype.unloadWeapon=function(...args){const result=gunOriginal.unload.call(this,...args);if(result)Gunplay.cancel(this,true);return result;};
