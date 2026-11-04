/* Shared presentation controller. Runtime uses Base/Save; demo uses an isolated snapshot. */
const Safehouse = {
  root:null, view:'home', demo:false, broadcastIndex:0, timer:null, paused:false,
  icon(name){
    const shapes={home:'M3 11 12 3l9 8M5 10v10h5v-6h4v6h5V10',box:'m3 7 9-4 9 4v11l-9 4-9-4Zm0 0 9 4 9-4M12 11v11',cart:'M2 4h3l3 11h11l3-8H6M9 20h.1M18 20h.1',task:'M8 4H4v18h16V4h-4M8 2h8v5H8ZM8 12h8M8 17h6',pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',archive:'M5 3h14v19H5ZM9 7h6M9 12h6M9 17h4',radio:'M5 11v9M9 9v13M13 11v9M18 5a10 10 0 0 1 0 14M3 4l12-3',cross:'M9 2h6v7h7v6h-7v7H9v-7H2V9h7Z',tool:'m5 3 5 5-3 3-5-5a6 6 0 0 0 7 8l8 8 5-5-8-8a6 6 0 0 0-9-6Z',gear:'m9 2 6 0 1 4 4 1 2 5-3 3 1 4-5 3-3-3-4 1-4-5 3-3-1-4 4-1ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',bed:'M3 7v15M21 11v11M3 17h18M3 11h18M7 7h4v4H7Z',heart:'M12 21 3 12a6 6 0 0 1 9-8 6 6 0 0 1 9 8ZM3 12h5l2-4 3 8 2-4h6',arrow:'m4 5 7 7-7 7m9-14 7 7-7 7',person:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 22v-3a8 8 0 0 1 16 0v3'};
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(shapes[name]||shapes.box)+'"/></svg>';
  },
  asset(key){const p=SAFEHOUSE_CONFIG.assets[key];return (!this.demo&&window.__UI_ASSETS__?.[key])||((this.demo?'../../../':'')+p);},
  mount(root,demo=false){
    if(this.root)return;
    this.root=root;this.demo=demo;this.paused=!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const main=root.querySelector('.base-main'),nav=root.querySelector('.base-nav'),legacy=root.querySelector('.base-hd');
    root.classList.add('sh-shell');root.innerHTML=`
      <header class="sh-top"><button class="sh-brand" data-sh="home"><span>≋</span><b>潮汐线<small>TIDAL LINE</small></b></button><nav aria-label="局外全局导航">${SAFEHOUSE_CONFIG.nav.map(n=>`<button data-sh="${n.id}" aria-label="${n.label}${n.state==='planned'?'（规划中）':''}">${this.icon(n.icon)}<span>${n.label}</span>${n.state==='planned'?'<i class="sh-nav-dot"></i>':''}</button>`).join('')}</nav><div class="sh-global"><div class="sh-wallet"><small>信用点</small><b data-sh-value="credits"></b></div><div class="sh-identity">${this.icon('person')}<span>撤离者<small>本地档案</small></span></div><button class="sh-settings" data-sh="settings" aria-label="界面说明">${this.icon('gear')}</button></div></header>
      <section class="sh-home"><div class="sh-room"><img class="sh-room-img" alt="暖色工作灯下的通讯桌、装备台、医疗角与储物货架"><div class="sh-room-shade"></div></div>
        <div class="sh-heading"><p>SAFEHOUSE / 环礁湾外围</p><h1>藏身处 <small>${demo?'Lv.3 <em>演示</em>':'行动准备区'}</small></h1><div class="sh-gold-rule"></div><p>整备、补给与行动的据点。</p>${demo?'<span class="sh-demo-tag">视觉演示 · 数值不连接游戏</span>':''}</div>
        <div class="sh-facilities">${SAFEHOUSE_CONFIG.facilities.map(f=>`<button class="sh-facility ${f.state==='planned'?'planned':''}" data-sh="${f.action}" style="--fx:${f.x}%;--fy:${f.y}%"><span class="sh-hex">${this.icon(f.icon)}</span><span><b>${f.name}</b><small>${f.subtitle}${demo&&f.state==='planned'?' · 演示':''}</small></span>${f.state==='planned'?'<em>规划</em>':''}</button>`).join('')}</div>
        <aside class="sh-overview sh-metal"><div class="sh-section-title">据点概览<small>BASE OVERVIEW</small></div><div class="sh-stat" data-sh="stash" role="button" tabindex="0">${this.icon('box')}<span>仓库容量</span><b data-sh-value="storage"></b></div><div class="sh-stat">${this.icon('tool')}<span>装备状态<small>当前防护耐久</small></span><b data-sh-value="durability"></b></div><button class="sh-stat" data-sh="recovery">${this.icon('heart')}<span>角色恢复</span><b>${demo?'1 / 4 <em>演示</em>':'未开放'}</b></button><button class="sh-stat" data-sh="workshop">${this.icon('gear')}<span>制造队列</span><b>${demo?'0 / 2 <em>演示</em>':'未开放'}</b></button><div class="sh-wave" aria-hidden="true"></div><p class="sh-overview-note">${demo?'完整产品结构预览':'维护服务与设施升级将在后续开放'}</p></aside>
        <div class="sh-statusbar sh-metal"><section class="sh-status-card"><h2>${this.icon('heart')}角色状态</h2><b data-sh-value="hp"></b><div class="sh-hp-track"><i></i></div><small data-sh-value="injury"></small></section><button class="sh-status-card sh-affairs" data-sh="tasks"><h2>${this.icon('task')}待处理事务</h2><b>${demo?'委托 2 项 <em>演示</em>':'委托系统待开放'}</b><small>${demo?'1 项奖励可领取 · 演示':'任务、委托与奖励将在此汇总'}</small></button><section class="sh-status-card sh-broadcast"><h2>${this.icon('radio')}环礁湾播报 <small data-sh-channel></small></h2><div class="sh-radio-row"><button data-radio="-1" aria-label="上一条播报">‹</button><p data-sh-broadcast></p><button data-radio="1" aria-label="下一条播报">›</button></div><div class="sh-radio-foot"><span data-sh-radio-title></span><div data-sh-dots></div><button data-radio="pause" aria-label="暂停自动播报"></button></div></section></div>
        <div class="sh-primary-actions"><button class="sh-action sh-prepare" data-sh="loadout">${this.icon('tool')}<span><b>备战</b><small>配置装备与出行物资</small></span><i>»</i></button><button class="sh-action sh-deploy" data-sh="maps">${this.icon('arrow')}<span><b>出发行动</b><small>选择地图，确认出发</small></span></button></div>
      </section><section class="sh-work" hidden><div class="sh-work-heading"><button data-sh="home">‹ 返回藏身处</button><h1 data-sh-work-title></h1><span>装备、库存和交易使用当前游戏规则</span></div><div class="sh-merchant-profile" hidden></div></section>
      <dialog class="sh-dialog"><button class="sh-dialog-close" aria-label="关闭说明">×</button><div class="sh-dialog-content"></div></dialog>`;
    root.querySelector('.sh-room-img').src=this.asset('room');
    if(legacy){legacy.hidden=true;root.appendChild(legacy);}
    const work=root.querySelector('.sh-work');if(nav)work.appendChild(nav);if(main)work.appendChild(main);
    if(demo){const p=document.createElement('div');p.className='sh-demo-work';p.innerHTML='<h2>完整布局预览</h2><p>此页不连接存档。请打开游戏体验仓库、商人、备战与地图选择。</p><a href="../../../index.html#base">打开游戏 ↗</a>';work.appendChild(p);}
    root.addEventListener('click',e=>{const target=e.target.closest('[data-sh]');if(target)this.route(target.dataset.sh);const radio=e.target.closest('[data-radio]');if(radio){if(radio.dataset.radio==='pause')this.paused=!this.paused;else this.broadcastIndex=(this.broadcastIndex+Number(radio.dataset.radio)+SAFEHOUSE_CONFIG.broadcasts.length)%SAFEHOUSE_CONFIG.broadcasts.length;this.renderBroadcast();this.syncTimer();}});
    root.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.sh-stat[role="button"]')){e.preventDefault();this.route(e.target.dataset.sh);}});
    const dialog=root.querySelector('dialog');dialog.querySelector('.sh-dialog-close').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
    document.addEventListener('visibilitychange',()=>this.syncTimer());
    this.refresh();this.route('home');
  },
  snapshot(){
    if(this.demo)return {credits:'¥ 2,480,000',storage:'318 / 600',durability:'良好 98%',hp:86,maxHp:100,injury:'轻微伤势 · 状态演示'};
    const protection=[Save.gear.body,Save.gear.helmet].filter(Boolean);
    const ratios=protection.map(i=>{const e=i.equip||i;const defs=e.type==='helmet'?HELMETS:BODIES;const max=e.max || defs.find(d=>e.id?d.id===e.id:d.lv===e.lv)?.dur;return max&&Number.isFinite(e.dur)?Math.max(0,Math.min(1,e.dur/max)):null;}).filter(x=>x!==null);
    return {credits:formatMoney(Save.credits),storage:Save.stash.length+' / '+STASH_SLOTS,durability:!protection.length?'未装备':ratios.length?Math.round(ratios.reduce((a,b)=>a+b,0)/ratios.length*100)+'%':'查看详情',hp:Save.hp,maxHp:CFG.P.HP,injury:'伤势系统未开放'};
  },
  refresh(){
    if(!this.root)return;const s=this.snapshot();
    for(const key of ['credits','storage','durability'])this.root.querySelector('[data-sh-value="'+key+'"]').textContent=s[key];
    this.root.querySelector('[data-sh-value="hp"]').textContent='生命 '+Math.round(s.hp*10)/10+' / '+s.maxHp;
    this.root.querySelector('[data-sh-value="injury"]').textContent=s.injury;
    this.root.querySelector('.sh-hp-track i').style.width=Math.max(0,Math.min(100,s.hp/s.maxHp*100))+'%';
    this.applyView();this.renderBroadcast();this.syncTimer();
  },
  applyView(){
    if(!this.root)return;
    const home=this.view==='home';this.root.dataset.view=this.view;
    this.root.querySelector('.sh-home').hidden=!home;this.root.querySelector('.sh-work').hidden=home;
    const merchant=['traders','doctor'].includes(this.view);
    for(const n of this.root.querySelectorAll('.sh-top [data-sh]')){const on=n.dataset.sh===this.view||(merchant&&n.dataset.sh==='traders');n.classList.toggle('on',on);if(n.tagName==='BUTTON')n.setAttribute('aria-current',on?'page':'false');}
    this.root.querySelector('[data-sh-work-title]').textContent={gunsmith:'装备台 · 枪械改装',loadout:'备战 · 装备与携带',stash:'仓库 · 物资管理',traders:'商人 · 交易与补给',doctor:'医生 · 药品与治疗'}[this.view]||'';
    const profile=this.root.querySelector('.sh-merchant-profile');profile.hidden=!merchant;
    if(merchant){const m=SAFEHOUSE_CONFIG.merchants[this.demo?(this.view==='doctor'?'doctor':'shop'):Base.tab]||SAFEHOUSE_CONFIG.merchants.shop;const key=m.asset;if(profile.dataset.asset!==(key||'pending')){profile.innerHTML='<img alt="'+m.name+'"><div><b>'+m.name+'</b><small>'+m.role+'</small><p>“'+m.quote+'”</p></div>';if(key)profile.querySelector('img').src=this.asset(key);else profile.querySelector('img').remove();profile.dataset.asset=key||'pending';}}
  },
  route(id){
    const planned=SAFEHOUSE_CONFIG.nav.find(x=>x.id===id&&x.state==='planned')||SAFEHOUSE_CONFIG.facilities.find(x=>x.action===id&&x.state==='planned');
    if(planned){this.explain(planned.label||planned.name,planned.message);return;}
    if(id==='settings'){this.explain('界面与功能状态','全局身份成长、设施升级和任务系统仍在规划中。环礁湾播报使用固定文本，可通过底部按钮暂停自动切换；界面不保存虚构进度。');return;}
    if(id==='recovery'){this.explain('角色恢复','伤势与自动恢复尚未开放。现阶段请在备战中使用医疗品，或前往医生购买收费治疗。');return;}
    if(id==='archive'){this.archive();return;}
    if(id==='maps'){if(this.demo)this.explain('出发行动','游戏中此按钮将打开现有地图选择，保留围栏区等已开放地图。最终确认才启动行动；本独立原型不启动游戏。');else{this.stopTimer();MapSelect.open();}return;}
    if(!['home','gunsmith','loadout','stash','traders','doctor'].includes(id)){this.explain('功能尚未开放','入口已预留，等待对应系统接入。当前操作不会改变资金、库存或任务状态。');return;}
    this.view=id;
    if(!this.demo){Tips.hide();Deal.hide();Ctx.hide();Base.closePicker();if(['traders','doctor'].includes(id))Base.tab=id==='doctor'?'doctor':(['shop','gun','doctor','viktor'].includes(Base.tab)?Base.tab:'shop');else Base.tab='stash';this.applyView();Base.page=0;Base.render();if(id!=='home')Base.renderStash();}
    this.refresh();
    if(id==='gunsmith'&&!this.demo&&typeof ModUI!=='undefined')ModUI.showPage();
  },
  explain(title,text){const d=this.root.querySelector('dialog');d.querySelector('.sh-dialog-content').innerHTML='<small class="sh-kicker">TIDAL LINE / 功能说明</small><h2></h2><p></p>';d.querySelector('h2').textContent=title;d.querySelector('p').textContent=text;if(!d.open)d.showModal();},
  archive(){
    if(this.demo){this.explain('档案 · 收集图鉴','游戏中读取真实的收集记录。任务档案、人物关系与历史线索预留在这里，不在本原型伪造发现记录。');return;}
    const d=this.root.querySelector('dialog'),items=ITEMS.filter(i=>!i.noCodex);
    d.querySelector('.sh-dialog-content').innerHTML='<small class="sh-kicker">ARCHIVE / 收集记录</small><h2>收集图鉴 · '+Save.codexCount()+' / '+items.length+'</h2><p>已发现物品显示名称与次数；未发现内容保持未知。</p><div class="sh-codex">'+items.map(i=>'<div><b>'+ (Save.codex[i.id]?esc(i.name):'未发现')+'</b><small>'+(Save.codex[i.id]?'收录 '+Save.codex[i.id].count+' 次':'未知藏品')+'</small></div>').join('')+'</div>';
    if(!d.open)d.showModal();
  },
  renderBroadcast(){if(!this.root)return;const b=SAFEHOUSE_CONFIG.broadcasts[this.broadcastIndex];this.root.querySelector('[data-sh-channel]').textContent=b.channel;this.root.querySelector('[data-sh-broadcast]').textContent=b.text;this.root.querySelector('[data-sh-radio-title]').textContent=b.title+' · 固定广播';this.root.querySelector('[data-sh-dots]').innerHTML=SAFEHOUSE_CONFIG.broadcasts.map((x,i)=>'<i class="'+(i===this.broadcastIndex?'on':'')+'"></i>').join('');const p=this.root.querySelector('[data-radio="pause"]');p.textContent=this.paused?'播放':'暂停';p.setAttribute('aria-label',this.paused?'播放自动播报':'暂停自动播报');},
  stopTimer(){if(this.timer!==null){clearInterval(this.timer);this.timer=null;}},
  syncTimer(){this.stopTimer();if(!this.root||this.paused||this.view!=='home'||document.hidden||(!this.demo&&Game.state!=='base'))return;this.timer=setInterval(()=>{this.broadcastIndex=(this.broadcastIndex+1)%SAFEHOUSE_CONFIG.broadcasts.length;this.renderBroadcast();},SAFEHOUSE_CONFIG.rotateMs);}
};

// Attach after all existing equipment extensions have been installed, before boot.
if(typeof Base!=='undefined'){
  const open=Base.open,close=Base.close,render=Base.render;
  Base.open=function(){if(!Safehouse.root)Safehouse.mount(document.querySelector('#baseVeil .base'));Safehouse.view='home';open.apply(this,arguments);Safehouse.refresh();};
  Base.close=function(){Safehouse.stopTimer();return close.apply(this,arguments);};
  Base.render=function(){const r=render.apply(this,arguments);Safehouse.refresh();return r;};
}
