const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{pathToFileURL}=require('url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'design/enemies/scav-accuracy-v1');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--mute-audio','--no-proxy-server']}),reports=[];
try{for(const file of ['index.html','潮汐线.html']){
 const page=await browser.newPage(),errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()+' '+r.failure()?.errorText));page.on('request',r=>{if(file!=='index.html'&&r.url().includes('/assets/'))external.push(r.url());});
 await page.goto(pathToFileURL(path.join(root,file)).href+'#base');await page.waitForFunction(()=>typeof HumanAI!=='undefined'&&HUMAN_UNIT_DEFS.scav.aimError===.14&&HUMAN_UNIT_DEFS.scav.aimErrorMinPx===14&&ART.gear.every(id=>Icons.gear[id]?.naturalWidth===48));
 const result=await page.evaluate(()=>{
  const maps=JSON.stringify(MAP_CATALOG);Base.close();Game.startRun(null,RANGE_MAP.id);Range.active=false;Game.wantLock=()=>false;Game.enemies=[];Game.sfx=()=>{};
  M.load(Array(45).fill('.'.repeat(50)),null,[],null);M.tideEnabled=false;Game.player.x=700;Game.player.y=500;let part=null;Game.player.hurt=(d,p)=>{part=p;return d;};
  const random=Math.random;let seed=9271;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};const rows=[];
  try{for(const distance of [32,64,128,200]){let hits=0,heads=0;const e=new Enemy('scav',700-distance,500,0);e.weaponId='aks74u';e.gun=null;e.gearLv=3;
   for(let i=0;i<1200;i++){const angle=i%8*Math.PI/4;e.x=700-Math.cos(angle)*distance;e.y=500-Math.sin(angle)*distance;e.ai.mag=30;e.ai.fireCd=e.ai.recoil=e.ai.rH=e.ai.rV=0;e.ai.phase='aim';e.ai.phaseT=.001;Game.bullets=[];part=null;
    HumanAI.advancePhase(e,.001,{x:700,y:500});if(Game.bullets.length!==1)throw Error('Expected first shot');const b=Game.bullets[0];for(let frame=0;frame<120&&!b.dead;frame++)b.update(1/60);if(part){hits++;heads+=part==='head';}Noise.clear();
   }rows.push({tiles:distance/32,shots:1200,hits,heads,hitRate:hits/1200,headRate:heads/1200});
  }}finally{Math.random=random;}
  Game.enemies=[];Game.bullets=[];return {rows,scav:{aimError:HUMAN_UNIT_DEFS.scav.aimError,aimErrorMinPx:HUMAN_UNIT_DEFS.scav.aimErrorMinPx},holdoutAim:HUMAN_UNIT_DEFS.holdout.aimError,retrieverAim:HUMAN_UNIT_DEFS.retriever.aimError,mapsAndSquadsUnchanged:maps===JSON.stringify(MAP_CATALOG)};
 });
 assert.equal(result.holdoutAim,.05);assert.equal(result.retrieverAim,.04);assert(result.mapsAndSquadsUnchanged);for(const row of result.rows){assert(row.headRate<.28,JSON.stringify(row));assert(row.hitRate<.8,JSON.stringify(row));assert(row.hitRate>.15,JSON.stringify(row));}
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);reports.push({file,...result,errors,external:external.length});await page.close();
 }assert.deepEqual(reports[0].rows,reports[1].rows);fs.writeFileSync(path.join(out,'browser-verification.json'),JSON.stringify({passed:true,reports},null,2)+'\n');console.log('PASS: development/offline identical weakened scav aim, 9600 actual stepped first shots, unchanged holdout/retriever aim and map/squad data; no offline asset requests');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
