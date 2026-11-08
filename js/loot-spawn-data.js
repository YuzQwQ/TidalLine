(function(root){const api={
 pools:{all:'全部收集品',life:'生活用品',elec:'电子产品',ind:'工业器材',med:'医疗收集品',collect:'文物藏品',mil:'军用物资',intel:'情报资料',occult:'神秘学物品',odd:'异常遗物',medical:'治疗药物',ammo:'弹药',gun:'枪械',attachment:'配件',helmet:'头盔',body:'护甲',bag:'背包'},
 /* 五档「密度→价值」梯度预案：一键套用六档权重 + 出现率。
    chance 在每次开局对每个点独立判定一次，不是「全 100% 的固定点位」：
    地图每局的散落物数量会自然波动，珍藏点也不是每局都在。
    单点期望按 all 池实测：S0 ¥3.3k / S1 ¥9.0k / S2 ¥26.9k / S3 ¥63.4k / S4 ¥197.4k。 */
 presets:[
  {key:'S0',name:'氛围填充',hint:'大量视觉点位，把价值压到最低',chance:70,weights:[78,19,2.8,.2,0,0]},
  {key:'S1',name:'街边杂物',hint:'路边、桌面等零星物品',chance:80,weights:[55,28,13,3.5,.5,0]},
  {key:'S2',name:'常规搜刮',hint:'室内值得看一眼的点',chance:75,weights:[30,30,25,12,2.8,.2]},
  {key:'S3',name:'深入区域',hint:'远离出生点或有敌人把守',chance:70,weights:[15,22,30,25,7,1]},
  {key:'S4',name:'珍藏点位',hint:'全图 1–2 个，密室或钥匙房内',chance:30,weights:[5,10,20,35,25,5]}
 ],
 /* 各池六档是否真有物品。由运行时 GroundSpawns.candidates 统计而来，
    tools/test-loot-spawns.js 会校验两侧同步；物品表变更后需同步此表。
    收集品族六档齐全；医疗/弹药/枪械/头盔/护甲/背包无红档；配件只有绿蓝紫。 */
 coverage:{
  all:[1,1,1,1,1,1],life:[1,1,1,1,1,1],elec:[0,1,1,1,1,1],ind:[1,1,1,1,1,1],
  med:[0,1,1,1,1,1],collect:[1,1,1,1,1,1],mil:[1,1,1,1,1,1],intel:[1,1,1,1,1,1],
  occult:[1,1,1,1,1,1],odd:[1,1,1,1,1,1],medical:[1,1,1,1,1,0],ammo:[1,1,1,1,1,0],
  gun:[1,1,1,1,1,0],attachment:[0,1,1,1,0,0],helmet:[1,1,1,1,1,0],body:[1,1,1,1,1,0],bag:[1,1,1,1,1,0]
 },
 /* 新建点的默认出现率也不再是 100%：未套用预案时按 70% 出货。 */
 defaults:{pool:'all',chance:70,weights:[10,18,32,30,9.5,.5],offsetY:0},
 matchPreset(weights){
  if(!Array.isArray(weights)||weights.length!==6)return null;
  const p=this.presets.find(x=>x.weights.every((w,i)=>Math.abs(w-weights[i])<.001));
  return p?p.key:null;
 },
 /* 缺档会按可用品质重归一。返回有效权重、实际出货概率、被吞掉的档位，
    以及「根本不会生成任何物品」的判定（编辑器据此给出警告）。 */
 effective(s){
  const cov=s&&this.coverage[s.pool];
  if(!cov||!s||!Array.isArray(s.weights)||s.weights.length!==6)return null;
  const sum=s.weights.reduce((a,w,i)=>a+(w>0&&cov[i]?w:0),0);
  const probs=s.weights.map((w,i)=>cov[i]&&w>0&&sum>0?w/sum*100:0);
  const empty=s.weights.map((w,i)=>w>0&&!cov[i]?i:-1).filter(i=>i>=0);
  return {sum,probs,empty,spawns:sum>0};
 },
 valid(s){return typeof s.id==='string'&&!!s.id&&Number.isInteger(s.x)&&Number.isInteger(s.y)&&Object.hasOwn(this.pools,s.pool)&&Number.isFinite(s.chance)&&s.chance>=0&&s.chance<=100&&Array.isArray(s.weights)&&s.weights.length===6&&s.weights.every(n=>Number.isFinite(n)&&n>=0&&n<=100)&&Math.abs(s.weights.reduce((a,b)=>a+b,0)-100)<.001&&Number.isFinite(s.offsetY||0)&&Math.abs(s.offsetY||0)<=32;}
};if(typeof module==='object'&&module.exports)module.exports=api;else root.LootSpawnSpec=api;})(globalThis);
