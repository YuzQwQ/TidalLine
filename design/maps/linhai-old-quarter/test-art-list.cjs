/* 清单覆盖范围、已有资源预览与离线导航验证；需要 playwright + Edge。 */
const assert=require('assert/strict');
const path=require('path');
const fs=require('fs');
const {pathToFileURL}=require('url');
const {chromium}=require('playwright');
const status=require('./tile-art-status.json');
const layout=require('./layout.json');
(async()=>{
 assert.equal(status.stats.requiredFiles,18);assert.equal(status.stats.requiredGroundFiles,8);assert.equal(status.stats.requiredOverlayFiles,10);
 assert.equal(status.core.flatMap(a=>a.files).length,18);
 assert(status.reuse.every(group=>group.files.every(file=>file.exists)));
 for(const building of status.futureBuildings){const b=layout.buildings.find(b=>b.id===building.id);assert.deepEqual(building.pixels,[(b.rect[2]-b.rect[0]+1)*32,(b.rect[3]-b.rect[1]+1)*32]);}
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('requestfailed',r=>errors.push(r.url()));
  await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
  await page.locator('nav a[href="art-requirements.html"]').click();
  await page.waitForFunction(()=>[...document.images].every(img=>img.complete&&img.naturalWidth>0));
  assert.equal(await page.locator('#core .asset-card').count(),18);
  assert.equal(await page.locator('#core .made-previews').count(),status.stats.requiredVerifiedFiles);
  assert.equal(await page.locator('#reuse img').count(),24);
  assert(await page.locator('#core').innerText().then(s=>s.includes('统一复用 assets/tiles/wall.png')));
  for(const tab of ['reuse','optional','buildings','props','core']){
   await page.locator(`[data-tab="${tab}"]`).click();await page.waitForFunction(tab=>!document.getElementById(tab).hidden,tab);
   assert.equal(await page.locator('.art-panel:not([hidden])').count(),1);
   assert.equal(await page.locator('[data-tab][aria-current="page"]').getAttribute('data-tab'),tab);
  }
  assert.equal(await page.locator('#optional tbody tr').count(),10);assert.equal(await page.locator('#buildings tbody tr').count(),5);assert.equal(await page.locator('#props tbody tr').count(),7);
  const out=path.join(__dirname,'review-tests');fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'art-list-desktop.png')});
  await page.locator('[data-tab="reuse"]').click();await page.reload();assert.equal(await page.locator('.art-panel:not([hidden])').getAttribute('id'),'reuse');
  for(const width of [390,320]){
   await page.setViewportSize({width,height:844});
   for(const tab of ['core','reuse','buildings']){
    await page.locator(`[data-tab="${tab}"]`).click();await page.waitForFunction(tab=>!document.getElementById(tab).hidden,tab);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),tab+' 横向溢出 '+width);
   }
   if(width===390){await page.locator('[data-tab="core"]').click();await page.screenshot({path:path.join(out,'art-list-mobile.png')});}
  }
  assert.deepEqual(errors,[]);
  console.log('OK: 18 张必画、24 文件复用预览、地形覆盖、5 栋像素尺寸、7 类配套物件、离线导航与刷新、320/390px 页面，无浏览器错误');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
