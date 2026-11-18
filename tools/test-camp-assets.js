/* 围栏区新增素材：真实编辑器放置/旋转/保存，以及帐篷边界运动和寻路回归。 */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('playwright'),{pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..'),lib=require('../design/maps/shared/scene-library.js');
const Core=require('../design/maps/shared/map-core.js'),Tpl=require('../design/maps/shared/map-templates.js');
const ids=['fence_chainlink','fence_chainlink_post','fence_gate_closed','fence_gate_half_open','tent_relief','supply_tarp_stack'];
const assets=lib.placeables.filter(a=>ids.includes(a.id));assert.equal(assets.length,6);
const file=f=>pathToFileURL(path.join(root,f)).href;
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true});
 try{
  const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(file('design/maps/editor/index.html'));await p.waitForFunction(()=>window.__editor);
  await p.evaluate(data=>__editor.apply({data,rules:{},source:'camp-assets-test'},{silent:true}),Tpl.create({id:'camp-assets-test',width:48,height:36,template:'blank'}).data);
  for(let i=0;i<ids.length;i++){
   const id=ids[i],button=p.locator('[data-key="prop:prop.'+id+'"]');await button.evaluate(e=>e.click());await button.locator('img').evaluate(im=>im.decode());
   await p.evaluate(({id,i})=>{let result;const E=__editor,n=E.store.get().data.props.length;
    E.history.apply('放置营地素材',d=>{result=E.tools.place(d,E.store.get().material,5+(i%4)*7,6+Math.floor(i/4)*7);});if(!result.ok)throw Error(id+': '+result.reason);
    E.history.undo();if(E.store.get().data.props.length!==n)throw Error('撤销失败');E.history.redo();
   },{id,i});
  }
  const data=await p.evaluate(()=>{
   const E=__editor,d=E.store.get().data;
   for(const type of ['fence_chainlink','tent_relief']){
    const item=d.props.find(p=>p.type===type),sel={kind:'prop',id:item.id};let result;
    E.history.apply('切换纵向',d=>{result=E.tools.rotateEntity(d,sel);});if(!result.ok)throw Error(result.reason);
    const side=E.store.get().data.props.find(p=>p.id===item.id);
    if(MapArtMap.propVariant(side,side.facing)!==type+'_side')throw Error('没有切换方向图');
    if(type==='tent_relief'&&(side.footprint.join(',')!=='2,3'||side.visual.join(',')!=='2,3.5'||side.collisionRects[0][2]!==.0625))throw Error('帐篷纵向规则错误');
    if(type==='fence_chainlink'&&side.visual.join(',')!=='1,2.5')throw Error('围栏纵向尺寸错误');
    E.history.apply('恢复横向',d=>E.tools.rotateEntity(d,sel));
   }
   for(const [ch,x,y]of [['5',22,18],['6',23,18],['8',25,18],['8',26,18],['9',29,18],['9',30,18]])E.history.apply('新地形',d=>{if(!E.tools.setTerrain(d,x,y,ch))throw Error('地形不可刷 '+ch);});
   const text=MapCore.serialize(E.store.get().data);E.apply({data:MapCore.parse(text),rules:{},source:'saved-reopened'},{silent:true});return E.store.get().data;
  });
  assert.equal(data.props.length,6);
  for(const ch of ['5','6','8','9'])assert(data.legend[ch]);
  const tent=data.props.find(p=>p.type==='tent_relief');assert.deepEqual(tent.collisionCells,[]);assert.deepEqual(tent.footprint,[3,2]);
  assert(Core.propBoundaryBlocked(data,tent.x+1,tent.y-1,tent.x+1,tent.y));
  assert(!Core.propBoundaryBlocked(data,tent.x-1,tent.y,tent.x,tent.y));
  await p.waitForTimeout(400);await p.screenshot({path:path.join(root,'assets/source/tent-batch-01/editor-loaded.png')});
  const terrain=Object.fromEntries(Object.entries(data.legend).map(([ch,r])=>[ch,{art:r.art||'low',solid:r.solid===true||ch==='#',blocked:!r.walkable,opaque:r.opaque}]));
  const map={...data,terrain,terrainRows:data.rows,tideEnabled:false,doors:[],overlays:[],props:data.props.map(p=>({...p,art:p.type}))};
  for(const entry of ['index.html','潮汐线.html']){
   await p.goto(file(entry)+'#base');await p.waitForFunction(ids=>typeof Art!=='undefined'&&ids.every(id=>Art.get('props',id)),[...ids,'fence_chainlink_side','tent_relief_side']);
   await p.evaluate(async map=>{
    M.load(map.rows,{},map.props,map);for(const a of ['wall_brick','wall_brick_face_s','wall_brick_face_e','wall_concrete','wall_concrete_face_s','wall_concrete_face_e','ground_gravel_01','ground_gravel_02']){const im=Art.get('tiles',a);if(!im)throw Error('地形未加载 '+a);await im.decode();}
    const t=map.props.find(p=>p.type==='tent_relief'),TS=CFG.TILE,x=(t.x+1.5)*TS,y=(t.y+1)*TS;
    if(!canStand(x,y,8)||!canStand((t.x-.1)*TS,y,8))throw Error('帐篷内部/入口不可进入');
    if(canStand(x,(t.y+.03)*TS,8))throw Error('帐篷长边未阻挡');
    const actor={x,y:(t.y-.5)*TS,r:8};moveEntity(actor,0,TS);if(actor.y>=t.y*TS)throw Error('实际移动穿过长边');
    const entrant={x:(t.x-.5)*TS,y,r:8};moveEntity(entrant,TS,0);if(entrant.x<(t.x+.4)*TS)throw Error('实际移动不能穿过短边');
    const route=M.findPath(t.x+1,t.y-1,t.x+1,t.y);if(!route||route.length<4)throw Error('寻路未绕过长边');
    if(M.lineOfSight(t.x+1,t.y-1,t.x+1,t.y))throw Error('视线穿过帐篷长边');
    for(const [ch,mat]of [['8','wall_brick'],['9','wall_concrete']]){const x=map.rows[18].indexOf(ch);if(!M.wallCell(M.at(x,18))||M.walkable(x,18))throw Error('新墙体实体错误');const calls=[];const c={drawImage:im=>calls.push(im),fillRect(){}};Art.drawWallFaces(c,0,0,32,{south:true,east:true},mat);if(!calls.includes(Art.get('tiles',mat+'_face_s'))||!calls.includes(Art.get('tiles',mat+'_face_e')))throw Error('墙体未使用对应立面');}
   },map);
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(root,'assets/source/tent-batch-01/integration.json'),JSON.stringify({status:'passed',checks:['all-new-prop-thumbnails','place-undo-redo','fence-and-tent-direction','save-reopen','gravel-and-walls-paint','tent-short-end-entry','tent-long-edge-collision','actual-actor-movement','pathfinding-detour','line-of-sight','wall-material-faces','development-and-offline']},null,2)+'\n');
  console.log('PASS: 围栏/大门/帐篷/物资堆、碎石与墙体入库；方向/保存/运动碰撞/寻路/视线/开发与离线加载');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
