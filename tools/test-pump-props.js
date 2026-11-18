/* 泵房组件：调色板 → 放置/撤销/保存 → 开发版与离线版，绘制放大不扩大碰撞。 */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {pathToFileURL}=require('url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'assets/source/pump-batch-01');
const assets=require('../design/maps/shared/scene-library.js').placeables.filter(a=>['pump_body','pump_motor','pump_valve_pipe','pump_control_box'].includes(a.id));
assert.equal(assets.length,4);
const data=require('../design/maps/shared/map-templates.js').create({id:'pump-props-test',width:40,height:30,template:'blank'}).data;
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1400,height:950}});
  await page.goto(pathToFileURL(path.join(root,'design/maps/editor/index.html')).href);
  await page.waitForFunction(()=>window.__editor&&window.SceneLibrary);
  await page.evaluate(data=>__editor.apply({data,rules:{},source:'pump-test'},{silent:true}),data);
  for(let i=0;i<assets.length;i++){
   const a=assets[i],button=page.locator('[data-key="prop:prop.'+a.id+'"]');
   await button.evaluate(e=>e.click());
   await button.locator('img').evaluate(img=>img.decode());
   const result=await page.evaluate(({a,i})=>{
    const E=__editor,before=E.store.get().data.props.length;let placed;
    E.history.apply('放置泵房组件',d=>{placed=E.tools.place(d,E.store.get().material,5+i*3,6);});
    if(!placed.ok)throw Error(placed.reason);
    const p=E.store.get().data.props.at(-1);
    E.history.undo();const undone=E.store.get().data.props.length===before;
    E.history.redo();return {type:p.type,visual:p.visual,footprint:p.footprint,undone,redone:E.store.get().data.props.length===before+1};
   },{a,i});
   assert.equal(result.type,a.id);assert.deepEqual(result.visual,a.paint.visual);assert.deepEqual(result.footprint,[1,1]);assert(result.undone&&result.redone);
  }
  const props=await page.evaluate(()=>{
   const E=__editor,text=MapCore.serialize(E.store.get().data);
   E.apply({data:MapCore.parse(text),rules:{},source:'pump-reopened'},{silent:true});
   return E.store.get().data.props;
  });
  assert.equal(props.length,4);
  for(const a of assets)assert.deepEqual(props.find(p=>p.type===a.id).visual,a.paint.visual);
  await page.screenshot({path:path.join(folder,'editor-loaded.png')});
  for(const entry of ['index.html','潮汐线.html']){
   await page.goto(pathToFileURL(path.join(root,entry)).href+'#base');
   await page.waitForFunction(ids=>typeof Art!=='undefined'&&ids.every(id=>Art.get('props',id)),assets.map(a=>a.id));
   const result=await page.evaluate(async ({props,rows})=>{
    M.load(rows,{},props);const out=[];
    for(const p of props){
     p.art=p.type;const im=Art.prop(p);await im.decode();const r=Art.propRect(p,im,32);
     if(M.walkable(p.x,p.y)||!M.blocksShot(p.x,p.y)||M.at(p.x,p.y).container)throw Error('组件实体规则错误 '+p.type);
     if(!M.walkable(p.x,p.y-1)||!M.walkable(p.x+1,p.y))throw Error('绘制盒扩大了碰撞 '+p.type);
     if(M.propCollisionCells(p).length!==1)throw Error('碰撞不是单格 '+p.type);
     if(Math.abs(r.w/r.h-r.sw/r.sh)>1e-9||r.w>p.visual[0]*32||r.h>p.visual[1]*32)throw Error('绘制比例/大小错误 '+p.type);
     out.push(p.type);
    }return out;
   },{props,rows:data.rows});
   assert.equal(result.length,4);
  }
  fs.writeFileSync(path.join(folder,'integration.json'),JSON.stringify({status:'passed',date:'2026-11-13',ids:assets.map(a=>a.id),checks:['palette-thumbnail','place','undo-redo','save-reopen','single-cell-collision','proportional-small-visual','development-assets','offline-assets']},null,2)+'\n');
  console.log('PASS: 四件泵房组件缩略图、放置/撤销/保存重开、一格碰撞、小尺寸比例与开发/离线加载');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
