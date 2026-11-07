const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),{pathToFileURL}=require('url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'assets/source/containers-batch-01');
async function main(){
 const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html;charset=utf-8');res.end(b);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true}).catch(e=>{server.close();throw e;}),results=[];
 try{
  for(const file of ['index.html','潮汐线.html']){
   const page=await browser.newPage({viewport:{width:1100,height:780}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(pathToFileURL(path.join(root,file)).href+'#doors-test');await page.waitForFunction(()=>typeof Art!=='undefined'&&Art.get('props','crate_weapons')&&Art.get('props','crate_equipment')&&Game.player);
   const r=await page.evaluate(()=>{
    const check=(c,m)=>{if(!c)throw Error(m);};Game.state='ended';
    M.load(['#########','#.......#','#.g.h...#','#...P...#','#########'],{},[]);
    for(const [x,ch] of [[2,'g'],[4,'h']]){check(!M.walkable(x,2),'container collision');check(!M.opaque(x,2),'container opacity');const t=CONTAINER_TYPES[ch],im=Art.get('props',t.art);check(im.naturalWidth===32&&im.naturalHeight===32,'sprite preload');for(let i=0;i<100;i++)check(Loot.fill(t.q,['odd'],t).every(e=>e.item),'runtime loot');}
    document.getElementById('doorTestControls')?.remove();const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#18221e';ctx.fillRect(0,0,320,180);ctx.drawImage(Art.get('props','crate_weapons'),16,16,128,128);ctx.drawImage(Art.get('props','crate_equipment'),176,16,128,128);canvas.id='specializedCrates';canvas.style.cssText='position:fixed;left:0;top:0;z-index:99999';document.body.append(canvas);
    return{spritePreload:true,collision:true,loot:true};
   });await page.locator('#specializedCrates').screenshot({path:path.join(out,file==='index.html'?'runtime.png':'offline-runtime.png')});assert.deepEqual(errors,[]);results.push({file,...r,errors});await page.close();
  }
  const p=await browser.newPage({viewport:{width:1400,height:900}});await p.goto('http://127.0.0.1:'+server.address().port+'/design/maps/editor/index.html');await p.waitForFunction(()=>window.__editor?.store.get().data);
  // Simulate an old saved map whose container catalog predates both new boxes.
  await p.evaluate(()=>{const data=MapTemplates.create({id:'specialized-crates',width:30,height:24,template:'blank'}).data;delete data.containerTypes.g;delete data.containerTypes.h;__editor.apply({data,rules:{},source:'old-map'},{silent:true});});
  for(const [ch,x] of [['g',8],['h',12]]){
   await p.locator('[data-key="container:type.'+ch+'"]').evaluate(e=>e.click());
   await p.evaluate(({ch,x})=>{const e=__editor;e.history.apply('放置容器',d=>{const r=e.tools.place(d,e.store.get().material,x,10);if(!r.ok)throw Error(r.reason);});if(!e.store.get().data.containers.some(c=>c.type===ch))throw Error('placement');e.history.undo();if(e.store.get().data.containers.some(c=>c.type===ch))throw Error('undo');e.history.redo();},{ch,x});
  }
  await p.evaluate(()=>{const e=__editor,saved=MapCore.serialize(e.store.get().data);e.apply({data:MapCore.parse(saved),rules:{},source:'reopen'},{silent:true});if(e.store.get().data.containers.map(c=>c.type).join(',')!=='g,h')throw Error('save reopen');});
  await p.screenshot({path:path.join(out,'editor.png')});await p.close();
  fs.writeFileSync(path.join(out,'browser-verification.json'),JSON.stringify({passed:true,results,editorOldMapPalette:true,placementUndoRedoSaveReopen:true},null,2)+'\n');console.log('PASS: container assets and loot in development/offline, one-cell collision, old-map editor palette, placement/undo/redo/save/reopen');
 }finally{await browser.close();server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
