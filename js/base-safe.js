/* Preparation slots for the existing raid safe. Settlement keeps its existing auto-sort rules. */
const BaseSafe={
 list(where){return where==='safe'?Save.safe:where==='bag'?Save.bag:where==='stash'?Save.stash:null;},
 transfer(entry,from,to){if(Game.state!=='base'||from===to)return false;const src=this.list(from),dest=this.list(to),item=entry&&stashItem(entry);if(!src?.includes(entry)||!dest||!item)return false;
  const limit=to==='safe'?CFG.BAG.SAFE:to==='bag'?bagSlots():STASH_SLOTS,n=entry.gear?1:(entry.n||1),next=dest.map(e=>({...e}));let left=n;
  if(!entry.gear&&stackLimit(item)>1)for(const e of next){if(e.gear||e.id!==entry.id)continue;const put=Math.min(left,Math.max(0,stackLimit(item)-e.n));e.n+=put;left-=put;if(!left)break;}
  while(left>0){const put=Math.min(left,entry.gear?1:stackLimit(item));next.push({...entry,n:put});left-=put;}
  if(next.length>limit&&next.length>dest.length){Base.note(to==='safe'?'保险箱空间不足':to==='bag'?'背包空间不足':'仓库空间不足',true);return false;}
  if(from==='stash'&&to!=='stash'&&Attachments.carriedWeight()+item.w*n>CFG.BAG.CARRY+1e-6){Base.note('超过携带负重，无法转移',true);return false;}
  const field=k=>k==='safe'?'safe':k==='bag'?'bag':'stash';Save[field(from)]=src.filter(e=>e!==entry);Save[field(to)]=next;Save.save();Save.flush();Tips.hide();Base.render();Base.note('已将'+item.name+'放入'+({safe:'保险箱',bag:'背包',stash:'仓库'}[to]));Game.sfx('pickup');return true;
 },
  render(){const grid=document.getElementById('baseBagGrid');if(!grid)return;let box=document.getElementById('baseSafeSection');if(!box){box=document.createElement('section');box.id='baseSafeSection';box.className='base-safe-section';grid.after(box);}
  box.innerHTML='<h3>保险箱 <em>'+Save.safe.length+' / '+CFG.BAG.SAFE+' 格</em></h3><div id="baseSafeGrid" class="bag-grid"></div><p>死亡仍可带回 · 单击看详情，双击回到背包</p>';
  const cells=box.querySelector('#baseSafeGrid');for(let i=0;i<CFG.BAG.SAFE;i++){const entry=Save.safe[i],item=entry&&stashItem(entry),cell=Base.makeBagCell(entry);cell.dataset.safeSlot=i;if(item){cell.title=item.name+' · 双击移回背包 · 右键更多';cell.onclick=ev=>{if(ev&&(ev.ctrlKey||ev.metaKey)){Tips.hide();this.transfer(entry,'safe','bag');return;}this.open(entry,cell);};cell.ondblclick=ev=>{if(ev&&ev.preventDefault)ev.preventDefault();Tips.hide();this.transfer(entry,'safe','bag');};cell.oncontextmenu=ev=>{ev.preventDefault();ev.stopPropagation();this.menu(entry,cell,ev);};}else cell.title='从背包或仓库的物品操作中选择“放入保险箱”';cells.appendChild(cell);}
 },
 /* 局外详情只有信息；动作全在右键菜单（和背包格同一套口径） */
 open(entry,node){if(!Save.safe.includes(entry))return;const item=stashItem(entry);const extra=item&&Medical.capOf(item)?[[item.effect?'剩余次数':'当前容量',Medical.capText(entry)]]:null;Tips.show(item,node.getBoundingClientRect(),'',extra);},
 menu(entry,node,ev){const item=stashItem(entry);const entries=[{label:'详情',onClick:()=>this.open(entry,node)},{label:'移回背包',onClick:()=>this.transfer(entry,'safe','bag')},{label:'放回仓库',onClick:()=>this.transfer(entry,'safe','stash')}];
  if(item&&Medical.is(item)){const usable=Medical.canUse(item,'basesafe');entries.push({label:Medical.actionLabel(item,'basesafe'),disabled:!usable,onClick:()=>{if(usable&&Save.safe.includes(entry))Medical.use(entry,'basesafe');}});}
  Ctx.show(ev.clientX,ev.clientY,entries);},
 addAction(container,entry,from){if(!container||!this.list(from)?.includes(entry))return;const button=document.createElement('button');button.dataset.baseSafeMove=from;button.textContent='放入保险箱';button.onclick=()=>this.transfer(entry,from,'safe');container.appendChild(button);}
};
{
 const bag=Base.renderBag;
 Base.renderBag=function(){const r=bag.apply(this,arguments);BaseSafe.render();return r;};
 /* 「存入保险箱」由 Base.showItem 统一放进详情浮窗，不再往右侧面板或浮窗里二次追加 */
}
