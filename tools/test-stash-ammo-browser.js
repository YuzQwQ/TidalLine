const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.png')?'image/png':'text/html;charset=utf-8'}).end(b));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const file of ['index.html','潮汐线.html']){
  const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:'+server.address().port+'/'+encodeURIComponent(file)+'#base');
  await p.waitForFunction(()=>Icons.get('ammo_12g_1'));
  await p.evaluate(()=>{Save.stash=[{id:'ammo_556_1',n:120},{id:'ammo_9mm_1',n:180},{id:'ammo_12g_1',n:40}];Save.credits=100000;Save.normalizeStash();Save.save();Save.flush();Base.render();});
  assert.equal(await p.locator('#stashGrid .scell:not(.empty)').count(),6);
  assert.deepEqual(await p.locator('#stashGrid .qty').allTextContents(),['20','20','60','60','90','90']);
  await p.reload();await p.waitForFunction(()=>Game.state==='base'&&Icons.get('ammo_12g_1'));
  assert(await p.evaluate(()=>Save.stash.length===6&&Save.stashCount('ammo_12g_1')===40));
  assert(await p.evaluate(()=>Base.buyAmmo('ammo_12g_1',30)));
  assert.equal(await p.evaluate(()=>[...document.querySelectorAll('#stashGrid img')].filter(img=>img.src===Icons.get('ammo_12g_1').src).length),4);
  assert.deepEqual(await p.evaluate(()=>Save.stash.filter(e=>e.id==='ammo_12g_1').map(e=>e.n)),[20,20,20,10]);
  assert.deepEqual(errors,[]);console.log('OK: '+file+' warehouse caps, split cells, reload persistence and multi-slot purchase');await p.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
