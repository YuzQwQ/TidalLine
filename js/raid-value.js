/* Retail replacement value and per-raid cost basis; origin markers never enter JSON saves. */
const RaidValue={
 token:Symbol('raid-value-origin'),records:new Map(),resources:new Map(),player:null,depth:0,total:0,loss:0,
 copy(from,to){if(from&&to&&from[this.token])to[this.token]=from[this.token];return to;},
 value(item,entry){
  if(!item)return 0;const eq=item.equip,price=Math.max(0,item.price||0);
  if(eq?.kind==='armor'){const g=eq.gear,base=GEAR.def(g.type,g.id||g.lv)?.dur||g.max||1;return price*Math.max(0,Math.min(1,g.dur/base));}
  if(eq?.kind==='gun')return price+magazineRounds(WEAPONS[eq.gun],eq.mag,eq.ammo,eq.rounds).reduce((sum,id)=>sum+(AMMO_BY_ID[id]?.price||0),0);
  const max=ItemCapacity.max(item);return max?price*ItemCapacity.remaining(entry||{item})/max:price;
 },
 scan(mark=false){
  const p=this.player,values=new Map(),resources=new Map();if(!p)return{values,resources};
  const addResource=(id,n,price)=>{const old=resources.get(id)||{n:0,price};old.n+=n;resources.set(id,old);};
  const origin=(object,value)=>{if(mark){object[this.token]={};this.records.set(object[this.token],value);}const id=object[this.token];if(id&&this.records.has(id))values.set(id,(values.get(id)||0)+value);};
  const parts=installed=>{for(const id of Object.values(installed||{})){const d=ATTACHMENT_DEFS[id];if(d)addResource('part:'+id,1,d.price);}};
  const gun=(state,id,mag,ammo,rounds)=>{
   const def=WEAPONS[id];if(!def)return;origin(state,def.price);parts(state.attachments);
   for(const round of magazineRounds(def,mag,ammo,rounds)){const a=AMMO_BY_ID[round];if(a)addResource('ammo:'+round,1,a.price);}
  };
  const entry=e=>{if(!e?.item)return;let it=e.item;const eq=it.equip;
   if(it.cat==='ammo'){addResource('ammo:'+it.id,e.n,it.price);return;}
   if(eq?.kind==='attachment'){addResource('part:'+eq.attachment,e.n,it.price);return;}
   if(eq?.kind==='gun'){gun(eq,eq.gun,eq.mag,eq.ammo,eq.rounds);return;}
   if(eq?.kind==='armor'){origin(eq.gear,this.value(it,e));return;}
   if(eq?.kind==='bag'){origin(eq,it.price);return;}
   if(mark){it=e.item={...it};}origin(it,this.value(it,e)*(e.n||1));
  };
  /* 钥匙链上的钥匙不占背包价值，但耐久掉多少要算进本局战损，所以照样扫描。 */
  p.bag.slots.forEach(entry);p.bag.safe.forEach(entry);(p.bag.chain||[]).forEach(entry);
  p.weapons.forEach((w,i)=>{if(w)gun(w,w.id,i===p.slot?p.mag:w.magCur,w.ammo,w.rounds);});
  for(const g of [p.helmet,p.body])if(g)origin(g,this.value(EQUIP.armor(g)));
  if(p.back)origin(p.back,p.back.price||BACKPACK.def(p.back.id)?.price||0);
  if(p.melee)origin(p.melee,p.melee.price||0);
  return{values,resources};
 },
 begin(player){
  this.player=player;this.records=new Map();this.resources=new Map();this.depth=0;this.loss=0;
  const s=this.scan(true);this.total=[...this.records.values()].reduce((a,b)=>a+b,0);
  for(const [id,r]of s.resources){this.resources.set(id,{...r,initial:r.n,remaining:r.n});this.total+=r.n*r.price;}
  this.refresh();
 },
 sync(){
  if(!this.player||this.player!==Game.player)return;const s=this.scan();let loss=0;
  // Fungible ammunition and attachments use brought-in units first. Reloading/installation
  // simply relocates units and therefore leaves the combined count unchanged.
  for(const [id,r]of this.resources){const n=s.resources.get(id)?.n||0;r.remaining=Math.max(0,r.remaining+Math.min(0,n-r.n));r.n=n;loss+=(r.initial-r.remaining)*r.price;}
  for(const [id,value]of this.records)loss+=Math.max(0,value-(s.values.get(id)||0));
  this.loss=Math.max(0,Math.round(loss));
 },
 refresh(){
  if(!this.depth)this.sync();const el=document.getElementById('raidLoss');if(!el)return;
  el.textContent=formatMoney(this.loss);el.title='带入物品初始价值 '+formatMoney(this.total)+'；统计耐久、容量、弹药消耗及当前未携带的带入物品。战利品不抵消损耗。';
 },
 transaction(fn,self,args){
  if(!this.depth)this.sync();this.depth++;try{return fn.apply(self,args);}finally{this.depth--;if(!this.depth){this.sync();this.refresh();}}
 }
};
// Preserve economic identity through the game's existing equipment snapshots.
{
 const armor=EQUIP.armor,gun=EQUIP.gun;
 EQUIP.armor=function(g){const result=armor.apply(this,arguments);if(result)RaidValue.copy(g,result.equip.gear);return result;};
 EQUIP.gun=function(id,mag,ammo,rounds,state){const result=gun.apply(this,arguments);if(result)RaidValue.copy(state,result.equip);return result;};
 const normalize=MeleeSystem.normalize;MeleeSystem.normalize=function(it){return RaidValue.copy(it,normalize.apply(this,arguments));};
 const start=Game.startRun;Game.startRun=function(){RaidValue.player=null;const result=start.apply(this,arguments);RaidValue.begin(this.player);return result;};
 for(const name of ['update','takeGear','equipFromBag','dropWeapon','dropArmor','dropMelee','dropFromBag','dropFromSafe','moveToSafe','moveFromSafe','unloadLooseGun','handleInteract','takeItem']){
  const fn=Game[name];if(fn)Game[name]=function(...args){return RaidValue.transaction(fn,this,args);};
 }
 const commit=Attachments.commit;Attachments.commit=function(...args){return RaidValue.transaction(commit,this,args);};
 const render=Game.render;Game.render=function(){const r=render.apply(this,arguments);if(this.bagOpen&&this.state==='playing')RaidValue.refresh();return r;};
 const bag=Game.renderBag;Game.renderBag=function(){const r=bag.apply(this,arguments);RaidValue.refresh();return r;};
}
