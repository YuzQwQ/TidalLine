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

const Icons = {
  map: {},          // id -> HTMLImageElement | null
  gear: {},         // 装备图标 id -> HTMLImageElement | null（rifle / helmet3 / body5 …）
  base: null,       // 内联的 dataURL 表（单文件版用）

  init(inlineMap) {
    this.base = inlineMap || null;
    this.map = {};
    this.gear = {};
    const jobs = ITEMS.map(it => new Promise(resolve => {
      const key = 'items/' + it.id;
      const hit = inlineMap && (inlineMap[key] || inlineMap[it.id]);
      const src = hit || ('assets/' + key + '.png');
      const img = new Image();
      img.onload = () => { this.map[it.id] = img; resolve(); };
      img.onerror = () => { this.map[it.id] = null; resolve(); };
      img.src = src;
    }));

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
    if (img) return '<img class="' + cls + '" src="' + img.src + '" alt="">';
    const it = ITEM_BY_ID[id];
    const c = it ? RARITY[it.r - 1].color : '#3a4a44';
    return '<span class="' + cls + ' ph" style="background:' + c +
      '1f;border-color:' + c + '4d"></span>';
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
        img.onload = () => { this.map[key] = img; resolve(); };
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

  // 方向沿墙体走向命名，不能旋转正面位图，否则立面和光源都会跟着转。
  door(door) {
    const base = door.safe ? 'sdoor' : 'door';
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

  /* 按字符取地形图 */
  tile(ch) {
    let id = 'floor';
    if (ch === '#') id = 'wall';
    else if (ch === '~') id = 'marsh';
    else if (ch === ',') id = 'low';
    return this.map['tiles/' + id] || null;
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
      case 'stone':
        noiseHit(0.10, 900, 0.13);
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
  enemies: [], bullets: [], throwables: [], corpses: [], boxes: [],
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

  input: {
    keys: {}, mx: 0, my: 0, wx: 0, wy: 0,
    aimAngle: 0, mouseDown: false,
    dodgePressed: false, interactPressed: false,
    throwPressed: false, reloadPressed: false, bagPressed: false
  },

  /* ---------------- 初始化 ---------------- */
  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    M.load(MAP_ROWS, DOOR_AXES);
    this.buildBoxes();
    this.bindInput();
    this.bindUI();
    this.resize();
    // 鼠标默认放在屏幕中心偏上，否则初始朝向会指向左上角
    this.input.mx = CFG.VIEW_W / 2;
    this.input.my = CFG.VIEW_H / 2 - 60;
    window.addEventListener('resize', () => this.resize());
    // 关页面前把还没落盘的存档补上（节流最多积压 400ms）
    window.addEventListener('pagehide', () => Save.flush());
    if (document.addEventListener) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') Save.flush();
      });
    }

    this.lastT = performance.now();
    requestAnimationFrame(t => this.loop(t));

    // 兜底：某些环境（后台标签页、部分本地文件场景）会把 rAF 停掉，
    // 这里用定时器检测，超过 500ms 没有心跳就自己驱动一帧。
    setInterval(() => {
      const now = performance.now();
      if (now - this.lastT > 500) {
        this.loop(now);
      }
    }, 300);
  },

  buildBoxes() {
    this.boxes = [];
    for (let y = 0; y < M.H; y++) {
      for (let x = 0; x < M.W; x++) {
        const t = M.at(x, y);
        const kind = BOX_KIND[t.ch];
        if (kind) {
          const type = CONTAINER_TYPES[t.ch];
          const box = {
            x: M.cx(x), y: M.cy(y),
            tx: x, ty: y,
            kind,
            art: type.art, name: type.name,
            items: Loot.fill(kind, type.cats),
            opened: false
          };
          t.box = box;
          this.boxes.push(box);
        }
      }
    }
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
    s = Math.max(0.5, Math.min(CFG.MAX_SCALE, s));

    const w = Math.round(CFG.VIEW_W * s);
    const h = Math.round(CFG.VIEW_H * s);

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
      hp.style.transform = 'scale(' + this._scale + ')';
    }
  },

  /* ---------------- 输入 ---------------- */
  bindInput() {
    const K = this.input;
    window.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if (['tab', ' ', 'w', 'a', 's', 'd'].includes(k)) e.preventDefault();
      if (K.keys[k]) return;   // 忽略自动重复
      K.keys[k] = true;

      if (this.state !== 'playing') return;

      if (k === 'e') K.interactPressed = true;
      if (k === 'q') K.throwPressed = true;
      if (k === 'r') K.reloadPressed = true;
      if (k === '1' || k === '2' || k === '3') {
        if (this.state === 'playing' && this.player && !this.player.dead) {
          this.player.switchWeapon(parseInt(k, 10) - 1);
        }
        return;
      }
      if (k === 'tab') { this.toggleBag(); }
      if (k === 'escape') {
        if (this.lootOpen) this.closeLoot();
        else if (this.bagOpen) this.toggleBag();
      }
      if (k === 'f1') { this.debug = !this.debug; e.preventDefault(); }
    });

    window.addEventListener('keyup', e => {
      K.keys[e.key.toLowerCase()] = false;
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

    // 失焦时松开所有键，避免卡住
    window.addEventListener('blur', () => {
      for (const k in K.keys) K.keys[k] = false;
      K.mouseDown = false;
    });
  },

  bindUI() {
    document.getElementById('btnStart').onclick = () => {
      SFX.init();
      Base.open();
    };
    document.getElementById('btnDeploy').onclick = () => Base.deploy();
    document.getElementById('btnSellJunk').onclick = () => Base.sellJunk();
  },

  /* ---------------- 开局 ---------------- */
  startRun(loadout) {
    this.state = 'playing';
    this.deathElapsed = 0;
    this._deathSoundPlayed = false;
    this.time = 0;
    this.tideLevel = 0;
    this.tidePhase = 0;
    this.enemies = [];
    this.bullets = [];
    this.throwables = [];
    this.corpses = [];
    this.particles = [];
    this.toasts = [];
    this.action = null;
    this.lootOpen = null;
    this.extractDone = false;
    this.stats = { kills: 0, found: 0, newItems: [] };

    // 重置地图状态
    M.load(MAP_ROWS, DOOR_AXES);
    for (let y = 0; y < M.H; y++) {
      for (let x = 0; x < M.W; x++) { M.seen[y * M.W + x] = 0; }
    }
    this.buildBoxes();

    // 玩家
    const sp = M.playerSpawn;
    this.player = new Player(M.cx(sp.x), M.cy(sp.y));
    const L = loadout || Save.loadout || { ammo: 60, bandage: 3, stone: 3 };
    const ammo = ITEMS.find(i => i.id === 'ammo');
    const band = ITEMS.find(i => i.id === 'med01');
    if (L.ammo > 0) this.player.bag.add(ammo, L.ammo);
    if (L.bandage > 0) this.player.bag.add(band, L.bandage);
    this.player.stones = L.stone || 0;

    // 武器与护甲：护甲拷一份实例出来，耐久变化写回 Save.gear
    this.player.fillWeapons(Save.gear.weapons);
    this.player.helmet = Save.gear.helmet ? Object.assign({}, Save.gear.helmet) : null;
    this.player.body = Save.gear.body ? Object.assign({}, Save.gear.body) : null;

    // 敌人
    for (const s of SPAWNS) {
      this.enemies.push(new Enemy(s.t, M.cx(s.x), M.cy(s.y), s.patrolRadius));
    }

    Noise.clear();
    Quiet.clear();
    M.tideLevel = 0;
    this.stats.found = 0;
    this.closeLoot();
    if (this.bagOpen) this.toggleBag();

    this.updateCamera(true);
    this.toast('进入围栏区');

    // 预热一帧：即使浏览器还没来得及跑 requestAnimationFrame，画面也不是黑的
    this.update(1 / 60);
    this.render();
  },

  /* ---------------- 主循环 ---------------- */
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
    requestAnimationFrame(t => this.loop(t));
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

    const P = this.player;
    const K = this.input;

    /* 世界坐标下的鼠标位置 */
    K.wx = K.mx + this.cam.x;
    K.wy = K.my + this.cam.y;
    K.aimAngle = Math.atan2(K.wy - P.y, K.wx - P.x);

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
    if (K.throwPressed) { P.throwStone(); K.throwPressed = false; }

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

    /* 投掷物 */
    for (let i = this.throwables.length - 1; i >= 0; i--) {
      const t = this.throwables[i];
      t.update(dt);
      if (t.dead) this.throwables.splice(i, 1);
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

    // 容器
    for (const b of this.boxes) {
      if (b.opened) continue;
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
      const cfg = CFG.SEARCH[it.obj.kind];
      this.action = {
        type: 'search', t: 0, total: Math.max(0.01, cfg.time),
        target: it.obj, kind: it.obj.kind
      };
      // 重型容器读条全程发声
      if (it.obj.kind === 'heavy') {
        Noise.emit(it.obj.x, it.obj.y, cfg.noise, 'search');
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
    const P = this.player;
    a.t += dt;

    // 移动会打断（撤离和重型容器要求站定）
    if (a.type === 'extract' || (a.type === 'search' && a.kind === 'heavy')) {
      const moving = Math.hypot(P.vx, P.vy) > 12;
      if (moving) {
        this.action = null;
        this.toast('被打断了');
        return;
      }
    }

    if (a.type === 'search') {
      // 标准容器：走开就断
      if (a.kind === 'std') {
        if (U.dist(P.x, P.y, a.target.x, a.target.y) > CFG.INTERACT_RANGE + 8) {
          this.action = null;
          return;
        }
      }
    }

    if (a.t >= a.total) {
      if (a.type === 'search') {
        a.target.opened = true;
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
      : (obj.name || { fast: '抽屉', std: '柜子', heavy: '保险箱' }[obj.kind]);

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
        (it.price > 0 ? '¥' + it.price : '—') + '</span>';

      row.onclick = () => {
        const cur = this.lootOpen && this.lootOpen.items[i];
        if (!cur) return;
        const res = this.player.bag.canAdd(it, cur.n);
        if (!res.ok) { this.toast(res.why); return; }
        this.player.bag.add(it, cur.n);
        if (!it.noCodex) this.registerCodex(it);
        this.lootOpen.items[i] = null;
        SFX.play('pickup');
        this.renderLootList();
        this.stepAutoSearch();      // 拿东西不打断自动搜索，拿完接着搜
        if (this.bagOpen) this.renderBag();
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
        own: !!(P && P.helmet)
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
        own: !!(P && P.body)
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
        own: !!(P && w && (w.slot === 'primary' ? (P.weapons[0] && P.weapons[1]) : P.weapons[2]))
      });
    }

    /* 身上已经有同类装备时，这一格点下去是"放进背包"，用角标提示 */
    bar.innerHTML = cells.map(c =>
      '<div class="eqs' + (c.icon ? '' : ' empty') + '" title="' +
        esc(c.label) + (c.icon ? (c.own ? ' · 已有同类，点击放进背包' : ' · 点击穿上') : '') + '">' +
        (c.icon && c.own ? '<span class="carry">包</span>' : '') +
        '<span class="lbl">' + esc(c.label) + '</span>' +
        '<span class="ic">' + Icons.gearIcon(c.icon, c.fb) + '</span>' +
        (c.tag ? '<span class="tag ' + (c.tagCls || '') + '">' + esc(c.tag) + '</span>' : '') +
      '</div>').join('');

    // 每格绑定点：左键拾取（无对应装备就穿，有就放包）
    const nodes = bar.children || [];
    for (let n = 0; n < nodes.length; n++) {
      const c = cells[n];
      const node = nodes[n];
      if (!c || c.idx < 0) { node.classList.add('empty'); continue; }
      node.onclick = () => this.takeGear(this.lootOpen.items[c.idx], c.idx);
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
      if (cur) old = EQUIP.gun(cur.id, cur.magCur);
      P.weapons[at] = Object.assign({}, def, { magCur: eq.mag || 0 });
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
        tag: w ? (i === P.slot ? P.mag + '/' + w.mag : w.mag) : '',
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
        tag: g ? Math.round(GEAR.reduction(g) * 100) + '%' : '',
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
        const label = it.short || it.name;
        cell.innerHTML = ico + '<span class="cn">' + esc(label) + '</span>' + qty;
        cell.title = it.name + ' · ' + it.w + 'kg' +
          (it.equip ? ' · 左键穿上 · 右键移入安全箱' : ' · 点击移入安全箱');
        cell.onclick = () => {
          if (it.equip) this.equipFromBag(i);
          else this.moveToSafe(i);
        };
        /* 装备左键是穿上，所以另外给一个"放进安全箱"的入口 */
        if (it.equip) {
          cell.oncontextmenu = (ev) => { ev.preventDefault(); this.moveToSafe(i); };
        }
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
          (s.n > 1 ? '<span class="qty">' + s.n + '</span>' : '');
        cell.title = s.item.name + ' · ' + s.item.w + 'kg · 点击移回背包';
        cell.onclick = () => {
          if (P.bag.slots.length >= CFG.BAG.SLOTS) { this.toast('背包满了'); return; }
          P.bag.slots.push(P.bag.safe.splice(i, 1)[0]);
          this.renderBag();
        };
      } else {
        cell.className = 'cell empty safe';
        cell.textContent = '·';
      }
      sg.appendChild(cell);
    }

    const w = P.bag.weight(), t = P.bag.tier();
    document.getElementById('bagWeight').textContent = w.toFixed(1) + ' / ' + CFG.BAG.CARRY + ' kg · ' + t.name;
    document.getElementById('bagValue').textContent = '¥' + P.bag.value();
    const bar = document.getElementById('bagBar');
    bar.querySelector('i').style.width = Math.min(100, w / CFG.BAG.CARRY * 100) + '%';
    bar.classList.toggle('warn', t.i >= 2);

  },

  moveToSafe(i) {
    const P = this.player;
    if (P.bag.safe.length >= CFG.BAG.SAFE) { this.toast('安全箱满了'); return; }
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
    this.deathElapsed = 0;
    this._deathSoundPlayed = true;
    this.action = null;
    this.closeLoot();
    if (this.bagOpen) this.toggleBag();
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
    this.closeLoot();
    if (this.bagOpen) this.toggleBag();
    if (success || !this._deathSoundPlayed) SFX.play(success ? 'extract' : 'death');

    const P = this.player;
    const carried = P.bag.slots.slice();
    const safe = P.bag.safe.slice();
    const kept = success ? carried.concat(safe) : safe;

    // 写入仓库与图鉴。装备不合并，一件一条，带着自己的耐久
    const lines = [];
    for (const s of kept) {
      const it = s.item;
      if (it.equip) {
        Save.addGearStash(it);
        lines.push({ name: it.name, price: it.sell, gear: true });
        continue;
      }
      Save.addStash(it.id, s.n);
      if (!it.noCodex && !Save.codex[it.id]) {
        Save.codex[it.id] = { first: Date.now(), count: 1 };
      }
      lines.push({ name: it.name + (s.n > 1 ? ' ×' + s.n : ''), price: it.price * s.n });
    }

    Save.runs = (Save.runs || 0) + 1;
    Save.flush();          // 一局结束，立刻落盘，不等节流

    const total = lines.reduce((a, b) => a + b.price, 0);
    const newOnes = this.stats.newItems;

    let html = '';
    html += '<div class="kicker">' + (success ? 'EXTRACTED' : 'LOST IN THE TIDE') + '</div>';
    html += '<h1 style="font-size:26px">' + (success ? '撤离成功' : '没能出来') + '</h1>';
    html += '<div class="sub">' +
      (success ? '用时 ' + this.fmtTime(this.time) + ' · 潮汐第 ' + (this.tidePhase + 1) + ' 阶段'
        : (reason || '你倒在了围栏区里')) + '</div>';

    html += '<h2>这一趟</h2>';
    html += '<div class="settle-row"><span>击杀</span><b>' + this.stats.kills + '</b></div>';
    html += '<div class="settle-row"><span>开过的容器</span><b>' + this.stats.found + '</b></div>';
    html += '<div class="settle-row"><span>带出物品</span><b>' + kept.length + ' 件 / ¥' + total + '</b></div>';
    html += '<div class="settle-row"><span>新收录</span><b>' + newOnes.length + '</b></div>';
    const gearCount = kept.filter(s => s.item.equip).length;
    if (gearCount) {
      html += '<div class="settle-row"><span>带出装备</span><b>' + gearCount + ' 件 · 已进仓库</b></div>';
    }
    html += '<div class="settle-row"><span>信用点余额</span><b>¥' + Save.credits + '</b></div>';

    if (!success && carried.length) {
      html += '<h2>丢在里面的东西</h2>';
      for (const s of carried) {
        html += '<div class="settle-row"><span>' + s.item.name + '</span><b class="dim">¥' +
          (s.item.price * s.n) + '</b></div>';
      }
      html += '<div class="tip">安全箱里的 ' + safe.length + ' 件保住了。这就是它存在的理由。</div>';
    }

    if (kept.length) {
      html += '<h2>' + (success ? '带回' : '保住的') + '</h2>';
      for (const l of lines) {
        const isNew = newOnes.some(x => x.name === l.name.replace(/ ×\d+$/, ''));
        html += '<div class="settle-row"><span>' + l.name +
          (isNew ? '<span class="newtag">NEW</span>' : '') +
          '</span><b>¥' + l.price + '</b></div>';
      }
    }

    const known = Object.keys(Save.codex).length;
    const totalItems = ITEMS.filter(i => !i.noCodex).length;
    html += '<h2>图鉴</h2>';
    html += '<div class="settle-row"><span>已收录</span><b>' + known + ' / ' + totalItems + '</b></div>';
    html += '<div class="bar" style="margin-top:8px"><i style="width:' +
      (known / totalItems * 100) + '%"></i></div>';

    html += '<div class="tip" style="margin-top:18px">这些东西已经进仓库了。回藏身处可以卖掉换信用点，再补给下一趟。</div>';
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
  /* 护甲耐久变化后写回存档，死了也不回滚——装备是消耗品 */
  syncGear() {
    const P = this.player;
    if (!P) return;
    Save.gear.weapons = P.weapons.map(w => (w ? w.id : null));
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
    const c = this.ctx;
    const W = CFG.VIEW_W, H = CFG.VIEW_H;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#070b09';
    c.fillRect(0, 0, W, H);

    if (this.state === 'base') return;      // 藏身处是全屏面板，底下不用画
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

        const tImg = Art.tile(t.ch);
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

        // 只在墙体暴露的边缘补短立面，顶面纹理保持连续，避免每格都像独立方块。
        if (t.ch === '#') {
          const south = M.at(x, y + 1), east = M.at(x + 1, y);
          if (south && !south.solid) {
            c.fillStyle = '#1c2a26';
            c.fillRect(sx, sy + TS - 5, TS, 5);
            c.fillStyle = '#6a786d';
            c.fillRect(sx, sy + TS - 6, TS, 1);
          }
          if (east && !east.solid) {
            c.fillStyle = '#17231f';
            c.fillRect(sx + TS - 2, sy, 2, TS);
          }
        }

        // 暗化
        if (bright < 1) {
          c.fillStyle = 'rgba(4,8,7,' + (1 - bright) + ')';
          c.fillRect(sx, sy, TS, TS);
        }

        // 记忆层描边（让结构清晰）
        if (!M.visible[i] && M.seen[i] && t.ch === '#') {
          c.strokeStyle = 'rgba(90,130,120,0.16)';
          c.lineWidth = 1;
          c.strokeRect(sx + 0.5, sy + 0.5, TS - 1, TS - 1);
        }
      }
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
    for (const prop of DECOR) {
      const tile = M.grid[prop.y] && M.grid[prop.y][prop.x];
      if (!tile || tile.ch === '#') continue;
      const i = prop.y * M.W + prop.x;
      if (!M.seen[i]) continue;
      const image = Art.get('props', prop.id);
      if (!image) continue;
      c.save();
      c.globalAlpha = M.visible[i] ? 0.9 : 0.3;
      if (M.waterDepth(prop.x, prop.y) > 1.05) c.globalAlpha *= 0.4;
      c.translate((prop.x + 0.5) * TS - camX, (prop.y + 0.5) * TS - camY);
      c.rotate(prop.angle || 0);
      const size = prop.id === 'chair' ? TS * 0.8 : TS;
      c.drawImage(image, -size / 2, -size / 2, size, size);
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
        c.font = '9px monospace';
        c.textAlign = 'center';
        c.fillText('EXIT', sx + TS / 2, sy + TS / 2 + 3);
      }
    }

    // 容器
    for (const b of this.boxes) {
      const i = b.ty * M.W + b.tx;
      if (!M.seen[i]) continue;
      const vis = M.visible[i];
      if (!vis && !b.opened) {
        // 记忆里的轮廓
        const sx = b.tx * TS - camX, sy = b.ty * TS - camY;
        c.strokeStyle = 'rgba(120,160,148,0.22)';
        c.lineWidth = 1;
        c.strokeRect(sx + 8, sy + 8, TS - 16, TS - 16);
        continue;
      }
      if (!vis) continue;

      const sx = b.tx * TS - camX, sy = b.ty * TS - camY;
      const cols = { fast: '#8fa374', std: '#b09a62', heavy: '#d8b055' };
      const sz = { fast: 12, std: 16, heavy: 20 }[b.kind];

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

      c.fillStyle = b.opened ? '#1e2a26' : cols[b.kind];
      c.fillRect(sx + (TS - sz) / 2, sy + (TS - sz) / 2, sz, sz);
      c.strokeStyle = b.opened ? 'rgba(90,120,110,0.3)' : 'rgba(240,235,200,0.8)';
      c.lineWidth = 1.6;
      c.strokeRect(sx + (TS - sz) / 2 + 0.5, sy + (TS - sz) / 2 + 0.5, sz - 1, sz - 1);

      // 未开过的重容器加个记号
      if (!b.opened && b.kind === 'heavy') {
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
          c.globalAlpha = bright;
          c.drawImage(dImg, sx, sy, TS, TS);
          c.globalAlpha = 1;
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
        c.font = '8px monospace';
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

    // --- 投掷物 ---
    for (const t of this.throwables) {
      const sx = t.x - camX, sy = t.y - camY;
      c.fillStyle = '#cbbf9a';
      c.beginPath();
      c.arc(sx, sy, 2.6, 0, 6.29);
      c.fill();
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
      c.fillText(label + '  —', x, y + 7);
      return;
    }
    const st = GEAR.state(gear);
    const dr = GEAR.reduction(gear);
    const ratio = gear.dur / gear.max;
    const col = st === 'broken' ? '#6b3a3a' : st === 'worn' ? '#b5883a' : '#3f8b78';

    c.fillStyle = '#6f8a82';
    c.fillText(label, x, y + 7);
    c.fillStyle = '#dbe5e1';
    c.fillText(Math.ceil(gear.dur) + '', x + 26, y + 7);

    const bx = x + 52, bw = w - 52 - 52;
    c.fillStyle = '#1b2b26';
    c.fillRect(bx, y, bw, 5);
    c.fillStyle = col;
    c.fillRect(bx, y, bw * U.clamp(ratio, 0, 1), 5);

    c.fillStyle = col;
    c.fillText(Math.round(dr * 100) + '%', bx + bw + 6, y + 7);
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
    c.fillText('/ ' + P.bag.hasAmmo(), 26 + c.measureText(P.mag + '').width + 26, CFG.VIEW_H - 44);

    // 当前武器：名字 + 槽位
    c.textAlign = 'right';
    c.fillStyle = '#8fa8a0';
    c.fillText(P.weapon.short + ' ' + (P.slot + 1) + '/3', 178, CFG.VIEW_H - 52);
    c.textAlign = 'left';

    if (P.reloadT > 0) {
      c.fillStyle = '#c98a5e';
      c.fillText('换弹中', 26, CFG.VIEW_H - 26);
    } else if (P.mag === 0) {
      c.fillStyle = '#8d3a3a';
      c.fillText('按 R 装填', 26, CFG.VIEW_H - 26);
    } else {
      c.fillStyle = '#4f665f';
      c.fillText('石子 ×' + P.stones + '   [Q] 投掷', 26, CFG.VIEW_H - 26);
    }

    /* --- 右上：潮汐 --- */
    const TW = 190, TH = 66;
    const tx0 = CFG.VIEW_W - TW - 14;
    c.fillStyle = 'rgba(8,14,12,0.78)';
    c.fillRect(tx0, 14, TW, TH);

    const left = Math.max(0, CFG.TIDE.ROUND - this.time);
    const phaseName = ['退潮', '平潮', '涨潮', '已满'][this.tidePhase];
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
    c.fillText('背包 ' + P.bag.slots.length + ' / ' + CFG.BAG.SLOTS, CFG.VIEW_W - 26, CFG.VIEW_H - 34);
    c.fillStyle = '#4f665f';
    c.fillText('Tab 打开', CFG.VIEW_W - 26, CFG.VIEW_H - 20);

    /* --- 交互提示 --- */
    c.textAlign = 'center';
    const it = this.findInteractable();
    let prompt = '';
    if (this.action) {
      prompt = '';
    } else if (it) {
      if (it.type === 'extract') prompt = '[E] 撤离（6 秒，站定）';
      else if (it.type === 'box') prompt = '[E] 打开 ' + ({ fast: '抽屉', std: '柜子', heavy: '保险箱（5 秒）' }[it.obj.kind]);
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

    /* --- 读条 --- */
    if (this.action) {
      const a = this.action;
      const p = U.clamp(a.t / a.total, 0, 1);
      const bw = 200;
      c.fillStyle = 'rgba(8,14,12,0.9)';
      c.fillRect(CFG.VIEW_W / 2 - bw / 2, CFG.VIEW_H / 2 + 54, bw, 8);
      c.fillStyle = a.type === 'extract' ? '#3fbf9b' : '#8a7d5a';
      c.fillRect(CFG.VIEW_W / 2 - bw / 2, CFG.VIEW_H / 2 + 54, bw * p, 8);
    }

    /* --- Toast --- */
    c.textAlign = 'center';
    c.font = '11.5px monospace';
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
  credits: START_CREDITS,
  loadout: { ammo: 60, bandage: 3, stone: 3 },
  // 配装：三个武器位 + 头盔 / 护甲（带各自耐久，同型号不共用）
  gear: {
    weapons: ['rifle', 'shotgun', 'pistol'],
    helmet: null,      // { type:'helmet', lv, dur }
    body: null         // { type:'body',   lv, dur }
  },
  runs: 0,

  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return;
      const d = JSON.parse(raw);
      this.codex = d.codex || {};
      this.stash = Array.isArray(d.stash) ? d.stash : [];
      this.runs = d.runs || 0;
      // 老存档没有这两个字段，补默认值
      this.credits = (typeof d.credits === 'number') ? d.credits : START_CREDITS;
      this.loadout = d.loadout || { ammo: 60, bandage: 3, stone: 3 };
      for (const k in SUPPLY) {
        if (typeof this.loadout[k] !== 'number') this.loadout[k] = SUPPLY[k].start;
      }

      // 配装：老存档没有就补默认，缺字段逐项兜底
      const g = d.gear || {};
      this.gear = {
        weapons: Array.isArray(g.weapons) ? g.weapons.slice(0, 3) : ['rifle', 'shotgun', 'pistol'],
        helmet: g.helmet ? GEAR.make('helmet', g.helmet.lv, g.helmet.dur) : null,
        body: g.body ? GEAR.make('body', g.body.lv, g.body.dur) : null
      };
      while (this.gear.weapons.length < 3) this.gear.weapons.push(null);

      this.normalizeStash();
    } catch (e) { /* 忽略，从零开始 */ }
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
        v: 2,
        codex: this.codex,
        stash: this.stash.slice(-300),
        credits: this.credits,
        loadout: this.loadout,
        gear: this.gear,
        runs: this.runs
      }));
    } catch (e) { /* localStorage 不可用就算了 */ }
  },

  /* 同一种物品合并成一条，顺便丢掉物品表里已经不存在的东西。
     装备（e.gear）不合并：同型号的耐久不一样，一件一条。 */
  normalizeStash() {
    const m = new Map();
    const gears = [];
    for (const e of this.stash) {
      if (!e) continue;
      if (e.gear && e.gear.equip) { gears.push({ id: e.id, n: 1, gear: e.gear }); continue; }
      if (!ITEM_BY_ID[e.id]) continue;
      m.set(e.id, (m.get(e.id) || 0) + (e.n || 1));
    }
    this.stash = [...m].map(([id, n]) => ({ id, n })).concat(gears);
  },

  stashCount(id) {
    const e = this.stash.find(x => x.id === id && !x.gear);
    return e ? e.n : 0;
  },

  addStash(id, n) {
    const e = this.stash.find(x => x.id === id && !x.gear);
    if (e) e.n += n;
    else this.stash.push({ id, n });
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
    Game.state = 'base';
    Save.normalizeStash();
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
    document.getElementById('bCredits').textContent = '¥' + Save.credits;
    document.getElementById('bRuns').textContent = Save.runs;
    document.getElementById('bCodex').textContent =
      Object.keys(Save.codex).length + ' / ' + totalCodex;

    this.renderGear();
    this.renderPicker();
    this.renderCarry();
    this.renderTabs();
    this.renderFilter();
    this.renderStash();
  },

  /* ---- 装备：3 个武器位 + 头盔 / 护甲 / 背包 ---- */
  renderGear() {
    const el = document.getElementById('baseGear');
    if (!el) return;
    el.innerHTML = '';
    const G = Save.gear;

    for (let i = 0; i < 3; i++) {
      const w = WEAPONS[G.weapons[i]];
      const row = document.createElement('div');
      row.className = 'slot' + (w ? '' : ' empty');
      row.innerHTML =
        '<div class="slot-ico">' + Icons.gearIcon(w ? w.id : null, i < 2 ? '主' : '副') + '</div>' +
        '<div class="slot-txt"><b>' + (w ? w.name : '空') + '</b><span>' +
          (w ? w.dmgMin + '–' + w.dmgMax + ' 伤害 · 弹匣 ' + w.mag + ' · ' + w.rpm + ' 发/分'
             : '点击选一把' + (i < 2 ? '主武器' : '副武器')) +
        '</span></div>';
      row.onclick = () => this.cycleWeapon(i);
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
          (g ? Math.round(GEAR.reduction(g) * 100) + '% 减伤 · 耐久 ' +
               Math.ceil(g.dur) + '/' + g.max + ' · ' : '') +
          act +
        '</span></div>';
      row.onclick = () => this.togglePicker(type, row);
      el.appendChild(row);
    }

    const bag = document.createElement('div');
    bag.className = 'slot empty';
    bag.innerHTML =
      '<div class="slot-ico">' + Icons.gearIcon('bag', '包') + '</div>' +
      '<div class="slot-txt"><b>单格背包（暂不开放）</b><span>' +
        CFG.BAG.SLOTS + ' 格 · 负重上限 ' + CFG.BAG.CARRY + ' kg</span></div>';
    el.appendChild(bag);
  },

  /* 武器位：在同类型武器之间轮换 */
  cycleWeapon(slotIdx) {
    const want = slotIdx < 2 ? 'primary' : 'secondary';
    const ids = Object.keys(WEAPONS).filter(k => WEAPONS[k].slot === want);
    const cur = Save.gear.weapons[slotIdx];
    const i = ids.indexOf(cur);
    Save.gear.weapons[slotIdx] = ids[(i + 1) % ids.length];
    Save.save();
    this.renderGear();
    this.note('换上 ' + WEAPONS[Save.gear.weapons[slotIdx]].name);
  },

  /* ---- 护甲槽：点开一个列表，从仓库里挑一件 ---- */

  /* 仓库里能穿在这一位的装备（按等级降序） */
  stashArmor(type) {
    return Save.stash.filter(e => {
      const it = stashItem(e);
      return it && it.equip && it.equip.kind === 'armor' && it.equip.gear.type === type;
    }).sort((a, b) => stashItem(b).equip.gear.lv - stashItem(a).equip.gear.lv);
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
    box.style.maxHeight = Math.max(140, vh - top - 12) + 'px';
  },

  renderPicker() {
    const box = document.getElementById('gearPicker');
    if (!box) return;
    box.innerHTML = '';
    const type = this.picker;
    if (!type) { box.style.display = 'none'; return; }
    box.style.display = '';

    const cur = Save.gear[type];
    const list = this.stashArmor(type);

    const hd = document.createElement('div');
    hd.className = 'picker-hd';
    hd.innerHTML = '<span>选择' + GEAR[type].label + '</span><span>仓库里有 ' + list.length + ' 件</span>';
    box.appendChild(hd);

    /* 第一条永远是"不穿"，否则穿上了就取不下来 */
    if (cur) {
      box.appendChild(this.pickerRow({
        fb: GEAR[type].short,
        name: '不穿',
        sub: '把 ' + cur.name + ' 放回仓库',
        cls: 'off',
        click: () => this.unequip(type)
      }));
    }

    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'picker-empty';
      empty.innerHTML = cur
        ? '仓库里没有别的' + GEAR[type].label + '了。'
        : '仓库里没有' + GEAR[type].label + '。<br>右侧<b>护甲商人</b>那儿能买到崭新的一~三级，' +
          '更高级的只能从尸体上带回来。';
      box.appendChild(empty);
    } else {
      for (const e of list) {
        const it = e.gear;                  // 伪物品，equip.gear 是真正的护甲实例
        const g = it.equip.gear;
        const st = GEAR.state(g);
        const stName = st === 'ok' ? '完好' : (st === 'worn' ? '破损 · 减伤减半' : '失效 · 不减伤');
        box.appendChild(this.pickerRow({
          icon: it.icon, fb: it.short,
          name: g.name + ' Lv' + g.lv,
          sub: Math.round(GEAR.reduction(g) * 100) + '% 减伤 · 耐久 ' +
               Math.ceil(g.dur) + '/' + g.max + ' · ' +
               (st === 'ok' ? '完好' : '<span class="' + st + '">' + stName + '</span>'),
          click: () => this.equipFromStash(e, type)
        }));
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

  /* 穿上仓库里那一件；身上原有的落回仓库，不会消失 */
  equipFromStash(entry, type) {
    const it = stashItem(entry);
    if (!it || !it.equip || it.equip.kind !== 'armor') return;
    const g = it.equip.gear;
    const cur = Save.gear[type];

    Save.stash = Save.stash.filter(x => x !== entry);
    if (cur) Save.addGearStash(EQUIP.armor(cur));
    Save.gear[type] = GEAR.make(type, g.lv, g.dur);
    Save.save();

    this.closePicker();
    this.render();
    this.note('穿上 ' + g.name + (cur ? '，' + cur.name + ' 放回仓库' : ''));
  },

  /* 卸下：放回仓库，不是销毁 */
  unequip(type) {
    const cur = Save.gear[type];
    if (!cur) { this.closePicker(); return; }
    if (Save.stash.length >= STASH_SLOTS) {
      this.note('仓库满了，先卖点东西', true);
      return;
    }
    Save.addGearStash(EQUIP.armor(cur));
    Save.gear[type] = null;
    Save.save();
    this.closePicker();
    this.render();
    this.note('卸下' + GEAR[type].label + '，已放回仓库');
  },

  /* ---- 护甲商人：只卖崭新的一~三级 ---- */
  SHOP_MAX_LV: 3,

  renderTabs() {
    const el = document.getElementById('baseTabs');
    if (!el) return;
    const shop = this.tab === 'shop';
    if (!el.dataset.built) {
      const opts = [['stash', '仓库'], ['shop', '护甲商人']];
      el.innerHTML = opts.map(([k, name]) =>
        '<button class="pill' + (k === (this.tab || 'stash') ? ' on' : '') +
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

    document.getElementById('tabStash').style.display = shop ? 'none' : '';
    document.getElementById('tabShop').style.display = shop ? '' : 'none';
    document.getElementById('btnSellJunk').style.display = shop ? 'none' : '';
    document.getElementById('stashCount').style.display = shop ? 'none' : '';
    const title = document.getElementById('storeTitle');
    if (title) title.textContent = shop ? '护甲商人' : '仓库';
    if (shop) this.renderShop();
  },

  renderShop() {
    const el = document.getElementById('shopList');
    if (!el) return;
    el.innerHTML = '';
    const wallet = document.getElementById('shopWallet');
    if (wallet) wallet.textContent = '¥' + Save.credits;

    for (const type of ['helmet', 'body']) {
      const cat = document.createElement('div');
      cat.className = 'shop-cat';
      cat.textContent = GEAR[type].label;
      el.appendChild(cat);

      for (let lv = 1; lv <= this.SHOP_MAX_LV; lv++) {
        const d = GEAR.def(type, lv);
        if (!d) continue;
        const can = Save.credits >= d.price && Save.stash.length < STASH_SLOTS;
        const ico = Icons.gear[type + lv]
          ? '<img class="ic" src="' + Icons.gear[type + lv].src + '" alt="">'
          : '<span class="ic gl">' + GEAR[type].short + '</span>';

        const row = document.createElement('div');
        row.className = 'srow';
        row.style.borderLeftColor = RARITY[gearRarity(lv) - 1].color;
        row.innerHTML =
          ico +
          '<span class="nm"><b>' + d.name + '</b>' +
            '<span style="color:#5f7a72">Lv' + lv + '</span> · ' +
            Math.round(d.dr * 100) + '% 减伤 · 耐久 ' + d.dur + ' · ' + d.w + 'kg</span>' +
          '<span class="pr">¥' + d.price + '</span>' +
          '<button class="buy' + (can ? '' : ' no') + '">' +
            (Save.credits < d.price ? '钱不够' : '买下') + '</button>';
        const btn = row.querySelector('button');
        if (can) btn.onclick = () => this.buyArmor(type, lv);
        else btn.disabled = true;
        el.appendChild(row);
      }
    }
  },

  buyArmor(type, lv) {
    const d = GEAR.def(type, lv);
    if (!d) return;
    if (lv > this.SHOP_MAX_LV) return;                 // 商人进不到更高级的货
    if (Save.stash.length >= STASH_SLOTS) { this.note('仓库满了，先卖点东西', true); return; }
    if (Save.credits < d.price) {
      this.note('买 ' + d.name + ' 还差 ¥' + (d.price - Save.credits), true);
      return;
    }
    Save.credits -= d.price;
    Save.addGearStash(EQUIP.armor(GEAR.make(type, lv)));   // 崭新：耐久是满的
    Save.save();
    Game.sfx('pickup');
    this.render();
    this.note('买下 ' + d.name + '（-¥' + d.price + '），在仓库里，回左边换上');
  },

  /* ---- 携带配置 ---- */
  computeCost() {
    // 破产保护：钱见底时补给免费，避免连续死亡后卡死
    if (Save.credits < BROKE_LINE) return 0;
    let cost = 0;
    for (const k in SUPPLY) {
      const sp = SUPPLY[k];
      const want = Save.loadout[k] || 0;
      const fromStash = sp.itemId ? Save.stashCount(sp.itemId) : 0;
      const buy = Math.max(0, want - fromStash);
      cost += buy * sp.price;
    }
    return cost;
  },

  renderCarry() {
    const el = document.getElementById('carryList');
    el.innerHTML = '';
    for (const k in SUPPLY) {
      const sp = SUPPLY[k];
      const want = Save.loadout[k] || 0;
      const fromStash = sp.itemId ? Save.stashCount(sp.itemId) : 0;
      const buy = Math.max(0, want - fromStash);

      const row = document.createElement('div');
      row.className = 'carry-row';
      row.innerHTML =
        '<span class="cn">' + sp.name +
          '<i>' + (fromStash > 0 ? '仓库 ' + fromStash : '') +
          (buy > 0 ? (fromStash > 0 ? ' · ' : '') + '买 ' + buy + ' ¥' + (buy * sp.price) : '') +
        '</i></span>' +
        '<div class="stepper"><button data-d="-1">−</button><b>' + want +
        '</b><button data-d="1">+</button></div>';

      row.querySelectorAll('button').forEach(b => {
        b.onclick = () => this.stepCarry(k, parseInt(b.dataset.d, 10));
      });
      el.appendChild(row);
    }
    const cc = this.computeCost();
    document.getElementById('carryCost').textContent =
      (Save.credits < BROKE_LINE) ? '救济补给 · 免费' : '¥' + cc;
  },

  stepCarry(key, dir) {
    const sp = SUPPLY[key];
    const cur = Save.loadout[key] || 0;
    const next = U.clamp(cur + dir * sp.step, 0, sp.max);
    if (next === cur) return;
    Save.loadout[key] = next;
    Save.save();
    this.renderCarry();
    this.renderStash();
  },

  /* ---- 仓库 ---- */
  renderFilter() {
    const el = document.getElementById('stashFilter');
    if (el.dataset.built) return;      // 只建一次，之后只切 class
    const opts = [
      ['all', '全部'], ['sell', '可出售'],
      ['sup', '补给品'], ['col', '收藏品']
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

  renderStash() {
    const el = document.getElementById('stashList');
    const list = Save.stash.filter(e => {
      const it = stashItem(e);
      if (!it) return false;
      if (this.filter === 'sup') {
        if (e.gear) return false;
        for (const k in SUPPLY) if (SUPPLY[k].itemId === e.id) return true;
        return false;
      }
      if (this.filter === 'col') return !it.noCodex && !it.equip;
      return true;
    }).sort((a, b) => {
      const ia = stashItem(a), ib = stashItem(b);
      return (ib.price || 0) - (ia.price || 0);
    });

    document.getElementById('stashCount').textContent = Save.stash.length + ' 种 / ' + STASH_SLOTS + ' 格';
    const total = Save.stash.reduce((a, e) => {
      const it = stashItem(e);
      return a + (it ? unitPrice(it) * (e.n || 1) : 0);
    }, 0);
    document.getElementById('stashValue').textContent = '¥' + total;

    if (!list.length) {
      el.innerHTML = '<div class="empty-note">仓库是空的。<br>下去一趟，总能带点东西回来。</div>';
      return;
    }

    el.innerHTML = '';
    for (const e of list) {
      const it = stashItem(e);
      const r = RARITY[it.r - 1];
      const c = CATS[it.cat] || CATS.ind;
      const unit = unitPrice(it);
      const n = e.n || 1;
      /* 装备多一行耐久，因为同一个名字的东西价钱可能差一倍 */
      let extra = '';
      if (it.equip) {
        extra = it.equip.kind === 'armor'
          ? '耐久 ' + Math.ceil(it.equip.gear.dur) + '/' + it.equip.gear.max
          : '弹匣 ' + (it.equip.mag || 0) + ' 发';
      }
      const row = document.createElement('div');
      row.className = 'srow';
      row.style.borderLeftColor = r.color;
      row.innerHTML =
        Icons.bagTag(it, 'ic') +
        '<span class="nm"><b>' + it.name + '</b>' +
          '<span style="color:' + c.color + '">' + c.name + '</span> · ' +
          '<span style="color:' + r.color + '">' + r.name + '</span>' +
          (extra ? ' · ' + extra : '') + '</span>' +
        '<span class="qty">×' + n + '</span>' +
        '<span class="pr">¥' + (unit * n) + '</span>' +
        '<button class="sell">卖出 ×' + n + '</button>';
      row.querySelector('button').onclick = () => this.sell(e, n);
      el.appendChild(row);
    }
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
      if (it && !it.equip && it.r === 1) { gain += it.price * e.n; count += e.n; }
      else keep.push(e);
    }
    if (!count) { this.note('仓库里没有寻常物可卖'); return; }
    Save.stash = keep;
    Save.credits += gain;
    Save.save();
    this.render();
    this.note('清掉 ' + count + ' 件寻常物，+' + gain + ' 信用点');
  },

  /* ---- 出发 ---- */
  deploy() {
    const cost = this.computeCost();
    if (cost > Save.credits) {
      this.note('信用点不够，还差 ¥' + (cost - Save.credits), true);
      return;
    }

    // 先扣仓库里的同类消耗品
    for (const k in SUPPLY) {
      const sp = SUPPLY[k];
      if (!sp.itemId) continue;
      let left = Save.loadout[k] || 0;
      const e = Save.stash.find(x => x.id === sp.itemId);
      if (e) {
        const take = Math.min(e.n, left);
        e.n -= take;
        left -= take;
        if (e.n <= 0) Save.stash = Save.stash.filter(x => x !== e);
      }
    }
    Save.credits -= cost;
    Save.save();

    this.close();
    Game.startRun(Save.loadout);
  }
};

/* ---------------- 启动 ---------------- */
window.addEventListener('DOMContentLoaded', () => {
  try {
    Save.load();
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
                      'ind01','med01','med01','spec01','odd01','life01','life03','ammo'];
        for (const id of demo) Save.addStash(id, 1);
        Save.addStash('ammo', 40);
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
      Game.startRun(Save.loadout);
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
