/* economy.json统一管理交易价格；只替换价格字段，保留玩法与地图改动。 */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
function build(){
 const spec=JSON.parse(fs.readFileSync(path.join(root,'design/items/economy.json'),'utf8'));
 require('./build-medical-data.js').build();
 require('./build-armor-variants.js').build();
 require('./build-arsenal.js').build();
 const file=path.join(root,'js/data.js');let src=fs.readFileSync(file,'utf8');
 const change=(pattern,value)=>{assert(pattern.test(src),'找不到价格锚点 '+pattern);src=src.replace(pattern,(_m,prefix)=>prefix+value);};
 for(const row of spec.items){
  assert(Number.isInteger(row.price)&&row.price>0,row.id+'价格无效');
  if(row.group==='medical')continue;
  /* 弹药是 AMMO_TABLE 派生出来的 15 条，价格写在表里，不在这里逐条替换 */
  if(row.group==='ammo')continue;
  change(new RegExp("(\\{ id:\\s*'"+row.id+"'[^\\r\\n]*?\\bprice:\\s*)\\d+"),row.price);
  if(row.group==='collectible'){
   const band=spec.collectionBands.find(b=>b.rarity===row.rarity);
   assert(row.price>=band.min&&(band.max===null||row.price<=band.max),row.id+'超出收集品价格带');
  }
 }
 for(const [name,key]of [['HELMETS','helmet'],['BODIES','body']]){
  src=src.replace(new RegExp('const '+name+' = \\[[\\s\\S]*?\\n\\];'),block=>{
   spec.armor[key].forEach((price,n)=>{
    const re=new RegExp('(\\{ lv:\\s*'+(n+1)+'[^\\r\\n]*?\\bprice:\\s*)\\d+');assert(re.test(block));block=block.replace(re,(_m,prefix)=>prefix+price);
   });return block;
  });
 }
 /* 补给表已删除：带多少全看背包，价格只在物品表里 */
 change(/(const START_CREDITS = )\d+/,spec.startCredits);
 const runtime={version:spec.version,collectionBands:spec.collectionBands,doctor:spec.doctor};
 const block='/* BEGIN ECONOMY SETTINGS */\nconst ECONOMY = '+JSON.stringify(runtime)+';\n/* END ECONOMY SETTINGS */';
 src=src.includes('/* BEGIN ECONOMY SETTINGS */')?src.replace(/\/\* BEGIN ECONOMY SETTINGS \*\/[\s\S]*?\/\* END ECONOMY SETTINGS \*\//,block):src.replace('const ITEMS = [',block+'\n\nconst ITEMS = [');
 const c=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(root,'js/config.js'),'utf8'),c);vm.runInContext(src,c);
 const items=vm.runInContext('ITEMS',c);
 /* 钥匙价格由 design/items/keys.json 经 tools/build-keys.js 单独写入，
    经济表里不重复登记 —— 两边各存一份必然对不齐，所以这里按类别排除。 */
 assert.equal(items.filter(i=>i.cat!=='ammo'&&i.cat!=='key').length,spec.items.length,'物品价格审查需要更新');
 /* 弹药价格直接校验生成结果 */
 for(const [cal,lv,price] of [[ '556',1,60],['9mm',1,35],['12g',1,80]]){
  const it=items.find(i=>i.id==='ammo_'+cal+'_'+lv);
  assert(it&&it.price===price,'弹药价格不一致 ammo_'+cal+'_'+lv);
 }
 for(const row of spec.items)assert.equal(items.find(i=>i.id===row.id)?.price,row.price,row.id+'运行价格不一致');
 fs.writeFileSync(file,src);
}
module.exports={build};if(require.main===module)build();
