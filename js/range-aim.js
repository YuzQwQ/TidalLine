/* Firing-range-only settings panel and readouts; runtime is shared in aim.js. */
Object.assign(RangeAim,{
 fields:[['shoulder','肩射稳定进度',.1,.9,.01],['shoulderZoom','肩射放大',1,1.4,.01],['exitTime','退出时间 s',.05,.5,.01],
  ['tapTime','空格长按阈值 s',.1,.35,.01],['adsV','瞄准纵后坐 ×',.3,1,.01],['adsH','瞄准横后坐 ×',.3,1,.01],
  ['adsGrowth','瞄准连射增长 ×',.3,1,.01],['moveV','行走纵后坐 ×',1,2,.05],['moveH','行走横后坐 ×',1,2,.05],
  ['moveGrowth','行走连射增长 ×',1,2,.05],['moveSpread','行走散布 ×',1,2,.05],['sprintSpread','冲刺散布 ×',1,3,.05],
  ['ironZoom','普通瞄具画面放大',1,2,.05],['scopeZoom','光学瞄具画面放大',1,2,.05],
  ['lowView','低倍镜视距倍率',1.15,3,.05],['scopeView','精密镜视距倍率',1.15,3,.05],
  ['prismView','棱镜视距倍率',1.15,3,.05],['variableView','可变镜视距倍率',1.15,3,.05],['longView','远程镜视距倍率',1.15,4,.05],
  ['viewBase','观察区基准 ×',1,2,.05],['viewGain','倍率观察扩展 ×',0,2,.05],['panSpeed','瞄准平移速度 ×',.25,2,.05]],
 mount(){
  if(!Range.panel)return;
  let box=Range.panel.querySelector('[data-range-aim]');if(box)return;
  box=document.createElement('details');box.dataset.rangeAim='';box.className='rg-grp';
  box.innerHTML='<summary>射击姿态实验 · 展开调参<span data-ra-status style="display:block;pointer-events:none;font-size:10px;line-height:1.7;color:#b8c7b7"></span></summary><div style="padding:8px;font-size:11px;line-height:1.8"><label><input type="checkbox" data-ra-enable checked> 启用七参数姿态</label><p>Shift 肩射 · 按住右键瞄准<br>空格短按闪避 / 长按移动冲刺</p>'+this.fields.map(([k,label,min,max,step])=>'<label style="display:flex;justify-content:space-between;margin:5px 0">'+label+'<input style="width:68px" type="number" data-ra-setting="'+k+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+this.settings[k]+'"></label>').join('')+'<button data-ra-reset>复位姿态规则</button> <button data-ra-copy>复制规则 JSON</button></div>';
  box.querySelector('[data-ra-enable]').checked=this.enabled;
  box.querySelector('[data-ra-enable]').onchange=e=>{this.enabled=e.target.checked;this.clear();Game.player.resetAim();};
  box.querySelectorAll('[data-ra-setting]').forEach(el=>el.onchange=()=>{const n=Number(el.value);if(Number.isFinite(n)){this.settings[el.dataset.raSetting]=U.clamp(n,Number(el.min),Number(el.max));el.value=this.settings[el.dataset.raSetting];}});
  box.querySelector('[data-ra-reset]').onclick=()=>{this.settings={...this.defaults};this.clear();box.remove();this.mount();Game.player.resetAim();};
  box.querySelector('[data-ra-copy]').onclick=()=>{const data=JSON.stringify(this.settings,null,2);if(navigator.clipboard?.writeText)navigator.clipboard.writeText(data).then(()=>Game.toast('姿态规则已复制')).catch(()=>window.prompt('复制姿态规则',data));else window.prompt('复制姿态规则',data);};
  Range.panel.insertBefore(box,Range.panel.querySelector('.rg-params'));
 },
 status(){const el=Range.panel?.querySelector('[data-ra-status]');if(!el||!Game.player)return;const s=this.state(Game.player);el.textContent=s.mode+' · 稳定 '+Math.round(s.a*100)+'% · '+s.zoom.toFixed(2)+'×画面 · 视距 '+this.opticView(Game.player.weapon).toFixed(2)+' · 散布 '+(Game.player.spread*180/Math.PI).toFixed(2)+'°';}
});
{
 const original={start:Range.start,exit:Range.exit,refresh:Range.refreshPanel,tick:Range.tick,derived:Range.derivedHtml};
 Range.start=function(){RangeAim.reset();return original.start.apply(this,arguments);};
 Range.exit=function(){RangeAim.reset();return original.exit.apply(this,arguments);};
 Range.refreshPanel=function(){const result=original.refresh.apply(this,arguments);RangeAim.mount();return result;};
 Range.derivedHtml=function(){const html=original.derived.apply(this,arguments);if(!RangeAim.active()||!Game.player)return html;const w=Game.player.weapon,d=RangeAim.physics(w),deg=r=>(r*180/Math.PI).toFixed(2)+'°';return html.replace(/<\/div>$/,'<div class="rg-tip">姿态：腰射基础 '+deg(d.spreadBase)+' · 完全瞄准 '+deg(d.spreadBase*RangeAim.precision(w)*d.opticPrecision)+'<br>瞄具精度收益从肩射节点之后逐渐生效。</div></div>');};
 Range.tick=function(dt){const result=original.tick.call(this,dt);RangeAim.status();return result;};
}
