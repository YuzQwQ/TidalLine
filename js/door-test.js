/* Isolated runtime layout tools for #doors-test; never writes formal maps or saves. */
const DoorTest={
  mode:'play',hover:null,stroke:null,undoStack:[],redoStack:[],serial:0,
  active(){return M.map?.id==='doors-test'&&Game.rangeMode&&Game.state==='playing';},
  snapshot(){return{rows:M.grid.map(row=>row.map(t=>t.ch).join('')),doors:JSON.parse(JSON.stringify(M.doors)),player:{x:Game.player.x,y:Game.player.y}};},
  restore(s){
    M.load(s.rows,null,[],null);M.map={id:'doors-test',title:'门体开发测试',props:[]};M.tideEnabled=false;
    M.doors=JSON.parse(JSON.stringify(s.doors));for(const d of M.doors)for(const[x,y]of d.cells)M.at(x,y).door=d;
    Object.assign(Game.player,s.player);Game.interactKey=null;Game.updateCamera(true);
  },
  tile(x,y,wall){M.grid[y][x]={ch:wall?'#':'.',terrainCh:wall?'#':'.',art:wall?'wall':null,solid:wall,obstacle:false,permanentWater:false,overlays:[],container:false,prop:null,opaque:wall,h:wall?3:2,box:null,door:null};},
  interior(x,y){return Number.isInteger(x)&&Number.isInteger(y)&&x>0&&y>0&&x<M.W-1&&y<M.H-1;},
  occupied(x,y){const p=Game.player,s=CFG.TILE,r=p.r||CFG.P.RADIUS;const left=x*s,top=y*s,bottom=(y+1)*s;return Math.hypot(p.x-U.clamp(p.x,left,left+s),p.y-U.clamp(p.y,top,bottom))<r;},
  removeDoor(d,wall){if(!d)return;for(const[x,y]of d.cells)this.tile(x,y,wall);M.doors=M.doors.filter(v=>v!==d);},
  config(){const q=s=>document.querySelector('#doorTestControls '+s);return{axis:q('[data-door-axis]').value,width:Number(q('[data-door-width]').value),type:q('[data-door-type]').value,side:q('[data-door-side]').value,keyId:q('[data-door-key-id]').value.trim()};},
  doorSpec(x,y){const o=this.config(),count=(dx,dy)=>Number(M.wallCell(M.at(x+dx,y+dy)))+Number(M.wallCell(M.at(x-dx,y-dy)));const axis=o.axis==='auto'?(count(0,1)>count(1,0)?'vertical':'horizontal'):o.axis;return{axis,sideStudy:axis==='vertical'&&o.width===1,cells:Array.from({length:o.width},(_,i)=>[x+(axis==='horizontal'?i:0),y+(axis==='vertical'?i:0)]),doorType:o.type==='reinforced'?'normal':o.type,reinforced:o.type==='reinforced',kickFrom:axis==='vertical'?(o.side==='first'?'w':'e'):(o.side==='first'?'n':'s'),keyId:o.keyId};},
  validate(x,y,mode){
    if(!this.interior(x,y))return'外围边界保留';
    if(mode==='door'){
      const d=this.doorSpec(x,y);
      if(d.doorType==='locked'&&!d.keyId)return'请先填写对应钥匙 ID';
      if(d.cells.some(([cx,cy])=>!this.interior(cx,cy)||!M.wallCell(M.at(cx,cy))))return'门洞必须完整放在墙上';
      if(d.cells.some(([cx,cy])=>this.occupied(cx,cy)))return'请先走离门洞位置';
    }
    if(mode==='wall'){
      const d=M.at(x,y).door,cells=d?d.cells:[[x,y]];
      if(cells.some(([cx,cy])=>this.occupied(cx,cy)))return'请先走离墙体位置';
    }
    return'';
  },
  paint(x,y,mode){
    const error=this.validate(x,y,mode);if(error){this.status(error);return false;}
    const t=M.at(x,y);
    if(mode==='door'){
      const spec=this.doorSpec(x,y),d={...spec,id:'test-placed-'+(++this.serial),x,y,open:false,safe:false,breached:false,unlocked:false};
      M.doors.push(d);for(const[cx,cy]of d.cells){this.tile(cx,cy,false);const t=M.at(cx,cy);t.ch='+';t.terrainCh='+';t.door=d;}
    }else{
      const wall=mode==='wall';if(!t.door&&M.wallCell(t)===wall)return false;
      this.removeDoor(t.door,wall);this.tile(x,y,wall);
    }
    Game.interactKey=null;this.status(mode==='door'?'门洞已放置，切换游玩测试后按 E 交互':mode==='wall'?'墙体已放置':'已擦除为地面');return true;
  },
  begin(e){
    if(!this.active()||this.mode==='play'||![0,2].includes(e.button)||Game.bagOpen||Game.lootOpen)return;
    e.preventDefault();e.stopImmediatePropagation();document.activeElement?.blur();
    Game.input.mouseDown=false;Game.input.mousePressed=false;Game.input.dodgePressed=false;
    const cell=this.point(e);this.hover=cell;this.stroke={before:this.snapshot(),mode:e.button===2?'erase':this.mode,last:cell,changed:false};
    this.stroke.changed=this.paint(cell.x,cell.y,this.stroke.mode);
  },
  move(e){
    if(!this.active())return;const p=this.point(e);this.hover=p;const s=this.stroke;if(!s||s.mode==='door'||(p.x===s.last.x&&p.y===s.last.y))return;
    const dx=p.x-s.last.x,dy=p.y-s.last.y,n=Math.max(Math.abs(dx),Math.abs(dy));
    for(let i=1;i<=n;i++)s.changed=this.paint(Math.round(s.last.x+dx*i/n),Math.round(s.last.y+dy*i/n),s.mode)||s.changed;s.last=p;
  },
  finish(){const s=this.stroke;if(!s)return;this.stroke=null;if(s.changed){this.undoStack.push(s.before);if(this.undoStack.length>80)this.undoStack.shift();this.redoStack=[];}this.refresh();},
  history(redo){this.finish();const from=redo?this.redoStack:this.undoStack,to=redo?this.undoStack:this.redoStack;if(!from.length)return;to.push(this.snapshot());this.restore(from.pop());this.refresh();this.status(redo?'已重做':'已撤销');},
  point(e){const r=Game.canvas.getBoundingClientRect(),s=CFG.TILE,maxX=Math.max(0,M.W*s-CFG.VIEW_W),maxY=Math.max(0,M.H*s-CFG.VIEW_H);return{x:Math.floor(((e.clientX-r.left)*CFG.VIEW_W/r.width+Math.round(U.clamp(Game.cam.x+Game.shakeX,0,maxX)))/s),y:Math.floor(((e.clientY-r.top)*CFG.VIEW_H/r.height+Math.round(U.clamp(Game.cam.y+Game.shakeY,0,maxY)))/s)};},
  status(text){const el=document.querySelector('[data-door-status]');if(el)el.textContent=text;},
  setMode(mode){this.finish();this.mode=mode;Game.input.mouseDown=false;Game.input.mousePressed=false;Game.input.dodgePressed=false;this.refresh();this.status(mode==='play'?'WASD 移动 · E 开关门':mode==='door'?'左键点墙开门洞；双格从落点向东 / 南延伸':'左键拖动绘制 · 右键拖动擦除 · Esc 回到游玩');},
  refresh(){const ui=document.getElementById('doorTestControls');if(!ui)return;for(const b of ui.querySelectorAll('[data-door-mode]')){const active=b.dataset.doorMode===this.mode;b.setAttribute('aria-pressed',String(active));}ui.querySelector('[data-door-undo]').disabled=!this.undoStack.length;ui.querySelector('[data-door-redo]').disabled=!this.redoStack.length;},
  giveKey(wrong){const key=this.config().keyId;if(!key){this.status('请先填写钥匙 ID');return;}const id=wrong?'wrong_'+key:key,item=ITEM_BY_ID[id]||{id,name:wrong?'不匹配的钥匙':'测试钥匙：'+key,short:'钥匙',cat:'key',r:2,w:.02,price:0,maxDur:1};if(!Game.player.bag.add(item,1)){this.status('背包空间不足');return;}Game.toast('已领取'+item.name+' · 耐久 '+item.maxDur);if(Game.bagOpen)Game.renderBag();},
  mount(){
    this.finish();this.mode='play';this.hover=null;this.undoStack=[];this.redoStack=[];
    document.getElementById('doorTestControls')?.remove();
    if(!document.getElementById('doorTestStyle')){const style=document.createElement('style');style.id='doorTestStyle';style.textContent='#doorTestControls{position:fixed;left:10px;top:10px;z-index:150;max-width:min(760px,calc(100vw - 20px));max-height:42vh;overflow:auto;background:#14231bf2;border:1px solid #688677;color:#dce3d1;padding:9px;font:13px sans-serif;box-sizing:border-box}#doorTestControls .tools{display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin:6px 0}#doorTestControls button{width:auto;margin:0;padding:6px 9px;min-height:28px;font-size:12px;line-height:1.2}#doorTestControls button[aria-pressed=true]{background:#a5c5a4;color:#15251c}#doorTestControls button:disabled{opacity:.4}#doorTestControls select,#doorTestControls input{background:#24372e;color:#e4ecd9;border:1px solid #688677;padding:4px;font:12px sans-serif;max-width:155px}#doorTestControls label{display:inline-flex;align-items:center;gap:4px}#doorTestControls summary{cursor:pointer}#doorTestControls [data-door-status]{color:#b9c8b1;font-size:12px;min-height:15px}';document.head.appendChild(style);}
    const ui=document.createElement('div');ui.id='doorTestControls';ui.innerHTML='<details open><summary>门体测试 · 场景搭建工具</summary><div class="tools"><button data-door-mode="play">游玩测试</button><button data-door-mode="wall">铺墙</button><button data-door-mode="door">开门洞</button><button data-door-mode="erase">擦除</button><button data-door-undo>撤销</button><button data-door-redo>重做</button><label><input type="checkbox" data-door-grid checked>编辑网格</label></div><div class="tools"><label>墙体走向<select data-door-axis><option value="auto">自动判断</option><option value="horizontal">东西走向（横墙）</option><option value="vertical">南北走向（竖墙）</option></select></label><label>门洞宽度<select data-door-width><option value="1">单格</option><option value="2">双格</option></select></label><label>门类型<select data-door-type><option value="normal">普通门</option><option value="reinforced">强化门</option><option value="barricade">单向受阻门</option><option value="locked">上锁铁门</option></select></label><label>允许踹开侧<select data-door-side><option value="first">北侧 / 西侧</option><option value="second">南侧 / 东侧</option></select></label></div><div class="tools"><label>钥匙 ID<input data-door-key-id value="door_key_test" aria-label="测试钥匙 ID"></label><button data-door-key>领取对应钥匙</button><button data-door-wrong>领取错误钥匙</button><button data-door-states>复位门状态</button><button data-door-reset>重置场景</button></div><div data-door-status>游玩：WASD 移动 · E 开门。铺墙 / 擦除可拖动，右键擦除，Esc 返回游玩。</div></details>';
    for(const b of ui.querySelectorAll('[data-door-mode]'))b.onclick=()=>this.setMode(b.dataset.doorMode);
    ui.querySelector('[data-door-undo]').onclick=()=>this.history(false);ui.querySelector('[data-door-redo]').onclick=()=>this.history(true);
    ui.querySelector('[data-door-key]').onclick=()=>this.giveKey(false);ui.querySelector('[data-door-wrong]').onclick=()=>this.giveKey(true);
    ui.querySelector('[data-door-reset]').onclick=()=>{this.finish();DoorSystem.startTest();};
    ui.querySelector('[data-door-states]').onclick=()=>{this.finish();const before=this.snapshot();for(const d of M.doors){if(d.cells.some(([x,y])=>this.occupied(x,y)))continue;d.open=false;d.breached=false;d.unlocked=false;}this.undoStack.push(before);this.redoStack=[];this.refresh();this.status('已复位门状态；脚下的门会保留，移开后可再次复位');};
    ui.addEventListener('keydown',e=>{if(e.key==='Escape'){this.setMode('play');document.activeElement?.blur();e.stopPropagation();}else if(e.target.matches('input,select,textarea')||e.key===' '||e.key==='Enter')e.stopPropagation();});
    // Controls must not leave game movement keys held or leak scroll to interaction cycling.
    ui.addEventListener('focusin',()=>{Game.input.keys={};});ui.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});document.body.appendChild(ui);
    if(!this.bound){this.bound=true;Game.canvas.addEventListener('mousedown',e=>this.begin(e),true);Game.canvas.addEventListener('mousemove',e=>this.move(e));Game.canvas.addEventListener('mouseleave',()=>{this.hover=null;this.finish();});window.addEventListener('mouseup',()=>this.finish());window.addEventListener('blur',()=>this.finish());window.addEventListener('keydown',e=>{if(this.active()&&this.mode!=='play'&&e.key==='Escape'){this.setMode('play');e.preventDefault();e.stopImmediatePropagation();}},true);}
    this.refresh();
  },
  render(c,camX,camY){
    if(!this.active()||this.mode==='play')return;const s=CFG.TILE;
    c.save();if(document.querySelector('[data-door-grid]')?.checked){c.strokeStyle='rgba(211,232,205,.2)';c.lineWidth=.6;c.beginPath();for(let x=0;x<=M.W;x++){c.moveTo(x*s-camX,-camY);c.lineTo(x*s-camX,M.H*s-camY);}for(let y=0;y<=M.H;y++){c.moveTo(-camX,y*s-camY);c.lineTo(M.W*s-camX,y*s-camY);}c.stroke();}
    const p=this.hover;if(p){const mode=this.stroke?.mode||this.mode,error=this.validate(p.x,p.y,mode),cells=mode==='door'?this.doorSpec(p.x,p.y).cells:[[p.x,p.y]];c.fillStyle=error?'rgba(228,95,77,.35)':'rgba(135,217,166,.35)';c.strokeStyle=error?'#ef9688':'#c6e6b9';c.lineWidth=1;for(const[x,y]of cells){c.fillRect(x*s-camX,y*s-camY,s,s);c.strokeRect(x*s-camX+.5,y*s-camY+.5,s-1,s-1);}c.font='10px sans-serif';c.fillStyle='#ecf1dd';c.fillText('('+p.x+', '+p.y+')'+(error?' '+error:''),Math.max(4,p.x*s-camX),Math.max(14,p.y*s-camY-5));}c.restore();
  }
};
