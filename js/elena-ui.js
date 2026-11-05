/* Office presentation; Sales and Commissions remain the transaction authorities. */
const ElenaUI={
 mounted:false,token:null,animation:null,lastError:'',
 active(){return Safehouse.view==='merchant'&&MerchantUI.key==='elena';},
 esc(s){return MerchantUI.esc(s);},
 mount(){if(this.mounted||!MerchantUI.detail)return;this.mounted=true;const d=MerchantUI.detail;this.nav=d.querySelector('.mb-person nav');this.originalNav=this.nav.innerHTML;
  this.workspace=document.createElement('section');this.workspace.className='el-workspace';this.workspace.hidden=true;d.querySelector('.mb-center').append(this.workspace);
  this.workspace.addEventListener('click',e=>{const b=e.target.closest('[data-el-action]');if(b)this.act(b.dataset.elAction,b.dataset.id);});
 },
 sync(){if(!MerchantUI.mounted)return;this.mount();const active=this.active(),d=MerchantUI.detail,custom=active&&MerchantUI.mode!=='sell';
  if(active){if(this.nav.dataset.office!=='true'){this.nav.dataset.office='true';this.nav.innerHTML='<button data-mb-mode="sell">'+Safehouse.icon('box')+'出售</button><button data-mb-mode="commissions">'+Safehouse.icon('task')+'私人委托</button><button data-mb-mode="personal">'+Safehouse.icon('archive')+'个人任务 <small>尚未开放</small></button>';}}
  else if(this.nav.dataset.office==='true'){delete this.nav.dataset.office;this.nav.innerHTML=this.originalNav;}
  d.classList.toggle('el-office',custom);this.workspace.hidden=!custom;d.querySelector('.mb-catalog').hidden=custom;d.querySelector('.mb-right').hidden=custom;
  this.nav.querySelectorAll('[data-mb-mode]').forEach(b=>b.classList.toggle('on',b.dataset.mbMode===MerchantUI.mode));
  if(!custom){this.closeConfirm();this.animation=null;return;}
  if(Safehouse.demo){this.workspace.innerHTML='<h2>私人事务所</h2><p>独立视觉稿不读取存档。请进入游戏查看已保存的私人委托。</p>';return;}
  if(MerchantUI.mode==='personal')this.renderPersonal();else this.render();
 },
 message(text,bad=false){this.lastError=bad?text:'';const p=this.workspace.querySelector('.el-feedback');if(p){p.textContent=text;p.classList.toggle('bad',bad);}Base.note(text,bad);},
 renderPersonal(){this.workspace.innerHTML='<header class="el-heading"><small>PERSONAL FILE / 人物档案</small><h2>她曾为了寻找一个人，建立这间事务所</h2></header><article class="el-story sh-metal"><b>个人任务 · 尚未开放</b><p>伊莲娜·莫罗，46岁，私人收藏家与古董鉴赏家。她研究历史文献与神秘学，凭借学识、信誉和多年积累的人脉经营一间没有公开招牌的私人事务所。</p><p>童年时，父亲在一次无法用常规科学解释的事件中失踪。多年以后，她仍在寻找线索，也开始帮助其他人寻找他们失去的东西。那场失踪的真相尚未明确。</p><p>她不亲自参与战斗。她保护委托人与执行者的身份，不接受伤害无辜者的委托，不故意隐瞒已知重大风险，并按约定支付报酬。面对真正需要帮助的人，她也会由事务所补贴费用。</p><p class="el-muted">固定剧情任务与信任成长将在后续开放。这里目前仅展示人物介绍。</p></article>';},
 rewards(s){return '<b>'+formatMoney(s.rewards.cash)+'</b>'+s.rewards.items.map(r=>{const it=Commissions.rewardItem(r);return '<span class="el-reward">'+Icons.bagTag(it,'')+this.esc(it?.name||r.id)+' ×'+r.n+'</span>';}).join('');},
 render(){const result=Commissions.ensure();if(!result.ok){this.workspace.innerHTML='<h2>委托尚未保存</h2><p class="el-feedback bad" role="status">'+this.esc(result.reason)+'</p><button data-el-action="retry">重试保存首批委托</button>';return;}
  const slots=Save.commissionBoard?.slots;this.workspace.innerHTML='<header class="el-heading"><div><small>PRIVATE OFFICE / 私人事务所</small><h2>私人委托</h2></div><span>首批来信 · 独立保存</span></header><p class="el-notice">周期刷新待行动日系统开放。首批两份均可接取，完成后保留结果，不补位；可提交已有仓库物品。</p><p class="el-feedback '+(this.lastError?'bad':'')+'" role="status" aria-live="polite">'+this.esc(this.lastError)+'</p><div class="el-cards">'+(Array.isArray(slots)?slots.map(s=>this.card(s)).join(''):'<p class="el-error">委托记录无法识别，已保留原存档；不会重新抽取。</p>')+'</div>';
  const envelope=this.workspace.querySelector('.el-opening');if(envelope)envelope.addEventListener('animationend',()=>this.finishReveal(),{once:true});
 },
 card(s){const esc=x=>this.esc(x),id=esc(s?.instanceId);if(!Commissions.valid(s))return '<article class="el-card"><h3>异常委托记录</h3><p>记录已保留，暂不能结算。不会通过重抽替换。</p></article>';
  if(s.status==='sealed'||this.animation===s.instanceId)return '<article class="el-card el-sealed" data-commission="'+id+'"><small>PRIVATE CORRESPONDENCE</small><div class="el-envelope '+(this.animation===s.instanceId?'el-opening':'')+'"><i></i><span>E·M</span></div><h3>一封尚未拆开的来信</h3><p>内容已随首批来信保存，拆封不会重新抽取。</p><button class="mb-gold" data-el-action="'+(s.status==='sealed'?'reveal':'skip')+'" data-id="'+id+'">'+(s.status==='sealed'?'拆封委托':'跳过动画')+'</button></article>';
  const progress=Commissions.progress(s),ready=progress.every(o=>o.have>=o.n),claimed=s.status==='claimed';
  return '<article class="el-card tier-'+s.tier+'" data-commission="'+id+'"><header><small>'+COMMISSION_TIERS[s.tier]+' · 寻物</small><span>'+({revealed:'待接取',accepted:ready?'材料齐备':'已接取',claimed:'已完成'}[s.status])+'</span></header><h3>'+esc(s.title)+'</h3><p>'+esc(s.description)+'</p><h4>提交材料</h4><ul>'+progress.map(o=>'<li>'+esc(ITEM_BY_ID[o.id]?.name||o.id)+'<span>×'+o.n+(claimed?'':' <small>仓库 '+o.have+'</small>')+'</span></li>').join('')+'</ul><h4>固定报酬</h4><div class="el-rewards">'+this.rewards(s)+'</div><footer>'+(s.status==='revealed'?'<button class="mb-gold" data-el-action="accept" data-id="'+id+'">接取委托</button>':claimed?'<b class="el-completed">约定已履行 · 奖励已领取</b>':'<button class="mb-gold" data-el-action="deliver" data-id="'+id+'" '+(!ready?'disabled':'')+'>选择材料 · 交付并领取</button><small>材料只在确认交付时扣除</small>')+'</footer></article>';
 },
 finishReveal(){if(!this.animation)return;this.animation=null;this.render();},
 act(action,id){if(!this.active()||MerchantUI.mode!=='commissions')return;if(action==='skip'){this.finishReveal();return;}if(action==='retry'){this.render();return;}if(action==='deliver'){this.confirm(id);return;}
  const r=action==='reveal'?Commissions.reveal(id):action==='accept'?Commissions.accept(id):null;if(!r)return;if(!r.ok){this.message(r.reason,true);return;}this.lastError='';if(action==='reveal'){this.animation=id;MerchantSpeech.say(Commissions.instance(id).tier===3?'highTier':'reveal','elena');}else MerchantSpeech.say('accept','elena');this.render();
 },
 closeConfirm(){if(this.token)Commissions.cancel(this.token);this.token=null;if(this.dialog?.open)this.dialog.close();},
 confirm(id){this.closeConfirm();const s=Commissions.instance(id);if(!Commissions.valid(s)||s.status!=='accepted')return;
  if(!this.dialog){this.dialog=document.createElement('dialog');this.dialog.className='el-checkout';document.body.append(this.dialog);this.dialog.addEventListener('cancel',()=>this.closeConfirm());this.dialog.addEventListener('close',()=>{if(!this.dialog.open)this.closeConfirm();});}
  this.deliveryId=id;this.eligible=Save.stash.filter(e=>!e.gear&&s.objectives.some(o=>o.id===e.id));
  this.dialog.innerHTML='<header><small>DELIVERY / 仓库材料交付</small><h2>'+this.esc(s.title)+'</h2><p>请明确选择仓库条目和数量。取消不会扣除材料；背包、保险箱和装备不参与。</p></header><div class="el-delivery-scroll">'+s.objectives.map(o=>'<section><h3>'+this.esc(ITEM_BY_ID[o.id].name)+' · 需要 '+o.n+' 件</h3>'+this.eligible.map((e,i)=>e.id!==o.id?'':'<label class="el-material"><input type="checkbox" data-el-entry="'+i+'">'+Icons.bagTag(stashItem(e),'')+'<span>'+this.esc(stashItem(e).name)+'<small>仓库条目 '+(i+1)+' · 持有 '+(e.n||1)+' 件</small></span><input aria-label="交付数量 '+this.esc(stashItem(e).name)+' '+(i+1)+'" data-el-count="'+i+'" type="number" min="1" max="'+(e.n||1)+'" step="1" value="1" disabled></label>').join('')+'</section>').join('')+'</div><footer><h3>一次性领取</h3><div class="el-rewards">'+this.rewards(s)+'</div><p class="el-validation" role="status"></p><div class="el-checkout-actions"><button class="mb-gold" data-el-pay disabled>交付并领取奖励</button><button data-el-cancel>取消</button></div></footer>';
  this.dialog.querySelector('[data-el-cancel]').onclick=()=>this.closeConfirm();this.dialog.addEventListener('input',this.validateHandler||(this.validateHandler=()=>this.validate()),{once:false});
  // addEventListener deduplicates this stable handler when reopening the dialog.
  this.dialog.querySelector('[data-el-pay]').onclick=ev=>{const token=this.token;if(!token)return;this.token=null;ev.currentTarget.disabled=true;const r=Commissions.commit(token);this.closeConfirm();if(r.ok){this.lastError='';MerchantSpeech.say('complete','elena');this.render();this.message('委托已完成，报酬已存入仓库和信用点账户');}else this.message(r.reason,true);};
  this.validate();this.dialog.showModal();
 },
 validate(){if(this.token)Commissions.cancel(this.token);this.token=null;const requests=[];this.dialog.querySelectorAll('[data-el-entry]').forEach(b=>{const i=Number(b.dataset.elEntry),input=this.dialog.querySelector('[data-el-count="'+i+'"]');input.disabled=!b.checked;if(b.checked)requests.push({entry:this.eligible[i],n:Number(input.value)});});const p=Commissions.preview(this.deliveryId,requests);this.dialog.querySelector('.el-validation').textContent=p.ok?'材料、仓库容量与报酬已核对。确认后立即保存。':p.reason;this.dialog.querySelector('[data-el-pay]').disabled=!p.ok;if(p.ok)this.token=Commissions.authorize(p);}
};
{
 const apply=Safehouse.applyView,mode=MerchantUI.setMode,identity=MerchantUI.renderIdentity;
 Safehouse.applyView=function(){const r=apply.apply(this,arguments);ElenaUI.sync();return r;};
 MerchantUI.renderIdentity=function(){const r=identity.apply(this,arguments);const ph=this.detail.querySelector('.mb-person-photo .mb-portrait-placeholder'),c=MERCHANT_UI_CONFIG[this.key];if(ph&&!SAFEHOUSE_CONFIG.merchants[this.key].asset)ph.innerHTML='<strong>'+this.esc(c.initial||'V')+'</strong><span>'+this.esc(c.english)+'</span><small>人物立绘待补充</small>';return r;};
 MerchantUI.setMode=function(value){if(this.key==='elena'&&!['sell','commissions','personal'].includes(value))return;if(this.key==='elena'&&['commissions','personal'].includes(value)){ElenaUI.closeConfirm();this.mode=value;this.selected=null;Tips.hide();Deal.hide();MerchantSales.sync();ElenaUI.sync();return;}const r=mode.apply(this,arguments);ElenaUI.sync();return r;};
}
