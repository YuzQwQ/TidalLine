/* economy.json统一管理交易价格；只替换价格字段，保留玩法与地图改动。 */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
function build(){
 const spec=JSON.parse(fs.readFileSync(path.join(root,'design/items/economy.json'),'utf8'));
 require('./build-medical-data.js').build();
 const file=path.join(root,'js/data.js');let src=fs.readFileSync(file,'utf8');
 const change=(pattern,value)=>{assert(pattern.test(src),'找不到价格锚点 '+pattern);src=src.replace(pattern,(_m,prefix)=>prefix+value);};
 for(const row of spec.items){
  assert(Number.isInteger(row.price)&&row.price>0,row.id+'价格无效');
  if(row.group==='medical')continue;
  change(new RegExp("(\\{ id:\\s*'"+row.id+"'[^\\r\\n]*?\\bprice:\\s*)\\d+"),row.price);
  if(row.group==='collectible'){
   const band=spec.collectionBands.find(b=>b.rarity===row.rarity);
   assert(row.price>=band.min&&(band.max===null||row.price<=band.max),row.id+'超出收集品价格带');
  }
 }
 src=src.replace(/const WEAPONS = \{[\s\S]*?\n\};/,block=>{
  for(const [id,price]of Object.entries(spec.weapons)){
   const re=new RegExp('(  '+id+': \\{[\\s\\S]*?\\bprice:\\s*)\\d+(?:,\\s*rarity:\\s*\\d+)?');
   assert(re.test(block));block=block.replace(re,(_m,prefix)=>prefix+price.price+', rarity: '+price.rarity);
  }
  return block;
 });
 for(const [name,key]of [['HELMETS','helmet'],['BODIES','body']]){
  src=src.replace(new RegExp('const '+name+' = \\[[\\s\\S]*?\\n\\];'),block=>{
   spec.armor[key].forEach((price,n)=>{
    const re=new RegExp('(\\{ lv:\\s*'+(n+1)+'[^\\r\\n]*?\\bprice:\\s*)\\d+');assert(re.test(block));block=block.replace(re,(_m,prefix)=>prefix+price);
   });return block;
  });
 }
 src=src.replace(/const SUPPLY = \{[\s\S]*?\n\};/,block=>{
  for(const [key,price]of Object.entries(spec.supply)){
   const re=new RegExp('(  '+key+':[^\\r\\n]*?\\bprice:\\s*)\\d+');assert(re.test(block));block=block.replace(re,(_m,prefix)=>prefix+price);
  }return block;
 });
 change(/(const START_CREDITS = )\d+/,spec.startCredits);change(/(const BROKE_LINE = )\d+/,spec.brokeLine);
 const runtime={version:spec.version,collectionBands:spec.collectionBands,doctor:spec.doctor};
 const block='/* BEGIN ECONOMY SETTINGS */\nconst ECONOMY = '+JSON.stringify(runtime)+';\n/* END ECONOMY SETTINGS */';
 src=src.includes('/* BEGIN ECONOMY SETTINGS */')?src.replace(/\/\* BEGIN ECONOMY SETTINGS \*\/[\s\S]*?\/\* END ECONOMY SETTINGS \*\//,block):src.replace('const ITEMS = [',block+'\n\nconst ITEMS = [');
 const c=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(root,'js/config.js'),'utf8'),c);vm.runInContext(src,c);
 const items=vm.runInContext('ITEMS',c);assert.equal(items.length,spec.items.length,'物品价格审查需要更新');
 for(const row of spec.items)assert.equal(items.find(i=>i.id===row.id)?.price,row.price,row.id+'运行价格不一致');
 fs.writeFileSync(file,src);
}
module.exports={build};if(require.main===module)build();
