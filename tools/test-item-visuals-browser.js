const {chromium}=require('playwright');
const {pathToFileURL}=require('url');
const path=require('path'),fs=require('fs'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'design/ui/item-visual-v1');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 fs.mkdirSync(out,{recursive:true});const results=[];
 try{for(const file of ['index.html','潮汐线.html']){
  const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  const prefix=file==='index.html'?'runtime':'offline';
  await p.goto(pathToFileURL(path.join(root,file)).href+'#sandbox-test');
  await p.waitForFunction(()=>typeof Sandbox!=='undefined'&&Sandbox.active);
  const scan=await p.evaluate(()=>{
   Game._visualUpdate=Game.update;Game.update=()=>{};
   const egg=Game.boxes.find(b=>b.groundLoot&&b.items[0]?.item.egg);
   if(!egg)throw Error('Missing ground egg');
   const item=ITEM_BY_ID.odd15;
   Game.openLoot({x:Game.player.x,y:Game.player.y,name:'搜索视觉测试',items:[{item,n:1,known:false}]});
   Game.autoSearch=false;Game.search.t=Game.search.total*.5;Game.renderLootList();
   const row=document.querySelector('#lootList .row'),icon=row.querySelector('.scan-silhouette');
   return{clip:getComputedStyle(icon).clipPath,black:getComputedStyle(icon).filter,
    lens:!!row.querySelector('.search-lens'),unknown:!row.textContent.includes(item.name),
    safes:Game.boxes.filter(b=>b.sandboxSafe).length};
  });
  assert(scan.clip.includes('50%')&&scan.black==='brightness(0)'&&scan.lens&&scan.unknown&&scan.safes===3);
  await p.screenshot({path:path.join(out,prefix+'-search.png')});
  const reveal=await p.evaluate(()=>{
   Game.search.t=Game.search.total;Game._visualUpdate(0);
   const row=document.querySelector('#lootList .row');
   return{known:Game.lootOpen.items[0].known,reveal:row.classList.contains('search-revealed'),
    colors:getComputedStyle(row,'::before').backgroundImage,glint:Game.lootRevealTiming(ITEM_BY_ID.odd15),
    delay:parseFloat(row.style.animationDelay),timings:Array.from({length:6},(_,i)=>Game.lootRevealTiming({r:i+1}))};
  });
  assert(reveal.known&&reveal.reveal&&reveal.delay<=0&&reveal.colors.includes('45deg'));
  assert.deepEqual(reveal.timings.map(t=>t.light),[120,220,380,600,900,1300]);
  assert.deepEqual(reveal.timings.map(t=>t.pop),[80,140,240,380,580,850]);
  assert.deepEqual(reveal.timings.map(t=>t.glint),[0,0,0,0,600,1100]);
  await p.close();
  const base=await browser.newPage({viewport:{width:1440,height:900}});
  base.on('pageerror',e=>errors.push(e.message));
  await base.goto(pathToFileURL(path.join(root,file)).href+'#base');
  await base.waitForFunction(()=>typeof StorageUI!=='undefined'&&StorageUI.mounted);
  const frames=await base.evaluate(()=>{
   Save.stash=[{id:'odd15',n:1},{id:'elec02',n:1},{id:'life01',n:1}];Save.credits=100000000;
   Safehouse.route('stash');Base.render();
   return [...document.querySelectorAll('#stashGrid .scell:not(.empty)')].map(e=>{
    const s=getComputedStyle(e),a=getComputedStyle(e,'::after');
    return{radius:s.borderRadius,animation:a.animationName,angle:a.getPropertyValue('--rarity-border-angle')};
   });
  });
  assert(frames.length===3&&frames.every(f=>f.radius==='6px'&&f.animation==='none'&&f.angle==='10deg'));
  await base.screenshot({path:path.join(out,prefix+'-warehouse.png')});
  await base.evaluate(()=>MerchantUI.open('gun'));
  for(const width of [1440,900,390]){
   await base.setViewportSize({width,height:900});
   const tiles=await base.evaluate(()=>[...document.querySelectorAll('#shopGrid .scell:not([hidden])')].map(e=>{
    const r=e.getBoundingClientRect(),pr=e.querySelector('.pr').getBoundingClientRect();
    return Math.abs(r.width-r.height)<2&&pr.top>=r.bottom;
   }));assert(tiles.length&&tiles.every(Boolean));
  }
  await base.setViewportSize({width:1440,height:900});
  await base.screenshot({path:path.join(out,prefix+'-shop.png')});
  assert.deepEqual(errors,[]);results.push({file,scan,frames,passed:true});await base.close();
 }}finally{await browser.close();}
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({passed:true,results},null,2)+'\n');
 console.log('PASS: scan silhouette, rarity reveal timings, egg frames, static base frames and square shop tiles; development/offline');
})().catch(e=>{console.error(e);process.exitCode=1;});
