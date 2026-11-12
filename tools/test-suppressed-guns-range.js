const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{pathToFileURL}=require('url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'design/audio/suppressed-guns-v1'),calibration=require('../design/audio/suppressed-guns-v1/calibration.json');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true}),reports=[];
try{for(const file of ['index.html','潮汐线.html']){
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.clear());
 await page.goto(pathToFileURL(path.join(root,file)).href+'#range');await page.waitForFunction(()=>typeof Range!=='undefined'&&Range.active);
 await page.locator('[data-act="suppressor-load"]').click();await page.evaluate(async()=>{SFX.init();await SFX.load();});
 const snapshot=await page.evaluate(()=>JSON.stringify([Save.gear,Save.stash,Save.bag,Save.credits]));
 assert.equal(await page.locator('[data-sfx^="m4-"],[data-sfx^="akm-"],[data-act="akm-suppressor-load"]').count(),0,'no retired model-specific panel');
 const cases=await page.evaluate(()=>{
  const captured=[],play=SFX._playSample;SFX._playSample=function(id,o){captured.push({id,suppressed:!!o?.rangeSuppressedProfile,sameTemplate:!o?.rangeSuppressedProfile||o.rangeSuppressedProfile===this.RANGE_M4_SUPPRESSOR,gain:o?.rangeSuppressedGain??1,delay:o?.delay||0});return play.call(this,id,o);};
  const rows=[];try{for(const w of Object.values(WEAPONS)){
   Range.equip(w.id);const muzzle=SFX._suppressorMuzzle(w.id);if(!muzzle){rows.push({id:w.id,excluded:true,forced:SFX._rangeSuppressedProfile(w.id,{rangeSuppressorVariant:'suppressed'})});continue;}
   Range.setPart('muzzle',muzzle);Game.player.fireCd=0;let n=captured.length;const mag=Game.player.mag,fired=Game.player.tryShoot(),live=captured.slice(n);
   Range.setPart('muzzle',null);Game.player.fireCd=0;n=captured.length;Game.player.tryShoot();const dry=captured.slice(n);
   n=captured.length;Range.previewSfx('suppression-dry');Range.previewSfx('suppression-suppressed');const compare=captured.slice(n);
   n=captured.length;const before=Game.player.mag;Range.previewSfx('suppression-suppressed-burst');const burst=captured.slice(n);
   rows.push({id:w.id,muzzle,fired,magConsumed:mag-Game.player.mag,live,dry,compare,burst,previewPreservesMag:before===Game.player.mag});
  }}finally{SFX._playSample=play;}
  return rows;
 });
 assert.equal(cases.filter(c=>!c.excluded).length,22);assert.deepEqual(cases.filter(c=>c.excluded).map(c=>c.id).sort(),['mp155','rem870','saiga12'].sort());
 for(const row of cases){if(row.excluded){assert.equal(row.forced,null);continue;}assert(row.fired&&row.magConsumed===2);assert(row.live[0].suppressed&&row.live[0].sameTemplate);assert.equal(row.live[0].gain,calibration.gains[row.id]);assert(!row.dry[0].suppressed&&row.dry[0].gain===1);assert.deepEqual(row.compare.map(c=>c.suppressed),[false,true]);assert(row.burst.length===3&&row.burst.every(c=>c.suppressed)&&row.burst[0].delay===0&&row.burst[1].delay>0&&row.burst[2].delay>row.burst[1].delay&&row.previewPreservesMag);}
 // Actual generic UI uses the selected model and its compatible exclusive muzzle.
 await page.evaluate(()=>Range.equip('mcx_spear'));await page.locator('[data-act="suppressor-load"]').click();assert.equal(await page.evaluate(()=>Game.player.weapon.attachments.muzzle),'att_muzzle11');
 await page.evaluate(()=>Range.equip('rm277'));await page.locator('[data-act="suppressor-load"]').click();assert.equal(await page.evaluate(()=>Game.player.weapon.attachments.muzzle),'att_muzzle12');
 await page.evaluate(()=>Range.equip('mp155'));assert(await page.locator('[data-act="suppressor-load"]').isDisabled());assert(await page.locator('[data-sfx="suppression-suppressed"]').isDisabled());
 // The same template and per-source compensation must be present in both packages.
 const audio=await page.evaluate(async()=>{
  const ctx=SFX.ctx,master=SFX.master,rows=[];try{for(const w of Object.values(WEAPONS)){
   if(!SFX._suppressorMuzzle(w.id))continue;const key=SFX.SHOT_MODEL[w.id]||w.category,p=SFX.SHOT_SAMPLE[key],parts=[];
   for(const id of p.ids){const rate=SFX.samples[id].sampleRate,c=new OfflineAudioContext(1,Math.ceil(rate*.35),rate);SFX.ctx=c;SFX.master=c.destination;
    SFX._playSample(id,{rate:p.rate||1,vol:p.vol||1,rangeSuppressedProfile:SFX.RANGE_M4_SUPPRESSOR,rangeSuppressedGain:SFX.RANGE_SUPPRESSOR_GAINS[w.id]});
    const data=(await c.startRendering()).getChannelData(0);let sum=0,peak=0,tail=0;for(let i=0;i<data.length;i++){sum+=data[i]*data[i];peak=Math.max(peak,Math.abs(data[i]));if(i>rate*.15)tail+=data[i]*data[i];}parts.push({id,rms:Math.sqrt(sum/data.length),peak,tail});
   }rows.push({id:w.id,rms:Math.sqrt(parts.reduce((a,p)=>a+p.rms*p.rms,0)/parts.length),peak:Math.max(...parts.map(p=>p.peak)),tail:Math.max(...parts.map(p=>p.tail)),parts});
  }}finally{SFX.ctx=ctx;SFX.master=master;}return{rows,template:{...SFX.RANGE_M4_SUPPRESSOR},gains:{...SFX.RANGE_SUPPRESSOR_GAINS}};
 });
 assert.deepEqual(audio.template,calibration.template);assert.deepEqual(audio.gains,calibration.gains);assert.equal(audio.template.pitchSemitones,9);assert.equal(audio.gains.akm,1.55);
 const reference=audio.rows.find(r=>r.id==='m4a1').rms;for(const row of audio.rows){assert(row.rms/reference>.9&&row.rms/reference<1.1,'matched processed energy '+row.id);assert(row.peak<.96&&row.tail<1e-8,'no clipping or long tail '+row.id);}
 assert.equal(await page.evaluate(()=>JSON.stringify([Save.gear,Save.stash,Save.bag,Save.credits])),snapshot);
 const fallback=await page.evaluate(()=>{const play=SFX._playGun,shot=SFX._shot;let observed=null;try{SFX._playGun=()=>false;SFX._shot=(p,o)=>observed={enabled:!!o.rangeSuppressedProfile,gain:o.rangeSuppressedGain};SFX.play('shot',{gun:'m16a1',rangeSuppressorVariant:'suppressed'});return observed;}finally{SFX._playGun=play;SFX._shot=shot;}});assert(fallback.enabled&&fallback.gain===1,'sample-specific boosts do not overdrive synthetic fallback');
 await page.evaluate(()=>Range.equip('ak12'));await page.locator('[data-act="suppressor-load"]').click();await page.locator('[data-sfx="suppression-suppressed"]').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,file==='index.html'?'runtime.png':'offline.png')});
 assert(await page.evaluate(()=>{Range.exit();return Object.keys(SFX.RANGE_SUPPRESSOR_GAINS).every(gun=>!SFX._rangeSuppressedProfile(gun,{rangeSuppressorVariant:'suppressed'})&&!SFX._rangeSuppressedProfile(gun,{attachments:{muzzle:SFX._suppressorMuzzle(gun)}}));}),'formal context is unchanged');
 assert.deepEqual(errors,[]);reports.push({file,cases,audio,fallback,passed:true});await page.close();
}}finally{await browser.close();}
fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({passed:true,reports},null,2)+'\n');console.log('PASS: 22 independently compensated guns, original samples/shared M4 template, full live/UI/burst matrix, physical interfaces, 3 excluded shotguns, DSP energy/peaks/tails, fallback and formal/save isolation; ordinary/offline');
})().catch(e=>{console.error(e);process.exitCode=1;});
