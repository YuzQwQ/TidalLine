const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/reloading');
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  fs.readFile(file,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.png')?'image/png':'text/html;charset=utf-8'}).end(b));
});
(async()=>{
  fs.mkdirSync(out,{recursive:true}); await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    for(const file of ['index.html','潮汐线.html']){
      const p=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];
      p.on('pageerror',e=>errors.push(e.message));
      await p.goto('http://127.0.0.1:'+server.address().port+'/'+encodeURIComponent(file)+'#base');
      await p.waitForFunction(()=>Icons.get('ammo_556_1')&&Icons.gear.m4a1);
      await p.evaluate(()=>{
        Save.gear.back=BACKPACK.make('bag05');Save.bag=[];
        Save.gear.weapons=[EQUIP.gun('rifle',2,'ammo_556_1',['ammo_556_1','ammo_556_5']),null,EQUIP.gun('pistol',0)];
        Base.close();Game.startRun(null);Game.enemies=[];
        Game.player.bag.slots=[];Game.player.bag.addAmmo('ammo_556_3',8);Game.player.bag.addAmmo('ammo_556_1',2);
      });
      // Short press does not open the wheel and starts a normal reload.
      await p.keyboard.press('r');
      assert(await p.evaluate(()=>Game.player.reloadPending&&!AmmoWheel.isOpen()));
      await p.evaluate(()=>{Game.player.reloadT=0;Game.player.finishReloadIfDone();});
      assert.equal(await p.evaluate(()=>Game.player.mag),12);
      await p.keyboard.down('r');
      await p.waitForFunction(()=>AmmoWheel.isOpen(),null,{timeout:3000}).catch(async e=>{console.log(await p.evaluate(()=>({state:Game.state,quick:{...AmmoQuick},sectors:AmmoWheel.sectors,keys:Game.input.keys,errors:document.body.innerText.slice(-200)})),errors);throw e;});
      assert.equal(await p.locator('#ammoWheel').count(),1);
      // Select the Lv3 sector using real mouse coordinates and release R.
      const point=await p.evaluate(()=>{
        const i=AmmoWheel.sectors.findIndex(s=>s.id==='ammo_556_3');
        const angle=(-90+i*360/AmmoWheel.sectors.length)*Math.PI/180;
        const box=AmmoWheel.cv().getBoundingClientRect(),scale=box.width/720;
        return {x:box.left+(360+Math.cos(angle)*110)*scale,y:box.top+(214+Math.sin(angle)*110)*scale};
      });
      await p.mouse.move(point.x,point.y);
      await p.screenshot({path:path.join(out,file==='index.html'?'ammo-wheel.png':'offline-wheel.png')});
      await p.keyboard.up('r');
      assert(await p.evaluate(()=>!AmmoWheel.isOpen()&&Game.player.mag===0&&Game.player.weapon.ammo==='ammo_556_3'&&Game.player.reloadPending));
      await p.evaluate(()=>{Game.player.reloadT=0;Game.player.finishReloadIfDone();Game.toggleBag();});
      await p.locator('#eqStrip .eqs').first().click({button:'right'});
      await p.getByText('退弹',{exact:true}).click();
      assert.equal(await p.evaluate(()=>Game.player.mag),0);
      // Escape and blur cancel long-press selection without unloading.
      await p.evaluate(()=>{Game.player.tryReload();Game.player.reloadT=0;Game.player.finishReloadIfDone();});
      const mag=await p.evaluate(()=>Game.player.mag);
      await p.keyboard.down('r');await p.waitForFunction(()=>AmmoWheel.isOpen());
      await p.keyboard.press('Escape');await p.keyboard.up('r');
      assert.equal(await p.evaluate(()=>Game.player.mag),mag);
      await p.keyboard.down('r');await p.waitForFunction(()=>AmmoWheel.isOpen());
      await p.evaluate(()=>window.dispatchEvent(new Event('blur')));await p.keyboard.up('r');
      assert(await p.evaluate(()=>!AmmoWheel.isOpen()&&!AmmoQuick.pressing));
      // Base weapon unloading also targets the carried bag.
      await p.evaluate(()=>{Game.syncGear();Base.open();Safehouse.route('loadout');Save.bag=[];Base.render();});
      await p.locator('#baseGear .slot').first().scrollIntoViewIfNeeded();await p.waitForTimeout(150);await p.locator('#baseGear .slot').first().click({button:'right'});
      await p.getByText('退弹',{exact:true}).click();
      assert(await p.evaluate(()=>Save.gear.weapons[0].equip.mag===0&&Save.bag.some(e=>e.id==='ammo_556_3')));
      assert.deepEqual(errors,[]);
      console.log('OK: '+file+' keyboard wheel, mouse selection, menus, cancellation and no browser errors');
      await p.close();
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
