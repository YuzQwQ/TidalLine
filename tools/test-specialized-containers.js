const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const {read}=require('./lib/png-read'),root=path.resolve(__dirname,'..');
let seed=20261107;const math=Object.create(Math);math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const c=vm.createContext({Math:math,console,performance});
for(const f of ['config','data','attachment-data','attachments','core','common','medical'])vm.runInContext(fs.readFileSync(path.join(root,'js/'+f+'.js'),'utf8'),c);
const {Loot,types,CFG,M,gunDefs}=vm.runInContext('({Loot,types:CONTAINER_TYPES,CFG,M,gunDefs:WEAPONS})',c);
const results={};
for(const [ch,pools,range] of [['g',['gun','ammo','attachment','military'],[3,5]],['h',['helmet','body','bag','military'],[2,4]]]){
 const type=types[ch],counts=Object.fromEntries(pools.map(k=>[k,0])),rollCounts={},levels=[0,0,0,0,0];let total=0,gearCount=0;
 assert.equal(type.q,'fine');assert.deepEqual(Array.from(type.rolls),range);
 for(let i=0;i<12000;i++){
  const picks=Loot.fill(type.q,['life','odd'],type);assert(picks.length>=range[0]&&picks.length<=range[1]);rollCounts[picks.length]=(rollCounts[picks.length]||0)+1;
  for(const e of picks){
   assert(e.item&&e.n>0);const it=e.item,eq=it.equip;
   const pool=it.cat==='mil'?'military':it.cat==='ammo'?'ammo':eq?.kind==='armor'?eq.gear.type:eq?.kind==='bag'?'bag':eq?.kind;
   assert(pools.includes(pool),'Unexpected pool '+pool);counts[pool]++;total++;
   if(pool!=='ammo')assert.equal(e.n,1);
   if(pool==='gun'){assert.equal(eq.mag,0);levels[gunDefs[eq.gun].rarity-1]++;gearCount++;}
   if(pool==='helmet'||pool==='body'){assert(eq.gear.lv>=1&&eq.gear.lv<=5);levels[eq.gear.lv-1]++;gearCount++;}
   if(pool==='bag'){assert(/^bag0[1-5]$/.test(eq.bag));levels[Number(eq.bag.slice(-1))-1]++;gearCount++;}
   if(pool==='attachment')assert([2,3,4].includes(it.r));
   if(pool==='ammo'){const bounds=type.ammoPool.count[it.caliber];assert(e.n>=bounds[0]&&e.n<=bounds[1]&&it.level<=5);}
  }
 }
 for(const pool of pools)assert(Math.abs(counts[pool]/total-(pool==='military'?.1:.3))<.012,`${ch} ${pool} share ${counts[pool]/total}`);
 for(let n=range[0];n<=range[1];n++)assert(Math.abs(rollCounts[n]/12000-1/3)<.025,'roll count distribution');
 [10,18,32,30,10].forEach((pct,i)=>assert(Math.abs(levels[i]/gearCount*100-pct)<1.3,'gear rarity curve'));
 const png=read(path.join(root,'assets/props',type.art+'.png')),colors=new Set();let visible=0;
 assert.equal(png.w,32);assert.equal(png.h,32);
 for(let y=0;y<32;y++)for(let x=0;x<32;x++){const p=png.px[y][x];assert([0,255].includes(p[3]));if(p[3]){visible++;assert(x>=2&&x<30&&y>=2&&y<30);colors.add(p.join(','));}}
 assert(visible>150&&colors.size<=16);assert(require('../design/maps/shared/scene-library').assets.some(a=>a.id===type.art&&a.containerType===ch));
 results[ch]={draws:total,poolPercent:Object.fromEntries(pools.map(k=>[k,+(counts[k]/total*100).toFixed(2)])),rollCounts,gearRarityPercent:levels.map(n=>+(n/gearCount*100).toFixed(2)),colors:colors.size};
}
// Boundary: military red items must remain military, even with guaranteed egg swap.
const beforeChance=CFG.LOOT.eggChance;CFG.LOOT.eggChance=1;
for(let i=0;i<2000;i++)assert.equal(Loot.roll('fine',null,types.g.itemPool).item.cat,'mil');CFG.LOOT.eggChance=beforeChance;
// Existing container pool selection is unchanged; all explicit new pools stay exclusive.
for(const ch of ['Q','K']){const type=types[ch],counts={};for(let i=0;i<30000;i++){const p=Loot.pickPool(type);counts[p]=(counts[p]||0)+1;}assert(Math.abs((counts.ammo||0)/30000-type.ammoPool.chance)<.012);assert(Math.abs((counts.gear||0)/30000-type.gearPool.chance)<.012);}
const folder=path.join(root,'assets/source/containers-batch-01');fs.writeFileSync(path.join(folder,'quality.json'),JSON.stringify({passed:true,results},null,2)+'\n');
console.log('PASS: exact exclusive 3:3:3:1 pools, 3–5 / 2–4 draws, rarity curves, ammo counts, military-only items, existing pool regression and native sprite validation');
console.log(JSON.stringify(results,null,2));
