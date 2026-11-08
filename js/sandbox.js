/* General in-raid sandbox; generated ground loot is opt-in and never placed on real maps. */
const GroundLoot={
 cache:new Map(),halos:new WeakMap(),size:16,outline:true,
 halo(sprite,color,size=this.size){
  const key=color+':'+size;let colors=this.halos.get(sprite);if(!colors){colors=new Map();this.halos.set(sprite,colors);}if(colors.has(key))return colors.get(key);
  // Add one game pixel to the old thin contour, independent of the selected item size.
  const width=64,padding=1+Math.round(width/size),mask=document.createElement('canvas');mask.width=mask.height=width;
  const m=mask.getContext('2d');m.imageSmoothingEnabled=false;m.drawImage(sprite,0,0,width,width);m.globalCompositeOperation='source-in';m.fillStyle=color;m.fillRect(0,0,width,width);
  const tinted=document.createElement('canvas');tinted.width=tinted.height=width+padding*2;tinted.padding=padding;const c=tinted.getContext('2d');
  for(let y=-padding;y<=padding;y++)for(let x=-padding;x<=padding;x++)if(x||y)c.drawImage(mask,padding+x,padding+y);
  c.globalCompositeOperation='destination-out';c.drawImage(mask,padding,padding);colors.set(key,tinted);return tinted;
 },
 sprite(item){const im=item.icon?Icons.gear[item.icon]:Icons.get(item.id);if(!im)return null;if(!this.cache.has(im)){const c=document.createElement('canvas');c.width=c.height=40;c.getContext('2d').drawImage(im,4,4,40,40,0,0,40,40);this.cache.set(im,c);}return this.cache.get(im);},
 draw(c,b,x,y,tile){
  const entry=b.items.find(e=>e?.item);if(!entry)return;const sprite=this.sprite(entry.item);if(!sprite)return;
  const size=this.size,dx=x+(tile-size)/2,dy=y+tile-5-size+(b.offsetY||0);
  c.save();c.imageSmoothingEnabled=false;
  if(this.outline){const color=RARITY[U.clamp((entry.item.r||1)-1,0,RARITY.length-1)].color,halo=this.halo(sprite,color,size);if(halo){const px=size/(halo.width-2*halo.padding)*halo.padding,py=size/(halo.height-2*halo.padding)*halo.padding;c.save();c.globalAlpha*=.9;c.imageSmoothingEnabled=true;c.drawImage(halo,dx-px,dy-py,size+2*px,size+2*py);c.restore();}}
  c.drawImage(sprite,dx,dy,size,size);c.restore();
 },
 take(b){
  const p=Game.player,entry=b.items.find(e=>e?.item);if(!entry)return false;
  if(entry.item.equip){Game.openLoot(b,false,{silent:true});return Game.takeGear(entry,b.items.indexOf(entry));}
  const check=p.bag.canAdd(entry.item,entry.n,entry.cap);if(!check.ok){Game.toast(check.why);return false;}
  if(!p.bag.add(entry.item,entry.n,entry.cap))return false;
  b.items[b.items.indexOf(entry)]=null;Game.syncBoxState(b);Game.sfx('pickup');Game.toast('拾取 '+entry.item.name);if(Game.bagOpen)Game.renderBag();return true;
 }
};
const Sandbox={
 active:false,
 // Six columns, three examples per rarity; compare silhouettes as well as border colors.
 samples:[['life01',3,10],['antiq03',3,12],['ind01',3,14],
  ['life03',6,10],['elec01',6,12],['life08',6,14],
  ['life11',9,10],['elec07',9,12],['ind10',9,14],
  ['elec02',12,10],['elec06',12,12],['life20',12,14],
  ['life33',15,10],['life43',15,12],['ind14',15,14],
  ['odd02',18,10],['ind16',18,12],['life50',18,14]],
 start(){
  // Range startup normally consumes the prepared bag in memory; use an empty copy here.
  const bag=Save.bag,safe=Save.safe,gear=Save.gear;Save.bag=[];Save.safe=[];Save.gear=JSON.parse(JSON.stringify(gear));
  try{DoorSystem.startTest();}finally{Save.bag=bag;Save.safe=safe;Save.gear=gear;}
  this.active=true;Game.toasts=[];document.title='潮汐线 · 局内测试场';M.map.title='局内测试场';
  Game.player.x=M.cx(8);Game.player.y=M.cy(15);Game.input.aimAngle=-Math.PI/2;Game.updateCamera(true);
  const ui=document.getElementById('doorTestControls'),doors=ui.querySelector('details');doors.removeAttribute('open');doors.querySelector('summary').textContent='门体搭建与交互测试（展开）';
  const panel=document.createElement('section');panel.innerHTML='<b>局内测试场 · 地表物品</b><div class="tools"><label>物品尺寸<select data-ground-size><option>12</option><option selected>16</option><option>20</option><option>24</option></select> px</label><label><input type="checkbox" data-ground-outline checked>品质描边</label><label><input type="checkbox" data-sandbox-vision checked>全视野</label><button data-ground-reset>补回样品</button><button data-ground-clear>清空测试背包</button></div><small>六档各3件 · 左→右：白 / 绿 / 蓝 / 紫 / 金 / 红 · E拾取 · 样品不计入存档</small>';
  const legend=document.createElement('div');legend.className='tools';legend.style.gap='14px';legend.innerHTML=RARITY.map((r,i)=>'<span style="color:'+r.color+'">'+['白','绿','蓝','紫','金','红'][i]+' · '+r.name+'</span>').join('');panel.append(legend);ui.prepend(panel);panel.querySelector('[data-ground-size]').value=String(GroundLoot.size);panel.querySelector('[data-ground-outline]').checked=GroundLoot.outline;
  panel.querySelector('[data-ground-size]').onchange=e=>{GroundLoot.size=Number(e.target.value);};panel.querySelector('[data-ground-outline]').onchange=e=>{GroundLoot.outline=e.target.checked;};
  panel.querySelector('[data-ground-reset]').onclick=()=>this.populate();panel.querySelector('[data-ground-clear]').onclick=()=>{Game.player.bag.slots=[];Game.player.bag.safe=[];if(Game.bagOpen)Game.renderBag();Game.toast('测试背包已清空');};
  ui.querySelector('[data-door-reset]').onclick=()=>this.start();
  this.populate();Game.toasts=[];RaidValue.begin(Game.player);Game.update(1/60);Game.render();Game.toast('地表物品：六列依次为白、绿、蓝、紫、金、红，每档三件');
 },
 populate(){
  for(const box of [...Game.boxes])if(box.sandboxSample)Game.removePile(box);
  for(const [id,x,y]of this.samples){const item=ITEM_BY_ID[id];if(!item||!M.walkable(x,y))continue;const box=Game.makePile(x,y);box.groundLoot=true;box.sandboxSample=true;box.name=item.name;box.items=[{item,n:1,known:true}];}
  Game.interactKey=null;Game.toast('地表样品已补回');
 }
};

// A sandbox-only visibility switch makes size comparisons easy; disabling restores normal FOV.
{const render=Game.render;Game.render=function(){if(Sandbox.active&&this.rangeMode&&M.map?.id==='doors-test'&&document.querySelector('[data-sandbox-vision]')?.checked){M.visible.fill(1);M.seen.fill(1);M.raw.fill(1);}return render.apply(this,arguments);};}
