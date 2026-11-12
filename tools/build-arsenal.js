/* Arsenal JSON owns model mechanics; economy.json owns selling prices.
   ------------------------------------------------------------
   武器只存七个手调参数：rpm / aimTime / recoilVMul / recoilHMul /
   spreadGrowthMul / spreadMul / adsPrecisionMul。纵向冲击、横向冲击、水平随机、连射
   增长、基础与满散布的**绝对值**统一写在 js/config.js 的 CFG.RECOIL
   里，运行时由 Firearms.derive() 相乘得到。families 只负责速度、射程、
   弹丸数这类非手感规格。 */
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');
function build(){
 const spec=JSON.parse(fs.readFileSync(path.join(root,'design/weapons/arsenal-v1/arsenal.json'))),economy=JSON.parse(fs.readFileSync(path.join(root,'design/items/economy.json')));
 const config=path.join(root,'js/config.js');let cfg=fs.readFileSync(config,'utf8');cfg=cfg.replace(/const CALIBERS = \{[\s\S]*?\n\};/,'const CALIBERS = '+JSON.stringify(spec.calibers,null,2)+';');fs.writeFileSync(config,cfg);
 const models=Object.fromEntries(spec.weapons.map(w=>{const f=spec.families[w.category],c=spec.calibers[w.caliber],price=economy.weapons[w.id]||w;
   for(const k of ['aimTime','recoilVMul','recoilHMul','spreadGrowthMul','spreadMul','adsPrecisionMul'])
     if(!Number.isFinite(w[k]))throw new Error(w.id+' 缺少七参数字段 '+k);
   return[w.id,{...w,attackType:w.injuryType||(w.category==='shotgun'?'shotgun':'bullet'),injuryChanceMul:w.injuryChanceMul??(w.category==='smg'?0.8:w.category==='rifle'?1.1:1),slot:w.category==='pistol'?'secondary':'primary',ammo:'ammo_'+w.caliber+'_'+(c.defaultLevel||1),dmgMin:c.damage[0],dmgMax:c.damage[1],pellets:w.category==='shotgun'?6:1,speed:f.speed,range:f.range,pelletSpread:f.pelletSpread||0,price:price.price,rarity:price.rarity??w.rarity}];}));
 const aliases=JSON.stringify(spec.aliases),block='/* BEGIN ARSENAL */\nconst WEAPON_ALIASES = '+aliases+';\nfunction canonicalWeaponId(id){return WEAPON_ALIASES[id]||id;}\nconst WEAPONS = '+JSON.stringify(models,null,2)+';\nfor(const [old,id]of Object.entries(WEAPON_ALIASES))Object.defineProperty(WEAPONS,old,{get:()=>WEAPONS[id],enumerable:false});\nART.gear=[...new Set([...ART.gear.filter(id=>!WEAPON_ALIASES[id]),...Object.keys(WEAPONS)])];\n/* END ARSENAL */';
 const file=path.join(root,'js/data.js');let src=fs.readFileSync(file,'utf8');src=src.includes('/* BEGIN ARSENAL */')?src.replace(/\/\* BEGIN ARSENAL \*\/[\s\S]*?\/\* END ARSENAL \*\//,block):src.replace(/const WEAPONS = \{[\s\S]*?\n\};/,block);
 src=src.replace(/const DEFAULT_WEAPONS = \[[^;]+;/,"const DEFAULT_WEAPONS = ['m4a1','mp155','glock17'];");
 const legacyNames={'12g':['普通鹿弹','强化鹿弹','硬质鹿弹','穿甲霰弹','特种穿甲霰弹']};
 for(const c of Object.values(spec.calibers))if(c.ammoNames&&(c.ammoNames.length!==c.prices?.length||c.ammoShortNames?.length!==c.ammoNames.length))throw Error('Ammo name count mismatch: '+c.id);
 for(const c of Object.values(spec.calibers))for(const name of c.ammoShortNames||[])if([...name].reduce((n,ch)=>n+(ch.charCodeAt(0)<128?1:2),0)>8)throw Error('Ammo short name exceeds grid width: '+c.id+'/'+name);
 const tiers=['普通','改良','钢芯','穿甲','特种穿甲'],table=Object.values(spec.calibers).flatMap(c=>c.ammunition?c.ammunition.map(a=>[c.id,a.level,a.name,a.price]):c.prices.map((price,i)=>[c.id,i+1,c.ammoNames?.[i]?c.name+' '+c.ammoNames[i]:legacyNames[c.id]?.[i]||c.label+tiers[i]+'弹',price]));
 src=src.replace(/const AMMO_TABLE = \[[\s\S]*?\n\];/,'const AMMO_TABLE = '+JSON.stringify(table,null,2)+';');src=src.replace(/const AMMO_STACK_LIMITS = [^;]+;/,'const AMMO_STACK_LIMITS = '+JSON.stringify(Object.fromEntries(Object.values(spec.calibers).map(c=>[c.id,c.stack])))+';');
 src=src.replace('cat: \'ammo\', r: level, w: 0.012, price,','cat: \'ammo\', r: level, w: cal.weight || 0.012, price,');
 fs.writeFileSync(file,src);return spec;
}
module.exports={build};if(require.main===module){build();console.log('Built '+require('../design/weapons/arsenal-v1/arsenal.json').weapons.length+' models and shared caliber/ammo definitions');}
