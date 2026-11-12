/* ============================================================
   局内主循环：状态字段、输入绑定、开局与循环、反馈特效
   每帧逻辑在 game-update.js，绘制在 game-render.js，
   面板在 game-panels.js，启动在 boot.js。
   ============================================================ */

/* 伤害类型 → 飘字字体。颜色只认类型，不认"谁挨打"：
   玩家中弹和敌人中弹同色，玩家专属的紫色已经退役。 */
const DMG_FONT = { normal: 'damage', crit: 'crit', melee: 'melee' };

const Game = {
  canvas: null, ctx: null,
  state: 'menu',
  player: null,
  enemies: [], bullets: [], corpses: [], boxes: [],
  targets: [],           // 靶场的钢板靶（不是敌人，只吃伤害）
  rangeMode: false,      // 开发靶场：不计时、不淹水、不结算
  particles: [], toasts: [],
  dmgPops: [],           // 伤害飘字：{x,y,t,life,rise,txt,font,scale}
  cam: { x: 0, y: 0 },
  time: 0,
  acc: 0, lastT: 0,
  shakeAmt: 0, shakeX: 0, shakeY: 0,
  flashColor: '#8d3a3a', flashA: 0,
  lastHitAngle: 0, hitDirA: 0, hitDirT: 0,
  action: null,          // { type, t, total, target }
  lootOpen: null,        // 当前打开的容器对象
  search: null,          // 正在搜的那一件 { idx, t, total }
  _searchBar: null,      // 搜索扫描线的 DOM 引用
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
    aimAngle: 0, mouseDown: false, mousePressed:false,
    dodgePressed: false, interactPressed: false,
    reloadPressed: false, bagPressed: false
  },
  /* 鼠标是否被锁定在画布上。锁定时系统光标消失、位置完全由我们累加，
     准星就是唯一的指针；后坐力把准星推远时，"鼠标"也跟着一起走。 */
  pointerLocked: false,

  /* 附近可交互目标的候选表；滚轮在表里换选中的那一项。
     interactKey 用坐标字符串记，门每帧都是新建对象，不能存引用。 */
  interactList: [], interactIndex: 0, interactKey: null, _interactWheelAcc: 0,


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

    s = Math.max(Math.min(0.5, iw / CFG.VIEW_W, ih / CFG.VIEW_H), Math.min(CFG.MAX_SCALE, s));

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
    for (const id of ['medBar', 'healHud', 'medWheel', 'ammoWheel', 'debuffBar']) {
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
      /* 正在输入框（含靶场滑杆）里打字时，别把按键当成操作。
         否则在数值框里敲 w/a/s/d 会顺手把人走起来。 */
      const ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)
        && e.key !== 'Escape') return;
      const k = e.key.toLowerCase();
      if (['tab', ' ', 'w', 'a', 's', 'd'].includes(k)) e.preventDefault();
      if (K.keys[k]) return;   // 忽略自动重复
      K.keys[k] = true;

      if (this.state !== 'playing') return;

      if (MeleeSystem.locked() && ['1','2','3','4','5','r','e','tab','b'].includes(k)) return;
      if(k==='b'){Gunplay.nextMode(this.player);return;}
      if (k === '4') { this.player.switchMelee(); return; }
      if (k === 'e') K.interactPressed = true;
      if (k === 'r') AmmoQuick.press();
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
        if (AmmoQuick.abortWheel() || MedQuick.abortWheel()) { Tips.hide(); return; }
        /* 开锁读条：Esc 也是「任何动作」之一，直接中断，不扣耐久 */
        if (this.action?.type === 'unlock') { this.cancelUnlock('开锁中断'); Tips.hide(); return; }
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
      if (k === 'r') AmmoQuick.release();
    });

    this.canvas.addEventListener('mousemove', e => {
      const r = this.canvas.getBoundingClientRect();
      const k = CFG.VIEW_W / (r.width || CFG.VIEW_W);
      if (this.pointerLocked) {
        /* 锁定后没有绝对位置了，只有增量：累加到虚拟光标上。
           乘回逻辑像素，屏幕上仍然是 1:1 跟手。 */
        K.mx += e.movementX * k;
        K.my += e.movementY * k;
      } else {
        K.mx = (e.clientX - r.left) * k;
        K.my = (e.clientY - r.top) * k;
      }
    });

    /* 浏览器只允许在用户手势里请求锁定，所以挂在第一次点画布上 */
    this.canvas.addEventListener('mousedown', e => {
      if (this.state !== 'playing') return;
      /* 点回画面就把焦点从调参框上收回来，否则 WASD 还在输入框里 */
      const ae = document.activeElement;
      if (ae && ae.blur && ae.tagName === 'INPUT') ae.blur();
      // Keep the native pointer available for inventory and menu interaction.
      if (e.button === 0) {K.mouseDown = true;K.mousePressed=true;}
      // Legacy input is available only when the range comparison toggle disables stances.
      if(e.button===2&&(typeof ShootingStance==='undefined'||!ShootingStance.active()))K.dodgePressed=true;
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 0) K.mouseDown = false;
    });

    /* 交互滚轮：同一点叠了门 / 箱子 / 尸体时，用滚轮换选中的目标。
       E 作用于当前选中项，所以门再也不会把尸体永久挡住。
       触控板一次滑动会连发好几个 wheel，按 40px 折算一格、单次最多两格；
       到表头 / 表尾就停住，不循环。 */
    window.addEventListener('wheel', e => {
      /* 滚轮换交互目标同样是动作：开锁读条期间滚一下就中断 */
      if (this.action) { if (this.action.type === 'unlock') this.cancelUnlock('开锁中断'); return; }
      if (this.state !== 'playing' || this.lootOpen || this.bagOpen) return;
      if (typeof Range !== 'undefined' && Range.active) return;
      if (typeof MedWheel !== 'undefined' && MedWheel.isOpen && MedWheel.isOpen()) return;
      if (typeof AmmoWheel !== 'undefined' && AmmoWheel.isOpen && AmmoWheel.isOpen()) return;
      const t = e.target;
      /* 面板 / 输入框 / 弹窗里的滚轮是它们自己的，别抢 */
      if (t && t.closest && t.closest(
        '#lootBox, #bagBox, #itemTip, #dealBox, dialog, input, select, textarea, [type="range"]')) return;
      if (this.findInteractables().length < 2) { this._interactWheelAcc = 0; return; }
      e.preventDefault();
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;                    // 按行滚动
      else if (e.deltaMode === 2) dy *= CFG.VIEW_H;      // 按页滚动
      this._interactWheelAcc = (this._interactWheelAcc || 0) + dy;
      let steps = 0;
      while (Math.abs(this._interactWheelAcc) >= 40 && steps < 2) {
        const dir = this._interactWheelAcc > 0 ? 1 : -1;
        this._interactWheelAcc -= dir * 40;
        steps++;
        if (!this.scrollInteract(dir)) { this._interactWheelAcc = 0; break; }
      }
    }, { passive: false });

    // Suppress only browser defaults; inventory and shop context-menu handlers still run.
    document.addEventListener('contextmenu', e => e.preventDefault(), true);

    /* 锁定状态变了：Esc 会由浏览器强制解锁，这时候得告诉玩家点一下继续，
       否则光标回到绝对位置、准星突然跟上鼠标，看起来像"跳"了。 */
    document.addEventListener('pointerlockchange', () => {
      const was = this.pointerLocked;
      this.pointerLocked = (document.pointerLockElement === this.canvas);
      if (this.canvas && this.canvas.classList) {
        this.canvas.classList.toggle('cursor-locked', this.pointerLocked);
      }
      if (was && !this.pointerLocked && this.state === 'playing' &&
          !this.lootOpen && !this.bagOpen && !this._lockVoluntary) {
        this.toast('鼠标已解锁 · 点画面继续');
      }
      this._lockVoluntary = false;
    });
    document.addEventListener('pointerlockerror', () => {
      this.pointerLocked = false;
    });

    // 失焦时松开所有键，避免卡住（轮盘也一起收掉，别停在打开状态）
    window.addEventListener('blur', () => {
      for (const k in K.keys) K.keys[k] = false;
      K.mouseDown = false;
      K.mousePressed = false;
      MedQuick.cancel();
      AmmoQuick.cancel();
    });
  },

  /* ---------------- 鼠标锁定 ----------------
     锁定之后系统光标消失，光标位置完全由 mousemove 的增量累加而来。
     这样后坐力把准星推远时，"鼠标"跟着准星一起走，玩家眼里只有一个指针；
     虚拟光标只夹在画布内，可以随意穿过玩家（贴身近战要能往身后甩枪）。 */
  wantLock() {
    if (typeof document === 'undefined' || !this.canvas) return;
    if (!this.canvas.requestPointerLock) return;      // 老浏览器：退回绝对坐标
    if (document.pointerLockElement === this.canvas) return;
    if (this._lockCooling) return;
    this._lockCooling = true;
    /* 请求失败会走 pointerlockerror，冷却一下别每帧重试 */
    setTimeout(() => { this._lockCooling = false; }, 400);
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { this.pointerLocked = false; }
  },

  releaseLock() {
    if (typeof document === 'undefined' || !document.exitPointerLock) return;
    if (!document.pointerLockElement) return;
    this._lockVoluntary = true;    // 主动放开的不提示"点画面继续"
    try { document.exitPointerLock(); } catch (e) {}
  },

  roundDuration(mapId = this.mapId) { return CFG.RAID.DURATION[mapId] || CFG.TIDE.ROUND; },

  clearRaidNotice() {
    this.raidNotice = null;
    const el = document.getElementById('raidNotice');
    if (el) { el.hidden = true; el.textContent = ''; el.classList.remove('urgent'); }
  },

  renderRaidNotice() {
    const el = document.getElementById('raidNotice');
    if (!el) return;
    const notice = this.raidNotice;
    const hidden = !((this.state === 'playing' || this.state === 'dying') && notice);
    if (el.hidden !== hidden) el.hidden = hidden;
    if (!hidden) { if (el.textContent !== notice.message) el.textContent = notice.message; el.classList.toggle('urgent', notice.seconds <= 60); }
  },

  bindUI() {
    document.getElementById('btnStart').onclick = () => {
      SFX.init();
      Base.open();
    };
    document.getElementById('btnDeploy').onclick = () => MapSelect.open();
    document.getElementById('btnMapBack').onclick = () => MapSelect.back();
    document.getElementById('btnMapStart').onclick = () => MapSelect.confirm();
    /* 出发前提醒弹窗的三个动作 */
    document.getElementById('deployGoPrepare').onclick = () => DeployGuard.goPrepare();
    document.getElementById('deployGoAnyway').onclick = () => {
      const mapId = DeployGuard._pendingMap || MapSelect.selectedId;
      DeployGuard.close();
      Base.deploy(mapId, { force: true });
    };
    document.getElementById('deployCancel').onclick = () => DeployGuard.close();
    /* Esc 在提醒弹窗上关闭弹窗，没弹窗时才返回藏身处 */
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape' && this.state==='map-select'){
        e.preventDefault();
        const veil = document.getElementById('deployVeil');
        if (veil && !veil.classList.contains('hidden')) DeployGuard.close();
        else MapSelect.back();
      }
    });
    document.getElementById('btnSellJunk').onclick = () => Base.sellJunk();
    Ctx.bindClose();
  },

  /* 开局盘点：背包 + 安全箱里每件东西各几份。
     结算时按 id 逐份抵扣，扣完的那几份就是"自己带进来的"，不计收获价值
     （钥匙看剩余耐久也照样扣，因为带进来时它就在身上）。
     同 id 堆叠（子弹）按数量抵扣，所以捡到的部分仍然会被算进收益。 */
  snapshotBroughtIn() {
    const counts = {};
    const take = s => {
      const id = s && s.item && s.item.id;
      if (id) counts[id] = (counts[id] || 0) + (s.n || 1);
    };
    this.player.bag.slots.forEach(take);
    this.player.bag.safe.forEach(take);
    return counts;
  },

  fillBagFromSave() {
    Save.normalizeBag();
    const stay = [];
    for (const e of Save.bag) {
      const it = stashItem(e);
      if (!it) continue;
      let ok = false;
      if (e.gear) {
        /* 装备走 canAdd，这样背包（不能套娃）和其它规则都在一处判断 */
        const chk = this.player.bag.canAdd(it, 1);
        ok = chk.ok;
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
    if(!this.rangeMode){
      Save.normalizeSafe();
      this.player.bag.safe=Save.safe.map(e=>({item:stashItem(e),n:e.n||1,...(e.cap==null?{}:{cap:e.cap})}));
      Save.safe=[];
      /* 钥匙链跟着人走：局内拿一份副本，存档里这一串原地留着。
         局内每开一次门都会把剩余耐久写回 Save.chain（Game.syncRaidChain），
         撤离 / 阵亡时结算页再按副本整体回写一遍。
         不在这里清空 —— 局内刷新会直接回到藏身处，清空了整串钥匙就掉了。 */
      Save.normalizeChain();
      this.player.bag.chain=Save.chain.map(e=>({item:stashItem(e),n:e.n||1,...(e.cap==null?{}:{cap:e.cap})}));
      Save.save();Save.flush();
    }
  },

  /* 钥匙链的耐久写回存档：局内每开一次锁、以及关页 / 刷新前各调一次。
     耐久归零的那把按规则直接销毁，不进仓库也不留在链上。 */
  syncRaidChain(consumed) {
    const P = this.player;
    if (!P || !P.bag || !Array.isArray(P.bag.chain)) return false;
    /* 空链保护：关页 / 刷新 / 靶场里局内链可能还没装好，别让空数组把存档
       里的钥匙抹掉。但「刚开锁把最后一把钥匙用尽」也是真实的空链 —— 只有
       prepareOpen 会传 consumed=true，此时必须写回清空，否则刷新后碎钥匙复活。 */
    if (!consumed && !P.bag.chain.length && (Save.chain || []).length) return false;
    const rows = P.bag.chain.filter(s => s && s.item && ItemCapacity.remaining(s) >= 1)
      .map(s => ({ id: s.item.id, n: s.n || 1, ...(s.cap == null ? {} : { cap: s.cap }) }));
    const same = rows.length === (Save.chain || []).length &&
      rows.every((r, i) => Save.chain[i] && Save.chain[i].id === r.id &&
        ItemCapacity.remaining(Save.chain[i]) === ItemCapacity.remaining(r));
    if (same) return false;
    Save.chain = rows;
    Save.save(); Save.flush();
    return true;
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
    this.input.mouseDown=false;
    this.input.mousePressed=false;
    /* 开局就把大厅音乐撤掉（选图页可能没走 Base.close） */
    if (typeof Music !== 'undefined') Music.stop(0.6);
    /* 靶场地图是代码生成的，不进 MAP_CATALOG（选图页不该看到它） */
    const map = (typeof RANGE_MAP !== 'undefined' && mapId === RANGE_MAP.id)
      ? RANGE_MAP
      : MAP_CATALOG.find(m=>m.id===(mapId||RAID_MAP.id));
    if(!map)throw new Error('未知地图：'+mapId);
    this.mapId=map.id;
    this.state = 'playing';
    this.deathElapsed = 0;
    this._deathSoundPlayed = false;
    this.time = 0;
    this.raidWarnings = new Set();
    this.clearRaidNotice();
    this.tideLevel = 0;
    this.tidePhase = 0;
    this.enemies = [];
    this.bullets = [];
    this.corpses = [];
    this.targets = [];
    this.particles = [];
    this.toasts = [];
    this.dmgPops = [];
    this.pileSeq = 0;
    this.action = null;
    this.lootOpen = null;
    this.extractDone = false;
    this.interactList = [];
    this.interactIndex = 0;
    this.interactKey = null;
    this._interactAnchor = null;
    this._interactWheelAcc = 0;
    /* 新一局：快捷医疗重新按背包顺序选最靠前的那件 */
    if (typeof MedHud !== 'undefined') MedHud.reset();
    /* 局内损伤不跨局保留：清上一局残留的敌人状态与状态条 */
    if (typeof Debuff !== 'undefined') Debuff.clearAll();
    this.stats = { kills: 0, found: 0, newItems: [] };

    // 重置地图状态
    M.load(map.rows, map.doorAxes, map.props, map);
    /* 局级规则：随机挑一个撤离点当入场点并封闭它（撤离点不足 2 个会自动退回固定出生点）。
       放在 M.load 之后，编辑器/校验工具单纯 M.load 地图时不会被这条规则影响。 */
    M.chooseInfiltration();
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
    /* 带入清单：结算时要把「自己背进来的东西」从收获价值里扣掉，
       否则带一把 3000 万的钥匙进去、原样带出来，结算就凭空多 3000 万。 */
    this.broughtIn = this.snapshotBroughtIn();

    // 武器与护甲：护甲拷一份实例出来，耐久变化写回 Save.gear
    this.player.fillWeapons(Save.gear.weapons);
    // Empty gun slots are valid; melee equipment is selected by the melee integration.
    this.player.helmet = Save.gear.helmet ? Object.assign({}, Save.gear.helmet) : null;
    this.player.body = Save.gear.body ? Object.assign({}, Save.gear.body) : null;
    /* 背包：拷一份，它只提供容量，没有耐久所以不会在局内变化 */
    this.player.back = Save.gear.back ? Object.assign({}, Save.gear.back) : null;

    // 敌人
    if(typeof HumanAI!=='undefined')HumanAI.sequence=0;
    for (const s of map.enemies) {
      const point=M.navigationPoint(s.x,s.y);
      this.enemies.push(new Enemy(s.type||s.t, point.x,point.y, s.patrolRadius,s));
    }

    Noise.clear();
    Quiet.clear();
    M.tideLevel = 0;
    this.stats.found = 0;
    this.closeLoot();
    if (this.bagOpen) this.toggleBag({ silent: true });

    this.updateCamera(true);
    this.toast('进入' + map.title);
    /* 入场点本局作废：开局就把「从哪进来、还能从哪走」说清楚，别等玩家跑回去才发现 */
    if (M.infiltration) {
      const open = M.openExtracts().map(ex => ex.name || ex.id).join('、');
      this.toast('从「' + (M.infiltration.name || M.infiltration.id) + '」入场，此点已封闭 · 请前往：' + open);
    }

    // 预热一帧：即使浏览器还没来得及跑 requestAnimationFrame，画面也不是黑的
    this.update(1 / 60);
    this.renderRaidNotice();
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

    /* 兜底：只要不是战斗中，就不该锁着鼠标 ——
       结算、地图页、藏身处都要能点按钮。 */
    if (this.pointerLocked && this.state !== 'playing') this.releaseLock();

    this.renderRaidNotice();
    this.render();
    if (typeof MedHud !== 'undefined') MedHud.frame();
    this.scheduleFrame();
  },

  /* ---------------- 反馈 ---------------- */
  /* 护甲耐久 / 武器余弹变化后写回存档，死了也不回滚——装备是消耗品 */
  syncGear() {
    const P = this.player;
    if (!P) return;
    /* 靶场里换枪、清弹匣都不该污染存档 */
    if (this.rangeMode) return;
    P.weapons[P.slot] && (P.weapons[P.slot].magCur = P.mag);   // 手上那把的余弹先同步
    Save.gear.weapons = P.weapons.map(w => (w ? Gunplay.snapshot(w) : null));
    Save.gear.melee = P.melee || null;
    Save.gear.helmet = P.helmet ? Object.assign({}, P.helmet) : null;
    Save.gear.body = P.body ? Object.assign({}, P.body) : null;
    Save.gear.back = P.back ? Object.assign({}, P.back) : null;
    Save.save();
  },

  /* 被爆头时的一次性提示 */
  headshotMark() {
    this.headT = 0.45;
  },

  /* kind='good' 是好消息通知（新收录之类）：画成青绿色，并额外响一声通知音。
     普通的警告和错误保持安静 —— 满屏"背包满了"都在响的话会烦死。 */
  toast(msg, kind) {
    const good = kind === 'good';
    this.toasts.push({ msg, t: 2.2, good });
    if (this.toasts.length > 4) this.toasts.shift();
    if (good && typeof SFX !== 'undefined' && SFX.ui) SFX.ui('notify');
  },

  sfx(name, opts) { SFX.play(name, opts); },

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

  /* 伤害飘字：在 (x, y) 的正上方冒一个数字。
     y 传给的是"目标顶部"，数字从这点往上长，不会压在头上挡视线。
     opts.kind 按伤害类型选字体：normal 骨白 / crit 橙金 / melee 蓝（近战真伤）。
     opts.crit 是旧的爆头开关，等价于 kind:'crit'（保留给现有调用与测试）。
     opts.font 直接指定字体，优先级最高，留给特殊场合。
     opts.key  目标对象：同一个目标连着中（间隔 < CFG.DMG_TEXT.MERGE），
               数字并进同一条累加，全自动扫射只看到一条往上跳的数。
     返回这条飘字当前显示的数值。 */
  popDamage(x, y, value, opts) {
    const C = CFG.DMG_TEXT;
    const o = opts || {};
    const kind = o.kind || (o.crit ? 'crit' : 'normal');
    const crit = kind === 'crit';
    const font = o.font || DMG_FONT[kind] || 'damage';
    const n = Math.max(0, Math.round(value));

    /* 全自动一梭子三十发：三十个数字叠在同一个脑袋上，谁也读不出来。
       同一个目标短时间内的连续命中并成一条，数字一路往上跳 ——
       反而更清楚"这一梭子一共打掉了多少"。只并最近几条，免得翻整张表。 */
    if (o.key) {
      for (let i = this.dmgPops.length - 1; i >= 0 && i >= this.dmgPops.length - 6; i--) {
        const p = this.dmgPops[i];
        if (p.key === o.key && p.font === font && p.t - p.last < C.MERGE) {
          p.val += n;
          p.txt = String(p.val);
          p.last = p.t;                    // 按"距离上一次命中"算窗口，长点射会一直累加
          /* 还在挨打就别急着淡：把寿命顶到"从现在起还能亮满一条" */
          p.life = Math.max(p.life, p.t + C.LIFE);
          return p.val;
        }
      }
    }

    /* 连打时往上错开：0.16s 内连续冒出来的数字每多一条就抬高 STAIR 像素，
       四档循环。同一时刻多个目标一起挨打时，错开总比完全重叠好。 */
    if (this.time - (this._popAt || -9) > 0.16) this._popStair = 0;
    else this._popStair = (this._popStair + 1) % 4;
    this._popAt = this.time;
    /* 同一个目标已经有一条在飘（比如扫射途中爆头）：把新的一条抬到它上面，
       两条数字叠在同一个高度就都读不出来了 */
    let lift = this._popStair * C.STAIR;
    if (o.key) {
      for (const p of this.dmgPops) {
        if (p.key === o.key) { lift += C.STAIR * 4; break; }
      }
    }
    this.dmgPops.push({
      x: x + U.rand(-(crit ? C.CRIT_SPREAD : C.SPREAD), crit ? C.CRIT_SPREAD : C.SPREAD),
      y: y - lift,
      t: 0,
      last: 0,          // 上一次合并的时刻，用来判"还在连击里"
      life: crit ? C.CRIT_LIFE : C.LIFE,
      rise: crit ? C.CRIT_RISE : C.RISE,
      drift: U.rand(-C.DRIFT, C.DRIFT),
      val: n,
      txt: String(n),
      font: font,
      scale: crit ? C.CRIT_SCALE : C.SCALE,
      key: o.key || null
    });
    /* 霰弹一发八颗弹丸，同屏几十条是常态；丢掉最早的几条，别让数组无限长 */
    if (this.dmgPops.length > C.MAX) this.dmgPops.splice(0, this.dmgPops.length - C.MAX);
    return n;
  },

  impact(x, y, angle, blood, head) {
    /* 靶场：墙上的落点是要拿来量散布的，先记一笔再喷碎屑 */
    if (!blood && typeof Range !== 'undefined' && Range.active) Range.hole(x, y);
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
