const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),{pathToFileURL}=require('url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'assets/source/doors-batch-05');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':f.endsWith('.png')?'image/png':'text/html;charset=utf-8'}).end(b));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const b=await chromium.launch({channel:'msedge',headless:true}),results=[];try{for(const file of ['index.html','潮汐线.html']){
  const p=await b.newPage({viewport:{width:1280,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto((file==='index.html'?'http://127.0.0.1:'+server.address().port+'/index.html':pathToFileURL(path.join(root,file)).href)+'#doors-test');await p.waitForFunction(()=>document.getElementById('doorTestControls')&&Art.get('tiles','wall_face_s')&&Art.get('props','door'));
  const r=await p.evaluate(()=>{
   Game.state='ended';Game.enemies=[];Game.boxes=[];Game.corpses=[];
   M.load(RAID_MAP.rows,RAID_MAP.doorAxes,RAID_MAP.props,RAID_MAP);
   const deployed=M.doors.filter(d=>d.axis==='vertical'&&d.cells.length===1);if(!deployed.length||deployed.some(d=>!DoorSystem.isStudy(d)))throw Error('production map did not enable approved side portals');
   let deployedDraws=0;const drawStudy=DoorSystem.drawStudy;DoorSystem.drawStudy=function(...args){deployedDraws++;return drawStudy.apply(this,args);};try{Game.renderObjects(Game.ctx,0,0);}finally{DoorSystem.drawStudy=drawStudy;}if(deployedDraws!==deployed.length)throw Error('production render still uses legacy side sprites');
   const rows=Array.from({length:10},()=>Array(10).fill('.'));for(let y=1;y<9;y++)rows[y][5]='#';rows[5][5]='+';M.load(rows.map(r=>r.join('')),null,[],null);M.map={id:'portal-review',props:[]};M.tideEnabled=false;const d={id:'study-v',x:5,y:5,cells:[[5,5]],axis:'vertical',open:false};M.doors=[d];M.at(5,5).door=d;M.visible.fill(1);M.seen.fill(1);
   const canvas=document.createElement('canvas');canvas.width=canvas.height=320;const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
   const proof=document.createElement('canvas');proof.width=288;proof.height=128;const pc=proof.getContext('2d');pc.imageSmoothingEnabled=false;
   const pix=(ctx,x,y)=>Array.from(ctx.getImageData(x,y,1,1).data).join(',');
   const floor=document.createElement('canvas');floor.width=floor.height=32;const fc=floor.getContext('2d');fc.drawImage(DoorSystem.floorImage(d,5,5),0,0,32,32);
   const rect=Art.doorRect(d,Art.door(d),5,5,32);if(rect.y!==160||rect.h!==32||rect.lift!==0)throw Error('portal must stay in logical tile');
   if(Art.wallEdges(5,4).south)throw Error('north wall must retain full coping');
   const ground=DoorVisual.sideGroundRect(rect),mask=document.createElement('canvas');mask.width=mask.height=320;const mc=mask.getContext('2d');mc.imageSmoothingEnabled=false;mc.drawImage(Art.get('props','door'),ground.sx,ground.sy,ground.sw,ground.sh,ground.x,ground.y,ground.w,ground.h);if(ground.hingeX!==176||ground.x!==176||ground.sx!==8||ground.sy!==7||ground.sw!==16||ground.sh!==23)throw Error('hinge does not align with closed post');let floorPixels=0,framePixels=0;
   let closedCenter,closedFrame;for(const open of [false,true]){
    d.open=open;c.clearRect(0,0,320,320);Game.renderTerrain(c,0,0);const above=pix(c,176,152);Game.renderObjects(c,0,0);Game.renderRaisedWalls(c,0,0,true);
    if(pix(c,176,152)!==above)throw Error('portal repainted north tile');
    const center=pix(c,176,176),frame=pix(c,176,162);if(open){if(center===closedCenter||frame!==closedFrame)throw Error('leaf/frame state unclear');for(let y=5;y<27;y++)for(let x=0;x<32;x++){const alpha=mc.getImageData(160+x,160+y,1,1).data[3];const nearFrame=Array.from(mc.getImageData(159+x,159+y,3,3).data).some((v,i)=>i%4===3&&v>0);if(!nearFrame){floorPixels++;if(pix(c,160+x,160+y)!==pix(fc,x,y))throw Error('wall remains beneath ground frame '+JSON.stringify({x,y,actual:pix(c,160+x,160+y),expected:pix(fc,x,y)}));}else if(pix(c,160+x,160+y)!==pix(fc,x,y))framePixels++;}if(floorPixels<200||framePixels<200)throw Error('ground frame/passable floor not visible');if(!M.walkable(5,5)||M.blocksShot(5,5))throw Error('open collision');}else{closedCenter=center;closedFrame=frame;if(center===pix(fc,16,16)||M.walkable(5,5)||!M.blocksShot(5,5))throw Error('closed leaf/collision');}
    const walker={x:144,y:176,r:7};moveEntity(walker,64,0);if(open?walker.x<207:walker.x>153)throw Error('ground frame changed player passage');
    pc.drawImage(canvas,4*32,3*32,96,128,open?144:0,0,96,128);
   }
   // A blocked east floor switches the same unmirrored sprite west, on the same hinge.
   M.at(6,5).solid=true;d.open=true;let drawnX=null;const draw=c.drawImage;c.drawImage=function(...a){if(a[0]===Art.get('props','door'))drawnX=a[5];return draw.apply(this,a);};DoorSystem.drawStudyGround(c,d,32,0,0);c.drawImage=draw;const west=DoorVisual.sideGroundRect(rect,true);if(drawnX!==west.x||west.x+west.w!==176)throw Error('west swing hinge');M.at(6,5).solid=false;
   // Passage remains occluded by a closed logical door even with simplified art.
   d.open=false;M.computeFOV(3,5,8);if(M.raw[M.idx(7,5)])throw Error('closed door leaked sight');d.open=true;M.computeFOV(3,5,8);if(!M.raw[M.idx(7,5)])throw Error('open door blocks sight');
   proof.id='portalReview';proof.style.cssText='position:fixed;left:0;top:0;z-index:10000;width:864px;height:384px;image-rendering:pixelated;background:#15221b';document.body.appendChild(proof);
   return{productionSidePortals:deployedDraws,height:32,northSouthJambs:true,frameOpaque:true,floorUnderGroundFrame:true,groundDoorPanelVisible:true,frameExcludedFromCrop:true,hingeAligned:true,playerPassesOverGroundLayer:true,westSwing:true,noNorthTileRepaint:true,northWallFullCoping:true,collisionAndSight:true};
  });assert.deepEqual(errors,[]);await p.locator('#portalReview').screenshot({path:path.join(out,file==='index.html'?'runtime.png':'offline-runtime.png')});results.push({file,...r,errors});await p.close();
 }}finally{await b.close();server.close();}fs.writeFileSync(path.join(out,'quality.json'),JSON.stringify({passed:true,results},null,2)+'\n');console.log('PASS: one-tile portal, solid jambs, leaf state, reused ground frame, aligned hinge, no floating half-walls, collision and sight; development/offline');
})().catch(e=>{console.error(e);process.exitCode=1;});
