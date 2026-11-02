/* ============================================================
   通用 UI 零件：物品详情浮窗 / 右键菜单 / 交易确认 / 音效
   都只依赖 DOM 与物品数据，不认识 Game 的局内状态。
   ============================================================ */

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
      if(it.equip.kind === 'melee')return MELEE.find(x=>x.id===it.equip.melee)?.desc || '';
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
    } else if (it.equip?.kind === 'melee') {
      const d=MELEE.find(x=>x.id===it.equip.melee);
      rows.push(['真实伤害',d.damage],['攻击间隔 / 前摇',d.interval+' / '+d.windup+'秒'],['扇角 / 半径',d.angle+'° / '+d.radius+'格'],['来源',it.equip.bound?'首次赠送 · 绑定不可出售':d.available?'军火商':'暂不开放获取']);
    } else if (it.equip && it.equip.kind === 'bag') {
      rows.push(['容量', it.equip.slots + ' 格']);
      rows.push(['装备槽', '背包']);
      if (Save.gear.back && Save.gear.back.id === it.equip.bag) rows.push(['状态', '当前装备']);
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
  if (it.equip.kind === 'bag') {
    const extra = it.equip.slots - BASE_BAG_SLOTS;
    return '装上它，携带容量从基础 ' + BASE_BAG_SLOTS + ' 格变成 ' + it.equip.slots +
      ' 格（多 ' + extra + ' 格，不是叠加）。\n\n' +
      '背包不能套背包，也不能在局内更换 —— 换了更小的包而身上的东西放不下，会被拦下。';
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

/* ---------------- 音效（合成音 + 采样） ----------------
   合成音还是主力：枪声这类用振荡器和噪声现场做，文件大小为零。
   采样只补合成做不出来的材质感（枪机金属、换弹、脚步），
   由 build.js 内联成 window.__AUDIO__（单文件版）；多文件版走 http 时
   用 fetch 兜底，file:// 打不开就静默退回纯合成。 */
const SFX = {
  ctx: null,
  noiseBuf: null,
  on: true,
  samples: {},        // id → AudioBuffer
  gainOf: {},         // id → 按目标响度算好的播放增益
  loading: null,
  seed: null,         // 固定随机种子（试听/导出用）；null = 走 Math.random，游戏内保持原样
  _rng: null,
  lastShot: null,     // 上一次开火实际合成出来的层与增益，供试听页核对

  /* ---------------- 音量标准 ----------------
     所有声音都对齐到同一张目标 RMS 表。采样解码后现算 RMS，
     播放增益 = 目标 / 实测 —— 换素材不用重新调音量，天然不会出现
     "这条特别响、那条听不见"。合成音靠下面的 CAL 校准到同一水平。
     数值是 0~1 满刻度的 RMS，不是 dB：枪声 0.20 大约比脚步 0.05 响 12dB。 */
  LOUD: {
    /* 枪声是全场最响的，其余都得让位。
       0.15 是实测值：再往上峰值就顶到 0dBFS 开始削波，所以这里是上限，
       由 CAL.shot 统一压住，各枪的 vol 只在组内做相对高低。 */
    shot: 0.14,
    enemyShot: 0.075,  // 敌人枪声要能听出方位，但不能盖过自己的枪
    melee: 0.10,       // 挥刀的风声
    hit: 0.085,
    headshot: 0.085,
    break: 0.10,
    reload: 0.075,
    switch: 0.08,
    step: 0.05,        // 脚步垫底，靠频率和音色存在
    dodge: 0.09,
    pickup: 0.06,
    door: 0.08,
    search: 0.055,
    drop: 0.055,
    hurt: 0.11,
    extract: 0.09,
    death: 0.13
  },

  /* 合成音的实测校准系数（tools/audio-levels.js 输出，改参数后重跑一遍）。
     play() 里统一乘在每条合成音的总线上，所以改一层音色不用重调音量。 */
  CAL: {
    shot: 0.62, enemyShot: 1, hit: 1.06, headshot: 1.10, break: 1.74, reload: 1.07,
    melee: 3.10, door: 6.10, pickup: 0.88, search: 6.60, drop: 5.00, hurt: 2.65,
    extract: 1.80, death: 3.00, dodge: 3.10
  },

  /* ---------------- 枪声 ----------------
     每把枪都是同一套"世界观"里的五层叠出来的：
       crack 起音脆响（枪口爆音的高频）  body 中频爆裂（低频下扫的噪声）
       sub   低频冲击（膛压的"咚"）      tail 尾音（远处反射）
       mech  枪机动作（套筒/枪机复位）
     只改参数，所以四把枪既分得开，又不会像四套不同的素材拼起来。
     vol 是各枪之间的相对音量，整体再由 LOUD.shot / CAL.shot 对齐。 */
  GUN: {
    /* 5.56：脆、快、尾音短，中高频最亮 */
    rifle: {
      vol: 1.0, drive: 2.0,
      crack: { freq: 3400, q: 1.1, gain: 0.55, dur: 0.030 },
      body: { from: 5200, to: 520, gain: 0.95, dur: 0.170 },
      sub: { from: 150, to: 46, gain: 0.70, dur: 0.200 },
      tail: { freq: 1000, gain: 0.16, dur: 0.320, at: 0.02 },
      mech: { freq: 2400, q: 5, gain: 0.07, dur: 0.020, at: 0.008 }
    },
    /* 12g：低频最重、尾音最长、几乎没有脆响 —— 一枪就知道是霰弹 */
    shotgun: {
      vol: 0.82, drive: 2.6,
      crack: { freq: 2200, q: 0.9, gain: 0.30, dur: 0.050 },
      body: { from: 3600, to: 260, gain: 1.00, dur: 0.240 },
      sub: { from: 95, to: 32, gain: 0.95, dur: 0.300 },
      tail: { freq: 800, gain: 0.22, dur: 0.420, at: 0.03 }
    },
    /* 9mm 冲锋枪：又薄又急，高频多、低频少、尾音几乎没有 */
    smg: {
      vol: 0.95, drive: 1.6,
      crack: { freq: 4600, q: 1.3, gain: 0.50, dur: 0.022 },
      body: { from: 6000, to: 1100, gain: 0.85, dur: 0.100 },
      sub: { from: 190, to: 70, gain: 0.55, dur: 0.120 },
      tail: { freq: 1500, gain: 0.10, dur: 0.180, at: 0.015 },
      mech: { freq: 3200, q: 6, gain: 0.05, dur: 0.015, at: 0.010 }
    },
    /* 9mm 手枪：比冲锋枪沉一点，套筒动作明显，一枪一个"啪嗒" */
    pistol: {
      vol: 1.0, drive: 1.8,
      crack: { freq: 4000, q: 1.2, gain: 0.50, dur: 0.026 },
      body: { from: 4600, to: 700, gain: 0.90, dur: 0.130 },
      sub: { from: 160, to: 55, gain: 0.70, dur: 0.160 },
      tail: { freq: 1300, gain: 0.12, dur: 0.220, at: 0.02 },
      mech: { freq: 2800, q: 6, gain: 0.10, dur: 0.022, at: 0.055 }
    }
  },

  /* 开火的五层，顺序固定。试听页的单听/组合听/导出都按这套名字走 */
  SHOT_LAYERS: ['crack', 'body', 'sub', 'tail', 'mech'],

  /* 一个游戏音效由多段素材拼成：换弹 1.5 秒里是「退弹匣 → 插弹匣 → 拉套筒」
     三次动作，原素材整段 3.13 秒塞不进去（硬变速会让金属声变尖叫），
     所以按游戏节奏重新排时间轴。 */
  SEQ: {
    reload: [['reload_out', 0], ['reload_in', 0.55], ['reload_rack', 1.05]]
  },
  seqTimers: {},

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      /* 总线：压缩器兜住连发叠加。冲锋枪 780 RPM 是每秒 13 发，
         不加压缩器几发叠在一起就会顶到削波，"噼里啪啦"糊成一片。 */
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -8;
      comp.knee.value = 10;
      comp.ratio.value = 3;
      comp.attack.value = 0.003;
      comp.release.value = 0.15;
      comp.connect(this.ctx.destination);
      this.master = comp;
      // 预生成 1 秒噪声，所有噪声层都从这里随机取段
      const len = this.ctx.sampleRate * 1;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    } catch (e) { this.on = false; }
    if (this.on) this.load();
  },

  /* 这一段素材该有多响：按用途查 LOUD 表，查不到就按中等音量处理 */
  _targetFor(id) {
    if (/^step_stone/.test(id)) return this.LOUD.step;
    /* shot_switch 与各枪专属的 shot_switch_* 都算"切枪"，响度一视同仁 */
    if (/^shot_switch/.test(id)) return this.LOUD.switch;
    if (/^reload_/.test(id)) return this.LOUD.reload;
    return 0.08;
  },

  /* 采样实际有多响（整段的 RMS） */
  _measure(buf) {
    let sum = 0, n = 0;
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < d.length; i++) { sum += d[i] * d[i]; n++; }
    }
    return Math.sqrt(sum / Math.max(1, n));
  },

  /* 收一段解码好的采样：顺手把"要播多响"算出来。
     上限 3 倍，免得某段特别安静的环境音被拉出底噪。 */
  _addSample(id, buf) {
    this.samples[id] = buf;
    const rms = this._measure(buf);
    const gain = rms > 1e-5 ? this._targetFor(id) / rms : 0.4;
    this.gainOf[id] = U.clamp(gain, 0.15, 3);
    return buf;
  },

  /* 解码采样。任何一条失败都不影响其它，也不影响合成音。 */
  load() {
    if (this.loading || !this.ctx) return this.loading;
    const decode = async (id, dataUri) => {
      const raw = atob(String(dataUri).split(',')[1] || '');
      const bin = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bin[i] = raw.charCodeAt(i);
      this._addSample(id, await this.ctx.decodeAudioData(bin.buffer));
    };
    const injected = (typeof window !== 'undefined' && window.__AUDIO__) || null;
    this.loading = (async () => {
      let n = 0;
      if (injected) {
        for (const id of Object.keys(injected)) {
          try { await decode(id, injected[id]); n++; } catch (e) {}
        }
      } else {
        /* 多文件版：http 下能读到就加载；file:// 被 CORS 挡住时静默跳过 */
        try {
          const man = await fetch('assets/audio/manifest.json').then(r => r.json());
          for (const a of man.assets || []) {
            try {
              const buf = await fetch('assets/audio/' + a.file).then(r => r.arrayBuffer());
              this._addSample(a.id, await this.ctx.decodeAudioData(buf)); n++;
            } catch (e) {}
          }
        } catch (e) {}
      }
      return n;
    })();
    return this.loading;
  },

  _playSample(id, opts) {
    const buf = this.samples[id];
    if (!buf) return false;
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = buf;
    /* 音高微扰：同一段素材连播会听出"复读机"，±6% 就能散开 */
    if (opts && opts.rate) s.playbackRate.value = opts.rate;
    const g = c.createGain();
    /* 基准增益来自解码时的响度对齐；vol 只做场合性的微调（潜行脚步、落步） */
    const base = this.gainOf[id] != null ? this.gainOf[id] : 0.4;
    g.gain.value = base * ((opts && opts.vol != null) ? opts.vol : 1);
    s.connect(g); g.connect(this.master || c.destination);
    this._autoFree(s, [g]);
    s.start(c.currentTime);
    return true;
  },

  _playSeq(name, seq) {
    this.stopSeq(name);
    const timers = [];
    for (const [id, at] of seq) {
      if (at <= 0) this._playSample(id);
      else timers.push(setTimeout(() => this._playSample(id), at * 1000));
    }
    this.seqTimers[name] = timers;
  },

  /* 换弹被打断时要掐掉还没播的那几段 */
  stopSeq(name) {
    const timers = this.seqTimers[name];
    if (!timers) return;
    for (const t of timers) clearTimeout(t);
    delete this.seqTimers[name];
  },

  /* 用完必须把节点从图里摘掉。stop() 只是停止发声，节点还挂在 destination 上，
     连打一分钟就是几百个残留节点，音频线程会越来越重——表现为"玩久了就卡"。 */
  _autoFree(src, chain) {
    src.onended = () => {
      try { src.disconnect(); } catch (e) {}
      for (const nd of chain) { try { nd.disconnect(); } catch (e) {} }
    };
  },

  /* ---------------- 合成音零件 ----------------
     每个零件都是"滤波器 + 包络 + 自动摘节点"这一套，差别只在参数。
     t 是绝对起音时刻，out 是这条声音的总线，所有层都汇到那里。 */
  _noise(opts) {
    const c = this.ctx, t = opts.t, dur = opts.dur;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    s.playbackRate.value = opts.rate || 1;
    const f = c.createBiquadFilter();
    f.type = opts.type || 'lowpass';
    f.Q.value = opts.q || 1;
    f.frequency.setValueAtTime(opts.freq, t);
    if (opts.to) f.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.gain), t + (opts.attack || 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(opts.out);
    this._autoFree(s, [f, g]);
    /* 从噪声里随机位置读：连打几十发也不会一模一样。
       给了种子（试听/导出用）就走固定序列，同一组参数能复现同一段波形。 */
    s.start(t, this._rand() * Math.max(0, 0.9 - dur), dur + 0.02);
  },

  _tone(opts) {
    const c = this.ctx, t = opts.t, dur = opts.dur;
    const o = c.createOscillator();
    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(Math.max(1, opts.from), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.gain), t + (opts.attack || 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(opts.out);
    this._autoFree(o, [g]);
    o.start(t); o.stop(t + dur + 0.02);
  },

  /* 软削波曲线：把尖头压圆，枪声才像"炸"而不是"滋" */
  _clipCurve() {
    if (this._curve) return this._curve;
    const n = 1024, curve = new Float32Array(n), k = 2.2;
    for (let i = 0; i < n; i++) {
      const x = i * 2 / (n - 1) - 1;
      curve[i] = 0.95 * Math.tanh(x * k) / Math.tanh(k);
    }
    return (this._curve = curve);
  },

  /* 固定随机种子：同一个种子 + 同一组参数 = 逐采样一致的波形，
     试听对比和导出都靠它。传 null 恢复成游戏的随机抖动。 */
  setSeed(seed) {
    this.seed = (seed == null ? null : (seed >>> 0));
    this._rng = this.seed == null ? null : this._makeRng(this.seed);
    return this.seed;
  },

  /* mulberry32：短、够用、同种子同序列 */
  _makeRng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  _rand() { return this._rng ? this._rng() : Math.random(); },

  /* 开火：五层叠一次，参数全部来自 GUN 表。
     crack 脆响 → body 爆裂 → sub 冲击 → tail 尾音 → mech 枪机。

     opts.layers   只合成列出的层（单听 / 任意组合听），不传就是全部
     opts.layerVol 单层音量乘子，用来把某一层单独拉响，只听音色不比音量
     实际合成的层、各自的增益、后级处理都记进 lastShot，
     这样"听起来不一样"到底是参数差异还是音量差异，可以直接查。 */
  _shot(prof, opts, gunId) {
    const c = this.ctx, t = c.currentTime + 0.002, o = opts || {};
    const only = o.layers ? new Set(o.layers) : null;
    const lv = o.layerVol || null;
    const on = name => !only || only.has(name);

    const out = c.createGain();
    const vol = (prof.vol || 1) * (o.vol != null ? o.vol : 1) * this.CAL.shot;
    out.gain.value = vol;

    /* 后级：先过削波（要的就是"炸"），再按需低通（敌人的枪声隔着一段距离） */
    const extra = [out];
    let tail = out;
    if (prof.drive && c.createWaveShaper) {
      const ws = c.createWaveShaper();
      ws.curve = this._clipCurve();
      ws.oversample = '2x';
      tail.connect(ws); tail = ws; extra.push(ws);
    }
    if (o.lp) {
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = o.lp;
      tail.connect(lp); tail = lp; extra.push(lp);
    }
    tail.connect(this.master || c.destination);
    /* 这些节点没有音源可以挂 onended，只能过一会儿自己摘 */
    setTimeout(() => { for (const nd of extra) { try { nd.disconnect(); } catch (e) {} } }, 1600);

    /* 每发都有 ±4% 的音高和 ±6% 的音量抖动，连射才不会像循环播放 */
    const rate = (o.rate || 1) * (0.96 + this._rand() * 0.08);
    const P = prof;
    const made = [];
    /* 单层音量乘子：不放大的话，尾音这种层单独听几乎听不见 */
    const amt = (name, g) => (lv && lv[name] != null ? g * lv[name] : g);

    if (P.crack && on('crack')) {
      const g = amt('crack', P.crack.gain);
      this._noise({
        t, out, rate, attack: 0.001, dur: P.crack.dur, type: P.crack.type || 'highpass',
        freq: P.crack.freq, q: P.crack.q, gain: g
      });
      /* 3ms 的主瞬态之后可以挂一段很弱的噪声残余：
         纯 3ms 是"咔"，加上残余才像空气被推开之后还没散干净 */
      if (P.crack.resid) {
        const r = amt('crack', P.crack.resid.gain);
        this._noise({
          t: t + (P.crack.resid.at || 0), out, rate, attack: 0.002,
          dur: P.crack.resid.dur, type: P.crack.resid.type || 'highpass',
          freq: P.crack.resid.freq, q: P.crack.resid.q || 0.8, gain: r
        });
      }
      made.push({ name: 'crack', at: 0, dur: P.crack.dur, gain: g,
        filter: (P.crack.type || 'highpass') + ' ' + P.crack.freq + 'Hz' +
          (P.crack.resid ? ' + 残余 ' + Math.round(P.crack.resid.dur * 1000) + 'ms@' +
            P.crack.resid.gain.toFixed(2) : '') });
    }
    if (P.body && on('body')) {
      const g = amt('body', P.body.gain);
      this._noise({
        t, out, rate, attack: P.body.attack || 0.002, dur: P.body.dur,
        type: P.body.type || 'lowpass',
        freq: P.body.from, to: P.body.to, q: P.body.q || 0.9, gain: g
      });
      made.push({ name: 'body', at: 0, dur: P.body.dur, gain: g,
        filter: (P.body.type || 'lowpass') + ' ' + P.body.from + '→' + P.body.to + 'Hz' });
    }
    if (P.sub && on('sub')) {
      const g = amt('sub', P.sub.gain);
      this._tone({
        t, out, attack: 0.004, dur: P.sub.dur, type: 'sine',
        from: P.sub.from * rate, to: P.sub.to, gain: g
      });
      made.push({ name: 'sub', at: 0, dur: P.sub.dur, gain: g,
        filter: 'sine ' + P.sub.from + '→' + P.sub.to + 'Hz' });
    }
    if (P.tail && on('tail')) {
      const g = amt('tail', P.tail.gain);
      this._noise({
        t: t + P.tail.at, out, rate, attack: 0.01, dur: P.tail.dur, type: 'lowpass',
        freq: P.tail.freq, q: 0.7, gain: g
      });
      made.push({ name: 'tail', at: P.tail.at, dur: P.tail.dur, gain: g,
        filter: 'lowpass ' + P.tail.freq + 'Hz' });
    }
    if (P.mech && on('mech')) {
      const g = amt('mech', P.mech.gain);
      this._noise({
        t: t + P.mech.at, out, rate, attack: 0.001, dur: P.mech.dur, type: 'bandpass',
        freq: P.mech.freq, q: P.mech.q || 4, gain: g
      });
      made.push({ name: 'mech', at: P.mech.at, dur: P.mech.dur, gain: g,
        filter: 'bandpass ' + P.mech.freq + 'Hz Q' + (P.mech.q || 4) });
    }

    this.lastShot = {
      gun: gunId || null,
      layers: made,
      omitted: this.SHOT_LAYERS.filter(n => !made.some(m => m.name === n)),
      vol, cal: this.CAL.shot, profileVol: prof.vol || 1,
      drive: prof.drive || 0, lp: o.lp || 0, rate,
      seed: this.seed,
      chain: (prof.drive ? 'tanh软削波' : '直通') + (o.lp ? ' → 低通 ' + o.lp + 'Hz' : '') + ' → 导出/试听为干声'
        + '（游戏内还会再过一层总线压缩）'
    };
    return this.lastShot;
  },

  /* 离线渲染一次开火，返回 AudioBuffer。
     口径和响度体检一致：不含最终总线压缩器（压缩器会随同时发声的数量变化，
     放进导出里就没法逐采样对比了）。种子固定时两次渲染完全一致。 */
  async renderShot(gunId, opts, seconds) {
    const o = Object.assign({}, opts || {});
    const rate = o.sampleRate || 44100;
    const dur = seconds || 0.9;
    if (this.seed != null) this._rng = this._makeRng(this.seed);
    const off = new OfflineAudioContext(1, Math.round(rate * dur), rate);
    const old = { ctx: this.ctx, master: this.master, noise: this.noiseBuf, rng: this._rng };
    this.ctx = off;
    this.master = off.destination;
    const nb = off.createBuffer(1, off.sampleRate, off.sampleRate);
    const d = nb.getChannelData(0);
    /* 噪声底噪也走同一个随机源，否则同种子两次导出的噪声段不一样 */
    for (let i = 0; i < d.length; i++) d[i] = this._rand() * 2 - 1;
    this.noiseBuf = nb;
    try {
      /* opts.profile 可以整份替换枪型参数（诊断用的 A/B/C 变体就这么走），
         不传就用 GUN 表里的原参数 */
      this._shot(o.profile || this.GUN[gunId] || this.GUN.rifle, o, gunId);
    } finally {
      this.ctx = old.ctx;
      this.master = old.master;
      this.noiseBuf = old.noise;
      this._rng = old.rng;
    }
    return off.startRendering();
  },

  /* AudioBuffer → 16bit 单声道 WAV。from/to 是采样下标，用来裁掉尾部静音 */
  toWav(buf, from, to) {
    const a = Math.max(0, from || 0);
    const b = Math.min(buf.length, to == null ? buf.length : to);
    const len = Math.max(0, b - a), rate = buf.sampleRate;
    const data = buf.getChannelData(0);
    const out = new DataView(new ArrayBuffer(44 + len * 2));
    const str = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); out.setUint32(4, 36 + len * 2, true); str(8, 'WAVE');
    str(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true);
    out.setUint16(22, 1, true); out.setUint32(24, rate, true);
    out.setUint32(28, rate * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true);
    str(36, 'data'); out.setUint32(40, len * 2, true);
    for (let i = 0; i < len; i++) {
      const v = Math.max(-1, Math.min(1, data[a + i]));
      out.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7FFF, true);
    }
    return out.buffer;
  },

  play(name, opts) {
    if (!this.on || !this.ctx) return;
    /* 有采样就优先用采样；没有（或解码失败）就落到下面的合成音 */
    if (this.samples[name]) { this._playSample(name, opts); return; }
    const seq = this.SEQ[name];
    if (seq && this.samples[seq[0][0]]) { this._playSeq(name, seq); return; }

    /* 某把枪的专属采样没加载上（旧浏览器 / 文件缺失）时退回通用切枪声，
       别让换枪变成哑的 */
    if (/^shot_switch_/.test(name) && !this.samples[name]) return this.play('shot_switch', opts);

    /* 枪声按枪型分支：四把枪各有各的音色，不再是同一个"啪" */
    if (name === 'shot') {
      const gun = this.GUN[(opts && opts.gun) || 'rifle'] || this.GUN.rifle;
      return this._shot(gun, opts, (opts && opts.gun) || 'rifle');
    }
    /* 敌人的枪声：同一套音色压低 + 闷掉高频，听得出是别人在打 */
    if (name === 'enemyShot') return this._shot(this.GUN.pistol, { vol: 0.42, lp: 1300 }, 'pistol');

    const c = this.ctx, t = c.currentTime;
    /* 一条总线收所有层：音量标准在这一处乘完，下面只管音色 */
    const out = c.createGain();
    out.gain.value = (this.CAL[name] != null ? this.CAL[name] : 1) * ((opts && opts.vol) || 1);
    out.connect(this.master || c.destination);
    setTimeout(() => { try { out.disconnect(); } catch (e) {} }, 2000);

    const hit = (dur, freq, gain, type) => this._noise({ t, out, dur, freq, gain, type });
    const tone = (dur, f0, f1, gain, type) => this._tone({ t, out, dur, from: f0, to: f1, gain, type });

    switch (name) {
      case 'hit':
        hit(0.06, 2600, 0.50, 'highpass');
        break;
      case 'headshot':
        // 爆头：高频脆响 + 一点下沉，和普通命中区分开
        hit(0.045, 4200, 0.55, 'highpass');
        tone(0.12, 900, 320, 0.30, 'triangle');
        break;
      case 'break':
        // 护甲破裂：闷响 + 金属裂开
        hit(0.20, 700, 0.50);
        tone(0.10, 300, 120, 0.30, 'square');
        break;
      case 'reload':
        // 没有采样时的兜底（正常走三段序列）
        hit(0.08, 900, 0.40);
        tone(0.06, 420, 220, 0.25, 'square');
        break;
      case 'melee':
        // 挥刀：风声从高扫到低，不是"嗡"的一声
        this._noise({ t, out, dur: 0.16, type: 'bandpass', freq: 1200, to: 350, q: 1.4, gain: 0.50 });
        tone(0.12, 220, 70, 0.20, 'sawtooth');
        break;
      case 'dodge':
        // 闪避：短促的破风声，比挥刀更干、更短，收在 0.18 秒内
        this._noise({ t, out, dur: 0.18, type: 'bandpass', freq: 600, to: 2600, q: 1.1, gain: 0.45, attack: 0.02 });
        tone(0.09, 130, 70, 0.18, 'sine');
        break;
      case 'door':
        hit(0.16, 420, 0.50);
        break;
      case 'pickup':
        tone(0.07, 660, 900, 0.35, 'sine');
        break;
      case 'search':
        hit(0.22, 620, 0.30);
        break;
      case 'drop':
        // 丢东西：一声闷响，别太响，丢东西本来就该低调
        hit(0.12, 380, 0.40);
        break;
      case 'hurt':
        tone(0.16, 180, 90, 0.30, 'sawtooth');
        break;
      case 'extract':
        tone(0.5, 320, 640, 0.25, 'sine');
        break;
      case 'death':
        tone(0.8, 200, 40, 0.30, 'sawtooth');
        break;
    }
  }
};
