/* ============================================================
   局内主循环：状态字段、输入绑定、开局与循环、反馈特效
   每帧逻辑在 game-update.js，绘制在 game-render.js，
   面板在 game-panels.js，启动在 boot.js。
   ============================================================ */

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
  }
};
