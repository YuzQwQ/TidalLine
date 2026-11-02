const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.png')?'image/png':'text/html;charset=utf-8'}).end(b));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});try{
  for(const file of ['index.html','潮汐线.html']){
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/'+encodeURIComponent(file)+'#base');
    await page.evaluate(()=>{Save.gear.weapons=[EQUIP.gun('rifle',10),null,EQUIP.gun('pistol',4)];Save.gear.helmet=GEAR.make('helmet',3);Save.gear.body=GEAR.make('body',3);Save.gear.back=BACKPACK.make('bag03');Base.close();Game.startRun(null);Game.player.hp=0;Game.player.dead=true;Game.beginDying();});
    // Reload before the death animation finishes, when previous code still retained equipment.
    await page.reload();await page.waitForFunction(()=>Game.state==='base');
    assert(await page.evaluate(()=>Save.hp===1&&Save.gear.weapons.every(w=>w===null)&&!Save.gear.helmet&&!Save.gear.body&&!Save.gear.back&&!!Save.gear.melee));
    assert.equal(await page.locator('#baseGear .slot').count(),7);
    assert(!await page.locator('#baseGear img[src*="pistol"]').count());
    await page.evaluate(()=>Base.deploy());await page.waitForFunction(()=>Game.state==='playing');
    assert(await page.evaluate(()=>Game.player.meleeActive&&Game.player.weapons.every(w=>w===null)&&Game.player.mag===0));
    assert.deepEqual(errors,[]);console.log('OK: '+file+' death -> immediate reload -> empty equipment -> melee-only redeployment');await page.close();
  }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
