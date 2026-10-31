/* ============================================================
   潮汐线 · 主逻辑
   循环 / 输入 / 渲染 / 交互 / 存档
   ============================================================ */

/* ---------------- 物品图标 ----------------
   约定：assets/items/{id}.png，48×48 透明 PNG。
   缺图不会报错，会退回成带稀有度颜色的色块。
   打包成单文件时 build.js 会把这些图转成 base64 内联进来。
   -------------------------------------------------- */
const ITEM_BY_ID = {};
for (const it of ITEMS) ITEM_BY_ID[it.id] = it;

/* innerHTML 拼字符串时统一过一遍，名字里有 & < > 也不会把结构搞坏 */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ---------------- 恢复治疗 ----------------
   一件恢复品 = 一个"治疗容量池"。使用流程：
     启动（healStart 秒，不回血、不扣容量）
       └─ 持续阶段：每秒 healRate，回多少扣多少容量
            ├─ 满血 → 结束，剩余容量留在物品上
            ├─ 容量归零 → 物品移除
            └─ 主动取消 / 冲刺 / 攻击 / 死亡 → 结束，已扣的不退
   容量记在"条目"（entry.cap）上：新捡到或满堆里拆出来的都是满容量，
   用过的那件单独占一格，不会和满的再合并。其他医疗分组（止痛/创伤/针剂/异常）保持原样。 */
const Medical = {
  canonicalId(id) { return id === 'med01' ? 'heal01' : id; },
  is(item) { return !!item && item.cat === 'medical'; },
  ready(item) { return this.is(item) && item.use === true && (item.healCap || 0) > 0; },
  capOf(item) { return (item && item.healCap) || 0; },

  /* 条目剩余容量：没写 cap 就是满的（老存档、新捡到的都走这条路） */
  entryCap(entry) {
    if (!entry) return 0;
    const item = entry.item || stashItem(entry);
    const max = this.capOf(item);
    if (!max) return 0;
    return typeof entry.cap === 'number' ? U.clamp(entry.cap, 0, max) : max;
  },
  isPartial(entry) {
    const item = entry && (entry.item || stashItem(entry));
    const max = this.capOf(item);
    return max > 0 && this.entryCap(entry) < max - 1e-6;
  },

  summary(item) {
    if (!this.ready(item)) {
      return '效果待开放' + (item.reservedEffect ? ' · 预留：' + item.reservedEffect : '');
    }
    return '启动 ' + item.healStart + ' 秒 · ' + item.healRate + ' HP/秒 · 容量 ' + item.healCap;
  },

  /* 诊所报价：按绷带容量折算需要几卷 */
  quote(hp = Save.hp) {
    const missing = Math.max(0, CFG.P.HP - hp);
    const bandage = ITEM_BY_ID.heal01;
    const medicine = Math.ceil(missing / bandage.healCap) * bandage.price;
    const service = missing > 0 ? Math.max(Math.ceil(bandage.price * ECONOMY.doctor.minimumBandageFraction), Math.ceil(medicine * ECONOMY.doctor.serviceRate)) : 0;
    return { missing, medicine, service, total: medicine + service };
  },

  /* 'stash' 与 'basebag' 都是藏身处的列表，条目形态一致（{id,n,cap} / {id,n,gear}）；
     'bag' / 'safe' 是局内玩家背包里的活条目（{item,n,cap}）。 */
  stashLike(where) { return where === 'stash' || where === 'basebag'; },

  entries(where) {
    if (where === 'stash') return Game.state === 'base' ? Save.stash : [];
    if (where === 'basebag') return Game.state === 'base' ? Save.bag : [];
    return Game.state === 'playing' && Game.player && !Game.player.dead
      ? (where === 'safe' ? Game.player.bag.safe : Game.player.bag.slots) : [];
  },

  valid(entry, where) { return !!entry && entry.n > 0 && this.entries(where).includes(entry); },

  /* 从堆里取出一件来用：
       n = 1 → 就用这一条，容量记在它身上
       n > 1 → 拆出一件单独的，需要有空位；拆不动宁可不让用，也不能把东西弄丢 */
  takeUnit(entry, where) {
    if (!this.valid(entry, where)) return null;
    const list = this.entries(where);
    const item = this.stashLike(where) ? stashItem(entry) : entry.item;
    const max = this.capOf(item);
    if (!item) return null;

    if (entry.n <= 1) {
      entry.n = 1;
      if (entry.cap == null) entry.cap = max;
      return entry;
    }

    if (!this.stashLike(where)) {
      const limit = where === 'safe' ? CFG.BAG.SAFE : CFG.BAG.SLOTS;
      if (list.length >= limit) { Game.toast('背包没有空位，先腾一格再拆开用'); return null; }
    }
    entry.n -= 1;
    if (entry.cap == null) entry.cap = max;      // 剩下的仍是整堆满容量
    const unit = this.stashLike(where) ? { id: item.id, n: 1, cap: max } : { item, n: 1, cap: max };
    list.push(unit);
    return unit;
  },

  /* 实际恢复：受剩余容量和缺口双重限制，绝不超量扣 */
  applyCap(unit, item, room) {
    const cap = this.entryCap(unit);
    const gain = Math.max(0, Math.min(room, cap));
    if (gain > 0) unit.cap = cap - gain;
    return gain;
  },

  /* 容量归零就从所在列表移除 */
  dropIfEmpty(entry, where) {
    if (!entry || this.entryCap(entry) > 1e-6) return false;
    const list = this.entries(where);
    const i = list.indexOf(entry);
    if (i < 0) return false;
    list.splice(i, 1);
    if (!this.stashLike(where)) { if (Game.bagOpen) Game.renderBag(); }
    else if (where === 'basebag' && typeof Base !== 'undefined') Base.renderBag();
    return true;
  },

  use(entry, where) {
    const item = this.stashLike(where) ? stashItem(entry) : entry && entry.item;
    if (!this.valid(entry, where) || !this.ready(item)) return false;

    /* 局外（仓库 / 藏身处背包）：立即结算，拆件也不看格子 */
    if (this.stashLike(where)) {
      const hp = Save.hp;
      if (hp >= CFG.P.HP) return false;
      const unit = this.takeUnit(entry, where);
      if (!unit) return false;
      const healed = this.applyCap(unit, item, CFG.P.HP - hp);
      this.dropIfEmpty(unit, where);
      Save.setHP(hp + healed);
      Base.render();
      Base.note(item.name + '：恢复 ' + Math.round(healed * 10) / 10 + ' HP');
      return true;
    }

    const P = Game.player;
    if (!P || P.dead) return false;
    if (P.hp >= P.maxHp) return false;
    /* 同一时间只允许一种治疗；读条、搜刮、闪避、换弹期间也不能开始 */
    if (Game.action || Game.lootOpen || P.dodgeT > 0 || P.reloadT > 0) {
      Game.toast('请先结束当前动作，再开始治疗'); return false;
    }
    const unit = this.takeUnit(entry, where);
    if (!unit) return false;

    Game.input.mouseDown = false;
    Game.action = {
      type: 'heal', phase: 'start', t: 0,
      item, unit, where, restored: 0
    };
    Game.toast('使用' + item.name + '：' + item.healStart + ' 秒后开始恢复 · E / Esc 取消');
    if (Game.bagOpen) Game.renderBag();
    return true;
  },

  /* 每帧推进：启动阶段不回血，持续阶段按速率结算 */
  tick(a, dt) {
    const P = Game.player;
    const item = a.item, unit = a.unit;
    if (!P || P.dead || !this.valid(unit, a.where)) { this.cancel('治疗中断'); return; }

    if (a.phase === 'start') {
      a.t += dt;
      if (a.t >= item.healStart) {
        a.phase = 'active';
        a.t = 0;
        Game.sfx('pickup');
      }
      return;
    }

    a.t += dt;
    const room = Math.max(0, P.maxHp - P.hp);
    const cap = this.entryCap(unit);
    const gain = Math.min(item.healRate * dt, cap, room);
    if (gain > 0) {
      P.hp = Math.min(P.maxHp, P.hp + gain);
      unit.cap = cap - gain;
      a.restored += gain;
      Save.setHP(P.hp);
    }
    /* 满血或容量归零都收工；满血时剩余容量留在物品上 */
    if (room - gain <= 1e-6 || this.entryCap(unit) <= 1e-6) this.finish(a);
  },

  finish(a) {
    if (!a || a.type !== 'heal') return;
    const unit = a.unit, where = a.where;
    const left = this.entryCap(unit);
    const emptied = left <= 1e-6;
    if (emptied) this.dropIfEmpty(unit, where);
    if (Game.action === a) Game.action = null;

    if (a.restored > 0.01) {
      Game.sfx('pickup');
      Game.toast('恢复 ' + Math.round(a.restored * 10) / 10 + ' HP' +
        (emptied ? ' · ' + a.item.name + ' 用完' : ' · 剩余容量 ' + Math.ceil(left)));
    } else if (emptied) {
      Game.toast(a.item.name + ' 已用完');
    }
    if (Game.bagOpen) Game.renderBag();
  },

  /* 中断：保留已恢复的 HP，已扣的容量不退 */
  cancel(message) {
    const a = Game.action;
    if (!a || a.type !== 'heal') return false;
    const emptied = this.entryCap(a.unit) <= 1e-6;
    if (emptied) this.dropIfEmpty(a.unit, a.where);
    Game.action = null;
    if (message) Game.toast(message);
    else if (a.restored > 0.01) Game.toast('治疗中断 · 已恢复 ' + Math.round(a.restored * 10) / 10 + ' HP');
    else Game.toast('治疗已取消');
    if (Game.bagOpen) Game.renderBag();
    return true;
  },

  open(entry, where, node) {
    if (!this.valid(entry, where)) return;
    const item = this.stashLike(where) ? stashItem(entry) : entry.item;
    const max = this.capOf(item);
    const cur = this.entryCap(entry);
    const capText = max ? Math.ceil(cur) + ' / ' + max : '—';
    /* 启动与速率已经在「效果」那行写了，这里只补当前容量这个会变的值 */
    Tips.show(item, node.getBoundingClientRect(), '医疗物品操作', this.ready(item) ? [
      ['当前容量', capText]
    ] : null);
    const box = document.getElementById('itemTip');
    const hp = this.stashLike(where) ? Save.hp : Game.player.hp;
    const missing = Math.max(0, CFG.P.HP - hp);
    const useLabel = !this.ready(item) ? '效果待开放' : hp >= CFG.P.HP ? '生命值已满'
      : '使用一件（可恢复 ' + Math.round(Math.min(cur, missing)) + ' HP）';
    box.querySelector('.tip-hd').insertAdjacentHTML('afterend', '<div class="medical-actions"><button data-med="use"' +
      (!this.ready(item) || hp >= CFG.P.HP ? ' disabled' : '') + '>' + esc(useLabel) + '</button>' +
      '<button data-med="move">' + (where === 'stash' ? '出售这一堆' : where === 'safe' ? '移回背包' : '移入安全箱') + '</button></div>');
    box.querySelectorAll('[data-med]').forEach(button => button.onclick = () => {
      if (!this.valid(entry, where)) { Tips.hide(); return; }
      Tips.hide();
      if (button.dataset.med === 'use') this.use(entry, where);
      else if (where === 'stash') Base.askSell(entry, entry.n, node);
      else if (where === 'bag') Game.moveToSafe(Game.player.bag.slots.indexOf(entry));
      else {
        const bag = Game.player.bag;
        if (bag.slots.length >= CFG.BAG.SLOTS) { Game.toast('背包满了'); return; }
        this.cancel(); bag.safe.splice(bag.safe.indexOf(entry), 1); bag.slots.push(entry); Game.renderBag();
      }
    });
  }
};

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

/* ---------------- 悬浮窗：物品详情 / 交易确认 ----------------
   右键任何物品都能看详情，买东西前先把金额摆出来。
   定位沿用装备选择窗那套：贴着触发元素右侧、顶边对齐，放不下就翻到左边。 */
const Tips = {
  W: 378,              // 详情窗宽，和 #itemTip 的 CSS 宽度保持一致

  _box(id) {
    if (typeof document === 'undefined' || !document.getElementById) return null;
    return document.getElementById(id);
  },

  place(box, r, w) {
    if (!box || !box.style || !r) return;
    const vw = (typeof window !== 'undefined' && window.innerWidth) || 1280;
    const vh = (typeof window !== 'undefined' && window.innerHeight) || 800;
    const right = (r.right != null) ? r.right : (r.left || 0) + (r.width || 0);
    let left = right + 8;
    if (left + w > vw - 8) left = Math.max(8, (r.left || 0) - w - 8);
    const top = U.clamp((r.top != null) ? r.top : 0, 8, Math.max(8, vh - 320));
    box.style.left = left + 'px';
    box.style.top = top + 'px';
    box.style.width = w + 'px';
    box.style.maxHeight = Math.max(100, vh - top - 12) + 'px';
  },

  /* 点别处 / 滚动 / 改窗口大小就收起，和装备选择窗一个脾气 */
  bindClose() {
    if (this._bound) return;
    this._bound = true;
    if (typeof document === 'undefined' || !document.addEventListener) return;
    document.addEventListener('mousedown', ev => {
      const t = ev.target;
      if (t && t.closest && (t.closest('#itemTip') || t.closest('#dealBox'))) return;
      this.hide();
      Deal.hide();
    });
    document.addEventListener('scroll', ev => {
      if (ev.target?.closest?.('#itemTip, #dealBox')) return;
      this.hide(); Deal.hide();
    }, true);
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('resize', () => { this.hide(); Deal.hide(); });
    }
  },

  /* 物品详情。it 可以是普通物品，也可以是装备伪物品；extra 是调用方补的额外行 */
  show(it, rect, hint, extra) {
    const box = this._box('itemTip');
    if (!box || !it) return;

    const r = RARITY[U.clamp((it.r || 1) - 1, 0, RARITY.length - 1)];
    const cat = {...(CATS[it.cat] || CATS.ind),name:itemCategoryLabel(it)};
    const price = it.price || 0;
    const rows = [];

    if (it.cat === 'ammo') {
      const A = AMMO_BY_ID[it.id] || it;
      rows.push(['等级', 'Lv' + it.level + ' · ' + BALLISTICS.caliberName(it.caliber)]);
      rows.push(['伤害系数', '×' + A.dmgMul.toFixed(2)]);
      rows.push(['穿透等级', 'Lv' + A.penLevel]);
    }
    if (Medical.is(it)) {
      rows.push(['医疗分组', MEDICAL_GROUPS[it.medicalGroup]]);
      rows.push(['来源', it.source]);
      rows.push(['效果', Medical.summary(it)]);
    }
    if (Array.isArray(extra)) for (const row of extra) rows.push(row);

    if (it.equip && it.equip.kind === 'armor') {
      const g = it.equip.gear;
      const st = GEAR.state(g);
      rows.push(['部位', GEAR[g.type].label]);
      rows.push(['防护等级', 'Lv' + g.lv + (st === 'broken' ? ' · 已失效' : '')]);
      rows.push(['耐久', Math.ceil(g.dur) + ' / ' + g.max]);
    } else if (it.equip && it.equip.kind === 'gun') {
      const w = WEAPONS[it.equip.gun];
      if (w) {
        const A = AMMO_BY_ID[it.equip.ammo] || defaultAmmo(w.caliber);
        rows.push(['口径', BALLISTICS.caliberName(w.caliber)]);
        rows.push(['伤害', w.dmgMin + '–' + w.dmgMax + ' · 弹匣 ' + w.mag + ' 发']);
        rows.push(['射速', w.rpm + ' 发/分']);
        if (A) {
          rows.push(['装填', A.name + '（Lv' + A.level + '）']);
          rows.push(['穿透 / 系数', 'Lv' + A.penLevel + ' · ×' + A.dmgMul.toFixed(2)]);
        }
        rows.push(['余弹', (it.equip.mag || 0) + ' 发']);
      }
    }

    rows.push(['重量', it.w.toFixed(2) + ' kg']);
    if (it.equip && it.equip.kind === 'armor') {
      const g = it.equip.gear;
      /* move 是移速倍率：1 = 没有惩罚，0.88 = 慢 12% */
      if (g.move != null && g.move < 1) {
        rows.push(['移速', '−' + Math.round((1 - g.move) * 100) + '%']);
      }
    }
    rows.push(['单价', formatMoney(price)]);
    if (it.sell != null) rows.push(['回收价', formatMoney(it.sell)]);

    /* 图鉴：只登记真正的收藏品，消耗品和装备不算 */
    let foot = '';
    if (!it.equip && !it.noCodex && Save.codex && Save.codex[it.id]) {
      foot = '已收录 ' + Save.codex[it.id].count + ' 次';
    } else if (it.equip) {
      foot = '装备不占格堆叠，一件一格';
    }

    const desc = it.desc || (it.equip ? equipDesc(it) : '');

    box.innerHTML =
      '<div class="tip-hd">' +
        '<span class="tip-ic' + (it.icon ? '' : ' gl') + '">' +
          (it.icon && Icons.gear[it.icon]
            ? '<img src="' + Icons.gear[it.icon].src + '" alt="">'
            : (Icons.get(it.id)
                ? '<img src="' + Icons.get(it.id).src + '" alt="">'
                : esc((it.short || it.name || '?').charAt(0)))) +
        '</span>' +
        '<span class="tip-ttl"><span class="tip-nm">' + esc(it.name) + '</span>' +
          '<span class="tip-sub">' +
            '<i style="color:' + cat.color + '">' + cat.name + '</i> · ' +
            '<i style="color:' + r.color + '">' +
              (it.cat === 'ammo' ? 'Lv' + it.level : r.name) + '</i>' +
          '</span>' +
        '</span>' +
      '</div>' +
      '<div class="tip-rows">' + rows.map(([k, v]) =>
        '<div class="tip-row"><span>' + esc(k) + '</span><b' +
          (k === '单价' || k === '回收价' ? ' class="gold"' : '') + '>' + esc(v) + '</b></div>'
      ).join('') + '</div>' +
      (desc ? '<div class="tip-desc">' + esc(desc) + '</div>' : '') +
      ((foot || hint) ? '<div class="tip-foot">' + esc(foot) +
        (foot && hint ? ' · ' : '') + esc(hint || '') + '</div>' : '');

    box.style.display = '';
    this.place(box, rect, Math.min(this.W, window.innerWidth - 16));
    this.bindClose();
  },

  /* 在详情窗顶部补一行动作按钮（仓库 ⇄ 背包、使用、卖出都走这一套）。
     list: [{ label, disabled, onClick }] —— 点完自动收起浮窗。 */
  actions(list) {
    const box = this._box('itemTip');
    if (!box || !box.querySelector || !list || !list.length) return;
    const hd = box.querySelector('.tip-hd');
    if (!hd || !hd.insertAdjacentHTML) return;
    hd.insertAdjacentHTML('afterend', '<div class="medical-actions">' +
      list.map((a, i) => '<button data-act="' + i + '"' + (a.disabled ? ' disabled' : '') + '>' +
        esc(a.label) + '</button>').join('') + '</div>');
    const btns = box.querySelectorAll ? box.querySelectorAll('[data-act]') : [];
    btns.forEach(b => b.onclick = ev => {
      ev.preventDefault();
      ev.stopPropagation();
      const a = list[Number(b.dataset.act)];
      this.hide();
      if (a && a.onClick) a.onClick();
    });
  },

  hide() {
    const box = this._box('itemTip');
    if (box) box.style.display = 'none';
  }
};

/* 右键菜单：目前只有背包物品用（查看详情 / 丢弃）。
   和详情窗一样贴在 body 上按视口坐标摆，不受 #hudPanel 缩放影响。 */
const Ctx = {
  el: null,

  show(x, y, entries) {
    if (typeof document === 'undefined' || !document.getElementById) return;
    if (!this.el) this.el = document.getElementById('ctxMenu');
    const el = this.el;
    if (!el || !entries || !entries.length) return;

    el.innerHTML = entries.map((e, i) =>
      '<div class="citem' + (e.danger ? ' danger' : '') + '" data-i="' + i + '">' +
      esc(e.label) + (e.hint ? '<span class="k">' + esc(e.hint) + '</span>' : '') + '</div>'
    ).join('');
    el.style.display = 'block';

    /* 先显示再量，避免贴右边 / 底边溢出屏幕 */
    const w = el.offsetWidth || 140, h = el.offsetHeight || 40;
    const vw = (typeof window !== 'undefined' && window.innerWidth) || 1280;
    const vh = (typeof window !== 'undefined' && window.innerHeight) || 800;
    el.style.left = Math.max(6, Math.min(x, vw - w - 8)) + 'px';
    el.style.top = Math.max(6, Math.min(y, vh - h - 8)) + 'px';

    const rows = el.querySelectorAll ? el.querySelectorAll('.citem') : [];
    rows.forEach((row, i) => {
      row.onmousedown = ev => { ev.preventDefault(); ev.stopPropagation(); };
      row.onclick = ev => {
        ev.preventDefault(); ev.stopPropagation();
        this.hide();
        const fn = entries[i] && entries[i].onClick;
        if (fn) fn();
      };
    });

    Tips.hide();
    this.bindClose();
  },

  hide() {
    if (this.el) this.el.style.display = 'none';
  },

  bindClose() {
    if (this._bound) return;
    this._bound = true;
    if (typeof document === 'undefined' || !document.addEventListener) return;
    document.addEventListener('mousedown', ev => {
      const t = ev.target;
      if (t && t.closest && t.closest('#ctxMenu')) return;
      this.hide();
    });
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape') this.hide(); });
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('resize', () => this.hide());
    }
    document.addEventListener('scroll', () => this.hide(), true);
  }
};


/* 装备没有写死的文案，按数值拼一句人话 */
function equipDesc(it) {
  if (!it.equip) return '';
  if (it.equip.kind === 'armor') {
    const g = it.equip.gear;
    return 'Lv' + g.lv + ' 的' + GEAR[g.type].label +
      '。能挡下多少取决于打过来的是几级弹：同级以下基本能挡住，高一级就漏一半，' +
      '高两级往上基本挡不住。耐久磨穿以后就只剩自重。';
  }
  const w = WEAPONS[it.equip.gun];
  if (!w) return '';
  return w.slot === 'primary' ? '主武器。打空弹匣要换弹，换枪也有硬直。'
                              : '副武器。轻，掏出来快，但压不住连发。';
}

/* 买东西之前的确认框 */
const Deal = {
  W: 250,

  show(o, rect) {
    const box = (typeof document !== 'undefined' && document.getElementById)
      ? document.getElementById('dealBox') : null;
    if (!box || !o) return;

    const sell = o.kind === 'sell';
    const price = Math.abs(o.price || 0);
    const left = sell ? Save.credits + price : Save.credits - price;
    const can = o.can !== false && (sell || left >= 0);
    const ico = (o.icon && Icons.gear[o.icon])
      ? '<img src="' + Icons.gear[o.icon].src + '" alt="">'
      : (o.id && Icons.get(o.id)
          ? '<img src="' + Icons.get(o.id).src + '" alt="">'
          : esc((o.short || o.name || '?').charAt(0)));

    box.innerHTML =
      '<div class="deal-hd">' + esc(o.title || '交易') + '</div>' +
      '<div class="deal-bd">' +
        '<span class="tip-ic' + (o.icon ? '' : ' gl') + '">' + ico + '</span>' +
        '<span class="deal-nm">' + esc(o.name) + '<i>' + esc(o.sub || '') + '</i></span>' +
      '</div>' +
      '<div class="deal-sum">' +
        '<span>' + (sell ? '回收价' : '售价') + '<b class="gold">' + formatMoney(price) + '</b></span>' +
        '<span>当前信用点<b>' + formatMoney(Save.credits) + '</b></span>' +
        '<span>' + (sell ? '成交后' : '成交后') +
          '<b class="' + (left >= 0 ? '' : 'warn') + '">' + formatMoney(left) + '</b></span>' +
      '</div>' +
      '<div class="deal-acts">' +
        '<button class="go' + (can ? '' : ' no') + '" data-a="go">' +
          (left < 0 ? '钱不够' : (sell ? '卖出' : '买下')) + '</button>' +
        '<button data-a="no">取消</button>' +
      '</div>';

    let used = false;
    box.querySelectorAll('button').forEach(b => {
      b.onclick = () => {
        if (used) return;
        used = true;
        if (b.dataset.a === 'go' && can && o.onGo) o.onGo();
        this.hide();
      };
    });

    box.style.display = '';
    Tips.place(box, rect, this.W);
    Tips.bindClose();
  },

  hide() {
    const box = (typeof document !== 'undefined' && document.getElementById)
      ? document.getElementById('dealBox') : null;
    if (box) box.style.display = 'none';
  }
};

/* ---------------- 音效（全程序化，无音频文件） ---------------- */
const SFX = {
  ctx: null,
  noiseBuf: null,
  on: true,

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      // 预生成 1 秒噪声
      const len = this.ctx.sampleRate * 1;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    } catch (e) { this.on = false; }
  },

  /* 用完必须把节点从图里摘掉。stop() 只是停止发声，节点还挂在 destination 上，
     连打一分钟就是几百个残留节点，音频线程会越来越重——表现为"玩久了就卡"。 */
  _autoFree(src, chain) {
    src.onended = () => {
      try { src.disconnect(); } catch (e) {}
      for (const nd of chain) { try { nd.disconnect(); } catch (e) {} }
    };
  },

  _env(gain, dur) {
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    return g;
  },

  play(name) {
    if (!this.on || !this.ctx) return;
    const c = this.ctx, t = c.currentTime;

    const noiseHit = (dur, freq, gain, type) => {
      const s = c.createBufferSource();
      s.buffer = this.noiseBuf;
      s.playbackRate.value = 1;
      const f = c.createBiquadFilter();
      f.type = type || 'lowpass';
      f.frequency.value = freq;
      const g = this._env(gain, dur);
      s.connect(f); f.connect(g); g.connect(c.destination);
      this._autoFree(s, [f, g]);
      s.start(t); s.stop(t + dur + 0.02);
    };

    const tone = (dur, f0, f1, gain, type) => {
      const o = c.createOscillator();
      o.type = type || 'square';
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = this._env(gain, dur);
      o.connect(g); g.connect(c.destination);
      this._autoFree(o, [g]);
      o.start(t); o.stop(t + dur + 0.02);
    };

    switch (name) {
      case 'shot':
        noiseHit(0.16, 1800, 0.20);
        tone(0.09, 140, 50, 0.13, 'sawtooth');
        break;
      case 'enemyShot':
        noiseHit(0.12, 1200, 0.10);
        break;
      case 'hit':
        noiseHit(0.07, 2600, 0.14, 'highpass');
        break;
      case 'headshot':
        // 爆头：高频脆响 + 一点下沉，和普通命中区分开
        noiseHit(0.05, 4200, 0.16, 'highpass');
        tone(0.12, 900, 320, 0.10, 'triangle');
        break;
      case 'break':
        // 护甲破裂：闷响 + 金属裂开
        noiseHit(0.20, 700, 0.12);
        tone(0.10, 300, 120, 0.09, 'square');
        break;
      case 'reload':
        noiseHit(0.08, 900, 0.08);
        tone(0.06, 420, 220, 0.06, 'square');
        break;
      case 'melee':
        tone(0.13, 220, 70, 0.16, 'sawtooth');
        break;
      case 'door':
        noiseHit(0.16, 420, 0.11);
        break;
      case 'pickup':
        tone(0.07, 660, 900, 0.07, 'sine');
        break;
      case 'search':
        noiseHit(0.22, 620, 0.07);
        break;
      case 'drop':
        // 丢东西：一声闷响，别太响，丢东西本来就该低调
        noiseHit(0.12, 380, 0.08);
        break;
      case 'hurt':
        tone(0.16, 180, 90, 0.12, 'sawtooth');
        break;
      case 'extract':
        tone(0.5, 320, 640, 0.09, 'sine');
        break;
      case 'death':
        tone(0.8, 200, 40, 0.16, 'sawtooth');
        break;
    }
  }
};

/* ============================================================ */
const Game = {
  canvas: null, ctx: null,
  state: 'menu',
  player: null,
  enemies: [], bullets: [], corpses: [], boxes: [],
  particles: [], toasts: [],
  cam: { x: 0, y: 0 },
  time: 0,
  acc: 0, lastT: 0,
  shakeAmt: 0, shakeX: 0, shakeY: 0,
  flashColor: '#8d3a3a', flashA: 0,
  lastHitAngle: 0, hitDirA: 0, hitDirT: 0,
  action: null,          // { type, t, total, target }
  lootOpen: null,        // 当前打开的容器对象
  search: null,          // 正在搜的那一件 { idx, t, total }
  _searchBar: null,      // 进度条的 DOM 引用
  bagWasAuto: false,     // 背包是不是因为搜刮才打开的
  bagOpen: false,
  tideLevel: 0,
  tidePhase: 0,
  extractDone: false,
  stats: { kills: 0, found: 0, newItems: [] },
  debug: false,
  mapId: RAID_MAP.id,

  input: {
    keys: {}, mx: 0, my: 0, wx: 0, wy: 0,
    aimAngle: 0, mouseDown: false,
    dodgePressed: false, interactPressed: false,
    reloadPressed: false, bagPressed: false
  },

  /* ---------------- 初始化 ---------------- */
  init() {
    if (this._initialized) return;
    this._initialized = true;
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    /* 接管文字绘制：之后所有 fillText 都会走点阵字体（画面里的 HUD、飘字、
       敌人状态、EXIT 标记）。静态资源不受影响，贴图照旧走 drawImage。 */
    if (typeof Pix !== 'undefined') Pix.attach(this.ctx);

    M.load(MAP_ROWS, DOOR_AXES);
    this.buildBoxes();
    this.bindInput();
    this.bindUI();
    this.resize();
    // 鼠标默认放在屏幕中心偏上，否则初始朝向会指向左上角
    this.input.mx = CFG.VIEW_W / 2;
    this.input.my = CFG.VIEW_H / 2 - 60;
    window.addEventListener('resize', () => {
      this.resize();
      /* 藏身处开着的时候，格子行列也要跟着窗口重算 */
      const bv = document.getElementById('baseVeil');
      if (bv && !bv.classList.contains('hidden') && typeof Base !== 'undefined') {
        try { Base.renderStash(); } catch (e) { /* 还没建好就忽略 */ }
      }
    });
    // 关页面前把还没落盘的存档补上（节流最多积压 400ms）
    window.addEventListener('pagehide', () => Save.flush());
    if (document.addEventListener) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') Save.flush();
      });
    }

    this.lastT = performance.now();
    this.scheduleFrame();
  },

  buildBoxes() {
    this.boxes = [];
    for (let y = 0; y < M.H; y++) {
      for (let x = 0; x < M.W; x++) {
        const t = M.at(x, y);
        const kind = t.container && BOX_KIND[t.ch];
        if (kind) {
          const type = CONTAINER_TYPES[t.ch];
          const spot = M.map && M.map.containers.find(b=>b.x===x&&b.y===y);
          const box = {
            id: spot ? spot.id : null, region: spot ? spot.region : null,
            x: M.cx(x), y: M.cy(y),
            tx: x, ty: y,
            kind,                       // 品质名（junk…secret）
            q: CONTAINER_QUALITY[kind],
            art: type.art, name: type.name,
            items: Loot.fill(kind, type.cats || (spot && spot.preference)),
            opened: false,
            searched: false             // 有没有被掀开过；和"是否已空"分开记
          };
          t.box = box;
          this.boxes.push(box);
        }
      }
    }
  },

  /* ---------------- 容器状态 ----------------
     两个状态必须分开：
       searched  掀开过 —— 再交互不用重新读条
       opened    彻底翻空 —— 不可再交互，画面上压暗
     早先把 opened 当成"打开过"，导致拿了一半的箱子再也开不了。 */
  boxHasItems(b) {
    return !!(b && b.items && b.items.some(e => e && e.item));
  },

  /* 拿完一件后同步状态；返回是否还有东西 */
  syncBoxState(b) {
    if (!b) return false;
    const has = this.boxHasItems(b);
    b.opened = !has;
    if (b.pile && !has) this.removePile(b);
    return has;
  },

  /* ---------------- 丢弃 / 遗落物品堆 ----------------
     丢在脚下一格。同格已经有物品堆就并进去，不重复刷容器。
     物品堆是"已经知道里面是什么"的容器：掀开不用读条、逐件也不用再搜。 */
  dropSpot() {
    const P = this.player;
    if (!P) return null;
    const tx = M.tx(P.x), ty = M.ty(P.y);
    if (M.walkable(tx, ty)) return { x: tx, y: ty };
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        if (M.walkable(tx + dx, ty + dy)) return { x: tx + dx, y: ty + dy };
      }
    }
    return null;
  },

  makePile(tx, ty) {
    this.pileSeq = (this.pileSeq || 0) + 1;
    const pile = {
      id: 'pile-' + this.pileSeq, region: null,
      x: M.cx(tx), y: M.cy(ty), tx, ty,
      kind: 'junk', q: CONTAINER_QUALITY.junk,
      art: null, name: '遗落物品堆',
      items: [],
      opened: false,
      searched: true,               // 自己丢的东西，不用再"搜"
      pile: true
    };
    const t = M.at(tx, ty);
    if (t) t.box = pile;
    this.boxes.push(pile);
    return pile;
  },

  removePile(p) {
    const i = this.boxes.indexOf(p);
    if (i >= 0) this.boxes.splice(i, 1);
    const t = M.at(p.tx, p.ty);
    if (t && t.box === p) t.box = null;
    if (this.lootOpen === p) this.closeLoot();
    this.toast('物品堆空了');
  },

  /* 把背包第 i 格整叠丢下 */
  dropFromBag(i) {
    const P = this.player;
    if (!P) return false;
    const s = P.bag.slots[i];
    if (!s || !s.item) return false;

    const spot = this.dropSpot();
    if (!spot) { this.toast('这里没有能放东西的空地'); return false; }

    let pile = this.boxes.find(b => b.pile && b.tx === spot.x && b.ty === spot.y);
    if (!pile) pile = this.makePile(spot.x, spot.y);

    /* 可堆叠的同种物品并进已有条目，别在一个堆里堆出两条同名；
       用过一半的医疗品不和满的合并，容量一起带进堆里 */
    const max = s.item.healCap || 0;
    const isPartial = max > 0 && typeof s.cap === 'number' && s.cap < max - 1e-6;
    const isFull = e => !max || (typeof e.cap === 'number' ? e.cap : max) >= max - 1e-6;
    const same = (!isPartial && s.item.stack > 1)
      ? pile.items.find(e => e && e.item.id === s.item.id && isFull(e) && e.n + s.n <= s.item.stack)
      : null;
    if (same) same.n += s.n;
    else pile.items.push(typeof s.cap === 'number'
      ? { item: s.item, n: s.n, known: true, cap: s.cap }
      : { item: s.item, n: s.n, known: true });

    pile.opened = false;
    P.bag.slots.splice(i, 1);

    this.renderBag();
    if (this.lootOpen === pile) this.renderLootList();
    SFX.play('drop');
    this.toast('丢下 ' + s.item.name + (s.n > 1 ? ' ×' + s.n : ''));
    return true;
  },

  resize() {
    const iw = window.innerWidth || 1280;
    const ih = window.innerHeight || 800;

    // 画面比例固定 3:2，只能等比放大：取能塞进窗口的最大倍数。
    // 默认允许小数倍——1920×1080 会用到 2.25 倍、几乎填满，
    // 而不是整数倍那样两边各空一大条。想像素绝对整齐就把
    // CFG.INTEGER_SCALE 改成 true（代价是黑边变多）。
    let s = Math.min(iw / CFG.VIEW_W, ih / CFG.VIEW_H);
    if (CFG.INTEGER_SCALE) s = Math.floor(s);

    /* 像素吸附：把倍率拉回整数。
       1920×1080 算出 2.25 倍 —— 每个逻辑像素占 2.25 个物理像素，
       像素块的宽窄在 2 和 3 之间来回跳，HUD 文字也被拉到半像素上，所以看着糊。
       吸到 2 倍以后每个逻辑像素严格是 2×2 物理像素，图和字都对齐。
       只有整数倍不至于把画面缩得太小（面积 ≥ 窗口的 55%）才吸。 */
    if (CFG.PIXEL_SNAP) {
      const n = Math.floor(s);
      if (n >= 2 && (n * n * CFG.VIEW_W * CFG.VIEW_H) / (iw * ih) >= 0.55) s = n;
    }

    /* 锁定倍率：第一次算出来的就是最终大小，窗口变化只在装不下时缩一点 */
    if (CFG.LOCK_SCALE) {
      if (!this._lockS) this._lockS = s;
      s = Math.min(this._lockS, s);
    }

    s = Math.max(0.5, Math.min(CFG.MAX_SCALE, s));

    const w = Math.round(CFG.VIEW_W * s);
    const h = Math.round(CFG.VIEW_H * s);

    /* ---- 内部分辨率（这是"字糊"的根因）----
       以前画布缓冲恒定 720×480，再被拉到 1620×1080：等于把一张小图放大，
       画布里的 HUD 文字、准星、描边全被插值糊掉。
       现在让缓冲跟上显示尺寸（乘 devicePixelRatio），世界坐标仍然是 720×480，
       只是每单位多画几个像素 —— 文字按屏幕像素栅格化，边缘就干净了。
       上限 1920 宽（1080p 级）：再大的屏也只轻微放大，不至于把填充率浪费掉。 */
    const dpr = window.devicePixelRatio || 1;
    const cap = CFG.RENDER_CAP_W / CFG.VIEW_W;
    /* 缓冲像素要正好等于屏幕物理像素（s × dpr）：这样 1 个画布像素 = 1 个屏幕像素，
       文字按物理像素栅格化。s 已经被吸附成整数，逻辑像素才落在整齐的方块里。 */
    const rs = U.clamp(s * dpr, 1, cap);
    this._rs = rs;
    this.canvas.width = Math.round(CFG.VIEW_W * rs);
    this.canvas.height = Math.round(CFG.VIEW_H * rs);
    // 改画布尺寸会重置整个上下文状态，这两个必须重设
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.lineJoin = 'miter';

    // 画面容器和画布一起定尺寸；面板都挂在 #frame 里，所以跟着画面走
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    const fr = document.getElementById('frame');
    if (fr) {
      fr.style.width = w + 'px';
      fr.style.height = h + 'px';
    }

    // 面板层和画布同倍缩放：面板按 720×480 布局，缩放到实际画面尺寸
    this._scale = w / CFG.VIEW_W;
    const hp = document.getElementById('hudPanel');
    if (hp) {
      hp.style.width = CFG.VIEW_W + 'px';
      hp.style.height = CFG.VIEW_H + 'px';
      /* zoom 而不是 transform：transform 是让浏览器把已经排好版的位图拉伸，
         放大后文字必然发虚；zoom 会让布局和字体按放大后的尺寸重新算一遍。 */
      hp.style.transform = '';
      hp.style.zoom = String(this._scale);
    }

    /* 医疗层同样按 720×480 布局，跟着一起缩放；
       轮盘的画布后备尺寸由 MedWheel.sync() 按 _rs 自己对齐 */
    for (const id of ['medBar', 'healHud', 'medWheel']) {
      const el = document.getElementById(id);
      if (el) el.style.zoom = String(this._scale);
    }
    if (typeof MedWheel !== 'undefined' && MedWheel.isOpen()) MedWheel.draw();
  },

  /* ---------------- 输入 ---------------- */
  bindInput() {
    const K = this.input;
    window.addEventListener('keydown', e => {
      if (this.state === 'map-select') return; // 地图页使用原生 Tab / 空格 / Enter 操作
      const k = e.key.toLowerCase();
      if (['tab', ' ', 'w', 'a', 's', 'd'].includes(k)) e.preventDefault();
      if (K.keys[k]) return;   // 忽略自动重复
      K.keys[k] = true;

      if (this.state !== 'playing') return;

      if (k === 'e') K.interactPressed = true;
      if (k === 'r') K.reloadPressed = true;
      if (k === '1' || k === '2' || k === '3') {
        if (this.state === 'playing' && this.player && !this.player.dead) {
          this.player.switchWeapon(parseInt(k, 10) - 1);
        }
        return;
      }
      if (k === 'tab') { this.toggleBag(); }
      if (k === '5') {
        /* 输入框里按 5 是打字，不该吃药 */
        const ae = document.activeElement;
        const typing = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' ||
          ae.tagName === 'SELECT' || ae.isContentEditable);
        if (!typing) MedQuick.press();
        return;
      }
      if (k === 'escape') {
        /* 轮盘优先：Esc 只收轮盘，正在进行的治疗不动 */
        if (MedQuick.abortWheel()) { Tips.hide(); return; }
        if (Medical.cancel()) { Tips.hide(); return; }
        if (this.lootOpen) this.closeLoot();
        else if (this.bagOpen) this.toggleBag();
      }
      if (k === 'f1') { this.debug = !this.debug; e.preventDefault(); }
    });

    window.addEventListener('keyup', e => {
      const k = e.key.toLowerCase();
      K.keys[k] = false;
      /* 松手才判定这次是短按还是长按 —— 所以放在状态判断之前，
         场景切走时也要把轮回状态收干净 */
      if (k === '5') MedQuick.release();
    });

    this.canvas.addEventListener('mousemove', e => {
      const r = this.canvas.getBoundingClientRect();
      K.mx = (e.clientX - r.left) * (CFG.VIEW_W / r.width);
      K.my = (e.clientY - r.top) * (CFG.VIEW_H / r.height);
    });

    this.canvas.addEventListener('mousedown', e => {
      if (this.state !== 'playing') return;
      if (e.button === 0) K.mouseDown = true;
      if (e.button === 2) K.dodgePressed = true;
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 0) K.mouseDown = false;
    });
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());

    // 失焦时松开所有键，避免卡住（轮盘也一起收掉，别停在打开状态）
    window.addEventListener('blur', () => {
      for (const k in K.keys) K.keys[k] = false;
      K.mouseDown = false;
      MedQuick.cancel();
    });
  },

  bindUI() {
    document.getElementById('btnStart').onclick = () => {
      SFX.init();
      Base.open();
    };
    document.getElementById('btnDeploy').onclick = () => MapSelect.open();
    document.getElementById('btnMapBack').onclick = () => MapSelect.back();
    document.getElementById('btnMapStart').onclick = () => MapSelect.confirm();
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&this.state==='map-select'){e.preventDefault();MapSelect.back();}});
    document.getElementById('btnSellJunk').onclick = () => Base.sellJunk();
    Ctx.bindClose();
  },

  /* ---------------- 开局 ---------------- */

  /* 藏身处的背包 → 局内背包。装不下的（理论上藏身处已经拦过）
     留在 Save.bag 里，不带进图也不会丢。 */
  fillBagFromSave() {
    Save.normalizeBag();
    const stay = [];
    for (const e of Save.bag) {
      const it = stashItem(e);
      if (!it) continue;
      let ok = false;
      if (e.gear) {
        ok = this.player.bag.slots.length < CFG.BAG.SLOTS &&
             this.player.bag.weight() + it.w <= CFG.BAG.CARRY + 1e-6;
        if (ok) this.player.bag.slots.push({ item: it, n: 1 });
      } else if (it.cat === 'ammo') {
        const before = this.player.bag.ammoCount(it.id);
        ok = this.player.bag.addAmmo(it.id, e.n || 1) &&
             this.player.bag.ammoCount(it.id) === before + (e.n || 1);
      } else {
        ok = this.player.bag.add(it, e.n || 1, e.cap);
      }
      if (!ok) stay.push(e);
    }
    Save.bag = stay;
  },

  /* 旧式 loadout（{ammo556/ammo9mm/ammo12g/bandage/medical}）→ 直接发进背包。
     只有调试入口和老测试还在用这条路。 */
  grantLegacyBag(L) {
    const band = ITEM_BY_ID.heal01;
    const grants = [
      ['ammo_556_1', L.ammo556 || L.ammo || 0],
      ['ammo_9mm_1', L.ammo9mm || 0],
      ['ammo_12g_1', L.ammo12g || 0]
    ];
    for (const [id, n] of grants) {
      if (n > 0 && ITEM_BY_ID[id]) this.player.bag.add(ITEM_BY_ID[id], n);
    }
    if (L.bandage > 0) this.player.bag.add(band, L.bandage);
    for (const [id, n] of Object.entries(L.medical || {})) {
      if (id !== 'heal01' && Medical.is(ITEM_BY_ID[id]) && n > 0) this.player.bag.add(ITEM_BY_ID[id], n);
    }
  },

  startRun(loadout, mapId) {
    const map=MAP_CATALOG.find(m=>m.id===(mapId||RAID_MAP.id));
    if(!map)throw new Error('未知地图：'+mapId);
    this.mapId=map.id;
    this.state = 'playing';
    this.deathElapsed = 0;
    this._deathSoundPlayed = false;
    this.time = 0;
    this.tideLevel = 0;
    this.tidePhase = 0;
    this.enemies = [];
    this.bullets = [];
    this.corpses = [];
    this.particles = [];
    this.toasts = [];
    this.pileSeq = 0;
    this.action = null;
    this.lootOpen = null;
    this.extractDone = false;
    /* 新一局：快捷医疗重新按背包顺序选最靠前的那件 */
    if (typeof MedHud !== 'undefined') MedHud.reset();
    this.stats = { kills: 0, found: 0, newItems: [] };

    // 重置地图状态
    M.load(map.rows, map.doorAxes, map.props, map);
    for (let y = 0; y < M.H; y++) {
      for (let x = 0; x < M.W; x++) { M.seen[y * M.W + x] = 0; }
    }
    this.buildBoxes();

    // 玩家
    const sp = M.playerSpawn;
    const start=M.navigationPoint(sp.x,sp.y);
    this.player = new Player(start.x,start.y);
    this.player.hp = Save.hp;
    /* 默认从藏身处的背包里装（没传 loadout 就是这条路）；
       传了旧式 loadout（{ammo556:30,...}）的调用点按老规矩发东西，
       调试入口和测试还在用这种写法。 */
    if (loadout) {
      this.grantLegacyBag(loadout);
    } else {
      this.fillBagFromSave();
    }

    // 武器与护甲：护甲拷一份实例出来，耐久变化写回 Save.gear
    this.player.fillWeapons(Save.gear.weapons);
    /* 兜底：万一配装是全空的，至少给一把手枪，绝不空手进图 */
    if (!this.player.weapons.some(Boolean)) {
      this.player.fillWeapons([null, null, EQUIP.gun('pistol', WEAPONS.pistol.mag)]);
    }
    this.player.helmet = Save.gear.helmet ? Object.assign({}, Save.gear.helmet) : null;
    this.player.body = Save.gear.body ? Object.assign({}, Save.gear.body) : null;

    // 敌人
    for (const s of map.enemies) {
      const point=M.navigationPoint(s.x,s.y);
      this.enemies.push(new Enemy(s.type||s.t, point.x,point.y, s.patrolRadius));
    }

    Noise.clear();
    Quiet.clear();
    M.tideLevel = 0;
    this.stats.found = 0;
    this.closeLoot();
    if (this.bagOpen) this.toggleBag();

    this.updateCamera(true);
    this.toast('进入' + map.title);

    // 预热一帧：即使浏览器还没来得及跑 requestAnimationFrame，画面也不是黑的
    this.update(1 / 60);
    this.render();
  },

  /* ---------------- 主循环 ---------------- */
  // 每页最多保留一个动画请求。后台暂停由浏览器恢复原请求，不另开循环。
  scheduleFrame() {
    if (this._frameId != null) return;
    this._frameId = requestAnimationFrame(t => {
      this._frameId = null;
      this.loop(t);
    });
  },

  loop(now) {
    let dt = (now - this.lastT) / 1000;
    this.lastT = now;
    if (dt > 0.1) dt = 0.1;

    // 窗口尺寸变化时重新计算缩放（只在启动时算一次会漏掉窗口还没就绪的情况）
    if (window.innerWidth !== this._lastW || window.innerHeight !== this._lastH) {
      this._lastW = window.innerWidth;
      this._lastH = window.innerHeight;
      this.resize();
    }

    if (this.state === 'playing' || this.state === 'dying') {
      this.acc += dt;
      const STEP = 1 / 60;
      let guard = 0;
      while (this.acc >= STEP && guard++ < 5) {
        this.update(STEP);
        this.acc -= STEP;
      }
    } else {
      // 菜单里也让特效衰减
      this.shakeAmt *= 0.9;
      this.flashA *= 0.9;
    }

    this.render();
    if (typeof MedHud !== 'undefined') MedHud.frame();
    this.scheduleFrame();
  },

  /* ---------------- 更新 ---------------- */
  update(dt) {
    if (this.state === 'dying') {
      this.deathElapsed += dt;
      this.player.tickAnimation(dt, false);
      this.flashA *= Math.pow(0.004, dt);
    this.headT = Math.max(0, (this.headT || 0) - dt);
      this.shakeAmt *= Math.pow(0.001, dt);
      const clip = PLAYER_ANIMS.death;
      if (this.deathElapsed >= clip.frames / clip.fps + clip.hold) {
        this.state = 'ended'; this.showEnd(false);
      }
      return;
    }
    if (this.state !== 'playing') return;
    this.time += dt;
    this.updateTide();
    /* 长按 5 的判定：keydown 只立状态，计时在这里走，够 250ms 才开轮盘 */
    if (typeof MedQuick !== 'undefined') MedQuick.tick(dt);

    const P = this.player;
    const K = this.input;

    /* 世界坐标下的鼠标位置 */
    K.wx = K.mx + this.cam.x;
    K.wy = K.my + this.cam.y;
    K.aimAngle = Math.atan2(K.wy - P.y, K.wx - P.x);
    if (K.dodgePressed) Medical.cancel();

    /* 面板打开时忽略移动与射击 */
    if (!this.lootOpen) {
      P.update(dt, {
        mx: (K.keys.d ? 1 : 0) - (K.keys.a ? 1 : 0),
        my: (K.keys.s ? 1 : 0) - (K.keys.w ? 1 : 0),
        sneak: !!K.keys.shift,
        sprint: !!K.keys[' '],
        dodge: K.dodgePressed,
        aimAngle: K.aimAngle
      });
      if (K.mouseDown) P.tryShoot();
    } else {
      // 看面板时人站住，但世界继续
      P.update(dt, { mx: 0, my: 0, sneak: false, sprint: false, dodge: false, aimAngle: K.aimAngle });
    }

    if (P.dead) { this.beginDying(); return; }
    if (K.dodgePressed) K.dodgePressed = false;
    if (K.reloadPressed) { P.tryReload(); K.reloadPressed = false; }

    /* 交互 */
    if (K.interactPressed) {
      K.interactPressed = false;
      this.handleInteract();
    }

    /* 动作进度 */
    if (this.action) this.updateAction(dt);

    /* 敌人 */
    for (const e of this.enemies) {
      if (!e.dead) e.update(dt);
    }

    /* 子弹 */
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.update(dt);
      if (b.dead) this.bullets.splice(i, 1);
    }

    /* 粒子 */
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= (1 - 4 * dt); p.vy *= (1 - 4 * dt);
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    // 保险：连射 + 多个敌人同时挨打时粒子会瞬间堆到几百，画起来拖帧
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);

    /* 提示 */
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      this.toasts[i].t -= dt;
      if (this.toasts[i].t <= 0) this.toasts.splice(i, 1);
    }

    Noise.tick(dt);
    Quiet.tick(dt);

    /* 视野 */
    const pt = M.tx(P.x), pty = M.ty(P.y);
    M.computeFOV(pt, pty, CFG.FOV.RADIUS);
    M.applyCone(P.x, P.y, P.angle,
      (P.sneaking ? CFG.FOV.SNEAK_ANGLE : CFG.FOV.ANGLE) / 2,
      CFG.FOV.NEAR);

    /* 摄像机 */
    this.updateCamera();

    /* 抖动 / 闪白 */
    this.shakeAmt *= Math.pow(0.001, dt);
    if (this.shakeAmt > 0.2) {
      this.shakeX = U.rand(-this.shakeAmt, this.shakeAmt);
      this.shakeY = U.rand(-this.shakeAmt, this.shakeAmt);
    } else { this.shakeX = this.shakeY = 0; }
    this.flashA *= Math.pow(0.004, dt);
    this.headT = Math.max(0, (this.headT || 0) - dt);
    this.hitDirT = Math.max(0, this.hitDirT - dt);

    /* 逐件搜索：推进进度、持续发声、搜完就把这件标为已搜 */
    if (this.search && this.lootOpen) {
      const s2 = this.search;
      s2.t += dt;
      s2.noiseT -= dt;
      if (s2.noiseT <= 0) {
        s2.noiseT = CFG.ITEM_SEARCH.noiseEvery;
        Noise.emit(this.lootOpen.x, this.lootOpen.y, CFG.ITEM_SEARCH.noise, 'search');
      }
      if (this._searchBar) {
        this._searchBar.style.width = Math.min(100, s2.t / s2.total * 100) + '%';
      }
      if (s2.t >= s2.total) {
        const e = this.lootOpen.items[s2.idx];
        if (e) e.known = true;
        this.search = null;
        this._searchBar = null;
        SFX.play('pickup');
        this.renderLootList();
        this.stepAutoSearch();      // 还在自动模式就接着搜下一件
      }
    }

    /* 面板跟随检查：走远了自动关 */
    if (this.lootOpen) {
      const d = U.dist(P.x, P.y, this.lootOpen.x, this.lootOpen.y);
      if (d > 70) this.closeLoot();
    }

    /* 死亡 / 淹死 */
    if (P.dead) this.beginDying();
    else P.tickAnimation(dt, !!this.lootOpen || !!(this.action && ['search', 'corpse'].includes(this.action.type)));
  },

  updateTide() {
    const T = CFG.TIDE;
    const t = this.time;
    if (!M.tideEnabled) {
      this.tideLevel = M.tideLevel = 0;
      this.tidePhase = 0;
      if (t >= T.ROUND && !this.player.dead) {
        this.state = 'ended';
        this.showEnd(false, '行动时间已结束');
      }
      return;
    }
    if (t < T.PHASE) {
      this.tidePhase = 0;
      this.tideLevel = U.lerp(0, T.LEVEL[0], t / T.PHASE);
    } else if (t < T.PHASE * 2) {
      this.tidePhase = 1;
      this.tideLevel = U.lerp(T.LEVEL[0], T.LEVEL[1], (t - T.PHASE) / T.PHASE);
    } else if (t < T.ROUND) {
      this.tidePhase = 2;
      this.tideLevel = U.lerp(T.LEVEL[1], T.LEVEL[2], (t - T.PHASE * 2) / T.PHASE);
    } else {
      this.tidePhase = 3;
      this.tideLevel = T.LEVEL[2];
      M.tideLevel = this.tideLevel;
      if (!this.player.dead) {
        this.player.hp = 0;
        this.player.dead = true;
        this.state = 'ended';
        this.showEnd(false, '潮水涨满了');
      }
      return;
    }
    M.tideLevel = this.tideLevel;
  },

  updateCamera(snap) {
    const P = this.player;
    const mw = M.W * CFG.TILE, mh = M.H * CFG.TILE;
    let tx = P.x - CFG.VIEW_W / 2;
    let ty = P.y - CFG.VIEW_H / 2;
    // 朝鼠标方向偏移一点
    tx += Math.cos(this.input.aimAngle) * 34;
    ty += Math.sin(this.input.aimAngle) * 34;
    tx = U.clamp(tx, 0, Math.max(0, mw - CFG.VIEW_W));
    ty = U.clamp(ty, 0, Math.max(0, mh - CFG.VIEW_H));
    if (snap) { this.cam.x = tx; this.cam.y = ty; }
    else {
      this.cam.x += (tx - this.cam.x) * 0.16;
      this.cam.y += (ty - this.cam.y) * 0.16;
    }
  },

  /* ---------------- 交互 ---------------- */
  findInteractable() {
    const P = this.player;
    let best = null, bd = CFG.INTERACT_RANGE;

    // 撤离点
    for (const ex of M.extracts) {
      const d = U.dist(P.x, P.y, M.cx(ex.x), M.cy(ex.y));
      if (d < CFG.EXTRACT_RADIUS && d < bd + 6) {
        return { type: 'extract', obj: ex, dist: d };
      }
    }

    // 容器：只要里面还有东西就能反复翻，翻空的才不再提示
    for (const b of this.boxes) {
      if (!this.boxHasItems(b)) continue;
      const d = U.dist(P.x, P.y, b.x, b.y);
      if (d < bd && M.lineOfSight(M.tx(P.x), M.ty(P.y), b.tx, b.ty)) {
        bd = d; best = { type: 'box', obj: b, dist: d };
      }
    }

    // 尸体
    for (const c of this.corpses) {
      if (c.opened) continue;
      const d = U.dist(P.x, P.y, c.x, c.y);
      if (d < bd) { bd = d; best = { type: 'corpse', obj: c, dist: d }; }
    }

    // 门（独立阈值，避免被更近的容器挤掉）
    const ptx = M.tx(P.x), pty = M.ty(P.y);
    let bestDoor = null, bdDoor = CFG.INTERACT_RANGE + 14;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const t = M.at(ptx + dx, pty + dy);
        if (!t || !t.door) continue;
        const d = U.dist(P.x, P.y, M.cx(ptx + dx), M.cy(pty + dy));
        if (d < bdDoor) {
          bdDoor = d;
          bestDoor = { type: 'door', obj: { t, x: ptx + dx, y: pty + dy }, dist: d };
        }
      }
    }
    if (bestDoor && (!best || bestDoor.dist < best.dist + 10)) best = bestDoor;
    return best;
  },

  handleInteract() {
    // 正在读条 → 取消
    if (this.action) {
      this.action = null;
      this.toast('中断');
      return;
    }
    if (this.lootOpen) { this.closeLoot(); return; }

    const it = this.findInteractable();
    if (!it) { this.toast('附近没有可交互的东西'); return; }

    if (it.type === 'door') {
      const d = it.obj.t.door;
      if (d.open) {
        const cells = d.cells || [[it.obj.x,it.obj.y]];
        const occupied = [this.player,...this.enemies].some(e=>!e.dead&&cells.some(([x,y])=>{
          const cx=U.clamp(e.x,x*CFG.TILE,(x+1)*CFG.TILE),cy=U.clamp(e.y,y*CFG.TILE,(y+1)*CFG.TILE);
          return (e.x-cx)**2+(e.y-cy)**2 < e.r**2;
        }));
        if(occupied){this.toast('门口有人，暂时无法关门');return;}
      }
      d.open = !d.open;
      Noise.emit(M.cx(it.obj.x), M.cy(it.obj.y), CFG.NOISE.door, 'door');
      SFX.play('door');
      this.toast(d.open ? '门开了' : '门关上了');
      return;
    }

    if (it.type === 'extract') {
      this.action = { type: 'extract', t: 0, total: CFG.EXTRACT_TIME };
      this.toast('撤离中——别动');
      return;
    }

    if (it.type === 'box') {
      const b = it.obj;
      /* 已经掀开过的容器不用重新撬：直接看里子，也不再重复发声。
         只有第一次要按品质读条——那是"撬开"的动作，之后只是翻找。 */
      if (b.searched) { this.openLoot(b); return; }
      const q = CONTAINER_QUALITY[b.kind] || CONTAINER_QUALITY.plain;
      this.action = {
        type: 'search', t: 0, total: Math.max(0.01, q.time),
        target: b, kind: b.kind, still: q.still
      };
      // 贵重 / 秘藏容器读条全程发声
      if (q.still) {
        Noise.emit(b.x, b.y, q.noise, 'search');
      }
      SFX.play('search');
      return;
    }

    if (it.type === 'corpse') {
      this.action = { type: 'corpse', t: 0, total: 0.35, target: it.obj };
      return;
    }
  },

  updateAction(dt) {
    const a = this.action;
    if (!a) return;                 // tick 里可能已经结束（比如容量刚好归零）
    const P = this.player;
    /* 治疗有自己的状态机（启动 → 持续），不按 total 一刀切：
       期间允许走路（30% 速度），冲刺/攻击/切枪/闪避会各自调 Medical.cancel。 */
    if (a.type === 'heal') {
      Medical.tick(a, dt);
      return;
    }
    a.t += dt;

    // 移动会打断（撤离和需要站定的容器）
    if (a.type === 'extract' || (a.type === 'search' && a.still)) {
      const moving = Math.hypot(P.vx, P.vy) > 12;
      if (moving) {
        this.action = null;
        this.toast('被打断了');
        return;
      }
    }

    if (a.type === 'search') {
      // 需要读条的容器：走开就断（要求站定的那两档已经在上面的移动判定里处理）
      if (a.total > 0.05 && !a.still) {
        if (U.dist(P.x, P.y, a.target.x, a.target.y) > CFG.INTERACT_RANGE + 8) {
          this.action = null;
          return;
        }
      }
    }

    if (a.t >= a.total) {
      if (a.type === 'search') {
        a.target.searched = true;        // 掀开过了，之后可以反复打开
        this.syncBoxState(a.target);     // 有东西就保持可交互，空的才变暗
        this.openLoot(a.target);
        this.stats.found++;
      } else if (a.type === 'corpse') {
        a.target.opened = true;
        this.openLoot(a.target, true);
      } else if (a.type === 'extract') {
        this.action = null;
        this.doExtract();
      }
      if (a.type !== 'extract') this.action = null;
    }
  },

  /* ---------------- 搜刮面板 ---------------- */
  openLoot(obj, isCorpse) {
    Medical.cancel();
    this.lootOpen = obj;
    this.lootIsCorpse = !!isCorpse;
    if (isCorpse && !obj.items) obj.items = obj.loot;

    // 第一次打开时每一件都是"未搜索"。搜过的容器再打开会记住状态。
    for (const e of (obj.items || [])) {
      if (e && e.known === undefined) e.known = false;
    }

    const box = document.getElementById('lootBox');
    box.style.display = 'block';
    document.getElementById('lootTitle').textContent = isCorpse
      ? (obj.enemy ? obj.enemy.t.name + '的尸体' : '尸体')
      : (obj.name || '容器');

    this.search = null;
    this._searchBar = null;
    this.autoSearch = true;      // 打开就一件件往下搜，点某一件才转成目标搜索
    this.renderLootList();
    this.stepAutoSearch();

    // 搜刮时背包一起打开（左侧），关面板时如果是自动开的就收回去
    if (!this.bagOpen) {
      this.bagWasAuto = true;
      this.toggleBag();
    }
  },

  closeLoot() {
    this.lootOpen = null;
    this.search = null;
    this.autoSearch = false;
    this._searchBar = null;
    document.getElementById('lootBox').style.display = 'none';
    if (this.bagWasAuto) {
      this.bagWasAuto = false;
      if (this.bagOpen) this.toggleBag();
    }
  },

  /* 按稀有度算这一件要搜多久 */
  searchTime(it) {
    const arr = CFG.ITEM_SEARCH.timeByRarity;
    return arr[U.clamp(it.r - 1, 0, arr.length - 1)];
  },

  /* 自动顺序搜索：容器一打开就自己往下搜，一件完接下一件。
     玩家点某一件时 autoSearch 关掉，之后只搜他指定的那件。
     拿走已搜出来的东西不打断队列（拿完接着搜）。 */
  stepAutoSearch() {
    if (!this.autoSearch || this.search || !this.lootOpen) return;
    const arr = this.lootOpen.items || [];
    for (let i = 0; i < arr.length; i++) {
      const e = arr[i];
      if (e && e.item && !e.known) { this.startItemSearch(i); return; }
    }
    this.autoSearch = false;      // 都搜完了
  },

  /* 点一下未搜索的物品开始搜。搜到一半换一件，前一件的进度归零。
     manual = true 表示玩家指定了目标，就此停下自动顺序搜索。 */
  startItemSearch(idx, manual) {
    const box = this.lootOpen;
    if (!box || !box.items) return false;
    const e = box.items[idx];
    if (!e || e.known) return false;

    if (manual) this.autoSearch = false;
    this.search = { idx: idx, t: 0, total: this.searchTime(e.item), noiseT: 0 };
    this.renderLootList();
    SFX.play('search');
    return true;
  },

  renderLootList() {
    const el = document.getElementById('lootList');
    el.innerHTML = '';
    this._searchBar = null;
    if (!this.lootOpen || !this.lootOpen.items) {
      this.renderLootGear();
      return;
    }

    const arr = this.lootOpen.items;
    this.renderLootGear();

    const left = arr.filter(Boolean).length;
    const hint = document.getElementById('lootHint');
    if (hint) {
      hint.textContent = !left ? 'E 关闭'
        : (this.autoSearch ? '自动搜索中 · 点某件优先搜' : '点击搜索 · E 关闭');
    }

    if (!left) {
      el.innerHTML = '<div style="font-size:11.5px;color:#4f665f;padding:8px 2px">空的。</div>';
      return;
    }

    arr.forEach((entry, i) => {
      if (!entry) return;

      /* ---- 尸体身上的装备：已经画在上面的装备格里，不在下面重复 ---- */
      if (entry.gear || entry.gun) return;

      const it = entry.item;
      const row = document.createElement('div');

      /* ---- 还没搜出来：只给一个压暗的剪影，不透露稀有度和价值 ---- */
      if (!entry.known) {
        const searching = this.search && this.search.idx === i;
        row.className = 'row unknown';
        if (!searching) {
          /* 自动模式下后面几件是"排队"，点一下就插队 */
          row.innerHTML =
            '<span class="ico phq">?</span>' +
            '<span class="nm">' + (this.autoSearch ? '排队' : '未搜索') + '</span>' +
            '<span class="vv">—</span>';
        } else {
          row.innerHTML =
            '<span class="ico phq">?</span>' +
            '<span class="nm">搜索中</span>' +
            '<span class="prog"><i style="width:' +
            Math.min(100, this.search.t / this.search.total * 100) + '%"></i></span>';
        }
        /* 点一件 = 我要先搜这个：中断自动顺序搜索，改搜指定目标 */
        row.onclick = () => { if (!this.search || this.search.idx !== i) this.startItemSearch(i, true); };
        row.oncontextmenu = (ev) => { ev.preventDefault(); this.toast('还没搜出来，看不了'); };
        el.appendChild(row);
        if (searching) this._searchBar = row.querySelector('.prog i');
        return;
      }

      /* ---- 搜出来了：显示名称、重量、价格 ---- */
      row.className = 'row ' + RARITY[it.r - 1].cls;
      const known = Save.codex[it.id];

      let badges = '';
      if (!it.noCodex && !known) badges += '<span class="badge">新</span>';

      row.innerHTML =
        Icons.tag(it.id) +
        '<span class="nm">' + it.name + badges + '</span>' +
        '<span class="vv">' + it.w.toFixed(2) + 'kg · ' +
        (it.price > 0 ? formatMoney(it.price) : '—') + '</span>';

      row.onclick = () => {
        const cur = this.lootOpen && this.lootOpen.items[i];
        if (!cur) return;
        const res = this.player.bag.canAdd(it, cur.n, cur.cap);
        if (!res.ok) { this.toast(res.why); return; }
        this.player.bag.add(it, cur.n, cur.cap);
        if (!it.noCodex) this.registerCodex(it);
        this.lootOpen.items[i] = null;
        SFX.play('pickup');
        /* 拿空后：普通容器压暗停用，遗落物品堆直接消失（并关掉面板） */
        this.syncBoxState(this.lootOpen);
        if (!this.lootOpen) { this.renderBag(); return; }
        this.renderLootList();
        this.stepAutoSearch();      // 拿东西不打断自动搜索，拿完接着搜
        if (this.bagOpen) this.renderBag();
      };
      /* 右键看详情：拿之前先确认这东西值不值得占一格 */
      row.oncontextmenu = (ev) => {
        ev.preventDefault();
        const cur2 = this.lootOpen && this.lootOpen.items[i];
        if (!cur2) return;
        Tips.show(it, row.getBoundingClientRect(), '左键装进背包');
      };
      el.appendChild(row);
    });
  },

  /* ---------------- 尸体装备：方格布局 ---------------- */
  /* 和背包顶部同一套方格：头盔 / 护甲 / 武器 三格，左键穿上、右键带回 */
  renderLootGear() {
    const bar = document.getElementById('lootGear');
    const tip = document.getElementById('lootGearTip');
    if (!bar) return;

    const arr = (this.lootOpen && this.lootOpen.items) || [];
    const at = {
      helmet: arr.findIndex(e => e && e.gear && e.gear.type === 'helmet'),
      body: arr.findIndex(e => e && e.gear && e.gear.type === 'body'),
      gun: arr.findIndex(e => e && e.gun)
    };
    const any = at.helmet >= 0 || at.body >= 0 || at.gun >= 0;

    if (!this.lootIsCorpse || !any) {
      bar.style.display = 'none';
      if (tip) tip.style.display = 'none';
      return;
    }
    bar.style.display = 'grid';
    if (tip) tip.style.display = 'block';

    const P = this.player;
    const cells = [];

    /* 头盔 */
    {
      const e = at.helmet >= 0 ? arr[at.helmet] : null;
      const g = e && e.gear;
      cells.push({
        idx: at.helmet,
        icon: g ? 'helmet' + g.lv : null,
        fb: g ? '盔' : '—',
        label: g ? g.short : '头盔',
        tag: g ? Math.ceil(g.dur) + '/' + g.max : '',
        tagCls: g ? (GEAR.state(g) === 'ok' ? '' : GEAR.state(g)) : '',
        own: !!(P && P.helmet),
        item: g ? EQUIP.armor(g) : null
      });
    }

    /* 护甲 */
    {
      const e = at.body >= 0 ? arr[at.body] : null;
      const g = e && e.gear;
      cells.push({
        idx: at.body,
        icon: g ? 'body' + g.lv : null,
        fb: g ? '甲' : '—',
        label: g ? g.short : '护甲',
        tag: g ? Math.ceil(g.dur) + '/' + g.max : '',
        tagCls: g ? (GEAR.state(g) === 'ok' ? '' : GEAR.state(g)) : '',
        own: !!(P && P.body),
        item: g ? EQUIP.armor(g) : null
      });
    }

    /* 武器 */
    {
      const e = at.gun >= 0 ? arr[at.gun] : null;
      const id = e ? this.gunId(e) : null;
      const w = id ? WEAPONS[id] : null;
      cells.push({
        idx: at.gun,
        icon: id,
        fb: w ? w.short.charAt(0) : '—',
        label: w ? w.short : '武器',
        tag: w ? w.mag + '发' : '',
        own: !!(P && w && (w.slot === 'primary' ? (P.weapons[0] && P.weapons[1]) : P.weapons[2])),
        item: w ? EQUIP.gun(id, 0) : null
      });
    }

    /* 身上已经有同类装备时，这一格点下去是"放进背包"，用角标提示 */
    bar.innerHTML = cells.map(c =>
      '<div class="eqs' + (c.icon ? '' : ' empty') + '" title="' +
        esc(c.label) +
        (c.icon ? (c.own ? ' · 已有同类，点击放进背包' : ' · 点击穿上') + ' · 右键看详情' : '') + '">' +
        (c.icon && c.own ? '<span class="carry">包</span>' : '') +
        '<span class="lbl">' + esc(c.label) + '</span>' +
        '<span class="ic">' + Icons.gearIcon(c.icon, c.fb) + '</span>' +
        (c.tag ? '<span class="tag ' + (c.tagCls || '') + '">' + esc(c.tag) + '</span>' : '') +
      '</div>').join('');

    // 每格绑定点：左键拾取（没有同类装备就穿，有就放包）；右键看详情
    const nodes = bar.children || [];
    for (let n = 0; n < nodes.length; n++) {
      const c = cells[n];
      const node = nodes[n];
      if (!c || c.idx < 0) { node.classList.add('empty'); continue; }
      node.onclick = () => this.takeGear(this.lootOpen.items[c.idx], c.idx);
      if (c.item && node.addEventListener) {
        node.oncontextmenu = (ev) => {
          ev.preventDefault();
          Tips.show(c.item, node.getBoundingClientRect(),
            c.own ? '已有同类，左键放进背包' : '左键直接穿上');
        };
      }
    }
  },

  /* 尸体上的枪可能存成 id 字符串，也可能是早期写的整份 WEAPONS 对象 */
  gunId(entry) {
    const g = entry && entry.gun;
    if (!g) return null;
    return typeof g === 'string' ? g : (g.id || null);
  },

  /* 从尸体上拿装备：身上没有对应的就直接穿上，已经有了就塞进背包。
     装备进背包会占一格、算重量 —— 这是把它带出去要付的代价。 */
  takeGear(entry, idx) {
    const P = this.player;
    if (!P || !entry) return false;
    const isGun = !!entry.gun;
    const gunId = this.gunId(entry);
    const g = isGun ? WEAPONS[gunId] : entry.gear;
    if (!g) return false;

    let msg = '';

    if (isGun) {
      /* 主武器进 0/1，副武器进 2；有空位就先穿上 */
      const range = g.slot === 'primary' ? [0, 1] : [2];
      const free = range.find(k => !P.weapons[k]);
      if (free != null) {
        const got = Math.max(1, Math.round(g.mag * 0.3));
        P.weapons[free] = Object.assign({}, g, { magCur: got });
        if (!P.weapons[P.slot]) { P.slot = free; P.mag = got; }
        msg = '换上 ' + g.name + '（' + got + ' 发）';
      }
    } else if (!P[g.type]) {
      P[g.type] = Object.assign({}, g);
      msg = '穿上 ' + g.name;
    }

    if (!msg) {
      const item = isGun
        ? EQUIP.gun(gunId, Math.max(1, Math.round(g.mag * 0.3)))
        : EQUIP.armor(g);
      const res = P.bag.canAdd(item, 1);
      if (!res.ok) { this.toast(res.why); return false; }
      P.bag.add(item, 1);
      msg = '放进背包 · ' + g.name;
    }

    this.lootOpen.items[idx] = null;
    SFX.play('pickup');
    this.toast(msg);
    this.syncGear();                 // 穿上的东西直接写回存档
    this.renderLootList();
    if (this.bagOpen) this.renderBag();
    return true;
  },

  /* 点背包里的装备 → 穿上；手上已有同类，就把换下来的塞回这一格 */
  equipFromBag(i) {
    const P = this.player;
    const s = P && P.bag.slots[i];
    if (!s || !s.item || !s.item.equip) return false;
    const eq = s.item.equip;
    let old = null;

    if (eq.kind === 'gun') {
      const def = WEAPONS[eq.gun];
      if (!def) return false;
      const range = def.slot === 'primary' ? [0, 1] : [2];
      const free = range.find(k => !P.weapons[k]);
      const at = (free != null) ? free : P.slot;     // 没有空位就换手上这把
      const cur = P.weapons[at];
      if (cur) old = EQUIP.gun(cur.id, cur.magCur, cur.ammo);
      P.weapons[at] = Object.assign({}, def, {
        magCur: eq.mag || 0,
        ammo: (AMMO_BY_ID[eq.ammo] && AMMO_BY_ID[eq.ammo].caliber === def.caliber) ? eq.ammo : def.ammo
      });
      P.slot = at;
      P.mag = P.weapons[at].magCur;
    } else {
      const g = eq.gear;
      const cur = P[g.type];
      if (cur) old = EQUIP.armor(cur);
      P[g.type] = Object.assign({}, g);
    }

    if (old) P.bag.slots[i] = { item: old, n: 1 };
    else P.bag.slots.splice(i, 1);

    SFX.play('pickup');
    this.toast('穿上 ' + s.item.name + (old ? '，' + old.name + ' 留在背包' : ''));
    this.syncGear();
    this.renderBag();
    return true;
  },

  registerCodex(it) {
    if(it.noCodex || it.equip || itemGroup(it)!=='collectible')return;
    if (!Save.codex[it.id]) {
      Save.codex[it.id] = { first: Date.now(), count: 0 };
      this.stats.newItems.push(it);
      this.toast('新收录：' + it.name);
    }
    Save.codex[it.id].count++;
    Save.save();
  },

  /* ---------------- 背包面板 ---------------- */
  toggleBag() {
    this.bagOpen = !this.bagOpen;
    const el = document.getElementById('bagBox');
    el.classList.toggle('open', this.bagOpen);
    if (this.bagOpen) this.renderBag();
  },

  /* 背包顶部的装备格：和物品格同一种方格，名字压在格子上面。
     一行 6 格（主1 主2 副手 头盔 护甲 背包），整条 38px 高。 */
  renderGearPanel() {
    const P = this.player;
    if (!P) return;
    const el = document.getElementById('eqStrip');
    if (!el) return;

    const cells = [];

    /* --- 三个武器位 --- */
    for (let i = 0; i < 3; i++) {
      const w = P.weapons[i];
      cells.push({
        icon: w ? w.id : null,
        fb: w ? w.short.charAt(0) : '',
        label: w ? w.short : (i < 2 ? '主武器' + (i + 1) : '副武器'),
        on: i === P.slot,
        /* 手上那把读 P.mag（实时），其它槽读各自记着的余弹 */
        tag: w ? ((i === P.slot ? P.mag : w.magCur) + '/' + w.mag) : '',
        click: w ? () => { P.switchWeapon(i); this.renderGearPanel(); } : null
      });
    }

    /* --- 头盔 / 护甲 --- */
    for (const type of ['helmet', 'body']) {
      const g = P[type];
      const st = g ? GEAR.state(g) : '';
      cells.push({
        icon: g ? type + g.lv : null,
        fb: g ? (type === 'helmet' ? '盔' : '甲') : '',
        label: g ? g.short : (type === 'helmet' ? '头盔' : '护甲'),
        tag: g ? 'Lv' + g.lv : '',
        tagCls: st === 'ok' ? '' : st,
        click: null
      });
    }

    /* --- 背包（还没开放，占一个位） --- */
    cells.push({
      icon: 'bag',
      fb: '包',
      label: '背包',
      tag: CFG.BAG.SLOTS + '格',
      click: null
    });

    el.innerHTML = cells.map(c =>
      '<div class="eqs' + (c.on ? ' on' : '') + (c.icon ? '' : ' empty') +
        (c.click ? ' live' : '') + '" title="' + esc(c.label) + '">' +
        '<span class="lbl">' + esc(c.label) + '</span>' +
        '<span class="ic">' + Icons.gearIcon(c.icon, c.fb) + '</span>' +
        (c.tag ? '<span class="tag ' + (c.tagCls || '') + '">' + esc(c.tag) + '</span>' : '') +
      '</div>').join('');

    // 点武器格切枪（无头测试里的假 DOM 没有 children，跳过绑定即可）
    const nodes = el.children || [];
    for (let n = 0; n < nodes.length; n++) {
      const c = cells[n];
      if (c && c.click) nodes[n].onclick = c.click;
    }
  },

  renderBag() {
    const P = this.player;
    if (!P) return;
    this.renderGearPanel();
    const grid = document.getElementById('bagGrid');
    grid.innerHTML = '';
    for (let i = 0; i < CFG.BAG.SLOTS; i++) {
      const cell = document.createElement('div');
      const s = P.bag.slots[i];
      if (s) {
        const it = s.item;
        cell.className = 'cell ' + RARITY[it.r - 1].cls + (it.equip ? ' eq' : '');
        cell.style.color = '#b9cac4';
        const ico = Icons.bagTag(it, 'ico-bag');
        /* 装备只有一件，右上角改显示枪里的余弹 */
        const qty = it.note
          ? '<span class="qty">' + esc(it.note) + '</span>'
          : (s.n > 1 ? '<span class="qty">' + s.n + '</span>' : '');
        /* 用过的恢复品把剩余容量直接标在格子里，不用点开详情才知道 */
        const capTag = (it.healCap && Medical.isPartial(s))
          ? '<span class="cap">' + Math.ceil(Medical.entryCap(s)) + '</span>' : '';
        const label = it.short || it.name;
        cell.innerHTML = ico + '<span class="cn">' + esc(label) + '</span>' + qty + capTag;
        /* 弹药：左键把它设为当前武器的待装填弹种（口径不对会直接提示） */
        const isAmmo = it.cat === 'ammo';
        const isLoaded = isAmmo && P.ammoId === it.id;
        cell.title = (it.healCap && Medical.isPartial(s)
            ? it.name + ' · 剩余容量 ' + Math.ceil(Medical.entryCap(s)) + ' / ' + it.healCap
            : it.name + ' · ' + it.w + 'kg') + ' · 右键看详情' +
          (isAmmo ? (isLoaded ? ' · 当前装填' : ' · 左键设为待装填')
           : Medical.is(it) ? ' · 左键打开医疗操作'
           : it.equip ? ' · 左键替换身上那件' : ' · 左键移入安全箱');
        if (isLoaded) cell.classList.add('loaded');
        cell.onclick = () => {
          if (isAmmo) { this.selectAmmo(i); return; }
          if (Medical.is(it)) Medical.open(s, 'bag', cell);
          else if (it.equip) this.equipFromBag(i);
          else this.moveToSafe(i);
        };
        /* 右键菜单：详情 / 丢弃。丢弃会整叠落在脚下一格 */
        cell.oncontextmenu = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          Ctx.show(ev.clientX, ev.clientY, [
            {
              label: '查看详情',
              onClick: () => Tips.show(it, cell.getBoundingClientRect(),
                it.cat === 'ammo' ? '左键设为待装填' : it.equip ? '左键替换身上那件' : '左键移入安全箱')
            },
            {
              label: '丢弃',
              hint: s.n > 1 ? '整叠 ×' + s.n : '脚下',
              danger: true,
              onClick: () => this.dropFromBag(i)
            }
          ]);
        };
      } else {
        cell.className = 'cell empty';
        cell.textContent = '·';
      }
      grid.appendChild(cell);
    }

    const sg = document.getElementById('safeGrid');
    sg.innerHTML = '';
    for (let i = 0; i < CFG.BAG.SAFE; i++) {
      const cell = document.createElement('div');
      const s = P.bag.safe[i];
      if (s) {
        cell.className = 'cell safe ' + RARITY[s.item.r - 1].cls;
        cell.style.color = '#b9cac4';
        const ico2 = Icons.bagTag(s.item, 'ico-safe');
        cell.innerHTML = ico2 + '<span class="cn">' + esc(s.item.short || s.item.name) + '</span>' +
          (s.n > 1 ? '<span class="qty">' + s.n + '</span>' : '') +
          ((s.item.healCap && Medical.isPartial(s))
            ? '<span class="cap">' + Math.ceil(Medical.entryCap(s)) + '</span>' : '');
        cell.title = s.item.name + (s.item.healCap && Medical.isPartial(s)
            ? ' · 剩余容量 ' + Math.ceil(Medical.entryCap(s)) + ' / ' + s.item.healCap
            : ' · ' + s.item.w + 'kg') + ' · 左键移回背包 · 右键看详情';
        cell.onclick = () => {
          if (Medical.is(s.item)) { Medical.open(s, 'safe', cell); return; }
          if (P.bag.slots.length >= CFG.BAG.SLOTS) { this.toast('背包满了'); return; }
          P.bag.slots.push(P.bag.safe.splice(i, 1)[0]);
          this.renderBag();
        };
        cell.oncontextmenu = (ev) => {
          ev.preventDefault();
          Tips.show(s.item, cell.getBoundingClientRect(), '左键移回背包');
        };
      } else {
        cell.className = 'cell empty safe';
        cell.textContent = '·';
      }
      sg.appendChild(cell);
    }

    const w = P.bag.weight(), t = P.bag.tier();
    document.getElementById('bagWeight').textContent = w.toFixed(1) + ' / ' + CFG.BAG.CARRY + ' kg · ' + t.name;
    document.getElementById('bagValue').textContent = formatMoney(P.bag.value());
    const bar = document.getElementById('bagBar');
    bar.querySelector('i').style.width = Math.min(100, w / CFG.BAG.CARRY * 100) + '%';
    bar.classList.toggle('warn', t.i >= 2);

  },

  /* 背包里点弹药 → 设为当前武器的待装填弹种。
     弹匣里剩的旧弹会退回背包，数量守恒；口径不对直接拒绝。 */
  selectAmmo(i) {
    const P = this.player;
    const s = P && P.bag.slots[i];
    if (!s || s.item.cat !== 'ammo') return false;
    const ok = P.loadAmmo(s.item.id);
    if (this.bagOpen) this.renderBag();
    return ok;
  },

  moveToSafe(i) {
    const P = this.player;
    if (P.bag.safe.length >= CFG.BAG.SAFE) { this.toast('安全箱满了'); return; }
    Medical.cancel();
    P.bag.safe.push(P.bag.slots.splice(i, 1)[0]);
    this.renderBag();
  },

  /* ---------------- 事件 ---------------- */
  onEnemyKilled(e) {
    this.stats.kills++;
    this.corpses.push(new Corpse(e.x, e.y, e));
    // 战后安静区
    Quiet.add(e.x, e.y, CFG.QUIET_RADIUS, CFG.QUIET_TIME);
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: e.x, y: e.y,
        vx: U.rand(-70, 70), vy: U.rand(-70, 70),
        life: U.rand(0.25, 0.6), c: '#8d3a3a', s: U.rand(1.5, 3)
      });
    }
    this.toast(e.t.name + '倒下了');
  },

  onPlayerDeath(player) {
    if (!player || player === this.player) this.beginDying();
  },

  beginDying() {
    if (this.state !== 'playing') return;
    this.state = 'dying';
    Save.setHP(1);
    this.deathElapsed = 0;
    this._deathSoundPlayed = true;
    this.action = null;
    this.closeLoot();
    if (this.bagOpen) this.toggleBag();
    if (typeof MedHud !== 'undefined') MedHud.reset();   // 死亡：轮盘和按住状态一并清掉
    this.player.dodgeT = 0;
    this.player.tickAnimation(0, false);
    SFX.play('death'); this.shake(9);
  },

  doExtract() {
    this.state = 'ended';
    this.showEnd(true);
  },

  /* ---------------- 结算 ---------------- */
  showEnd(success, reason) {
    this.action = null;
    this.closeLoot();
    if (this.bagOpen) this.toggleBag();
    if (typeof MedHud !== 'undefined') MedHud.reset();   // 收尾：轮盘、快捷栏、进度条一起清
    if (success || !this._deathSoundPlayed) SFX.play(success ? 'extract' : 'death');

    const P = this.player;
    Save.setHP(success ? P.hp : 1);
    const carried = P.bag.slots.slice();
    const safe = P.bag.safe.slice();
    const kept = success ? carried.concat(safe) : safe;

    /* 回藏身处自动分拣：子弹和药物留在背包里（下一趟接着用），
       收集品、物资、装备一律回仓库。死亡时只有安全箱里的东西参与分拣。
       背包实在塞不下的时候退回仓库，宁可多走一步也不吞东西。 */
    Save.normalizeBag();
    const lines = [];
    let bagged = 0, baggedValue = 0;
    for (const s of kept) {
      const it = s.item;
      const stays = !it.equip && (it.cat === 'ammo' || Medical.is(it));
      if (stays && !Base.bagBlock(it, s.n)) {
        Save.addBag(it.id, s.n, s.cap);
        bagged++;
        baggedValue += (it.price || 0) * s.n;
        lines.push({ name: it.name + (s.n > 1 ? ' ×' + s.n : ''), price: (it.price || 0) * s.n, bag: true });
        continue;
      }
      if (it.equip) {
        Save.addGearStash(it);
        lines.push({ name: it.name, price: it.sell, gear: true });
        continue;
      }
      Save.addStash(it.id, s.n, s.cap);
      if (!it.noCodex && !Save.codex[it.id]) {
        Save.codex[it.id] = { first: Date.now(), count: 1 };
      }
      lines.push({ name: it.name + (s.n > 1 ? ' ×' + s.n : ''), price: it.price * s.n });
    }

    Save.runs = (Save.runs || 0) + 1;
    Save.save();
    Save.flush();          // 一局结束，立刻落盘，不等节流

    const total = lines.reduce((a, b) => a + b.price, 0);
    const newOnes = this.stats.newItems;

    let html = '';
    html += '<div class="kicker">' + (success ? 'EXTRACTED' : 'LOST IN THE TIDE') + '</div>';
    html += '<h1 style="font-size:26px">' + (success ? '撤离成功' : '没能出来') + '</h1>';
    html += '<div class="sub">' +
      (success ? '用时 ' + this.fmtTime(this.time) + (M.tideEnabled ? ' · 潮汐第 ' + (this.tidePhase + 1) + ' 阶段' : ' · ' + (M.map||RAID_MAP).title)
        : (reason || '你倒在了' + (M.map ? M.map.title : '围栏区') + '里')) + '</div>';

    html += '<h2>这一趟</h2>';
    html += '<div class="settle-row"><span>击杀</span><b>' + this.stats.kills + '</b></div>';
    html += '<div class="settle-row"><span>开过的容器</span><b>' + this.stats.found + '</b></div>';
    html += '<div class="settle-row"><span>带出物品</span><b>' + kept.length + ' 件 / ' + formatMoney(total) + '</b></div>';
    if (bagged) {
      html += '<div class="settle-row"><span>子弹 / 药物留背包</span><b>' +
        bagged + ' 件 / ' + formatMoney(baggedValue) + '</b></div>';
    }
    html += '<div class="settle-row"><span>新收录</span><b>' + newOnes.length + '</b></div>';
    const gearCount = kept.filter(s => s.item.equip).length;
    if (gearCount) {
      html += '<div class="settle-row"><span>带出装备</span><b>' + gearCount + ' 件 · 已进仓库</b></div>';
    }
    html += '<div class="settle-row"><span>信用点余额</span><b>' + formatMoney(Save.credits) + '</b></div>';

    if (!success && carried.length) {
      html += '<h2>丢在里面的东西</h2>';
      for (const s of carried) {
        html += '<div class="settle-row"><span>' + s.item.name + '</span><b class="dim">' +
          formatMoney(s.item.price * s.n) + '</b></div>';
      }
      html += '<div class="tip">安全箱里的 ' + safe.length + ' 件保住了。这就是它存在的理由。</div>';
    }

    if (kept.length) {
      html += '<h2>' + (success ? '带回' : '保住的') + '</h2>';
      for (const l of lines) {
        const isNew = newOnes.some(x => x.name === l.name.replace(/ ×\d+$/, ''));
        html += '<div class="settle-row"><span>' + l.name +
          (isNew ? '<span class="newtag">NEW</span>' : '') +
          '</span><b>' + formatMoney(l.price) + '</b></div>';
      }
    }

    const known = Save.codexCount();
    const totalItems = ITEMS.filter(i => !i.noCodex).length;
    html += '<h2>图鉴</h2>';
    html += '<div class="settle-row"><span>已收录</span><b>' + known + ' / ' + totalItems + '</b></div>';
    html += '<div class="bar" style="margin-top:8px"><i style="width:' +
      (known / totalItems * 100) + '%"></i></div>';

    html += '<div class="tip" style="margin-top:18px">弹药和药物留在背包里，下一趟接着用；其它的已经进仓库了，回藏身处可以卖掉换信用点。</div>';
    html += '<button id="btnAgain">回 藏 身 处</button>';

    const card = document.getElementById('endCard');
    card.innerHTML = html;
    document.getElementById('endVeil').classList.remove('hidden');

    document.getElementById('btnAgain').onclick = () => {
      document.getElementById('endVeil').classList.add('hidden');
      Base.open();
    };
  },

  fmtTime(s) {
    const m = Math.floor(s / 60), ss = Math.floor(s % 60);
    return m + ':' + (ss < 10 ? '0' : '') + ss;
  },

  /* ---------------- 反馈 ---------------- */
  /* 护甲耐久 / 武器余弹变化后写回存档，死了也不回滚——装备是消耗品 */
  syncGear() {
    const P = this.player;
    if (!P) return;
    P.weapons[P.slot] && (P.weapons[P.slot].magCur = P.mag);   // 手上那把的余弹先同步
    Save.gear.weapons = P.weapons.map(w => (w ? EQUIP.gun(w.id, w.magCur, w.ammo) : null));
    Save.gear.helmet = P.helmet ? Object.assign({}, P.helmet) : null;
    Save.gear.body = P.body ? Object.assign({}, P.body) : null;
    Save.save();
  },

  /* 被爆头时的一次性提示 */
  headshotMark() {
    this.headT = 0.45;
  },

  toast(msg) {
    this.toasts.push({ msg, t: 2.2 });
    if (this.toasts.length > 4) this.toasts.shift();
  },
  sfx(name) { SFX.play(name); },
  shake(a) { this.shakeAmt = Math.min(12, this.shakeAmt + a); },
  flash(c, a) { this.flashColor = c; this.flashA = Math.max(this.flashA, a); },
  muzzle(x, y) {
    for (let i = 0; i < 4; i++) {
      this.particles.push({
        x, y,
        vx: Math.cos(this.player.angle) * U.rand(60, 180) + U.rand(-30, 30),
        vy: Math.sin(this.player.angle) * U.rand(60, 180) + U.rand(-30, 30),
        life: U.rand(0.06, 0.16), c: '#e8c88a', s: U.rand(1.5, 2.6)
      });
    }
  },
  impact(x, y, angle, blood, head) {
    const n = head ? 12 : (blood ? 7 : 4);
    for (let i = 0; i < n; i++) {
      const a = angle + Math.PI + U.rand(-0.9, 0.9);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * U.rand(30, head ? 170 : 120),
        vy: Math.sin(a) * U.rand(30, head ? 170 : 120),
        life: U.rand(0.15, head ? 0.55 : 0.4),
        c: head ? '#e8c98a' : (blood ? '#8d3a3a' : '#7a8a84'),
        s: U.rand(1, head ? 3 : 2.4)
      });
    }
  },

  /* ============================================================
     渲染
     ============================================================ */
  render() {
    // 全屏仓库/选图页不提交隐藏画布，避免每帧清屏触发合成和背景模糊。
    if (this.state === 'base' || this.state === 'map-select') return;
    const c = this.ctx;
    const W = CFG.VIEW_W, H = CFG.VIEW_H;
    /* 所有绘制仍然用 720×480 的逻辑坐标，这里按渲染倍率整体缩放 */
    const rs = this._rs || 1;
    c.setTransform(rs, 0, 0, rs, 0, 0);
    c.fillStyle = '#070b09';
    c.fillRect(0, 0, W, H);

    if (this.state === 'menu' && !this.player) return;

    // 摄像机偏移可能让坐标变成负的（震屏时），必须再夹一次
    const maxCX = Math.max(0, M.W * CFG.TILE - CFG.VIEW_W);
    const maxCY = Math.max(0, M.H * CFG.TILE - CFG.VIEW_H);
    const camX = Math.round(U.clamp(this.cam.x + this.shakeX, 0, maxCX));
    const camY = Math.round(U.clamp(this.cam.y + this.shakeY, 0, maxCY));

    this.renderTerrain(c, camX, camY);
    this.renderObjects(c, camX, camY);
    if (this.debug) this.renderOccupancy(c, camX, camY);
    this.renderEntities(c, camX, camY);
    this.renderRaisedWalls(c, camX, camY, true);
    this.renderCanopies(c, camX, camY);
    this.renderParticles(c, camX, camY);
    this.renderNoiseEdge(c);
    this.renderHUD(c);

    /* 准星：张开幅度 = 当前散布，位置带开火抖动，颜色随后坐力变暖 */
    if (this.state === 'playing' && !this.lootOpen && this.player && !this.player.dead) {
      const P = this.player;
      const R = CFG.RECOIL;
      const kx = this.input.mx + P.crossKick.x;
      const ky = this.input.my + P.crossKick.y;
      const hot = P.recoil;

      const cr = Math.round(200 + 55 * hot);
      const cg = Math.round(235 - 60 * hot);
      const cb = Math.round(222 - 80 * hot);
      const ca = 0.40 + 0.34 * hot;

      /* 只有十字线，没有圆环。
         线的内端从中心点算起：静止时贴着中心，散布一大四条线就整条往外推，
         同时线本身也拉长一点，所以张开时是"往外散"而不是原地变胖。 */
      const armIn = R.crossInner + P.spread * R.crossScale;
      const armLen = R.crossArm + P.spread * R.crossScale * 0.35 + R.crossArmGrow * hot;
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const strokeArms = (in0, out0) => {
        c.beginPath();
        for (const [dx, dy] of dirs) {
          c.moveTo(kx + dx * in0, ky + dy * in0);
          c.lineTo(kx + dx * out0, ky + dy * out0);
        }
        c.stroke();
      };

      /* 先描一圈黑边：场景是暗色，纯亮线的准星容易糊进背景里。
         描边两头各多出半个线宽，端点处不会露出缺口。 */
      c.lineWidth = 3.8;
      c.strokeStyle = 'rgba(0,0,0,0.55)';
      strokeArms(armIn - 0.9, armIn + armLen + 0.9);

      c.lineWidth = 1.8;
      c.strokeStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + Math.min(1, ca + 0.12) + ')';
      strokeArms(armIn, armIn + armLen);
      c.lineWidth = 1.4;

      // 中心点：后坐力越高越亮，顺便当"四条线的起点"
      const dotA = Math.min(1, ca + 0.18);
      c.fillStyle = 'rgba(0,0,0,0.55)';
      c.beginPath();
      c.arc(kx, ky, 2.5, 0, 6.29);
      c.fill();
      c.fillStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + dotA + ')';
      c.beginPath();
      c.arc(kx, ky, 1.3, 0, 6.29);
      c.fill();
    }

    // 受伤闪红
    if (this.flashA > 0.01) {
      c.globalAlpha = this.flashA;
      c.fillStyle = this.flashColor;
      c.fillRect(0, 0, W, H);
      c.globalAlpha = 1;
    }

    // 受击方向指示
    if (this.hitDirT > 0.01 || this._hitDirShown) {
      // 简化：用 flash 已经足够，这里不额外画
    }
  },

  renderTerrain(c, camX, camY) {
    const TS = CFG.TILE;
    const x0 = Math.floor(camX / TS), y0 = Math.floor(camY / TS);
    const x1 = Math.min(M.W - 1, Math.ceil((camX + CFG.VIEW_W) / TS));
    const y1 = Math.min(M.H - 1, Math.ceil((camY + CFG.VIEW_H) / TS));

    for (let y = Math.max(0, y0); y <= Math.min(y1, M.grid.length - 1); y++) {
      const row = M.grid[y];
      if (!row) continue;
      for (let x = Math.max(0, x0); x <= Math.min(x1, row.length - 1); x++) {
        const i = y * M.W + x;
        const t = row[x];
        const sx = x * TS - camX;
        const sy = y * TS - camY;

        // 未探索：统一纯色，不给任何结构信息
        if (!M.seen[i]) {
          c.fillStyle = '#0a1210';
          c.fillRect(sx, sy, TS, TS);
          continue;
        }

        let bright = M.visible[i] ? CFG.FOV.BRIGHT_NOW : CFG.FOV.BRIGHT_MEM;

        // 底色：墙明显比地板暗，让"能不能走"一眼分得清
        let col;
        if (t.ch === '#') col = '#162420';
        else if (t.ch === '~') col = '#24463f';
        else if (t.ch === ',') col = '#31493f';
        else col = '#445c52';

        // 被水淹：浅水偏青，深水更暗更冷
        const wd = M.waterDepth(x, y);
        if (wd > 1.05) {
          col = '#12252e';
        } else if (wd > 0.02) {
          col = wd > 0.6 ? '#17343a' : '#1a3a37';
        }

        const tImg = (t.art && Art.get('tiles',t.art)) || Art.tile(t.ch);
        if (tImg) {
          c.drawImage(tImg, sx, sy, TS, TS);
          // 水淹用一层水色覆盖，不破坏贴图
          if (wd > 0.02) {
            c.fillStyle = wd > 1.05 ? 'rgba(10,36,48,0.66)' : 'rgba(18,58,62,0.44)';
            c.fillRect(sx, sy, TS, TS);
          }
        } else {
          c.fillStyle = col;
          c.fillRect(sx, sy, TS, TS);

          // 墙：顶部亮线 + 底部暗边，做出"立起来"的感觉
          if (t.ch === '#' && bright > 0.25) {
            c.fillStyle = 'rgba(170,205,190,' + (0.20 * bright) + ')';
            c.fillRect(sx, sy, TS, 2.5);
            c.fillStyle = 'rgba(0,0,0,' + (0.32 * bright) + ')';
            c.fillRect(sx, sy + TS - 3, TS, 3);
          }

          // 地板纹理
          if (t.ch !== '#' && bright > 0.3) {
            const hsh = ((x * 73856093) ^ (y * 19349663)) & 7;
            if (hsh === 0) {
              c.fillStyle = 'rgba(0,0,0,0.10)';
              c.fillRect(sx + 6, sy + 9, TS - 12, 1);
            }
          }
        }

        // 连续墙网只在暴露边画立面；相邻墙之间不画独立方框。
        // 墙体在地面全部绘完后统一绘制，防止下一格地面擦掉加高部分。

        // 岸线、桥栏、玻璃和断墙端头随所在格一起进入视野/记忆层。
        for (const id of t.overlays) {
          const image=Art.get('props',id);
          if(image)c.drawImage(image,sx,sy,TS,TS);
        }

        // 暗化
        if (bright < 1) {
          c.fillStyle = 'rgba(4,8,7,' + (1 - bright) + ')';
          c.fillRect(sx, sy, TS, TS);
        }

        // 记忆层保留相同立面，只暗化；不逐格描框切碎连续墙顶。
      }
    }
    this.renderRaisedWalls(c,camX,camY);
  },

  renderRaisedWalls(c,camX,camY,overhang=false) {
    const size=CFG.TILE;
    for(let y=Math.max(0,Math.floor(camY/size));y<Math.min(M.H,Math.ceil((camY+CFG.VIEW_H)/size)+1);y++)
      for(let x=Math.max(0,Math.floor(camX/size));x<Math.min(M.W,Math.ceil((camX+CFG.VIEW_W)/size));x++){
        const t=M.at(x,y),i=M.idx(x,y);if(!Art.wallCell(t)||!M.seen[i])continue;
        const edges=Art.wallEdges(x,y),sx=x*size-camX,sy=y*size-camY;
        if(overhang&&(!edges.north||y===0||M.at(x,y-1).door||M.at(x,y-1).wallCap||M.at(x,y-1).terrainCh==='w'||!M.seen[M.idx(x,y-1)]))continue;
        const bright=Math.min(M.visible[i]?CFG.FOV.BRIGHT_NOW:CFG.FOV.BRIGHT_MEM,
          overhang?(M.visible[M.idx(x,y-1)]?CFG.FOV.BRIGHT_NOW:CFG.FOV.BRIGHT_MEM):1);
        c.save();c.beginPath();c.rect(sx,overhang?sy-size/2:sy,size,overhang?size/2:size);c.clip();
        // 加高区域已为实体，无需再按玩家位置淡化。
        Art.drawWallFaces(c,sx,sy,size,edges);
        if(bright<1){c.fillStyle='rgba(4,8,7,'+(1-bright)+')';c.fillRect(sx,sy-size/2,size,size*1.5);}
        c.restore();
      }
  },

  renderOccupancy(c, camX, camY) {
    const size = CFG.TILE;
    c.save();
    c.strokeStyle = 'rgba(245,170,80,0.8)'; c.lineWidth = 1;
    for (let y = 0; y < M.H; y++) for (let x = 0; x < M.W; x++) {
      if (!M.at(x, y).obstacle || !M.visible[M.idx(x, y)]) continue;
      c.strokeRect(x * size - camX + 0.5, y * size - camY + 0.5, size - 1, size - 1);
    }
    c.restore();
  },

  renderObjects(c, camX, camY) {
    const TS = CFG.TILE;

    // 摆设按实体/地贴配置占格；这里只负责绘制并遵循视野层亮度。
    for (const prop of (M.map ? M.map.props : DECOR)) {
      if(prop.canopy)continue;
      const tile = M.grid[prop.y] && M.grid[prop.y][prop.x];
      if (!tile || tile.ch === '#') continue;
      const cells=M.propCells(prop),seen=cells.some(([x,y])=>M.seen[y*M.W+x]);
      if (!seen) continue;
      const image = Art.prop(prop);
      if (!image) continue;
      c.save();
      c.globalAlpha = cells.some(([x,y])=>M.visible[y*M.W+x]) ? 0.9 : 0.3;
      if (M.waterDepth(prop.x, prop.y) > 1.05) c.globalAlpha *= 0.4;
      const rect=Art.propRect(prop,image,TS);
      c.drawImage(image,rect.sx,rect.sy,rect.sw,rect.sh,rect.x-camX,rect.y-camY,rect.w,rect.h);
      c.restore();
    }

    // 撤离点
    for (const ex of M.extracts) {
      const i = ex.y * M.W + ex.x;
      if (!M.seen[i]) continue;
      const sx = ex.x * TS - camX, sy = ex.y * TS - camY;
      const a = M.visible[i] ? 0.9 : 0.3;
      const pulse = 0.55 + 0.45 * Math.sin(this.time * 3);
      const exImg = Art.get('props', 'exit');
      if (exImg) {
        c.globalAlpha = a * (0.62 + pulse * 0.38);
        c.drawImage(exImg, sx, sy, TS, TS);
        c.globalAlpha = 1;
        continue;
      }
      c.strokeStyle = 'rgba(90,220,190,' + (a * (0.5 + pulse * 0.5)) + ')';
      c.lineWidth = 2;
      c.strokeRect(sx + 4, sy + 4, TS - 8, TS - 8);
      c.fillStyle = 'rgba(90,220,190,' + (a * 0.12) + ')';
      c.fillRect(sx + 4, sy + 4, TS - 8, TS - 8);
      if (M.visible[i]) {
        c.fillStyle = 'rgba(140,240,215,0.9)';
        c.font = '10px monospace';
        c.textAlign = 'center';
        c.fillText('EXIT', sx + TS / 2, sy + TS / 2 + 3);
      }
    }

    // 容器
    for (const b of this.boxes) {
      const i = b.ty * M.W + b.tx;
      if (!M.seen[i]) continue;
      const vis = M.visible[i];
      if (!vis && !b.searched) {
        // 记忆里的轮廓
        const sx = b.tx * TS - camX, sy = b.ty * TS - camY;
        c.strokeStyle = 'rgba(120,160,148,0.22)';
        c.lineWidth = 1;
        c.strokeRect(sx + 8, sy + 8, TS - 16, TS - 16);
        continue;
      }
      if (!vis) continue;

      const sx = b.tx * TS - camX, sy = b.ty * TS - camY;

      /* 遗落物品堆：不借用箱子贴图，画一小摊杂物，露出来的几件用品色标出来 */
      if (b.pile) {
        c.fillStyle = 'rgba(6,10,9,0.42)';
        c.beginPath();
        c.ellipse(sx + TS / 2, sy + TS - 6, 11, 5.5, 0, 0, 6.29);
        c.fill();
        c.fillStyle = '#4c463c';
        c.beginPath();
        c.moveTo(sx + 6, sy + TS - 6);
        c.quadraticCurveTo(sx + TS / 2, sy + 7, sx + TS - 6, sy + TS - 6);
        c.closePath();
        c.fill();
        c.strokeStyle = 'rgba(210,198,166,0.55)';
        c.lineWidth = 1;
        c.stroke();
        const bits = (b.items || []).filter(e => e && e.item).slice(0, 3);
        bits.forEach((e, k) => {
          const rc = RARITY[U.clamp(e.item.r - 1, 0, RARITY.length - 1)].color;
          c.fillStyle = rc;
          c.fillRect(sx + 10 + k * 5, sy + TS - 12 - k * 2, 3, 3);
        });
        continue;
      }

      const Q = CONTAINER_QUALITY[b.kind] || CONTAINER_QUALITY.plain;
      const cols = Q.color;
      const sz = 10 + Q.lv * 2;     // 品质越高，占格越满

      const bImg = Art.get('props', b.art || 'crate_' + b.kind);
      if (bImg) {
        c.globalAlpha = b.opened ? 0.5 : 1;
        c.drawImage(bImg, sx, sy, TS, TS);
        c.globalAlpha = 1;
        if (b.opened) {
          c.fillStyle = 'rgba(6,12,10,0.30)';
          c.fillRect(sx, sy, TS, TS);
        }
        continue;
      }

      c.fillStyle = b.opened ? '#1e2a26' : cols;
      c.fillRect(sx + (TS - sz) / 2, sy + (TS - sz) / 2, sz, sz);
      c.strokeStyle = b.opened ? 'rgba(90,120,110,0.3)' : 'rgba(240,235,200,0.8)';
      c.lineWidth = 1.6;
      c.strokeRect(sx + (TS - sz) / 2 + 0.5, sy + (TS - sz) / 2 + 0.5, sz - 1, sz - 1);

      // 贵重 / 秘藏容器加个记号
      if (!b.opened && Q.lv >= 5) {
        c.fillStyle = 'rgba(230,200,120,0.8)';
        c.fillRect(sx + TS / 2 - 1, sy + TS / 2 - 4, 2, 8);
      }
    }

    // 尸体
    for (const cp of this.corpses) {
      const tx = M.tx(cp.x), ty = M.ty(cp.y);
      const i = ty * M.W + tx;
      if (!M.visible[i]) continue;
      const sx = cp.x - camX, sy = cp.y - camY;
      // 只有人类会流血：机械留焦痕，回响体本身就是一片水渍
      if (cp.key === 'scav') {
        const blood = Art.get('props', 'blood');
        if (blood) {
          c.globalAlpha = 0.6;
          c.drawImage(blood, sx - TS / 2, sy - TS / 2, TS, TS);
          c.globalAlpha = 1;
        } else {
          c.fillStyle = 'rgba(96,34,38,0.5)';
          c.beginPath();
          c.ellipse(sx, sy + 2, 12, 8, 0.3, 0, 6.29);
          c.fill();
        }
      } else if (cp.key === 'guard') {
        c.fillStyle = 'rgba(16,18,16,0.42)';
        c.beginPath();
        c.ellipse(sx, sy + 2, 12, 9, 0.25, 0, 6.29);
        c.fill();
      }
      const cpImg = Art.corpse(cp.key);
      if (cpImg) {
        c.save();
        c.globalAlpha = cp.opened ? 0.45 : 0.9;
        c.translate(sx, sy);
        c.rotate(cp.rot || 0);
        c.drawImage(cpImg, -TS / 2, -TS / 2, TS, TS);
        c.restore();
        continue;
      }
      c.fillStyle = cp.opened ? 'rgba(60,70,66,0.5)' : 'rgba(110,70,80,0.75)';
      c.beginPath();
      c.ellipse(sx, sy, 9, 6, 0.5, 0, 6.29);
      c.fill();
    }

    // 门
    for (let y = 0; y < M.H; y++) {
      for (let x = 0; x < M.W; x++) {
        const t = M.grid[y][x];
        if (!t.door) continue;
        const i = y * M.W + x;
        if (!M.seen[i]) continue;
        const sx = x * TS - camX, sy = y * TS - camY;
        const bright = M.visible[i] ? 1 : 0.4;
        const safe = t.door.safe;

        const dImg = Art.door(t.door);
        if (dImg) {
          // 共用完整门框，每格单独裁切和暗化，避免另一半门泄漏到未探索区域。
          c.save();
          c.beginPath();c.rect(sx,sy,TS,TS);c.clip();
          c.globalAlpha = bright;
          const span=t.door.cells ? t.door.cells.length : 1;
          const dx=t.door.cells?t.door.x*TS-camX:sx,dy=t.door.cells?t.door.y*TS-camY:sy;
          c.drawImage(dImg, dx, dy, t.door.axis==='horizontal'?TS*span:TS, t.door.axis==='vertical'?TS*span:TS);
          c.restore();
          continue;
        }

        if (t.door.open) {
          c.fillStyle = safe ? 'rgba(70,180,140,' + (0.30 * bright) + ')'
            : 'rgba(150,140,110,' + (0.22 * bright) + ')';
          c.fillRect(sx + 3, sy + 3, TS - 6, TS - 6);
          c.strokeStyle = safe ? 'rgba(90,220,170,' + (0.55 * bright) + ')'
            : 'rgba(190,170,120,' + (0.45 * bright) + ')';
          c.lineWidth = 1.5;
          c.strokeRect(sx + 3.5, sy + 3.5, TS - 7, TS - 7);
        } else {
          c.fillStyle = safe ? '#2a5a48' : '#3a3a30';
          c.fillRect(sx + 2, sy + 2, TS - 4, TS - 4);
          c.strokeStyle = safe ? 'rgba(90,220,170,0.7)' : 'rgba(200,180,130,0.6)';
          c.lineWidth = 2;
          c.strokeRect(sx + 3, sy + 3, TS - 6, TS - 6);
        }
      }
    }
  },

  canopyAlpha(prop) {
    const player=this.player;if(!player)return 1;
    const x=player.x/CFG.TILE-prop.x,y=player.y/CFG.TILE-prop.y;
    return x>=0&&x<prop.footprint[0]&&y>=0&&y<prop.canopy.fadeRows?prop.canopy.opacity:1;
  },

  renderCanopies(c,camX,camY) {
    const TS=CFG.TILE;
    for(const prop of (M.map?M.map.props:DECOR)){
      if(!prop.canopy)continue;
      const cells=M.propCells(prop),seen=cells.filter(([x,y])=>M.seen[y*M.W+x]);
      if(!seen.length)continue;
      const image=Art.prop(prop);if(!image)continue;
      const rect=Art.propRect(prop,image,TS),visible=cells.some(([x,y])=>M.visible[y*M.W+x]);
      c.save();
      // 不把完整树冠画进未探索的格；树冠在角色之后绘制，透明时可看见树下场景。
      c.beginPath();for(const [x,y]of seen)c.rect(x*TS-camX,y*TS-camY,TS,TS);c.clip();
      c.globalAlpha=visible?this.canopyAlpha(prop):0.3;
      c.drawImage(image,rect.sx,rect.sy,rect.sw,rect.sh,rect.x-camX,rect.y-camY,rect.w,rect.h);
      c.restore();
    }
  },

  renderEntities(c, camX, camY) {
    const P = this.player;
    if (!P) return;

    // --- 敌人（只在可见时画） ---
    for (const e of this.enemies) {
      if (e.dead) continue;
      const tx = M.tx(e.x), ty = M.ty(e.y);
      const i = ty * M.W + tx;
      if (!M.visible[i]) continue;

      const sx = e.x - camX, sy = e.y - camY;

      // 视野扇形（调试）
      if (this.debug && e.t.sight > 0) {
        c.fillStyle = 'rgba(200,180,90,0.06)';
        c.beginPath();
        c.moveTo(sx, sy);
        c.arc(sx, sy, e.t.sight * CFG.TILE * e.senseMult(),
          e.angle - e.t.fov / 2, e.angle + e.t.fov / 2);
        c.closePath();
        c.fill();
      }

      // 身体：三向图，朝左时镜像
      const eImg = Art.drawChar(c, e.key, e.angle, sx, sy, e);
      if (eImg) {
        if (e.hurtFlash > 0) {
          c.globalAlpha = Math.min(0.55, e.hurtFlash * 4.5);
          c.fillStyle = '#ffffff';
          c.beginPath();
          c.arc(sx, sy, 12, 0, 6.29);
          c.fill();
          c.globalAlpha = 1;
        }
        // 三向图本身说明了朝向；只有退化成单张图时才补一段短线
        if (!eImg.exact) {
          c.strokeStyle = 'rgba(0,0,0,0.38)';
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(sx + Math.cos(e.angle) * 10, sy + Math.sin(e.angle) * 10);
          c.lineTo(sx + Math.cos(e.angle) * 17, sy + Math.sin(e.angle) * 17);
          c.stroke();
        }
      } else {
        c.fillStyle = e.hurtFlash > 0 ? '#ffffff' : e.t.color;
        c.beginPath();
        c.arc(sx, sy, e.r, 0, 6.29);
        c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.5)';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(sx, sy);
        c.lineTo(sx + Math.cos(e.angle) * 11, sy + Math.sin(e.angle) * 11);
        c.stroke();
      }

      // 血条
      if (e.hp < e.maxHp) {
        const w = 20;
        c.fillStyle = 'rgba(0,0,0,0.6)';
        c.fillRect(sx - w / 2, sy - 15, w, 3);
        c.fillStyle = '#c05a4a';
        c.fillRect(sx - w / 2, sy - 15, w * (e.hp / e.maxHp), 3);
      }

      // 状态标记
      if (this.debug) {
        c.fillStyle = '#9fb';
        c.font = '10px monospace';
        c.textAlign = 'center';
        c.fillText(e.state, sx, sy - 19);
      }

      // 警觉标记
      if (e.state === 'chase') {
        c.fillStyle = '#e0b040';
        c.font = 'bold 11px monospace';
        c.textAlign = 'center';
        c.fillText('!', sx, sy - 19);
      } else if (e.state === 'suspect') {
        c.fillStyle = '#c0c060';
        c.font = 'bold 11px monospace';
        c.textAlign = 'center';
        c.fillText('?', sx, sy - 19);
      }
    }

    // --- 子弹 ---
    for (const b of this.bullets) {
      const sx = b.x - camX, sy = b.y - camY;
      const tl = 9;
      c.strokeStyle = b.faction === 'player' ? '#ffe8b0' : '#ff9a7a';
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(sx, sy);
      c.lineTo(sx - Math.cos(b.angle) * tl, sy - Math.sin(b.angle) * tl);
      c.stroke();
    }

    // --- 玩家 ---
    const psx = P.x - camX, psy = P.y - camY;

    // 闪避残影
    if (P.dodgeT > 0) {
      c.fillStyle = 'rgba(140,220,200,0.25)';
      c.beginPath();
      c.arc(psx, psy, P.r + 4, 0, 6.29);
      c.fill();
    }

    const acol = P.dead ? '#6a5252' : 'rgba(127,208,186,0.92)';
    const pSp = Art.drawChar(c, 'player', P.angle, psx, psy, P, 1);
    if (pSp) {
      // 三向图自己表达了朝向，正常情况不再叠加箭头
      if (!pSp.exact) this.drawFacingArrow(c, psx, psy, P.angle, acol);
    } else {
      c.fillStyle = P.dead ? '#5a4444' : '#d8e8e2';
      c.beginPath();
      c.arc(psx, psy, P.r, 0, 6.29);
      c.fill();
      this.drawFacingArrow(c, psx, psy, P.angle, acol);
    }
  },

  /* 没有方向图时，用一个小三角在身外标朝向 */
  drawFacingArrow(c, sx, sy, ga, color) {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(sx + Math.cos(ga) * 23, sy + Math.sin(ga) * 23);
    c.lineTo(sx + Math.cos(ga + 0.42) * 15, sy + Math.sin(ga + 0.42) * 15);
    c.lineTo(sx + Math.cos(ga - 0.42) * 15, sy + Math.sin(ga - 0.42) * 15);
    c.closePath();
    c.fill();
  },

  renderParticles(c, camX, camY) {
    for (const p of this.particles) {
      c.globalAlpha = Math.min(1, p.life * 3);
      c.fillStyle = p.c;
      c.fillRect(p.x - camX - p.s / 2, p.y - camY - p.s / 2, p.s, p.s);
    }
    c.globalAlpha = 1;
  },

  /* 屏幕边缘的噪声提示：只给方向与粗细 */
  renderNoiseEdge(c) {
    const P = this.player;
    if (!P) return;
    const cx = CFG.VIEW_W / 2, cy = CFG.VIEW_H / 2;

    for (const v of Noise.visuals) {
      const ang = Math.atan2(v.y - P.y, v.x - P.x);
      const dx = Math.cos(ang), dy = Math.sin(ang);
      // 椭圆边界
      const t = Math.min(
        (cx - 18) / Math.max(0.0001, Math.abs(dx)),
        (cy - 18) / Math.max(0.0001, Math.abs(dy))
      );
      const px = cx + dx * t, py = cy + dy * t;
      const k = 1 - v.age / v.max;
      const thick = U.clamp(v.r / 260, 0.4, 1) * 12 * k;

      c.strokeStyle = 'rgba(180,220,210,' + (0.55 * k) + ')';
      c.lineWidth = Math.max(1.2, thick);
      c.beginPath();
      c.arc(cx, cy, t, ang - 0.11, ang + 0.11);
      c.stroke();
    }
  },

  /* HUD 上的一根护甲耐久条 */
  gearBar(c, x, y, w, label, gear) {
    c.font = '10px monospace';
    c.textAlign = 'left';

    if (!gear) {
      c.fillStyle = '#3d534c';
      c.fillText(label + '  —', x, y + 8);
      return;
    }
    const st = GEAR.state(gear);
    const ratio = gear.dur / gear.max;
    const col = st === 'broken' ? '#6b3a3a' : st === 'worn' ? '#b5883a' : '#3f8b78';

    c.fillStyle = '#6f8a82';
    c.fillText(label, x, y + 8);
    c.fillStyle = '#dbe5e1';
    c.fillText(Math.ceil(gear.dur) + '', x + 30, y + 8);

    const bx = x + 58, bw = w - 58 - 48;
    c.fillStyle = '#1b2b26';
    c.fillRect(bx, y, bw, 5);
    c.fillStyle = col;
    c.fillRect(bx, y, bw * U.clamp(ratio, 0, 1), 5);

    /* 右侧标防护等级：护甲挡多少取决于"来弹穿透 vs 这级甲"，不是固定百分比 */
    c.fillStyle = col;
    c.fillText('Lv' + gear.lv, bx + bw + 5, y + 8);
  },

  /* ---------------- HUD ---------------- */
  renderHUD(c) {
    const P = this.player;
    if (!P) return;
    const TS = CFG.TILE;

    /* --- 左上：血量 + 负重 --- */
    c.fillStyle = 'rgba(8,14,12,0.78)';
    c.fillRect(14, 14, 176, 58);

    c.fillStyle = 'rgba(30,45,40,0.9)';
    c.fillRect(24, 24, 156, 8);
    const hpR = P.hp / P.maxHp;
    c.fillStyle = hpR > 0.5 ? '#3f8b78' : hpR > 0.25 ? '#b5883a' : '#8d3a3a';
    c.fillRect(24, 24, 156 * hpR, 8);

    c.fillStyle = '#9fb5ae';
    c.font = '10px monospace';
    c.textAlign = 'left';
    c.fillText(Math.ceil(P.hp) + ' / ' + P.maxHp, 26, 46);

    const tier = P.tier;
    c.fillStyle = tier.i >= 2 ? '#c98a5e' : '#6f8a82';
    c.fillText(tier.name + '  ' + P.totalWeight.toFixed(1) + 'kg', 26, 62);

    /* --- 左上追加：头盔 / 护甲耐久 --- */
    const ay0 = 76;
    c.fillStyle = 'rgba(8,14,12,0.78)';
    c.fillRect(14, ay0, 176, 40);
    this.gearBar(c, 24, ay0 + 8, 156, '头盔', P.helmet);
    this.gearBar(c, 24, ay0 + 24, 156, '护甲', P.body);

    /* --- 左下：弹药 --- */
    c.fillStyle = 'rgba(8,14,12,0.78)';
    c.fillRect(14, CFG.VIEW_H - 74, 176, 60);

    c.fillStyle = '#dbe5e1';
    c.font = 'bold 22px monospace';
    c.fillText(P.mag + '', 26, CFG.VIEW_H - 44);
    c.fillStyle = '#6f8a82';
    c.font = '11px monospace';
    /* 备弹只显示当前这一档弹药的存量，别把别的口径算进来 */
    c.fillText('/ ' + P.bag.ammoCount(P.ammoId), 26 + c.measureText(P.mag + '').width + 26, CFG.VIEW_H - 44);

    // 当前武器：名字 + 槽位 + 口径/弹药等级
    c.textAlign = 'right';
    c.fillStyle = '#8fa8a0';
    c.fillText(P.weapon.short + ' ' + (P.slot + 1) + '/3', 178, CFG.VIEW_H - 52);
    const hA = P.ammoItem;
    if (hA) {
      c.fillStyle = '#5f7d74';
      c.font = '10px monospace';
      c.fillText(BALLISTICS.caliber(hA.caliber).short + ' Lv' + hA.level, 178, CFG.VIEW_H - 38);
    }
    c.textAlign = 'left';

    if (P.reloadT > 0) {
      c.fillStyle = '#c98a5e';
      c.fillText('换弹中', 26, CFG.VIEW_H - 26);
    } else if (P.mag === 0) {
      c.fillStyle = '#8d3a3a';
      c.fillText('按 R 装填', 26, CFG.VIEW_H - 26);
    }

    /* --- 右上：潮汐 --- */
    const TW = 190, TH = 66;
    const tx0 = CFG.VIEW_W - TW - 14;
    c.fillStyle = 'rgba(8,14,12,0.78)';
    c.fillRect(tx0, 14, TW, TH);

    const left = Math.max(0, CFG.TIDE.ROUND - this.time);
    const phaseName = M.tideEnabled ? ['退潮', '平潮', '涨潮', '已满'][this.tidePhase] : '临海路 · 稳定水位';
    c.fillStyle = this.tidePhase === 2 ? '#c98a5e' : '#9fb5ae';
    c.font = 'bold 17px monospace';
    c.textAlign = 'right';
    c.fillText(this.fmtTime(left), tx0 + TW - 14, 40);

    c.font = '11px monospace';
    c.fillStyle = '#6f8a82';
    c.fillText(phaseName, tx0 + TW - 14, 58);

    // 潮位条
    c.fillStyle = 'rgba(30,45,40,0.9)';
    c.fillRect(tx0 + 14, 66, TW - 28, 5);
    c.fillStyle = '#2f6d7a';
    c.fillRect(tx0 + 14, 66, (TW - 28) * U.clamp(M.tideLevel / 3, 0, 1), 5);

    /* --- 爆头提示 --- */
    if (this.headT > 0) {
      const a = U.clamp(this.headT / 0.45, 0, 1);
      c.globalAlpha = a;
      c.textAlign = 'center';
      c.font = 'bold 15px monospace';
      c.fillStyle = 'rgba(6,10,8,0.65)';
      c.fillText('被爆头', CFG.VIEW_W / 2 + 1, 117);
      c.fillStyle = '#e8a07a';
      c.fillText('被爆头', CFG.VIEW_W / 2, 116);
      c.textAlign = 'left';
      c.globalAlpha = 1;
    }

    /* --- 右下：背包 --- */
    c.textAlign = 'right';
    c.fillStyle = 'rgba(8,14,12,0.78)';
    c.fillRect(CFG.VIEW_W - 148, CFG.VIEW_H - 52, 134, 38);
    c.fillStyle = P.bag.slots.length >= CFG.BAG.SLOTS ? '#c98a5e' : '#9fb5ae';
    c.font = '11px monospace';
    c.fillText('背包 ' + P.bag.slots.length + ' / ' + CFG.BAG.SLOTS, CFG.VIEW_W - 26, CFG.VIEW_H - 33);
    c.fillStyle = '#4f665f';
    c.fillText('Tab 打开', CFG.VIEW_W - 26, CFG.VIEW_H - 18);

    /* --- 交互提示 --- */
    c.textAlign = 'center';
    const it = this.findInteractable();
    let prompt = '';
    if (this.action) {
      prompt = '';
    } else if (it) {
      if (it.type === 'extract') prompt = '[E] 撤离（6 秒，站定）';
      else if (it.type === 'box') {
        const b = it.obj;
        const q = CONTAINER_QUALITY[b.kind] || CONTAINER_QUALITY.plain;
        const nm = b.name || '容器';
        /* 掀开过的箱子不用再撬，提示也不该再报秒数 */
        prompt = b.searched
          ? '[E] ' + (b.pile ? '查看 ' : '继续翻 ') + nm
          : '[E] 打开 ' + nm + (q.time > 0 ? '（' + q.time.toFixed(1) + ' 秒' + (q.still ? '，站定' : '') + '）' : '');
      }
      else if (it.type === 'corpse') prompt = '[E] 搜尸体';
      else if (it.type === 'door') prompt = '[E] ' + (it.obj.t.door.open ? '关门' : '开门');
    }

    if (prompt) {
      c.fillStyle = 'rgba(8,14,12,0.8)';
      const w = c.measureText(prompt).width + 28;
      c.fillRect(CFG.VIEW_W / 2 - w / 2, CFG.VIEW_H - 118, w, 24);
      c.fillStyle = '#b9cac4';
      c.font = '12px monospace';
      c.fillText(prompt, CFG.VIEW_W / 2, CFG.VIEW_H - 102);
    }

    /* --- 读条 ---
       治疗不走这里：它的进度条在顶层 DOM（HealHud），
       否则一开背包就被面板盖住了。这里只剩搜刮 / 撤离这种画布内的读条。 */
    if (this.action && this.action.type !== 'heal') {
      const a = this.action;
      const bw = 200, bx = CFG.VIEW_W / 2 - bw / 2, by = CFG.VIEW_H / 2 + 54;
      const p = U.clamp(a.t / a.total, 0, 1);
      c.fillStyle = 'rgba(8,14,12,0.9)';
      c.fillRect(bx, by, bw, 8);
      c.fillStyle = a.type === 'extract' ? '#3fbf9b' : '#8a7d5a';
      c.fillRect(bx, by, bw * p, 8);
    }

    /* --- Toast --- */
    c.textAlign = 'center';
    c.font = '12px monospace';
    this.toasts.forEach((t, i) => {
      c.globalAlpha = U.clamp(t.t, 0, 1);
      c.fillStyle = '#9fb5ae';
      c.fillText(t.msg, CFG.VIEW_W / 2, 96 + i * 17);
    });
    c.globalAlpha = 1;

    /* --- 安静区提示 --- */
    const qf = Quiet.factor(P.x, P.y);
    if (qf > 0.02) {
      c.textAlign = 'center';
      c.fillStyle = 'rgba(90,200,160,' + (0.28 + 0.2 * qf) + ')';
      c.font = '10px monospace';
      c.fillText('· 这片区域暂时安静了 ·', CFG.VIEW_W / 2, CFG.VIEW_H - 140);
    }
  }
};

/* ---------------- 存档 ---------------- */
const Save = {
  key: 'tideline_save_v1',
  codex: {},
  stash: [],          // [{ id, n }]
  /* 藏身处的背包，跨局保留：弹药和药物回来时留在里面，其它东西自动回仓库。
     条目形态和仓库一致（{id,n,cap} / {id,n:1,gear}），这样仓库和背包能用同一套代码搬。 */
  bag: [],
  credits: START_CREDITS,
  hp: CFG.P.HP,
  // 配装：三个武器位 + 头盔 / 护甲
  // 武器位和护甲一样存"物品"（EQUIP.gun 伪物品，带余弹），不是光存一个 id：
  // 这样从尸体上捡的枪、军火商买的枪、身上那把，走的是同一套数据结构。
  gear: {
    weapons: [EQUIP.gun('rifle', 30), EQUIP.gun('shotgun', 6), EQUIP.gun('pistol', 12)],
    helmet: null,      // { type:'helmet', lv, dur }
    body: null         // { type:'body',   lv, dur }
  },
  runs: 0,
  codexCount() { return ITEMS.filter(item=>!item.noCodex&&itemGroup(item)==='collectible'&&this.codex[item.id]).length; },

  /* 武器位的老格式是 ['rifle','shotgun','pistol']（只有 id，余弹丢失）。
     统一转成 EQUIP.gun 伪物品；缺位补 null，副武器空着就发一把手枪。 */
  migrateWeapons(list) {
    const out = [null, null, null];
    if (Array.isArray(list)) {
      for (let i = 0; i < 3; i++) {
        const e = list[i];
        if (!e) continue;
        if (typeof e === 'string') {
          if (WEAPONS[e]) out[i] = EQUIP.gun(e, WEAPONS[e].mag);
        } else if (e.equip && e.equip.kind === 'gun' && WEAPONS[e.equip.gun]) {
          out[i] = EQUIP.gun(e.equip.gun, e.equip.mag | 0, e.equip.ammo);   // 重新包一遍，字段补齐（含装填弹种）
        }
      }
    }
    /* 副武器不能空 —— 空手进去就没得打了 */
    if (!out[SIDEARM_SLOT]) out[SIDEARM_SLOT] = EQUIP.gun('pistol', WEAPONS.pistol.mag);
    return out;
  },

  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) { this.bag = this.defaultBag(); return; }
      const d = JSON.parse(raw);
      this.codex = d.codex || {};
      this.stash = Array.isArray(d.stash) ? d.stash : [];
      this.runs = d.runs || 0;
      // 老存档没有这两个字段，补默认值
      this.credits = (typeof d.credits === 'number') ? d.credits : START_CREDITS;
      this.hp = Number.isFinite(d.hp) ? U.clamp(d.hp, 1, CFG.P.HP) : CFG.P.HP;
      /* 这一版把"携带数量"换成了真正的背包：老存档的 loadout 折算成包里的东西，
         数量一条不差（旧 ammo 字段归 5.56，绷带归 heal01），不会白丢。 */
      this.bag = Array.isArray(d.bag) ? d.bag : this.bagFromLoadout(d.loadout || null);

      // 配装：老存档没有就补默认，缺字段逐项兜底
      const g = d.gear || {};
      this.gear = {
        weapons: this.migrateWeapons(g.weapons),
        helmet: g.helmet ? GEAR.make('helmet', g.helmet.lv, g.helmet.dur) : null,
        body: g.body ? GEAR.make('body', g.body.lv, g.body.dur) : null
      };

      this.normalizeStash();
      this.normalizeBag();
    } catch (e) {
      if (!Array.isArray(this.bag) || !this.bag.length) this.bag = this.defaultBag();
    }
  },

  /* 第一次玩：三口径各一点、几卷绷带，进图就能打 */
  defaultBag() {
    return [
      { id: 'ammo_556_1', n: 30 },
      { id: 'ammo_9mm_1', n: 20 },
      { id: 'ammo_12g_1', n: 10 },
      { id: 'heal01', n: 3 }
    ];
  },

  /* 老存档的 loadout（携带数量）→ 背包条目 */
  bagFromLoadout(L) {
    if (!L) return this.defaultBag();
    const out = [];
    const push = (id, n) => {
      const item = ITEM_BY_ID[Medical.canonicalId(id)];
      n = Math.floor(Number(n) || 0);
      if (item && n > 0) out.push({ id: item.id, n });
    };
    push('ammo_556_1', L.ammo556 || L.ammo);
    push('ammo_9mm_1', L.ammo9mm);
    push('ammo_12g_1', L.ammo12g);
    push('heal01', L.bandage);
    for (const [id, n] of Object.entries(L.medical || {})) {
      if (Medical.canonicalId(id) !== 'heal01') push(id, n);
    }
    return out;
  },

  /* 存档写入要节流。localStorage 是同步 I/O，还得把整个仓库序列化一遍；
     挨打时护甲掉耐久就会调一次，被围攻时一秒好几次，攒久了就是明显卡顿。
     所以标记脏 + 400ms 合并写，真正落盘在 flush()。 */
  _dirty: false,
  _saveT: 0,

  save() {
    this._dirty = true;
    if (this._saveT) return;                       // 已经有一次待写
    this._saveT = (typeof setTimeout === 'function' ? setTimeout(() => this.flush(), 400) : 0) || 0;
    if (!this._saveT) this.flush();                // 没有定时器可用就立刻写（测试环境）
  },

  flush() {
    if (this._saveT) {
      if (typeof clearTimeout === 'function') clearTimeout(this._saveT);
      this._saveT = 0;
    }
    if (!this._dirty) return;
    this._dirty = false;
    try {
      localStorage.setItem(this.key, JSON.stringify({
        v: 3,
        codex: this.codex,
        stash: this.stash.slice(-300),
        bag: this.bag.slice(-60),
        credits: this.credits,
        hp: this.hp,
        gear: this.gear,
        runs: this.runs
      }));
    } catch (e) { /* localStorage 不可用就算了 */ }
  },

  /* 同一种物品合并成一条，顺便丢掉物品表里已经不存在的东西。
     装备（e.gear）不合并：同型号的耐久不一样，一件一条。 */
  /* 老存档里的通用弹药没有口径，统一并到 5.56 Lv1：
     数量原样搬过去，不多给也不吞掉。 */
  migrateAmmoId(id) {
    return id === 'ammo' ? 'ammo_556_1' : id;
  },

  /* 一份条目表 → 规范化条目表。仓库允许一个 id 一条（不分堆），
     背包要按堆叠上限切开（格子有限，进局时一条就占一格）。 */
  normalizeList(list, splitStacks) {
    const m = new Map();          // 满容量堆：id → 件数
    const partials = [];          // 用过的恢复品：一件一条，带 cap
    const gears = [];
    for (const e of list) {
      if (!e) continue;
      if (e.gear && e.gear.equip) {
        // 用当前模板重算价格与回收价，耐久、余弹仍来自旧快照。
        const spec = e.gear.equip;
        const current = spec.kind === 'armor' ? EQUIP.armor(spec.gear)
          : spec.kind === 'gun' ? EQUIP.gun(spec.gun, spec.mag, spec.ammo) : null;
        if (current) gears.push({ id: e.id, n: 1, gear: current });
        continue;
      }
      const id = this.migrateAmmoId(Medical.canonicalId(e.id));
      const item = ITEM_BY_ID[id];
      if (!item) continue;
      const n = Math.max(1, e.n || 1);
      const max = item.healCap || 0;
      if (!max) { m.set(id, (m.get(id) || 0) + n); continue; }
      /* 恢复品要保留"用了多少"：老存档没写 cap 就按满容量初始化，归零的直接丢掉 */
      const cap = typeof e.cap === 'number' ? U.clamp(e.cap, 0, max) : max;
      if (cap <= 0) continue;
      if (cap >= max - 1e-6) m.set(id, (m.get(id) || 0) + n);
      else {
        partials.push({ id, n: 1, cap });
        if (n > 1) m.set(id, (m.get(id) || 0) + (n - 1));
      }
    }
    let main = [...m].map(([id, n]) => ({ id, n }));
    if (splitStacks) {
      const cut = [];
      for (const e of main) {
        const item = ITEM_BY_ID[e.id];
        const stack = Math.max(1, (item && item.stack) || 1);
        let left = e.n;
        while (left > 0) { const put = Math.min(stack, left); cut.push({ id: e.id, n: put }); left -= put; }
      }
      main = cut;
    }
    return main.concat(partials, gears);
  },

  normalizeStash() { this.stash = this.normalizeList(this.stash, false); },
  normalizeBag() { this.bag = this.normalizeList(this.bag, true); },

  /* ---- 背包：数量、重量、整堆合并 ---- */
  bagCount(id) {
    id = Medical.canonicalId(id);
    return this.bag.reduce((sum, x) => x.id === id && !x.gear ? sum + x.n : sum, 0);
  },

  /* 往背包里塞（按堆叠上限切开）。恢复品的 cap 原样保留。 */
  addBag(id, n, cap) {
    id = Medical.canonicalId(id);
    const item = ITEM_BY_ID[id];
    if (!item) return false;
    const stack = Math.max(1, item.stack || 1);
    const max = item.healCap || 0;
    if (max && typeof cap === 'number' && cap < max - 1e-6) {
      this.bag.push({ id, n: 1, cap: U.clamp(cap, 0, max) });
      return true;
    }
    let left = Math.max(1, Math.floor(Number(n) || 1));
    for (const e of this.bag) {
      if (left <= 0) break;
      if (e.gear || e.id !== id) continue;
      if (max && e.cap != null && e.cap < max - 1e-6) continue;
      const put = Math.min(Math.max(0, stack - e.n), left);
      e.n += put; left -= put;
    }
    while (left > 0) {
      const put = Math.min(stack, left);
      this.bag.push(max ? { id, n: put, cap: max } : { id, n: put });
      left -= put;
    }
    return true;
  },

  addGearBag(item) {
    if (!item || !item.equip) return false;
    this.bag.push({ id: item.id, n: 1, gear: item });
    return true;
  },

  bagWeight() {
    return this.bag.reduce((w, e) => {
      const it = stashItem(e);
      return w + (it ? it.w * (e.n || 1) : 0);
    }, 0);
  },

  stashCount(id) {
    id = Medical.canonicalId(id);
    return this.stash.reduce((sum, x) => x.id === id && !x.gear ? sum + x.n : sum, 0);
  },

  /* 能带下场的只有满容量那几件：用过的恢复品留在仓库，不参与携带结算 */
  fullCount(id) {
    id = Medical.canonicalId(id);
    const item = ITEM_BY_ID[id];
    const max = item ? (item.healCap || 0) : 0;
    if (!max) return this.stashCount(id);
    return this.stash.reduce((sum, x) =>
      (x.id === id && !x.gear && (x.cap == null || x.cap >= max - 1e-6)) ? sum + x.n : sum, 0);
  },

  takeFull(id, n) {
    id = Medical.canonicalId(id);
    const item = ITEM_BY_ID[id];
    const max = item ? (item.healCap || 0) : 0;
    if (this.fullCount(id) < n) return false;
    let left = n;
    for (const e of this.stash.slice()) {
      if (left <= 0) break;
      if (e.id !== id || e.gear) continue;
      if (max && !(e.cap == null || e.cap >= max - 1e-6)) continue;
      const take = Math.min(e.n, left);
      e.n -= take; left -= take;
      if (e.n <= 0) this.stash = this.stash.filter(x => x !== e);
    }
    return left <= 0;
  },

  addStash(id, n, cap) {
    id = Medical.canonicalId(id);
    const item = ITEM_BY_ID[id];
    const max = (item && item.healCap) || 0;
    if (max) {
      /* 用过的那件单独入库，容量原样保留 */
      if (typeof cap === 'number' && cap < max - 1e-6) {
        this.stash.push({ id, n: 1, cap: U.clamp(cap, 0, max) });
        return;
      }
      /* 只往满容量那一堆里并，超过堆叠上限就另起一条 */
      const stack = Math.max(1, item.stack || 1);
      let left = n;
      const full = this.stash.find(e => e.id === id && !e.gear && (e.cap == null || e.cap >= max - 1e-6));
      if (full) {
        const take = Math.min(Math.max(0, stack - full.n), left);
        full.n += take; left -= take;
      }
      while (left > 0) {
        const put = Math.min(stack, left);
        this.stash.push({ id, n: put });
        left -= put;
      }
      return;
    }
    const e = this.stash.find(x => x.id === id && !x.gear);
    if (e) e.n += n;
    else this.stash.push({ id, n });
  },

  setHP(hp, immediate = true) {
    this.hp = U.clamp(Number.isFinite(hp) ? hp : CFG.P.HP, 1, CFG.P.HP);
    this.save(); if (immediate) this.flush();
  },

  /* 装备进仓库：独立一条，带耐久，卖价由伪物品的 sell 决定 */
  addGearStash(item) {
    if (!item || !item.equip) return;
    this.stash.push({ id: item.id, n: 1, gear: item });
  }
};

/* 仓库条目 → 能用的物品字段（普通物品查表，装备用自带快照） */
function stashItem(e) {
  if (!e) return null;
  if (e.gear) return e.gear;
  return ITEM_BY_ID[e.id] || null;
}

/* 卖价：装备用 sell（已经按剩余耐久折过、且不超过买价），普通物品用原价 */
function unitPrice(it) {
  if (!it) return 0;
  return (it.sell != null) ? it.sell : it.price;
}

/* ============================================================
   藏身处：仓库 / 出售 / 补给 / 出发
   ============================================================ */
const Base = {
  filter: 'all',
  tab: 'stash',     // 右侧页签：仓库 / 护甲商人
  picker: null,     // 正在挑装备的槽位（'helmet' / 'body'），null = 没开

  open() {
    this.picker = null;
    this._anchor = null;
    document.getElementById('startVeil').classList.add('hidden');
    document.getElementById('endVeil').classList.add('hidden');
    document.getElementById('baseVeil').classList.remove('hidden');
    document.getElementById('mapVeil').classList.add('hidden');
    Game.state = 'base';
    Save.normalizeStash();
    Save.normalizeBag();
    this.ensureSidearm();     // 副武器永远不能空着
    this.render();
  },

  close() {
    this.picker = null;
    this._anchor = null;
    document.getElementById('baseVeil').classList.add('hidden');
  },

  /* 藏身处内部的提示（不是 canvas 上那个 toast） */
  note(msg, bad) {
    const el = document.getElementById('deployHint');
    el.textContent = msg;
    el.classList.toggle('bad', !!bad);
    clearTimeout(this._noteT);
    this._noteT = setTimeout(() => {
      if (el.textContent === msg) { el.textContent = ''; el.classList.remove('bad'); }
    }, 2600);
  },

  render() {
    const totalCodex = ITEMS.filter(i => !i.noCodex).length;
    document.getElementById('bHealth').textContent = Math.round(Save.hp * 10) / 10 + ' / ' + CFG.P.HP;
    document.getElementById('bCredits').textContent = formatMoney(Save.credits);
    document.getElementById('bRuns').textContent = Save.runs;
    document.getElementById('bCodex').textContent =
      Save.codexCount() + ' / ' + totalCodex;

    this.renderGear();
    this.renderPicker();
    this.renderBag();
    this.renderTabs();
    this.renderFilter();
    this.renderStash();
  },

  /* ---- 装备槽的读写：'w0'/'w1'/'w2' 走武器位，'helmet'/'body' 走护甲 ---- */
  slotKind(key) { return (key && key[0] === 'w') ? 'gun' : 'armor'; },
  slotIdx(key) { return parseInt(String(key).slice(1), 10) || 0; },
  slotLabel(key) {
    if (key === 'helmet') return '头盔';
    if (key === 'body') return '护甲';
    return this.slotIdx(key) < 2 ? '主武器 ' + (this.slotIdx(key) + 1) : '副武器';
  },
  getEquip(key) {
    if (this.slotKind(key) === 'gun') return Save.gear.weapons[this.slotIdx(key)] || null;
    return Save.gear[key] || null;
  },
  setEquip(key, item) {
    if (this.slotKind(key) === 'gun') Save.gear.weapons[this.slotIdx(key)] = item || null;
    else Save.gear[key] = item || null;
  },

  /* ---- 装备：3 个武器位 + 头盔 / 护甲 / 背包 ---- */
  renderGear() {
    const el = document.getElementById('baseGear');
    if (!el) return;
    el.innerHTML = '';
    const G = Save.gear;

    for (let i = 0; i < 3; i++) {
      const key = 'w' + i;
      const it = G.weapons[i];                  // 伪物品（EQUIP.gun）
      const w = it ? WEAPONS[it.equip.gun] : null;
      const ammo = it ? (it.equip.mag | 0) : 0;
      const own = this.stashEquip(key).length;
      const act = this.picker === key
        ? '<b class="price">↓ 正在挑选</b>'
        : (own ? '点击从仓库挑选（' + own + ' 把）'
               : '点击挑选 · 仓库里没有' + (i === SIDEARM_SLOT ? '（副武器必带）' : ''));

      const row = document.createElement('div');
      row.className = 'slot' + (w ? '' : ' empty') + (this.picker === key ? ' open' : '');
      row.innerHTML =
        '<div class="slot-ico">' + Icons.gearIcon(w ? w.id : null, i < 2 ? '主' : '副') + '</div>' +
        '<div class="slot-txt"><b>' + (w ? w.name + (i === SIDEARM_SLOT ? '（必带）' : '') : '空') + '</b><span>' +
          (w ? w.dmgMin + '–' + w.dmgMax + ' 伤害 · 弹匣 ' + ammo + '/' + w.mag + ' · ' : '') +
          act +
        '</span></div>';
      row.onclick = () => this.togglePicker(key, row);
      el.appendChild(row);
    }

    for (const type of ['helmet', 'body']) {
      const g = G[type];
      const own = this.stashArmor(type).length;
      const act = this.picker === type
        ? '<b class="price">↓ 正在挑选</b>'
        : (own ? '点击从仓库挑选（' + own + ' 件）' : '点击挑选 · 仓库里没有');

      const row = document.createElement('div');
      row.className = 'slot' + (g ? '' : ' empty') + (this.picker === type ? ' open' : '');
      row.innerHTML =
        '<div class="slot-ico">' + Icons.gearIcon(g ? type + g.lv : null, GEAR[type].short) + '</div>' +
        '<div class="slot-txt"><b>' + (g ? g.name + ' Lv' + g.lv : '未装备' + GEAR[type].label) + '</b><span>' +
          (g ? '防护 Lv' + g.lv + ' · 耐久 ' +
               Math.ceil(g.dur) + '/' + g.max + ' · ' : '') +
          act +
        '</span></div>';
      row.onclick = () => this.togglePicker(type, row);
      el.appendChild(row);
    }

    /* 背包不再是一条"装备"，它有自己的格子区（见 renderBag） */
  },

  /* ---- 装备槽：点开一个列表，从仓库里挑一件 ----
     武器位和护甲位共用这一套：list 只列同类的东西，点一件就换上，旧的回仓库。 */

  /* 仓库里能放进这一位的装备 */
  stashEquip(key) {
    if (this.slotKind(key) === 'gun') {
      const want = this.slotIdx(key) < 2 ? 'primary' : 'secondary';
      return Save.stash.filter(e => {
        const it = stashItem(e);
        if (!it || !it.equip || it.equip.kind !== 'gun') return false;
        const def = WEAPONS[it.equip.gun];
        return def && def.slot === want;
      }).sort((a, b) => {
        const ia = WEAPONS[stashItem(a).equip.gun], ib = WEAPONS[stashItem(b).equip.gun];
        return (ib.price - ia.price) || (stashItem(b).equip.mag - stashItem(a).equip.mag);
      });
    }
    return Save.stash.filter(e => {
      const it = stashItem(e);
      return it && it.equip && it.equip.kind === 'armor' && it.equip.gear.type === key;
    }).sort((a, b) => stashItem(b).equip.gear.lv - stashItem(a).equip.gear.lv);
  },

  /* 老名字还留着，测试和别处都按这个找护甲 */
  stashArmor(type) { return this.stashEquip(type); },

  /* 这一位能不能空着：副武器不行，其它都行 */
  canUnequip(key) { return key !== 'w' + SIDEARM_SLOT; },

  /* 副武器不能空着 —— 没有手枪就发一把，保证永远能空手不进去 */
  ensureSidearm() {
    if (Save.gear.weapons[SIDEARM_SLOT]) return false;
    Save.gear.weapons[SIDEARM_SLOT] = EQUIP.gun('pistol', WEAPONS.pistol.mag);
    Save.save();
    return true;
  },

  /* 悬浮窗跟着被点的那个槽位走：先记下它的位置，renderGear 会把行重建掉 */
  togglePicker(type, row) {
    if (this.picker === type) { this.closePicker(); return; }   // 再点一次收起
    this._anchor = (row && row.getBoundingClientRect)
      ? row.getBoundingClientRect() : null;
    this.picker = type;
    this.bindPickerClose();
    this.renderGear();
    this.renderPicker();
  },

  closePicker() {
    this.picker = null;
    this._anchor = null;
    this.renderGear();
    this.renderPicker();
  },

  /* 点别处 / 滚动 / 改窗口大小就收起 —— 悬浮窗不该赖在屏幕上 */
  bindPickerClose() {
    if (this._pickerBound) return;
    this._pickerBound = true;
    const doc = document;
    if (doc && doc.addEventListener) {
      doc.addEventListener('click', ev => {
        if (!this.picker) return;
        const t = ev.target;
        if (t && t.closest) {
          if (t.closest('#gearPicker')) return;
          /* 点槽位时那一行会被 renderGear 重建掉，target 已经脱离文档 ——
             这种情况说明刚点的就是槽位本身，别关 */
          if (t.isConnected === false) return;
          if (t.closest('#baseGear')) return;
        }
        this.closePicker();
      });
      doc.addEventListener('scroll', () => { if (this.picker) this.closePicker(); }, true);
    }
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('resize', () => { if (this.picker) this.closePicker(); });
    }
  },

  /* 摆在槽位右侧，顶边和槽位对齐；右边放不下就翻到左边 */
  placePicker(box) {
    const r = this._anchor;
    if (!r) return;
    const vw = (typeof window !== 'undefined' && window.innerWidth) || 1280;
    const vh = (typeof window !== 'undefined' && window.innerHeight) || 800;
    const w = 268;
    const right = (r.right != null) ? r.right : (r.left || 0) + (r.width || 0);
    let left = right + 8;
    if (left + w > vw - 8) left = Math.max(8, (r.left || 0) - w - 8);
    const top = U.clamp(r.top || 0, 8, Math.max(8, vh - 140));

    box.style.left = left + 'px';
    box.style.top = top + 'px';
    box.style.width = w + 'px';
    box.style.maxHeight = Math.max(210, vh - top - 12) + 'px';
  },

  renderPicker() {
    const box = document.getElementById('gearPicker');
    if (!box) return;
    box.innerHTML = '';
    const key = this.picker;
    if (!key) { box.style.display = 'none'; return; }
    box.style.display = '';

    const isGun = this.slotKind(key) === 'gun';
    const cur = this.getEquip(key);
    const list = this.stashEquip(key);
    const unit = isGun ? '把' : '件';
    const label = this.slotLabel(key);

    const hd = document.createElement('div');
    hd.className = 'picker-hd';
    hd.innerHTML = '<span>选择' + label + '</span><span>仓库里有 ' + list.length + ' ' + unit + '</span>';
    box.appendChild(hd);

    /* 第一条是"不穿"，否则装上了就取不下来。
       副武器不给这一条 —— 空手进局没法打，必须一直带一把。 */
    if (cur && this.canUnequip(key)) {
      box.appendChild(this.pickerRow({
        fb: isGun ? '空' : GEAR[key].short,
        name: isGun ? '不装' : '不穿',
        sub: '把 ' + cur.name + ' 放回仓库',
        cls: 'off',
        click: () => this.unequip(key)
      }));
    }

    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'picker-empty';
      empty.innerHTML = cur
        ? '仓库里没有别的' + label + '了。'
        : (isGun
            ? '仓库里没有' + label + '。<br>顶部<b>军火商</b>那儿能买到全新的，尸体上也能捡。'
            : '仓库里没有' + label + '。<br>顶部<b>护甲商人</b>那儿能买到崭新的一~三级，' +
              '更高级的只能从尸体上带回来。');
      box.appendChild(empty);
    } else {
      for (const e of list) {
        const it = stashItem(e);
        if (isGun) {
          const def = WEAPONS[it.equip.gun];
          const ammo = it.equip.mag | 0;
          box.appendChild(this.pickerRow({
            icon: it.icon, fb: def.short,
            name: def.name,
            sub: BALLISTICS.caliber(def.caliber).short + ' · ' + def.dmgMin + '–' + def.dmgMax + ' 伤害 · 弹匣 ' + ammo + '/' + def.mag +
                 ' · ' + def.rpm + ' 发/分',
            click: () => this.equipFromStash(e, key)
          }));
        } else {
          const g = it.equip.gear;
          const st = GEAR.state(g);
          const stName = st === 'ok' ? '完好' : (st === 'worn' ? '破损' : '失效');
          box.appendChild(this.pickerRow({
            icon: it.icon, fb: it.short,
            name: g.name + ' Lv' + g.lv,
            sub: '防护 Lv' + g.lv + ' · 耐久 ' +
                 Math.ceil(g.dur) + '/' + g.max + ' · ' +
                 (st === 'ok' ? '完好' : '<span class="' + st + '">' + stName + '</span>'),
            click: () => this.equipFromStash(e, key)
          }));
        }
      }
    }

    const cancel = document.createElement('div');
    cancel.className = 'prow cancel';
    cancel.textContent = '取消';
    cancel.onclick = () => this.closePicker();
    box.appendChild(cancel);

    this.placePicker(box);
  },

  pickerRow(o) {
    const row = document.createElement('div');
    row.className = 'prow' + (o.cls ? ' ' + o.cls : '');
    const ico = (o.icon && Icons.gear[o.icon])
      ? '<img src="' + Icons.gear[o.icon].src + '" alt="">'
      : esc((o.fb || '·').charAt(0));
    row.innerHTML = '<span class="ic gl">' + ico + '</span>' +
      '<span class="nm">' + esc(o.name) + '<i>' + (o.sub || '') + '</i></span>';
    row.onclick = o.click;
    return row;
  },

  /* 装上仓库里那一件（枪或甲）；身上原有的落回仓库，不会消失。
     武器位存 EQUIP.gun 伪物品（带余弹），护甲位存护甲实例 —— 和之前一致。 */
  equipFromStash(entry, key) {
    const it = stashItem(entry);
    if (!it || !it.equip) return;
    const cur = this.getEquip(key);
    const isGun = this.slotKind(key) === 'gun';
    let next, name;

    if (isGun) {
      const def = WEAPONS[it.equip.gun];
      if (!def) return;
      const want = this.slotIdx(key) < 2 ? 'primary' : 'secondary';
      if (def.slot !== want) return;                      // 类型不对，别硬塞
      next = EQUIP.gun(it.equip.gun, it.equip.mag | 0);   // 余弹跟着枪走
      name = def.name;
    } else {
      const g = it.equip.gear;
      if (!g || it.equip.kind !== 'armor') return;
      next = GEAR.make(key, g.lv, g.dur);                 // 拷一份，仓库那件要移除
      name = g.name;
    }

    Save.stash = Save.stash.filter(x => x !== entry);
    if (cur) Save.addGearStash(isGun ? cur : EQUIP.armor(cur));
    this.setEquip(key, next);
    Save.save();

    this.closePicker();
    this.render();
    this.note((isGun ? '装上 ' : '穿上 ') + name + (cur ? '，' + cur.name + ' 放回仓库' : ''));
  },

  /* 卸下：放回仓库，不是销毁。副武器不能卸 */
  unequip(key) {
    if (!this.canUnequip(key)) {
      this.note('副武器必须带一把手枪 —— 空手进去没法打', true);
      this.closePicker();
      return;
    }
    const cur = this.getEquip(key);
    if (!cur) { this.closePicker(); return; }
    if (Save.stash.length >= STASH_SLOTS) {
      this.note('仓库满了，先卖点东西', true);
      return;
    }
    Save.addGearStash(this.slotKind(key) === 'gun' ? cur : EQUIP.armor(cur));
    this.setEquip(key, null);
    Save.save();
    this.closePicker();
    this.render();
    this.note('卸下' + cur.name + '，已放回仓库');
  },

  /* ---- 护甲商人：只卖崭新的一~三级 ---- */
  SHOP_MAX_LV: 3,

  renderTabs() {
    const el = document.getElementById('baseTabs');
    if (!el) return;
    const shop = ['shop','gun','doctor'].includes(this.tab);
    if (!el.dataset.built) {
      const opts = [['stash', '仓库'], ['shop', '护甲商人'], ['gun', '军火商'], ['doctor', '医生']];
      el.innerHTML = opts.map(([k, name]) =>
        '<button class="' + (k === (this.tab || 'stash') ? 'on' : '') +
        '" data-t="' + k + '">' + name + '</button>'
      ).join('');
      el.dataset.built = '1';
      el.querySelectorAll('button').forEach(b => {
        b.onclick = () => { this.tab = b.dataset.t; this.render(); };
      });
    } else {
      el.querySelectorAll('button').forEach(b => {
        b.classList.toggle('on', b.dataset.t === (this.tab || 'stash'));
      });
    }

    /* 商人页（护甲 / 军火）展开在左边那一块，右边的仓库始终可见 —— 买完能直接看见东西进库 */
    const pg = document.getElementById('paneGear');
    const ps = document.getElementById('paneShop');
    if (pg) pg.style.display = shop ? 'none' : '';
    if (ps) ps.style.display = shop ? '' : 'none';
    const tip = document.getElementById('navTip');
    if (tip) {
      tip.textContent = this.tab === 'doctor' ? '白绿蓝医疗品 · 库存用药与收费治疗'
        : this.tab === 'gun'
        ? '全新枪械 · 买下的东西直接进右边仓库'
        : (this.tab === 'shop'
            ? '只进崭新的一~三级 · 买下的东西直接进右边仓库'
            : '左边是配装与背包，右边是仓库');
    }
    if (shop) this.renderShop();
  },

  /* 商品也用格子摆，点一下弹交易框确认金额。
     护甲商人和军火商共用同一块面板，只是货架内容不同。 */
  renderShop() {
    const el = document.getElementById('shopGrid');
    if (!el) return;
    el.innerHTML = '';
    const wallet = document.getElementById('shopWallet');
    if (wallet) wallet.textContent = formatMoney(Save.credits);
    const clinic = document.getElementById('doctorService');
    if (clinic) clinic.hidden = this.tab !== 'doctor';

    if (this.tab === 'doctor') return this.renderDoctor(el);
    if (this.tab === 'gun') return this.renderGunShop(el);

    const note = document.getElementById('shopNote');
    if (note) {
      note.innerHTML = '只进<b>崭新</b>的一~三级货。更高级的东西他也弄不到，那得你自己下去找。';
    }
    const hint = document.getElementById('shopHint');
    if (hint) hint.textContent = '买下的东西直接进右边的仓库';

    for (const type of ['helmet', 'body']) {
      for (let lv = 1; lv <= this.SHOP_MAX_LV; lv++) {
        const d = GEAR.def(type, lv);
        if (!d) continue;
        const cell = document.createElement('div');
        cell.className = 'scell r' + gearRarity(lv);
        const ico = Icons.gear[type + lv]
          ? '<img src="' + Icons.gear[type + lv].src + '" alt="">'
          : '<span class="gl">' + esc(GEAR[type].short) + '</span>';
        cell.innerHTML = ico +
          '<span class="cn">' + esc(d.short || d.name) + '</span>' +
          '<span class="pr">' + formatMoney(d.price) + '</span>';
        cell.title = d.name + ' · 防护 Lv' + lv +
          ' · 耐久 ' + d.dur + ' · ' + d.w + 'kg · 右键看详情';
        cell.onclick = () => this.askBuy(type, lv, cell);
        cell.oncontextmenu = (ev) => {
          ev.preventDefault();
          Tips.show(EQUIP.armor(GEAR.make(type, lv)), cell.getBoundingClientRect(), '左键买下');
        };
        el.appendChild(cell);
      }
    }
  },

  /* 军火商的货架：两个主武器 + 一个副武器，全是崭新的满弹匣；再往下是弹药柜 */
  renderGunShop(el) {
    const note = document.getElementById('shopNote');
    if (note) {
      note.innerHTML = '全新枪械，<b>满弹匣</b>出手。弹药只进<b>一级、二级</b>——' +
        '三级以上得从人身上拿。';
    }
    const hint = document.getElementById('shopHint');
    if (hint) hint.textContent = '买下的东西直接进右边的仓库，回左边装进背包';

    for (const [group, label] of [['primary', '主武器'], ['secondary', '副武器']]) {
      const title = document.createElement('div');
      title.className = 'shop-cat';
      title.textContent = label;
      el.appendChild(title);

      for (const id of Object.keys(WEAPONS)) {
        const d = WEAPONS[id];
        if (d.slot !== group) continue;
        const item = EQUIP.gun(id, d.mag);          // 崭新：满弹匣
        const cell = document.createElement('div');
        cell.className = 'scell r' + item.r;
        const ico = Icons.gear[id]
          ? '<img src="' + Icons.gear[id].src + '" alt="">'
          : '<span class="gl">' + esc(d.short) + '</span>';
        cell.innerHTML = ico +
          '<span class="cn">' + esc(d.short) + '</span>' +
          '<span class="pr">' + formatMoney(d.price) + '</span>';
        cell.title = d.name + ' · ' + d.dmgMin + '–' + d.dmgMax + ' 伤害 · 弹匣 ' + d.mag +
          ' · ' + d.rpm + ' 发/分 · ' + d.w + 'kg · 右键看详情';
        cell.onclick = () => this.askBuyGun(id, cell);
        cell.oncontextmenu = (ev) => {
          ev.preventDefault();
          Tips.show(item, cell.getBoundingClientRect(), '左键买下');
        };
        el.appendChild(cell);
      }
    }

    this.renderAmmoShop(el);
  },

  /* 弹药柜：三种口径 × 一~二级，一盒 30 发。
     三级以上没有渠道 —— 那才是下海一趟的理由。 */
  SHOP_AMMO_MAX_LV: 2,
  SHOP_AMMO_PACK: 30,

  renderAmmoShop(el) {
    const pack = this.SHOP_AMMO_PACK;
    const title = document.createElement('div');
    title.className = 'shop-cat';
    title.textContent = '弹药（一盒 ' + pack + ' 发）';
    el.appendChild(title);

    for (const cal of Object.keys(CALIBERS)) {
      for (let lv = 1; lv <= this.SHOP_AMMO_MAX_LV; lv++) {
        const it = ammoItem(cal, lv);
        if (!it) continue;
        const cell = document.createElement('div');
        cell.className = 'scell r' + it.r;
        const ico = Icons.get(it.id)
          ? '<img src="' + Icons.get(it.id).src + '" alt="">'
          : '<span class="gl">Lv' + it.level + '</span>';
        cell.innerHTML = ico +
          '<span class="cn">' + esc(it.short) + ' ×' + pack + '</span>' +
          '<span class="pr">' + formatMoney(it.price * pack) + '</span>';
        cell.title = it.name + ' · 穿透 Lv' + it.penLevel + ' · 伤害系数 ×' + it.dmgMul.toFixed(2) +
          ' · 一盒 ' + pack + ' 发';
        cell.onclick = () => this.askBuyAmmo(it.id, pack, cell);
        cell.oncontextmenu = (ev) => {
          ev.preventDefault();
          Tips.show(it, cell.getBoundingClientRect(), '左键买一盒 ' + pack + ' 发');
        };
        el.appendChild(cell);
      }
    }
  },

  askBuyAmmo(id, pack, cell) {
    const it = ITEM_BY_ID[id];
    if (!it) return;
    Deal.show({
      kind: 'buy',
      title: '买入弹药',
      name: it.name + ' ×' + pack,
      id: it.id,
      short: it.short,
      sub: '穿透 Lv' + it.penLevel + ' · 一盒 ' + pack + ' 发',
      price: it.price * pack,
      can: Save.credits >= it.price * pack,
      onGo: () => this.buyAmmo(id, pack)
    }, cell.getBoundingClientRect());
  },

  buyAmmo(id, pack) {
    const it = ITEM_BY_ID[id];
    if (!it || it.cat !== 'ammo' || it.level > this.SHOP_AMMO_MAX_LV) return false;
    const price = it.price * pack;
    if (Save.credits < price) { this.note('信用点不够', true); return false; }
    Save.credits -= price;
    Save.addStash(id, pack);
    Save.save();
    Game.sfx('pickup');
    this.render();
    this.note('买下 ' + it.name + ' ×' + pack + '（-' + formatMoney(price) + '），已放入仓库');
    return true;
  },

  /* 买之前先把金额摆出来 */
  renderDoctor(el) {
    document.getElementById('shopNote').innerHTML = '出售<b>寻常、良品、上乘</b>医疗品。紫金恢复药需要探索获取；标有“效果待开放”的商品当前不可使用。';
    document.getElementById('shopHint').textContent = '购买后进入仓库；点击库存医疗品可使用或出售';
    const q = Medical.quote(), service = document.getElementById('doctorService');
    service.innerHTML = '<h3>治疗服务</h3><p>生命值 <b>' + Math.round(Save.hp * 10) / 10 + ' / 100 HP</b> · 补满 ' +
      Math.round(q.missing * 10) / 10 + ' HP</p><p>绷带等效成本 ' + formatMoney(q.medicine) + ' + 服务费 ' + formatMoney(q.service) +
      '</p><button id="btnDoctorTreat"' + (!q.missing || Save.credits < q.total ? ' disabled' : '') + '>' +
      (q.missing ? '立即治疗至满血 · ' + formatMoney(q.total) : '生命值已满') + '</button><p class="medical-muted">' +
      (q.missing && Save.credits < q.total ? '信用点不足。' : '') + '损伤清除服务待状态系统开放。</p>';
    document.getElementById('btnDoctorTreat').onclick = ev => {
      const quote = Medical.quote();
      Deal.show({ kind:'buy', title:'治疗服务', name:'立即恢复至满血',
        sub:'恢复 ' + Math.round(quote.missing * 10) / 10 + ' HP · 药费 ' + formatMoney(quote.medicine) + ' + 服务费 ' + formatMoney(quote.service),
        price:quote.total, can:quote.missing > 0 && Save.credits >= quote.total,
        onGo:() => this.treat(quote.total) }, ev.currentTarget.getBoundingClientRect());
    };
    for (const [group, label] of Object.entries(MEDICAL_GROUPS)) {
      const title = document.createElement('div'); title.className = 'shop-cat'; title.textContent = label; el.appendChild(title);
      for (const item of MEDICAL_ITEMS.filter(i => i.medicalGroup === group && i.r <= 3)) {
        const cell = document.createElement('div'); cell.className = 'scell r' + item.r; cell.dataset.medical = item.id;
        cell.innerHTML = Icons.bagTag(item, '') + '<span class="cn">' + esc(item.short || item.name) + '</span>' +
          '<span class="pr">' + formatMoney(item.price) + '</span>' + (!Medical.ready(item) ? '<span class="pending-mark">效果待开放</span>' : '');
        cell.title = item.name + ' · ' + Medical.summary(item) + ' · ' + formatMoney(item.price);
        cell.onclick = () => Deal.show({ kind:'buy', title:'买入医疗品', name:item.name, id:item.id,
          sub:Medical.summary(item), price:item.price,
          can:Save.credits >= item.price && (Save.stashCount(item.id) > 0 || Save.stash.length < STASH_SLOTS),
          onGo:() => this.buyMedical(item.id) }, cell.getBoundingClientRect());
        cell.oncontextmenu = ev => { ev.preventDefault(); Tips.show(item, cell.getBoundingClientRect(), '左键购买一件'); };
        el.appendChild(cell);
      }
    }
  },

  buyMedical(id) {
    const item = ITEM_BY_ID[id];
    if (Game.state !== 'base' || !Medical.is(item) || item.r > 3) return false;
    if (Save.credits < item.price) { this.note('信用点不足', true); return false; }
    if (!Save.stashCount(id) && Save.stash.length >= STASH_SLOTS) { this.note('仓库满了', true); return false; }
    Save.credits -= item.price; Save.addStash(id, 1); Save.save(); Save.flush();
    this.render(); this.note('买下' + item.name + '，已放入仓库'); return true;
  },

  treat(expectedPrice) {
    if (Game.state !== 'base') return false;
    const q = Medical.quote();
    if (!q.missing) return false;
    if (q.total !== expectedPrice) { this.note('伤势已变化，请重新确认诊费', true); return false; }
    if (Save.credits < q.total) { this.note('信用点不足', true); return false; }
    Save.credits -= q.total; Save.setHP(CFG.P.HP);
    this.render(); this.note('治疗完成，已恢复至满血（-' + formatMoney(q.total) + '）'); return true;
  },

  askBuy(type, lv, cell) {
    const d = GEAR.def(type, lv);
    if (!d) return;
    Deal.show({
      kind: 'buy',
      title: '买入',
      name: d.name,
      sub: '防护 Lv' + lv + ' · 耐久 ' + d.dur,
      icon: type + lv,
      short: d.short,
      price: d.price,
      can: Save.credits >= d.price && Save.stash.length < STASH_SLOTS,
      onGo: () => this.buyArmor(type, lv)
    }, cell.getBoundingClientRect());
  },

  askBuyGun(id, cell) {
    const d = WEAPONS[id];
    if (!d) return;
    Deal.show({
      kind: 'buy',
      title: '买入',
      name: d.name,
      sub: (d.slot === 'primary' ? '主武器' : '副武器') + ' · ' + d.dmgMin + '–' + d.dmgMax +
           ' 伤害 · 弹匣 ' + d.mag + ' · 满弹',
      icon: id,
      short: d.short,
      price: d.price,
      can: Save.credits >= d.price && Save.stash.length < STASH_SLOTS,
      onGo: () => this.buyGun(id)
    }, cell.getBoundingClientRect());
  },

  buyGun(id) {
    const d = WEAPONS[id];
    if (!d) return;
    if (Save.stash.length >= STASH_SLOTS) { this.note('仓库满了，先卖点东西', true); return; }
    if (Save.credits < d.price) {
      this.note('买 ' + d.name + ' 还差 ' + formatMoney(d.price - Save.credits), true);
      return;
    }
    Save.credits -= d.price;
    Save.addGearStash(EQUIP.gun(id, d.mag));      // 崭新：满弹匣
    Save.save();
    Game.sfx('pickup');
    this.render();
    this.note('买下 ' + d.name + '（-' + formatMoney(d.price) + '），在仓库里，回左边装上');
  },

  buyArmor(type, lv) {
    const d = GEAR.def(type, lv);
    if (!d) return;
    if (lv > this.SHOP_MAX_LV) return;                 // 商人进不到更高级的货
    if (Save.stash.length >= STASH_SLOTS) { this.note('仓库满了，先卖点东西', true); return; }
    if (Save.credits < d.price) {
      this.note('买 ' + d.name + ' 还差 ' + formatMoney(d.price - Save.credits), true);
      return;
    }
    Save.credits -= d.price;
    Save.addGearStash(EQUIP.armor(GEAR.make(type, lv)));   // 崭新：耐久是满的
    Save.save();
    Game.sfx('pickup');
    this.render();
    this.note('买下 ' + d.name + '（-' + formatMoney(d.price) + '），在仓库里，回左边换上');
  },

  /* ---- 背包：和局内背包同一套格子 UI ----
     这里不放"携带数量"了：想带什么就把什么放进背包，带多少就是包里的数量。
     弹药和药物回藏身处时留在包里（下一趟接着用），其它东西自动回仓库。 */
  renderBag() {
    const grid = document.getElementById('baseBagGrid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 0; i < CFG.BAG.SLOTS; i++) {
      const cell = document.createElement('div');
      const e = Save.bag[i];
      const it = e ? stashItem(e) : null;
      if (!it) {
        cell.className = 'cell empty';
        cell.textContent = '·';
        grid.appendChild(cell);
        continue;
      }
      const n = e.n || 1;
      cell.className = 'cell ' + RARITY[U.clamp((it.r || 1) - 1, 0, RARITY.length - 1)].cls +
        (it.equip ? ' eq' : '');
      cell.innerHTML = Icons.bagTag(it, 'ico-bag') +
        '<span class="cn">' + esc(it.short || it.name) + '</span>' +
        (n > 1 ? '<span class="qty">' + n + '</span>' : '') +
        ((it.healCap && Medical.isPartial(e))
          ? '<span class="cap">' + Math.ceil(Medical.entryCap(e)) + '</span>' : '');
      cell.title = it.name + ' · ' + (it.w * n).toFixed(2) + 'kg · 左键看详情';
      cell.onclick = () => this.showItem(e, 'bag', cell);
      cell.oncontextmenu = ev => { ev.preventDefault(); this.showItem(e, 'bag', cell); };
      grid.appendChild(cell);
    }

    const w = Save.bagWeight();
    const meta = document.getElementById('bagMeta');
    if (meta) meta.textContent = Save.bag.length + ' / ' + CFG.BAG.SLOTS + ' 格 · ' +
      w.toFixed(1) + ' / ' + CFG.BAG.CARRY + ' kg';
    const bar = document.getElementById('bagBar');
    if (bar && bar.querySelector) {
      bar.querySelector('i').style.width = Math.min(100, w / CFG.BAG.CARRY * 100) + '%';
    }
    Save.save();
  },

  /* 背包还能不能塞下：先算再动，算不过就不搬，绝不吞东西 */
  bagBlock(it, n) {
    if (!it) return '物品不存在';
    if (Save.bagWeight() + it.w * n > CFG.BAG.CARRY + 1e-6) return '太重了';
    const stack = Math.max(1, it.stack || 1);
    const perSlot = it.healCap ? 1 : stack;
    let room = 0;
    for (const e of Save.bag) {
      if (e.gear || e.id !== it.id) continue;
      if (it.healCap && e.cap != null && e.cap < it.healCap - 1e-6) continue;
      room += Math.max(0, stack - e.n);
    }
    const need = Math.max(0, n - room);
    if (need > (CFG.BAG.SLOTS - Save.bag.length) * perSlot) return '格子不够';
    return '';
  },

  /* 仓库 → 背包：整叠搬（装备和用过的恢复品一件一件搬） */
  toBag(e) {
    const it = stashItem(e);
    if (!it) return false;
    const n = (e.gear || it.healCap) ? 1 : Math.max(1, e.n || 1);
    const why = this.bagBlock(it, n);
    if (why) { this.note('放不进背包：' + why, true); return false; }
    if (e.gear) Save.addGearBag(it);
    else Save.addBag(it.id, n, e.cap);
    this.dropFrom(Save.stash, e, n);
    this.render();
    this.note('已放入背包：' + it.name + (n > 1 ? ' ×' + n : ''));
    return true;
  },

  /* 背包 → 仓库 */
  toStash(e) {
    const it = stashItem(e);
    if (!it) return false;
    const n = (e.gear || it.healCap) ? 1 : Math.max(1, e.n || 1);
    if (e.gear) Save.addGearStash(it);
    else Save.addStash(it.id, n, e.cap);
    this.dropFrom(Save.bag, e, n);
    this.render();
    this.note('已放回仓库：' + it.name + (n > 1 ? ' ×' + n : ''));
    return true;
  },

  dropFrom(list, e, n) {
    e.n -= Math.min(e.n || 1, n);
    if (e.n <= 0) {
      const i = list.indexOf(e);
      if (i >= 0) list.splice(i, 1);
    }
  },

  /* 仓库 / 背包里点开一件：详情 + 动作。
     仓库那侧多一个「放入背包」，背包那侧多一个「放回仓库」，两边同一个浮窗。 */
  showItem(e, where, node) {
    const it = stashItem(e);
    if (!it || !node || !node.getBoundingClientRect) return;
    const n = e.n || 1;
    const extra = [];
    if (it.healCap) extra.push(['当前容量', Math.ceil(Medical.entryCap(e)) + ' / ' + it.healCap]);
    Tips.show(it, node.getBoundingClientRect(),
      where === 'stash' ? '左键放入背包' : '左键放回仓库', extra);

    const acts = [];
    const canHeal = Medical.ready(it) && Save.hp < CFG.P.HP;
    if (Medical.ready(it)) {
      acts.push({
        label: Save.hp >= CFG.P.HP ? '生命值已满' : '使用一件',
        disabled: !canHeal,
        onClick: () => { if (canHeal) Medical.use(e, where === 'bag' ? 'basebag' : 'stash'); }
      });
    }
    if (where === 'stash') {
      acts.push({ label: '放入背包', onClick: () => this.toBag(e) });
      acts.push({ label: '卖出' + (n > 1 ? ' ×' + n : ''), onClick: () => this.askSell(e, n, node) });
    } else {
      acts.push({ label: '放回仓库', onClick: () => this.toStash(e) });
    }
    Tips.actions(acts);
  },

  /* ---- 仓库 ---- */
  renderFilter() {
    const el = document.getElementById('stashFilter');
    if (el.dataset.built) return;      // 只建一次，之后只切 class
    const opts = [
      ['all', '全部'], ['sell', '可出售'],
      ['sup', '物资'], ['col', '收集品']
    ];
    el.innerHTML = opts.map(([k, name]) =>
      '<button class="pill' + (k === this.filter ? ' on' : '') + '" data-f="' + k + '">' + name + '</button>'
    ).join('');
    el.dataset.built = '1';
    el.querySelectorAll('button').forEach(b => {
      b.onclick = () => {
        this.filter = b.dataset.f;
        el.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        this.renderStash();
      };
    });
  },

  /* 仓库格子按容器尺寸实时算：正方形、边长 46~78，列数铺满宽度，行数铺满高度。
     窗口一变就重算，所以什么分辨率下都是满屏的方格，不会一边空一大条。 */
  gridMetrics() {
    const grid = document.getElementById('stashGrid');
    const gap = 9;                 // 缝隙跟着格子一起放大，比例感不变
    const w = (grid && grid.clientWidth) || 900;
    const h = (grid && grid.clientHeight) || 560;

    /* 边长目标 93（原来 62，整体放大 1.5 倍），夹在 69~118 */
    const TARGET = 93, MIN = 69, MAX = 118;

    /* 格子必须是正方形，宽高又都有限，所以不能只按一边算：
       在目标行数附近逐个试，行数定了边长就定了，再看这一边长能摆几列，
       挑「宽高都用得最满」的那组。 */
    const r0 = Math.max(3, Math.round((h + gap) / (TARGET + gap)));
    let best = null;
    for (let rows = Math.max(3, r0 - 2); rows <= r0 + 2; rows++) {
      const cell = (h - gap * (rows - 1)) / rows;
      if (cell < MIN || cell > MAX) continue;
      const cols = Math.floor((w + gap) / (cell + gap));
      if (cols < 4) continue;
      const fill = (cols * cell + gap * (cols - 1)) / w +
                   (rows * cell + gap * (rows - 1)) / h;
      if (!best || fill > best.fill + 1e-6) best = { rows: rows, cols: cols, cell: cell, fill: fill };
    }

    if (!best) {                   // 容器异常小的时候兜底，别算不出格子
      const cols = Math.max(3, Math.floor((w + gap) / (MIN + gap)));
      return { cols: cols, rows: 3, cell: MIN };
    }
    return { cols: best.cols, rows: best.rows, cell: Math.floor(best.cell) };
  },

  page: 0,

  renderStash() {
    const grid = document.getElementById('stashGrid');
    if (!grid) return;

    const list = Save.stash.filter(e => {
      const it = stashItem(e);
      if (!it) return false;
      if (this.filter === 'sup') {
        return itemGroup(it)==='supply';
      }
      if (this.filter === 'col') return itemGroup(it)==='collectible';
      return true;
    }).sort((a, b) => {
      const ia = stashItem(a), ib = stashItem(b);
      return (ib.price || 0) - (ia.price || 0);
    });

    document.getElementById('stashCount').textContent =
      Save.stash.length + ' / ' + STASH_SLOTS + ' 格';
    const total = Save.stash.reduce((a, e) => {
      const it = stashItem(e);
      return a + (it ? unitPrice(it) * (e.n || 1) : 0);
    }, 0);
    document.getElementById('stashValue').textContent = formatMoney(total);

    /* 分页：一页就是当前屏幕能摆下的格数 */
    const m = this.gridMetrics();
    if (grid.style && grid.style.setProperty) {
      grid.style.setProperty('--cols', m.cols);
      grid.style.setProperty('--gap', '9px');
    }
    const per = m.cols * m.rows;
    this._per = per;
    const pages = Math.max(1, Math.ceil(list.length / per));
    this.page = U.clamp(this.page, 0, pages - 1);
    const slice = list.slice(this.page * per, this.page * per + per);

    grid.innerHTML = '';
    for (let i = 0; i < per; i++) {
      const cell = document.createElement('div');
      const e = slice[i];
      if (!e) {                       // 空位也画出来，网格始终填满可视区域
        cell.className = 'scell empty';
        grid.appendChild(cell);
        continue;
      }
      const it = stashItem(e);
      const n = e.n || 1;
      cell.className = 'scell r' + (it.r || 1) + (it.equip ? ' eq' : '');
      cell.innerHTML =
        Icons.bagTag(it, '') +
        '<span class="cn">' + esc(it.short || it.name) + '</span>' +
        (n > 1 ? '<span class="qty">' + n + '</span>' : '') +
        ((it.healCap && Medical.isPartial(e))
          ? '<span class="cap">' + Math.ceil(Medical.entryCap(e)) + '</span>' : '');
      cell.title = it.name + (it.healCap && Medical.isPartial(e)
          ? ' · 剩余容量 ' + Math.ceil(Medical.entryCap(e)) + ' / ' + it.healCap
          : ' · ' + it.w.toFixed(2) + 'kg') + ' · ' +
        formatMoney(unitPrice(it) * n) + ' · 左键看详情';
      cell.onclick = () => this.showItem(e, 'stash', cell);
      cell.oncontextmenu = (ev) => {
        ev.preventDefault();
        this.showItem(e, 'stash', cell);
      };
      grid.appendChild(cell);
    }

    this.renderPager(pages, list.length);
  },

  renderPager(pages, total) {
    const el = document.getElementById('stashPager');
    if (!el) return;
    if (pages <= 1) {
      el.innerHTML = '<span>共 ' + total + ' 种</span>';
      return;
    }
    el.innerHTML =
      '<button data-p="-1">上一页</button>' +
      '<span>' + (this.page + 1) + ' / ' + pages + '</span>' +
      '<button data-p="1">下一页</button>';
    el.querySelectorAll('button').forEach(b => {
      const d = parseInt(b.dataset.p, 10);
      b.disabled = (d < 0 && this.page === 0) || (d > 0 && this.page >= pages - 1);
      b.onclick = () => {
        this.page = U.clamp(this.page + d, 0, pages - 1);
        this.renderStash();
      };
    });
  },

  /* 卖出也要先确认：一格点下去就是一整堆，误点太亏 */
  askSell(e, n, cell) {
    const it = stashItem(e);
    if (!it) return;
    const gain = unitPrice(it) * n;
    Deal.show({
      kind: 'sell',
      title: '卖出',
      name: it.name + (n > 1 ? ' ×' + n : ''),
      sub: it.equip ? '装备按剩余耐久折价' : itemCategoryLabel(it),
      icon: it.icon,
      id: it.id,
      short: it.short,
      price: gain,
      onGo: () => this.sell(e, n)
    }, cell.getBoundingClientRect());
  },

  /* 按仓库条目卖。装备按剩余耐久折价，永远不超过买价 */
  sell(e, n) {
    const it = stashItem(e);
    if (!it || !e) return;
    const take = Math.min(e.n || 1, n);
    const gain = unitPrice(it) * take;
    if (e.gear) Save.stash = Save.stash.filter(x => x !== e);
    else {
      e.n -= take;
      if (e.n <= 0) Save.stash = Save.stash.filter(x => x !== e);
    }
    Save.credits += gain;
    Save.save();
    Game.sfx('pickup');
    this.render();
    this.note('卖出 ' + it.name + ' ×' + take + '，+' + gain + ' 信用点');
  },

  sellJunk() {
    let gain = 0, count = 0;
    const keep = [];
    for (const e of Save.stash) {
      const it = stashItem(e);
      if (it && itemGroup(it) === 'collectible' && it.r === 1) { gain += it.price * e.n; count += e.n; }
      else keep.push(e);
    }
    if (!count) { this.note('仓库里没有寻常收集品可卖'); return; }
    Save.stash = keep;
    Save.credits += gain;
    Save.save();
    this.render();
    this.note('清掉 ' + count + ' 件寻常物，+' + gain + ' 信用点');
  },

  /* ---- 出发：背包里装了什么就带什么，不再现场买补给 ---- */
  deploy(mapId) {
    const map = MAP_CATALOG.find(m => m.id === (mapId || RAID_MAP.id));
    if (!map) return;
    /* 空手不准下海：没有副武器就发一把，有主武器就照常带 */
    this.ensureSidearm();
    if (!Save.gear.weapons[SIDEARM_SLOT]) {
      this.note('副武器必须带一把手枪 —— 先去军火商买一把', true);
      return;
    }
    Save.normalizeBag();
    Save.save(); Save.flush();

    this.close();
    document.getElementById('mapVeil').classList.add('hidden');
    Game.startRun(null, map.id);
  }
};

/* 地图选择：浏览/返回不消耗补给，确认出发才结算。 */
const MapSelect = {
  selectedId: RAID_MAP.id,
  open() {
    if(Game.state!=='base')return;
    Base.close();Tips.hide();Deal.hide();
    document.getElementById('gearPicker').style.display='none';
    Game.state='map-select';
    document.getElementById('mapVeil').classList.remove('hidden');
    this.render();
    document.querySelector('#mapChoices [aria-pressed="true"]')?.focus({preventScroll:true});
  },
  back() {
    if(Game.state!=='map-select')return;
    Base.open();document.getElementById('btnDeploy').focus();
  },
  render() {
    const choices=document.getElementById('mapChoices');
    choices.innerHTML=MAP_CATALOG.map(map=>`<button type="button" class="map-choice" data-map="${map.id}" aria-pressed="${map.id===this.selectedId}"><span class="map-choice-head"><b>${esc(map.title)}</b><span class="map-choice-state">${map.id===this.selectedId?'已选择':'选择地图'}</span></span><canvas width="${map.width*4}" height="${map.height*4}" data-preview="${map.id}" role="img" aria-label="${esc(map.title)}地形示意"></canvas><span class="map-choice-tags">${map.width}×${map.height} 格 · ${map.districts.length} 栋建筑 · ${map.exits.length} 个撤离点</span><span class="map-choice-desc">${map.tideEnabled?'修理铺、旧集市与低洼船坞。水位逐渐上涨，留意退路。':'两岸旧街、中央运河与双桥。水位稳定，银行集中高价值物资。'}</span><span class="map-choice-detail">${map.containers.length} 个容器 · ${map.enemies.length} 个敌人 · 12 分钟</span></button>`).join('');
    choices.querySelectorAll('[data-map]').forEach(button=>button.onclick=()=>{
      this.selectedId=button.dataset.map;this.render();
      document.querySelector('#mapChoices [aria-pressed="true"]')?.focus({preventScroll:true});
    });
    for(const map of MAP_CATALOG){
      const canvas=choices.querySelector('[data-preview="'+map.id+'"]'),c=canvas.getContext('2d');
      const colors={wall:'#273b34',floor:'#8b9583',low:'#46584c',marsh:'#285960',canal_water:'#285960',street_stone:'#667c6b',courtyard_paving:'#a39a77',quay_top:'#91a18b',bridge_stone_deck:'#baac89',bridge_wood_deck:'#a98351'};
      for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++){c.fillStyle=colors[map.terrain[map.terrainRows[y][x]].art]||'#7d927d';c.fillRect(x*4,y*4,4,4);}
      c.fillStyle='#e8f4ee';c.fillRect(map.spawn.x*4-1,map.spawn.y*4-1,6,6);
      c.fillStyle='#52e8b3';for(const ex of map.exits)c.fillRect(ex.x*4-1,ex.y*4-1,6,6);
    }
    const map=MAP_CATALOG.find(m=>m.id===this.selectedId);
    document.getElementById('mapSelectedName').textContent=map.title;
    const bagN=Save.bag.length, bagW=Save.bagWeight();
    document.getElementById('mapSupplyCost').textContent='背包 ' + bagN + ' / ' + CFG.BAG.SLOTS +
      ' 格 · ' + bagW.toFixed(1) + ' / ' + CFG.BAG.CARRY + ' kg';
    document.getElementById('mapSelectionHint').textContent=
      '带什么由背包决定：子弹和药物回来还留在包里，其它东西自动入库。';
    document.getElementById('btnMapStart').disabled=false;
  },
  confirm() {
    if(Game.state!=='map-select')return;
    Base.deploy(this.selectedId);
  }
};

/* ---------------- 启动 ---------------- */
window.addEventListener('DOMContentLoaded', () => {
  try {
    Save.load();
    window.addEventListener('pagehide', () => Save.flush());
    // 首次打开面板可能早于贴图加载；加载结束后刷新当前可见的列表。
    // sprites 的键是 目录/文件名（items/life01、chars/player）。
    const sprites = window.__SPRITES__ || window.__ICONS__ || null;
    Promise.all([Icons.init(sprites), Art.init(sprites)]).then(() => {
      if (Game.bagOpen) Game.renderBag();
      if (Game.lootOpen) Game.renderLootList();
      if (Game.state === 'base') { Base.renderGear(); Base.renderStash(); }
    });
    Game.init();
    // 调试入口：index.html#base 打开藏身处；#base,demo 顺便灌一些测试物资
    if (location.hash.startsWith('#base')) {
      if (location.hash.indexOf('demo') >= 0) {
        const demo = ['antiq01','antiq03','antiq04','lux02','lux01','art01','elec02',
                      'ind01','heal01','heal01','spec01','odd01','life01','life03'];
        for (const id of demo) Save.addStash(id, 1);
        Save.addStash('ammo_556_1', 40);
        Save.credits = 860;
        Save.runs = 3;
      }
      document.getElementById('startVeil').classList.add('hidden');
      Base.open();
      return;
    }

    // 调试入口：打开 index.html#play 直接进图，跳过开始界面
    // 可指定格坐标：index.html#play,4,6
    if (location.hash.startsWith('#play')) {
      document.getElementById('startVeil').classList.add('hidden');
      Game.startRun(null);
      const parts = location.hash.slice(5).split(',').filter(s => s !== '');
      if (parts.length >= 2 && /^\d+$/.test(parts[0])) {
        const x = M.cx(parseInt(parts[0], 10)), y = M.cy(parseInt(parts[1], 10));
        if (canStand(x, y, Game.player.r)) {
          Game.player.x = x; Game.player.y = y;
        } else Game.toast('目标位置不可站立，保留出生位置');
        Game.updateCamera(true);
      }
      if (parts.indexOf('ui') >= 0) setTimeout(() => Game.toggleBag(), 200);
      if (parts.indexOf('recoil') >= 0) {
        // 调试：把后坐力固定住，方便看准星张开的样子
        Game.player.recoil = 0.9;
        Game.player.sinceShot = -999;
        Game.player.syncSpread();
      }
      if (parts.indexOf('loot') >= 0) setTimeout(() => {
        const b = Game.boxes[0];
        Game.player.x = b.x; Game.player.y = b.y + CFG.TILE / 2 + Game.player.r + 1;
        Game.openLoot(b);
      }, 200);
    }
  } catch (err) {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#8d2020;color:#fff;' +
      'padding:18px;font:13px monospace;z-index:9999;white-space:pre-wrap;line-height:1.6';
    d.textContent = '启动失败：' + err.message + '\n' +
      (err.stack || '').split('\n').slice(0, 4).join('\n');
    document.body.appendChild(d);
    console.error(err);
  }
});
