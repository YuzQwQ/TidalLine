/* 破坏性样例：验证校验器仍能拒绝破坏设计约束的改动，而不只是"当前快照能过"。
 * 这些样例比正向验收更重要——它们证明规则还有牙齿，而不是被拆软了。
 *
 * 注意：这张图现在是手工设计稿，rules.json 里的配额与 M1–M6 已停用。
 * 破坏样例要验的是"规则开着会不会拦"，所以这里另造一份全约束规则，
 * 不能直接拿放宽后的 rules.json——那测出来的会是"关着当然不拦"。 */
const assert=require('assert/strict');
const fs=require('fs');
const path=require('path');
const {validate}=require('./validate.cjs');
const {validateMap}=require('../shared/map-validator.js');
const mapRules=require('./rules.json');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'layout.json'),'utf8'));

const strictRules=Object.assign({},mapRules,{
  id:'strict-test',
  expect:Object.assign({},mapRules.expect,{
    width:data.width,height:data.height,
    containers:data.containers.length,enemies:data.enemies.length,
    exits:data.exits.length,bridges:data.bridges.length
  }),
  specialChecks:['buildingEntrances','bridgeOnlyCrossing','bankSecurityChain','tideReserve','indoorRouting','clearanceWidth']
});

const result=validate(data);
assert(!('routes' in data),'layout.json 不应保存 routes：schemaVersion 2 起由校验器现场计算');
assert.equal(result.routes.length,3,'应有三条推荐路线');
assert(result.routes.every(r=>r.connected&&r.steps>0),'三条路线都应连通且有步长');
assert.equal(result.checks.length,18,'规则数应为 18（G1–G12 + M1–M6）');

function reject(name,mutate,pattern,level){
  const want=level||'error';
  const copy=structuredClone(data);
  mutate(copy);
  const got=validateMap(copy,strictRules).issues.filter(i=>i.level===want).map(i=>i.message);
  assert(got.some(m=>pattern.test(m)),name+' 未被拒绝，实际：'+(got.slice(0,3).join(' | ')||'(无输出)'));
  console.log('OK: 拒绝 '+name);
}
const tile=(d,x,y,ch)=>{d.rows[y]=d.rows[y].slice(0,x)+ch+d.rows[y].slice(x+1);};

reject('第三条绕河通路',d=>{for(let x=29;x<=36;x++)tile(d,x,20,'=');},/封闭双桥后仍能绕河/);
reject('主要侧廊被箱柜挤窄',d=>{d.containers[0].x=10;d.containers[0].y=16;},/净宽被占用/);
reject('出生附近的固定敌人',d=>{const e=d.enemies.find(e=>e.region==='outdoors');e.x=8;e.y=4;},/出生点附近有敌人/);
reject('绕过银行安保的侧孔',d=>tile(d,60,38,'+'),/绕过了 安保过渡门/);
reject('橱窗变成可穿越通路',d=>{d.legend.w.walkable=true;},/橱窗必须不可通行/);
reject('物资配额漂移',d=>d.containers.pop(),/配额/,'warn');

console.log(`通过 ${result.checks.length} 项正向检查与 6 项破坏性样例检查；routes 由实体占格现场生成（${result.routes.map(r=>r.steps).join(' / ')} 步）。`);
