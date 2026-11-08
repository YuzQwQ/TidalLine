/* Door restrictions are per door instance, reset with each raid. Keys are matched by ID. */
const DoorSystem={
  isStudy(d){return DoorVisual.isSidePortal(d);},
  normalSide(d,p){
    const cells=d.cells||[[d.x,d.y]],xs=cells.map(c=>c[0]),ys=cells.map(c=>c[1]);
    const cx=(Math.min(...xs)+Math.max(...xs)+1)*CFG.TILE/2,cy=(Math.min(...ys)+Math.max(...ys)+1)*CFG.TILE/2;
    const side=d.kickFrom||(d.axis==='vertical'?'w':'n');
    if(d.axis==='vertical')return side==='w'?p.x<cx-2:side==='e'?p.x>cx+2:false;
    return side==='n'?p.y<cy-2:side==='s'?p.y>cy+2:false;
  },
  available(d,p){return d.doorType!=='barricade'||d.breached||d.open||this.normalSide(d,p);},
  findKey(d,p){
    if(!d.keyId)return null;
    /* 钥匙链优先：挂在身上就是为了随取随用，扣耐久也先扣它。 */
    for(const list of [p.bag?.chain||[],p.bag?.slots||[],p.bag?.safe||[]]){
      const entry=list.find(e=>e&&(e.n??1)>0&&e.item?.cat==='key'&&(e.item.id===d.keyId||e.item.doorKey===d.keyId)&&ItemCapacity.remaining(e)>=1);
      if(entry)return{list,entry};
    }
    return null;
  },
  hasKey(d,p){return !!this.findKey(d,p);},
  prepareOpen(d,p){
    if(d.doorType==='barricade'&&!d.breached){if(!this.normalSide(d,p))return{ok:false,message:'门被另一侧挡住了'};d.breached=true;return{ok:true,kicked:true};}
    if(d.doorType==='locked'&&!d.unlocked){
      const key=this.findKey(d,p);
      if(!key)return{ok:false,message:d.keyId?'需要对应钥匙：'+(ITEM_BY_ID[d.keyId]?.name||d.keyId):'此门尚未配置钥匙'};
      key.entry.cap=ItemCapacity.remaining(key.entry)-1;
      const broken=key.entry.cap<=0;
      if(broken)key.list.splice(key.list.indexOf(key.entry),1);
      /* 开了锁就把钥匙链的剩余耐久写回存档：断线 / 刷新不会把耐久刷回去。 */
      if(typeof Game!=='undefined'&&Game.syncRaidChain)Game.syncRaidChain();
      d.unlocked=true;return{ok:true,unlocked:true,keyBroken:broken};
    }
    return{ok:true};
  },
  label(d,p){if(d.open)return'关门';if(d.doorType==='barricade'&&!d.breached)return this.normalSide(d,p)?'踹开':'门被另一侧挡住';if(d.doorType==='locked'&&!d.unlocked)return this.hasKey(d,p)?'用钥匙开锁':'上锁（需要对应钥匙）';return'开门';},
  wallTop(d,x,y){
    const candidates=(d.cells||[[x,y]]).flatMap(([cx,cy])=>d.axis==='vertical'?[[cx,cy-1],[cx,cy+1],[cx-1,cy],[cx+1,cy]]:[[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]]);
    for(const [cx,cy]of candidates){const t=M.at(cx,cy);if(M.wallCell(t))return Art.get('tiles',t.art||'wall')||Art.get('tiles','wall');}
    return Art.get('tiles','wall');
  },
  drawCap(c,d,x,y,size,camX,camY){
    if(this.isStudy(d)){
      // The new portal stays inside its own tile; no separate half-wall cap.
      return;
    }
    // 纵向整扇门上移半格后，将原上方墙顶放到最末格的下半部。
    const vertical=d.axis==='vertical';if(vertical&&d.cells&&y!==Math.max(...d.cells.map(cell=>cell[1])))return;
    const top=this.wallTop(d,x,y);if(!top)return;
    const rect={x:x*size-camX,y:y*size-camY+(vertical?size/2:-size/2),w:size,h:size/2};
    const opacity=vertical?DoorVisual.sideOpacity(!!M.visible[M.idx(x,y)]):{wall:Game.wallTopAlpha(x,y)};
    if(vertical)DoorVisual.sidePost(c,rect,opacity.frame);
    c.save();c.globalAlpha*=opacity.wall;
    c.drawImage(top,0,0,top.naturalWidth||32,(top.naturalHeight||32)/2,rect.x,rect.y,rect.w,rect.h);c.restore();
  },
  floorImage(d,x,y){
    const own=M.at(x,y);if(own?.art&&own.art!=='wall')return Art.get('tiles',own.art)||Art.tile('.');
    for(const[dx,dy]of [[0,1],[0,-1],[1,0],[-1,0]]){const t=M.at(x+dx,y+dy);if(t&&!t.solid&&!t.door&&!t.container)return (t.art&&Art.get('tiles',t.art))||Art.tile(t.ch);}
    return Art.tile('.');
  },
  drawSurface(c,d,image,x,y,size,camX,camY){
    if(d.axis==='vertical')return;
    const world=Art.doorRect(d,image,x,y,size),rect={x:world.x-camX,y:world.y-camY,w:world.w,h:world.h};
    const sx=x*size-camX,sy=y*size-camY;
    DoorVisual.wallLayer(c,{x:sx,y:sy,w:size,h:size},rect,d,()=>Art.drawWallFaces(c,sx,sy,size,Art.wallEdges(x,y)));
  },
  drawStudy(c,d,image,rect){
    const barred=d.doorType==='barricade'&&!d.breached&&!this.normalSide(d,Game.player);
    DoorVisual.sidePortal(c,rect,{...d,barred},this.wallTop(d,d.x,d.y));
  },
  drawStudyGround(c,d,size,camX,camY){
    if(!d.open)return;const metal=d.safe||d.reinforced||d.doorType==='locked',image=Art.get('props',metal?'sdoor':'door');if(!image)return;
    const west=!M.baseWalkable(d.x+1,d.y)&&M.baseWalkable(d.x-1,d.y);
    const r=DoorVisual.sideGroundRect({x:d.x*size-camX,y:d.y*size-camY,w:size,h:size},west,metal);
    c.save();c.beginPath();
    for(let y=Math.floor((r.y+camY)/size);y<=Math.floor((r.y+r.h+camY-0.01)/size);y++)for(let x=Math.floor((r.x+camX)/size);x<=Math.floor((r.x+r.w+camX-0.01)/size);x++)
      if(M.baseWalkable(x,y))c.rect(x*size-camX,y*size-camY,size,size);
    c.clip();c.drawImage(image,r.sx,r.sy,r.sw,r.sh,r.x,r.y,r.w,r.h);c.restore();
  },
  startTest(){
    Range.start();Range.active=false;document.getElementById('rangePanel')?.classList.add('hidden');Game.targets=[];Game.boxes=[];Game.enemies=[];
    const rows=Array.from({length:18},(_,y)=>Array.from({length:26},(_,x)=>x===0||y===0||x===25||y===17?'#':'.'));
    for(let x=2;x<24;x++)rows[7][x]='#';for(let y=2;y<16;y++)rows[y][19]='#';
    const specs=[{id:'normal',cells:[[4,7]],axis:'horizontal'},{id:'kick-n',cells:[[8,7]],axis:'horizontal',doorType:'barricade',kickFrom:'n'},{id:'iron-h',cells:[[13,7]],axis:'horizontal',doorType:'locked',keyId:'door_key_test'},{id:'kick-w',cells:[[19,4]],axis:'vertical',sideStudy:true,doorType:'barricade',kickFrom:'w'},{id:'iron-v',cells:[[19,11]],axis:'vertical',sideStudy:true,doorType:'locked',keyId:'door_key_test'},{id:'study-v',cells:[[19,6]],axis:'vertical',sideStudy:true},{id:'steel-v',cells:[[19,14]],axis:'vertical',sideStudy:true,reinforced:true}];
    for(const d of specs)for(const[x,y]of d.cells)rows[y][x]='+';
    M.load(rows.map(r=>r.join('')),null,[],null);M.map={id:'doors-test',title:'门体开发测试',props:[]};M.tideEnabled=false;M.doors=[];
    for(const spec of specs){const d={...spec,x:spec.cells[0][0],y:spec.cells[0][1],open:false};M.doors.push(d);for(const[x,y]of d.cells)M.at(x,y).door=d;}
    Game.player.x=M.cx(8);Game.player.y=M.cy(5);Game.player.bag.slots=[];Game.player.bag.safe=[];Game.updateCamera(true);
    DoorTest.mount();
  }
};
