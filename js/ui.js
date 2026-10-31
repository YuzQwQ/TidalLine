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
