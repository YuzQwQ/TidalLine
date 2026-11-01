/* Browser raster checks: static map independent of exploration, current sight still hides enemies. */
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/observation-fog');
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  fs.readFile(file,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.png')?'image/png':'text/html;charset=utf-8'}).end(b));
});
(async()=>{
  fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    for(const file of ['index.html','潮汐线.html']){
      const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto('http://127.0.0.1:'+server.address().port+'/'+encodeURIComponent(file)+'#play');
      await page.waitForFunction(()=>Art.get('tiles','floor')&&Art.get('props','door'));
      const stats=await page.evaluate(()=>{
        Game.state='ended';
        const canvas=document.createElement('canvas');canvas.width=720;canvas.height=480;
        const c=canvas.getContext('2d'),cx=Math.round(Game.cam.x),cy=Math.round(Game.cam.y);
        const sight=M.visible.slice(),history=M.seen.slice(),enemies=Game.enemies;
        const originalChar=Art.drawChar, drawn=[]; Art.drawChar=function(...args){drawn.push(args[1]);return originalChar.apply(this,args);};
        function draw(visible,seen,foes){
          canvas.width=720; c.imageSmoothingEnabled=false;
          M.visible.fill(visible);M.seen.fill(seen);Game.enemies=foes;
          c.fillStyle='#070b09';c.fillRect(0,0,720,480);
          Game.renderTerrain(c,cx,cy);Game.renderObjects(c,cx,cy);Game.renderEntities(c,cx,cy);
          Game.renderRaisedWalls(c,cx,cy,true);Game.renderCanopies(c,cx,cy);Game.renderFog(c,cx,cy);
          return c.getImageData(0,0,720,480).data;
        }
        const dark=draw(0,0,[]),memory=draw(0,1,[]),hiddenEnemies=draw(0,0,enemies),lit=draw(1,0,[]);
        const equal=(a,b)=>a.every((v,i)=>Math.abs(v-b[i])<=2);
        let d=0,l=0;const colors=new Set();
        for(let i=0;i<dark.length;i+=4){d+=dark[i]+dark[i+1]+dark[i+2];l+=lit[i]+lit[i+1]+lit[i+2];colors.add(dark.slice(i,i+3).join(','));}
        Art.drawChar=originalChar;M.visible.set(sight);M.seen.set(history);Game.enemies=enemies;Game.render();
        return {historyIndependent:equal(dark,memory),enemiesHidden:drawn.every(key=>key==='player'),ratio:d/l,colors:colors.size};
      });
      assert(stats.historyIndependent,'exploration must not change rendering');
      assert(stats.enemiesHidden,'unobserved enemies must remain hidden');
      assert(stats.ratio>.2&&stats.ratio<.65,JSON.stringify(stats));
      assert(stats.colors>100,'unobserved area must retain actual map texture');
      await page.screenshot({path:path.join(out,file==='index.html'?'development.png':'offline.png')});
      assert.deepEqual(errors,[]);console.log('OK: '+file+' '+JSON.stringify(stats));await page.close();
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
