const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{pathToFileURL}=require('url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'design/ui/ammo-purchase-v1');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--mute-audio','--no-proxy-server']}),reports=[];
try{for(const file of ['index.html','潮汐线.html']){
 const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],external=[];p.on('pageerror',e=>errors.push(e.message));p.on('requestfailed',r=>errors.push(r.url()+' '+r.failure()?.errorText));p.on('request',r=>{if(file!=='index.html'&&r.url().includes('/assets/'))external.push(r.url());});await p.goto(pathToFileURL(path.join(root,file)).href+'#base');await p.waitForFunction(()=>typeof MerchantUI!=='undefined'&&MerchantUI.mounted&&ART.gear.every(id=>Icons.gear[id]?.naturalWidth===48));
 const prefix=file==='index.html'?'':'offline-';const stock=await p.evaluate(()=>{Save.credits=1000000;Save.stash=[];MerchantUI.open('gun');MerchantUI.filter='ammo';MerchantUI.applyFilters();return MerchantUI.offers.filter(o=>o.meta.kind==='ammo').map(o=>({id:o.item.id,price:buyPrice(o.item.price),stack:stackLimit(o.item)}));});assert.equal(stock.length,19);
 assert(!(await p.locator('#shopGrid').innerText()).includes('×30'));assert(!(await p.locator('#shopGrid').innerText()).includes('一盒 30'));
 const state=()=>p.evaluate(()=>JSON.stringify([Save.credits,Save.stash]));
 const open=async id=>{await p.evaluate(id=>MerchantUI.choose(MerchantUI.offers.find(o=>o.meta.id===id)),id);await p.locator('[data-mb-confirm]').click();assert(await p.locator('.ammo-checkout').isVisible());};
 for(const it of stock){const before=await state();await open(it.id);const range=p.locator('[data-ammo-range]');assert.equal(await range.getAttribute('max'),String(it.stack*6));assert.equal(await range.inputValue(),String(it.stack));
  await range.press('End');assert.equal(await p.locator('[data-ammo-count]').inputValue(),String(it.stack*6));assert.equal(await p.locator('[data-ammo-total]').innerText(),await p.evaluate(n=>formatMoney(n),it.price*it.stack*6));assert.equal(await state(),before);await p.locator('[data-ammo-cancel]').click();assert.equal(await state(),before);
 }
 const id='ammo_12g_2';await open(id);await p.locator('[data-ammo-range]').press('Home');assert.equal(await p.locator('[data-ammo-count]').inputValue(),'1');const slider=await p.locator('[data-ammo-range]').boundingBox();await p.mouse.click(slider.x+slider.width*.7,slider.y+slider.height/2);assert(Number(await p.locator('[data-ammo-count]').inputValue())>1);
 await p.locator('[data-ammo-count]').fill('37');assert.equal(await p.locator('[data-ammo-range]').inputValue(),'37');const unit=stock.find(it=>it.id===id).price,credits=await p.evaluate(()=>Save.credits);await p.evaluate(()=>{const go=document.querySelector('[data-ammo-pay]');go.click();go.click();});assert.equal(await p.evaluate(()=>Save.credits),credits-37*unit);assert.equal(await p.evaluate(id=>Save.stashCount(id),id),37);assert.deepEqual(await p.evaluate(id=>Save.stash.filter(e=>e.id===id).map(e=>e.n),id),[20,17]);assert.equal(await p.locator('.ammo-checkout').count(),0);
 await open(id);let before=await state();await p.keyboard.press('Escape');assert.equal(await p.locator('.ammo-checkout').count(),0);assert.equal(await state(),before);
 await open(id);for(const invalid of ['', '0','121','1.5']){await p.locator('[data-ammo-count]').fill(invalid);assert(await p.locator('[data-ammo-pay]').isDisabled());}await p.locator('[data-ammo-count]').fill('1');assert(!(await p.locator('[data-ammo-pay]').isDisabled()));await p.locator('[data-ammo-cancel]').click();
 await open(id);await p.evaluate(()=>{Save.credits=0;});before=await state();await p.locator('[data-ammo-pay]').click();assert.equal(await state(),before);assert(await p.locator('[data-ammo-pay]').isDisabled());assert((await p.locator('.ammo-purchase-error').innerText()).includes('信用点'));await p.locator('[data-ammo-cancel]').click();
 await p.evaluate(()=>{Save.credits=1000000;Save.stash=[];Base.render();});await open(id);await p.evaluate(()=>{Save.stash=Array.from({length:STASH_SLOTS},()=>({id:'life01',n:1}));});before=await state();await p.locator('[data-ammo-pay]').click();assert.equal(await state(),before);assert((await p.locator('.ammo-purchase-error').innerText()).includes('仓库'));await p.locator('[data-ammo-cancel]').click();
 await p.evaluate(()=>{Save.stash=[];Base.render();});await open(id);before=await state();await p.evaluate(()=>MerchantUI.open('shop'));assert.equal(await p.locator('.ammo-checkout').count(),0);assert.equal(await state(),before);
 const widths=[];for(const width of [1440,390,320]){await p.setViewportSize({width,height:width===1440?900:844});await p.evaluate(()=>{MerchantUI.open('gun');MerchantUI.filter='ammo';MerchantUI.applyFilters();});await open('ammo_9mm_1');await p.locator('[data-ammo-range]').press('End');assert(await p.evaluate(()=>{const d=document.querySelector('.ammo-checkout'),r=d.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&d.scrollWidth<=d.clientWidth;}));await p.screenshot({path:path.join(out,prefix+width+'.png')});widths.push(width);await p.locator('[data-ammo-cancel]').click();}
 /* 回归：玩家此前看过任意物品详情时，Tips.bindClose() 会装上全局 mousedown /
    scroll / resize 收起监听且永不卸载。旧逻辑会在这里把弹药弹窗连带 Deal.hide()
    （已挂 AmmoPurchase.close）关掉，表现为「弹出后点哪里都退出」。 */
 await p.setViewportSize({width:1440,height:900});
 await p.evaluate(()=>{Save.stash=[];Save.credits=1000000;MerchantUI.open('gun');MerchantUI.filter='ammo';MerchantUI.applyFilters();Tips.show(ITEM_BY_ID['ammo_556_1'],{left:200,top:200,width:40,height:40},'');});
 await open('ammo_9mm_1');
 for(const sel of ['[data-ammo-count]','[data-ammo-range]','.ammo-purchase-item','.ammo-purchase-total']){
   await p.locator(sel).click();
   assert.equal(await p.locator('.ammo-checkout').count(),1,'看过详情后点击 '+sel+' 不应关闭弹窗');
 }
 await p.evaluate(()=>document.dispatchEvent(new Event('scroll',{bubbles:true})));
 assert.equal(await p.locator('.ammo-checkout').count(),1,'滚动事件不应关闭弹窗');
 await p.setViewportSize({width:1200,height:900});
 assert.equal(await p.locator('.ammo-checkout').count(),1,'改窗口大小不应关闭弹窗');
 await p.setViewportSize({width:1440,height:900});
 const unit9=await p.evaluate(()=>buyPrice(ITEM_BY_ID['ammo_9mm_1'].price)),credits9=await p.evaluate(()=>Save.credits);
 await p.locator('[data-ammo-count]').fill('7');await p.locator('[data-ammo-pay]').click();
 assert.equal(await p.locator('.ammo-checkout').count(),0,'确定购买应正常结算并关窗');
 assert.equal(await p.evaluate(()=>Save.credits),credits9-unit9*7);
 await p.evaluate(()=>{Save.stash=[];Save.credits=1000000;Base.render();});
 await open('ammo_9mm_1');await p.locator('[data-ammo-cancel]').click();
 assert.equal(await p.locator('.ammo-checkout').count(),0,'取消按钮应可用');
 await p.evaluate(()=>{Tips.show(ITEM_BY_ID['ammo_556_1'],{left:200,top:200,width:40,height:40},'');document.body.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));});
 assert.equal(await p.evaluate(()=>document.querySelector('#itemTip').style.display),'none','无弹窗时点别处仍应收起详情');
 await p.evaluate(()=>{Save.stash=[];Save.credits=1000000;Base.render();});await open('ammo_556_1');await p.locator('[data-ammo-range]').press('End');await p.locator('[data-ammo-pay]').click();await p.evaluate(()=>{Save.save();Save.flush();});const saved=await state();await p.reload();await p.waitForFunction(()=>Game.state==='base'&&MerchantUI.mounted);assert.equal(await state(),saved);assert.equal(await p.evaluate(()=>Save.stashCount('ammo_556_1')),360);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);reports.push({file,types:stock.length,limits:[120,360,540],widths,sliderAndExactInput:true,cancelAndEscape:true,singleCommit:true,revalidateFundsAndSpace:true,saveReload:true,modalClickRegression:true,errors,external:external.length});await p.close();
 }fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({passed:true,reports},null,2)+'\n');console.log('PASS: development/offline 19 ammo products, actual slider, 6-stack limits, totals, exact quantity, cancel/Escape, single charge, stale funds/space, route cleanup, save/reload, modal click regression and 1440/390/320px');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
