/* 验证检查器能拒绝破坏设计约束的改动，而不仅验证当前快照。 */
const assert=require('assert/strict');
const fs=require('fs');
const path=require('path');
const {validate}=require('./validate.cjs');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'layout.json'),'utf8'));
const result=validate(data);
const {routes,...exported}=data;
assert.deepEqual(exported,require('./source.cjs').data,'导出草案必须与当前设计源一致');
assert.deepEqual(data.routes,result.routes,'导出的推荐路线必须与当前实体占格一致');
function reject(name,mutate,pattern){const copy=structuredClone(data);mutate(copy);assert.throws(()=>validate(copy),pattern,name);console.log('OK: 拒绝 '+name);}
const tile=(d,x,y,ch)=>{d.rows[y]=d.rows[y].slice(0,x)+ch+d.rows[y].slice(x+1);};
reject('第三条绕河通路',d=>{for(let x=29;x<=36;x++)tile(d,x,20,'=');},/封闭双桥后仍能绕河/);
reject('主要侧廊被箱柜挤窄',d=>{d.containers[0].x=10;d.containers[0].y=16;},/净宽被占用/);
reject('出生附近的固定敌人',d=>{const e=d.enemies.find(e=>e.region==='outdoors');e.x=8;e.y=4;},/出生点附近有敌人/);
reject('绕过银行安保的侧孔',d=>tile(d,60,38,'+'),/绕过了 安保过渡门/);
reject('橱窗变成可穿越通路',d=>{d.legend.w.walkable=true;},/AssertionError/);
reject('物资配额漂移',d=>d.containers.pop(),/40 !== 41/);
console.log(`通过 ${result.checks.length} 项正向检查与 6 项破坏性样例检查；导出路线一致。`);
