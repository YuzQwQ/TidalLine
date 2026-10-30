const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
// 复用运行时测试的DOM模型，不执行其测试主体。
const setup=fs.readFileSync(path.join(root,'run-test.js'),'utf8').split('let pass = 0, fail = 0;')[0];
const box={require,__dirname:root,console};vm.runInNewContext(setup+'\nglobalThis.harness={Game:ctx.Game,ctx};',box);
const {Game,ctx}=box.harness,frames=new Map(),intervals=[];let clock=0,id=0,renders=0;
ctx.performance.now=()=>clock;ctx.requestAnimationFrame=cb=>{frames.set(++id,cb);return id;};ctx.setInterval=fn=>{intervals.push(fn);return intervals.length;};Game.render=()=>renders++;
Game.init();Game.state='base';const pending=[];
function frame(){const work=[...frames.values()];frames.clear();for(const cb of work)cb(clock);}
for(let n=0;n<20;n++){clock+=2000;for(const fn of intervals)fn();clock+=16;frame();pending.push(frames.size);}
const report={simulatedBackgroundPauses:20,pendingFramesAfterEachResume:pending,maxPendingFrames:Math.max(...pending),watchdogIntervals:intervals.length,renders};
if(process.argv.includes('--baseline')){fs.mkdirSync(path.join(root,'output/performance'),{recursive:true});fs.writeFileSync(path.join(root,'output/performance/loop-before.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));process.exit();}
assert.equal(report.maxPendingFrames,1,'反复恢复后不能累加主循环');Game.init();assert.equal(frames.size,1,'重复初始化不能追加循环');
// 即使外部调试直接调用loop，也只保留一张待执行帧。
Game.loop(clock);Game.loop(clock);assert.equal(frames.size,1);
for(let n=0;n<10000;n++){clock+=16;frame();assert.equal(frames.size,1);}
fs.mkdirSync(path.join(root,'output/performance'),{recursive:true});fs.writeFileSync(path.join(root,'output/performance/loop-after.json'),JSON.stringify({...report,steadyFrames:10000,reinitializationSafe:true},null,2)+'\n');
console.log('PASS: 20次后台恢复、10000帧仓库空转、重复初始化与手动帧均保持单一循环');
