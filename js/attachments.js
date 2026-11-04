/* Pure gun derivation and one inventory transaction path for hideout and raid. */
const Attachments={
  slotNames:{optic:'瞄具',grip:'握把',stock:'枪托',muzzle:'枪口',magazine:'弹匣'},
  modifierNames:{aimTime:'瞄准时间',baseSpread:'基础散布',spreadGrowth:'连射散布增长',recoilHorizontal:'横向后坐力',recoilVertical:'纵向后坐力',recoilRecovery:'双轴回正速度',reloadTime:'装填时间',magazineCapacity:'弹匣容量',pelletSpread:'弹丸扩散'},
  compatible(gun,id,slot){const w=typeof gun==='string'?WEAPONS[canonicalWeaponId(gun)]:gun,a=ATTACHMENT_DEFS[id];return !!(w&&a&&a.subtype===(slot||a.subtype)&&w.attachmentSlots?.[a.subtype]&&a.compatibleTags.every(t=>w.attachmentTags.includes(t)));},
  normalize(id,input){const w=WEAPONS[canonicalWeaponId(id)],installed={},invalid=[];
    if(!input||typeof input!=='object')return{installed,invalid};
    for(const [slot,part]of Object.entries(input)){if(part==null||part==='')continue;if(w&&this.compatible(w,part,slot))installed[slot]=part;else invalid.push({slot,id:part,known:!!ATTACHMENT_DEFS[part]});}return{installed,invalid};},
  resolve(id,input){const base=WEAPONS[canonicalWeaponId(id)];if(!base)return null;
    const {installed}=this.normalize(base.id,input),mods={};let mass=0,value=0;
    for(const part of Object.values(installed)){const a=ATTACHMENT_DEFS[part];mass+=a.w;value+=a.price;for(const [k,v]of Object.entries(a.statModifiers))if(Number.isFinite(v))mods[k]=(mods[k]||0)+v;}
    const mul=(k,min)=>Math.max(min,1+(mods[k]||0));
    return {...base,attachments:{...installed},attachmentModifiers:mods,
      aimTime:base.aimTime*mul('aimTime',.6),spreadBase:base.spreadBase*mul('baseSpread',.5),
      recoilPerShot:base.recoilPerShot*mul('spreadGrowth',.5),recoilHMul:base.recoilHMul*mul('recoilHorizontal',.5),recoilVMul:base.recoilVMul*mul('recoilVertical',.5),
      recoilRecovery:mul('recoilRecovery',.1),reloadTime:base.reloadTime*mul('reloadTime',.6),pelletSpread:base.pelletSpread*mul('pelletSpread',.5),
      mag:mods.magazineCapacity?Math.max(base.mag+1,Math.floor(base.mag*(1+mods.magazineCapacity)+1e-9)):base.mag,
      w:base.w+mass,price:base.price+value};
  },
  slotState(id,installed,slot){const w=WEAPONS[canonicalWeaponId(id)];return !w?.attachmentSlots?.[slot]?'disabled':this.normalize(id,installed).installed[slot]?'installed':'empty';},
  item(id){const d=ATTACHMENT_DEFS[id];return d?{id:'g_'+id,name:d.name,short:d.name,cat:'gear',r:d.r,w:d.w,price:d.price,sell:Math.floor(d.price/2),stack:1,noCodex:true,icon:id,desc:d.description,equip:{kind:'attachment',attachment:id}}:null;},
  describe(id){const a=ATTACHMENT_DEFS[id];return a?Object.entries(a.statModifiers).map(([k,v])=>this.modifierNames[k]+' '+(v>0?'+':'')+Math.round(v*100)+'%').join(' · '):'';},
  entryItem(e){return e?.item||e?.gear||(e&&ITEM_BY_ID[e.id])||null;},
  targets(){const out=[],raid=Game.state==='playing',add=(owner,index,entry,item)=>{if(item?.equip?.kind==='gun')out.push({owner,index,entry,ref:item,name:item.name});};
    if(raid){const p=Game.player;if(!p||p.dead)return out;p.weapons.forEach((w,i)=>{if(w)out.push({owner:'raid-equipped',index:i,ref:w,name:w.name});});p.bag.slots.forEach((e,i)=>add('raid-bag',i,e,e.item));}
    else if(Game.state==='base'){Save.gear.weapons.forEach((e,i)=>add('base-equipped',i,null,e));Save.bag.forEach((e,i)=>add('base-bag',i,e,this.entryItem(e)));Save.stash.forEach((e,i)=>add('stash',i,e,this.entryItem(e)));}return out;
  },
  read(t){if(!t)return null;const raid=t.owner.startsWith('raid');if(raid!==(Game.state==='playing')||(!raid&&Game.state!=='base'))return null;
    if(t.owner==='raid-equipped'){const p=Game.player,w=p?.weapons[t.index];return w===t.ref?Gunplay.snapshot(w,t.index===p.slot?p.mag:w.magCur):null;}
    if(t.owner==='base-equipped')return Save.gear.weapons[t.index]===t.ref?t.ref:null;
    const list=t.owner==='raid-bag'?Game.player?.bag.slots:t.owner==='base-bag'?Save.bag:t.owner==='stash'?Save.stash:null,e=list?.[t.index];return e===t.entry&&this.entryItem(e)===t.ref?t.ref:null;
  },
  inventory(){return Game.state==='playing'?Game.player.bag.slots:Save.stash;},
  findTarget(item){return this.targets().find(t=>t.ref===item||t.entry===item)||null;},
  blocked(t){if(Game.state==='base')return '';const p=Game.player;if(Game.state!=='playing'||!p||p.dead)return '当前无法改装';
    if(p.reloadPending||p.reloadT>0)return '装填结束后可改装';
    if(p.weapon.cycleRemaining>0||(t.owner==='raid-equipped'&&t.ref.cycleRemaining>0)||t.ref.equip?.cycleRemaining>0)return '泵动结束后可改装';
    if(p.shotAnimT>0||p.windupShot||p._burstPending>0)return '射击动作结束后可改装';
    if(p.dodgeT>0)return '闪避结束后可改装';if(typeof MeleeSystem!=='undefined'&&MeleeSystem.locked())return '近战前摇结束后可改装';
    if(Game.action)return ({heal:'治疗',extract:'撤离',search:'搜刮',corpse:'搜刮'}[Game.action.type]||'当前动作')+'结束后可改装';return '';
  },
  carriedWeight(){return Save.bagWeight()+Save.safeWeight()+Save.gear.weapons.reduce((n,w)=>n+(w?.w||0),0)+(Save.gear.helmet?.w||0)+(Save.gear.body?.w||0)+(Save.gear.back?.w||0)+(Save.gear.melee?.w||0);},
  preview(t,slot,id,source){const current=this.read(t);if(!current)return{ok:false,reason:'枪械位置已变化，请重新选择'};
    const eq=current.equip,before=this.resolve(eq.gun,eq.attachments),nextParts={...before.attachments};
    if(!before.attachmentSlots?.[slot])return{ok:false,reason:'此枪不支持该槽位',before};
    if(id&&!this.compatible(before.id,id,slot))return{ok:false,reason:'配件与枪械不兼容',before};
    const old=nextParts[slot]||null;if(old===(id||null))return{ok:false,reason:old?'已安装该配件':'槽位为空',before};
    if(id)nextParts[slot]=id;else delete nextParts[slot];const after=this.resolve(before.id,nextParts),raid=t.owner.startsWith('raid');
    const result={ok:false,before,after,target:t,slot,id,old,reason:this.blocked(t)};
    const inv=this.inventory(),src=id?(source||inv.find(e=>this.entryItem(e)?.equip?.attachment===id)):null;
    if(id&&(!inv.includes(src)||this.entryItem(src)?.equip?.attachment!==id))return{...result,reason:'配件已不在可用库存中'};
    const rows=inv.filter(e=>e!==src).map(e=>({entry:e,value:{...e}}));
    const wrap=(item,n=1)=>raid?{item,n}:{id:item.id,n,...(item.equip?{gear:item}:{})};
    if(old)rows.push({entry:null,value:wrap(this.item(old))});
    const rounds=magazineRounds(before,eq.mag,eq.ammo,eq.rounds),extra=rounds.slice(after.mag),kept=rounds.slice(0,after.mag);
    const gun=EQUIP.gun(eq.gun,kept.length,eq.ammo,kept,{...eq,attachments:nextParts});
    if(t.owner==='stash'||t.owner==='raid-bag'){const row=rows.find(r=>r.entry===t.entry);if(!row)return{...result,reason:'枪械已不在库存中'};if(raid)row.value.item=gun;else row.value.gear=gun;}
    for(const ammo of extra){const it=AMMO_BY_ID[ammo],row=rows.find(r=>this.entryItem(r.value)?.id===ammo&&r.value.n<stackLimit(it));if(row)row.value.n++;else rows.push({entry:null,value:wrap(it)});}
    const next=rows.map(r=>r.value),limit=raid?bagSlots():STASH_SLOTS;
    if(next.length>limit)return{...result,reason:raid?'背包空间不足，无法返还物品或余弹':'仓库空间不足，无法返还物品或余弹',extra};
    const mass=list=>list.reduce((n,e)=>n+this.entryItem(e).w*(e.n||1),0),was=raid?Game.player.totalWeight:this.carriedWeight();
    const diff=raid?mass(next)-mass(inv)+(t.owner==='raid-equipped'?gun.w-current.w:0):t.owner!=='stash'?gun.w-current.w:0;
    if(was+diff>CFG.BAG.CARRY+1e-6&&diff>1e-6)return{...result,reason:'改装后负重过高',extra};
    return{...result,ok:!result.reason,next,gun,extra,source:src};
  },
  // Vendor providers are independent of the UI, so additional merchants can be added here.
  vendors(){return [{id:'gun',offers:Object.values(ATTACHMENT_DEFS).filter(d=>d.r<=3).map(d=>({id:d.id,price:d.price}))}];},
  offer(id){for(const vendor of this.vendors()){const item=vendor.offers.find(o=>o.id===id);if(item&&Number.isFinite(item.price)&&item.price>=0)return {...item,vendor:vendor.id};}return null;},
  plan(t,draft){
    const current=this.read(t);if(Game.state!=='base'||!current)return {ok:false,reason:'枪械位置已变化，请重新选择'};
    const eq=current.equip,before=this.resolve(eq.gun,eq.attachments),parts={...before.attachments},changes=[],used=new Set(),buys=[];
    for(const [slot,id]of Object.entries(draft||{})){
      if(!ATTACHMENT_SLOTS.includes(slot)||!before.attachmentSlots[slot]||(id&&!this.compatible(eq.gun,id,slot)))return {ok:false,reason:'配件与枪械槽位不兼容'};
      const old=parts[slot]||null;if(old===(id||null))continue;
      if(id){const source=Save.stash.find(e=>!used.has(e)&&this.entryItem(e)?.equip?.attachment===id);if(source)used.add(source);else{const offer=this.offer(id);if(!offer)return {ok:false,reason:'所选配件未拥有，且暂无出售来源'};buys.push(offer);}parts[slot]=id;}else delete parts[slot];
      changes.push({slot,id,old});
    }
    const after=this.resolve(eq.gun,parts),rows=Save.stash.filter(e=>!used.has(e)).map(e=>({...e}));
    for(const c of changes)if(c.old){const item=this.item(c.old);rows.push({id:item.id,n:1,gear:item});}
    const rounds=magazineRounds(before,eq.mag,eq.ammo,eq.rounds),extra=rounds.slice(after.mag),gun=EQUIP.gun(eq.gun,Math.min(rounds.length,after.mag),eq.ammo,rounds.slice(0,after.mag),{...eq,attachments:parts});
    if(t.owner==='stash'){const index=Save.stash.filter(e=>!used.has(e)).indexOf(t.entry);if(index<0)return {ok:false,reason:'枪械位置已变化'};rows[index]={...rows[index],gear:gun,id:gun.id};}
    for(const id of extra){const item=AMMO_BY_ID[id],row=rows.find(e=>e.id===id&&!e.gear&&e.n<stackLimit(item));if(row)row.n++;else rows.push({id,n:1});}
    const total=buys.reduce((n,b)=>n+b.price,0),groups=[];for(const b of buys){let g=groups.find(x=>x.vendor===b.vendor);if(!g){g={vendor:b.vendor,items:[]};groups.push(g);}g.items.push(b);}
    const quote=JSON.stringify({gun:eq,changes,buys,owned:[...used].map(e=>this.entryItem(e).equip.attachment)});
    const diff=t.owner==='stash'?0:gun.w-current.w;
    const reason=!changes.length?'请选择要改装的配件':rows.length>STASH_SLOTS?'仓库空间不足，无法返还配件或余弹':diff>1e-6&&this.carriedWeight()+diff>CFG.BAG.CARRY+1e-6?'改装后负重过高':Save.credits<total?'信用点不足':'';
    return {ok:!reason,reason,before,after,gun,next:rows,changes,buys,groups,total,quote,extra};
  },
  commitPlan(t,draft,quote){const r=this.plan(t,draft);if(!r.ok)return r;if(quote!==r.quote)return {...r,ok:false,reason:'购买内容或枪械状态已变化，请重新确认'};
    Save.stash=r.next;Save.credits-=r.total;
    if(t.owner==='base-equipped')Save.gear.weapons[t.index]=r.gun;
    else if(t.owner==='base-bag')Save.bag[t.index]={...Save.bag[t.index],gear:r.gun,id:r.gun.id};
    Save.save();Save.flush();return {...r,target:this.findTarget(r.gun)};
  },
  commit(t,slot,id,source){const r=this.preview(t,slot,id,source);if(!r.ok)return r;
    const raid=t.owner.startsWith('raid'),p=Game.player;
    if(raid){p.bag.slots=r.next;if(t.owner==='raid-equipped'){const e=r.gun.equip;p.weapons[t.index]={...r.after,ammo:e.ammo,rounds:[...e.rounds],magCur:e.mag,fireMode:e.fireMode,cycleRemaining:e.cycleRemaining};if(p.slot===t.index){p.mag=e.mag;p.resetAim();}}Game.syncGear();Save.flush();}
    else{Save.stash=r.next;if(t.owner==='base-equipped')Save.gear.weapons[t.index]=r.gun;else if(t.owner==='base-bag')Save.bag[t.index]={...Save.bag[t.index],gear:r.gun,id:r.gun.id};Save.save();Save.flush();}
    const ref=t.owner==='raid-equipped'?p.weapons[t.index]:r.gun;return{...r,target:this.targets().find(x=>x.ref===ref),ok:true};
  }
};
EQUIP.attachment=id=>Attachments.item(id);
