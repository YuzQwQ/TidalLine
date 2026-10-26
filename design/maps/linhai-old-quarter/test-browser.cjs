/* 离线评审页、导出文件和缩放/导航检查；需要 playwright、sharp 与 Edge。 */
const assert=require('assert/strict');
const fs=require('fs');
const path=require('path');
const {pathToFileURL}=require('url');
const sharp=require('sharp');
const {chromium}=require('playwright');
const ids=['overview','apartment','clinic','clockshop','bank','encounters','tide'];
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1480,height:1050}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('requestfailed',request=>errors.push(request.url()+': '+request.failure().errorText));
  await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
  await page.waitForFunction(()=>[...document.images].every(img=>img.complete&&img.naturalWidth>0));
  const active=()=>page.locator('.review-panel:not([hidden])');
  for(const id of ids){
   await page.locator(`[data-view="${id}"]`).click();
   await page.waitForFunction(id=>!document.getElementById(id).hidden,id);
   await page.waitForFunction(()=>window.scrollY===0);
   assert.equal(await active().count(),1);
   assert.equal(await page.locator('[aria-current="page"]').getAttribute('data-view'),id);
   const svg=fs.readFileSync(path.join(__dirname,'figures',id+'.svg'),'utf8');
   const image=await sharp(path.join(__dirname,'figures',id+'.png')).metadata();
   assert(svg.includes(`viewBox="0 0 ${image.width} ${image.height}"`),'PNG / SVG 尺寸不一致');
   assert.equal(await active().locator('.downloads a').count(),2);
   assert.equal(await active().locator('img').evaluate(img=>img.naturalWidth),image.width);
   assert(await active().locator('h2').textContent());
  }
  await page.locator('[data-view="encounters"]').click();
  await page.waitForFunction(()=>!document.getElementById('encounters').hidden);
  const details=active().locator('details');
  await details.nth(0).locator('summary').click();assert.equal(await details.nth(0).locator('tbody tr').count(),41);
  await details.nth(1).locator('summary').click();assert.equal(await details.nth(1).locator('tbody tr').count(),24);
  await page.locator('#actual').click();
  assert((await active().locator('img').getAttribute('style')).includes('1866px'));
  await page.locator('#zoom').fill('200');assert.equal(await page.locator('#zoomValue').textContent(),'200%');
  await page.locator('#fit').click();assert.equal(await page.locator('#zoomValue').textContent(),'100%');
  await page.locator('[data-view="bank"]').click();await page.reload();
  assert.equal(await active().getAttribute('id'),'bank');assert((await page.title()).includes('银行旧址'));
  await page.goBack();await page.waitForFunction(()=>!document.getElementById('encounters').hidden);
  await page.goForward();await page.waitForFunction(()=>!document.getElementById('bank').hidden);
  const output=path.join(__dirname,'review-tests');fs.mkdirSync(output,{recursive:true});
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(output,'desktop.png')});
  for(const width of [390,320]){
   await page.setViewportSize({width,height:844});
   for(const id of ['overview','bank','encounters']){
    await page.locator(`[data-view="${id}"]`).click();await page.waitForFunction(id=>!document.getElementById(id).hidden,id);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'页面横向溢出 '+id+' / '+width);
   }
   if(width===390){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(output,'mobile.png')});}
  }
  assert.deepEqual(errors,[]);
  console.log('OK: 7 组 PNG/SVG、离线图片、导航、深链接与刷新、前进后退、缩放、41/24 点位表、320/390px 布局、无浏览器错误');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
