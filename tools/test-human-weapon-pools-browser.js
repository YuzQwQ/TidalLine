const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{pathToFileURL}=require('url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'design/enemies/weapon-pools-v1');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--mute-audio','--no-proxy-server']}),reports=[];
try{for(const file of ['index.html','潮汐线.html']){
 const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],external=[];p.on('pageerror',e=>errors.push(e.message));p.on('requestfailed',r=>errors.push(r.url()+' '+r.failure()?.errorText));p.on('request',r=>{if(file!=='index.html'&&r.url().includes('/assets/'))external.push(r.url());});
 await p.goto(pathToFileURL(path.join(root,file)).href+'#base');await p.waitForFunction(()=>typeof HumanAI!=='undefined'&&HUMAN_UNIT_DEFS.scav.weapons?.length===13&&ART.gear.every(id=>Icons.gear[id]?.naturalWidth===48));
 const fixtures=await p.evaluate(()=>{window.__beforePoolMaps=JSON.stringify(MAP_CATALOG);return Object.entries(HUMAN_UNIT_DEFS).flatMap(([key,d])=>{let offset=0;return d.weapons.map(([id,weight])=>{const row={key,id,draw:(offset+weight/2)/100};offset+=weight;return row;});});});const rows=[];
 for(const f of fixtures){
  const result=await p.evaluate(({key,id,draw})=>{
   Base.close();Save.hp=100;Save.bag=[];Save.gear.weapons=[null,null,null];Game.startRun(null,RANGE_MAP.id);Game.wantLock=()=>false;Game.enemies=[];Game.player.hurt=()=>0;
   const rand=Math.random;let e;try{Math.random=()=>draw;e=new Enemy(key,Game.player.x+40,Game.player.y,0,{facing:'w'});}finally{Math.random=rand;}
   if(e.weaponId!==id)throw Error('Wrong draw '+e.weaponId+'/'+id);Game.enemies=[e];const w=WEAPONS[id];if(!HumanAI.shot(e,Math.PI))throw Error('Failed shot');e.dead=true;
   const corpse=new Corpse(e.x,e.y,e);Game.openLoot(corpse,true);return {key,id,mag:e.ai.mag,wantMag:w.mag-1,ammo:e.ammoId,caliber:w.caliber,level:e.gearLv,squad:e.squadId,pellets:Game.bullets.length,wantPellets:w.pellets};
  },f);
  assert.equal(result.mag,result.wantMag);assert.equal(result.pellets,result.wantPellets);assert.equal(result.ammo,'ammo_'+result.caliber+'_'+result.level);assert.equal(result.squad,'');
  assert(await p.locator('#lootGear img').evaluateAll((imgs,src)=>imgs.some(i=>i.naturalWidth===48&&i.src===src),await p.evaluate(id=>Icons.gear[id].src,f.id)),f.id+' corpse icon');
  if(['ak12','saiga12','groza1'].includes(f.id))await p.screenshot({path:path.join(out,(file==='index.html'?'':'offline-')+f.key+'-loot.png')});
  const stored=await p.evaluate(()=>{const entry=Game.lootOpen.items.find(x=>x.gun);Game.takeGear(entry,Game.lootOpen.items.indexOf(entry));Game.syncGear();Save.save();Save.flush();Save.load();const item=Save.gear.weapons.find(Boolean);return {id:item.equip.gun,mag:item.equip.mag,ammo:item.equip.ammo};});assert.equal(stored.id,f.id);assert.equal(stored.mag,result.mag);assert.equal(stored.ammo,result.ammo);rows.push(result);
 }
 assert(await p.evaluate(()=>JSON.stringify(MAP_CATALOG)===window.__beforePoolMaps));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);reports.push({file,rows,unchangedMapAndSquads:true,errors,external:external.length});await p.close();
}fs.writeFileSync(path.join(out,'browser-verification.json'),JSON.stringify({passed:true,reports},null,2)+'\n');console.log('PASS: development/offline all 25 profile/weapon combinations draw, fire, show corpse icons, equip and save actual ammo; maps and squads unchanged');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
