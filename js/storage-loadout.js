/* Shared live equipment/bag nodes: one inventory, presented alongside the warehouse. */
const StorageLoadout={
 keys:['w0','w1','w2','helmet','body','back','melee'],
 items(){const g=Save.gear;return [...g.weapons.map(w=>w?EQUIP.gun(w.equip.gun,w.equip.mag,w.equip.ammo,w.equip.rounds,w.equip):null),EQUIP.armor(g.helmet),EQUIP.armor(g.body),g.back?EQUIP.bag(g.back.id):null,g.melee?EQUIP.melee(g.melee.equip.melee,g.melee.equip.bound):null];},
 mount(){if(this.el||!StorageUI.mounted||Safehouse.demo)return;const layout=StorageUI.el,center=layout.querySelector('.st-center'),categories=layout.querySelector('.st-sidebar');
  this.el=document.createElement('aside');this.el.className='st-loadout sh-metal';this.el.innerHTML='<header><h2>随身装备 <small>出战配置</small></h2></header><div class="st-loadout-mount"></div><footer class="st-loadout-stats"><div><span>总负重</span><b data-st-loadout-weight></b></div><div title="已装备武器、防具、背包与近战的参考售价，包含已安装配件；不含弹匣子弹、包内物资或仓库物品"><span>装备估价</span><b data-st-loadout-value></b></div><div><span>背包容量</span><b data-st-loadout-slots></b></div></footer>';
  layout.prepend(this.el);categories.classList.add('st-categories');center.insertBefore(categories,center.querySelector('.st-tools'));const summary=center.querySelector('.st-summary');summary.insertAdjacentHTML('afterbegin','<h1>仓库物资</h1>');
  this.pane=document.getElementById('paneGear');this.anchor=document.createComment('equipment panel home');this.pane.before(this.anchor);
const help=document.createElement('p');help.className='st-loadout-help';help.textContent='装备格：左键换装 · 右键详情与卸下 ｜ 仓库：单击看详情 · 双击放进背包';this.el.appendChild(help);this.sync();
 },
 sync(){if(!this.el)return;const active=Safehouse.view==='stash';if(active&&this.pane.parentNode!==this.el.querySelector('.st-loadout-mount'))this.el.querySelector('.st-loadout-mount').appendChild(this.pane);if(!active&&this.pane.parentNode!==this.anchor.parentNode)this.anchor.after(this.pane);if(active)this.update();},
 update(){if(!this.el)return;const items=this.items();this.el.querySelector('[data-st-loadout-value]').textContent=formatMoney(items.reduce((n,it)=>n+(it?.price||0),0));this.el.querySelector('[data-st-loadout-weight]').textContent=Attachments.carriedWeight().toFixed(1)+' / '+CFG.BAG.CARRY+' kg';this.el.querySelector('[data-st-loadout-slots]').textContent=Save.bag.length+' / '+bagSlots()+' 格';},
 decorate(){const items=this.items(),rows=document.querySelectorAll('#baseGear .slot');rows.forEach((row,i)=>{const item=items[i];if(item)row.classList.add('r'+item.r);row.dataset.equipKey=this.keys[i];if(Safehouse.view==='stash'){row.insertAdjacentHTML('afterbegin','<small class="st-slot-label">'+esc(Base.slotLabel(this.keys[i]))+'</small>');const text=row.querySelector('.slot-txt span');if(text){const eq=item?.equip;let info='点击选择';if(eq?.kind==='gun')info=eq.mag+' / '+Attachments.resolve(eq.gun,eq.attachments).mag+' 发';if(eq?.kind==='armor')info='Lv'+eq.gear.lv+' · '+Math.ceil(eq.gear.dur)+'/'+eq.gear.max;if(eq?.kind==='bag')info=eq.slots+' 格';if(eq?.kind==='melee')info=eq.bound?'绑定':'近战';text.textContent=info;}}});this.update();},
 equip(entry,node){if(!Save.stash.includes(entry))return false;const item=stashItem(entry),eq=item?.equip;if(!eq||eq.kind==='attachment')return false;
  if(eq.kind==='gun'){const w=Attachments.resolve(eq.gun,eq.attachments);if(w.slot==='primary'){Ctx.show(node.getBoundingClientRect().left,node.getBoundingClientRect().bottom,[0,1].map(i=>({label:'主武器 '+(i+1)+' · '+(Save.gear.weapons[i]?.name||'空槽'),onClick:()=>{if(Save.stash.includes(entry))Base.equipFromStash(entry,'w'+i);}})));return true;}return Base.equipFromStash(entry,'w2');}
  return Base.equipFromStash(entry,eq.kind==='armor'?eq.gear.type:eq.kind==='bag'?'back':'melee');
 },
 /* 仓库物品的「装备」动作：挂在 Base 的钩子上，排在浮窗动作最前面，
    和「放进背包」「前往出售」并列 —— 详情里不再有单独一套装备按钮。 */
 actFor(entry,where,node){
  if(Safehouse.view!=='stash'||where!=='stash')return [];
  const it=stashItem(entry);
  if(!it?.equip||it.equip.kind==='attachment')return [];
  return [{label:'装备',onClick:()=>this.equip(entry,node)}];
 }
};
{
 const mount=StorageUI.mount,apply=StorageUI.applyView,after=StorageUI.afterRender,gear=Base.renderGear,bag=Base.renderBag,toStash=Base.toStash,extraActs=Base.extraActsFor;
 StorageUI.mount=function(){const r=mount.apply(this,arguments);StorageLoadout.mount();return r;};
 StorageUI.applyView=function(){const r=apply.apply(this,arguments);StorageLoadout.sync();return r;};
 /* 双击仓库物品统一「放进背包」（不再区分装备类直接穿），这里只补统计 */
 StorageUI.afterRender=function(){const r=after.apply(this,arguments);if(this.mounted&&Safehouse.view==='stash'&&!Safehouse.demo)StorageLoadout.update();return r;};
 Base.renderGear=function(){const r=gear.apply(this,arguments);StorageLoadout.decorate();return r;};
 Base.renderBag=function(){const r=bag.apply(this,arguments);StorageLoadout.update();return r;};
 /* 详情浮窗的动作顺序：装备（仓库专属）→ 放进背包 → 使用 → 保险箱 → 改装 */
 Base.extraActsFor=function(entry,where,node,key){return StorageLoadout.actFor(entry,where,node).concat(extraActs.apply(this,arguments));};
 Base.toStash=function(entry){if(!Save.bag.includes(entry))return false;if(entry.gear&&Save.stash.length>=STASH_SLOTS){this.note('仓库满了，这件卸不下：先卖点东西或腾一格',true);return false;}return toStash.apply(this,arguments);};
}
