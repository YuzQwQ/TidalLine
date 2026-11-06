const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');const root=path.resolve(__dirname,'..');
const manifest=require('../assets/audio/manifest.json');let passed=0;
function setup(prefs,blocked=false){
 const stored={},listeners={};if(prefs)stored.tideline_music_v1=JSON.stringify(prefs);let made=0;
 class AudioMock{constructor(){made++;this.paused=true;this.currentTime=0;this.duration=203;this.volume=0;this.listeners={};this.plays=0;}addEventListener(k,f){(this.listeners[k]??=[]).push(f);}play(){this.plays++;if(blocked)return Promise.reject(Object.assign(new Error('gesture'),{name:'NotAllowedError'}));this.paused=false;return Promise.resolve();}pause(){this.paused=true;}emit(k){for(const f of this.listeners[k]||[])f();}}
 const c={console,Audio:AudioMock,localStorage:{getItem:k=>stored[k]??null,setItem:(k,v)=>stored[k]=String(v)},window:{addEventListener:(k,f)=>listeners[k]=f,removeEventListener:(k,f)=>{if(listeners[k]===f)delete listeners[k];}},setInterval:()=>1,clearInterval(){},performance:{now:()=>0}};vm.createContext(c);for(const file of ['music.js','music-player.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',file),'utf8'),c);const m=vm.runInContext('Music',c);m.fadeTo=(v,t,done)=>{if(m.el)m.el.volume=v;done?.();};return {m,stored,listeners,made:()=>made};
}
async function test(name,fn){await fn();passed++;console.log('OK: '+name);}
(async()=>{
await test('four full-length 192kbps stereo MP3s registered separately from SFX, hashes and per-track inline limits valid',()=>{
 assert.equal(manifest.music.length,4);assert.equal(manifest.music.find(t=>t.id==='business_as_usual').scene,'shop');for(const track of manifest.music){assert(track.title&&track.english&&track.original);assert.equal(track.channels,2);assert.equal(track.sampleRate,44100);assert.equal(track.bitrate,192000);assert(track.dur>180&&track.dur<240);const data=fs.readFileSync(path.join(root,'assets/audio',track.file));assert.equal(data.length,track.bytes);assert(data.length<6*1024*1024);assert.equal(crypto.createHash('sha256').update(data).digest('hex').slice(0,16),track.sha256_16);assert(!manifest.assets.some(a=>a.id===track.id));}
});
await test('one media element across song changes; base re-entry resumes selected track and respects manual pause',()=>{
 const {m,made}=setup();m.enterBase();assert(m.active&&!m.el.paused);m.play('no_one_answers');const el=m.el;el.currentTime=30;m.stop(0);assert(el.paused&&!m.active);m.enterBase();assert.equal(m.cur,'no_one_answers');assert.equal(el.currentTime,30);m.setOn(false);m.stop(0);m.enterBase();assert(el.paused&&!m.on);assert.equal(made(),1);
});
await test('ordered wrap, manual previous, repeat and shuffle never immediately repeat the same song',()=>{
 const {m}=setup();m.enterBase();m.play('base');m.next(-1);assert.equal(m.cur,'beyond_the_grey');m.next();assert.equal(m.cur,'base');m.el.emit('ended');assert.equal(m.cur,'no_one_answers');m.setMode('repeat');m.el.currentTime=200;m.el.emit('ended');assert.equal(m.cur,'no_one_answers');assert.equal(m.el.currentTime,0);m.setMode('shuffle');for(let n=0;n<40;n++){const before=m.cur;m.el.emit('ended');assert.notEqual(m.cur,before);}
});
await test('volume, playlist mode, selected song and pause survive storage reload, without game-save writes',()=>{
 const {m,stored}=setup();m.enterBase();m.play('beyond_the_grey');m.setVolume(.27);m.setMode('shuffle');m.setOn(false);const copy=setup(JSON.parse(stored.tideline_music_v1));copy.m.enterBase();assert.equal(copy.m.cur,'beyond_the_grey');assert.equal(copy.m.volume,.27);assert.equal(copy.m.mode,'shuffle');assert(!copy.m.on&&copy.m.el.paused);assert.deepEqual(Object.keys(stored),['tideline_music_v1']);m.setVolume(2);assert.equal(m.volume,1);m.setVolume(-1);assert.equal(m.volume,0);m.setVolume(NaN);assert.equal(m.volume,0);
});
await test('seeking clamps valid duration; pause outside base cannot be bypassed by song selection or ended events',()=>{
 const {m}=setup();m.enterBase();m.seek(40);assert.equal(m.el.currentTime,40);m.seek(900);assert.equal(m.el.currentTime,203);m.seek(-9);assert.equal(m.el.currentTime,0);m.stop(0);const plays=m.el.plays;m.play('no_one_answers');m.el.emit('ended');assert.equal(m.el.plays,plays);assert(m.el.paused);m.setVolume(.7);assert(m.el.paused&&m.el.volume===0);
});
await test('autoplay retry listeners are removed on raid entry, preventing late user gestures from restarting music',async()=>{
 const {m,listeners}=setup(null,true);m.enterBase();await new Promise(r=>setImmediate(r));assert(m.blocked);assert(listeners.pointerdown&&listeners.keydown);m.stop(0);const plays=m.el.plays;assert(!listeners.pointerdown&&!listeners.keydown);assert.equal(m.el.plays,plays);assert(m.el.paused);
});
await test('invalid remembered track/mode and unavailable storage fall back cleanly',()=>{
 const {m}=setup({track:'missing',mode:'bad',volume:4});m.enterBase();assert.equal(m.cur,'base');assert.equal(m.mode,'order');assert.equal(m.volume,1);assert.equal(m.play('missing'),false);assert.equal(m.clock(NaN),'0:00');assert.equal(m.clock(229.9),'3:49');
});
await test('shop priority loops its music, preserves lobby selection/progress and keeps one media element',()=>{
 const {m,stored,made}=setup();m.enterBase();m.play('no_one_answers');m.el.currentTime=47;m.setScene('shop');assert.equal(m.cur,'business_as_usual');assert.equal(m.el.currentTime,0);m.el.currentTime=21;m.setVolume(.4);assert.equal(JSON.parse(stored.tideline_music_v1).track,'no_one_answers');m.setScene('shop');assert.equal(m.el.currentTime,21);m.el.emit('ended');assert.equal(m.cur,'business_as_usual');assert.equal(m.el.currentTime,0);m.el.currentTime=12;m.setScene('lobby');assert.equal(m.cur,'no_one_answers');assert.equal(m.el.currentTime,47);m.setScene('shop');assert.equal(m.el.currentTime,12);assert.equal(made(),1);m.stop(0);m.enterBase();assert.equal(m.cur,'no_one_answers');assert.equal(m.el.currentTime,47);
});
await test('paused scene changes stay silent; volume and pause controls finish an in-flight switch safely',()=>{
 const {m}=setup();m.enterBase();m.setOn(false);m.setScene('shop');assert.equal(m.cur,'business_as_usual');assert(m.el.paused&&!m.on);m.setScene('lobby');assert.equal(m.cur,'base');assert(m.el.paused);m.setOn(true);const fades=[];m.fadeTo=(v,t,done)=>fades.push({v,t,done});m.el.volume=.4;m.setScene('shop');assert(m._switching);m.setVolume(.2);assert(m._switching);m.setOn(false);assert.equal(m.cur,'business_as_usual');assert(!m._switching&&m.el.paused);fades[0].done();assert(m.el.paused&&!m.on);
});
await test('rapid shop leave/re-entry and raid entry cancel stale fade callbacks without restarting music',()=>{
 const {m}=setup();m.enterBase();m.el.currentTime=30;m.el.volume=.45;const fades=[];m.fadeTo=(v,t,done)=>fades.push({v,t,done});m.setScene('shop');assert.equal(m.cur,'base');const old=fades.at(-1);assert.equal(old.v,0);m.setScene('lobby');old.done();assert.equal(m.cur,'base');m.setScene('shop');const next=fades.at(-1);m.stop(0);next.done();assert.equal(m.cur,'base');fades.at(-1).done();assert(m.el.paused&&!m.active);m.enterBase();assert.equal(m.cur,'base');assert(!m.el.paused);
});
const out=path.join(root,'design/audio/lobby-music-v1');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({passed,tracks:manifest.music.map(({id,title,dur,bytes,bitrate})=>({id,title,duration:dur,bytes,bitrate})),mp3Bytes:manifest.music.reduce((n,t)=>n+t.bytes,0)},null,2)+'\n');console.log('Music player: '+passed+' groups passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
