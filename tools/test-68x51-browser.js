const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{pathToFileURL}=require('url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'design/weapons/68x51-v1');
(async()=>{fs.mkdirSync(out,{recursive:true});const b=await chromium.launch({channel:'msedge',headless:true}),reports=[];
try{for(const file of ['index.html','潮汐线.html']){
 const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[],tag=file==='index.html'?'runtime':'offline';p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>localStorage.clear());await p.goto(pathToFileURL(path.join(root,file)).href+'#range');await p.waitForFunction(()=>typeof RangeAim!=='undefined'&&RangeAim.active());
 const range=[];
 for(const [gun,muzzle,family]of [['mcx_spear','att_muzzle11','sr25_pattern'],['rm277','att_muzzle12','rm277']]){
  await p.evaluate(id=>{Range.equip(id);Range.setAmmoLevel(1);},gun);
  assert.deepEqual(await p.locator('[data-ammo]').evaluateAll(es=>es.map(e=>e.dataset.ammo)),['4','5']);
  assert.equal(await p.evaluate(()=>Game.player.weapon.ammo),'ammo_68x51_4');
  await p.locator('[data-ammo="5"]').click();assert.equal(await p.evaluate(()=>Game.player.weapon.ammo),'ammo_68x51_5');
  await p.evaluate(({muzzle,family})=>{Range.setPart('muzzle',muzzle);Range.setPart('magazine','att_mag_68x51_'+family+'_25');}, {muzzle,family});
  const state=await p.evaluate(()=>({id:Game.player.weapon.id,mag:Game.player.weapon.mag,noise:Game.player.weapon.noiseRadius,ammo:Game.player.weapon.ammo,lv:Range.ammoLv,icon:!!Icons.gear[Game.player.weapon.id],ammoIcon:!!Icons.get(Game.player.weapon.ammo),stock:Game.player.weapon.attachmentSlots.stock}));
  assert.equal(state.mag,25);assert(state.icon&&state.ammoIcon);assert.equal(state.stock,gun==='mcx_spear');range.push(state);
  await p.screenshot({path:path.join(out,tag+'-'+gun+'-range.png')});
 }
 // Independent hideout context ensures range prototypes cannot grant actual gear.
 const base=await b.newPage({viewport:{width:1440,height:1000}});base.on('pageerror',e=>errors.push(e.message));await base.addInitScript(()=>localStorage.clear());await base.goto(pathToFileURL(path.join(root,file)).href+'#base');await base.waitForFunction(()=>typeof MerchantUI!=='undefined'&&StorageUI.mounted);
 await base.evaluate(()=>MerchantUI.open('gun'));
 const offers=await base.evaluate(()=>MerchantUI.offers.map(o=>({id:o.meta.id,kind:o.meta.kind,price:o.price})));
 assert(offers.some(o=>o.id==='rm277'&&o.price===1170000));assert(offers.some(o=>o.id==='ammo_68x51_4'&&o.price===7500));
 for(const id of ['mcx_spear','ammo_68x51_5','att_muzzle11','att_muzzle12'])assert(!offers.some(o=>o.id===id),'not sold '+id);
 await base.evaluate(()=>{Save.credits=2000000;Save.stash=[];AmmoPurchase.open('ammo_68x51_4');});
 assert.equal(await base.locator('[data-ammo-range]').getAttribute('max'),'360');
 await base.locator('[data-ammo-count]').fill('20');await base.locator('[data-ammo-count]').dispatchEvent('input');
 assert((await base.locator('[data-ammo-total]').textContent()).includes('150,000'));
 await base.screenshot({path:path.join(out,tag+'-fmj-checkout.png')});await base.locator('[data-ammo-pay]').click();
 assert(await base.evaluate(()=>Save.stashCount('ammo_68x51_4')===20&&Save.credits===1850000));
 await base.evaluate(()=>{MerchantUI.filter='gun';MerchantUI.applyFilters();});await base.screenshot({path:path.join(out,tag+'-shop.png')});
 await base.evaluate(()=>{Save.gear.weapons=[EQUIP.gun('rm277',20),null,null];ModUI.openTarget(Attachments.targets().find(t=>t.owner==='base-equipped'));});
 await base.locator('[data-mod-slot="magazine"]').click();const choices=await base.locator('[data-mod-choice]').evaluateAll(es=>es.map(e=>e.dataset.modChoice));
 assert.deepEqual(choices.sort(),['att_mag_68x51_rm277_competition','att_mag_68x51_rm277_polymer','att_mag_68x51_rm277_25'].sort());
 await base.screenshot({path:path.join(out,tag+'-gunsmith.png')});
 assert.deepEqual(errors,[]);reports.push({file,range,offers:offers.filter(o=>/68x51|spear|rm277|muzzle1[12]/.test(o.id)),choices,passed:true});await p.close();await base.close();
}}finally{await b.close();}
fs.writeFileSync(path.join(out,'browser-verification.json'),JSON.stringify({passed:true,reports},null,2)+'\n');console.log('PASS: 6.8x51 ordinary/offline sparse ammo UI, two guns, exclusive muzzles, 25-round magazines, icons, exact sales and interface-only gunsmith');
})().catch(e=>{console.error(e);process.exitCode=1;});
