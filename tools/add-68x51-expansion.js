/* Additive, idempotent source update; runtime data is still built by the shared builders. */
const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p))),write=(p,d)=>fs.writeFileSync(path.join(root,p),JSON.stringify(d,null,2)+'\n');
const arsenal=read('design/weapons/arsenal-v1/arsenal.json'),economy=read('design/items/economy.json'),parts=read('design/weapons/attachments-v1/attachments.json');
arsenal.calibers['68x51']={id:'68x51',name:'6.8×51mm',short:'6.8',label:'6.8×51mm',damage:[42,47],stack:60,weight:.024,defaultLevel:4,
 ammunition:[{level:4,name:'6.8×51mm SIG FMJ',price:2500,B:47,P:49,iconId:'ammo_68x51_fmj',shopAvailable:true,description:'全金属被甲弹，承担本口径的常规供弹。'},
 {level:5,name:'6.8×51mm SIG Hybrid',price:7500,B:42,P:63,iconId:'ammo_68x51_hybrid',shopAvailable:false,description:'采用混合材料弹壳的高级装药。Hybrid描述弹壳结构，不直接等同穿甲弹头；伤害与穿透为游戏平衡设定。'}]};
const guns=[
 {id:'mcx_spear',name:'SIG MCX SPEAR',short:'MCX SPEAR',rpm:800,w:4.2,price:650000,rarity:5,aimTime:.48,recoilVMul:1.55,recoilHMul:1.35,spreadGrowthMul:1.20,spreadMul:.85,adsPrecisionMul:.45,reloadTime:2.8,
 desc:'高成本的6.8×51毫米综合火力平台。连续射击需要控制明显的后坐力，完整的改装槽则为后续调校留下了余地。本作采用可选择单发与全自动的游戏配置，M7不在本批实装范围内。',visual:'沙色传统布局步枪，长开槽护木、折叠伸缩枪托、20发短弹匣，枪口朝右'},
 {id:'rm277',name:'GD RM277',short:'RM277',rpm:700,w:3.8,price:390000,rarity:4,aimTime:.40,recoilVMul:1.35,recoilHMul:1.15,spreadGrowthMul:1.10,spreadMul:.90,adsPrecisionMul:.45,reloadTime:2.9,
 desc:'紧凑的无托试验平台，原厂操控较好，但一体式尾部无法更换枪托。现实原型使用.277 TVCM，本作有意统一为6.8×51毫米供弹，弹匣接口仍单独区分。',visual:'沙色无托步枪，高直顶轨、厚实一体尾托、握把后方20发短弹匣，枪口朝右'}
].map(w=>({...w,category:'rifle',caliber:'68x51',mag:20,modes:['semi','auto'],defaultMode:'auto',reloadType:'magazine',cycleTime:0,shopAvailable:w.id==='rm277'}));
for(const gun of guns){arsenal.weapons=arsenal.weapons.filter(w=>w.id!==gun.id);arsenal.weapons.push(gun);economy.weapons[gun.id]={price:gun.price,rarity:gun.rarity};}
const added=[];
for(const [gun,family,label,stock,muzzle]of [['mcx_spear','sr25_pattern','SR-25',true,'muzzle_spear_clutchlok'],['rm277','rm277','RM277',false,'muzzle_rm277_delta']]){
 const tags=['optic.common','optic.scope','optic_picatinny','grip.common','muzzle.standard',muzzle,'mag.box','cal.68x51','mag.interface.'+family,'mag_'+family];if(stock)tags.push('stock.replaceable','stock_mcx');
 parts.weapons[gun]={slots:{optic:true,grip:true,stock,muzzle:true,magazine:true},tags,magazineFamily:family,magazineTypes:['competition','polymer','extended']};
 const familyParts={};
 for(const [kind,r,w,price,mods]of [['competition',3,.18,28000,{reloadTime:-.18}],['polymer',2,.12,19000,{aimTime:-.10}],['extended',3,.25,38000,{magazineCapacityFixed:25,aimTime:.08,reloadTime:.05}]]){
  const id='att_mag_68x51_'+family+'_'+(kind==='extended'?'25':kind);familyParts[kind]=id;
  added.push({id,name:label+' '+(kind==='competition'?'竞赛型弹匣':kind==='polymer'?'聚合物弹匣':'25发扩容弹匣'),category:'attachment',subtype:'magazine',r,w,price,icon:id,caliber:'68x51',calibers:['68x51','762x51'],magazineFamily:family,magazineType:kind,
   compatibleTags:['mag.box','mag.interface.'+family],statModifiers:mods,description:'本作'+label+'接口专用。竞赛型、聚合物保持原厂20发，扩容型25发。预留兼容同接口的部分7.62×51平台；接口与容量为游戏适配配置，不宣称现实型号完全互换。'});
 }
 parts.magazineFamilies[family]={caliber:'68x51',calibers:['68x51','762x51'],label,weapons:[gun],extended:25,drum:null,parts:familyParts};
}
for(const [id,name,w,price,tag,mods,desc]of [
 ['att_muzzle11','SIG SLX 战术抑制器',.40,155000,'muzzle_spear_clutchlok',{noiseRadius:-.68,recoilVertical:-.16,recoilHorizontal:-.15,aimTime:.10},'SPEAR平台的Clutch-LOK接口专属抑制器；多流道结构强调综合控制。预留未来M7接口，本批不提供M7。'],
 ['att_muzzle12','Delta P BREVIS II 抑制器',.34,135000,'muzzle_rm277_delta',{noiseRadius:-.60,recoilVertical:-.12,recoilHorizontal:-.18,aimTime:.07},'RM277专属的短粗型抑制器。偏向横向稳定和紧凑操控；参数为游戏平衡设定。']])added.push({id,name,category:'attachment',subtype:'muzzle',r:5,w,price,icon:id,compatibleTags:[tag],statModifiers:mods,description:desc});
parts.items=parts.items.filter(a=>!added.some(b=>b.id===a.id)).concat(added);
write('design/weapons/arsenal-v1/arsenal.json',arsenal);write('design/items/economy.json',economy);write('design/weapons/attachments-v1/attachments.json',parts);
console.log('Added 2 weapons, 2 ammo, 2 exclusive muzzles and 6 interface magazines');
