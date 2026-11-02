const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require('playwright'),{read}=require('./lib/png-read');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'assets/item-art/melee-slash');
const m=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json')));
assert.equal(m.assets.length,2);
for(const a of m.assets){const p=read(path.join(root,a.target));assert.equal(p.w,128);assert.equal(p.h,64);let visible=0;
  for(let y=0;y<p.h;y++)for(let x=0;x<p.w;x++){const alpha=p.px[y][x][3];assert(alpha===0||alpha===255);if(alpha){visible++;assert(x>=4&&x<124&&y>=4&&y<60);}}
  assert(visible>150);assert(a.prompt&&fs.existsSync(path.join(folder,a.source)));
}
assert(!fs.readFileSync(path.join(root,m.assets[0].target)).equals(fs.readFileSync(path.join(root,m.assets[1].target))));
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.png')?'image/png':'text/html;charset=utf-8'}).end(b));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});
try{for(const file of ['index.html','潮汐线.html']){
  const p=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:'+server.address().port+'/'+encodeURIComponent(file)+'#play');
  await p.waitForFunction(()=>ART.effects.every(id=>Art.get('effects',id)));
  const result=await p.evaluate(()=>{
    Game.state='ended';Game.enemies=[];
    const cv=document.createElement('canvas');cv.width=cv.height=256;const c=cv.getContext('2d');
    const player=Game.player;player.x=player.y=128;
    let count=0,outside=0,small=Infinity,large=0;
    for(const weapon of MELEE)for(const dir of ['lr','rl'])for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){
      c.clearRect(0,0,256,256);player.meleeClock=weapon.windup+.02;
      const a={phase:'recovery',start:0,weapon,angle,slashDirection:dir};
      MeleeSystem.drawSlash(c,player,a,0,0);const px=c.getImageData(0,0,256,256).data;let pixels=0;
      for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(px[(y*256+x)*4+3]>64){pixels++;
        const dx=x+.5-128,dy=y+.5-128,r=Math.hypot(dx,dy),delta=Math.abs(U.angDiff(Math.atan2(dy,dx),angle));
        if(r>weapon.radius*CFG.TILE+1.25||delta>weapon.angle*Math.PI/360+.08)outside++;
      }
      if(!pixels)throw Error('Invisible slash '+weapon.id+' '+dir+' '+angle);
      small=Math.min(small,pixels);large=Math.max(large,pixels);count++;
    }
    c.clearRect(0,0,256,256);const weapon=MELEE[2];
    player.meleeClock=weapon.windup+.2;MeleeSystem.drawSlash(c,player,{phase:'recovery',start:0,weapon,angle:0,slashDirection:'lr'},0,0);
    const expired=[...c.getImageData(0,0,256,256).data].every(v=>v===0);
    player.melee=EQUIP.melee('melee01');player.meleeActive=true;player.meleeAttack=null;Game.state='playing';
    player.meleeReadyAt=0;MeleeSystem.attack(player);const first=player.meleeAttack.slashDirection;
    player.meleeReadyAt=0;player.meleeAttack=null;MeleeSystem.attack(player);const second=player.meleeAttack.slashDirection;
    Game.state='ended';return {count,outside,small,large,expired,alternating:first!==second,embedded:!!window.__SPRITES__?.['effects/melee_slash_lr']};
  });
  assert.equal(result.outside,0,JSON.stringify(result));assert(result.expired&&result.alternating);if(file!=='index.html')assert(result.embedded);
  assert.deepEqual(errors,[]);console.log('OK: '+file+' '+JSON.stringify(result));await p.close();
}
const gallery=await browser.newPage({viewport:{width:1050,height:1000}});await gallery.goto('http://127.0.0.1:'+server.address().port+'/assets/item-art/melee-slash/index.html');await gallery.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await gallery.screenshot({path:path.join(folder,'preview.png'),fullPage:true});
for(const width of [320,390]){await gallery.setViewportSize({width,height:844});assert(await gallery.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
fs.writeFileSync(path.join(folder,'quality.json'),JSON.stringify({status:'passed',sprites:2,size:[128,64],combinationsPerBuild:24,development:true,offline:true,sectorClipped:true,alternating:true,duration:.16,heightScale:2.5,narrow:[320,390]},null,2)+'\n');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
