const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require('playwright'),{read}=require('./lib/png-read');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/melee'),art=path.join(root,'assets/item-art/melee');
const manifest=JSON.parse(fs.readFileSync(path.join(art,'manifest.json')));
assert.equal(manifest.assets.filter(a=>a.type==='icon').length,3);assert.equal(manifest.assets.filter(a=>a.type==='sheet').length,15);
for(const a of manifest.assets){const png=read(path.join(root,a.target));assert.equal(png.w,a.type==='icon'?48:a.frames*64);assert.equal(png.h,a.type==='icon'?48:64);
  for(let y=0;y<png.h;y++)for(let x=0;x<png.w;x++){const alpha=png.px[y][x][3];assert(alpha===0||alpha===255,a.id);if(a.type==='icon'&&alpha)assert(x>=4&&x<44&&y>=4&&y<44,a.id);}
  if(a.anchors)for(const f of a.anchors){assert(f.bodyHeight>=24&&f.bodyHeight<=32,JSON.stringify({id:a.id,f}));assert.equal(f.feet[1],46);}
}
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.png')?'image/png':'text/html;charset=utf-8'}).end(b));});
(async()=>{fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});
try{for(const file of ['index.html','潮汐线.html']){
  const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='log')console.log(m.text());});
  await page.goto('http://127.0.0.1:'+server.address().port+'/'+encodeURIComponent(file)+'#base');
  await page.waitForFunction(()=>Icons.gear.melee03&&Art.get('anim','player_melee_melee03_e'));
  assert.equal(await page.locator('#baseGear .slot').count(),7);
  assert(await page.evaluate(()=>Save.gear.melee.equip.bound&&Save.meleeGiftClaimed));
  await page.locator('[data-t="gun"]').click();assert.equal(await page.locator('#shopGrid [data-melee]').count(),2);
  await page.locator('[data-melee="melee02"]').click();await page.locator('#dealBox .go').click();
  await page.locator('[data-t="stash"]').click();await page.locator('#baseGear .slot').last().click();
  const picker=page.locator('#gearPicker .prow').filter({hasText:'M-9'});await picker.click();assert(await page.evaluate(()=>Save.gear.melee.equip.melee==='melee02'));
  await page.screenshot({path:path.join(out,file==='index.html'?'base.png':'offline-base.png')});
  await page.evaluate(()=>{Base.close();Game.startRun(null);Game.enemies=[];Game.player.bag.slots=[];});
  await page.keyboard.press('4');assert(await page.evaluate(()=>Game.player.meleeActive));
  assert.equal(await page.locator('#eqStrip .eqs').count(),7);
  for(const id of ['melee01','melee02','melee03']){
    const samples=await page.evaluate(id=>{
      const p=Game.player;p.melee=EQUIP.melee(id);p.meleeActive=true;p.meleeReadyAt=0;
      return ['s','n','e'].map(dir=>{p.meleeAttack={phase:'windup',weapon:MeleeSystem.def(id),start:p.meleeClock||0,angle:dir==='s'?Math.PI/2:dir==='n'?-Math.PI/2:0,debug:[]};
        const cv=document.createElement('canvas');cv.width=cv.height=64;return Art.drawChar(cv.getContext('2d'),'player',p.meleeAttack.angle,32,32,p,1).sheet.naturalWidth;});
    },id);assert.deepEqual(samples,[256,256,256]);
  }
  await page.evaluate(()=>{const p=Game.player;p.melee=EQUIP.melee('melee03');p.meleeAttack=null;p.meleeReadyAt=0;
    const e=new Enemy('scav',p.x,p.y-20);e.hp=e.maxHp=100;e.update=()=>{};Game.enemies=[e];MeleeGeometry.blockers=()=>[];
  });
  const pos=await page.evaluate(()=>({x:(Game.player.x-Game.cam.x)*Game._scale,y:(Game.player.y-Game.cam.y-60)*Game._scale}));
  await page.mouse.move(pos.x,pos.y);await page.mouse.down();
  await page.waitForFunction(()=>MeleeSystem.locked());await page.keyboard.press('3');await page.keyboard.press('Tab');assert(await page.evaluate(()=>Game.player.meleeActive&&!Game.bagOpen));
  await page.mouse.up();await page.waitForFunction(()=>Game.enemies[0].hp===74);assert(await page.evaluate(()=>Game.player.meleeAttack.phase==='recovery'));
  await page.screenshot({path:path.join(out,file==='index.html'?'melee-hit.png':'offline-hit.png')});
  await page.keyboard.press('3');assert(await page.evaluate(()=>!Game.player.meleeActive));
  await page.keyboard.press('4');assert.equal(await page.evaluate(()=>Game.player.tryShoot()),false);
  await page.evaluate(()=>{Game.state='ended';Game.player.meleeAttack=null;Game.syncGear();Base.open();});
  for(const width of [390,320]){await page.setViewportSize({width,height:844});await page.evaluate(()=>{Game.resize();Base.render();});assert(await page.evaluate(()=>{const offenders=[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&getComputedStyle(e).display!=='none').map(e=>[e.id,e.className,e.getBoundingClientRect().right]).slice(0,12);if(document.documentElement.scrollWidth>innerWidth)console.log(JSON.stringify({offenders,w:innerWidth,scroll:document.documentElement.scrollWidth}));return document.documentElement.scrollWidth<=innerWidth;}));}
  assert.deepEqual(errors,[]);console.log('OK: '+file+' gift, shop, seven slots, three attack sheets, keyboard locks, real hit and narrow screens');await page.close();
}
const gallery=await browser.newPage();await gallery.goto('http://127.0.0.1:'+server.address().port+'/assets/item-art/melee/index.html');await gallery.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));assert.equal(await gallery.locator('.live').count(),15);await gallery.screenshot({path:path.join(art,'preview.png'),fullPage:true});
fs.writeFileSync(path.join(art,'quality.json'),JSON.stringify({status:'passed',icons:3,strips:15,nativeFrame:[64,64],feet:[32,46],development:true,offline:true,narrow:[320,390]},null,2)+'\n');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
