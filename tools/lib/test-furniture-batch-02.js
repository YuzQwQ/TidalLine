const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'),folder=path.join(root,'assets/source/scene-furniture-batch-02'),m=require('../../assets/source/scene-furniture-batch-02/manifest.json'),lib=require('../../design/maps/shared/scene-library.js'),ArtMap=require('../../design/maps/shared/map-art-map.js'),Core=require('../../design/maps/shared/map-core.js'),Tpl=require('../../design/maps/shared/map-templates.js');
const fronts=m.assets.filter(a=>a.facing==='front');
function staticChecks(){
 assert.equal(m.assets.length,36);assert.equal(fronts.length,12);assert.equal(m.planned.length,10);
 const hashes=new Set();
 for(const a of m.assets){
  assert.equal(a.status,'ready');assert(fs.existsSync(path.join(folder,a.source)));assert(a.prompt&&a.originalSource);
  const bytes=fs.readFileSync(path.join(root,a.target)),hash=crypto.createHash('sha256').update(bytes).digest('hex');assert(!hashes.has(hash),a.id+'应为独立方向图');hashes.add(hash);
  const p=require('./png-read').read(path.join(root,a.target));assert.deepEqual([p.w,p.h],a.size);
  const colors=new Set();let n=0;for(let y=0;y<p.h;y++)for(let x=0;x<p.w;x++){const px=p.px[y][x];assert([0,255].includes(px[3]));if(px[3]){n++;assert(x>=2&&x<p.w-2&&y>=2&&y<p.h-2);colors.add(px.join(','));}}assert(n>20);assert(colors.size<=15);
  const reg=lib.assets.find(x=>x.id===a.id&&x.group==='props');assert(reg,a.id+'缺登记');
  assert.equal(reg.role,a.facing==='front'?'prop':'scene-component');assert.equal(ArtMap.resolveFacing(a.base,a.facing).art,a.id);assert(ArtMap.resolveFacing(a.base,a.facing).exact);
  assert.equal(!!reg.paint,a.facing==='front');if(reg.paint)assert.deepEqual(reg.paint.footprint,a.size.map(v=>v/32));
 }
 for(const a of m.planned)assert(!lib.placeables.some(x=>x.id===a.id),'未完成素材不可选');
 const base=require('../../assets/source/scene-furniture-batch-02/map-baseline.json');for(const [f,hash] of Object.entries(base)){let bytes;if(f.endsWith('.json'))bytes=fs.readFileSync(path.join(root,f));else bytes=fs.readFileSync(path.join(root,'js/data.js'),'utf8').match(new RegExp('/\\* BEGIN GENERATED '+f+' \\*/[\\s\\S]*?/\\* END GENERATED '+f+' \\*/'))[0];assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),hash,'正式地图变动 '+f);}
}
async function editorChecks(page){
 const fresh=Tpl.create({id:'furniture-batch-02',width:48,height:36,template:'blank'}).data;
 await page.evaluate(d=>__editor.apply({data:d,rules:{},source:'furniture-batch-02'},{silent:true}),fresh);
 for(let i=0;i<fronts.length;i++){
  const a=fronts[i],selector='[data-key="prop:prop.'+a.id+'"]';
  await page.locator(selector).evaluate(e=>e.click());
  const result=await page.evaluate(({id,x,y,fp})=>{const E=__editor,mat=E.store.get().material;if(mat.type!==id)throw Error('选材错误 '+id);const n=E.store.get().data.props.length;let placed;E.history.apply('家具放置',d=>{placed=E.tools.place(d,mat,x,y);});if(!placed.ok)throw Error(JSON.stringify(placed));const p=E.store.get().data.props.at(-1);const got={type:p.type,footprint:p.footprint};E.history.undo();const undone=E.store.get().data.props.length===n;E.history.redo();const redone=E.store.get().data.props.length===n+1;return {...got,undone,redone};},{id:a.id,x:5+(i%6)*6,y:6+Math.floor(i/6)*12,fp:a.size.map(v=>v/32)});
  assert.equal(result.type,a.id);assert.deepEqual(result.footprint,a.size.map(v=>v/32));assert(result.undone&&result.redone);
  const directions=await page.evaluate(id=>{const E=__editor,p=E.store.get().data.props.at(-1),sel={kind:'prop',id:p.id};let rotated;E.history.apply('转为侧面',d=>{rotated=E.tools.rotateEntity(d,sel);});const side=E.store.get().data.props.at(-1),sideArt=MapArtMap.propVariant(side,side.facing);E.history.undo();let back;E.history.apply('靠北墙放置',d=>{const r=E.tools.place(d,E.store.get().material,5,1);if(!r.ok)throw Error(r.reason);back=d.props.at(-1);});const backArt=MapArtMap.propVariant(back,back.facing);E.history.undo();return {rotated:rotated.ok,footprint:side.footprint,sideArt,backArt};},a.id);
  assert(directions.rotated);assert.deepEqual(directions.footprint,[a.size[1]/32,a.size[0]/32]);assert.equal(directions.sideArt,a.id+'_side');assert.equal(directions.backArt,a.id+'_back');
 }
 const result=await page.evaluate(()=>{const E=__editor,text=MapCore.serialize(E.store.get().data);E.apply({data:MapCore.parse(text),rules:{},source:'saved-and-reopened'},{silent:true});return E.store.get().data.props;});assert.equal(result.length,12);for(let i=0;i<fronts.length;i++)assert.equal(result[i].type,fronts[i].id);
 // Explicitly resolve and load every orientation, not just palette thumbnails.
 assert(await page.evaluate(async ids=>{for(const id of ids){const im=new Image();im.src='../../../assets/props/'+id+'.png';await im.decode();if(!im.naturalWidth)throw Error(id);}return true;},m.assets.map(a=>a.id)));
 await page.evaluate(()=>__editor.fit());
 await page.screenshot({path:path.join(folder,page.url().startsWith('file:')?'editor-file.png':'editor-http.png')});
 return result;
}
async function runtimeChecks(page){
 await page.waitForFunction(ids=>typeof Art!=='undefined'&&ids.every(id=>Art.get('props',id)),m.assets.map(a=>a.id));
 const result=await page.evaluate(async assets=>{
  const rows=Array.from({length:36},(_,y)=>Array.from({length:48},(_,x)=>!x||!y||x===47||y===35?'#':'.').join(''));rows[2]=rows[2].slice(0,2)+'P'+rows[2].slice(3);rows[33]=rows[33].slice(0,44)+'E'+rows[33].slice(45);
  const props=assets.map((a,i)=>({id:'test-'+a.id,art:a.base,facing:a.facing,x:3+(i%6)*7,y:5+Math.floor(i/6)*5,footprint:a.size.map(n=>n/32)}));
  M.load(rows,{},props);let cells=0;const out=[];
  const cv=document.createElement('canvas');cv.width=48*32;cv.height=36*32;const ctx=cv.getContext('2d');ctx.fillStyle='#22382b';ctx.fillRect(0,0,cv.width,cv.height);ctx.imageSmoothingEnabled=false;
  for(const p of props){const a=assets.find(a=>'test-'+a.id===p.id),im=Art.prop(p);if(!im||im!==Art.get('props',a.id))throw Error('运行时选图错误 '+a.id);await im.decode();if(im.naturalWidth!==a.size[0]||im.naturalHeight!==a.size[1])throw Error('原生尺寸错误 '+a.id);
   for(const [x,y] of M.propCells(p)){cells++;if(M.walkable(x,y)||!M.blocksShot(x,y)||!M.opaque(x,y)||M.at(x,y).container)throw Error('碰撞/搜索语义错误 '+a.id);}
   const r=Art.propRect(p,im,32);if(Math.abs(r.w/r.h-r.sw/r.sh)>1e-9||r.x<p.x*32||r.y<p.y*32||r.x+r.w>(p.x+p.footprint[0])*32||r.y+r.h>(p.y+p.footprint[1])*32)throw Error('绘制越出占地 '+a.id);
   ctx.drawImage(im,r.sx,r.sy,r.sw,r.sh,r.x,r.y,r.w,r.h);out.push(a.id);
  }
  // file://素材会污染Canvas，使用浏览器截图而非读取像素导出。
  cv.id='furniture-runtime-qa';cv.style.cssText='position:fixed;left:0;top:0;z-index:2147483647;width:1536px;height:1152px';document.body.append(cv);
  return {out,cells};
 },m.assets);
 assert.equal(result.out.length,36);assert.equal(result.cells,m.assets.reduce((s,a)=>s+a.size[0]*a.size[1]/1024,0));
 await page.locator('#furniture-runtime-qa').screenshot({path:path.join(folder,page.url().includes('%E6%BD%AE')?'runtime-offline.png':'runtime-dev.png')});
 await page.evaluate(()=>document.getElementById('furniture-runtime-qa').remove());
}
async function galleryChecks(page){
 const {pathToFileURL}=require('url');await page.goto(pathToFileURL(path.join(folder,'index.html')).href);
 await page.evaluate(()=>Promise.all([...document.images].map(im=>im.decode())));assert.equal(await page.locator('main article').count(),12);assert.equal(await page.locator('main img').count(),36);
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:950});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'图库横向溢出 '+width);if(width!==320)await page.screenshot({path:path.join(folder,'gallery-'+width+'.png'),fullPage:true});}
 await page.setViewportSize({width:1400,height:950});
}
module.exports={staticChecks,editorChecks,runtimeChecks,galleryChecks};
