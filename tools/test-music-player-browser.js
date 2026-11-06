/* Exercise actual MP3 playback and lobby controls in both shipped entry points. */
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),{pathToFileURL}=require('url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'design/audio/lobby-music-v1');
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(err,b)=>{if(err)return res.writeHead(404).end();const ext=path.extname(file);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.mp3':'audio/mpeg','.png':'image/png','.webp':'image/webp'})[ext]||'text/html;charset=utf-8');res.setHeader('Accept-Ranges','bytes');const range=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range||'');if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),b.length-1):b.length-1;res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${b.length}`,'Content-Length':end-start+1});res.end(b.subarray(start,end+1));}else{res.setHeader('Content-Length',b.length);res.end(b);}});});
(async()=>{let browser;const results=[];fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
 browser=await chromium.launch({channel:'msedge',headless:true});
 for(const offline of [false,true]){
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(offline&&/^https?:/.test(r.url()))external.push(r.url());});
  const url=(offline?pathToFileURL(path.join(root,'潮汐线.html')).href:'http://127.0.0.1:'+server.address().port+'/index.html')+'#base',prefix=offline?'offline':'game';
  await page.goto(url);await page.waitForFunction(()=>typeof Music!=='undefined'&&Music.active&&typeof Safehouse!=='undefined'&&Safehouse.root);
  assert.equal(await page.locator('.sh-music-toggle').count(),1);assert.equal(await page.locator('.sh-top nav button').count(),6);
  await page.locator('.sh-music-toggle').click();await page.waitForFunction(()=>Music.el.readyState>=2&&!Music.el.paused);
  const before=await page.evaluate(()=>JSON.stringify({credits:Save.credits,hp:Save.hp,stash:Save.stash,bag:Save.bag}));
  assert.equal(await page.locator('[data-music-track]').count(),4);assert(await page.locator('.music-player').isVisible());
  const initialTime=await page.evaluate(()=>Music.el.currentTime);await page.waitForFunction(t=>Music.el.currentTime>t+.15,initialTime);
  const songs=[];
  for(const id of ['base','no_one_answers','beyond_the_grey']){
   await page.locator('[data-music-track="'+id+'"]').click();await page.waitForFunction(id=>Music.cur===id&&Music.el.readyState>=2&&!Music.el.paused,id);
   songs.push(await page.evaluate(()=>({id:Music.cur,duration:Music.el.duration,source:Music.el.src.startsWith('data:')?'inline':'mp3'})));
   assert(await page.locator('[data-music-track="'+id+'"]').getAttribute('aria-pressed')==='true');
   if(offline)assert(await page.evaluate(()=>/^data:audio\/(mp3|mpeg);base64,/.test(Music.el.src)));
  }
  assert(songs.every(s=>s.duration>180&&s.duration<240));
  await page.locator('[data-music-prev]').click();assert.equal(await page.evaluate(()=>Music.cur),'no_one_answers');
  await page.locator('[data-music-next]').click();assert.equal(await page.evaluate(()=>Music.cur),'beyond_the_grey');
  await page.waitForFunction(()=>Music.el.readyState>=2);
  await page.locator('[data-music-seek]').evaluate(e=>{e.value='60';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForFunction(()=>Music.el.currentTime>=59&&Music.el.currentTime<63);
  await page.locator('[data-music-volume]').fill('37');await page.locator('[data-music-volume]').dispatchEvent('input');assert.equal(await page.evaluate(()=>Music.volume),.37);
  await page.locator('[data-music-mode]').selectOption('repeat');
  await page.evaluate(()=>Music.el.currentTime=Music.el.duration-.1);await page.waitForFunction(()=>Music.el.currentTime<2&&!Music.el.paused);assert.equal(await page.evaluate(()=>Music.cur),'beyond_the_grey');
  await page.locator('[data-music-mode]').selectOption('order');await page.evaluate(()=>Music.el.currentTime=Music.el.duration-.1);await page.waitForFunction(()=>Music.cur==='base'&&Music.el.readyState>=2&&!Music.el.paused);
  await page.locator('[data-music-mode]').selectOption('shuffle');await page.locator('[data-music-next]').click();assert.notEqual(await page.evaluate(()=>Music.cur),'base');
  await page.waitForFunction(()=>!Music.el.paused);await page.locator('[data-music-play]').click();assert(await page.evaluate(()=>!Music.on&&Music.el.paused));
  const prefs=await page.evaluate(()=>({track:Music.cur,volume:Music.volume,mode:Music.mode}));
  assert.equal(await page.evaluate(()=>JSON.stringify({credits:Save.credits,hp:Save.hp,stash:Save.stash,bag:Save.bag})),before);
  await page.reload();await page.waitForFunction(()=>typeof Music!=='undefined'&&Music.active&&Music.prefsLoaded);
  assert.deepEqual(await page.evaluate(()=>({track:Music.cur,volume:Music.volume,mode:Music.mode})),prefs);assert(await page.evaluate(()=>!Music.on&&Music.el.paused));
  await page.locator('.sh-music-toggle').click();await page.locator('[data-music-play]').click();await page.waitForFunction(()=>!Music.el.paused);
  for(const size of [{width:1440,height:900},{width:1280,height:720},{width:390,height:844},{width:320,height:700}]){
   await page.setViewportSize(size);await page.waitForTimeout(100);if(!(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)))console.log(await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,bad:[...document.querySelectorAll('#baseVeil *,.music-player')].map(e=>({tag:e.tagName,cls:e.className,x:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})).filter(e=>e.right>innerWidth+1&&e.x>=0).slice(0,18)})));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflow '+size.width);
   const box=await page.locator('.music-player').boundingBox();assert(box.x>=0&&box.y>=0&&box.x+box.width<=size.width&&box.y+box.height<=size.height,'dialog bounds '+size.width);
   assert(await page.locator('.music-player').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'dialog overflow '+size.width);
   await page.screenshot({path:path.join(out,prefix+'-'+size.width+'.png')});
  }
  await page.setViewportSize({width:1280,height:720});await page.keyboard.press('Escape');assert(!(await page.locator('.music-player').isVisible()));
  await page.locator('.sh-deploy').click();await page.locator('#btnMapStart').click();await page.waitForFunction(()=>Game.state==='playing'&&!Music.active&&Music.el.paused);assert(!(await page.locator('.music-player').isVisible()));
  await page.keyboard.press('Space');assert(await page.evaluate(()=>Music.el.paused));
  await page.evaluate(()=>{Game.state='ended';Game.showEnd(true,'音乐回归测试');Base.open();});await page.waitForFunction(()=>Music.active&&!Music.el.paused);assert.equal(await page.evaluate(()=>Music.cur),prefs.track);
  // Native media pause must happen at silence, with both source positions preserved.
  await page.evaluate(()=>{Music.play('no_one_answers');Music.setVolume(.5);window.__musicPauses=[];const el=Music.el,pause=el.pause;el.pause=function(){window.__musicPauses.push({id:Music.cur,volume:this.volume,time:this.currentTime});return pause.call(this);};});
  await page.waitForFunction(()=>Music.el.readyState>=2&&!Music.el.paused&&Music.el.volume>=.49);await page.evaluate(()=>Music.seek(45));await page.waitForFunction(()=>Music.el.currentTime>=45);
  const shopBefore=await page.evaluate(()=>JSON.stringify({credits:Save.credits,stash:Save.stash,bag:Save.bag}));
  await page.locator('.sh-top [data-sh="traders"]').click();assert.equal(await page.evaluate(()=>Music.scene),'lobby');
  await page.locator('[data-mb-open="gun"]').click();await page.waitForTimeout(200);
  assert(await page.evaluate(()=>Music.scene==='shop'&&Music.cur==='no_one_answers'&&Music._switching&&Music.el.volume>0&&Music.el.volume<.5),'old source fades before it is paused/swapped');
  await page.waitForFunction(()=>Music.cur==='business_as_usual'&&!Music._switching&&!Music.el.paused&&Music.el.volume>=.49);
  const shopPause=await page.evaluate(()=>window.__musicPauses.find(p=>p.id==='no_one_answers'));assert(shopPause&&shopPause.volume<=.01&&shopPause.time>=45);
  songs.push(await page.evaluate(()=>({id:Music.cur,duration:Music.el.duration,source:Music.el.src.startsWith('data:')?'inline':'mp3'})));
  assert.equal(await page.evaluate(()=>Music._lobbyTrack),'no_one_answers');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.tideline_music_v1).track),'no_one_answers');
  await page.evaluate(()=>Music.seek(10));await page.waitForFunction(()=>Music.el.currentTime>=10);await page.locator('[data-mb-mode="sell"]').click();await page.evaluate(()=>Base.render());assert(await page.evaluate(()=>Music.cur==='business_as_usual'&&!Music._switching&&Music.el.currentTime>=10));
  await page.evaluate(()=>MerchantUI.open('doctor'));assert(await page.evaluate(()=>Music.cur==='business_as_usual'&&!Music._switching&&Music.el.currentTime>=10));
  await page.evaluate(()=>Music.el.currentTime=Music.el.duration-.1);await page.waitForFunction(()=>Music.el.currentTime<2&&!Music.el.paused);assert.equal(await page.evaluate(()=>Music.cur),'business_as_usual');
  await page.evaluate(()=>Music.seek(17));await page.waitForFunction(()=>Music.el.currentTime>=17);await page.locator('[data-mb-overview]').click();await page.waitForFunction(()=>Music.cur==='no_one_answers'&&!Music._switching&&!Music.el.paused);
  const restored=await page.evaluate(()=>Music.el.currentTime);assert(restored>=45&&restored<50,'lobby resumes from fade-out pause point');
  await page.locator('[data-mb-open="shop"]').click();await page.waitForFunction(()=>Music.cur==='business_as_usual'&&!Music._switching&&!Music.el.paused);assert(await page.evaluate(()=>Music.el.currentTime>=17&&Music.el.currentTime<21));
  await page.locator('.sh-music-toggle').click();assert((await page.locator('[data-music-title]').textContent()).includes('照常营业'));await page.screenshot({path:path.join(out,prefix+'-shop.png')});await page.locator('[data-music-play]').click();assert(await page.evaluate(()=>Music.el.paused&&!Music.on));await page.keyboard.press('Escape');
  await page.locator('.sh-top nav [data-sh="home"]').click();assert(await page.evaluate(()=>Music.cur==='no_one_answers'&&Music.el.paused&&!Music.on));await page.evaluate(()=>MerchantUI.open('gun'));assert(await page.evaluate(()=>Music.cur==='business_as_usual'&&Music.el.paused&&!Music.on));
  await page.locator('.sh-music-toggle').click();await page.locator('[data-music-play]').click();await page.keyboard.press('Escape');await page.waitForFunction(()=>Music.el.volume>=.49&&!Music.el.paused);
  await page.evaluate(()=>{Safehouse.route('home');MerchantUI.open('gun');Safehouse.route('home');});await page.waitForFunction(()=>Music.scene==='lobby'&&Music.cur==='no_one_answers'&&!Music._switching&&!Music.el.paused);
  assert.equal(await page.evaluate(()=>JSON.stringify({credits:Save.credits,stash:Save.stash,bag:Save.bag})),shopBefore);
  await page.evaluate(()=>MerchantUI.open('gun'));await page.evaluate(()=>MapSelect.open());await page.locator('#btnMapStart').click();await page.waitForFunction(()=>!Music.active&&Music.el.paused);await page.waitForTimeout(1000);assert(await page.evaluate(()=>Music.el.paused&&!Music._switching));
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);results.push({entry:offline?'file:// offline':'HTTP index',songs,viewports:[1440,1280,390,320],realPlayback:true,controls:true,preferences:true,raidSilenceAndReturn:true,shop:{fadeOutPause:shopPause,lobbyRestoredAt:restored,shopLoop:true,shopPositionResume:true,pauseRespected:true,rapidNavigation:true,raidDuringFade:true},errors});await context.close();
 }
 const localContext=await browser.newContext(),local=await localContext.newPage();await local.goto(pathToFileURL(path.join(root,'index.html')).href+'#base');await local.waitForFunction(()=>typeof Music!=='undefined'&&Music.active);await local.locator('.sh-music-toggle').click();
 for(const id of ['base','no_one_answers','beyond_the_grey','business_as_usual']){await local.locator('[data-music-track="'+id+'"]').click();await local.waitForFunction(id=>Music.cur===id&&Music.el.readyState>=2&&!Music.el.paused,id);assert(await local.evaluate(()=>Music.el.src.startsWith('data:audio/')));}await localContext.close();
 fs.writeFileSync(path.join(out,'browser-verification.json'),JSON.stringify({status:'passed',localIndexBundle:true,results},null,2));console.log('PASS: four actual MP3s, smooth shop priority and resume, shop loops, rapid navigation and raid fade cancellation, player controls, saved preferences, mobile, HTTP/offline/local index');
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
