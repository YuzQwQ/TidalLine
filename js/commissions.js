/* Independent persistent commission service. No timer, run hook or public reroll. */
const Commissions={
 tokens:new Map(),serial:0,
 clone(value){return JSON.parse(JSON.stringify(value));},
 definition(id){return COMMISSION_DEFS.find(d=>d.id===id)||null;},
 allowed(){return Game.state==='base'&&typeof MerchantUI!=='undefined'&&MerchantUI.key==='elena'&&Safehouse.view==='merchant';},
 rollTier(level=1,rng=Math.random){const weights=COMMISSION_WEIGHTS[level]||COMMISSION_WEIGHTS[1];const value=Math.min(1-Number.EPSILON,Math.max(0,rng()))*100;let sum=0;for(let i=0;i<weights.length;i++){sum+=weights[i];if(value<sum)return i+1;}return 3;},
 generate(level=1,rng=Math.random){const used=new Set(),slots=[];for(let i=0;i<2;i++){const tier=this.rollTier(level,rng),pool=COMMISSION_DEFS.filter(d=>d.tier===tier&&!used.has(d.id));if(!pool.length)throw Error('委托模板不足');const d=pool[Math.min(pool.length-1,Math.floor(Math.max(0,rng())*pool.length))];used.add(d.id);slots.push({instanceId:'initial-1-'+i,definitionId:d.id,title:d.title,description:d.description,tier:d.tier,objectives:this.clone(d.objectives),rewards:this.clone(d.rewards),status:'sealed'});}return {version:1,batchId:'initial-1',slots};},
 persist(next,stash=Save.stash,credits=Save.credits){const before={board:Save.commissionBoard,stash:Save.stash,credits:Save.credits};Save.commissionBoard=next;Save.stash=stash;Save.credits=credits;Save.save();if(!Save.flush()){Save.commissionBoard=before.board;Save.stash=before.stash;Save.credits=before.credits;Save._dirty=true;return {ok:false,reason:'存档写入失败，本次操作未生效，请检查浏览器存储后重试'};}return {ok:true};},
 ensure(){if(!this.allowed())return {ok:false,reason:'请先进入私人事务所'};if(Save.commissionBoard!=null)return {ok:true};return this.persist(this.generate());},
 instance(id){const slots=Save.commissionBoard?.slots;return Array.isArray(slots)?slots.find(s=>s?.instanceId===id)||null:null;},
 valid(s){return !!(s&&this.definition(s.definitionId)&&['sealed','revealed','accepted','claimed'].includes(s.status)&&s.tier===this.definition(s.definitionId).tier&&JSON.stringify(s.objectives)===JSON.stringify(this.definition(s.definitionId).objectives)&&JSON.stringify(s.rewards)===JSON.stringify(this.definition(s.definitionId).rewards));},
 transition(id,from,to){if(!this.allowed())return {ok:false,reason:'当前无法操作委托'};const s=this.instance(id);if(!this.valid(s)||s.status!==from)return {ok:false,reason:'委托状态已变化或记录无法识别'};const next=this.clone(Save.commissionBoard);next.slots.find(s=>s.instanceId===id).status=to;return this.persist(next);},
 reveal(id){return this.transition(id,'sealed','revealed');},
 accept(id){return this.transition(id,'revealed','accepted');},
 progress(s){return (s.objectives||[]).map(o=>({...o,have:Save.stash.filter(e=>!e.gear&&e.id===o.id).reduce((n,e)=>n+(e.n||1),0)}));},
 rewardItem(r){if(r.kind==='attachment')return EQUIP.attachment(r.id);if(r.kind==='armor')return EQUIP.armor(GEAR.make(r.type,r.id));return ITEM_BY_ID[r.id]||null;},
 preview(id,requests){
  const s=this.instance(id),fail=reason=>({ok:false,reason});if(!this.valid(s)||s.status!=='accepted')return fail('委托不在可交付状态');
  const seen=new Set(),totals={},rows=[];
  for(const r of requests){const e=r.entry,n=Number(r.n);if(!e||!Save.stash.includes(e)||e.gear||!s.objectives.some(o=>o.id===e.id))return fail('材料已不在仓库或不符合目标');const key=Sales.id(e);if(seen.has(key))return fail('同一材料重复选择');seen.add(key);if(!Number.isSafeInteger(n)||n<1||n>(e.n||1))return fail('材料数量无效');totals[e.id]=(totals[e.id]||0)+n;rows.push({entry:e,n,fingerprint:JSON.stringify(e)});}
  if(s.objectives.some(o=>totals[o.id]!==o.n))return fail('请选择准确数量的全部材料');
  const taken=new Map(rows.map(r=>[r.entry,r.n])),next=[];for(const e of Save.stash){const n=taken.get(e)||0;if(!n)next.push(e);else if((e.n||1)>n)next.push({...e,n:e.n-n});}
  for(const r of s.rewards.items){const item=this.rewardItem(r);if(!item)return fail('奖励物品配置无法识别');let left=r.n;if(item.equip){while(left-->0)next.push({id:item.id,n:1,gear:this.clone(item)});continue;}const cap=stackLimit(item);for(let i=0;i<next.length&&left;i++){const e=next[i];if(e.gear||e.id!==item.id||(item.healCap&&e.cap!=null&&e.cap<item.healCap))continue;const add=Math.min(left,Math.max(0,cap-e.n));if(add){next[i]={...e,n:e.n+add};left-=add;}}while(left){const n=Math.min(cap,left);next.push({id:item.id,n});left-=n;}}
  if(next.length>STASH_SLOTS)return fail('交付后仓库仍无足够空间容纳全部奖励');if(!Number.isSafeInteger(Save.credits+s.rewards.cash))return fail('信用点数值超出范围');
  return {ok:true,id,rows,stash:next,cash:s.rewards.cash,rewards:this.clone(s.rewards),fingerprint:JSON.stringify(s)};
 },
 authorize(preview){if(!preview.ok)return null;const token='commission-'+(++this.serial);this.tokens.set(token,{id:preview.id,rows:preview.rows,fingerprint:preview.fingerprint});return token;},
 cancel(token){this.tokens.delete(token);},
 commit(token){const t=this.tokens.get(token);this.tokens.delete(token);if(!t||!this.allowed())return {ok:false,reason:'确认已失效，请重新核对'};if(t.fingerprint!==JSON.stringify(this.instance(t.id))||t.rows.some(r=>!Save.stash.includes(r.entry)||JSON.stringify(r.entry)!==r.fingerprint))return {ok:false,reason:'委托或材料已变化，请重新选择'};const p=this.preview(t.id,t.rows);if(!p.ok)return p;const board=this.clone(Save.commissionBoard);board.slots.find(s=>s.instanceId===t.id).status='claimed';const result=this.persist(board,p.stash,Save.credits+p.cash);if(result.ok){Game.sfx('sell');Base.render();}return result;}
};
