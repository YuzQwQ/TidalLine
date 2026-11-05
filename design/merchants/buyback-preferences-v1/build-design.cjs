/* Design inventory only. Does not change gameplay prices or merchant configuration. */
const fs=require('fs'),path=require('path'),vm=require('vm'),root=path.resolve(__dirname,'../../..');
const c=vm.createContext({console});for(const f of ['config','data'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),c);
const source=JSON.parse(vm.runInContext('JSON.stringify(ITEMS.filter(i=>COLLECTION_CATS.includes(i.cat)))',c));
const merchants=['shop','gun','doctor','viktor','elena'],names={shop:'玛拉·维恩',gun:'埃德加·洛克',doctor:'林岑',viktor:'维克托·萨伦',elena:'伊莲娜·莫罗'};
const defaults={life:[80,60,60,100],elec:[80,100,80,80],ind:[100,80,60,80],med:[60,60,100,80],collect:[60,80,60,100],mil:[80,100,60,60],intel:[100,80,80,60],occult:[60,60,100,80],odd:[60,80,80,80]};
const owners={};
for(const id of ['intel01','intel02','intel03','intel04','intel08'])owners[id]='shop';
for(const id of ['intel05','intel07','intel10'])owners[id]='gun';
for(const id of ['intel06','intel09','intel11','intel12','intel13'])owners[id]='doctor';
for(const id of ['life02','art03'])owners[id]='viktor';
Object.assign(owners,{antiq06:'shop',mil11:'shop',odd01:'doctor',odd02:'gun',odd03:'viktor'});
const items=source.map(it=>{const pct=defaults[it.cat].slice();if(owners[it.id]){for(let i=0;i<pct.length;i++)if(pct[i]===100)pct[i]=80;pct[merchants.indexOf(owners[it.id])]=100;}const elena=['collect','occult'].includes(it.cat)?100:it.cat==='intel'?80:['elec06','elec08','elec13'].includes(it.id)?60:0;if(elena===100)for(let i=0;i<pct.length;i++)if(pct[i]===100)pct[i]=80;pct.push(elena);const preferred=merchants.filter((_,i)=>pct[i]===100);if(preferred.length!==1)throw Error('偏好买家不唯一 '+it.id);return {id:it.id,name:it.name,category:it.cat,rarity:it.r,referencePrice:it.price,preferred:preferred[0],rates:Object.fromEntries(merchants.map((m,i)=>[m,pct[i]])),override:!!owners[it.id]||['elec06','elec08','elec13'].includes(it.id)};});
const summary=Object.fromEntries(merchants.map(m=>[m,{name:names[m],preferred:items.filter(i=>i.preferred===m).length,normal:items.filter(i=>i.rates[m]===80).length,low:items.filter(i=>i.rates[m]===60).length,refused:items.filter(i=>i.rates[m]===0).length}]));
fs.writeFileSync(path.join(__dirname,'allocation.json'),JSON.stringify({status:'approved_runtime',tiers:{low:60,normal:80,preferred:100},base:'现有收集品参考价值；不改变稀有度与基础价值',defaultRates:Object.fromEntries(Object.entries(defaults).map(([cat,p])=>[cat,Object.fromEntries(merchants.map((m,i)=>[m,i===4?(cat==='collect'||cat==='occult'?100:cat==='intel'?80:0):(p[i]===100&&['collect','occult'].includes(cat)?80:p[i])]))])),summary,items},null,2)+'\n');
const csv='ID,名称,分类,玛拉%,埃德加%,林岑%,维克托%,伊莲娜%,偏好买家\n'+items.map(i=>[i.id,i.name,i.category,...merchants.map(m=>i.rates[m]),names[i.preferred]].join(',')).join('\n')+'\n';fs.writeFileSync(path.join(__dirname,'allocation.csv'),'\uFEFF'+csv);
console.log(JSON.stringify({items:items.length,summary,uniquePreferred:items.every(i=>merchants.filter(m=>i.rates[m]===100).length===1)},null,2));
