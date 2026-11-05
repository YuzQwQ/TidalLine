/* One workshop overlay, shared by warehouse, loadout and raid. */
const ModUI={
  el:null,target:null,slot:'optic',selection:null,timer:null,
  ownerLabel(t){return ({'base-equipped':'已装备','raid-equipped':'已装备','base-bag':'携带背包','raid-bag':'背包',stash:'仓库'})[t.owner]+' · '+(t.index+1);},
  openTarget(t){if(!Attachments.read(t)){Game.toast('枪械位置已变化，请重新选择');return false;}
    this.target=t;this.selection=null;this.slot='optic';this.open();return true;},
  openWithPart(entry){const inv=Attachments.inventory();if(!inv.includes(entry)){Game.toast('请先将配件移出安全箱');return false;}
    const id=Attachments.entryItem(entry)?.equip?.attachment,d=ATTACHMENT_DEFS[id];if(!d)return false;
    this.target=Attachments.targets().find(t=>Attachments.compatible(Attachments.read(t).equip.gun,id))||Attachments.targets()[0]||null;this.slot=d.subtype;this.selection={id,source:entry};this.open();return true;},
  open(){if(!this.el){this.el=document.createElement('section');this.el.id='modOverlay';this.el.className='mod-overlay';this.el.setAttribute('role','dialog');this.el.setAttribute('aria-label','枪械改装');document.body.appendChild(this.el);
      this.el.addEventListener('click',e=>{if(e.target===this.el)this.close();});
      window.addEventListener('keydown',e=>{if(this.el.hidden)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.close();}},true);
    }
    if(Game.state==='playing'&&!Game.bagOpen)Game.toggleBag({silent:true});Game.input.mouseDown=false;Game.input.mousePressed=false;Game.releaseLock();Tips.hide();Ctx.hide();Deal.hide();
    this.el.hidden=false;this.render();clearInterval(this.timer);this.timer=setInterval(()=>this.refresh(),100);
  },
  close(){if(this.el)this.el.hidden=true;clearInterval(this.timer);this.timer=null;},
  refresh(){if(!['playing','base'].includes(Game.state)||Game.player?.dead&&Game.state==='playing'){this.close();return;}
    const it=Attachments.read(this.target),sig=JSON.stringify([it?.equip,Attachments.inventory().map(e=>[e.id||e.item?.id,e.n]),this.target&&Attachments.blocked(this.target)]);
    if(sig!==this.sig)this.render();
  },
  stats(w){const b=WEAPONS[w.id];return[
    ['瞄准时间',w.aimTime,'秒',false],['基础散布',w.spreadBase*180/Math.PI,'°',false],['横向后坐力',w.recoilHMul/b.recoilHMul*100,'%',false],['纵向后坐力',w.recoilVMul/b.recoilVMul*100,'%',false],
    ['双轴恢复速度',w.recoilRecovery||1,'×',true],['连射散布增长',w.recoilPerShot/b.recoilPerShot*100,'%',false],['装填时间',w.reloadTime,'秒',false],['弹匣容量',w.mag,'发',true],...(w.pellets>1?[['弹丸扩散',w.pelletSpread*180/Math.PI,'°',false]]:[])
  ];},
  render(){if(!this.el||this.el.hidden)return;const it=Attachments.read(this.target),targets=Attachments.targets(),current=it&&Attachments.resolve(it.equip.gun,it.equip.attachments),sel=this.selection;
    const preview=it&&sel?Attachments.preview(this.target,this.slot,sel.id,sel.source):null,after=preview?.after||current;
    this.sig=JSON.stringify([it?.equip,Attachments.inventory().map(e=>[e.id||e.item?.id,e.n]),this.target&&Attachments.blocked(this.target)]);
    const index=targets.findIndex(t=>t.ref===this.target?.ref),candidates=it?Attachments.inventory().filter(e=>{const id=Attachments.entryItem(e)?.equip?.attachment;return id&&Attachments.compatible(current,id,this.slot);}):[];
    const basic=current&&Attachments.resolve(current.id,{}),baseStats=basic&&this.stats(basic),nowStats=current&&this.stats(current),nextStats=after&&this.stats(after);
    const money=n=>formatMoney(n),fmt=(v,u)=>(Number.isInteger(v)?v:v.toFixed(2))+u;
    this.el.innerHTML=`<div class="mod-dialog"><header><div><small>GUNSMITH / 枪械改装</small><h2>${esc(it?.name||'选择枪械')}</h2></div><button data-mod-close>关闭 · Esc</button></header><label class="mod-target">改装目标<select aria-label="选择改装枪械"><option value="-1">${targets.length?'请选择具体枪械':'没有可改装枪械'}</option>${targets.map((t,i)=>`<option value="${i}" ${i===index?'selected':''}>${esc(t.name+' · '+this.ownerLabel(t))}</option>`).join('')}</select></label>${!it?'<p class="mod-note">枪械已移动或当前没有可改装目标，请重新选择。安全箱中的枪械需先移出。</p>':`
    <div class="mod-body"><section class="mod-gun"><div class="mod-picture">${Icons.detailTag(it,'')}</div><p>${esc(BALLISTICS.caliberName(current.caliber))} · ${current.w.toFixed(2)}kg · 回收 ${money(it.sell)}</p><div class="mod-slots">${ATTACHMENT_SLOTS.map(slot=>{const state=Attachments.slotState(current.id,current.attachments,slot),a=ATTACHMENT_DEFS[current.attachments[slot]];return `<button data-mod-slot="${slot}" class="${slot===this.slot?'selected ':''}${state}" ${state==='disabled'?'disabled':''}><span>${Attachments.slotNames[slot]}</span>${a?Icons.gearIcon(a.id,'件'):'<b>'+(state==='disabled'?'×':'＋')+'</b>'}<small>${esc(a?.name||(state==='disabled'?'不支持':'原装／空槽'))}</small></button>`;}).join('')}</div><p class="mod-note">已安装配件随枪转移和结算。原装结构不作为可拆物品。实战瞄准时间还受护甲影响。</p></section>
    <section class="mod-work"><h3>${Attachments.slotNames[this.slot]} · 可用配件</h3><div class="mod-parts"><button data-mod-part="-1" class="${sel?.id===null?'selected':''}" ${!current.attachments[this.slot]?'disabled':''}><b>恢复原装／拆卸</b><small>拆下物品与多余弹药返还${Game.state==='playing'?'普通背包':'仓库'}</small></button>${candidates.map((e,i)=>{const a=Attachments.entryItem(e),id=a.equip.attachment;return `<button data-mod-part="${i}" class="r${a.r} ${sel?.source===e?'selected':''}">${Icons.gearIcon(id,'件')}<span><b>${esc(a.name)}</b><small>${esc(Attachments.describe(id))}</small></span></button>`;}).join('')}${!candidates.length?'<p>可用库存中没有兼容配件。</p>':''}</div>
    <div class="mod-stats"><div class="mod-stat-head"><b>属性</b><span>原枪</span><span>当前</span><span>预览</span></div>${nowStats.map(([label,value,unit,higher],i)=>{const v=nextStats[i][1],changed=Math.abs(v-value)>1e-8,good=higher?v>value:v<value;return `<div><b>${label}</b><span>${fmt(baseStats[i][1],unit)}</span><span>${fmt(value,unit)}</span><span class="${changed?(good?'gain':'loss'):''}">${fmt(v,unit)}</span></div>`;}).join('')}</div>
    <p class="mod-reason" role="status">${esc(preview?(preview.reason||('完成后 '+after.w.toFixed(2)+'kg'+(preview.extra?.length?' · 退回'+preview.extra.length+'发余弹':''))):Attachments.blocked(this.target)||'选择一件配件，或选择恢复原装以预览拆卸。')}</p><button class="mod-apply" data-mod-apply ${!preview?.ok?'disabled':''}>${sel?.id===null?'拆卸配件':current.attachments[this.slot]?'替换配件':'安装配件'}</button></section></div>`}</div>`;
    Icons.bindDetailImages(this.el);this.el.querySelector('[data-mod-close]').onclick=()=>this.close();
    this.el.querySelector('select').onchange=e=>{this.target=targets[Number(e.target.value)]||null;if(this.selection&&this.selection.id&&!Attachments.compatible(Attachments.read(this.target)?.equip.gun,this.selection.id))this.selection=null;this.render();};
    for(const b of this.el.querySelectorAll('[data-mod-slot]'))b.onclick=()=>{this.slot=b.dataset.modSlot;this.selection=null;this.render();};
    for(const b of this.el.querySelectorAll('[data-mod-part]'))b.onclick=()=>{const i=Number(b.dataset.modPart),e=candidates[i];this.selection=i<0?{id:null}:{id:Attachments.entryItem(e).equip.attachment,source:e};this.render();};
    const apply=this.el.querySelector('[data-mod-apply]');if(apply)apply.onclick=()=>{if(!this.selection)return;const r=Attachments.commit(this.target,this.slot,this.selection.id,this.selection.source);if(r.ok){this.target=r.target;this.selection=null;Game.sfx('pickup');if(Game.state==='base')Base.render();else Game.renderBag();}else Game.toast(r.reason);this.render();};
  }
};

// Presentation adapters leave inventory authority in Attachments.commit.
function attachmentWrap(obj,key,fn){const original=obj[key];obj[key]=function(...args){return fn.call(this,original,...args);};}
attachmentWrap(Base,'renderGunShop',function(original,el){original.call(this,el);for(const slot of ATTACHMENT_SLOTS){const title=document.createElement('div');title.className='shop-cat';title.textContent='枪械配件 · '+Attachments.slotNames[slot];el.appendChild(title);for(const a of Object.values(ATTACHMENT_DEFS).filter(a=>a.subtype===slot&&a.r<=3)){const cell=document.createElement('div');cell.className='scell r'+a.r;cell.dataset.offer=JSON.stringify({kind:'attachment',id:a.id});cell.innerHTML=Icons.gearIcon(a.id,'件')+'<span class="cn">'+esc(a.name)+'</span><span class="pr">'+formatMoney(a.price)+'</span>';cell.onclick=()=>Deal.show({kind:'buy',title:'购买枪械配件',name:a.name,sub:Attachments.describe(a.id),icon:a.id,price:a.price,can:Save.credits>=a.price&&Save.stash.length<STASH_SLOTS,onGo:()=>this.buyAttachment(a.id)},cell.getBoundingClientRect());el.appendChild(cell);}}});
Base.buyAttachment=function(id){const d=ATTACHMENT_DEFS[id];if(Game.state!=='base'||!d||d.r>3||Save.credits<d.price||Save.stash.length>=STASH_SLOTS)return false;Save.credits-=d.price;Save.addGearStash(EQUIP.attachment(id));Save.save();Save.flush();this.render();return true;};
attachmentWrap(MerchantUI,'offer',function(original,meta,cell){if(meta.kind!=='attachment')return original.call(this,meta,cell);const item=EQUIP.attachment(meta.id);return item?{key:JSON.stringify(meta),meta,item,category:'attachment',quantity:1,price:item.price,cell,confirm:cell.onclick}:null;});
attachmentWrap(StorageUI,'matches',function(original,it,key){return key==='attachments'?it.equip?.kind==='attachment':original.call(this,it,key);});
function addModActions(box,item,targetOrEntry){if(!box?.insertAdjacentHTML)return;const kind=item?.equip?.kind;if(!['gun','attachment'].includes(kind))return;const b=document.createElement('button');b.className='mod-entry';b.textContent=kind==='gun'?'改装枪械':'安装到枪械';b.onclick=()=>kind==='gun'?ModUI.openTarget(Attachments.findTarget(targetOrEntry)||Attachments.findTarget(item)):ModUI.openWithPart(targetOrEntry);box.appendChild(b);}
attachmentWrap(StorageUI,'renderDetail',function(original){original.call(this);if(Safehouse.demo||!this.selected)return;const e=this.selected.entry,it=stashItem(e),box=this.el.querySelector('.st-detail-actions');addModActions(box,it,e);if(it?.equip?.kind==='attachment'){const eq=box?.querySelector('[data-st-action="equip"]');if(eq)eq.style.display='none';const desc=this.el.querySelector('.st-detail-body>p');if(desc)desc.textContent=Attachments.describe(it.equip.attachment);}});
attachmentWrap(Base,'showItem',function(original,e,where,node){const r=original.call(this,e,where,node);if(Safehouse.view!=='stash'||where!=='stash')addModActions(document.querySelector?.('#itemTip .medical-actions'),stashItem(e),e);return r;});
attachmentWrap(Base,'renderGear',function(original){original.call(this);const rows=document.querySelectorAll?.('#baseGear .slot')||[];for(let i=0;i<3;i++){const it=Save.gear.weapons[i],row=rows[i];if(row&&it)row.oncontextmenu=ev=>{ev.preventDefault();Ctx.show(ev.clientX,ev.clientY,[{label:'改装',onClick:()=>ModUI.openTarget(Attachments.findTarget(it))},{label:'退弹',onClick:()=>Base.unloadGun(it)}]);};}});
/* 改装入口挂在统一手势的钩子上：装备槽和背包里的枪都多一个「改装」，
   退弹、丢弃、详情由 game-panels 统一处理，这里不再自己接管左右键。 */
Game.extraActsFor=function(it,where,entry){
  /* 装备槽传进来的是"枪的运行时对象"，背包里传的是枪的物品快照 —— 两边形状不同 */
  const isGun=where==='gear'?!!(entry&&entry.id):it?.equip?.kind==='gun';
  if(!isGun)return [];
  const t=Attachments.findTarget(entry);return t?[{label:'改装',onClick:()=>ModUI.openTarget(t)}]:[];};
