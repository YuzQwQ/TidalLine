/* Whole-page pointer lock with a DOM-aware virtual cursor (including modal dialogs). */
const PagePointer={
 x:0,y:0,locked:false,pending:false,hover:null,drag:null,select:null,
 init(){
  this.cursor=document.createElement('div');this.cursor.id='pagePointer';this.cursor.setAttribute('popover','manual');this.cursor.setAttribute('aria-hidden','true');
  this.cursor.innerHTML='<svg width="18" height="24" viewBox="0 0 18 24"><path d="M1 1v19l5-5 4 8 4-2-4-8h7Z" fill="#f3dfad" stroke="#101b15" stroke-width="1.5"/></svg>';document.body.appendChild(this.cursor);
  this.status=document.createElement('div');this.status.id='pagePointerStatus';this.status.setAttribute('role','status');this.status.style.cssText='position:fixed;right:10px;bottom:6px;z-index:9999;pointer-events:none;font:11px sans-serif;color:#d5c6a2;background:#08110dc9;padding:4px 8px;border:1px solid #88764b66';this.status.textContent='点击页面锁定鼠标 · Esc释放';document.body.appendChild(this.status);
  const style=document.createElement('style');style.textContent='#pagePointer{position:fixed;inset:auto;margin:0;padding:0;border:0;background:none;overflow:visible;width:18px;height:24px;pointer-events:none;z-index:2147483647}#pagePointer[hidden]{display:none}.page-pointer-hover{outline:1px solid #dfc58a!important;outline-offset:1px}.page-pointer-select{position:fixed;inset:auto;margin:0;padding:4px;max-height:260px;overflow:auto;background:#142219;color:#eadab8;border:1px solid #a48e61;z-index:2147483646}.page-pointer-select button{display:block;width:100%;padding:8px;text-align:left;background:transparent;color:inherit;border:0;font:inherit}.page-pointer-select button[aria-selected=true]{background:#5d5031}';document.head.appendChild(style);this.cursor.hidden=true;
  for(const type of ['mousedown','mouseup','click','dblclick','contextmenu','mousemove','wheel','auxclick'])window.addEventListener(type,e=>this.event(e),{capture:true,passive:false});
  // Pointer events are also re-targeted by native lock; don't let them operate the body.
  for(const type of ['pointerdown','pointerup','pointermove'])window.addEventListener(type,e=>{if(this.locked&&e.isTrusted)e.stopImmediatePropagation();},true);
  document.addEventListener('pointerlockchange',()=>{
   this.locked=document.pointerLockElement===document.body;this.pending=false;this.cursor.hidden=!this.locked;
   this.status.textContent=this.locked?'鼠标已锁定 · Esc释放':'点击页面重新锁定鼠标 · Esc释放';
   if(this.locked){this.raise();this.paint();}else{this.clear();this.cursor.hidePopover?.();}
  });
  document.addEventListener('pointerlockerror',()=>{this.pending=false;this.status.textContent='鼠标未锁定 · 请再次点击页面';});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&this.locked){this.unlock();e.preventDefault();e.stopImmediatePropagation();}},true);
  window.addEventListener('blur',()=>this.clear());
 },
 lock(x,y){
  if(this.locked||this.pending||!document.body.requestPointerLock)return;
  if(Number.isFinite(x)){this.x=x;this.y=y;}this.pending=true;
  try{const p=document.body.requestPointerLock();p?.catch(()=>{this.pending=false;});}catch(e){this.pending=false;}
 },
 unlock(){if(document.pointerLockElement===document.body)document.exitPointerLock();},
 clear(){this.drag=null;this.arming=false;this.closeSelect();this.setHover(null);if(typeof Game!=='undefined'){Game.input.mouseDown=false;Game.input.mousePressed=false;Game.input.dodgePressed=false;for(const k in Game.input.keys)Game.input.keys[k]=false;}},
 raise(){const modal=[...document.querySelectorAll('dialog[open]')].at(-1)||null;if(this.modal!==modal||!this.cursor.matches(':popover-open')){this.modal=modal;if(this.cursor.showPopover){this.cursor.hidePopover();this.cursor.showPopover();}}},
 paint(){this.x=Math.max(0,Math.min(innerWidth-1,this.x));this.y=Math.max(0,Math.min(innerHeight-1,this.y));this.cursor.style.left=this.x+'px';this.cursor.style.top=this.y+'px';this.raise();},
 target(){return document.elementFromPoint(this.x,this.y)||document.body;},
 mouse(type,target,e){return target.dispatchEvent(new MouseEvent(type,{bubbles:!['mouseenter','mouseleave'].includes(type),cancelable:true,view:window,clientX:this.x,clientY:this.y,button:e.button,buttons:e.buttons,detail:e.detail||0,ctrlKey:e.ctrlKey,shiftKey:e.shiftKey,altKey:e.altKey,metaKey:e.metaKey,relatedTarget:null}));},
 setHover(target,e={}){if(target===this.hover)return;const old=this.hover;old?.closest('button,a,input,select,[role=button],.slot')?.classList.remove('page-pointer-hover');if(old){this.mouse('mouseout',old,e);this.mouse('mouseleave',old,e);}this.hover=target;if(target){target.closest('button,a,input,select,[role=button],.slot')?.classList.add('page-pointer-hover');this.mouse('mouseover',target,e);this.mouse('mouseenter',target,e);}},
 range(el){const r=el.getBoundingClientRect(),min=Number(el.min)||0,max=el.max===''?100:Number(el.max),step=el.step==='any'?0:Number(el.step)||1,f=Math.max(0,Math.min(1,(this.x-r.left-8)/Math.max(1,r.width-16)));let v=min+f*(max-min);if(step)v=min+Math.round((v-min)/step)*step;el.value=String(Math.max(min,Math.min(max,v)));el.dispatchEvent(new Event('input',{bubbles:true}));},
 closeSelect(){if(this.select){this.select.remove();this.select=null;}},
 openSelect(el){
  if(el.disabled)return;this.closeSelect();const box=document.createElement('div');this.select=box;box.className='page-pointer-select';box.setAttribute('popover','manual');box.setAttribute('role','listbox');box.setAttribute('aria-label',el.getAttribute('aria-label')||'选择选项');
  for(const option of el.options){if(option.hidden)continue;const b=document.createElement('button');b.type='button';b.textContent=option.text;b.disabled=option.disabled||option.parentElement.disabled;b.setAttribute('role','option');b.setAttribute('aria-selected',String(option.selected));b.onclick=()=>{el.value=option.value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));this.closeSelect();el.focus({preventScroll:true});};box.appendChild(b);}
  document.body.appendChild(box);const r=el.getBoundingClientRect();box.style.width=Math.min(innerWidth-16,Math.max(160,r.width))+'px';box.style.left=Math.max(8,Math.min(innerWidth-box.offsetWidth-8,r.left))+'px';box.showPopover();box.style.left=Math.max(8,Math.min(innerWidth-box.offsetWidth-8,r.left))+'px';box.style.top=Math.max(8,Math.min(innerHeight-box.offsetHeight-8,r.bottom))+'px';this.modal=undefined;this.raise();
 },
 event(e){
  if(!e.isTrusted)return;
  if(!this.locked){
   if(e.type==='mousedown'&&(e.button===0||e.button===2)&&document.body.requestPointerLock){this.arming=true;this.skipClick=e.button===0;this.lock(e.clientX,e.clientY);e.preventDefault();e.stopImmediatePropagation();}
   else if(this.arming&&e.type==='mouseup'){this.arming=false;e.preventDefault();e.stopImmediatePropagation();}
   else if(this.skipClick&&e.type==='click'){this.skipClick=false;e.preventDefault();e.stopImmediatePropagation();}
   return;
  }
  e.preventDefault();e.stopImmediatePropagation();
  if(this.arming){if(e.type==='mouseup')this.arming=false;return;}
  if(e.type==='click'&&this.skipClick){this.skipClick=false;return;}
  if(e.type==='auxclick'||e.button===3||e.button===4)return;
  if(e.type==='contextmenu')return; // Native contextmenu may be suppressed by locked mousedown.
  if(e.type==='mousemove'){this.x+=e.movementX;this.y+=e.movementY;this.paint();}
  const target=this.target();this.setHover(target,e);
  if(e.type!=='mousemove'&&e.type!=='wheel'&&target.closest(':disabled,[inert]'))return;
  if(e.type==='mousedown'){
   if(this.select&&!this.select.contains(target))this.closeSelect();
   const focus=target.closest('input,textarea,select,button,a,[tabindex],[contenteditable=true]');if(focus&&!focus.disabled)focus.focus({preventScroll:true});
   if(e.button===0&&target.matches('input[type=range]')&&!target.disabled){this.drag=target;this.range(target);}
   target.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:this.x,clientY:this.y,button:e.button,buttons:e.buttons,pointerType:'mouse'}));
  }
  if(e.type==='mousemove'&&this.drag){if(this.drag.isConnected)this.range(this.drag);else this.drag=null;}
  if(e.type==='mouseup'&&this.drag){this.drag.dispatchEvent(new Event('change',{bubbles:true}));this.drag=null;}
  if(e.type==='mouseup'&&e.button===2)this.mouse('contextmenu',target,e);
  if(e.type==='click'&&target.closest('select')){this.openSelect(target.closest('select'));return;}
  if(e.type==='wheel'){
   const proceed=target.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,clientX:this.x,clientY:this.y,deltaX:e.deltaX,deltaY:e.deltaY,deltaMode:e.deltaMode}));if(!proceed)return;
   for(let node=target;node;node=node.parentElement){const css=getComputedStyle(node),scale=e.deltaMode===1?16:e.deltaMode===2?node.clientHeight:1;let moved=false;if(/auto|scroll/.test(css.overflowY)&&node.scrollHeight>node.clientHeight){const before=node.scrollTop;node.scrollTop+=e.deltaY*scale;moved=node.scrollTop!==before;}if(/auto|scroll/.test(css.overflowX)&&node.scrollWidth>node.clientWidth){const before=node.scrollLeft;node.scrollLeft+=e.deltaX*scale;moved=moved||node.scrollLeft!==before;}if(moved)break;}return;
  }
  this.mouse(e.type,target,e);
 }
};
window.addEventListener('DOMContentLoaded',()=>PagePointer.init());
