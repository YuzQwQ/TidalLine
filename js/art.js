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

  init(inlineMap) {
    this.map = {};
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
    // 角色：每个角色按三个方向各加载一张
    for (const id of ART.chars) {
      for (const d of ART.charDirs) load('chars/' + id + '_' + d);
    }
    for (const state of Object.keys(PLAYER_ANIMS)) {
      for (const dir of ART.charDirs) load('anim/player_' + state + '_' + dir);
    }
    return Promise.all(jobs);
  },

  get(group, id) { return this.map[group + '/' + id] || null; },

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
    const [w,h]=M.propSize(prop),[sx,sy,sw,sh]=this.propBounds(image);
    const scale=Math.min((w*tileSize-4)/sw,(h*tileSize-4)/sh),dw=sw*scale,dh=sh*scale;
    return {sx,sy,sw,sh,x:prop.x*tileSize+(w*tileSize-dw)/2,y:(prop.y+h)*tileSize-3-dh,w:dw,h:dh};
  },

  // 方向沿墙体走向命名，不能旋转正面位图，否则立面和光源都会跟着转。
  door(door) {
    const base = door.safe || door.reinforced ? 'sdoor' : 'door';
    const state = door.open ? '_open' : '';
    const key = base + (door.axis === 'vertical' ? '_side' : '') + state;
    return this.get('props', key) || this.get('props', base + state);
  },

  doorRect(door, image, x, y, size) {
    const span=door.cells?door.cells.length:1,lift=image.naturalHeight===48?size/2:0;
    return {x:(door.cells?door.x:x)*size,y:(door.cells?door.y:y)*size-lift,
      w:size*(door.axis==='horizontal'?span:1),h:size*(door.axis==='vertical'?span:1)+lift,lift};
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
    if (id === 'player' && holder && holder.anim) {
      const clip = PLAYER_ANIMS[holder.anim.state];
      const sheet = this.map['anim/player_' + holder.anim.state + '_' + sp.dir];
      const size = clip && (clip.size || 32);
      if (clip && sheet && sheet.naturalWidth === clip.frames * size && sheet.naturalHeight === size) {
        const step = Math.max(0, Math.floor(holder.anim.time * clip.fps));
        frame = clip.loop ? step % clip.frames : Math.min(clip.frames - 1, step);
        animated = sheet;
      }
    }
    c.save();
    c.globalAlpha = (alpha == null ? 1 : alpha);
    c.translate(sx, sy);
    if (sp.flip) c.scale(-1, 1);
    if (animated) {
      const size = PLAYER_ANIMS[holder.anim.state].size || 32;
      c.drawImage(animated, frame * size, 0, size, size, -size / 2, -size / 2, size, size);
    }
    else c.drawImage(sp.img, -16, -16, 32, 32);
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
    return { north:!this.wallCell(at(x,y-1)), south:!this.wallCell(at(x,y+1)),
      west:!this.wallCell(at(x-1,y)), east:!this.wallCell(at(x+1,y)) };
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
