/* All prices derive from current item data; no inventory mutations during preview. */
const MERCHANT_BUYBACK={
 gun:{label:'枪械、近战武器、弹药、枪械配件',allow:['gun','melee','ammo','attachment'],multipliers:{},items:{}},
 shop:{label:'头盔、护甲、背包',allow:['armor','bag'],multipliers:{},items:{}},
 doctor:{label:'医疗道具（含效果待开放）',allow:['medical'],multipliers:{},items:{}},
 viktor:{label:'全部九类收集品，含医疗类收集品',allow:['collectible'],multipliers:{},items:{}}
};
const Sales={
 ids:new WeakMap(),serial:0,tokens:new Map(),nonce:0,
 id(e){if(!this.ids.has(e))this.ids.set(e,'sale-'+(++this.serial));return this.ids.get(e);},
 kind(it){return it.equip?.kind||(itemGroup(it)==='collectible'?'collectible':it.cat);},
 quote(merchant,e){
  const item=stashItem(e),out={ok:false,item,status:'refused',reason:'物品不可交易',base:0,unit:0,multiplier:1};if(!item)return out;
  if(item.equip?.bound)return {...out,status:'bound',reason:'绑定物品不可出售'};
  const kind=this.kind(item),rule=MERCHANT_BUYBACK[merchant],override=rule?.items?.[item.id];
  if(merchant!=='warehouse'&&(!rule||override?.allowed===false||(!rule.allow.includes(kind)&&override?.allowed!==true)))return {...out,reason:'当前商人不收购此类物品'};
  const multiplier=override?.multiplier??rule?.multipliers?.[kind]??1,base=unitPrice(item),unit=Math.floor(base*multiplier);
  if(!Number.isFinite(unit)||unit<0||!Number.isFinite(base)||base<0)return out;
  return {...out,ok:true,status:multiplier<1?'low':'allowed',reason:multiplier<1?'收购价低于现行回收价值':'可出售',base,unit,multiplier};
 },
 fingerprint(merchant,e){const q=this.quote(merchant,e);return JSON.stringify([e.id,e.n||1,e.cap,e.gear,q.ok,q.base,q.unit,q.multiplier]);},
 preview(merchant,requests){
  let base=0,total=0,units=0;const seen=new Set(),rows=[],errors=[];
  for(const r of requests){const e=r.entry,q=this.quote(merchant,e),id=e&&this.id(e),n=Number(r.n);let reason='';
   if(!e||!Save.stash.includes(e))reason='物品已不在仓库';else if(seen.has(id))reason='同一物品重复选择';else if(!q.ok)reason=q.reason;else if(!Number.isSafeInteger(n)||n<1||n>(e.n||1)||(e.gear&&n!==1))reason='出售数量无效';
   if(id)seen.add(id);if(reason)errors.push({id,reason});
   const row={entry:e,id,n,...q,reason:reason||q.reason,fingerprint:e?this.fingerprint(merchant,e):'',valid:!reason};rows.push(row);
   if(!reason){base+=q.base*n;total+=q.unit*n;units+=n;}
  }
  return {merchant,rows,base,total,units,ok:rows.length>0&&!errors.length&&Number.isSafeInteger(total)&&Number.isSafeInteger(Save.credits+total),errors};
 },
 authorize(preview){if(!preview.ok)return null;const token='checkout-'+(++this.nonce);this.tokens.set(token,{merchant:preview.merchant,total:preview.total,junkIds:preview.junkIds,rows:preview.rows.map(r=>({entry:r.entry,n:r.n,fingerprint:r.fingerprint}))});return token;},
 cancel(token){this.tokens.delete(token);},
 confirmWarehouse(requests,rect,allJunk=false){const p=this.preview('warehouse',requests);if(!p.ok){Base.note(p.errors[0]?.reason||'仓库里没有可出售的物品',true);return;}if(allJunk)p.junkIds=requests.map(r=>this.id(r.entry)).sort().join(',');Deal.hide();const token=this.authorize(p);this.warehouseToken=token;const it=p.rows[0].item;
  Deal.show({kind:'sell',title:p.rows.length===1?'卖出':'确认出售寻常收集品',name:p.rows.length===1?it.name+' ×'+p.units:p.rows.length+' 格 · '+p.units+' 件',sub:'沿用现有回收价值 · 确认前不扣除物品',id:it.id,icon:it.icon,price:p.total,onGo:()=>{const r=this.commit(token);if(!r.ok)Base.note(r.reason,true);}},rect||{left:100,top:100,width:1,height:1,right:101,bottom:101});
 },
 commit(token){
  const sale=this.tokens.get(token);this.tokens.delete(token);const fail=reason=>({ok:false,reason});
  if(!sale)return fail('确认已失效，请重新核对');if(Game.state!=='base')return fail('当前无法出售');
  if(sale.merchant!=='warehouse'&&(Safehouse.view!=='merchant'||MerchantUI.key!==sale.merchant||MerchantUI.mode!=='sell'))return fail('商人或页面已变化');
  const current=this.preview(sale.merchant,sale.rows);
  if(sale.junkIds!==undefined&&Save.stash.filter(e=>{const it=stashItem(e);return it&&itemGroup(it)==='collectible'&&it.r===1;}).map(e=>this.id(e)).sort().join(',')!==sale.junkIds)return fail('库存已变化，请重新确认出售清单');
  if(!current.ok||current.total!==sale.total||sale.rows.some(r=>this.fingerprint(sale.merchant,r.entry)!==r.fingerprint))return fail('库存或报价已变化，请重新确认整笔交易');
  const old=Save.stash,credits=Save.credits,quantities=new Map(sale.rows.map(r=>[r.entry,r.n]));
  const next=[];for(const e of old){const n=quantities.get(e);if(!n)next.push(e);else if((e.n||1)>n)next.push({...e,n:e.n-n});}
  Save.stash=next;Save.credits=credits+current.total;Save.save();
  if(Save.flush()!==true){Save.stash=old;Save.credits=credits;Save._dirty=true;return fail('存档写入失败，本次未出售，请检查浏览器存储后重试');}
  Game.sfx('sell');Base.render();Base.note('已出售 '+sale.rows.length+' 项，+'+formatMoney(current.total));return {ok:true,total:current.total,units:current.units};
 }
};
