/* One-time source migration; safe to rerun because the immutable legacy table is retained. */
const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
const source=path.join(root,'design/weapons/attachments-v1/attachments.json');
const data=JSON.parse(fs.readFileSync(source,'utf8'));
data.legacyMagazines ||= Object.fromEntries(data.items.filter(a=>a.subtype==='magazine').map(a=>[a.id,a]));
const specs={
 optic:[
 ['微型反射瞄具',2,.08,7500,{aimTime:-.12,adsZoom:1.15,adsView:1.15}],['全息瞄具',3,.25,13500,{aimTime:.02,adsSpread:-.12,adsZoom:1.15,adsView:1.15}],
 ['低倍率光学瞄具',3,.32,18000,{aimTime:.05,adsSpread:-.20,adsZoom:1.4,adsView:1.6}],['精密光学瞄具',4,.48,30000,{aimTime:.08,adsSpread:-.30,adsZoom:1.4,adsView:2}],
 ['开放式机械瞄具',1,.05,3000,{aimTime:-.05,adsSpread:-.05,adsZoom:1.15,adsView:1.15}],['紧凑棱镜瞄具',3,.28,19500,{aimTime:.06,adsSpread:-.15,adsZoom:1.4,adsView:1.45}],
 ['低倍可变光学瞄具',4,.42,32000,{aimTime:.12,adsSpread:-.22,adsZoom:1.4,adsView:1.8}],['远程战术瞄准镜',5,.65,48000,{aimTime:.22,adsSpread:-.35,adsZoom:1.4,adsView:2.4}]],
 grip:[['垂直握把',2,.12,6750,{recoilVertical:-.18,aimTime:.02}],['斜角握把',2,.10,7500,{recoilHorizontal:-.16}],['紧凑握把',3,.08,10500,{aimTime:-.10,recoilHorizontal:.03}],['人体工学握把',3,.14,13500,{recoilHorizontal:-.08,recoilVertical:-.08}],['短型阻手器',2,.07,8500,{aimTime:-.08,hipSpread:-.06}],['加重垂直握把',3,.21,16000,{recoilVertical:-.24,aimTime:.08}],['稳定战术握把',4,.25,23000,{spreadGrowth:-.18,recoilHorizontal:-.08,aimTime:.06}],['轻型竞技握把',4,.09,20000,{aimTime:-.16,recoilHorizontal:.07,recoilVertical:.07}]],
 stock:[['固定枪托',2,.30,9000,{recoilHorizontal:-.12,recoilVertical:-.12,aimTime:.03}],['伸缩枪托',2,.22,8250,{aimTime:-.12,recoilHorizontal:.03,recoilVertical:.03}],['精密枪托',4,.45,22500,{baseSpread:-.08,spreadGrowth:-.20,aimTime:.05}],['轻量镂空枪托',2,.16,11000,{aimTime:-.15,recoilHorizontal:.08,recoilVertical:.08}],['加重稳定枪托',3,.52,17500,{recoilHorizontal:-.16,recoilVertical:-.16,aimTime:.10}],['缓冲减震枪托',4,.48,26000,{spreadGrowth:-.22,recoilVertical:-.07,aimTime:.09}],['精英战术枪托',5,.36,38000,{recoilHorizontal:-.12,recoilVertical:-.12,spreadGrowth:-.10,aimTime:.05}]],
 muzzle:[['标准制退器',2,.08,6000,{recoilVertical:-.15}],['横向补偿器',3,.10,10500,{recoilHorizontal:-.18,aimTime:.02}],['复合补偿器',3,.12,13500,{recoilHorizontal:-.10,recoilVertical:-.10,aimTime:.03}],['精密枪口装置',4,.10,18000,{baseSpread:-.12,aimTime:.04}],['收束器',3,.06,12000,{pelletSpread:-.20,aimTime:.02}],['扩散器',2,.05,5250,{pelletSpread:.25}],['鸟笼式消焰器',2,.09,7500,{recoilHorizontal:-.06,noiseRadius:-.10}],['紧凑型消音器',3,.20,24000,{noiseRadius:-.45,recoilVertical:-.05,aimTime:.06}],['重型战术消音器',4,.48,39000,{noiseRadius:-.60,recoilHorizontal:-.10,recoilVertical:-.10,aimTime:.14}],['高效多孔制退器',5,.19,32000,{recoilVertical:-.23,recoilHorizontal:-.13,aimTime:.08,noiseRadius:.15}]]
};
const visuals={optic05:'detachable iron sights, rear aperture and front post, no glass',optic06:'compact short prism optic, thick rectangular-tubular housing, integrated low rail',optic07:'medium tubular variable power scope with knurled rear magnification ring',optic08:'large long-range tactical scope, oversized objective bell and tall adjustment turrets',grip05:'ultra short wedge hand stop, textured polymer, minimal rail foot',grip06:'heavy thick ribbed vertical foregrip, broad metal clamp and weighted base',grip07:'extended contoured forward angled tactical foregrip with rubber palm support',grip08:'slim skeletonized competition foregrip, angular cutouts and narrow thumb shelf',stock04:'light skeletonized stock, triangular hollow cutouts, slim struts',stock05:'heavy solid fixed stock with broad rubber buttpad, olive polymer body',stock06:'mechanical buffer stock with short exposed buffer cylinder and adjustable shoulder pad',stock07:'premium tactical stock, adjustable cheek rest and reinforced lower strut',muzzle07:'short classic birdcage flash hider, five elongated steel slots',muzzle08:'short compact matte black suppressor cylinder with machined endcap',muzzle09:'long heavy thick graphite suppressor, segmented tube and reinforced mounting collar',muzzle10:'angular multi-port muzzle brake with rectangular side vents and small upper ports'};
const old=Object.fromEntries(data.items.map(a=>[a.id,a]));
data.items=[];
for(const [slot,list]of Object.entries(specs))list.forEach(([name,r,w,price,statModifiers],i)=>{
 const suffix=slot+String(i+1).padStart(2,'0'),id='att_'+suffix;
 const tags=old[id]?.compatibleTags || [slot==='optic'?(i===4?'optic.common':'optic.scope'):slot==='grip'?'grip.common':slot==='stock'?'stock.replaceable':'muzzle.standard'];
 data.items.push({id,name,category:'attachment',subtype:slot,r,w,price,description:name+'。采用七参数配件规则；精确瞄准专属效果在主动瞄准时生效。',icon:id,compatibleTags:tags,statModifiers,visual:old[id]?.visual||visuals[suffix]});
});
const families=[
 ['stanag','556','STANAG',['m4a1','m16a1','fn_fnc'],40,60,'gently curved ribbed aluminum STANAG rifle magazine'],
 ['ak545','545x39','AK 5.45',['aks74u','an94','ak12'],45,60,'long curved narrow AK-74 magazine, reddish brown bakelite and black steel feed lips'],
 ['ak762','762x39','AK 7.62',['akm','groza1','mk47_mod2'],40,75,'strongly curved thick banana AK magazine, reinforced feed lips'],
 ['famas','556','FAMAS',['famas_f1'],null,null,'short straight FAMAS magazine, narrow rectangular steel body'],
 ['galil','556','Galil',['galil_arm'],50,75,'curved robust Galil steel magazine, broad ribbed sides'],
 ['g36','556','G36',['g36c'],40,60,'G36 translucent smoke polymer magazine with chunky coupling studs'],
 ['sig550','556','SIG 550',['sig550'],40,60,'SIG 550 curved smoke polymer magazine with side coupling lugs'],
 ['aug','556','AUG',['aug_a1'],42,60,'AUG waffle-pattern translucent smoke polymer magazine, curved lower body'],
 ['vityaz','9mm','Vityaz',['pp19_01'],40,50,'narrow straight Vityaz SMG magazine, black polymer ribbed body and angled feed neck'],
 ['mp5','9mm','MP5',['mp5a3'],40,50,'slim curved MP5 steel SMG magazine, smooth curved spine'],
 ['ump','45acp','UMP',['ump45'],35,50,'wide straight UMP polymer SMG magazine, deep strengthening ribs'],
 ['glock','9mm','Glock',['glock17'],null,null,'compact straight Glock pistol magazine, black polymer over steel and angled floorplate'],
 ['beretta92','9mm','Beretta 92',['beretta92'],null,null,'slim steel Beretta pistol magazine with flat compact metal floorplate'],
 ['m1911','45acp','M1911',['m1911a1'],null,null,'very slim single-stack M1911 steel pistol magazine, seven-round proportions'],
 ['saiga','12g','Saiga-12',['saiga12'],12,20,'thick broad Saiga shotgun box magazine, reinforced polymer housing']
];
const prices={'556':[15000,9000,19000,36000],'545x39':[15500,9500,20000,38000],'762x39':[16000,10000,21000,40000],'9mm':[11000,7500,15000,29000],'45acp':[12000,8000,17000,33000],'12g':[15000,9000,18000,30000]};
const weights={'556':[.12,.07,.19,.42],'545x39':[.12,.07,.19,.42],'762x39':[.15,.09,.24,.55],'9mm':[.10,.06,.15,.32],'45acp':[.12,.08,.19,.39],'12g':[.15,.10,.24,.45]};
data.magazineFamilies={};
for(const [family,caliber,label,weapons,extended,drum,visual]of families){
 const prefix='att_mag_'+caliber+(['stanag','ak545','ak762'].includes(family)?'':'_'+family);
 const parts={};
 for(const [index,kind,capacity]of [[0,'competition',null],[1,'polymer',null],[2,'extended',extended],[3,'drum',drum]]){
  if(index>1&&!capacity)continue;
  const id=prefix+'_'+(capacity||kind),ratio=index>1&&caliber!=='12g'?capacity/(index===2?40:60):1;
  const name=label+' '+(index===0?'竞赛型弹匣':index===1?'聚合物弹匣':capacity+(index===2?'发扩容弹匣':'发弹鼓'));
  const statModifiers=index===0?{reloadTime:-.18}:index===1?{aimTime:-.10}:index===2?{magazineCapacityFixed:capacity,aimTime:.08,reloadTime:.05}:{magazineCapacityFixed:capacity,aimTime:.20,reloadTime:.25};
  const shape=index===0?'standard-capacity reinforced metal magazine with broad ergonomic competition floorplate':index===1?'standard-capacity lightweight black molded polymer magazine':index===2?'long extended box magazine, distinctly elongated body':'broad circular drum with a short interface-specific feed tower';
  const item={id,name,category:'attachment',subtype:'magazine',r:[3,2,3,4][index],price:Math.round(prices[caliber][index]*ratio/50)*50,w:Math.round(weights[caliber][index]*ratio*100)/100,icon:id,caliber,magazineFamily:family,magazineType:kind,compatibleWeapons:weapons,compatibleTags:['mag.box','cal.'+caliber,'mag.interface.'+family],statModifiers,description:label+' 接口专用；'+(capacity?'固定容量 '+capacity+' 发。':'保持所装枪械的原厂容量。')+'仅兼容：'+weapons.join('、')+'。',visual:shape+'; '+visual};
  data.items.push(item);parts[kind]=id;
 }
 data.magazineFamilies[family]={caliber,label,weapons,extended,drum,parts};
 for(const id of weapons){const w=data.weapons[id];w.magazineFamily=family;w.magazineTypes=Object.keys(parts);w.tags=w.tags.filter(t=>!t.startsWith('mag.interface.'));w.tags.push('mag.interface.'+family);}
}
data.version=2;
if(data.items.length!==85)throw Error('Expected 85 parts, got '+data.items.length);
fs.writeFileSync(source,JSON.stringify(data,null,2)+'\n');
const common='Use case: stylized-concept. Asset type: single game inventory icon. Pixel art, detailed realistic 1990s industrial military equipment, crisp hard-surface pixel clusters, restrained pixel shading, gunmetal gray, charcoal and muted olive. Three-quarter isometric product view, consistent viewpoint, fully visible and centered, fills 85% of a square canvas. Genuine transparent background. No floor, no exterior cast shadow, no scene, no complete gun, no human hands, no text, labels, numbers, logos or watermark. Must remain readable at 40 by 40 pixels. Subject: ';
const retained=new Set(Object.entries({optic:4,grip:4,stock:3,muzzle:6}).flatMap(([slot,n])=>Array.from({length:n},(_,i)=>'att_'+slot+String(i+1).padStart(2,'0'))));
const prompts=data.items.filter(a=>!retained.has(a.id)).map(a=>({id:a.id,name:a.name,prompt:common+a.visual+'.'}));
fs.mkdirSync(path.join(root,'assets/source/prompts'),{recursive:true});
fs.writeFileSync(path.join(root,'assets/source/prompts/attachments-v2.json'),JSON.stringify({mode:'built-in image_gen',prompts},null,2)+'\n');
console.log('Prepared '+data.items.length+' parts, '+prompts.length+' new icons, '+families.length+' magazine families');
// Later additive batches must survive rerunning the original V2 preparation.
if(require('../design/weapons/arsenal-v1/arsenal.json').calibers['68x51'])require('./add-68x51-expansion.js');
