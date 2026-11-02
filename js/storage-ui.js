/* Warehouse view adapter: no duplicate inventory or transaction state. */
const StorageUI={
  mounted:false,category:'all',query:'',quality:'all',sort:'value',selected:null,subcats:false,
  mount(){
    if(this.mounted||!Safehouse.root)return;this.mounted=true;
    const root=Safehouse.root;this.el=document.createElement('section');this.el.className='st-layout';this.el.hidden=true;
    const cats=Safehouse.demo?[['life','生活用品'],['elec','电子产品'],['ind','工业器材'],['med','医疗物资'],['collect','文物藏品'],['mil','军事物资'],['intel','情报资料'],['occult','神秘学物品'],['odd','异常遗物']]:COLLECTION_CATS.map(k=>[k,CATS[k].name]);
    this.el.innerHTML=`<aside class="st-sidebar"><header><h1>仓库 <small>STORAGE</small></h1><div></div></header><nav aria-label="库存分类">${STORAGE_UI_CONFIG.categories.map(c=>`<button data-st-category="${c.id}">${Safehouse.icon(c.icon)}<span>${c.name}</span><small data-st-count="${c.id}">0</small></button>`).join('')}<button class="st-subtoggle" data-st-toggle>九类收集品 <span>展开 ▾</span></button><div class="st-subcats" hidden>${cats.map(([id,name])=>`<button data-st-category="cat:${id}"><span>${name}</span><small data-st-count="cat:${id}">0</small></button>`).join('')}</div></nav><div class="st-sidebar-note">数量按占用格统计<br>弹药发数与药物容量在详情中显示</div><button class="st-batch" data-st-planned="batch">更多批量操作 · 规划</button></aside><section class="st-center"><header class="st-summary sh-metal"><div><span>仓库容量</span><b data-st-capacity></b><div class="st-capacity"><i></i></div></div><button data-st-organize>${Safehouse.icon('box')}整理视图</button><button data-st-bulk>${Safehouse.icon('cart')}出售寻常收集品</button></header><div class="st-tools"><label><span class="sr-only">搜索库存</span><input type="search" placeholder="搜索物品名称…" aria-label="搜索库存"></label><select aria-label="筛选品质"><option value="all">全部品质</option>${['寻常','良品','上乘','稀见','珍罕','孤品'].map((r,i)=>'<option value="'+(i+1)+'">'+r+'</option>').join('')}</select><select aria-label="库存排序"><option value="value">回收价值优先</option><option value="priceUp">回收价值从低到高</option><option value="rarity">品质优先</option><option value="name">名称排序</option><option value="category">类别整理</option></select></div><div class="st-stock-mount sh-metal"></div><p class="st-empty" hidden>没有匹配的物品，试试其他分类、品质或关键词。</p><p class="st-feedback" role="status" aria-live="polite" hidden></p><footer class="st-inventory-foot"><span data-st-visible></span><button data-st-planned="lock">物品锁定 · 待开放</button></footer></section><aside class="st-detail sh-metal"></aside>`;
    root.querySelector('.sh-work').appendChild(this.el);
    if(!Safehouse.demo){this.stock=root.querySelector('.base-right');this.stockHome=this.stock.parentNode;this.el.querySelector('[data-st-bulk]').onclick=()=>this.confirmJunk();}
    else{this.el.querySelector('.st-stock-mount').innerHTML='<div class="st-demo-grid"></div>';this.el.querySelector('[data-st-bulk]').onclick=()=>Safehouse.explain('演示界面','正式游戏中先确认数量与回收金额，再出售寻常收集品。独立稿不执行交易。');}
    this.el.addEventListener('click',e=>{const category=e.target.closest('[data-st-category]');if(category){this.category=category.dataset.stCategory;this.selected=null;this.rerender();}const planned=e.target.closest('[data-st-planned]');if(planned)Safehouse.explain('后续内容',STORAGE_UI_CONFIG.planned[planned.dataset.stPlanned]);if(e.target.closest('[data-st-organize]')){this.sort='category';this.el.querySelector('[aria-label="库存排序"]').value=this.sort;this.rerender();this.feedback('已按类别整理显示，物品与数量保持原样。');}if(e.target.closest('[data-st-toggle]')){this.subcats=!this.subcats;this.el.querySelector('.st-subcats').hidden=!this.subcats;this.el.querySelector('[data-st-toggle] span').textContent=this.subcats?'收起 ▴':'展开 ▾';}});
    this.el.querySelector('input').addEventListener('input',e=>{this.query=e.target.value;this.selected=null;this.rerender();});
    this.el.querySelector('[aria-label="筛选品质"]').addEventListener('change',e=>{this.quality=e.target.value;this.selected=null;this.rerender();});this.el.querySelector('[aria-label="库存排序"]').addEventListener('change',e=>{this.sort=e.target.value;this.rerender();});
    if(Safehouse.demo){const select=this.el.querySelector('[aria-label="库存排序"]');select.querySelector('[value="value"]').textContent='演示顺序';select.querySelector('[value="priceUp"]').disabled=true;select.querySelector('[value="priceUp"]').textContent='价格排序 · 游戏内';}
    this.applyView();this.renderDetail();
  },
  matches(item,category){
    if(category==='all')return true;if(category.startsWith('cat:'))return item.cat===category.slice(4);
    if(category==='weapons')return ['gun','melee'].includes(item.equip?.kind);
    if(category==='protection')return item.equip?.kind==='armor';if(category==='bags')return item.equip?.kind==='bag';
    if(category==='collectibles')return Safehouse.demo?item.category==='collectibles':itemGroup(item)==='collectible';
    return item.cat===category;
  },
  list(){
    return Save.stash.filter(e=>{const it=stashItem(e);return it&&this.matches(it,this.category)&&(this.quality==='all'||it.r===Number(this.quality))&&it.name.toLowerCase().includes(this.query.trim().toLowerCase());}).sort((a,b)=>{const ia=stashItem(a),ib=stashItem(b),value=e=>unitPrice(stashItem(e))*(e.n||1);if(this.sort==='priceUp')return value(a)-value(b);if(this.sort==='rarity')return (ib.r||1)-(ia.r||1)||value(b)-value(a);if(this.sort==='name')return ia.name.localeCompare(ib.name,'zh-CN');if(this.sort==='category')return (itemCategoryLabel(ia)).localeCompare(itemCategoryLabel(ib),'zh-CN')||value(b)-value(a);return value(b)-value(a);});
  },
  applyView(){
    if(!this.mounted)return;const active=Safehouse.view==='stash';this.el.hidden=!active;
    if(active&&!Safehouse.demo&&this.stock.parentNode!==this.el.querySelector('.st-stock-mount'))this.el.querySelector('.st-stock-mount').appendChild(this.stock);
    if(!active&&!Safehouse.demo&&this.stock.parentNode===this.el.querySelector('.st-stock-mount'))this.stockHome.appendChild(this.stock);
    if(active&&Safehouse.demo)this.renderDemo();
  },
  rerender(){if(Safehouse.demo)this.renderDemo();else{Base.page=0;Base.renderStash();}},
  afterRender(){
    if(!this.mounted||Safehouse.view!=='stash'||Safehouse.demo)return;
    if(this.selected&&!Save.stash.includes(this.selected.entry))this.selected=null;
    const list=this.list(),slice=list.slice(Base.page*Base._per,Base.page*Base._per+Base._per),cells=this.stock.querySelectorAll('#stashGrid .scell');
    cells.forEach((cell,i)=>{const e=slice[i];if(!e)return;cell.tabIndex=0;cell.setAttribute('role','button');cell.setAttribute('aria-label',stashItem(e).name);cell.onkeydown=ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();this.select(e,cell);}};cell.classList.toggle('st-selected',e===this.selected?.entry);if(e===this.selected?.entry)this.selected.node=cell;});
    this.el.querySelector('[data-st-capacity]').textContent=Save.stash.length+' / '+STASH_SLOTS+' 格';this.el.querySelector('.st-capacity i').style.width=Math.min(100,Save.stash.length/STASH_SLOTS*100)+'%';
    this.el.querySelector('[data-st-visible]').textContent='匹配 '+list.length+' 格 · 堆叠不合并品质';this.el.querySelector('.st-empty').hidden=list.length>0;
    for(const btn of this.el.querySelectorAll('[data-st-category]')){const k=btn.dataset.stCategory;btn.classList.toggle('on',this.category===k);btn.setAttribute('aria-pressed',this.category===k?'true':'false');btn.querySelector('small').textContent=Save.stash.filter(e=>{const it=stashItem(e);return it&&this.matches(it,k);}).length;}
    this.renderDetail();
  },
  select(entry,node){this.selected={entry,node};for(const c of this.stock.querySelectorAll('#stashGrid .scell'))c.classList.toggle('st-selected',c===node);this.renderDetail();},
  feedback(text,bad=false){if(!this.mounted)return;const p=this.el.querySelector('.st-feedback');p.hidden=false;p.textContent=text;p.classList.toggle('bad',!!bad);},
  renderDetail(){
    if(!this.mounted)return;const box=this.el.querySelector('.st-detail'),s=this.selected;
    if(!s){box.innerHTML='<small>ITEM INSPECTOR</small><h2>选择一件物品</h2><div class="st-placeholder">'+Safehouse.icon('box')+'</div><p>从库存选择物品，在这里查看属性和可用操作。<br>可在商人处补给，或通过行动搜集物资。</p>';return;}
    if(Safehouse.demo){const i=s.item;box.innerHTML='<div class="st-detail-body"><small>演示物品 · 不读取游戏存档</small><h2>'+MerchantUI.esc(i.name)+'</h2><div class="st-item-picture"><img src="../../../assets/'+i.file+'" alt=""></div><p>'+MerchantUI.esc(i.desc||'构图与交互位置演示。正式游戏中读取实际物品的品质、描述、容量与参数。')+'</p></div><div class="st-detail-actions"><button data-st-demo>物品操作 · 演示</button></div>';box.querySelector('[data-st-demo]').onclick=()=>Safehouse.explain('视觉演示','请在游戏仓库中使用、转移或出售真实物品。本页不执行库存操作。');return;}
    const e=s.entry,it=stashItem(e);if(!it)return;const n=e.n||1,eq=it.equip,icon=Icons.bagTag(it,''),category=eq?'装备 / '+({gun:'枪械',melee:'近战武器',armor:'防护装备',bag:'背包'}[eq.kind]||'装备'):itemCategoryLabel(it),rows=[['分类',category],['品质',RARITY[(it.r||1)-1].name],['数量',n+(it.cat==='ammo'?' 发':' 件')],['总重量',(it.w*n).toFixed(2)+' kg'],['回收价值',formatMoney(unitPrice(it)*n)]];
    if(it.healCap)rows.push(['剩余容量',Math.ceil(Medical.entryCap(e))+' / '+it.healCap]);
    if(eq?.kind==='gun'){const d=WEAPONS[eq.gun];rows.push(['伤害',d.dmgMin+'–'+d.dmgMax],['射速',d.rpm+' 发/分'],['弹匣',eq.mag+' / '+d.mag]);}
    if(eq?.kind==='armor'){const g=eq.gear;rows.push(['防护等级',g.lv],['耐久',Math.ceil(g.dur)+' / '+g.max]);if(g.type==='body')rows.push(['瞄准时间惩罚','+'+(g.aimPenaltyPct||0)+'%']);}
    if(eq?.kind==='bag')rows.push(['背包容量',eq.slots+' 格']);
    if(eq?.kind==='melee'){const d=MELEE.find(x=>x.id===eq.melee);rows.push(['真实伤害',d.damage],['攻击范围',d.radius+' 格']);}
    if(Medical.is(it))rows.push(['使用效果',Medical.summary(it)]);
    const why=Base.bagBlock(it,(e.gear||it.healCap)?1:n),bound=!!eq?.bound;
    box.innerHTML='<div class="st-detail-body"><small>ITEM INSPECTOR'+(bound?' · 绑定':'')+'</small><h2>'+MerchantUI.esc(it.name)+'</h2><div class="st-item-picture">'+icon+'</div><dl>'+rows.map(([k,v])=>'<div><dt>'+MerchantUI.esc(k)+'</dt><dd>'+MerchantUI.esc(v)+'</dd></div>').join('')+'</dl><p>'+MerchantUI.esc(it.desc||'装备属性与状态沿用当前游戏定义。')+'</p></div><div class="st-detail-actions">'+(Medical.ready(it)?'<button data-st-action="use" '+(Save.hp>=CFG.P.HP?'disabled':'')+'>'+Safehouse.icon('cross')+(Save.hp>=CFG.P.HP?'生命值已满':'使用医疗品')+'</button>':'')+(eq?'<button data-st-action="equip">'+Safehouse.icon('person')+'前往备战装备</button>':'')+'<button data-st-action="transfer" '+(why?'disabled':'')+'>'+Safehouse.icon('box')+'放入背包</button>'+(eq?.kind==='gun'?'<button data-st-action="unload">'+Safehouse.icon('tool')+'退弹到背包</button>':'')+'<button class="st-sell" data-st-action="sell" '+(bound?'disabled':'')+'>'+Safehouse.icon('cart')+(bound?'绑定物品不可出售':'出售 · '+formatMoney(unitPrice(it)*n))+'</button><small class="st-action-hint">'+MerchantUI.esc(why||'出售前核对金额并确认')+'</small><div class="st-future"><button data-st-planned="lock">锁定 · 待开放</button><button data-st-planned="repair">维修 · 待开放</button></div></div>';
    for(const button of box.querySelectorAll('[data-st-action]'))button.onclick=()=>{if(!Save.stash.includes(e)){this.selected=null;this.rerender();return;}const action=button.dataset.stAction;if(action==='use')Medical.use(e,'stash');if(action==='transfer')Base.toBag(e);if(action==='sell')Base.askSell(e,e.n||1,s.node);if(action==='unload')Base.unloadGun(it);if(action==='equip')Safehouse.route('loadout');};
  },
  confirmJunk(){
    const entries=Save.stash.filter(e=>{const it=stashItem(e);return it&&itemGroup(it)==='collectible'&&it.r===1;});
    if(!entries.length){this.feedback('仓库里没有可出售的寻常收集品。');return;}
    const quote=entries.map(e=>({e,n:e.n||1,price:stashItem(e).price})),sum=quote.reduce((n,x)=>n+x.price*x.n,0),count=quote.reduce((n,x)=>n+x.n,0);
    Deal.show({kind:'sell',title:'确认出售寻常收集品',name:count+' 件 · '+entries.length+' 格',sub:'仅寻常收集品，排除医疗、弹药与装备',price:sum,onGo:()=>{const current=Save.stash.filter(e=>{const it=stashItem(e);return it&&itemGroup(it)==='collectible'&&it.r===1;});if(current.length!==quote.length||quote.some((x,i)=>current[i]!==x.e||(x.e.n||1)!==x.n||stashItem(x.e).price!==x.price)){this.feedback('库存已变化，请重新确认出售清单。',true);return;}Base.sellJunk();}},this.el.querySelector('[data-st-bulk]').getBoundingClientRect());
  },
  renderDemo(){
    if(!this.mounted)return;const items=STORAGE_UI_CONFIG.demo,list=items.filter(i=>(this.category==='all'||i.category===this.category||(this.category.startsWith('cat:')&&i.cat===this.category.slice(4)))&&(this.quality==='all'||i.rarity===Number(this.quality))&&i.name.toLowerCase().includes(this.query.trim().toLowerCase()));if(this.sort==='rarity')list.sort((a,b)=>b.rarity-a.rarity);if(this.sort==='name')list.sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));if(this.sort==='category')list.sort((a,b)=>a.category.localeCompare(b.category)||a.name.localeCompare(b.name,'zh-CN'));if(this.selected&&!list.includes(this.selected.item))this.selected=null;const grid=this.el.querySelector('.st-demo-grid');grid.innerHTML='';for(const item of list){const b=document.createElement('button');b.className='scell r'+item.rarity;b.innerHTML='<img alt="" src="../../../assets/'+item.file+'"><span class="cn">'+MerchantUI.esc(item.name)+'</span>'+(item.quantity?'<span class="qty">'+item.quantity+'</span>':'');b.onclick=()=>{this.selected={item};this.renderDetail();};grid.appendChild(b);}this.el.querySelector('[data-st-capacity]').textContent=items.length+' / 600 格 · 演示';this.el.querySelector('.st-capacity i').style.width=items.length/600*100+'%';this.el.querySelector('[data-st-visible]').textContent='演示数据 · 不连接实际仓库';this.el.querySelector('.st-empty').hidden=list.length>0;for(const b of this.el.querySelectorAll('[data-st-category]')){b.classList.toggle('on',b.dataset.stCategory===this.category);b.querySelector('small').textContent=items.filter(i=>b.dataset.stCategory==='all'||i.category===b.dataset.stCategory||('cat:'+i.cat)===b.dataset.stCategory).length;}this.renderDetail();
  }
};
{
 const mount=Safehouse.mount,apply=Safehouse.applyView;
 Safehouse.mount=function(){const r=mount.apply(this,arguments);StorageUI.mount();return r;};
 Safehouse.applyView=function(){apply.apply(this,arguments);StorageUI.applyView();};
 if(typeof Base!=='undefined'){
  const list=Base.stashList,render=Base.renderStash,show=Base.showItem,note=Base.note,metrics=Base.gridMetrics;
  Base.stashList=function(){return StorageUI.mounted&&Safehouse.view==='stash'?StorageUI.list():list.apply(this,arguments);};
  Base.renderStash=function(){const r=render.apply(this,arguments);StorageUI.afterRender();return r;};
  Base.showItem=function(e,where,node){if(StorageUI.mounted&&Safehouse.view==='stash'&&where==='stash')return StorageUI.select(e,node);return show.apply(this,arguments);};
  Base.note=function(msg,bad){const r=note.apply(this,arguments);if(StorageUI.mounted&&Safehouse.view==='stash')StorageUI.feedback(msg,bad);return r;};
  Base.gridMetrics=function(){if(!StorageUI.mounted||Safehouse.view!=='stash')return metrics.apply(this,arguments);const grid=document.getElementById('stashGrid'),style=getComputedStyle(grid),w=Math.max(240,grid.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)),h=Math.max(160,grid.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom)),gap=9,cols=Math.max(3,Math.floor((w+gap)/91)),cell=(w-gap*(cols-1))/cols,rows=Math.max(2,Math.floor((h+gap)/(cell+gap)));return{cols,rows,cell};};
 }
}
