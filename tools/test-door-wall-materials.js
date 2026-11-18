const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),http=require('http');
const {chromium}=require('playwright'),{pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..'),Core=require('../design/maps/shared/map-core.js'),Tpl=require('../design/maps/shared/map-templates.js'),lib=require('../design/maps/shared/scene-library.js');
const ctx=vm.createContext({MapCore:Core,MapTemplates:Tpl,SceneLibrary:lib,MapArtMap:require('../design/maps/shared/map-art-map.js')});ctx.window=ctx;
vm.runInContext(fs.readFileSync(path.join(root,'design/maps/editor/tools.js'),'utf8'),ctx);
const d=Tpl.create({id:'door-materials',width:40,height:30,template:'blank'}).data,T=ctx.EditorTools;
for(const [ch,x,y,axis]of [['8',8,6,'horizontal'],['9',8,14,'horizontal'],['8',20,6,'vertical'],['9',28,6,'vertical']]){
 for(let i=-3;i<=3;i++)T.setTerrain(d,x+(axis==='horizontal'?i:0),y+(axis==='vertical'?i:0),ch);
 const r=T.placePortal(d,x,y,'door');assert(r.ok,r.reason);
 const p=d.portals.find(p=>p.id===r.id),mat=ch==='8'?'wall_brick':'wall_concrete';
 assert.equal(Core.doorAxis(d,p),axis);assert.equal(Core.doorMaterial(d,p),mat);assert.equal(p.wallCh,ch);
 const reopened=Core.parse(Core.serialize(d));assert.equal(Core.doorMaterial(reopened,reopened.portals.at(-1)),mat);
 assert(T.removeAt(reopened,x,y).ok);assert.equal(reopened.rows[y][x],ch,'删除门洞应恢复原墙体');
}
// 旧地图里的门没有新增字段，也必须从新墙邻格识别轴向和材质。
for(const p of d.portals){const old={...p};delete old.wallMaterial;delete old.wallCh;delete old.axis;assert.equal(Core.doorAxis(d,old),p.axis);assert.equal(Core.doorMaterial(d,old),p.wallMaterial);}
const original=require('../design/maps/linhai-old-quarter/layout.json');
for(const mat of ['wall_brick','wall_concrete']){
 const draft=Core.clone(original),p=draft.portals.find(p=>p.kind==='door'),ch=mat==='wall_brick'?'8':'9';draft.legend[ch]=lib.terrains.find(a=>a.id===mat).rule;
 for(const [x,y]of p.cells)for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]])if(Core.isWallTerrain(draft,x+dx,y+dy))draft.rows[y+dy]=draft.rows[y+dy].slice(0,x+dx)+ch+draft.rows[y+dy].slice(x+dx+1);
 const compiled=require('./build-linhai-map.js').compile(draft);assert.equal(compiled.doors.find(q=>q.id===p.id).wallMaterial,mat);
}
(async()=>{
 const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':f.endsWith('.png')?'image/png':'text/html;charset=utf-8'}).end(b));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(pathToFileURL(path.join(root,'design/maps/editor/index.html')).href);await p.waitForFunction(()=>window.__editor);
  await p.evaluate(data=>__editor.apply({data,rules:{},source:'door-materials'},{silent:true}),d);
  await p.waitForTimeout(500);await p.screenshot({path:path.join(root,'assets/source/wall-batch-03/door-editor.png')});
  for(const entry of ['index.html','潮汐线.html']){
   await p.goto((entry==='index.html'?origin+'/index.html':pathToFileURL(path.join(root,entry)).href)+'#doors-test');await p.waitForFunction(()=>typeof DoorSystem!=='undefined'&&Art.get('tiles','wall_brick_face_s')&&Art.get('tiles','wall_concrete'));
   await p.evaluate(async()=>{
    Game.state='ended';Game.enemies=[];Game.boxes=[];Game.corpses=[];
    for(const id of ['wall_brick','wall_brick_face_s','wall_brick_face_e','wall_concrete','wall_concrete_face_s','wall_concrete_face_e'])await Art.get('tiles',id).decode();
    const proof=document.createElement('canvas');proof.width=640;proof.height=320;const pc=proof.getContext('2d');pc.imageSmoothingEnabled=false;pc.fillStyle='#1b2c24';pc.fillRect(0,0,640,320);
    for(let m=0;m<2;m++)for(let a=0;a<2;a++)for(let state=0;state<2;state++){
     const mat=m?'wall_concrete':'wall_brick',axis=a?'vertical':'horizontal';
     const rows=Array.from({length:9},()=>Array(10).fill('.'));for(let i=1;i<=7;i++)rows[a?i:4][a?4:i]='#';rows[4][4]='+';
     M.load(rows.map(r=>r.join('')),{},[]);M.tideEnabled=false;M.map={id:'material-proof',props:[]};
     for(const row of M.grid)for(const t of row)if(t.solid)t.art=mat;
     const door={id:'material-door',x:4,y:4,cells:[[4,4]],axis,open:!!state};M.doors=[door];M.at(4,4).door=door;M.visible.fill(1);M.seen.fill(1);Game.player.x=M.cx(4);Game.player.y=M.cy(3);
     if(DoorSystem.wallMaterial(door,4,4)!==mat||DoorSystem.wallTop(door,4,4)!==Art.get('tiles',mat))throw Error('门洞没有继承墙体材质');
     const cv=document.createElement('canvas');cv.width=320;cv.height=288;const c=cv.getContext('2d');c.imageSmoothingEnabled=false;
     Game.renderTerrain(c,0,0);
     let materialSeen=false;const draw=Art.drawWallFaces,side=DoorVisual.sidePortal;
     Art.drawWallFaces=function(ctx,x,y,size,edges,material){if(x===128&&y===128){if(material!==mat)throw Error('门洞补绘仍为默认墙');materialSeen=true;}return draw.call(this,ctx,x,y,size,edges,material);};
     DoorVisual.sidePortal=function(ctx,rect,d,stone,material){if(material!==mat||stone!==Art.get('tiles',mat))throw Error('侧向门框材质错误');materialSeen=true;return side.call(this,ctx,rect,d,stone,material);};
     try{Game.renderObjects(c,0,0);Game.renderRaisedWalls(c,0,0,true);}finally{Art.drawWallFaces=draw;DoorVisual.sidePortal=side;}
     if(!materialSeen)throw Error('门洞未绘制');
     if(state&&!M.walkable(4,4)||!state&&M.walkable(4,4))throw Error('开关门碰撞错误');
     if(!a){
      const expected=document.createElement('canvas');expected.width=expected.height=32;const ec=expected.getContext('2d');ec.imageSmoothingEnabled=false;Art.drawWallFaces(ec,0,0,32,Art.wallEdges(4,4),mat);
      const actual=Array.from(c.getImageData(129,144,1,1).data).join(','),want=Array.from(ec.getImageData(1,16,1,1).data).join(',');if(actual!==want)throw Error('门外沿与新墙立面不一致');
     }
     const col=a*2+state;pc.drawImage(cv,80,64,96,128,col*160+32,m*160,96,128);pc.fillStyle='#d9decf';pc.font='12px sans-serif';pc.fillText((m?'水泥':'旧砖')+' / '+(a?'侧门':'正门')+' / '+(state?'开':'关'),col*160+10,m*160+149);
    }
    proof.id='material-proof';proof.style.cssText='position:fixed;left:0;top:0;width:1280px;height:640px;image-rendering:pixelated;z-index:2147483647';document.body.appendChild(proof);
   });
   await p.locator('#material-proof').screenshot({path:path.join(root,'assets/source/wall-batch-03/door-'+(entry==='index.html'?'runtime':'offline')+'.png')});
  }
  assert.deepEqual(errors,[]);console.log('PASS: 新墙体开门/恢复/旧门识别/编译/正侧门开关/材质补绘，编辑器与开发/离线一致');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
