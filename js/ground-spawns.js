const GroundSpawns={
 candidates(pool){
  if(pool==='gun')return Object.values(WEAPONS).map(w=>EQUIP.gun(w.id,0));
  if(pool==='attachment')return Object.keys(ATTACHMENT_DEFS).map(id=>EQUIP.attachment(id));
  if(pool==='ammo')return Object.values(AMMO_BY_ID);
  if(pool==='medical')return ITEMS.filter(it=>it.cat==='medical'&&it.use===true);
  if(pool==='helmet'||pool==='body')return [1,2,3,4,5].flatMap(lv=>GEAR.atLevel(pool,lv).map(g=>EQUIP.armor(GEAR.make(pool,g.id))));
  if(pool==='bag')return [1,2,3,4,5].map(lv=>EQUIP.bag('bag0'+lv));
  return ITEMS.filter(it=>!it.noLoot&&!it.egg&&(pool==='all'?itemGroup(it)==='collectible':it.cat===pool));
 },
 roll(s){const items=this.candidates(s.pool).filter(Boolean),groups=s.weights.map((w,i)=>({w,items:items.filter(it=>it.r===i+1)})).filter(g=>g.w>0&&g.items.length);let n=Math.random()*groups.reduce((a,g)=>a+g.w,0);if(!groups.length)return null;let selected=groups[groups.length-1];for(const g of groups){n-=g.w;if(n<0){selected=g;break;}}const item=U.pick(selected.items);return{item,n:item.cat==='ammo'?U.randInt(...(AMMO_POOL.count[item.caliber]||[10,20])):1,known:true};},
 generate(map){for(const s of map?.lootSpawns||[]){if(!LootSpawnSpec.valid(s)||Math.random()*100>=s.chance)continue;const entry=this.roll(s);if(!entry)continue;
 // Furniture is solid, so do not replace its terrain/collision or register a blocking box.
 const b={id:'ground-'+s.id,x:M.cx(s.x),y:M.cy(s.y),tx:s.x,ty:s.y,kind:'junk',q:CONTAINER_QUALITY.junk,name:entry.item.name,pile:true,groundLoot:true,offsetY:s.offsetY||0,items:[entry],searched:true,opened:false};Game.boxes.push(b);}}
};
{const start=Game.startRun;Game.startRun=function(...args){const r=start.apply(this,args);if(!this.rangeMode)GroundSpawns.generate(M.map);return r;};}
