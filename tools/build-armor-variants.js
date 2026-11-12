/* Stable model definitions; base level prices stay owned by the existing economy table. */
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');
function build(){
 const spec=JSON.parse(fs.readFileSync(path.join(root,'design/equipment/armor-variants-v1/design.json'))),economy=JSON.parse(fs.readFileSync(path.join(root,'design/items/economy.json')));
 const penalties=spec.preIntegration.candidateOnly.bodyAimPenaltyPct;
 const basePenalties=Array.from({length:7},(_,lv)=>penalties['body'+lv]||0);
 const variants=spec.variants.map(v=>({id:v.id,type:v.type,lv:v.level,name:v.name,short:v.short,dur:v.proposed.durability,material:v.proposed.material||'aramid',w:v.proposed.weight,price:economy.armorVariants?.[v.id]??v.proposed.price,rep:v.proposed.repair??50,aimPenaltyPct:v.type==='body'?penalties[v.id]:0,desc:v.description,visual:v.visual,source:v.source}));
 const block='/* BEGIN ARMOR VARIANTS */\nconst ARMOR_VARIANTS = '+JSON.stringify(variants,null,2)+';\nfor (const [type,list] of [[\'helmet\',HELMETS],[\'body\',BODIES]]) {\n  list.forEach(d=>{d.id=type+d.lv;d.icon=d.id;d.type=type;d.move=1;d.aimPenaltyPct=type===\'body\'?'+JSON.stringify(basePenalties)+'[d.lv]:0;});\n  list.push(...ARMOR_VARIANTS.filter(d=>d.type===type).map(d=>({...d,icon:d.id,move:1})));\n}\nfor(const w of Object.values(WEAPONS))w.aimTime??={rifle:.40,shotgun:.45,smg:.30,pistol:.20}[w.id]??.4;\nART.gear=[...new Set([...ART.gear,...ARMOR_VARIANTS.map(d=>d.id)])];\n/* END ARMOR VARIANTS */';
 const file=path.join(root,'js/data.js');let src=fs.readFileSync(file,'utf8');src=src.includes('/* BEGIN ARMOR VARIANTS */')?src.replace(/\/\* BEGIN ARMOR VARIANTS \*\/[\s\S]*?\/\* END ARMOR VARIANTS \*\//,block):src.replace('const BASE_BAG_SLOTS =',block+'\n\nconst BASE_BAG_SLOTS =');fs.writeFileSync(file,src);
 return variants;
}
module.exports={build};if(require.main===module){build();console.log('Built 8 stable-ID armor variants');}
