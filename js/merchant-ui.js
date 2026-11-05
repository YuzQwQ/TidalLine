/* Merchant presentation adapter. Base retains prices, stock, confirmation and transaction logic. */
const MerchantUI={
  mounted:false,key:'shop',mode:'buy',filter:'all',query:'',sort:'default',selected:null,offers:[],
  esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},
  mount(){
    if(this.mounted||!Safehouse.root)return;this.mounted=true;const root=Safehouse.root;
    root.style.setProperty('--mb-room','url("'+new URL(Safehouse.asset('room'),document.baseURI).href+'")');
    this.overview=document.createElement('section');this.overview.className='mb-overview';this.overview.hidden=true;
    this.overview.innerHTML=`<div class="mb-overview-head"><div><small>TRADERS / 联络网络</small><h1>商人</h1><p>交换物资，建立联络。每个人都有自己的规矩。</p></div><button class="mb-network sh-metal" data-mb-plan="trust">${Safehouse.icon('radio')}<span>已建立联络 <b>${Object.keys(SAFEHOUSE_CONFIG.merchants).length} / ${Object.keys(SAFEHOUSE_CONFIG.merchants).length}</b><small>独立信任成长 · ${Safehouse.demo?'演示规划':'尚未开放'}</small></span></button></div><div class="mb-cards">${Object.keys(SAFEHOUSE_CONFIG.merchants).map(k=>[k,MERCHANT_UI_CONFIG[k]]).map(([k,c])=>{const m=SAFEHOUSE_CONFIG.merchants[k];return `<button class="mb-card" data-mb-open="${k}">${m.asset?`<img src="${Safehouse.asset(m.asset)}" alt="${m.name}">`:`<div class="mb-portrait-placeholder"><strong>${c.initial||'V'}</strong><span>${c.english}</span><small>形象待补充</small></div>`}<div class="mb-card-trust">${Safehouse.demo?'信任 Lv.2 <em>演示</em>':'信任体系待开放'}<div><i style="width:${Safehouse.demo?'45':'0'}%"></i></div></div><div class="mb-card-person"><span class="sh-hex">${Safehouse.icon(c.icon)}</span><div><h2>${m.name}</h2><small>${c.english}</small><b>${c.tag}</b></div></div><div class="mb-card-foot"><p>${c.summary}</p><small>${c.description}</small><span>进入商店 »</span></div></button>`;}).join('')}</div><div class="mb-news sh-metal"><div><h2>${Safehouse.icon('task')}商人消息</h2><button class="mb-back" data-mb-plan="contacts">更多合作方 · 待开放 →</button>${Object.keys(SAFEHOUSE_CONFIG.merchants).map(k=>'<p>◇ '+MERCHANT_UI_CONFIG[k].notice+'</p>').join('')}</div><button class="mb-gold" data-mb-plan="quests">${Safehouse.icon('task')}商人委托 <small>待开放</small> »</button></div>`;
    root.insertBefore(this.overview,root.querySelector('.sh-work'));
    this.detail=document.createElement('div');this.detail.className='mb-detail';this.detail.hidden=true;
    this.detail.innerHTML=`<aside class="mb-person"><button class="mb-back" data-mb-overview>‹ 商人总览</button><div class="mb-person-photo"><img alt=""><div><h2></h2><small></small><b></b></div></div><button class="mb-trust sh-metal" data-mb-plan="trust"><span>独立信任 <b>${Safehouse.demo?'Lv.2 · 演示':'待开放'}</b></span><div><i style="width:${Safehouse.demo?'45':'0'}%"></i></div><small>信誉、交易与关键委托</small></button><nav aria-label="商人功能"><button data-mb-mode="buy">${Safehouse.icon('cart')}商品购买</button><button data-mb-mode="sell">${Safehouse.icon('box')}商品出售</button><button data-mb-plan="quests">${Safehouse.icon('task')}任务委托 <small>待开放</small></button><button data-mb-plan="rewards">${Safehouse.icon('archive')}信任奖励 <small>待开放</small></button></nav></aside><section class="mb-center"><header class="mb-quote sh-metal"><p></p><small></small></header><section class="mb-catalog sh-metal"><div class="mb-categories" role="group" aria-label="商品分类"></div><div class="mb-toolbar"><label><span class="sr-only">商品排序</span><select aria-label="商品排序"><option value="default">默认排序</option><option value="priceUp">价格从低到高</option><option value="priceDown">价格从高到低</option><option value="rarity">品质优先</option></select></label><label class="mb-search"><span class="sr-only">搜索商品</span><input aria-label="搜索商品" placeholder="搜索商品…"></label></div><div class="mb-buy-mount"></div><div class="mb-sell-mount" hidden></div><p class="mb-empty" hidden>没有匹配的商品，试试其他分类或关键词。</p><p class="mb-feedback" role="status" aria-live="polite" hidden></p><div class="mb-catalog-foot"><span data-mb-count></span><span data-mb-wallet></span></div></section></section><aside class="mb-right"><section class="mb-next sh-metal"><h3>合作与成长 <small>未来规划</small></h3><p></p><button data-mb-plan="trust">查看信任计划 →</button></section><section class="mb-inspector sh-metal"></section></aside>`;
    root.querySelector('.sh-work').appendChild(this.detail);
    if(!Safehouse.demo){this.originalMain=root.querySelector('.base-main');this.stock=root.querySelector('.base-right');this.pane=root.querySelector('#paneShop');this.detail.querySelector('.mb-buy-mount').appendChild(this.pane);}
    else this.detail.querySelector('.mb-buy-mount').innerHTML='<div id="mbDemoGoods" class="shop-grid"></div>';
    root.addEventListener('click',e=>{const open=e.target.closest('[data-mb-open]');if(open)this.open(open.dataset.mbOpen);if(e.target.closest('[data-mb-overview]'))Safehouse.route('traders');const plan=e.target.closest('[data-mb-plan]');if(plan)Safehouse.explain('后续内容',MERCHANT_UI_CONFIG.messages[plan.dataset.mbPlan]);const mode=e.target.closest('[data-mb-mode]');if(mode)this.setMode(mode.dataset.mbMode);const cat=e.target.closest('[data-mb-filter]');if(cat){if(cat.dataset.mbFilter==='planned'){Safehouse.explain('商品类别规划','此类别尚无已开放商品。配件与功能组件需等待对应系统实装，不使用演示进度解锁。');return;}this.filter=cat.dataset.mbFilter;this.applyFilters();}});
    this.detail.querySelector('input').addEventListener('input',e=>{this.query=e.target.value;this.applyFilters();});this.detail.querySelector('select').addEventListener('change',e=>{this.sort=e.target.value;this.applyFilters();});
    this.applyView();
  },
  open(key){
    if(Safehouse.demo&&key==='elena'){Safehouse.explain('私人事务所','游戏内已开放收藏回收与首批私人委托。本独立视觉稿不读取存档，也不模拟委托或提供商品购买。请从游戏的商人总览进入伊莲娜事务所。');return;}
    if(!this.mounted)this.mount();if(!SAFEHOUSE_CONFIG.merchants[key])return;
    this.detail.querySelector('.mb-feedback').hidden=true;this.key=key;this.mode=MERCHANT_UI_CONFIG[key]?.defaultMode||'buy';this.filter='all';this.query='';this.sort='default';this.selected=null;
    Safehouse.stopTimer();if(!Safehouse.demo){Tips.hide();Deal.hide();Base.closePicker();Base.tab=key;}
    Safehouse.view='merchant';this.renderIdentity();Safehouse.applyView();
    if(!Safehouse.demo)Base.render();else this.renderDemo();
    this.applyFilters();Safehouse.refresh();
  },
  renderIdentity(){
    const c=MERCHANT_UI_CONFIG[this.key],m=SAFEHOUSE_CONFIG.merchants[this.key],p=this.detail.querySelector('.mb-person-photo');p.querySelector('img').hidden=!m.asset;if(m.asset)p.querySelector('img').src=Safehouse.asset(m.asset);let ph=p.querySelector('.mb-portrait-placeholder');if(!m.asset&&!ph){ph=document.createElement('div');ph.className='mb-portrait-placeholder';ph.innerHTML='<strong>V</strong><span>VIKTOR SAREN</span><small>形象待补充</small>';p.prepend(ph);}if(ph)ph.hidden=!!m.asset;this.detail.querySelector('[data-mb-mode="sell"]').hidden=false;p.querySelector('img').alt=m.name;p.querySelector('h2').textContent=m.name;p.querySelector('h2').parentElement.querySelector('small').textContent=c.english;p.querySelector('b').textContent=c.tag;this.detail.querySelector('.mb-quote p').textContent='“'+m.quote+'”';this.detail.querySelector('.mb-quote small').textContent=c.summary;this.detail.querySelector('.mb-next p').textContent=c.future;this.detail.querySelector('.mb-categories').innerHTML=c.categories.map(([id,label])=>'<button data-mb-filter="'+id+'">'+label+'</button>').join('');this.detail.querySelector('input').value=this.query;this.detail.querySelector('select').value=this.sort;
  },
  applyView(){
    if(!this.mounted)return;const v=Safehouse.view,show=v==='merchant';this.overview.hidden=v!=='traders';this.detail.hidden=!show;
    if(v==='traders'){Safehouse.root.querySelector('.sh-work').hidden=true;Safehouse.stopTimer();}
    if(show){Safehouse.root.querySelector('.sh-work').hidden=false;const n=Safehouse.root.querySelector('.sh-top nav [data-sh="traders"]');n.classList.add('on');n.setAttribute('aria-current','page');if(!Safehouse.demo&&this.stock.parentNode!==this.detail.querySelector('.mb-sell-mount'))this.detail.querySelector('.mb-sell-mount').appendChild(this.stock);}
    else if(!Safehouse.demo&&this.stock.parentNode===this.detail.querySelector('.mb-sell-mount'))this.originalMain.appendChild(this.stock);
    if(show){this.detail.querySelector('[data-mb-wallet]').textContent=Safehouse.demo?'¥60,000 · 演示':formatMoney(Save.credits);this.applyMode();}
  },
  setMode(mode){if(!['buy','sell'].includes(mode)||this.key==='elena'&&mode==='buy')return;if(Safehouse.demo&&mode==='sell'){Safehouse.explain('出售界面','正式游戏中展示真实仓库，选择物品后通过原出售确认回收。独立视觉稿不读取库存。');return;}this.mode=mode;this.selected=null;this.applyMode();this.applyFilters();if(!Safehouse.demo){Tips.hide();Deal.hide();Base.page=0;Base.renderStash();}},
  applyMode(){const sell=this.mode==='sell';this.detail.querySelector('.mb-buy-mount').hidden=sell;this.detail.querySelector('.mb-sell-mount').hidden=!sell;this.detail.querySelector('.mb-toolbar').hidden=sell;this.detail.querySelector('.mb-categories').hidden=sell;this.detail.querySelector('.mb-empty').hidden=sell||this.offers.some(o=>!o.cell.hidden);this.detail.querySelectorAll('[data-mb-mode]').forEach(b=>b.classList.toggle('on',b.dataset.mbMode===this.mode));},
  offer(meta,cell){
    let item,category=meta.kind,quantity=meta.quantity||1;
    if(meta.kind==='armor')item=EQUIP.armor(GEAR.make(meta.type,meta.id||meta.lv));else if(meta.kind==='bag')item=EQUIP.bag(meta.id);else if(meta.kind==='gun')item=EQUIP.gun(meta.id);else if(meta.kind==='melee')item=EQUIP.melee(meta.id);else item=ITEM_BY_ID[meta.id];
    if(!item)return null;if(meta.kind==='medical')category=item.medicalGroup;if(meta.kind==='collectible')category=item.cat;
    return {key:JSON.stringify(meta),meta,item,category,quantity,price:(meta.price??item.price)*quantity,cell,confirm:cell.onclick};
  },
  decorate(){
    if(!this.mounted||Safehouse.view!=='merchant'||Safehouse.demo)return;this.key=Base.tab;this.renderIdentity();this.offers=[];
    for(const cell of this.pane.querySelectorAll('#shopGrid .scell')){const meta=cell.dataset.offer?JSON.parse(cell.dataset.offer):cell.dataset.melee?{kind:'melee',id:cell.dataset.melee}:null;if(!meta)continue;const o=this.offer(meta,cell);if(!o)continue;this.offers.push(o);cell.setAttribute('role','button');cell.tabIndex=0;cell.setAttribute('aria-label',o.item.name+'，'+formatMoney(o.price));cell.onclick=()=>this.choose(o);cell.oncontextmenu=e=>{e.preventDefault();if(Safehouse.demo){this.choose(o);return;}Tips.show(o.item,cell.getBoundingClientRect(),'选择商品后，点击右侧购买');};cell.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.choose(o);}};}
    const key=this.selected?.key;this.selected=this.mode==='buy'?(this.offers.find(o=>o.key===key)||this.offers[0]||null):this.selected;
    if(this.selected?.entry&&!Save.stash.includes(this.selected.entry))this.selected=null;
    this.applyFilters();this.renderSelection();
  },
  applyFilters(){
    if(!this.mounted)return;const query=this.query.trim().toLowerCase();let shown=0;const sorted=this.offers.slice();
    if(this.sort==='priceUp')sorted.sort((a,b)=>a.price-b.price);if(this.sort==='priceDown')sorted.sort((a,b)=>b.price-a.price);if(this.sort==='rarity')sorted.sort((a,b)=>(b.item.r||1)-(a.item.r||1));
    for(const o of sorted){o.cell.hidden=!(this.filter==='all'||o.category===this.filter)||!o.item.name.toLowerCase().includes(query);if(!o.cell.hidden)shown++;o.cell.parentNode.appendChild(o.cell);o.cell.classList.toggle('mb-selected',o.key===this.selected?.key);}
    this.detail.querySelectorAll('[data-mb-filter]').forEach(b=>b.classList.toggle('on',b.dataset.mbFilter===this.filter));
    if(this.mode==='buy'&&this.selected?.cell.hidden)this.selected=this.offers.find(o=>!o.cell.hidden)||null;
    this.detail.querySelector('[data-mb-count]').textContent=this.mode==='sell'?'从真实仓库选择回收物品':'显示 '+shown+' / '+this.offers.length+' 件商品';
    this.detail.querySelector('.mb-empty').hidden=this.mode!=='buy'||shown>0;this.renderSelection();
  },
  choose(o){this.selected=o;this.renderSelection();},
  selectStock(entry){if(typeof MerchantSales!=='undefined')MerchantSales.select(entry);},
  renderSelection(){
    if(!Safehouse.demo&&this.mode==='sell'&&typeof MerchantSales!=='undefined'){MerchantSales.render();return;}
    const panel=this.detail?.querySelector('.mb-inspector');if(!panel)return;const o=this.selected;
    this.offers.forEach(x=>{x.cell.classList.toggle('mb-selected',x===o);x.cell.setAttribute('aria-pressed',x===o?'true':'false');});
    if(!o){panel.innerHTML='<small>ITEM DETAILS</small><h2>'+(this.mode==='sell'?'选择库存物品':'选择商品')+'</h2><p>在中间区域选择物品，在这里查看真实参数和交易信息。</p>';return;}
    const it=o.item,ammo=o.meta?.kind==='ammo',rows=[['品质',(typeof RARITY!=='undefined'?RARITY[(it.r||1)-1]?.name:null)||'演示'],['重量',(it.w||0)+' kg'],ammo?['购买上限',Base.SHOP_AMMO_MAX_STACKS+'组（'+stackLimit(it)*Base.SHOP_AMMO_MAX_STACKS+'发）']:['每次交易',o.quantity+' 件']];
    if(!Safehouse.demo&&o.meta?.kind==='collectible')rows.push(['仓库持有',Save.stashCount(it.id)+' 件']);const m=o.meta;if(!Safehouse.demo){if(m?.kind==='gun'){const w=WEAPONS[m.id];rows.push(['伤害',w.dmgMin+'–'+w.dmgMax],['射速',w.rpm+' 发/分'],['弹匣',w.mag+' 发']);}if(m?.kind==='armor'){const g=GEAR.def(m.type,m.id||m.lv);rows.push(['防护等级',g.lv],['耐久',g.dur]);if(m.type==='body')rows.push(['瞄准时间惩罚','+'+g.aimPenaltyPct+'%']);}if(m?.kind==='bag')rows.push(['背包容量',it.equip.slots+' 格']);if(m?.kind==='ammo')rows.push(['穿透等级',it.penLevel]);if(m?.kind==='melee'){const d=MELEE.find(x=>x.id===m.id);rows.push(['真实伤害',d.damage],['攻击间隔 / 前摇',d.interval+' / '+d.windup+' 秒'],['扇角 / 半径',d.angle+'° / '+d.radius+' 格']);if(d.positioning)rows.push(['定位',d.positioning]);}if(m?.kind==='medical')rows.push(['使用效果',Medical.summary(it)]);if(o.entry&&it.healCap)rows.push(['剩余容量',Math.ceil(Medical.entryCap(o.entry))+' / '+it.healCap]);}
    if(!Safehouse.demo&&o.entry&&it.equip?.kind==='gun'){const w=Attachments.resolve(it.equip.gun,it.equip.attachments);rows.push(['有效弹匣',w.mag+' 发'],['换弹时间',w.reloadTime.toFixed(2)+' 秒'],['已装配件',Object.keys(w.attachments||{}).length+' 件']);}
    const image=o.cell.querySelector('img')?.src,preview=Safehouse.demo?(image?'<img src="'+this.esc(image)+'" alt="">':Safehouse.icon('box')):Icons.detailTag(it,'');const selling=this.mode==='sell';let can=true,reason='';
    if(!Safehouse.demo){if(selling&&it.equip?.bound){can=false;reason='绑定赠送物品不可出售';}else if(!selling&&Save.credits<o.price){can=false;reason='信用点不足';}else if(!selling&&((it.equip&&Save.stash.length>=STASH_SLOTS)||(!it.equip&&!Save.canAddStash(it.id,o.quantity)))){can=false;reason='仓库容量不足';}}
    panel.innerHTML='<div class="mb-inspector-body"><small>'+(selling?'RECYCLE / 回收':'ITEM DETAILS')+'</small><h2>'+this.esc(it.name)+'</h2><div class="mb-item-preview">'+preview+'</div><dl>'+rows.map(([k,v])=>'<div><dt>'+this.esc(k)+'</dt><dd>'+this.esc(v)+'</dd></div>').join('')+'</dl><p>'+itemDescriptionHtml(it,it.desc||'参数来自当前物品定义，交易沿用现有规则。')+'</p></div><div class="mb-price"><small>'+(selling?'回收价':ammo?'每发单价':'本次售价')+'</small><b>'+this.money(o.price)+(ammo?' / 发':'')+'</b></div><button class="mb-gold" data-mb-confirm '+(!can?'disabled':'')+'>'+Safehouse.icon(selling?'box':'cart')+(selling?'确认出售':'购买')+'</button><small class="mb-reason">'+this.esc(reason||(Safehouse.demo?'仅展示，不会发起交易':ammo?'选择购买数量后确认金额':'下一步核对金额并确认'))+'</small>'+(o.actions?'<button class="mb-item-actions">物品操作 · 使用 / 转移 / 退弹</button>':'');
    if(!Safehouse.demo)Icons.bindDetailImages(panel);
    panel.querySelector('[data-mb-confirm]').onclick=()=>{if(Safehouse.demo)Safehouse.explain('视觉演示','此页不进行真实购买。请在游戏内通过交易确认购买物品。');else if(can)o.confirm();};
    if(o.actions)panel.querySelector('.mb-item-actions').onclick=o.actions;
  },
  money(n){return Safehouse.demo?'¥'+n.toLocaleString('en-US'):formatMoney(n);},
  renderDemo(){
    const c=this.key==='viktor'?[['life01','搪瓷缸',2250,'life'],['elec01','收音机',9375,'elec'],['ind02','轴承',7000,'ind'],['antiq02','黄铜怀表',21250,'collect'],['med15','便携式心电图机',40000,'med']]:this.key==='shop'?[['helmet3','防撞头盔',15000,'armor'],['body3','轻型战术背心',28000,'armor'],['bag03','加固登山背包',45000,'bag']]:this.key==='gun'?[['rifle','突击步枪',45000,'gun'],['pistol','手枪',5000,'gun'],['melee02','M-9 制式战斗刀',270000,'melee'],['ammo_556','5.56×45mm 弹药',1800,'ammo']]:[['heal01','绷带',2000,'recovery'],['heal03','家庭急救包',12000,'recovery']];
    const grid=this.detail.querySelector('#mbDemoGoods');grid.innerHTML='';this.offers=c.map(([id,name,price,category])=>{const cell=document.createElement('div');cell.className='scell r3';const folder=['armor','bag','gun','melee'].includes(category)?'gear':'items';cell.innerHTML='<img alt="" src="../../../assets/'+folder+'/'+id+'.png"><span class="cn">'+name+'</span><span class="pr">'+this.money(price)+'</span>';grid.appendChild(cell);const o={key:id,item:{name,price,w:1,r:3,desc:'演示商品；不读取实际存档或开放未来货物。'},price,category,quantity:1,cell};cell.tabIndex=0;cell.setAttribute('role','button');cell.onclick=()=>this.choose(o);cell.onkeydown=e=>{if(e.key==='Enter')this.choose(o);};return o;});this.selected=this.offers[0];this.applyFilters();
  }
};
// Shared shell integration; existing runtime implementations remain the transaction authority.
{
 const mount=Safehouse.mount,apply=Safehouse.applyView,route=Safehouse.route;
 Safehouse.mount=function(){const r=mount.apply(this,arguments);MerchantUI.mount();return r;};
 Safehouse.applyView=function(){apply.apply(this,arguments);MerchantUI.applyView();};
 Safehouse.route=function(id){if(id==='doctor'){MerchantUI.open('doctor');return;}return route.apply(this,arguments);};
 if(typeof Base!=='undefined'){
  const renderShop=Base.renderShop,show=Base.showItem,note=Base.note;
  Base.note=function(msg,bad){const r=note.apply(this,arguments);if(MerchantUI.mounted&&Safehouse.view==='merchant'){const el=MerchantUI.detail.querySelector('.mb-feedback');el.hidden=false;el.textContent=msg;el.classList.toggle('bad',!!bad);}return r;};
  Base.renderShop=function(){const r=renderShop.apply(this,arguments);MerchantUI.decorate();return r;};
  Base.showItem=function(e,where,node){if(MerchantUI.mounted&&Safehouse.view==='merchant'&&MerchantUI.mode==='sell'&&where==='stash')return MerchantUI.selectStock(e,node,show);return show.apply(this,arguments);};
 }
}
