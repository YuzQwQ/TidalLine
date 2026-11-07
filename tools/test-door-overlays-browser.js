const fs=require('fs'),path=require('path'),assert=require('assert/strict'),http=require('http'),{pathToFileURL}=require('url'),{chromium}=require('playwright'),{read}=require('./lib/png-read');
const root=path.resolve(__dirname,'..'),out=path.join(root,'assets/source/doors-batch-03'),manifest=require('../assets/source/doors-batch-03/manifest.json');
(async()=>{
 for(const a of manifest.assets){const p=read(path.join(root,a.target));assert.equal(p.w,32);assert.equal(p.h,32);const[l,t,w,h]=a.visibleBounds,colors=new Set();for(let y=0;y<32;y++)for(let x=0;x<32;x++){const c=p.px[y][x];assert([0,255].includes(c[3]));colors.add(c.join(','));if(x<l||x>=l+w||y<t||y>=t+h)assert.equal(c[3],0);}assert(colors.size<=16);if(a.id.endsWith('_open')){for(const[x,y,w,h]of manifest.openings[a.id])for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)assert.equal(p.px[yy][xx][3],0,a.id+' leaf/backing in opening');let head=0,left=0,right=0;while(p.px[t+head][16][3])head++;while(p.px[18][l+left][3])left++;while(p.px[18][l+w-1-right][3])right++;assert.equal(head,left,a.id+' top/left frame thickness');assert.equal(head,right,a.id+' top/right frame thickness');}}
 const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':f.endsWith('.png')?'image/png':f.endsWith('.css')?'text/css':'text/html;charset=utf-8'}).end(b));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const b=await chromium.launch({channel:'msedge',headless:true}),results=[];try{for(const entry of ['index.html','潮汐线.html']){
  const p=await b.newPage({viewport:{width:1280,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto((entry==='index.html'?'http://127.0.0.1:'+server.address().port+'/index.html':pathToFileURL(path.join(root,entry)).href)+'#doors-test');await p.waitForFunction(ids=>typeof DoorVisual!=='undefined'&&ids.every(id=>Art.get('props',id)),manifest.assets.map(a=>a.id));
  const result=await p.evaluate(()=>{
   Game.state='ended';Game.enemies=[];Game.boxes=[];Game.corpses=[];
   const canvas=document.createElement('canvas');canvas.width=384;canvas.height=256;const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
   const proof=document.createElement('canvas');proof.width=512;proof.height=192;const pc=proof.getContext('2d');pc.imageSmoothingEnabled=false;pc.fillStyle='#17251e';pc.fillRect(0,0,512,192);pc.font='10px sans-serif';
   const types=[{doorType:'normal'},{doorType:'normal',reinforced:true},{doorType:'barricade',kickFrom:'s'},{doorType:'locked',keyId:'test'}],checks=[];
   const pixel=(data,x,y)=>Array.from(data.slice((y*384+x)*4,(y*384+x)*4+4)).join(',');
   for(let n=0;n<types.length;n++)for(const width of [1,2]){
    const rows=Array.from({length:8},()=>Array(12).fill('.'));for(let x=1;x<11;x++)rows[4][x]='#';const cells=Array.from({length:width},(_,i)=>[4+i,4]);for(const[x,y]of cells)rows[y][x]='+';
    M.load(rows.map(r=>r.join('')),null,[],null);M.map={id:'overlay-proof',props:[]};M.tideEnabled=false;const d={...types[n],x:4,y:4,cells,axis:'horizontal',open:false};M.doors=[d];for(const[x,y]of cells)M.at(x,y).door=d;M.visible.fill(1);M.seen.fill(1);Game.player.x=M.cx(4);Game.player.y=M.cy(3);
    c.clearRect(0,0,384,256);Game.renderTerrain(c,0,0);const floor=c.getImageData(0,0,384,256).data;
    for(const open of [false,true]){
     d.open=open;c.clearRect(0,0,384,256);Game.renderTerrain(c,0,0);Game.renderObjects(c,0,0);Game.renderRaisedWalls(c,0,0,true);const data=c.getImageData(0,0,384,256).data,rect=Art.doorRect(d,Art.door(d),4,4,32);
     if(rect.h!==32||rect.lift!==0)throw Error('door grew above tile');
     const expected=document.createElement('canvas');expected.width=384;expected.height=256;const ec=expected.getContext('2d');for(const[x,y]of cells){ec.save();ec.beginPath();ec.rect(x*32,y*32,32,32);ec.clip();Art.drawWallFaces(ec,x*32,y*32,32,Art.wallEdges(x,y));ec.restore();}const wall=ec.getImageData(0,0,384,256).data;
     const margins=[[rect.x+1,rect.y+16],[rect.x+rect.w-2,rect.y+16],...cells.map(([x,y])=>[x*32+16,y*32+1])];for(const[x,y]of margins)if(pixel(data,x,y)!==pixel(wall,x,y))throw Error('transparent outer margin does not reveal wall '+JSON.stringify({n,width,open,x,y,actual:pixel(data,x,y),expected:pixel(wall,x,y)}));
     if(open){for(const[x,y,w,h]of DoorVisual.aperture(d,rect))for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(pixel(data,xx,yy)!==pixel(floor,xx,yy))throw Error('wall/leaf remains inside open frame '+n+' width'+width+' at '+xx+','+yy);}
     else if(pixel(data,4*32+16,4*32+17)===pixel(floor,4*32+16,4*32+17))throw Error('closed leaf missing');
     if(width===1){pc.drawImage(canvas,3*32,3*32,96,80,n*128,open?104:8,96,80);pc.fillStyle='#d1ddc7';pc.fillText(['普通','强化','受阻','上锁'][n]+(open?' / 开':' / 关'),n*128+2,open?190:94);}
    }
    checks.push({type:n,width,outerWall:true,openFloorEveryPixel:true});
   }
   proof.id='doorOverlayProof';proof.style.cssText='position:fixed;left:0;top:0;z-index:10000;width:1024px;height:384px;image-rendering:pixelated';document.body.appendChild(proof);return{checks};
  });assert.deepEqual(errors,[]);await p.locator('#doorOverlayProof').screenshot({path:path.join(out,entry==='index.html'?'runtime.png':'offline-runtime.png')});results.push({entry,...result,errors});await p.close();
 }}finally{await b.close();server.close();}
 fs.writeFileSync(path.join(out,'quality.json'),JSON.stringify({passed:true,uniformFrames:true,transparentMargins:true,emptyFrames:true,results},null,2)+'\n');console.log('PASS: six compact sprites, equal frame thickness, reused wall margins, every aperture pixel shows floor, all door types/widths; development/offline');
})().catch(e=>{console.error(e);process.exitCode=1;});
