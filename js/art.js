/* ============================================================
   资源加载：物品/装备图标（Icons）与场景贴图（Art）
   缺图不报错，各自退回代码画的临时图形。
   ============================================================ */

const Icons = {
  map: {},          // id -> HTMLImageElement | null
  gear: {},         // 装备图标 id -> HTMLImageElement | null（rifle / helmet3 / body5 …）
  base: null,       // 内联的 dataURL 表（单文件版用）

  init(inlineMap) {
    this.base = inlineMap || null;
    this.map = {};
    this.gear = {};
    const loading = new Map();
    const jobs = ITEMS.map(async it => {
      if ((Medical.is(it) || it.cat === 'ammo') && !it.iconId) { this.map[it.id] = null; return; }
      const key = 'items/' + (it.iconId || it.id);
      if (!loading.has(key)) loading.set(key, new Promise(resolve => {
      const hit = inlineMap && (inlineMap[key] || inlineMap[it.id]);
      const src = hit || ('assets/' + key + '.png');
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
      }));
      this.map[it.id] = await loading.get(key);
    });

    // 装备图标：缺图不算错，界面会退回文字
    for (const id of ART.gear) {
      jobs.push(new Promise(resolve => {
        const key = 'gear/' + id;
        const hit = inlineMap && inlineMap[key];
        const img = new Image();
        img.onload = () => { this.gear[id] = img; resolve(); };
        img.onerror = () => { this.gear[id] = null; resolve(); };
        img.src = hit || ('assets/' + key + '.png');
      }));
    }
    return Promise.all(jobs);
  },

  get(id) { return this.map[id] || null; },

  /* Inspectors use native-size originals. Grid icons and scene preloads stay small. */
  detailSource(item) {
    if (!item) return null;
    const key=item.icon?'gear/'+canonicalWeaponId(item.icon):'items/'+(item.iconId||item.id);
    return (typeof DETAIL_ART!=='undefined'&&DETAIL_ART[key])||null;
  },
  detailTag(item,cls) {
    const src=this.detailSource(item);
    /* 单文件分发版（潮汐线.html）是把所有资源内联的一个 HTML，身边没有 assets/ 目录：
       原图必然 404 再回落到 48px 图。干脆一开始就不发这个请求，省掉一屏失败记录。 */
    const solo = typeof window!=='undefined' && window.__SELF_CONTAINED__===true;
    if(!src||solo)return item&&!item.id&&!item.icon?'<span>'+esc((item.short||item.name||'·').charAt(0))+'</span>':this.bagTag(item,cls);
    const fallback=item.icon?this.gear[item.icon]?.src:this.get(item.id)?.src;
    return '<img class="'+esc((cls||'')+' item-detail-original')+'" src="'+esc(src)+'" alt="'+esc(item.name||item.short||'物品')+'" loading="lazy" decoding="async" data-detail-image data-detail-fallback="'+esc(fallback||'')+'">';
  },
  bindDetailImages(root) {
    if(!root?.querySelectorAll)return;
    for(const img of root.querySelectorAll('img[data-detail-image]'))img.onerror=()=>{
      img.onerror=null;img.classList.remove('item-detail-original');
      if(img.dataset.detailFallback)img.src=img.dataset.detailFallback;
      else img.replaceWith(document.createTextNode(img.alt||'·'));
    };
  },

  /* 给 DOM 用：有图返回 <img>，没图返回一个同尺寸的色块占位，
     这样有没有贴图的两种状态在列表里是对齐的 */
  tag(id, cls) {
    cls = cls || 'ico';
    const img = this.get(id);
    if (img) {
      const item = ITEM_BY_ID[id], color = item && item.cat === 'ammo' ? RARITY[item.r-1].color : null;
      return '<img class="' + cls + '" src="' + img.src + '" alt=""' +
        (color ? ' style="background:'+color+'30;box-shadow:inset 0 0 0 1px '+color+'70"' : '') + '>';
    }
    const it = ITEM_BY_ID[id];
    const c = it ? RARITY[it.r - 1].color : '#3a4a44';
    /* 缺图时仍按等级数字与稀有度色兜底。 */
    const glyph = (it && it.cat === 'ammo') ? String(it.level) : (Medical.is(it) ? (it.short || it.name) : '');
    return '<span class="' + cls + ' ph" style="background:' + c +
      '1f;border-color:' + c + '4d;color:' + c + '">' + esc(glyph) + '</span>';
  },

  /* 装备图标：有图用图，没画就退回一个汉字（步 / 盔 / 甲 …） */
  gearIcon(id, txt) {
    const img = this.gear[id];
    return img ? '<img src="' + img.src + '" alt="">' : '<span>' + (txt || '·') + '</span>';
  },

  /* 背包 / 仓库里的图标：装备走 gear 图，普通物品走 items 图 */
  bagTag(item, cls) {
    if (!item) return '';
    if (item.icon) {
      const img = this.gear[item.icon];
      if (img) return '<img class="' + (cls || 'ico-bag') + '" src="' + img.src + '" alt="">';
      return '<span class="' + (cls || 'ico-bag') + ' gl">' +
        esc((item.short || item.name || '?').charAt(0)) + '</span>';
    }
    return this.tag(item.id, cls);
  }
};

/* ---------------- 场景资源 ----------------
   角色 / 物件 / 地形，都是 32×32。
   缺图不会报错，会退回成代码画的临时图形（色块、圆、方块）。
   -------------------------------------------------- */
const Art = {
  map: {},
  containerOutlines: new WeakMap(),

  init(inlineMap) {
    this.map = {};
    this.containerOutlines = new WeakMap();
    const jobs = [];
    const load = (key) => {
      jobs.push(new Promise(resolve => {
        const src = (inlineMap && inlineMap[key])
          ? inlineMap[key]
          : ('assets/' + key + '.png');
        const img = new Image();
        img.onload = () => { img.artKey=key; this.map[key] = img; resolve(); };
        img.onerror = () => { this.map[key] = null; resolve(); };
        img.src = src;
      }));
    };

    for (const g of ['props', 'tiles']) {
      for (const id of ART[g]) load(g + '/' + id);
    }
    for (const id of (ART.effects || [])) load('effects/' + id);
    // 角色：每个角色按三个方向各加载一张
    for (const id of ART.chars) {
      for (const d of ART.charDirs) load('chars/' + id + '_' + d);
    }
    for (const state of Object.keys(PLAYER_ANIMS)) {
      for (const dir of ART.charDirs) load('anim/player_' + state + '_' + dir);
    }
    if(typeof HUMAN_ANIMS!=='undefined')for(const id of ['scav','holdout','retriever'])for(const state of Object.keys(HUMAN_ANIMS)){
      if(id==='retriever'&&state==='pump')continue;
      for(const dir of ART.charDirs)load('anim/'+id+'_'+state+'_'+dir);
    }
    return Promise.all(jobs);
  },

  get(group, id) { return this.map[group + '/' + id] || null; },

  /* Cache an outer-only 1px silhouette. No pixel reads: file:// images work too. */
  containerOutline(image) {
    if(this.containerOutlines.has(image))return this.containerOutlines.get(image);
    if(!(image.naturalWidth||image.width)||!(image.naturalHeight||image.height))return null;
    const w=CFG.TILE,h=CFG.TILE;
    const mask=document.createElement('canvas');mask.width=w;mask.height=h;
    const m=mask.getContext('2d');m.imageSmoothingEnabled=false;m.drawImage(image,0,0,w,h);m.globalCompositeOperation='source-in';m.fillStyle='#9da59f';m.fillRect(0,0,w,h);
    const halo=document.createElement('canvas');halo.width=w+2;halo.height=h+2;
    const c=halo.getContext('2d');c.imageSmoothingEnabled=false;
    for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)if(x||y)c.drawImage(mask,1+x,1+y);
    c.globalCompositeOperation='destination-out';c.drawImage(mask,1,1);c.globalCompositeOperation='source-over';
    this.containerOutlines.set(image,halo);return halo;
  },

  drawContainerOutline(c,image,x,y,size,opened) {
    const halo=this.containerOutline(image);if(!halo)return;
    const px=size/(halo.width-2),py=size/(halo.height-2);
    c.save();c.globalAlpha*=opened ? 0.65 : 0.9;c.imageSmoothingEnabled=false;
    c.drawImage(halo,x-px,y-py,size+2*px,size+2*py);c.restore();
  },

  // 家具方向使用独立重绘图，固定相机和光照，不旋转或镜像正面贴图。
  prop(prop) {
    const original = prop.art || prop.id;
    const facing = prop.facing === 'side' || prop.facing === 'back' ? prop.facing : 'front';
    const suffix=facing==='front'?'':'_'+facing;
    if(prop.footprint&&prop.footprint[0]*prop.footprint[1]>1){
      const native=this.get('props',original+'_large'+suffix);
      if(native)return native;
    }
    const base=original;
    return (facing !== 'front' && this.get('props', base + '_' + facing)) || this.get('props', base);
  },

  propBounds(image) {
    if(image.propBounds)return image.propBounds;
    const prepared=PROP_SPRITE_BOUNDS[(image.artKey||'').replace(/^props\//,'')];
    if(prepared)return image.propBounds=prepared;
    const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
    let left=canvas.width,top=canvas.height,right=-1,bottom=-1;
    try {
      const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]){
        left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
      }
    }catch(_){left=top=0;right=canvas.width-1;bottom=canvas.height-1;}
    return image.propBounds=right>=left?[left,top,right-left+1,bottom-top+1]:[0,0,canvas.width,canvas.height];
  },

  propRect(prop,image,tileSize) {
    if(prop.ground)return {sx:0,sy:0,sw:image.naturalWidth,sh:image.naturalHeight,
      x:prop.x*tileSize,y:prop.y*tileSize,w:tileSize,h:tileSize};
    /* 绘制盒按 propVisual：家具可以"占 1 格、画 1.5 格高"（落地钟这类窄高件），
       碰撞与遮挡仍只看 footprint。贴底、居中都以占地为准，只有尺寸预算用绘制盒，
       所以放大的图只会向上长，不会往下沉或整体偏移。 */
    const [w,h]=M.propVisual(prop),[fw,fh]=M.propSize(prop),[sx,sy,sw,sh]=this.propBounds(image);
    const scale=Math.min((w*tileSize-4)/sw,(h*tileSize-4)/sh),dw=sw*scale,dh=sh*scale;
    return {sx,sy,sw,sh,x:prop.x*tileSize+(fw*tileSize-dw)/2,y:(prop.y+fh)*tileSize-3-dh,w:dw,h:dh};
  },

  // 方向沿墙体走向命名，不能旋转正面位图，否则立面和光源都会跟着转。
  door(door) {
    if(door.doorType==='barricade'&&!door.breached&&!door.open){const normal=typeof DoorSystem!=='undefined'&&Game.player&&DoorSystem.normalSide(door,Game.player);return this.get('props',(normal?'door':'door_barricade')+(door.axis==='vertical'?'_side':''))||this.get('props','door');}
    if(door.doorType==='locked'&&!door.unlocked&&!door.open)return this.get('props','door_locked'+(door.axis==='vertical'?'_side':''))||this.get('props','sdoor');
    if(door.doorType==='locked')door={...door,reinforced:true};
    const base = door.safe || door.reinforced ? 'sdoor' : 'door';
    const state = door.open ? '_open' : '';
    const key = base + (door.axis === 'vertical' ? '_side' : '') + state;
    return this.get('props', key) || this.get('props', base + state);
  },

  doorRect(door, image, x, y, size) {
    // 侧门与半格墙顶交换屏幕位置：门体上移半格，尺寸与碰撞占地保持原值。
    const span=door.cells?door.cells.length:1,study=typeof DoorSystem!=='undefined'&&DoorSystem.isStudy(door),lift=door.axis==='vertical'&&!study?size/2:0;
    return {x:(door.cells?door.x:x)*size,y:(door.cells?door.y:y)*size-lift,
      w:size*(door.axis==='horizontal'?span:1),h:size*(door.axis==='vertical'?span:1),lift};
  },

  /* 按朝向取角色图，返回 { img, flip, dir, exact } 或 null
     angle 用屏幕坐标系：0 = 朝右(+x)，PI/2 = 朝下(+y)。
     holder 可选，传入实体自身，用于记住上一帧方向做迟滞——
     否则准星压在 45° 边界上时，画面会在「正面」和「侧面」之间来回闪。 */
  char(id, angle, holder) {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const ax = Math.abs(dx), ay = Math.abs(dy);

    // 已经朝侧面的，偏一点仍保持侧面；否则要多偏 0.10 才切过去
    const margin = (holder && holder._sprDir === 'e') ? -0.10 : 0.10;
    let dir;
    if (ax - ay > margin) dir = 'e';
    else dir = dy >= 0 ? 's' : 'n';

    if (holder) holder._sprDir = dir;

    let img = this.map['chars/' + id + '_' + dir];
    let exact = !!img;
    // 缺这个方向：先借同角色的其它方向，再借老的单张图
    if (!img) {
      for (const d of ART.charDirs) {
        if (this.map['chars/' + id + '_' + d]) { img = this.map['chars/' + id + '_' + d]; break; }
      }
    }
    if (!img) img = this.map['chars/' + id] || null;
    if (!img) return null;

    return { img: img, flip: dir === 'e' && dx < 0, dir: dir, exact: exact };
  },

  /* 画角色。返回 char() 的结果，画不出来返回 null。
     朝左时水平镜像——所以侧面图只需要画一张朝右的。 */
  drawChar(c, id, angle, sx, sy, holder, alpha) {
    const facing = id === 'player' && holder && holder.anim && holder.anim.state === 'dodge'
      ? holder.dodgeAngle : angle;
    const sp = this.char(id, facing, holder);
    if (!sp) return null;
    let frame = 0, animated = null;
    let frameSize=32;
    if (id === 'player' && holder && holder.anim) {
      const clip = PLAYER_ANIMS[holder.anim.state];
      const sheet = this.map['anim/player_' + holder.anim.state + '_' + sp.dir];
      const size = clip && (clip.size || 32);
      if (clip && sheet && sheet.naturalWidth === clip.frames * size && sheet.naturalHeight === size) {
        const step = Math.max(0, Math.floor(holder.anim.time * clip.fps));
        frame = clip.loop ? step % clip.frames : Math.min(clip.frames - 1, step);
        animated = sheet;
        frameSize=size;
      }
    }
    if(holder?.ai&&holder.anim&&typeof HUMAN_ANIMS!=='undefined'){
      const clip=HUMAN_ANIMS[holder.anim.state],sheet=this.map['anim/'+id+'_'+holder.anim.state+'_'+sp.dir];
      if(clip&&sheet&&sheet.naturalWidth===clip.frames*64&&sheet.naturalHeight===64){
        frame=clip.loop?Math.floor(holder.anim.time*clip.fps)%clip.frames:Math.min(clip.frames-1,Math.floor(holder.anim.progress*clip.frames));
        animated=sheet;frameSize=64;
      }
    }
    c.save();
    c.globalAlpha = (alpha == null ? 1 : alpha);
    c.translate(sx, sy);
    if (sp.flip) c.scale(-1, 1);
    if (animated) {
      const size = frameSize;
      c.drawImage(animated, frame * size, 0, size, size, -size / 2, -size / 2, size, size);
    }
    else {
      const anchor=typeof HUMAN_ART_STATIC!=='undefined'?HUMAN_ART_STATIC[id+'_'+sp.dir]:null;
      c.drawImage(sp.img, -(anchor?.[0]??16), -16, 32, 32);
    }
    c.restore();
    return Object.assign(sp, { animated: !!animated, frame, sheet: animated });
  },

  /* 尸体：按敌人种类取图，缺图退回通用 corpse */
  corpse(key) {
    return this.map['props/corpse_' + key]
        || this.map['props/corpse']
        || null;
  },

  // 墙体视觉32×48，底边不变；碰撞仍由原32×32格决定。
  wallCell(tile) {
    return M.wallCell(tile);
  },

  wallEdges(x, y, at) {
    at = at || ((x,y) => M.at(x,y));
    const joined=t=>this.wallCell(t)||t?.door?.axis==='horizontal';
    const below=at(x,y+1),portalBelow=typeof DoorVisual!=='undefined'&&DoorVisual.isSidePortal(below?.door);
    // Continue the coping to the portal's north jamb instead of exposing a front face.
    return { north:!joined(at(x,y-1)), south:!joined(below)&&!portalBelow,
      west:!joined(at(x-1,y)), east:!joined(at(x+1,y)) };
  },

  drawWallFaces(c, x, y, size, edges) {
    const front = this.get('tiles','wall_face_s'), side = this.get('tiles','wall_face_e');
    const h = size, w = size * 4 / 32, topY = y - size / 2;
    const top = this.get('tiles','wall');
    if(top){ c.drawImage(top,x,topY,size,size); c.drawImage(top,0,0,32,16,x,y+size/2,size,size/2); }
    if (edges.north) {
      c.fillStyle = 'rgba(211,216,192,0.35)'; c.fillRect(x,topY,size,1);
    }
    if (edges.west) {
      c.fillStyle = '#566357'; c.fillRect(x,topY,1,size*1.5);
    }
    if (edges.south) {
      if (front) c.drawImage(front,x,y+size-h,size,h);
      else { c.fillStyle='#616e60'; c.fillRect(x,y+size-h,size,h); }
    }
    if (edges.east) {
      if (side) c.drawImage(side,x+size-w,topY,w,size*1.5);
      else { c.fillStyle='#3c4e43'; c.fillRect(x+size-w,topY,w,size*1.5); }
    }
  },

  /* 按字符取地形图 */
  tile(ch) {
    let id = 'floor';
    if (ch === '#') id = 'wall';
    else if (ch === '~') id = 'marsh';
    else if (ch === ',') id = 'low';
    return this.map['tiles/' + id] || null;
  }
};
