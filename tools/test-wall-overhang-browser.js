const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{pathToFileURL}=require('url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'assets/source/doors-batch-02');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true}),results=[];try{for(const entry of ['index.html','潮汐线.html']){
 const p=await b.newPage({viewport:{width:1280,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(pathToFileURL(path.join(root,entry)).href+'#doors-test');await p.waitForFunction(()=>typeof DoorTest!=='undefined'&&Art.get('tiles','wall_face_e'));
 const result=await p.evaluate(()=>{
  Game.state='ended';const rows=Array.from({length:12},()=>Array(14).fill('.'));for(let x=1;x<13;x++)rows[6][x]='#';for(let y=2;y<6;y++)rows[y][10]='#';M.load(rows.map(r=>r.join('')),null,[],null);M.map={id:'wall-visual-test',props:[]};M.tideEnabled=false;
  const cv=document.createElement('canvas');cv.width=448;cv.height=384;const c=cv.getContext('2d');c.imageSmoothingEnabled=false;
  // Observe real draw alpha without reading file:// image pixels or weakening browser security.
  const draw=Art.drawWallFaces,calls=[];Art.drawWallFaces=function(ctx,x,y,size,edges){calls.push({x:x/size,y:y/size,alpha:ctx.globalAlpha,overhang:pass});return draw.call(this,ctx,x,y,size,edges);};let pass=true;
  M.seen.fill(1);M.visible.fill(0);Game.renderRaisedWalls(c,0,0,true);const hidden=calls.find(q=>q.x===3&&q.y===6).alpha;
  calls.length=0;M.visible.fill(1);Game.renderRaisedWalls(c,0,0,true);const visible=calls.find(q=>q.x===3&&q.y===6).alpha,topEnd=calls.find(q=>q.x===10&&q.y===2).alpha,internalOverhang=calls.some(q=>q.x===10&&q.y>2);
  calls.length=0;pass=false;Game.renderRaisedWalls(c,0,0);const internalBody=calls.find(q=>q.x===10&&q.y===4).alpha,wallBody=calls.find(q=>q.x===3&&q.y===6).alpha;Art.drawWallFaces=draw;
  if(hidden!==1||visible!==.3||topEnd!==.3||internalOverhang||internalBody!==1||wallBody!==1)throw Error('overhang alpha/body isolation '+JSON.stringify({hidden,visible,topEnd,internalOverhang,internalBody,wallBody}));
  // Visibility on one cap cannot fade its neighboring, currently unobserved cap.
  M.visible.fill(0);M.visible[M.idx(3,5)]=1;if(Game.wallTopAlpha(3,6)!==.3||Game.wallTopAlpha(4,6)!==1||Game.wallTopAlpha(10,4)!==1)throw Error('alpha leaked between wall cells');
  M.computeFOV(3,4,12);M.applyCone(M.cx(3),M.cy(4),Math.PI/2,.5,0);if(!M.visible[M.idx(3,5)]||M.visible[M.idx(3,7)]||M.opaque(3,5)||!M.opaque(3,6))throw Error('wall body visibility leak');
  const x=M.cx(3),northY=6*32-9,bodyY=6*32+10;if(!canStand(x,northY,7)||M.wallAtPoint(x,northY)||M.blocksShot(3,5,x,northY)||canStand(x,bodyY,7)||!M.blocksShot(3,6,x,bodyY))throw Error('collision not one tile');
  // Door caps follow the same rule; a wall directly north must keep them opaque.
  let doorAlpha=null;const fake={globalAlpha:1,save(){this.a=this.globalAlpha;},restore(){this.globalAlpha=this.a;},drawImage(){doorAlpha=this.globalAlpha;}};
  const d={cells:[[3,6]],axis:'horizontal'};DoorSystem.drawCap(fake,d,3,6,32,0,0);if(doorAlpha!==.3||fake.globalAlpha!==1)throw Error('door cap alpha');
  // The moved side cap tests its own covered cell, with one readable post underneath.
  const sc=document.createElement('canvas');sc.width=128;sc.height=256;const ss=sc.getContext('2d');ss.imageSmoothingEnabled=false;
  const plain=document.createElement('canvas');plain.width=plain.height=32;const plainCtx=plain.getContext('2d');plainCtx.fillStyle='#b7b29b';plainCtx.fillRect(0,0,32,32);
  const originalTop=DoorSystem.wallTop;DoorSystem.wallTop=()=>plain;
  const side={axis:'vertical',cells:[[3,6]],sideStudy:false},drawSide=()=>{ss.fillStyle='#4e6258';ss.fillRect(0,0,128,256);DoorSystem.drawCap(ss,side,3,6,32,0,0);};
  M.visible.fill(0);M.visible[M.idx(3,6)]=1;drawSide();
  const get=(xx,yy)=>Array.from(ss.getImageData(xx,yy,1,1).data),inside=get(112,216),outside=get(108,216),sidePostContrast=Math.hypot(...inside.slice(0,3).map((v,i)=>v-outside[i]));
  if(sidePostContrast<60)throw Error('side post too faint '+sidePostContrast);
  M.visible.fill(0);M.visible[M.idx(3,5)]=1;drawSide();if(get(112,216).join(',')!==get(108,216).join(','))throw Error('side cap faded by wrong cell or hidden post leaked');
  DoorSystem.wallTop=originalTop;
  ss.clearRect(0,0,128,256);DoorVisual.sidePost(ss,{x:96,y:208,w:32,h:16},.85);const post=ss.getImageData(96,208,32,16).data;for(let yy=0;yy<16;yy++)for(let xx=0;xx<32;xx++){const a=post[(yy*32+xx)*4+3];if((xx>=14&&xx<18)!==(a>0))throw Error('post must be one vertical bar');}
  Game.player.x=x;Game.player.y=northY;M.visible.fill(1);M.seen.fill(1);Game.boxes=[];Game.corpses=[];Game.enemies=[];c.clearRect(0,0,448,384);Game.renderTerrain(c,0,0);Game.renderObjects(c,0,0);Game.renderEntities(c,0,0);Game.renderRaisedWalls(c,0,0,true);
  cv.id='wallOverhangReview';cv.style.cssText='position:fixed;left:0;top:0;z-index:10000;width:896px;height:768px;image-rendering:pixelated';document.body.appendChild(cv);
  return{hidden,visible,topEnd,internalOverhang,internalBody,wallBody,oneTileCollision:true,noSightLeak:true,doorAlpha,sidePostContrast,sideCoveredCell:true,singleBar:true};
 });assert.deepEqual(errors,[]);await p.locator('#wallOverhangReview').screenshot({path:path.join(out,entry==='index.html'?'wall-overhang.png':'offline-wall-overhang.png')});results.push({entry,...result,errors});await p.close();
 }}finally{await b.close();}fs.writeFileSync(path.join(out,'wall-overhang-verification.json'),JSON.stringify({passed:true,results},null,2)+'\n');console.log('PASS: one-tile collision, visible cap opacity30%, solid continuous walls, no sight leaks, door caps; development/offline');})().catch(e=>{console.error(e);process.exitCode=1;});
