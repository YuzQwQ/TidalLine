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
  box.innerHTML='<h3>保险箱 <em>'+Save.safe.length+' / '+CFG.BAG.SAFE+' 格</em></h3><div id="baseSafeGrid" class="bag-grid"></div><p>死亡仍可带回 · 点击物品取出或使用</p>';
  const cells=box.querySelector('#baseSafeGrid');for(let i=0;i<CFG.BAG.SAFE;i++){const entry=Save.safe[i],item=entry&&stashItem(entry),cell=Base.makeBagCell(entry);cell.dataset.safeSlot=i;if(item){cell.title=item.name+' · 点击查看保险箱操作';cell.onclick=()=>this.open(entry,cell);cell.oncontextmenu=e=>{e.preventDefault();this.open(entry,cell);};cell.ondblclick=()=>this.transfer(entry,'safe','bag');}else cell.title='从背包或仓库的物品操作中选择“放入保险箱”';cells.appendChild(cell);}
 },
 open(entry,node){if(!Save.safe.includes(entry))return;const item=stashItem(entry);Tips.show(item,node.getBoundingClientRect(),'保险箱 · 死亡可带回');Tips.actions([{label:'移回背包',onClick:()=>this.transfer(entry,'safe','bag')},{label:'放回仓库',onClick:()=>this.transfer(entry,'safe','stash')},...(Medical.ready(item)?[{label:Save.hp>=CFG.P.HP?'生命值已满':'使用医疗品',disabled:Save.hp>=CFG.P.HP,onClick:()=>{if(Save.safe.includes(entry))Medical.use(entry,'basesafe');}}]:[])]);},
 addAction(container,entry,from){if(!container||!this.list(from)?.includes(entry))return;const button=document.createElement('button');button.dataset.baseSafeMove=from;button.textContent='放入保险箱';button.onclick=()=>this.transfer(entry,from,'safe');container.appendChild(button);}
};
{
 const bag=Base.renderBag,detail=StorageUI.renderDetail,show=Base.showItem;
 Base.renderBag=function(){const r=bag.apply(this,arguments);BaseSafe.render();return r;};
 StorageUI.renderDetail=function(){const r=detail.apply(this,arguments);if(!Safehouse.demo&&Safehouse.view==='stash'&&this.selected)BaseSafe.addAction(this.el.querySelector('.st-detail-actions'),this.selected.entry,'stash');return r;};
 Base.showItem=function(entry,where){const r=show.apply(this,arguments);if(where==='bag')BaseSafe.addAction(document.querySelector('#itemTip .medical-actions'),entry,'bag');return r;};
}
