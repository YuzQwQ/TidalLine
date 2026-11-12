/* Measure each existing source through the accepted M4 DSP graph; no new audio files. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{pathToFileURL}=require('url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'design/audio/suppressed-guns-v1');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});let result;
try{const page=await browser.newPage();await page.goto(pathToFileURL(path.join(root,'index.html')).href+'#range');await page.waitForFunction(()=>typeof Range!=='undefined'&&Range.active);result=await page.evaluate(async()=>{
 SFX.init();await SFX.load();const ctx=SFX.ctx,master=SFX.master,rows=[];
 const muzzles=Object.values(ATTACHMENT_DEFS).filter(a=>a.subtype==='muzzle'&&a.statModifiers.noiseRadius<0);
 try{for(const w of Object.values(WEAPONS)){
  const compatible=muzzles.filter(a=>Attachments.compatible(w.id,a.id));if(!compatible.length)continue;
  const key=SFX.SHOT_MODEL[w.id]||w.category,profile=SFX.SHOT_SAMPLE[key];if(!profile)throw Error('No sample profile '+w.id);
  const measurements=[];
  for(const id of profile.ids){const source=SFX.samples[id];if(!source)throw Error('Missing decoded source '+w.id+'/'+id);
   const rate=source.sampleRate,c=new OfflineAudioContext(1,Math.ceil(rate*.35),rate);SFX.ctx=c;SFX.master=c.destination;
   SFX._playSample(id,{rate:profile.rate||1,vol:profile.vol||1,rangeSuppressedProfile:SFX.RANGE_M4_SUPPRESSOR,rangeSuppressedGain:1});
   const rendered=await c.startRendering(),data=rendered.getChannelData(0);let energy=0,peak=0;for(const x of data){energy+=x*x;peak=Math.max(peak,Math.abs(x));}
   measurements.push({id,rms:Math.sqrt(energy/data.length),peak});
  }
  const rms=Math.sqrt(measurements.reduce((sum,m)=>sum+m.rms*m.rms,0)/measurements.length),peak=Math.max(...measurements.map(m=>m.peak));
  rows.push({id:w.id,name:w.name,category:w.category,sampleProfile:key,measurements,rms,peak,muzzles:compatible.map(a=>a.id)});
 }}finally{SFX.ctx=ctx;SFX.master=master;}
 return{template:{...SFX.RANGE_M4_SUPPRESSOR},rows};
});}finally{await browser.close();}
const reference=result.rows.find(r=>r.id==='m4a1').rms;assert(reference>0);
const gains={};for(const row of result.rows){assert(row.rms>1e-8,row.id+' audible source');let gain=row.id==='m4a1'?1:row.id==='akm'?1.55:Math.round(Math.min(6,Math.max(.5,reference/row.rms),.90/row.peak)*100)/100;gains[row.id]=gain;Object.assign(row,{compensation:gain,processedRms:row.rms*gain,processedPeak:row.peak*gain,relativeToM4:row.rms*gain/reference});}
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'calibration.json'),JSON.stringify({...result,referenceRms:reference,gains},null,2)+'\n');
if(process.argv.includes('--write')){const file=path.join(root,'js/ui.js'),s=fs.readFileSync(file,'utf8');const marker=/RANGE_SUPPRESSOR_GAINS:\s*\{[^}]*\}/;assert(marker.test(s),'Missing gain table marker');fs.writeFileSync(file,s.replace(marker,'RANGE_SUPPRESSOR_GAINS:'+JSON.stringify(gains)));}
console.log(JSON.stringify({guns:result.rows.length,gains,rmsRange:[Math.min(...result.rows.map(r=>r.relativeToM4)),Math.max(...result.rows.map(r=>r.relativeToM4))]},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
