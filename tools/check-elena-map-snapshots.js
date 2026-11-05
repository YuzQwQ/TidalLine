/* Explicit build baseline, independent of editable drafts or older feature snapshots. */
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
function readMaps(source){const c=vm.createContext({console});vm.runInContext(fs.readFileSync(path.join(root,'js/config.js'),'utf8'),c);vm.runInContext(source,c);return JSON.parse(vm.runInContext('JSON.stringify(MAP_CATALOG)',c));}
const folder=path.join(root,'design/merchants/elena-v1'),baseline=path.join(folder,'map-baseline.json');
function current(){return readMaps(fs.readFileSync(path.join(root,'js/data.js'),'utf8')).map(m=>({id:m.id,sha256:crypto.createHash('sha256').update(JSON.stringify(m)).digest('hex')}));}
function record(){fs.writeFileSync(baseline,JSON.stringify({note:'本轮期间地图被外部保存过，保留该次更新。本基线为最终离线构建前显式记录的当前运行快照。',maps:current()},null,2)+'\n');console.log('Recorded current runtime maps without compiling drafts');}
function check(){const before=JSON.parse(fs.readFileSync(baseline,'utf8')).maps,now=current();assert.deepEqual(now,before,'正式地图在记录后发生变化；请核对外部地图编辑后再显式记录基线');fs.writeFileSync(path.join(folder,'map-snapshots.json'),JSON.stringify({passed:true,comparison:'当前运行快照与最终离线构建前记录的快照一致；不读取或编译地图草稿。',maps:now},null,2)+'\n');console.log('PASS: 两张正式地图运行快照、布点与本轮构建前基线一致');return now;}
module.exports={check,record};if(require.main===module)process.argv.includes('--record')?record():check();
