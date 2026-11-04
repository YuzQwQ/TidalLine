/* Static collectible retail; references existing item definitions and Save inventory. */
const MERCHANT_INVENTORY={viktor:{priceMultiplier:1.25,items:[
 'life01','life06','life04','life05','life11','life20',
 'elec01','elec03','elec07','elec02',
 'ind01','ind02','ind07','ind10',
 'antiq02','art01','med02','med15'
]}};
const TradeMerchant={
 offers(key='viktor'){const c=MERCHANT_INVENTORY[key];if(!c)return [];return c.items.map(id=>ITEM_BY_ID[id]).filter(it=>it&&it.r<=4&&['life','elec','ind','collect','med'].includes(it.cat)).map(item=>({item,price:Math.max(Math.ceil(item.price*c.priceMultiplier),unitPrice(item)+1)}));},
 buy(key,id,expectedPrice){
  if(Game.state!=='base'||Safehouse.view!=='merchant'||Base.tab!==key)return false;
  const o=this.offers(key).find(o=>o.item.id===id);if(!o)return false;
  if(o.price!==expectedPrice){Base.note('报价已变化，请重新确认',true);return false;}
  if(Save.credits<o.price){Base.note('信用点不足',true);return false;}
  if(!Save.canAddStash(id,1)){Base.note('仓库空间不足',true);return false;}
  Save.credits-=o.price;Save.addStash(id,1);Save.save();Save.flush();Base.render();Base.note('买下'+o.item.name+'，已放入仓库');
  if(typeof MerchantSpeech!=='undefined')MerchantSpeech.say('purchase',key);return true;
 },
 render(el,key='viktor'){
  document.getElementById('shopNote').textContent='固定货架 · 白至紫收集品 · 每次购买一件；售价为参考价值的125%。出售请前往仓库。';
  document.getElementById('shopHint').textContent='购买后直接进入仓库；暂无动态行情、限购或信任门槛。';
  for(const o of this.offers(key)){
   const it=o.item,cell=document.createElement('div');cell.className='scell r'+it.r;cell.dataset.offer=JSON.stringify({kind:'collectible',id:it.id,merchant:key,price:o.price});
   cell.innerHTML=Icons.bagTag(it,'')+'<span class="cn">'+esc(it.short||it.name)+'</span><span class="pr">'+formatMoney(o.price)+'</span>';cell.title=it.name+' · '+formatMoney(o.price);
   cell.onclick=()=>Deal.show({kind:'buy',title:'购买收集品',name:it.name,id:it.id,sub:'贸易商 · 一件 · 进入仓库',price:o.price,can:Save.credits>=o.price&&Save.canAddStash(it.id,1),onGo:()=>this.buy(key,it.id,o.price)},cell.getBoundingClientRect());el.appendChild(cell);
  }
 }
};
