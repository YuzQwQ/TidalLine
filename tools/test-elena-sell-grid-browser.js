/* 伊莲娜出售页：首次打开时格子必须已经按真实容器尺寸排好。
   node tools/test-elena-sell-grid-browser.js

   回归背景：伊莲娜默认进入「私人委托」，该页把整块商品目录隐藏。切到「出售」时，
   若 MerchantSales 在 display:none 的容器里先算 gridMetrics，clientWidth/Height 为 0，
   会退化成 2 列 → 一页 4 个 300px+ 的大格子，图标也随之被撑到上限；
   翻页 / 筛选标签触发重排后才恢复。这里断言「首次 == 任意动作后」。 */
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),{pathToFileURL}=require('url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'design/ui/elena-sell-grid-v1');
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>{if(e)return res.writeHead(404).end();const ext=path.extname(f);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.json':'application/json'})[ext]||'text/html;charset=utf-8');res.end(b);});});

const snapshot=()=>{
 const grid=document.getElementById('stashGrid'),cells=[...grid.querySelectorAll('.scell')];
 const filled=cells.find(c=>!c.classList.contains('empty')),img=filled?.querySelector('img,.gl');
 const w=e=>e?+e.getBoundingClientRect().width.toFixed(1):null;
 return {cols:Number(grid.style.getPropertyValue('--cols')),per:Base._per,
  gridW:grid.clientWidth,gridH:grid.clientHeight,cells:cells.length,
  cellW:w(cells[0]),imgW:w(img),
  catalogHidden:document.querySelector('.mb-catalog').hidden,
  key:MerchantUI.key,mode:MerchantUI.mode};
};

(async()=>{fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const checks=[];const ok=(name,cond,extra)=>{checks.push([name,!!cond,extra||'']);assert.ok(cond,name+' '+(extra||''));};
 try{
  for(const offline of [false,true]){
   const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],failed=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))failed.push(r.url());});
   const url=(offline?pathToFileURL(path.join(root,'潮汐线.html')).href:'http://127.0.0.1:'+server.address().port+'/index.html')+'#base';
   await page.goto(url);
   await page.waitForFunction(()=>typeof MerchantSales!=='undefined'&&typeof ElenaUI!=='undefined'&&Game.state==='base'&&Safehouse.root);
   /* 40 件真实物品：保证桌面和窄屏都有第二页可翻 */
   await page.evaluate(()=>{
    Save.stash=ITEMS.filter(it=>!it.equip&&it.cat!=='key'&&!it.noLoot).slice(0,40).map(it=>({id:it.id,n:1}));
    Save.credits=1e7;Base.render();
   });
   const tag=offline?'offline':'dev';
   for(const [width,height] of [[1440,900],[1280,800],[390,844]]){
    await page.setViewportSize({width,height});
    await page.waitForTimeout(60);
    for(const route of ['direct','personal','commissions-back','other-merchant']){
     await page.evaluate(()=>Safehouse.route('traders'));
     const key=route==='other-merchant'?'viktor':'elena';
     await page.locator('[data-mb-open="'+key+'"]').click();
     if(route==='personal')await page.locator('[data-mb-mode="personal"]').click();
     if(route==='commissions-back'){
      await page.locator('[data-mb-mode="sell"]').click();
      await page.locator('[data-mb-mode="commissions"]').click();
     }
     await page.locator('[data-mb-mode="sell"]').click();
     const first=await page.evaluate(snapshot),prefix=tag+' '+width+' '+route;
     ok(prefix+' catalog visible',first.catalogHidden===false,JSON.stringify(first));
     ok(prefix+' grid measured',first.gridW>0&&first.gridH>0,JSON.stringify(first));
     ok(prefix+' not collapsed to 2 columns',first.cols>=3,JSON.stringify(first));
     ok(prefix+' cell size',first.cellW>40&&first.cellW<=140,JSON.stringify(first));
     ok(prefix+' icon size',first.imgW>20&&first.imgW<=76,JSON.stringify(first));
     ok(prefix+' page filled',first.cells===first.per&&first.per>=6,JSON.stringify(first));
     if(!offline&&width===1440&&route==='direct')await page.screenshot({path:path.join(out,'first-open.png')});
     if(offline&&width===1440&&route==='direct')await page.screenshot({path:path.join(out,'offline-first-open.png')});

     /* 用户描述的三类动作：筛选标签、排序、翻页 */
     const actions=[];
     await page.locator('[data-ms-cat="collectibles"]').click();
     actions.push(['filter',await page.evaluate(snapshot)]);
     await page.locator('[data-ms-cat="all"]').click();
     actions.push(['filter-back',await page.evaluate(snapshot)]);
     await page.locator('[aria-label="出售排序"]').selectOption('name');
     actions.push(['sort',await page.evaluate(snapshot)]);
     await page.locator('[aria-label="出售排序"]').selectOption('sellableValue');
     if(await page.locator('#stashPager [data-p="1"]').count()){
      await page.locator('#stashPager [data-p="1"]').click();
      actions.push(['page',await page.evaluate(snapshot)]);
     }
     for(const [name,s] of actions){
      ok(prefix+' '+name+' cols stable',s.cols===first.cols,JSON.stringify([first,s]));
      ok(prefix+' '+name+' cell stable',Math.abs(s.cellW-first.cellW)<=2,JSON.stringify([first,s]));
      ok(prefix+' '+name+' icon stable',Math.abs(s.imgW-first.imgW)<=2,JSON.stringify([first,s]));
     }
     ok(prefix+' actions',actions.length>=4,JSON.stringify(actions.map(a=>a[0])));
    }
   }
   ok(tag+' no page errors',errors.length===0,errors.join(' | '));
   ok(tag+' no failed requests',failed.length===0,failed.join(' | '));
   await page.close();
  }
  console.log('PASS elena sell grid: '+checks.length+' checks, development + offline, 3 viewports, 4 entry routes');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
