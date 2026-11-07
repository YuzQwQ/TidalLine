const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {pathToFileURL}=require('url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'design/items/keys-v1');
async function main(){
 const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.png')?'image/png':f.endsWith('.css')?'text/css':'text/html;charset=utf-8');res.end(b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true}).catch(e=>{server.close();throw e;}),results=[];
 try{
  for(const file of ['index.html','潮汐线.html']){
   const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(pathToFileURL(path.join(root,file)).href+'#doors-test');
   await page.waitForFunction(()=>typeof ItemCapacity!=='undefined'&&typeof DoorSystem!=='undefined'&&document.querySelector('[data-door-mode]'));
   const logic=await page.evaluate(()=>{
    const check=(c,m)=>{if(!c)throw Error(m);},k=ITEM_BY_ID.door_key_test,k2=ITEM_BY_ID.door_key_old_apt,
      k3=ITEM_BY_ID.door_key_tier_1,k4=ITEM_BY_ID.door_key_tier_2,P=Game.player;
    check(KEY_ITEMS.length===8&&k.maxDur===1&&k.price===400000,'catalog');
    check(k2&&k2.name==='老公寓3号房钥匙'&&k2.maxDur===10&&k2.price===30000000&&k2.number==='002'&&k2.r===6&&k2.cat==='key','top tier key catalog');
    check(k3&&k3.maxDur===10&&k3.price===17500000&&k3.r===4&&k3.cat==='key','normal tier key catalog');
    check(k4&&k4.maxDur===10&&k4.price===22000000&&k4.r===5&&k4.cat==='key','elite tier key catalog');
    const roomKeys=[
      ['door_key_clinic','诊所储藏室钥匙',4,7100000],
      ['door_key_watchshop','钟表店私人收藏室钥匙',5,18300000],
      ['door_key_warehouse','仓库后勤储备室钥匙',5,20500000],
      ['door_key_bank_vault','银行金库大门钥匙',6,43900000]
    ].map(([id,name,r,price])=>{const it=ITEM_BY_ID[id];
      check(it&&it.name===name&&it.cat==='key'&&it.r===r&&it.price===price&&it.maxDur===10&&it.noLoot&&it.noCodex&&it.drop===true,'room key '+id);
      return it;});
    const qb=cap=>Sales.quote('viktor',{id:k2.id,n:1,cap});
    check(qb(10).ok&&qb(10).unit===Math.floor(k2.price*0.75),'key buyback full durability');
    check(qb(5).ok&&qb(5).unit===Math.floor(k2.price*0.5*0.75),'key buyback half durability');
    check(qb(7).unit===Math.floor(k2.price*0.7*0.75),'key buyback fractional durability');
    check(!qb(0).ok,'broken key not sellable');
    check(roomKeys.every(it=>Loot.pickFromPool([it])===null&&itemGroup(it)==='supply'),'room keys not in loot / supply group');
    check(Loot.pickFromPool([k2])===null&&itemGroup(k2)==='supply'&&stackLimit(k2)===1,'top tier key pool/category');
    check(!Medical.is(k)&&itemGroup(k)==='supply'&&stackLimit(k)===1,'key category');
    check(Loot.pickFromPool([k])===null,'key leaked into loot');
    for(const where of ['slots','safe']){
     const d={doorType:'locked',keyId:k.id};P.bag.slots=[];P.bag.safe=[];
     check(!DoorSystem.prepareOpen(d,P).ok,'missing key accepted');
     P.bag[where]=[{item:{...k,id:'wrong'},n:1,cap:1}];check(!DoorSystem.prepareOpen(d,P).ok&&P.bag[where][0].cap===1,'wrong key consumed');
     P.bag[where]=[{item:k,n:1,cap:0}];check(!DoorSystem.hasKey(d,P),'exhausted key accepted');
     P.bag[where]=[{item:k,n:1,cap:1},{item:k,n:1,cap:1}];
     check(DoorSystem.prepareOpen(d,P).keyBroken&&P.bag[where].length===1,'one use must remove exactly one key');
     check(DoorSystem.prepareOpen(d,P).ok&&P.bag[where].length===1,'reopening consumes key');
     const next={doorType:'locked',keyId:k.id};check(DoorSystem.prepareOpen(next,P).ok&&P.bag[where].length===0,'second door must consume second key');
    }
    const durable={...k,maxDur:3},d={doorType:'locked',keyId:k.id};P.bag.slots=[{item:durable,n:1,cap:2}];P.bag.safe=[];
    check(DoorSystem.prepareOpen(d,P).ok&&P.bag.slots[0].cap===1,'multi-use decrement');
    check(ITEM_BY_ID[k.id].maxDur===1,'template mutated');
    const rows=Save.normalizeList([{id:k.id,n:1,cap:0},{id:k.id,n:1}]);check(rows.length===1&&rows[0].cap===1,'normalization resurrects broken key');
    const fixture={...k,id:'__durable_test',maxDur:3};ITEM_BY_ID[fixture.id]=fixture;
    const preserved=Save.normalizeList([{id:fixture.id,n:1,cap:2}]);check(preserved[0].cap===2,'partial durability lost');delete ITEM_BY_ID[fixture.id];
    const map=MAP_CATALOG.find(x=>x.id==='linhai-old-quarter');check(map&&map.width===72&&map.height===56&&map.enemies.length>0,'layout not loaded');
    document.getElementById('doorTestControls')?.remove();Game.rangeMode=false;Game.state='base';Save.stash=[];Save.bag=[];Save.safe=[];Save.credits=1000000;Base.open();MerchantUI.open('viktor');
    check(TradeMerchant.offers().find(o=>o.item.id===k.id)?.price===400000,'retail multiplier changed key price');
    const shelf=TradeMerchant.offers('viktor').filter(o=>o.item.cat==='key');
    check(shelf.length===KEY_ITEMS.length,'keys not all stocked by viktor');
    check(shelf.every(o=>o.price===o.item.price&&o.item.r>0),'key shelf price/rarity drift');
    check(KEY_ITEMS.every(x=>shelf.some(o=>o.item.id===x.id)),'a key is missing from the viktor shelf');
    check(!TradeMerchant.buy('viktor',k.id,500000)&&Save.credits===1000000&&Save.stash.length===0,'stale quote mutated inventory');
    return{bagAndSafeConsumption:true,wrongAndMissingRejected:true,exhaustedRemoved:true,reopenFree:true,independentCopies:true,partialDurability:true,layout:true};
   });
   await page.locator('[data-mb-filter="key"]').click();
   await page.locator('#shopGrid [data-offer*="door_key_test"]').click();
   assert.match(await page.locator('.mb-inspector').innerText(),/剩余耐久/);
   await page.locator('[data-mb-confirm]').click();
   await page.locator('#dealBox [data-a="go"]').click();
   await page.waitForFunction(()=>Save.stash.some(e=>e.id==='door_key_test'));
   await page.evaluate(()=>{
    const check=(c,m)=>{if(!c)throw Error(m);};
    check(Save.credits===600000&&Save.stash.length===1&&Save.stash[0].cap===1,'purchase state');
    check(Base.toBag(Save.stash[0])&&Save.bag[0].cap===1,'stash to bag');
    check(BaseSafe.transfer(Save.bag[0],'bag','safe')&&Save.safe[0].cap===1,'bag to safe');
    Save.save();Save.flush();Save.safe=[];Save.load();check(Save.safe.length===1&&Save.safe[0].cap===1,'save round trip');
   });
   fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,file==='index.html'?'shop.png':'offline-shop.png')});
   assert.deepEqual(errors,[]);results.push({file,...logic,purchaseAndSave:true,errors});await context.close();
  }
  const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/design/maps/editor/index.html');
  await page.waitForFunction(()=>window.__editor?.store.get().data&&window.KeyCatalog);
  await page.evaluate(()=>{const data=MapTemplates.create({id:'key-test',width:30,height:24,template:'blank'}).data;data.portals=[{id:'locked',kind:'door',cells:[[8,8]],width:1,connects:['outdoors','outdoors']}];__editor.apply({data,rules:{},source:'test'},{silent:true});__editor.select({kind:'portal',id:'locked'});});
  assert.equal(await page.getByLabel('对应钥匙编号',{exact:true}).count(),0);
  await page.getByLabel('门体类型',{exact:true}).selectOption('locked');
  await page.getByLabel('对应钥匙编号',{exact:true}).selectOption('door_key_test');
  const saved=await page.evaluate(()=>MapCore.serialize(__editor.store.get().data));assert.equal(JSON.parse(saved).portals[0].keyId,'door_key_test');
  await page.evaluate(()=>__editor.history.undo());assert.equal(await page.evaluate(()=>__editor.store.get().data.portals[0].keyId),undefined);
  await page.evaluate(()=>__editor.history.redo());assert.equal(await page.evaluate(()=>__editor.store.get().data.portals[0].keyId),'door_key_test');
  await page.evaluate(s=>{__editor.apply({data:JSON.parse(s),rules:{},source:'reopened'},{silent:true});__editor.select({kind:'portal',id:'locked'});},saved);
  assert.equal(await page.getByLabel('对应钥匙编号',{exact:true}).inputValue(),'door_key_test');
  await page.screenshot({path:path.join(out,'editor.png')});await page.close();
  fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({passed:true,results,editorSaveUndoRedoReopen:true},null,2));
  console.log('PASS: key catalog, inventory/safe durability, purchase at ¥400,000, save/load, lock consumption, layout, editor selection/save/undo/redo/reopen; index + offline');
 }finally{await browser.close();server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
