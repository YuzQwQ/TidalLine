const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'design/merchants'),d=JSON.parse(fs.readFileSync(path.join(folder,'design-v1.json')));
const c={console,Math,Object,Array};c.globalThis=c;vm.createContext(c);for(const f of ['config.js','data.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',f),'utf8'),c);
const game=vm.runInContext('({WEAPONS,ITEMS,BAGS,MELEE})',c),ids=new Set(game.ITEMS.map(x=>x.id));
assert.equal(d.status,'design_only_not_runtime');assert.equal(d.characters.length,3);assert.equal(d.quests.length,18);assert.equal(d.products.length,57);
const characters=new Set(d.characters.map(x=>x.id)),questMap=new Map(d.quests.map(x=>[x.id,x]));assert.equal(questMap.size,18);
for(const [id,age,name]of [['merchant_armor',48,'玛拉·维恩'],['merchant_guns',55,'埃德加·洛克'],['merchant_doctor',41,'林岑']]){const x=d.characters.find(x=>x.id===id);assert.equal(x.age,age);assert.equal(x.name,name);}
function visit(id,visiting=new Set(),done=new Set()){
  assert(questMap.has(id),id);assert(!visiting.has(id),'cycle '+id);if(done.has(id))return;
  visiting.add(id);for(const p of questMap.get(id).prerequisites)visit(p,visiting,done);visiting.delete(id);done.add(id);
}
for(const q of d.quests){assert(characters.has(q.merchantId));visit(q.id);assert.equal(q.status,'design_only');}
for(const merchant of d.characters){
  assert.equal(merchant.quests.length,6);assert.equal(Object.keys(merchant.dialogue).length,8);
  assert.deepEqual(merchant.levels.map(l=>l.minReputation),[0,25,60,85]);
  for(let i=1;i<4;i++)assert(merchant.levels[i].minTrade>merchant.levels[i-1].minTrade);
  for(const pathName of ['cooperate','alternative']){
    let rep=0,level=1;const completed=new Set();
    for(const qid of merchant.quests){const q=questMap.get(qid);assert(level>=q.minTrust,merchant.id+' level deadlock at '+qid);assert(q.prerequisites.every(id=>completed.has(id)));
      if(q.branch){assert(q.branch.sameCoreRewards);assert(q.branch[pathName]);assert.equal(q.branch[pathName].completionFlag,q.id+'_resolved');}
      completed.add(qid);rep+=q.rewards.reputation;
      for(const l of merchant.levels)if(rep>=l.minReputation&&l.requiredFlags.every(f=>completed.has(f.replace(/_resolved$/,''))))level=Math.max(level,l.level);
    }
    assert.equal(level,4);assert(rep>=85&&rep<=100);
  }
}
const medical=new Set(),ammo=new Set(),productIds=new Set();
for(const p of d.products){assert(!productIds.has(p.id));productIds.add(p.id);assert(characters.has(p.merchantId));assert(p.trustLevel>=1&&p.trustLevel<=4);
 const r=p.reference;
 if(r.kind==='gun')assert(game.WEAPONS[r.id]);else if(r.kind==='bag')assert(game.BAGS.some(x=>x.id===r.id));else if(r.kind==='melee')assert(game.MELEE.some(x=>x.id===r.id));
 else if(['helmet','body'].includes(r.kind))assert(r.level>=1&&r.level<=6);
 else {assert(ids.has(r.id),r.id);if(r.kind==='medical'){assert(!medical.has(r.id));medical.add(r.id);const item=game.ITEMS.find(x=>x.id===r.id);if(!item.healCap)assert.equal(p.requiresFeature,'reserved_medical_effect');}else ammo.add(r.id);}
}
assert.equal(medical.size,18);assert.equal(ammo.size,15);
for(const p of d.placeholders){assert.equal(p.status,'concept_only');assert.equal(p.purchaseEnabled,false);assert.equal(p.basePrice,null);assert(p.requiresFeature);}
for(const file of ['MERCHANT_SYSTEM_V1.md','QUEST_LINES_V1.md','STOCK_UNLOCKS_V1.md','DIALOGUE_V1.md','DATA_CONTRACT_V1.md','STORY_LINKS_V1.md','index.html','BRIEF_V1.md'])assert(fs.existsSync(path.join(folder,file)));
fs.writeFileSync(path.join(folder,'validation.json'),JSON.stringify({status:'passed',scope:'design_only',characters:3,quests:18,products:57,dialogueSamples:24,placeholders:7,bothMoralPathsReachLevel4:true,acyclicPrerequisites:true,allExistingReferencesValid:true,numericBalance:'proposal_requires_future_playtesting'},null,2)+'\n');
console.log('PASS: 3 characters, 18 acyclic quests, both moral paths reach Lv4, 57 valid product mappings, 24 dialogue samples');
