/* Build gate: evaluate real runtime prices and current permanent retail shelves. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'design/merchants/elena-v1');
function check(){
 const c=vm.createContext({console,setTimeout:()=>1,clearTimeout:()=>{}});
 for(const f of ['config','data','attachment-data','attachments','core','common','medical','save','trader','buyback-data','sales','commission-data','commissions'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),c,{filename:f});
 const report=JSON.parse(vm.runInContext(`JSON.stringify(COMMISSION_DEFS.map(d=>{const materials=d.objectives.map(o=>{const it=ITEM_BY_ID[o.id];if(!it||itemGroup(it)!=='collectible'||!Number.isSafeInteger(o.n)||o.n<1)throw Error('材料无效 '+o.id);const best=Math.max(...Object.keys(MERCHANT_BUYBACK).map(m=>Sales.quote(m,{id:o.id,n:1})).filter(q=>q.ok).map(q=>q.unit));const sold=Object.keys(MERCHANT_INVENTORY).some(m=>TradeMerchant.offers(m).some(x=>x.item.id===o.id));return {id:o.id,name:it.name,n:o.n,best,availableOnShelf:sold};});const rewards=d.rewards.items.map(r=>{const it=Commissions.rewardItem(r);if(!it||!Number.isSafeInteger(r.n)||r.n<1||it.equip?.lv===6)throw Error('奖励无效 '+r.id);return {id:r.id,name:it.name,n:r.n,resale:unitPrice(it)};});return {id:d.id,title:d.title,tier:d.tier,materials,cash:d.rewards.cash,rewards,materialValue:materials.reduce((n,o)=>n+o.best*o.n,0),rewardValue:d.rewards.cash+rewards.reduce((n,r)=>n+r.resale*r.n,0)};}))`,c));
 assert.equal(report.length,6);assert.equal(new Set(report.map(d=>d.id)).size,6);
 for(const tier of [1,2,3])assert.equal(report.filter(d=>d.tier===tier).length,2);
 for(const d of report){assert(d.rewardValue>d.materialValue,d.title+' 报酬不高于最高回收价值');assert(d.materials.some(o=>!o.availableOnShelf),d.title+' 所有材料均可常驻购买');assert(Number.isSafeInteger(d.cash)&&d.cash>=0);}
 fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'valuation.json'),JSON.stringify({passed:true,basis:'材料取五商人最高实际回收价；奖励取当前普通回收估价。货架使用运行时常驻收集品供货接口。',templates:report},null,2)+'\n');
 fs.writeFileSync(path.join(folder,'commissions.json'),vm.runInContext('JSON.stringify({weights:COMMISSION_WEIGHTS,tiers:COMMISSION_TIERS,definitions:COMMISSION_DEFS},null,2)',c)+'\n');
 console.log('委托构建检查通过：6份报酬均高于最高收购值，且各含非货架材料');return report;
}
module.exports={check};if(require.main===module)check();
