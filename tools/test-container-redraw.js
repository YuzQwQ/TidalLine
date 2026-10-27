/* 17种容器：原稿、32px规格、游戏/离线版实际像素与清单共用资源。 */
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),http=require('http');
const sharp=require('sharp'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),manifest=require('../assets/container-redraw/manifest.json');
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.png')?'image/png':file.endsWith('.js')?'text/javascript':'text/html; charset=utf-8');res.end(b);});});
async function main(){
 const expected={};assert.equal(manifest.assets.length,17);
 for(const a of manifest.assets){
  assert.equal(a.status,'ready');assert(fs.existsSync(path.join(root,'assets/container-redraw',a.source)));
  const bytes=fs.readFileSync(path.join(root,a.target)),old=fs.readFileSync(path.join(root,'assets/container-redraw/previous',a.id+'.png'));
  assert(!bytes.equals(old),a.id+' must be redrawn');
  const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(info.width,32);assert.equal(info.height,32);
  const colours=new Set();let visible=0;
  for(let y=0;y<32;y++)for(let x=0;x<32;x++){const k=(y*32+x)*4,alpha=data[k+3];assert(alpha===0||alpha===255,a.id+' alpha');if(alpha){visible++;assert(x>=2&&x<30&&y>=2&&y<30,a.id+' margin');colours.add(data.subarray(k,k+3).toString('hex'));}else data[k]=data[k+1]=data[k+2]=0;}
  assert(visible>90);assert(colours.size<=15,a.id+' palette');expected[a.id]=Array.from(data);
 }
 console.log('OK: 17张原稿、旧图存档、全新像素、32×32、2px透明边、二值alpha、16色以内');
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const file of ['index.html','潮汐线.html']){
   await page.goto(origin+'/'+encodeURI(file)+'#base');await page.waitForFunction(ids=>ids.every(id=>Art.map['props/'+id]),Object.keys(expected));
   const loaded=await page.evaluate(ids=>Object.fromEntries(ids.map(id=>{const c=document.createElement('canvas');c.width=c.height=32;const cx=c.getContext('2d');cx.drawImage(Art.map['props/'+id],0,0);return[id,Array.from(cx.getImageData(0,0,32,32).data)];})),Object.keys(expected));
   assert.deepEqual(loaded,expected,file+' sprites');
   if(file==='潮汐线.html')assert(await page.evaluate(ids=>ids.every(id=>window.__SPRITES__['props/'+id].startsWith('data:image/png;base64,')),Object.keys(expected)));
   console.log('OK: '+file+' 实际加载17张新贴图，逐像素一致');
  }
  await page.goto(origin+'/wiki.html#containers');await page.waitForFunction(()=>[...document.querySelectorAll('#containers img')].every(i=>i.complete&&i.naturalWidth));
  for(const a of manifest.assets)assert.equal(await page.locator('#containers img[src="assets/props/'+a.id+'.png"]').count(),1);
  await page.goto(origin+'/assets/container-redraw/index.html');await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth));assert.equal(await page.locator('article').count(),17);
  for(const width of [1280,390,320]){await page.setViewportSize({width,height:960});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  fs.mkdirSync(path.join(root,'output/container-redraw'),{recursive:true});await page.setViewportSize({width:1280,height:960});await page.screenshot({path:path.join(root,'output/container-redraw/comparison.png'),fullPage:true});assert.deepEqual(errors,[]);
  console.log('OK: Wiki17种共用贴图、对比页全部图片、320/390px布局、浏览器无异常');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
