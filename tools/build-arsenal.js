/* Arsenal JSON owns model mechanics; economy.json owns selling prices. */
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');
function build(){
 const spec=JSON.parse(fs.readFileSync(path.join(root,'design/weapons/arsenal-v1/arsenal.json'))),economy=JSON.parse(fs.readFileSync(path.join(root,'design/items/economy.json')));
 const config=path.join(root,'js/config.js');let cfg=fs.readFileSync(config,'utf8');cfg=cfg.replace(/const CALIBERS = \{[\s\S]*?\n\};/,'const CALIBERS = '+JSON.stringify(spec.calibers,null,2)+';');fs.writeFileSync(config,cfg);
 const models=Object.fromEntries(spec.weapons.map(w=>{const f=spec.families[w.category],c=spec.calibers[w.caliber],price=economy.weapons[w.id]||w;return[w.id,{...w,slot:w.category==='pistol'?'secondary':'primary',ammo:'ammo_'+w.caliber+'_1',dmgMin:c.damage[0],dmgMax:c.damage[1],pellets:w.category==='shotgun'?6:1,speed:f.speed,range:f.range,aimTime:f.aimTime,spreadBase:f.spreadBase*w.spreadMul,spreadMax:f.spreadMax*w.spreadMul,recoilBaseV:f.baseV,recoilBaseH:f.baseH,pelletSpread:f.pelletSpread||0,price:price.price,rarity:price.rarity??w.rarity}];}));
 const aliases=JSON.stringify(spec.aliases),block='/* BEGIN ARSENAL */\nconst WEAPON_ALIASES = '+aliases+';\nfunction canonicalWeaponId(id){return WEAPON_ALIASES[id]||id;}\nconst WEAPONS = '+JSON.stringify(models,null,2)+';\nfor(const [old,id]of Object.entries(WEAPON_ALIASES))Object.defineProperty(WEAPONS,old,{get:()=>WEAPONS[id],enumerable:false});\nART.gear=[...new Set([...ART.gear.filter(id=>!WEAPON_ALIASES[id]),...Object.keys(WEAPONS)])];\n/* END ARSENAL */';
 const file=path.join(root,'js/data.js');let src=fs.readFileSync(file,'utf8');src=src.includes('/* BEGIN ARSENAL */')?src.replace(/\/\* BEGIN ARSENAL \*\/[\s\S]*?\/\* END ARSENAL \*\//,block):src.replace(/const WEAPONS = \{[\s\S]*?\n\};/,block);
 src=src.replace(/const DEFAULT_WEAPONS = \[[^;]+;/,"const DEFAULT_WEAPONS = ['m4a1','mp155','glock17'];");
 const legacyNames={556:['5.56mm普通弹','5.56mm改良弹','5.56mm钢芯弹','5.56mm硬芯穿甲弹','5.56mm特种穿甲弹'],'9mm':['9mm普通弹','9mm强化弹','9mm钢芯弹','9mm穿甲弹','9mm特种穿甲弹'],'12g':['普通鹿弹','强化鹿弹','硬质鹿弹','穿甲霰弹','特种穿甲霰弹']};
 const tiers=['普通','改良','钢芯','穿甲','特种穿甲'],table=Object.values(spec.calibers).flatMap(c=>c.prices.map((price,i)=>[c.id,i+1,legacyNames[c.id]?.[i]||c.label+tiers[i]+'弹',price]));
 src=src.replace(/const AMMO_TABLE = \[[\s\S]*?\n\];/,'const AMMO_TABLE = '+JSON.stringify(table,null,2)+';');src=src.replace(/const AMMO_STACK_LIMITS = [^;]+;/,'const AMMO_STACK_LIMITS = '+JSON.stringify(Object.fromEntries(Object.values(spec.calibers).map(c=>[c.id,c.stack])))+';');
 src=src.replace('cat: \'ammo\', r: level, w: 0.012, price,','cat: \'ammo\', r: level, w: cal.weight || 0.012, price,');
 fs.writeFileSync(file,src);return spec;
}
module.exports={build};if(require.main===module){build();console.log('Built twelve models, five calibers and twenty-five ammo tiers');}
