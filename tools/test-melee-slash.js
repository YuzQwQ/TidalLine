const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require('playwright'),{read}=require('./lib/png-read');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'assets/item-art/melee-slash');
const m=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json')));
assert.equal(m.assets.length,3);
for(const a of m.assets){const p=read(path.join(root,a.target));assert.equal(p.w,a.size[0]);assert.equal(p.h,a.size[1]);let visible=0;
  for(let y=0;y<p.h;y++)for(let x=0;x<p.w;x++){const alpha=p.px[y][x][3];if(alpha){visible++;assert(x>=4&&x<p.w-4&&y>=4&&y<p.h-4);}}
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
    player.meleeClock=weapon.windup+.26;MeleeSystem.drawSlash(c,player,{phase:'recovery',start:0,weapon,angle:0,slashDirection:'lr'},0,0);
    const expired=[...c.getImageData(0,0,256,256).data].every(v=>v===0);
    const energy=(phase,age)=>{
      c.clearRect(0,0,256,256);player.meleeClock=weapon.windup+age;
      MeleeSystem.drawSlash(c,player,{phase,start:0,weapon,angle:0,slashDirection:'lr'},0,0);
      const data=c.getImageData(0,0,256,256).data;let sum=0;for(let i=3;i<data.length;i+=4)sum+=data[i];return sum;
    };
    const timing=[energy('windup',-.1),energy('recovery',.02),energy('recovery',.06),energy('recovery',.18),energy('cancelled',0)];
    const taper={};for(const dir of ['lr','rl']){
      c.clearRect(0,0,256,256);c.save();c.translate(128,128);MeleeSystem.slashBand(c,30,.8,dir,false);c.restore();
      const data=c.getImageData(0,0,256,256).data;let left=0,right=0;
      for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(data[(y*256+x)*4+3]>128){if(x<128)left++;else right++;}
      taper[dir]=[left,right];
    }
    const get=Art.get,selected=[];Art.get=function(group,id){selected.push(id);return get.call(this,group,id);};
    try{player.meleeClock=MELEE[3].windup+.02;MeleeSystem.drawSlash(c,player,{phase:'recovery',start:0,weapon:MELEE[3],angle:0},0,0);}finally{Art.get=get;}
    player.melee=EQUIP.melee('melee01');player.meleeActive=true;player.meleeAttack=null;Game.state='playing';
    player.meleeReadyAt=0;MeleeSystem.attack(player);const first=player.meleeAttack.slashDirection;
    player.meleeReadyAt=0;player.meleeAttack=null;MeleeSystem.attack(player);const second=player.meleeAttack.slashDirection;
    Game.state='ended';return {count,outside,small,large,expired,timing,taper,selected,alternating:first!==second,embedded:!!window.__SPRITES__?.['effects/melee_thrust']};
  });
  assert.equal(result.outside,0,JSON.stringify(result));assert(result.expired&&result.alternating);if(file!=='index.html')assert(result.embedded);
  assert(result.timing[0]>0&&result.timing[0]<result.timing[1]);assert.equal(result.timing[1],result.timing[2]);assert(result.timing[3]<result.timing[1]);assert.equal(result.timing[4],0);
  assert(result.taper.lr[0]>result.taper.lr[1]*1.4);assert(result.taper.rl[1]>result.taper.rl[0]*1.4);assert.deepEqual(result.selected,['melee_thrust']);
  if(file==='index.html'){
    fs.mkdirSync(path.join(folder,'previews'),{recursive:true});
    const previews=await p.evaluate(()=>MELEE.map(weapon=>{
      const cv=document.createElement('canvas');cv.width=240;cv.height=128;const c=cv.getContext('2d');
      c.fillStyle='#25392f';c.fillRect(0,0,240,128);c.imageSmoothingEnabled=false;
      const tile=Art.get('tiles','street_stone');if(tile)for(let y=0;y<128;y+=32)for(let x=0;x<240;x+=32)c.drawImage(tile,x,y,32,32);
      for(const [i,dir]of ['lr','rl'].entries()){
        const player={...Game.player,x:60+i*120,y:84,dead:false,dodgeT:0,meleeActive:true,melee:EQUIP.melee(weapon.id),meleeClock:weapon.windup+.02};
        const a={phase:'recovery',start:0,weapon,angle:-Math.PI/2,slashDirection:dir};player.meleeAttack=a;
        Art.drawChar(c,'player',a.angle,player.x,player.y,player,1);MeleeSystem.drawSlash(c,player,a,0,0);
      }
      return {id:weapon.id,png:cv.toDataURL('image/png').split(',')[1]};
    }));
    for(const v of previews)fs.writeFileSync(path.join(folder,'previews',v.id+'.png'),Buffer.from(v.png,'base64'));
  }
  assert.deepEqual(errors,[]);console.log('OK: '+file+' '+JSON.stringify(result));await p.close();
}
const gallery=await browser.newPage({viewport:{width:1050,height:1000}});await gallery.goto('http://127.0.0.1:'+server.address().port+'/assets/item-art/melee-slash/index.html');await gallery.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await gallery.screenshot({path:path.join(folder,'preview.png'),fullPage:true});
for(const width of [320,390]){await gallery.setViewportSize({width,height:844});assert(await gallery.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
fs.writeFileSync(path.join(folder,'quality.json'),JSON.stringify({status:'passed',sprites:3,slashSize:[128,64],thrustSize:[64,128],combinationsPerBuild:56,development:true,offline:true,sectorClipped:true,directionalTaper:true,separateThrust:true,windupPreview:true,hold:.08,duration:.24,narrow:[320,390]},null,2)+'\n');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
