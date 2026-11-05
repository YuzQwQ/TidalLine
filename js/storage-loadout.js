/* Shared live equipment/bag nodes: one inventory, presented alongside the warehouse. */
const StorageLoadout={
 keys:['w0','w1','w2','helmet','body','back','melee'],
 items(){const g=Save.gear;return [...g.weapons.map(w=>w?EQUIP.gun(w.equip.gun,w.equip.mag,w.equip.ammo,w.equip.rounds,w.equip):null),EQUIP.armor(g.helmet),EQUIP.armor(g.body),g.back?EQUIP.bag(g.back.id):null,g.melee?EQUIP.melee(g.melee.equip.melee,g.melee.equip.bound):null];},
 mount(){if(this.el||!StorageUI.mounted||Safehouse.demo)return;const layout=StorageUI.el,center=layout.querySelector('.st-center'),categories=layout.querySelector('.st-sidebar');
  this.el=document.createElement('aside');this.el.className='st-loadout sh-metal';this.el.innerHTML='<header><h2>随身装备 <small>出战配置</small></h2></header><div class="st-loadout-mount"></div><footer class="st-loadout-stats"><div><span>总负重</span><b data-st-loadout-weight></b></div><div title="已装备武器、防具、背包与近战的参考售价，包含已安装配件；不含弹匣子弹、包内物资或仓库物品"><span>装备估价</span><b data-st-loadout-value></b></div><div><span>背包容量</span><b data-st-loadout-slots></b></div></footer>';
  layout.prepend(this.el);categories.classList.add('st-categories');center.insertBefore(categories,center.querySelector('.st-tools'));const summary=center.querySelector('.st-summary');summary.insertAdjacentHTML('afterbegin','<h1>仓库物资</h1>');
  this.pane=document.getElementById('paneGear');this.anchor=document.createComment('equipment panel home');this.pane.before(this.anchor);
  const help=document.createElement('p');help.className='st-loadout-help';help.textContent='点击装备格换装 · 双击仓库物品装备或装包 · 双击背包物品入库';this.el.appendChild(help);this.sync();
 },
 sync(){if(!this.el)return;const active=Safehouse.view==='stash';if(active&&this.pane.parentNode!==this.el.querySelector('.st-loadout-mount'))this.el.querySelector('.st-loadout-mount').appendChild(this.pane);if(!active&&this.pane.parentNode!==this.anchor.parentNode)this.anchor.after(this.pane);if(active)this.update();},
 update(){if(!this.el)return;const items=this.items();this.el.querySelector('[data-st-loadout-value]').textContent=formatMoney(items.reduce((n,it)=>n+(it?.price||0),0));this.el.querySelector('[data-st-loadout-weight]').textContent=Attachments.carriedWeight().toFixed(1)+' / '+CFG.BAG.CARRY+' kg';this.el.querySelector('[data-st-loadout-slots]').textContent=Save.bag.length+' / '+bagSlots()+' 格';},
 decorate(){const items=this.items(),rows=document.querySelectorAll('#baseGear .slot');rows.forEach((row,i)=>{const item=items[i];if(item)row.classList.add('r'+item.r);row.dataset.equipKey=this.keys[i];if(Safehouse.view==='stash'){row.insertAdjacentHTML('afterbegin','<small class="st-slot-label">'+esc(Base.slotLabel(this.keys[i]))+'</small>');const text=row.querySelector('.slot-txt span');if(text){const eq=item?.equip;let info='点击选择';if(eq?.kind==='gun')info=eq.mag+' / '+Attachments.resolve(eq.gun,eq.attachments).mag+' 发';if(eq?.kind==='armor')info='Lv'+eq.gear.lv+' · '+Math.ceil(eq.gear.dur)+'/'+eq.gear.max;if(eq?.kind==='bag')info=eq.slots+' 格';if(eq?.kind==='melee')info=eq.bound?'绑定':'近战';text.textContent=info;}}});this.update();},
 equip(entry,node){if(!Save.stash.includes(entry))return false;const item=stashItem(entry),eq=item?.equip;if(!eq||eq.kind==='attachment')return false;
  if(eq.kind==='gun'){const w=Attachments.resolve(eq.gun,eq.attachments);if(w.slot==='primary'){Ctx.show(node.getBoundingClientRect().left,node.getBoundingClientRect().bottom,[0,1].map(i=>({label:'主武器 '+(i+1)+' · '+(Save.gear.weapons[i]?.name||'空槽'),onClick:()=>{if(Save.stash.includes(entry))Base.equipFromStash(entry,'w'+i);}})));return true;}return Base.equipFromStash(entry,'w2');}
  return Base.equipFromStash(entry,eq.kind==='armor'?eq.gear.type:eq.kind==='bag'?'back':'melee');
 },
 detail(){if(Safehouse.view!=='stash'||!StorageUI.selected)return;const {entry,node}=StorageUI.selected,it=stashItem(entry),button=StorageUI.el.querySelector('[data-st-action="equip"]');if(button&&it?.equip?.kind!=='attachment'){button.innerHTML=Safehouse.icon('person')+'装备';button.onclick=()=>this.equip(entry,node);}},
 bindBag(){if(Safehouse.view!=='stash')return;document.querySelectorAll('#baseBagGrid .cell').forEach((cell,i)=>{const entry=Save.bag[i];if(!entry)return;cell.ondblclick=()=>{if(!Save.bag.includes(entry))return;Tips.hide();Base.toStash(entry);};});}
};
{
 const mount=StorageUI.mount,apply=StorageUI.applyView,after=StorageUI.afterRender,detail=StorageUI.renderDetail,gear=Base.renderGear,bag=Base.renderBag,toStash=Base.toStash;
 StorageUI.mount=function(){const r=mount.apply(this,arguments);StorageLoadout.mount();return r;};
 StorageUI.applyView=function(){const r=apply.apply(this,arguments);StorageLoadout.sync();return r;};
 StorageUI.renderDetail=function(){const r=detail.apply(this,arguments);StorageLoadout.detail();return r;};
 StorageUI.afterRender=function(){const r=after.apply(this,arguments);if(this.mounted&&Safehouse.view==='stash'&&!Safehouse.demo){StorageLoadout.update();const list=this.list().slice(Base.page*Base._per,Base.page*Base._per+Base._per);this.stock.querySelectorAll('#stashGrid .scell').forEach((cell,i)=>{const entry=list[i];if(entry)cell.ondblclick=()=>{if(!Save.stash.includes(entry))return;const item=stashItem(entry);if(item.equip&&item.equip.kind!=='attachment')StorageLoadout.equip(entry,cell);else Base.toBag(entry);};});}return r;};
 Base.renderGear=function(){const r=gear.apply(this,arguments);StorageLoadout.decorate();return r;};
 Base.renderBag=function(){const r=bag.apply(this,arguments);StorageLoadout.bindBag();StorageLoadout.update();return r;};
 Base.toStash=function(entry){if(!Save.bag.includes(entry))return false;if(entry.gear&&Save.stash.length>=STASH_SLOTS){this.note('仓库空间不足',true);return false;}return toStash.apply(this,arguments);};
}
