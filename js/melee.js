/* Independent melee equipment and combat. Guns retain their three slots and magazine data. */
const MeleeSystem = {
  def(item) { return MELEE.find(d=>d.id===(typeof item==='string'?item:item?.equip?.melee)) || null; },
  locked() { return Game.state==='playing' && Game.player?.meleeAttack?.phase==='windup'; },
  normalize(item) { return item?.equip?.kind==='melee'?EQUIP.melee(item.equip.melee,item.equip.bound):null; },
  grant() {
    if(Save.meleeGiftClaimed)return;
    const gift=EQUIP.melee('melee01',true);
    if(!Save.gear.melee)Save.gear.melee=gift;
    else if(Save.stash.length<STASH_SLOTS)Save.addGearStash(gift);
    else return;
    Save.meleeGiftClaimed=true;Save.save();Save.flush();
  },
  state(p) { return p.meleeAttack?.phase || ((p.meleeClock||0)<(p.meleeReadyAt||0)?'recovery':'idle'); },
  cancel(p) { if(p)p.meleeAttack=null; },
  attack(p) {
    const d=this.def(p.melee);
    if(!d || !p.meleeActive || p.dead || p.dodgeT>0 || Game.state!=='playing' ||
      Game.bagOpen || Game.lootOpen || MedWheel.isOpen() || AmmoWheel.isOpen() ||
      (p.meleeClock||0)+1e-9<(p.meleeReadyAt||0))return false;
    Medical.cancel();Game.action=null;p.reloadT=0;p.reloadPending=false;
    p.meleeReadyAt=(p.meleeClock||0)+d.interval;
    const slashDirection=(p.meleeSwingIndex||0)%2===0?'lr':'rl';
    p.meleeSwingIndex=(p.meleeSwingIndex||0)+1;
    p.meleeAttack={phase:'windup',start:p.meleeClock||0,weapon:d,angle:p.angle,slashDirection,debug:[]};
    Game.sfx('melee');return true;
  },
  tick(p,dt) {
    p.meleeClock=(p.meleeClock||0)+dt;
    if(p.dead){this.cancel(p);return;}
    const a=p.meleeAttack;if(!a)return;
    const elapsed=p.meleeClock-a.start;
    if(a.phase==='windup')a.angle=p.angle;
    if(a.phase==='windup' && elapsed+1e-9>=a.weapon.windup) {
      a.phase='recovery';a.angle=p.angle; // aim and target positions at impact, never at button-down
      let landed = false;
      /* 一次挥砍只生成一份致伤元数据；命中多个目标时按 (attackId, 目标) 各判一次 */
      const hitMeta = Debuff.attack(a.weapon.attackType || 'sharp');
      for(const e of Game.enemies) {
        if(e.dead)continue;
        const hit=MeleeGeometry.hit(p,e,a.weapon,a.angle);
        if(hit.intersects)a.debug.push({x:e.x,y:e.y,r:e.r,point:hit.point});
        if(!hit.point)continue;
        /* 刀是真实伤害：护甲不减免，飘出来的就是纸面值。
           这类伤害单独用蓝色（Mana）飘字，和骨白的普通命中、橙金的爆头分开。 */
        const dealt = e.hurt(a.weapon.damage,'player','body',null,'trueDamage',hitMeta);
        Game.popDamage(e.x, e.y-20, dealt, {kind:'melee', key:e});
        if(dealt > 0) landed = true;
      }
      // 一次挥砍只播一次命中声；挥空、遮挡与取消均不会触发。
      // 后续刺刀在武器定义中指定 hitSfx: 'melee_hit_stab' 即可接入。
      if(landed) Game.sfx(a.weapon.hitSfx || 'melee_hit_small', {rate: 0.97 + Math.random() * 0.06});
    }
    if(elapsed+1e-9>=a.weapon.interval)this.cancel(p);
  },
  equipBag(index) {
    const p=Game.player,entry=p?.bag.slots[index],item=entry?.item;
    if(this.locked() || !this.def(item))return false;
    if(p.totalWeight>CFG.BAG.CARRY){Game.toast('负重过高，先清理背包');return false;}
    const old=p.melee;p.melee=this.normalize(item);this.cancel(p);
    if(old)p.bag.slots[index]={item:old,n:1};else p.bag.slots.splice(index,1);
    Game.syncGear();Game.renderBag();return true;
  },
  unequipRaid() {
    const p=Game.player;if(!p?.melee || this.locked())return false;
    if(p.bag.slots.length>=bagSlots() || p.totalWeight>CFG.BAG.CARRY){Game.toast('背包空间或负重不足');return false;}
    p.bag.slots.push({item:p.melee,n:1});p.melee=null;p.meleeActive=false;this.cancel(p);
    Game.syncGear();Game.renderBag();return true;
  },
  drawHUD(c,p) {
    const d=this.def(p.melee);if(!d)return;
    c.save();c.fillStyle='rgba(8,14,12,.78)';c.fillRect(14,CFG.VIEW_H-74,176,60);
    c.fillStyle=RARITY[d.r-1].color+'50';c.fillRect(24,CFG.VIEW_H-65,32,32);
    const img=Icons.gear[d.id];if(img)c.drawImage(img,24,CFG.VIEW_H-65,32,32);
    c.textAlign='left';c.font='12px monospace';c.fillStyle='#dbe5e1';c.fillText(d.short+' [4]',64,CFG.VIEW_H-49);
    c.font='10px monospace';c.fillStyle='#8fa8a0';
    c.fillText(({idle:'就绪',windup:'前摇',recovery:'恢复'})[this.state(p)]+' · 真实伤害 '+d.damage,64,CFG.VIEW_H-31);
    c.restore();
  },
  draw(c,camX,camY) {
    const p=Game.player;if(!p)return;
    const a=p.meleeAttack;
    if(a && p.meleeActive) {
      const r=a.weapon.radius*CFG.TILE,half=a.weapon.angle*Math.PI/360;
      c.save();c.translate(p.x-camX,p.y-camY);
      if(Game.debug) {
        c.beginPath();
        c.moveTo(0,0);
        c.arc(0,0,r,a.angle-half,a.angle+half);
        c.closePath();
        c.fillStyle='rgba(130,210,180,.18)';c.fill();
        c.strokeStyle='rgba(210,225,210,.5)';c.lineWidth=1;c.stroke();
      }
      c.restore();
      this.drawSlash(c,p,a,camX,camY);
      if(Game.debug)for(const h of (a.phase==='windup'?Game.enemies.filter(e=>!e.dead&&Math.hypot(e.x-p.x,e.y-p.y)<a.weapon.radius*CFG.TILE+e.r).map(e=>({x:e.x,y:e.y,r:e.r,point:MeleeGeometry.hit(p,e,a.weapon,p.angle).point})):a.debug)){c.save();c.strokeStyle=h.point?'#7fd':'#f85';c.beginPath();c.arc(h.x-camX,h.y-camY,h.r,0,Math.PI*2);c.stroke();if(h.point)c.fillRect(h.point.x-camX-1,h.point.y-camY-1,3,3);c.restore();}
    }
  },
  slashLayout(d) {
    const radius=d.radius*CFG.TILE,half=d.angle*Math.PI/360;
    return {radius,half,width:2*radius*Math.sin(half),height:radius*.85,duration:.24,hold:.08,thrust:d.vfx==='thrust'};
  },
  // 外缘固定在半径内；所有厚度向内增长，左右挥砍只改变粗细方向。
  slashBand(c,r,half,direction,border) {
    const start=-Math.PI/2-half,end=-Math.PI/2+half,n=Math.max(16,Math.ceil(r*half*2));
    const inset=border?0:.5,outer=r-inset;
    c.beginPath();c.arc(0,0,outer,start,end);
    for(let i=n;i>=0;i--){
      const u=i/n,t=direction==='rl'?u:1-u;
      const width=.65+(1.1+r*.055)*Math.pow(t,1.15)+(border?1:0);
      const a=start+(end-start)*u,inner=Math.max(0,outer-width);
      c.lineTo(Math.cos(a)*inner,Math.sin(a)*inner);
    }
    c.closePath();c.fillStyle=border?'#303c39':'#f2eedc';c.fill();
  },
  drawSlash(c,p,a,camX,camY) {
    const age=p.meleeClock-a.start-a.weapon.windup,layout=this.slashLayout(a.weapon);
    const preparing=a.phase==='windup';
    if(!preparing&&(a.phase!=='recovery'||age<0||age>=layout.duration))return;
    const direction=a.slashDirection||'lr';
    const image=Art.get('effects',layout.thrust?'melee_thrust':'melee_slash_'+direction);
    const opacity=preparing ? .19 : age<=layout.hold ? .94 : .94*Math.pow(1-(age-layout.hold)/(layout.duration-layout.hold),.8);
    c.save();c.translate(p.x-camX,p.y-camY);c.rotate(a.angle+Math.PI/2);
    // 模板只负责纹理，轮廓按真实半径和扇角绘制；贴图始终裁切在判定范围内。
    c.beginPath();c.moveTo(0,0);c.arc(0,0,layout.radius,-Math.PI/2-layout.half,-Math.PI/2+layout.half);c.closePath();c.clip();
    c.globalAlpha=opacity;c.fillStyle='rgba(202,213,207,.09)';c.fill();
    if(!preparing&&image){
      c.globalAlpha=opacity*.55;c.imageSmoothingEnabled=false;
      c.drawImage(image,4,4,image.naturalWidth-8,image.naturalHeight-8,-layout.width/2,-layout.radius,layout.width,layout.thrust?layout.radius:layout.height);
    }
    c.globalAlpha=opacity;
    if(layout.thrust){
      const r=layout.radius,w=r*Math.tan(layout.half)*.42;
      c.beginPath();c.moveTo(0,-r);c.lineTo(w,-r*.55);c.lineTo(0,-r*.18);c.lineTo(-w,-r*.55);c.closePath();
      c.fillStyle='rgba(208,218,211,.18)';c.fill();
      c.strokeStyle='#303c39';c.lineWidth=2;c.stroke();
      c.beginPath();c.moveTo(-w,-r*.55);c.lineTo(0,-r);c.lineTo(w,-r*.55);
      c.strokeStyle='#f2eedc';c.lineWidth=.85;c.stroke();
    }else{
      this.slashBand(c,layout.radius,layout.half,direction,true);
      this.slashBand(c,layout.radius,layout.half,direction,false);
    }
    c.restore();
  }
};

// Transient combat effects, not placeable scenery or collision objects.
/* 追加而不是覆盖：ART.effects 里还挂着别的一次性用图（伤害飘字的位图字体图集），
   直接赋值会把它们从预加载表里挤掉，进游戏后数字永远画不出来。 */
ART.effects=[...new Set([...(ART.effects||[]),'melee_slash_lr','melee_slash_rl','melee_thrust'])];

/* Exact sector-circle overlap; angular partitioning tests all visibility-changing boundaries.
   Rectangle corners and rectangle/circle intersections split the target into visible intervals. */
const MeleeGeometry = {
  rayCircle(p,e,a) {
    const dx=e.x-p.x,dy=e.y-p.y,cs=Math.cos(a),sn=Math.sin(a),t=dx*cs+dy*sn;
    const q=e.r*e.r-(dx*dx+dy*dy-t*t);if(q < -1e-8)return null;
    const root=Math.sqrt(Math.max(0,q));if(t+root<0)return null;return Math.max(0,t-root);
  },
  rayRect(p,a,r) {
    let lo=0,hi=Infinity;const v=[Math.cos(a),Math.sin(a)],s=[p.x,p.y];
    for(let k=0;k<2;k++){
      if(Math.abs(v[k])<1e-10){if(s[k]<r[k]||s[k]>r[k]+r[k+2])return Infinity;}
      else {let t0=(r[k]-s[k])/v[k],t1=(r[k]+r[k+2]-s[k])/v[k];if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(lo,t0);hi=Math.min(hi,t1);}
    }
    return hi>=lo?lo:Infinity;
  },
  blockers(p,R) {
    const rects=[],S=CFG.TILE;
    for(let y=Math.max(0,Math.floor((p.y-R)/S)-1);y<Math.min(M.H,Math.ceil((p.y+R)/S)+1);y++)
      for(let x=Math.max(0,Math.floor((p.x-R)/S)-1);x<Math.min(M.W,Math.ceil((p.x+R)/S)+1);x++){
        const t=M.at(x,y);
        if((t.solid&&!t.permanentWater) || t.container || (t.door&&!t.door.open) || (t.prop&&!t.prop.ground))rects.push([x*S,y*S,S,S]);
        // Wall faces occupy the north half-cell too, matching actual movement collision.
        if(M.wallCell(t))rects.push([x*S,y*S-S/2,S,S*1.5]);
      }
    return rects;
  },
  hit(p,e,d,angle) {
    const R=d.radius*CFG.TILE,half=d.angle*Math.PI/360,dx=e.x-p.x,dy=e.y-p.y,dist=Math.hypot(dx,dy);
    if(dist>R+e.r+1e-8)return {intersects:false,point:null};
    const angles=[-half,half],add=a=>{const t=U.angDiff(a,angle);if(t>=-half-1e-8&&t<=half+1e-8)angles.push(U.clamp(t,-half,half));};
    const center=Math.atan2(dy,dx);add(center);
    if(dist>e.r){const tang=Math.asin(e.r/dist);add(center-tang);add(center+tang);}
    if(dist>1e-8&&dist+e.r>=R&&dist+R>=e.r){const v=U.clamp((dist*dist+R*R-e.r*e.r)/(2*dist*R),-1,1),a=Math.acos(v);add(center-a);add(center+a);}
    const rects=this.blockers(p,R);
    for(const r of rects){
      for(const x of [r[0],r[0]+r[2]])for(const y of [r[1],r[1]+r[3]])add(Math.atan2(y-p.y,x-p.x));
      for(let axis=0;axis<2;axis++)for(const edge of [r[axis],r[axis]+r[axis+2]]){
        const delta=edge-(axis?e.y:e.x),q=e.r*e.r-delta*delta;if(q<0)continue;
        for(const v of [-Math.sqrt(q),Math.sqrt(q)]){
          const x=axis?e.x+v:edge,y=axis?edge:e.y+v;
          if(x>=r[0]-1e-8&&x<=r[0]+r[2]+1e-8&&y>=r[1]-1e-8&&y<=r[1]+r[3]+1e-8)add(Math.atan2(y-p.y,x-p.x));
        }
      }
    }
    angles.sort((a,b)=>a-b);const samples=angles.slice();
    for(let i=1;i<angles.length;i++)samples.push((angles[i-1]+angles[i])/2);
    let intersects=false;
    for(const delta of samples){const a=angle+delta,t=this.rayCircle(p,e,a);if(t===null||t>R+1e-8)continue;intersects=true;
      if(rects.every(r=>this.rayRect(p,a,r)>t+1e-7))return {intersects:true,point:{x:p.x+Math.cos(a)*t,y:p.y+Math.sin(a)*t}};
    }
    return {intersects,point:null};
  }
};

/* Narrow integration hooks keep ammunition and armour behaviour unchanged. */
function meleeWrap(object,key,fn){const original=object[key];object[key]=function(...args){return fn.call(this,original,...args);};}
meleeWrap(Save,'load',function(original,...args){const r=original.apply(this,args);MeleeSystem.grant();return r;});
meleeWrap(Base,'open',function(original,...args){MeleeSystem.grant();return original.apply(this,args);});
meleeWrap(Game,'startRun',function(original,...args){original.apply(this,args);this.player.melee=MeleeSystem.normalize(Save.gear.melee);this.player.meleeActive=!this.player.weapons.some(Boolean)&&!!this.player.melee;});
const originalWeight=Object.getOwnPropertyDescriptor(Player.prototype,'totalWeight').get;
Object.defineProperty(Player.prototype,'totalWeight',{get(){return originalWeight.call(this)+(this.melee?.w||0);}});
Player.prototype.switchMelee=function(){
  if(MeleeSystem.locked())return false;
  if(!this.melee){Game.toast('近战槽是空的');return false;}
  const wasActive=this.meleeActive;
  Medical.cancel();AmmoQuick.cancel();MedQuick.cancel();this.reloadT=0;this.reloadPending=false;this.meleeActive=true;
  MeleeSystem.cancel(this);Game.renderGearPanel();
  /* 枪 → 刀：换成拔刃出鞘那一段；素材没加载上时 SFX 自己退回滑套声 */
  if(!wasActive)Game.sfx('switchMelee',{rate:0.98});
  return true;
};
meleeWrap(Player.prototype,'switchWeapon',function(original,i){
  if(MeleeSystem.locked())return false;
  const active=this.meleeActive,r=original.call(this,i);
  if((r || i===this.slot)&&this.weapons[i]){
    this.meleeActive=false;MeleeSystem.cancel(this);
    if(active){
      this.fireCd=Math.max(this.fireCd,.28);
      /* 刀 → 枪：按的是当前枪的槽位时 switchWeapon 会提前返回、什么都不播，
         这个方向以前是全程无声的，这里补上 */
      if(!r)Game.sfx(SWITCH_MODEL[this.weapons[i].id]||SWITCH_SFX[this.weapons[i].category]||'shot_switch');
    }
    return true;
  }
  return r;
});
meleeWrap(Player.prototype,'tryShoot',function(original){return this.meleeActive?MeleeSystem.attack(this):original.call(this);});
for(const key of ['tryReload','loadAmmo','unloadWeapon'])meleeWrap(Player.prototype,key,function(original,...args){if(MeleeSystem.locked()||this.meleeActive)return false;return original.apply(this,args);});
meleeWrap(Player.prototype,'update',function(original,dt,input){
  const windup=this.meleeAttack?.phase==='windup';
  if(windup)input={...input,dodge:false};else if(input.dodge)MeleeSystem.cancel(this);
  original.call(this,dt,input);
  MeleeSystem.tick(this,dt);
});
for(const key of ['toggleBag','openLoot','handleInteract','equipFromBag'])meleeWrap(Game,key,function(original,...args){if(MeleeSystem.locked())return false;MeleeSystem.cancel(this.player);return original.apply(this,args);});
for(const q of [MedQuick,AmmoQuick])meleeWrap(q,'press',function(original,...args){if(MeleeSystem.locked())return false;MeleeSystem.cancel(Game.player);return original.apply(this,args);});
meleeWrap(Medical,'use',function(original,...args){if(MeleeSystem.locked())return false;MeleeSystem.cancel(Game.player);return original.apply(this,args);});
for(const w of [MedWheel,AmmoWheel])meleeWrap(w,'open',function(original,...args){if(MeleeSystem.locked())return false;MeleeSystem.cancel(Game.player);return original.apply(this,args);});
meleeWrap(Game,'renderParticles',function(original,c,x,y){original.call(this,c,x,y);MeleeSystem.draw(c,x,y);});

meleeWrap(Base,'slotKind',function(original,key){return key==='melee'?'melee':original.call(this,key);});
meleeWrap(Base,'slotLabel',function(original,key){return key==='melee'?'近战武器':original.call(this,key);});
meleeWrap(Base,'stashEquip',function(original,key){return key==='melee'?Save.stash.filter(e=>MeleeSystem.def(stashItem(e))):original.call(this,key);});
meleeWrap(Base,'renderGear',function(original){original.call(this);const el=document.getElementById('baseGear');if(!el)return;
  const it=Save.gear.melee,d=MeleeSystem.def(it),row=document.createElement('div');row.className='slot'+(it?'':' empty');
  row.innerHTML='<div class="slot-ico">'+Icons.gearIcon(d?.id,'刀')+'</div><div class="slot-txt"><b>'+esc(d?.name||'未装备近战武器')+'</b><span>'+(d?'真实伤害 '+d.damage+' · '+d.radius+'格 · '+(it.equip.bound?'绑定 · ':''):'')+'点击从仓库选择</span></div>';
  row.onclick=()=>this.togglePicker('melee',row);this.bindGearMenu(row,'melee');el.appendChild(row);
});
meleeWrap(Base,'renderPicker',function(original){if(this.picker!=='melee')return original.call(this);
  const box=document.getElementById('gearPicker');box.innerHTML='';box.style.display='';
  const cur=Save.gear.melee;if(cur)box.appendChild(this.pickerRow({fb:'空',name:'卸下近战武器',sub:'放回仓库',click:()=>this.unequip('melee')}));
  for(const entry of this.stashEquip('melee')){const it=stashItem(entry),d=MeleeSystem.def(it);box.appendChild(this.pickerRow({icon:d.id,fb:'刀',name:d.name,sub:'真实伤害 '+d.damage+' · '+d.w+'kg'+(it.equip.bound?' · 绑定':''),click:()=>this.equipFromStash(entry,'melee')}));}
  box.appendChild(this.pickerRow({fb:'×',name:'取消',sub:'',click:()=>this.closePicker()}));this.placePicker(box);
});
meleeWrap(Base,'equipFromStash',function(original,entry,key){if(key!=='melee')return original.call(this,entry,key);
  const it=stashItem(entry);if(!Save.stash.includes(entry)||!MeleeSystem.def(it))return false;
  const pWeight=Save.bagWeight()+Save.gear.weapons.reduce((n,w)=>n+(w?.w||0),0)+(Save.gear.body?.w||0)+(Save.gear.helmet?.w||0)+(Save.gear.back?.w||0)+it.w;
  if(pWeight>CFG.BAG.CARRY){this.note('装备后负重过高',true);return false;}
  Save.stash.splice(Save.stash.indexOf(entry),1);const old=Save.gear.melee;
  Save.gear.melee=MeleeSystem.normalize(it);if(old)Save.addGearStash(old);
  Save.save();this.closePicker();this.render();this.gearVoice('melee',false);return true;
});
meleeWrap(Base,'unequip',function(original,key){if(key!=='melee')return original.call(this,key);
  if(!Save.gear.melee)return false;if(Save.stash.length>=STASH_SLOTS){this.note('仓库已满',true);return false;}
  Save.addGearStash(Save.gear.melee);Save.gear.melee=null;Save.save();this.closePicker();this.render();this.gearVoice('melee',true);return true;
});
for(const key of ['askSell','sell'])meleeWrap(Base,key,function(original,e,...args){if(stashItem(e)?.equip?.bound){this.note('首次赠送的绑定刀具不可出售',true);return false;}return original.call(this,e,...args);});
Base.buyMelee=function(id){const d=MeleeSystem.def(id);if(!d?.available||Save.credits<buyPrice(d.price)||Save.stash.length>=STASH_SLOTS)return false;
  Save.credits-=buyPrice(d.price);Save.addGearStash(EQUIP.melee(id));Save.save();this.render();return true;
};
meleeWrap(Base,'renderGunShop',function(original,el){original.call(this,el);const title=document.createElement('div');title.className='shop-cat';title.textContent='近战武器';el.appendChild(title);
  for(const d of MELEE.filter(d=>d.available)){const cell=document.createElement('div');cell.className='scell r'+d.r;cell.dataset.melee=d.id;
    cell.innerHTML=Icons.gearIcon(d.id,'刀')+'<span class="cn">'+esc(d.short)+'</span><span class="pr">'+formatMoney(buyPrice(d.price))+'</span>';
    cell.onclick=()=>Deal.show({kind:'buy',title:'买入近战武器',name:d.name,sub:'真实伤害 '+d.damage+' · '+d.w+'kg',icon:d.id,price:buyPrice(d.price),can:Save.credits>=buyPrice(d.price)&&Save.stash.length<STASH_SLOTS,onGo:()=>this.buyMelee(d.id)},cell.getBoundingClientRect());
    cell.oncontextmenu=e=>{e.preventDefault();Tips.show(EQUIP.melee(d.id),cell.getBoundingClientRect(),'左键买入');};el.appendChild(cell);
  }
});
meleeWrap(Game,'renderGearPanel',function(original){original.call(this);const p=this.player,el=document.getElementById('eqStrip');if(!p||!el)return;
  if(p.meleeActive)for(const node of el.querySelectorAll('.eqs.on'))node.classList.remove('on');
  const cell=document.createElement('div'),d=MeleeSystem.def(p.melee);cell.className='eqs live'+(p.meleeActive?' on':'');cell.dataset.melee='slot';
  cell.innerHTML='<span class="lbl">近战 [4]</span><span class="ic">'+Icons.gearIcon(d?.id,'刀')+'</span><span class="tag">'+(d?d.damage+' 真伤':'空')+'</span>';
  /* 和武器格同一套手势：单击切近战，双击看详情，右键出菜单 */
  const swap=()=>{p.switchMelee();this.renderGearPanel();};
  if(d)Game.bindItem(cell,{it:p.melee,click:swap,quick:swap,quickLabel:'切到近战',primary:null,
    extraActs:[{label:'卸下到背包',onClick:()=>MeleeSystem.unequipRaid()}],
    drop:()=>this.dropMelee(),hint:'双击看详情 · 4 切换近战'});
  else cell.onclick=swap;
  el.appendChild(cell);
});

// Dropped knives follow the existing equipment pickup path, retaining the binding marker.
meleeWrap(Game,'takeGear',function(original,entry,index){
  const item=entry?.item,p=this.player;
  if(item?.equip?.kind!=='melee')return original.call(this,entry,index);
  if(!p || MeleeSystem.locked() || !this.lootOpen || this.lootOpen.items[index]!==entry)return false;
  if(p.totalWeight+item.w>CFG.BAG.CARRY){this.toast('太重了');return false;}
  if(!p.melee)p.melee=MeleeSystem.normalize(item);
  else {const check=p.bag.canAdd(item,1);if(!check.ok){this.toast(check.why);return false;}p.bag.add(item,1);}
  this.lootOpen.items[index]=null;this.syncGear();this.syncBoxState(this.lootOpen);
  if(this.lootOpen)this.renderLootList();this.renderBag();return true;
});
meleeWrap(Base,'toStash',function(original,entry){if(stashItem(entry)?.equip?.kind==='melee' && Save.stash.length>=STASH_SLOTS){this.note('仓库已满',true);return false;}return original.call(this,entry);});

// Animation selection is cosmetic; hit timing is exclusively driven by the combat state.
for(const state of ['idle','walk',...MELEE.map(d=>d.id)]){
  const key='melee_'+state;PLAYER_ANIMS[key]={frames:state==='idle'?2:4,fps:state==='idle'?2:8,loop:['idle','walk'].includes(state),size:64};
  // Art.init reads PLAYER_ANIMS at boot and loads the same three direction strips.
}
meleeWrap(Art,'drawChar',function(original,c,id,angle,x,y,holder,alpha){
  if(id!=='player'||!holder?.meleeActive||holder.dead||holder.dodgeT>0)return original.call(this,c,id,angle,x,y,holder,alpha);
  const a=holder.meleeAttack,originalAnim=holder.anim;let state='melee_'+(holder.frameTravel>.01?'walk':'idle'),time=originalAnim?.time||0;
  if(a){state='melee_'+a.weapon.id;const elapsed=holder.meleeClock-a.start;time=a.phase==='windup'?Math.min(1.999,elapsed/a.weapon.windup*2):2+Math.min(1.999,(elapsed-a.weapon.windup)/(a.weapon.interval-a.weapon.windup)*2);time/=8;}
  holder.anim={state,time};const facing=a?.phase==='recovery'?a.angle:angle;
  try{return original.call(this,c,id,facing,x,y,holder,alpha);}finally{holder.anim=originalAnim;}
});
