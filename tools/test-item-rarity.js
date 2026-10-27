/* 六级制、逐件评级、搜索边界与所有等级的掉落可达性。 */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),c=vm.createContext({console,performance});
for(const f of ['config.js','data.js','core.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',f),'utf8'),c);
const {items,tiers,cfg,loot,groupOf}=vm.runInContext('({items:ITEMS,tiers:RARITY,cfg:CFG,loot:Loot,groupOf:itemGroup})',c),review=require('../design/items/rarity.json');
assert.deepEqual(Array.from(tiers,t=>t.name),['寻常','良品','上乘','稀见','珍罕','孤品']);
assert.deepEqual(Array.from(tiers,t=>t.color),['#c6ceca','#3f8b78','#3f6d9b','#9165b3','#a8862a','#8d3a3a']);
assert.equal(review.items.length,89);assert.equal(new Set(review.items.map(i=>i.id)).size,89);
for(const r of review.items){const item=items.find(i=>i.id===r.id);assert.equal(groupOf(item),'collectible');assert.equal(item.r,r.rarity);assert(r.reason.length>12);}
assert.deepEqual(Array.from(tiers,t=>items.filter(i=>groupOf(i)==='collectible'&&i.r===t.k).length),[10,18,19,21,14,7]);
assert.equal(items.filter(i=>i.r===6).length,7);assert(items.filter(i=>i.r===6).some(i=>i.id==='odd02'));
for(const i of items){assert(Number.isInteger(i.r)&&i.r>=1&&i.r<=6);if(i.id==='ammo'||i.id==='heal01')assert.equal(i.r,1);}
const times=Array.from(cfg.ITEM_SEARCH.timeByRarity);assert.equal(times.length,6);assert.equal(times[5],3);assert(times.every((t,i)=>i===0||t>times[i-1]));
// 六档容器：配置层不得有任何"绝对拿不到"的稀有度，且实测分布必须等于目标值。
const Q=vm.runInContext('CONTAINER_QUALITY',c);
assert.deepEqual(Object.keys(Q),['junk','plain','ample','fine','rich','secret']);
for(const q of ['junk','plain','ample','fine','rich','secret']){
 assert.equal(Q[q].pct.length,6,q+' 概率表长度');
 assert(Math.abs(Q[q].pct.reduce((a,b)=>a+b,0)-100)<0.001,q+' 概率合计应为 100');
 assert(Q[q].pct.every(v=>v>0),q+' 存在绝对拿不到的稀有度');
 assert.equal(Q[q].count.length,2,q+' 件数区间');
 const N=60000,r=[0,0,0,0,0,0];
 for(let i=0;i<N;i++){const drop=loot.roll(q);assert(drop.item&&!drop.item.noLoot);r[drop.item.r-1]++;}
 for(let k=0;k<6;k++){
  const got=r[k]/N*100,target=Q[q].pct[k];
  assert(Math.abs(got-target)<Math.max(0.15,target*0.08),q+' 第'+(k+1)+'档实测 '+got.toFixed(2)+'% ≠ 目标 '+target+'%');
 }
}
// 容器表完整性：字模不能撞地图保留字符，贴图必须登记进预加载表，每个类型都要有可达实例。
const CT=vm.runInContext('CONTAINER_TYPES',c),ARTT=vm.runInContext('ART',c),BKMAP=vm.runInContext('BOX_KIND',c),RMAP=vm.runInContext('RAID_MAP',c);
for(const reserved of ['P','E','S','X','#','.','~','+','r','q','i','k','w','s']){
 assert(!CT[reserved],'容器字模不能占用保留字符 '+reserved+'（会与出生点/撤离点/门/地形冲突）');
}
for(const [ch,type] of Object.entries(CT)){
 assert(type.q&&Q[type.q],ch+' 的品质非法');
 assert(type.name&&type.name.length>=2,ch+' 缺名称');
 assert(ARTT.props.includes(type.art),ch+' 的贴图 '+type.art+' 未登记进 ART.props，游戏里会画成色块');
 assert(BKMAP[ch]===type.q,'BOX_KIND 映射错位');
}
// 每个品质至少 3 种容器；地图上的类型数应与 CONTAINER_TYPES 覆盖情况一致
for(const q of ['junk','plain','ample','fine','rich','secret'])
 assert(Object.values(CT).filter(t=>t.q===q).length>=3,q+' 只有不到 3 种容器');
const used=new Set(RMAP.containers.map(b=>b.type));
for(const ch of used)assert(CT[ch],'地图用了未定义的容器字模 '+ch);
assert(used.size>=20,'地图覆盖的容器类型偏少：'+used.size);
for(const box of RMAP.containers){
 const t=CT[box.type];assert(t,'容器类型未定义 '+box.type);
 assert(Q[t.q],'容器品质未定义 '+t.q);
}
const echoCounts=new Map();
for(let i=0;i<10000;i++){
 c.sample=i/10000;vm.runInContext('Math.random=()=>sample',c);
 const item=loot.pickFromPool(items.filter(i=>i.cat==='odd'));
 echoCounts.set(item.id,(echoCounts.get(item.id)||0)+1);
}
assert(echoCounts.get('odd02')>0&&echoCounts.get('odd02')<echoCounts.get('odd01')/4,'异常遗物池不可等概率掉孤品');
console.log('OK: 六级名称与白绿蓝紫金红 / 89件逐项评级 / 10-18-19-21-14-7分布 / 六档容器实测=目标 / '+Object.keys(CT).length+' 种容器字模与贴图 / 物资不变 / 六级搜索 / 紫级与孤品掉落');
