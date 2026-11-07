/* All prices derive from current item data; no inventory mutations during preview. */
const MERCHANT_BUYBACK={
 elena:{label:'文物藏品、神秘学100%；情报80%；即影相机、微型录像机、多通道数据记录器60%；其他物品不收购',allow:['collectible'],multipliers:{},items:{}},
 gun:{label:'枪械、弹药与配件；偏好电子产品、军事物资及通信资料',allow:['gun','melee','ammo','attachment'],multipliers:{},items:{}},
 shop:{label:'防具与背包；偏好工业器材、港务资料和防护检测器材',allow:['armor','bag'],multipliers:{},items:{}},
 doctor:{label:'医疗道具；偏好医疗收集品及异常观察资料',allow:['medical'],multipliers:{},items:{}},
 viktor:{label:'收购全部九类收集品与钥匙（钥匙按剩余耐久 × 75% 回收）；偏好生活用品及历史影像',allow:['collectible','key'],multipliers:{},items:{}}
};
for(const rule of Object.values(MERCHANT_BUYBACK))if(!rule.allow.includes('collectible'))rule.allow.push('collectible');
const Sales={
 ids:new WeakMap(),serial:0,tokens:new Map(),nonce:0,
 id(e){if(!this.ids.has(e))this.ids.set(e,'sale-'+(++this.serial));return this.ids.get(e);},
 kind(it){return it.equip?.kind||(itemGroup(it)==='collectible'?'collectible':it.cat);},
 quote(merchant,e){
  const item=stashItem(e),out={ok:false,item,status:'refused',reason:'物品不可交易',base:0,unit:0,multiplier:1};if(!item)return out;
  if(item.equip?.bound)return {...out,status:'bound',reason:'绑定物品不可出售'};
  if(merchant==='warehouse')return {...out,reason:'请前往商人处出售，仓库金额仅为估价'};
  const kind=this.kind(item),rule=MERCHANT_BUYBACK[merchant],override=rule?.items?.[item.id];
  if(merchant!=='warehouse'&&(!rule||override?.allowed===false||(!rule.allow.includes(kind)&&override?.allowed!==true)))return {...out,reason:'当前商人不收购此类物品'};
  /* 钥匙：原价 × 剩余耐久% × 75% 回收；耐久耗尽（cap≤0）不可回收，随规范化直接销毁。 */
  if(kind==='key'){
   const max=ItemCapacity.max(item),rem=ItemCapacity.remaining(e);
   if(!(max>0)||!(rem>0))return {...out,status:'refused',reason:'耐久耗尽，钥匙已无法回收'};
   const base=unitPrice(item),unit=Math.floor(base*(rem/max)*0.75);
   if(!Number.isFinite(unit)||unit<0)return out;
   return {...out,ok:true,status:'normal',reason:'钥匙回收 · 原价75% × 剩余耐久 '+rem+'/'+max,base,unit,multiplier:0.75*rem/max};
  }
  const rate=kind==='collectible'?(COLLECTIBLE_BUYBACK.overrides[item.id]?.[merchant]??COLLECTIBLE_BUYBACK.defaultRates[item.cat]?.[merchant]??60):100;
  if(kind==='collectible'&&rate===0)return {...out,reason:'当前商人不收购此类物品'};
  const multiplier=override?.multiplier??rule?.multipliers?.[kind]??rate/100,base=unitPrice(item),unit=Math.floor(base*(multiplier*100)/100);
  if(!Number.isFinite(unit)||unit<0||!Number.isFinite(base)||base<0)return out;
  const status=multiplier>=1?'preferred':multiplier>=.8?'normal':'low',label={preferred:'偏好收购',normal:'常规收购',low:'低价收购'}[status];
  return {...out,ok:true,status,reason:label+' · '+Math.round(multiplier*100)+'%'+(kind==='collectible'?'参考估价':'装备／物资回收估价'),base,unit,multiplier};
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
 confirmWarehouse(){return Base.goToSell();},
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
