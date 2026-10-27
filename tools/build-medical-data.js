/* 医疗清单为源数据，运行数据内嵌，file:// 与离线版都不需要 fetch。 */
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
function build(){
 const spec=require('../design/items/medical.json');
 const economyPath=path.join(root,'design/items/economy.json');
 const prices=fs.existsSync(economyPath)?JSON.parse(fs.readFileSync(economyPath,'utf8')).items:[];
 const items=spec.items.map(i=>({...i,price:prices.find(p=>p.id===i.id)?.price??i.price,cat:'medical',noCodex:true,use:!!i.heal,...(!i.heal?{noLoot:true}:{} )}));
 const block='/* BEGIN MEDICAL DATA */\nconst MEDICAL_GROUPS = '+JSON.stringify(spec.groups)+';\nconst MEDICAL_ITEMS = '+JSON.stringify(items,null,2)+';\n/* END MEDICAL DATA */';
 const file=path.join(root,'js/data.js');let src=fs.readFileSync(file,'utf8');
 if(src.includes('/* BEGIN MEDICAL DATA */'))src=src.replace(/\/\* BEGIN MEDICAL DATA \*\/[\s\S]*?\/\* END MEDICAL DATA \*\//,block);
 else src=src.replace('const ITEMS = [',block+'\n\nconst ITEMS = [\n  ...MEDICAL_ITEMS,');
 src=src.replace(/^  \{ id:'med01'.*\r?\n/m,'');
 src=src.replace("itemId:'med01'","itemId:'heal01'").replace("price:25, max:5","price:30, max:5");
 fs.writeFileSync(file,src);
}
module.exports={build};if(require.main===module)build();
