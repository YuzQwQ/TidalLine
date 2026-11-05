/* ============================================================
   藏身处与出击：仓库、背包搬运、配装、商人、地图选择
   ============================================================ */

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
    Save.normalizeSafe();
    this.ensureSidearm();     // 不自动补发死亡损失
    this.render();
    /* 大厅 BGM：进藏身处就起，离开时由 close()/startRun 淡出 */
    if (typeof Music !== 'undefined') Music.play('base');
  },

  close() {
    AmmoPurchase.close();
    this.picker = null;
    this._anchor = null;
    document.getElementById('baseVeil').classList.add('hidden');
    /* 这里不停音乐：close() 只是去选图页，那还在局外。
       真正进图由 Game.startRun() 掐掉。 */
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

    this.renderHealth();
    this.renderGear();
    this.renderPicker();
    this.renderBag();
    this.renderTabs();
    this.renderFilter();
    this.renderStash();
  },

  /* ---- 装备槽的读写：'w0'/'w1'/'w2' 走武器位，'helmet'/'body' 走护甲，'back' 是背包 ---- */
  slotKind(key) {
    if (key === 'back') return 'bag';
    return (key && key[0] === 'w') ? 'gun' : 'armor';
  },
  slotIdx(key) { return parseInt(String(key).slice(1), 10) || 0; },
  slotLabel(key) {
    if (key === 'helmet') return '头盔';
    if (key === 'body') return '护甲';
    if (key === 'back') return '背包';
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

  /* 槽里存的是运行时对象（护甲是 GEAR 实例、背包只有 id），详情窗要的是物品字段，
     这里统一转成"伪物品"。枪和近战本身就是伪物品，原样返回。 */
  gearItem(key) {
    const cur = this.getEquip(key);
    if (!cur) return null;
    const kind = this.slotKind(key);
    if (kind === 'bag') return EQUIP.bag(cur.id) || cur;
    if (kind === 'armor') return EQUIP.armor(cur) || cur;
    return cur;
  },

  /* 外部模块往菜单 / 详情里追加动作（改装、退弹…）。核心手势不依赖它们，
     没接就是空数组 —— 和局内 Game.extraActsFor 同一套写法。 */
  extraActsFor(entry, where, node, key) { return []; },
  extraGearActs(key, item) { return []; },

  /* ---- 装备：3 个武器位 + 头盔 / 护甲 / 背包 ---- */
  /* ---------------- 备战页的健康状态 ----------------
     血量 + 一个状态词。局内损伤（流血 / 重伤 / 骨折等）不跨局保留，
     战局结束时已清空，所以备战页恒显示「无异常状态」；下面 .lh-debuff 的
     渲染结构保留给未来真正需要跨局的状态。 */
  healthState() {
    const max = CFG.P.HP;
    const ratio = Save.hp / max;
    if (ratio >= 0.999) return { key: 'ok', label: '健康', tone: 'ok', note: '没有可见的伤势。' };
    if (ratio >= 0.7) return { key: 'light', label: '轻伤', tone: 'warn', note: '行动不受影响，但别再硬吃几发。' };
    if (ratio >= 0.4) return { key: 'heavy', label: '重伤', tone: 'bad', note: '再挨一下就危险了，建议先处理。' };
    return { key: 'critical', label: '濒危', tone: 'bad', note: '随时可能倒下。' };
  },

  /* 卡片的 DOM 只建一次，之后只更新内容：每次 render() 都重建会打断 CSS 过渡 */
  renderHealth() {
    const pane = document.getElementById('paneGear');
    if (!pane) return;
    let box = document.getElementById('loadoutHealth');
    if (!box) {
      box = document.createElement('section');
      box.id = 'loadoutHealth';
      box.className = 'loadout-health';
      pane.insertBefore(box, pane.firstChild);
    }
    const max = CFG.P.HP;
    const hp = Math.round(Save.hp * 10) / 10;
    const st = this.healthState();
    const pct = U.clamp(Save.hp / max * 100, 0, 100);
    /* 局内状态不写 Save.debuffs；这里读的是给未来跨局状态预留的位置 */
    const debuffs = (Save.debuffs || []).filter(Boolean)
      .map(d => (typeof d === 'string' ? d : (d.label || d.name || d.id)));
    const chips = debuffs.length
      ? debuffs.map(d => '<span class="lh-debuff">' + esc(d) + '</span>').join('')
      : '<span class="lh-debuff none">无异常状态</span>';
    const full = Save.hp >= max - 1e-6;

    box.className = 'loadout-health tone-' + st.tone;
    box.innerHTML =
      '<div class="lh-head"><h3>健康状态</h3><span class="lh-state">' + st.label + '</span></div>' +
      '<div class="lh-hp"><b>' + hp + '</b><small>/ ' + max + ' HP</small></div>' +
      '<div class="lh-bar"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
      '<p class="lh-note">' + esc(st.note) + '</p>' +
      '<div class="lh-debuffs">' + chips + '</div>' +
      '<button type="button" class="lh-treat"' + (full ? ' disabled' : '') + '>' +
        (full ? '生命值已满' : '快速治疗') + '</button>';

    const btn = box.querySelector('.lh-treat');
    if (btn && !full) btn.onclick = () => Clinic.open();
  },

  renderGear() {
    const el = document.getElementById('baseGear');
    if (!el) return;
    el.innerHTML = '';
    const G = Save.gear;

    for (let i = 0; i < 3; i++) {
      const key = 'w' + i;
      const it = G.weapons[i];                  // 伪物品（EQUIP.gun）
      const w = it ? Attachments.resolve(it.equip.gun,it.equip.attachments) : null;
      const ammo = it ? (it.equip.mag | 0) : 0;
      const own = this.stashEquip(key).length;
      const act = this.picker === key
        ? '<b class="price">↓ 正在挑选</b>'
        : (own ? '点击从仓库挑选（' + own + ' 把）'
               : '点击挑选 · 仓库里没有');

      const row = document.createElement('div');
      row.className = 'slot' + (w ? '' : ' empty') + (this.picker === key ? ' open' : '');
      row.innerHTML =
        '<div class="slot-ico">' + Icons.gearIcon(w ? w.id : null, i < 2 ? '主' : '副') + '</div>' +
        '<div class="slot-txt"><b>' + (w ? w.name : '空') + '</b><span>' +
          (w ? w.dmgMin + '–' + w.dmgMax + ' 伤害 · 弹匣 ' + ammo + '/' + w.mag + ' · ' : '') +
          act +
        '</span></div>';
      row.onclick = () => this.togglePicker(key, row);
      this.bindGearMenu(row, key);
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
        '<div class="slot-ico">' + Icons.gearIcon(GEAR.icon(g), GEAR[type].short) + '</div>' +
        '<div class="slot-txt"><b>' + (g ? g.name + ' Lv' + g.lv : '未装备' + GEAR[type].label) + '</b><span>' +
          (g ? '防护 Lv' + g.lv + ' · 耐久 ' +
               Math.ceil(g.dur) + '/' + g.max + ' · ' : '') +
          act +
        '</span></div>';
      row.onclick = () => this.togglePicker(type, row);
      this.bindGearMenu(row, type);
      el.appendChild(row);
    }

    /* 背包：独立槽位。空间只由它决定，所以这里显示当前容量 */
    {
      const bag = G.back;
      const own = this.stashEquip('back').length;
      const act = this.picker === 'back'
        ? '<b class="price">↓ 正在挑选</b>'
        : (own ? '点击从仓库挑选（' + own + ' 个）' : '点击挑选 · 仓库里没有');
      const row = document.createElement('div');
      row.className = 'slot' + (bag ? '' : ' empty') + (this.picker === 'back' ? ' open' : '');
      row.innerHTML =
        '<div class="slot-ico">' + Icons.gearIcon(bag ? bag.id : 'bag', '包') + '</div>' +
        '<div class="slot-txt"><b>' + (bag ? bag.name : '未装备背包 · 基础 ' + BASE_BAG_SLOTS + ' 格') + '</b><span>' +
          (bag ? '容量 ' + bag.slots + ' 格 · ' + bag.w.toFixed(1) + 'kg · ' : '') +
          act +
        '</span></div>';
      row.onclick = () => this.togglePicker('back', row);
      this.bindGearMenu(row, 'back');
      el.appendChild(row);
    }
  },

  /* 装备槽右键：详情 + 卸下，改装这类能力由模块往 extraGearActs 里追加。
     左键仍然是「点开挑一件」—— 换装是这里最高频的动作，别抢它的左键。 */
  bindGearMenu(row, key) {
    if (!row) return;
    row.oncontextmenu = ev => {
      const item = this.gearItem(key);
      if (!item) return;                     // 空槽没有可看的东西
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
      const entries = [
        { label: '详情', onClick: () => this.showItem(item, 'gear', row, key) },
        { label: '卸下', onClick: () => this.unequip(key) }
      ];
      if (item.equip?.kind === 'gun')
        entries.push({ label: '退弹', onClick: () => this.unloadGun(item) });
      for (const a of this.extraGearActs(key, item)) entries.push(a);
      Ctx.show((ev && ev.clientX) || 0, (ev && ev.clientY) || 0, entries);
    };
  },

  /* ---- 装备槽：点开一个列表，从仓库里挑一件 ----
     武器位和护甲位共用这一套：list 只列同类的东西，点一件就换上，旧的回仓库。 */

  /* 仓库里能放进这一位的装备 */
  stashEquip(key) {
    if (this.slotKind(key) === 'bag') return this.stashBags();
    if (this.slotKind(key) === 'gun') {
      const want = this.slotIdx(key) < 2 ? 'primary' : 'secondary';
      return Save.stash.filter(e => {
        const it = stashItem(e);
        if (!it || !it.equip || it.equip.kind !== 'gun') return false;
        const def = Attachments.resolve(it.equip.gun,it.equip.attachments);
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

  /* 仓库里能放进背包槽的东西：按容量从大到小 */
  stashBags() {
    return Save.stash.filter(e => {
      const it = stashItem(e);
      return it && it.equip && it.equip.kind === 'bag';
    }).sort((a, b) => stashItem(b).equip.slots - stashItem(a).equip.slots);
  },

  /* 老名字还留着，测试和别处都按这个找护甲 */
  stashArmor(type) { return this.stashEquip(type); },

  /* 所有装备槽均允许卸下 */
  canUnequip(key) { return true; },

  /* 允许空副武器槽 —— 没有手枪就发一把，保证永远能空手不进去 */
  ensureSidearm() {
    // Compatibility entry point: death losses must never generate a free replacement.
    return false;
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

    const kind = this.slotKind(key);
    const isGun = kind === 'gun';
    const isBag = kind === 'bag';
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
        fb: isGun ? '空' : (isBag ? '包' : GEAR[key].short),
        name: isGun ? '不装' : (isBag ? '不背' : '不穿'),
        sub: '把 ' + cur.name + ' 放回仓库' +
             (isBag ? '（容量回到 ' + BASE_BAG_SLOTS + ' 格）' : ''),
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
            : isBag
              ? '仓库里没有' + label + '。<br>顶部<b>护甲商人</b>那儿有前三个档位，' +
                '更好的只在<b>军用物资箱</b>里出。'
              : '仓库里没有' + label + '。<br>顶部<b>护甲商人</b>那儿能买到崭新的一~三级，' +
                '更高级的只能从尸体上带回来。');
      box.appendChild(empty);
    } else {
      for (const e of list) {
        const it = stashItem(e);
        if (isGun) {
          const def = Attachments.resolve(it.equip.gun,it.equip.attachments);
          const ammo = it.equip.mag | 0;
          box.appendChild(this.pickerRow({
            icon: it.icon, fb: def.short,
            name: def.name,
            sub: BALLISTICS.caliber(def.caliber).short + ' · ' + def.dmgMin + '–' + def.dmgMax + ' 伤害 · 弹匣 ' + ammo + '/' + def.mag +
                 ' · ' + def.rpm + ' 发/分',
            click: () => this.equipFromStash(e, key)
          }));
        } else if (isBag) {
          const slots = it.equip.slots;
          const over = Save.bag.length > slots;
          box.appendChild(this.pickerRow({
            icon: it.icon, fb: it.short,
            name: it.name,
            sub: '容量 ' + slots + ' 格 · ' + it.w.toFixed(1) + 'kg' +
                 (over ? ' · <span class="worn">当前 ' + Save.bag.length + ' 件放不下</span>' : ''),
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

  /* 装上仓库里那一件（枪 / 甲 / 背包）；身上原有的落回仓库，不会消失。
     武器位存 EQUIP.gun 伪物品（带余弹），护甲位存护甲实例，背包位存背包实例。 */
  equipFromStash(entry, key) {
    if (!Save.stash.includes(entry)) return false;
    const it = stashItem(entry);
    if (!it || !it.equip) return false;
    const kind = this.slotKind(key);
    const cur = this.getEquip(key);
    let next, name, verb;

    if (kind === 'gun') {
      const def = Attachments.resolve(it.equip.gun,it.equip.attachments);
      if (!def) return false;
      const want = this.slotIdx(key) < 2 ? 'primary' : 'secondary';
      if (def.slot !== want) return false;                 // 类型不对，别硬塞
      next = EQUIP.gun(it.equip.gun, it.equip.mag | 0, it.equip.ammo, it.equip.rounds,it.equip);
      name = def.name; verb = '装上 ';
    } else if (kind === 'bag') {
      if (it.equip.kind !== 'bag') return false;
      const bag = BACKPACK.make(it.equip.bag);
      if (!bag) return false;
      /* 换更小的包：已经带在身上的东西装不下就不让换 */
      if (Save.bag.length > bag.slots) {
        this.note('背包空间不足，无法装备该背包。', true);
        this.closePicker();
        return false;
      }
      next = bag; name = bag.name; verb = '背上 ';
    } else {
      const g = it.equip.gear;
      if (!g || it.equip.kind !== 'armor') return false;
      next = GEAR.make(key, g.id || g.lv, g.dur);                   // 拷一份，仓库那件要移除
      name = g.name; verb = '穿上 ';
    }

    Save.stash = Save.stash.filter(x => x !== entry);
    if (cur) Save.addGearStash(kind === 'gun' ? cur : kind === 'bag' ? EQUIP.bag(cur.id) : EQUIP.armor(cur));
    this.setEquip(key, next);
    Save.save();

    this.closePicker();
    this.render();
    this.note(verb + name + (cur ? '，' + cur.name + ' 放回仓库' : ''));
    this.gearVoice(key, false);
    return true;
  },

  /* 卸下：优先回仓库；仓库满了就塞进背包；两边都放不下才拒绝。
     不是销毁 —— 装备永远是玩家的东西，只是换个地方待着。 */
  unequip(key) {
    if (!this.canUnequip(key)) {
      this.note('副武器必须带一把手枪 —— 空手进去没法打', true);
      this.closePicker();
      return false;
    }
    const cur = this.getEquip(key);
    if (!cur) { this.closePicker(); return; }
    const kind = this.slotKind(key);
    /* 卸背包等于容量掉回 4 格，带的东西放不下就得先清 */
    if (kind === 'bag' && Save.bag.length > BASE_BAG_SLOTS) {
      this.note('背包里还有东西：先清到 ' + BASE_BAG_SLOTS + ' 格以内再卸背包。', true);
      this.closePicker();
      return false;
    }
    const entry = this.gearItem(key);
    const name = cur.name || (entry && entry.name) || '这件装备';

    if (Save.stash.length < STASH_SLOTS) {
      Save.addGearStash(entry);
      this.setEquip(key, null);
      Save.save();
      this.closePicker(); this.render();
      this.note('卸下 ' + name + '，已放回仓库');
      this.gearVoice(key, true);
      return true;
    }
    /* 仓库满了：背包兜底，别让「满了」变成「卸不下来」 */
    const why = this.bagBlock(entry, 1);
    if (why) {
      this.note('仓库和背包都放不下（' + why + '），先清理再卸下', true);
      this.closePicker();
      return false;
    }
    Save.addGearBag(entry);
    this.setEquip(key, null);
    Save.save();
    this.closePicker(); this.render();
    this.note('仓库已满，卸下的 ' + name + ' 放进了背包', false);
    this.gearVoice(key, true);
    return true;
  },

  /* 装备成功使用对应材质／切枪声，卸下回仓库统一使用拾取声。 */
  gearVoice(key, off) {
    if (off) { Game.sfx('pickup'); return; }
    const kind=this.slotKind(key);
    if(kind==='gun'){const it=this.getEquip(key),w=it&&WEAPONS[it.equip.gun];if(w)Game.sfx(SWITCH_MODEL[w.id]||SWITCH_SFX[w.category]||'shot_switch');return;}
    if(kind==='melee'){Game.sfx('shot_switch',{rate:0.86});return;}
    if(typeof SFX!=='undefined'&&SFX.gear)SFX.gear(key);
  },

  /* ---- 护甲商人：只卖崭新的一~三级 ---- */
  SHOP_MAX_LV: 3,

  renderTabs() {
    const el = document.getElementById('baseTabs');
    if (!el) return;
    const shop = ['shop','gun','doctor','viktor','elena'].includes(this.tab);
    if (!el.dataset.built) {
      const opts = [['stash', '仓库'], ['shop', '护甲商人'], ['gun', '军火商'], ['doctor', '医生'], ['viktor', '贸易商']];
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

    if (this.tab === 'elena') return;
    if (this.tab === 'viktor') return TradeMerchant.render(el);
    if (this.tab === 'doctor') return this.renderDoctor(el);
    if (this.tab === 'gun') return this.renderGunShop(el);

    const note = document.getElementById('shopNote');
    if (note) {
      note.innerHTML = '当前公开货架：<b>全新一至三级</b>防护装备。高级防护与背包供应预留后续合作渠道，尚未开放。';
    }
    const hint = document.getElementById('shopHint');
    if (hint) hint.textContent = '买下的东西直接进右边的仓库';

    for (const type of ['helmet', 'body']) {
      for (const d of GEAR[type].list.filter(x=>x.lv<=this.SHOP_MAX_LV)) {
        const lv=d.lv;
        if (!d) continue;
        const cell = document.createElement('div');
        cell.className = 'scell r' + gearRarity(lv);
        cell.dataset.offer = JSON.stringify({kind:'armor',type,lv,id:d.id});
        const ico = Icons.gear[d.id]
          ? '<img src="' + Icons.gear[d.id].src + '" alt="">'
          : '<span class="gl">' + esc(GEAR[type].short) + '</span>';
        cell.innerHTML = ico +
          '<span class="cn">' + esc(d.short || d.name) + '</span>' +
          '<span class="pr">' + formatMoney(d.price) + '</span>';
        cell.title = d.name + ' · 防护 Lv' + lv +
          ' · 耐久 ' + d.dur + ' · ' + d.w + 'kg · 右键看详情';
        cell.onclick = () => this.askBuy(type, d.id, cell);
        cell.oncontextmenu = (ev) => {
          ev.preventDefault();
          Tips.show(EQUIP.armor(GEAR.make(type, d.id)), cell.getBoundingClientRect(), '左键买下');
        };
        el.appendChild(cell);
      }
    }

    /* 背包：只出前三档。20 / 24 格那两只要下军用物资箱，商人弄不到 */
    const bt = document.createElement('div');
    bt.className = 'shop-cat';
    bt.textContent = '背包（容量 ' + BAGS.filter(d => d.r <= this.SHOP_BAG_MAX_R).map(d => d.slots).join(' / ') + ' 格）';
    el.appendChild(bt);

    for (const d of BAGS) {
      if (d.r > this.SHOP_BAG_MAX_R) continue;
      const item = EQUIP.bag(d.id);
      const cell = document.createElement('div');
      cell.className = 'scell r' + d.r;
      cell.dataset.offer = JSON.stringify({kind:'bag',id:d.id});
      const ico = Icons.gear[d.id]
        ? '<img src="' + Icons.gear[d.id].src + '" alt="">'
        : '<span class="gl">包</span>';
      cell.innerHTML = ico +
        '<span class="cn">' + esc(d.short) + '</span>' +
        '<span class="pr">' + formatMoney(d.price) + '</span>';
      cell.title = d.name + ' · 容量 ' + d.slots + ' 格 · ' + d.w + 'kg · 右键看详情';
      cell.onclick = () => this.askBuyBag(d.id, cell);
      cell.oncontextmenu = (ev) => {
        ev.preventDefault();
        Tips.show(item, cell.getBoundingClientRect(), '左键买下');
      };
      el.appendChild(cell);
    }
  },

  /* 护甲商人最多卖到这一档背包（白绿蓝），紫金靠搜 */
  SHOP_BAG_MAX_R: 3,

  askBuyBag(id, cell) {
    const d = BACKPACK.def(id);
    if (!d) return;
    Deal.show({
      kind: 'buy',
      title: '买入',
      name: d.name,
      sub: '容量 ' + d.slots + ' 格 · ' + d.w + 'kg',
      icon: d.id,
      short: d.short,
      price: d.price,
      can: Save.credits >= d.price && Save.stash.length < STASH_SLOTS,
      onGo: () => this.buyBag(id)
    }, cell.getBoundingClientRect());
  },

  buyBag(id) {
    const d = BACKPACK.def(id);
    if (!d) return false;
    if (d.r > this.SHOP_BAG_MAX_R) return false;        // 商人进不到更高级的货
    if (Save.stash.length >= STASH_SLOTS) { this.note('仓库满了，先卖点东西', true); return false; }
    if (Save.credits < d.price) {
      this.note('买 ' + d.name + ' 还差 ' + formatMoney(d.price - Save.credits), true);
      return false;
    }
    Save.credits -= d.price;
    Save.addGearStash(EQUIP.bag(id));
    Save.save();
    Game.sfx('pickup');
    this.render();
    this.note('买下 ' + d.name + '（-' + formatMoney(d.price) + '），已入仓库，可在备战页背上');
    return true;
  },

  /* 军火商的货架：两个主武器 + 一个副武器，全是崭新的满弹匣；再往下是弹药柜 */
  renderGunShop(el) {
    const note = document.getElementById('shopNote');
    if (note) {
      note.innerHTML = '全新枪械，<b>满弹匣</b>出手。当前出售<b>一级、二级</b>弹药；' +
        '新增常规步枪有售；AN-94 与 AUG A1 需在探索中搜获。高阶弹药与紫色配件通过搜刮获得。';
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
        if (d.slot !== group || d.shopAvailable === false) continue;
        const item = EQUIP.gun(id, d.mag);          // 崭新：满弹匣
        const cell = document.createElement('div');
        cell.className = 'scell r' + item.r;
        cell.dataset.offer = JSON.stringify({kind:'gun',id});
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

  /* 弹药柜：六种口径 × 一~二级，按发购买，每次最多六组。
     三级以上没有渠道 —— 那才是下海一趟的理由。 */
  SHOP_AMMO_MAX_LV: 2,
  SHOP_AMMO_MAX_STACKS: 6,

  renderAmmoShop(el) {
    const title = document.createElement('div');
    title.className = 'shop-cat';
    title.textContent = '弹药（按发购买）';
    el.appendChild(title);

    for (const cal of Object.keys(CALIBERS)) {
      for (let lv = 1; lv <= this.SHOP_AMMO_MAX_LV; lv++) {
        const it = ammoItem(cal, lv);
        if (!it) continue;
        const cell = document.createElement('div');
        cell.className = 'scell r' + it.r;
        cell.dataset.offer = JSON.stringify({kind:'ammo',id:it.id});
        const ico = Icons.get(it.id)
          ? '<img src="' + Icons.get(it.id).src + '" alt="">'
          : '<span class="gl">Lv' + it.level + '</span>';
        cell.innerHTML = ico +
          '<span class="cn">' + esc(it.short) + '</span>' +
          '<span class="pr">' + formatMoney(it.price) + ' / 发</span>';
        cell.title = it.name + ' · 穿透 Lv' + it.penLevel + ' · 伤害系数 ×' + it.dmgMul.toFixed(2) +
          ' · 单次最多 ' + this.SHOP_AMMO_MAX_STACKS + ' 组（' + stackLimit(it)*this.SHOP_AMMO_MAX_STACKS + ' 发）';
        cell.onclick = () => this.askBuyAmmo(it.id);
        cell.oncontextmenu = (ev) => {
          ev.preventDefault();
          Tips.show(it, cell.getBoundingClientRect(), '选择弹药后，点击购买选择数量');
        };
        el.appendChild(cell);
      }
    }
  },

  askBuyAmmo(id) { return AmmoPurchase.open(id); },

  ammoQuote(id, quantity) {
    const item=ITEM_BY_ID[id];
    if(!item||item.cat!=='ammo'||item.level>this.SHOP_AMMO_MAX_LV)return {ok:false,reason:'该弹药暂不出售',total:0};
    const max=stackLimit(item)*this.SHOP_AMMO_MAX_STACKS;
    if(!Number.isInteger(quantity)||quantity<1||quantity>max)return {ok:false,item,max,total:0,reason:'请选择1–'+max+'发弹药'};
    const total=item.price*quantity;
    const reason=Save.credits<total?'信用点不足':!Save.canAddStash(id,quantity)?'仓库空间不足，无法放入这批弹药':'';
    return {ok:!reason,item,max,quantity,total,reason};
  },

  buyAmmo(id, pack) {
    const quote=this.ammoQuote(id,pack);
    if(!quote.ok){this.note(quote.reason,true);return false;}
    const it=quote.item,price=quote.total;
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
      (q.missing && Save.credits < q.total ? '信用点不足。' : '') + '局内损伤在战局结束时自动清除，局外不提供损伤清除。</p>';
    document.getElementById('btnDoctorTreat').onclick = ev => {
      const quote = Medical.quote();
      Deal.show({ kind:'buy', title:'治疗服务', name:'立即恢复至满血',
        dialogue:typeof MERCHANT_DIALOGUE!=='undefined'?MERCHANT_DIALOGUE.doctor.beforeTreatment[0]:'',
        sub:'恢复 ' + Math.round(quote.missing * 10) / 10 + ' HP · 药费 ' + formatMoney(quote.medicine) + ' + 服务费 ' + formatMoney(quote.service),
        price:quote.total, can:quote.missing > 0 && Save.credits >= quote.total,
        onGo:() => this.treat(quote.total) }, ev.currentTarget.getBoundingClientRect());
    };
    for (const [group, label] of Object.entries(MEDICAL_GROUPS)) {
      const title = document.createElement('div'); title.className = 'shop-cat'; title.textContent = label; el.appendChild(title);
      for (const item of MEDICAL_ITEMS.filter(i => i.medicalGroup === group && i.r <= 3)) {
        const cell = document.createElement('div'); cell.className = 'scell r' + item.r; cell.dataset.medical = item.id; cell.dataset.offer = JSON.stringify({kind:'medical',id:item.id});
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
      sub: '防护 Lv' + d.lv + ' · 耐久 ' + d.dur + (type==='body'?' · 瞄准时间 +'+d.aimPenaltyPct+'%':''),
      icon: d.id,
      short: d.short,
      price: d.price,
      can: Save.credits >= d.price && Save.stash.length < STASH_SLOTS,
      onGo: () => this.buyArmor(type, lv)
    }, cell.getBoundingClientRect());
  },

  askBuyGun(id, cell) {
    const d = WEAPONS[id];
    if (!d || d.shopAvailable === false) return;
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
    if (!d || d.shopAvailable === false) return false;
    if (Save.stash.length >= STASH_SLOTS) { this.note('仓库满了，先卖点东西', true); return false; }
    if (Save.credits < d.price) {
      this.note('买 ' + d.name + ' 还差 ' + formatMoney(d.price - Save.credits), true);
      return false;
    }
    Save.credits -= d.price;
    Save.addGearStash(EQUIP.gun(id, d.mag));      // 崭新：满弹匣
    Save.save();
    Game.sfx('pickup');
    this.render();
    this.note('买下 ' + d.name + '（-' + formatMoney(d.price) + '），已入仓库，可在备战页装备');
    return true;
  },

  buyArmor(type, lv) {
    const d = GEAR.def(type, lv);
    if (!d) return;
    if (d.lv > this.SHOP_MAX_LV) return;                 // 商人进不到更高级的货
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
    this.note('买下 ' + d.name + '（-' + formatMoney(d.price) + '），已入仓库，可在备战页装备');
  },

  /* ---- 背包：和局内背包同一套格子 UI ----
     这里不放"携带数量"了：想带什么就把什么放进背包，带多少就是包里的数量。
     弹药和药物回藏身处时留在包里（下一趟接着用），其它东西自动回仓库。 */
  /* 背包标题行：容量 + 「清空背包」按钮。
     DOM 只搭一次，之后复用 —— 每次 render() 重建会把按钮上的焦点和 hover 打断。
     按钮不写在 index.html 里，由这里插进去，和健康卡同一个路数。 */
  ensureBagHead() {
    const grid = document.getElementById('baseBagGrid');
    if (!grid) return null;
    let hd = document.getElementById('bagHead');
    if (hd) return hd;
    const h3 = grid.previousElementSibling;
    if (!h3 || h3.tagName !== 'H3') return null;
    hd = document.createElement('div');
    hd.id = 'bagHead';
    hd.className = 'bag-hd';
    h3.parentNode.insertBefore(hd, h3);
    hd.appendChild(h3);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'btnClearBag';
    btn.className = 'mini';
    btn.textContent = '清空背包';
    btn.onclick = () => this.clearBag();
    hd.appendChild(btn);
    return hd;
  },

  /* ---- 一键清空背包：全部放回仓库 ---- */
  clearBag() {
    if (!Save.bag.length) { this.note('背包已经是空的'); return 0; }
    const keep = [];
    let moved = 0, stuck = 0;
    for (const e of Save.bag) {
      const it = stashItem(e);
      if (!it) { keep.push(e); continue; }
      /* 整叠走，别按「一件」走：逐件点击时 toStash 一次只搬 1 件（用过的医疗品
         本来就是单件，堆叠的靠玩家多点几次），但这里是**整条删掉**，
         照抄那个 1 就等于把剩下的 n-1 件吞了。只有真的用过的（cap 不满）才是单件。 */
      const maxCap = Medical.capOf(it);
      const used = !!maxCap && e.cap != null && e.cap < maxCap - 1e-6;
      const n = (e.gear || used) ? 1 : Math.max(1, e.n || 1);
      /* 弹药先问仓库塞不塞得下 —— 和逐件点「放回仓库」是同一条规则，
         塞不下就留在包里，不吞、也不把仓库撑爆 */
      if (it.cat === 'ammo' && !Save.canAddStash(it.id, n)) { keep.push(e); stuck += n; continue; }
      if (e.gear) Save.addGearStash(it);
      else Save.addStash(it.id, n, e.cap);
      moved += n;
    }
    Save.bag = keep;
    Save.save(); Save.flush();
    if (moved) Game.sfx('pickup');
    this.render();
    this.note('背包已清空：' + moved + ' 件放回仓库' +
      (stuck ? '，' + stuck + ' 发弹药仓库放不下，留在包里' : ''));
    return moved;
  },

  makeBagCell(e) {
    const cell=document.createElement('div'),it=e?stashItem(e):null;
    if(!it){cell.className='cell empty';cell.textContent='·';return cell;}
    const n=e.n||1;
    cell.className='cell '+RARITY[U.clamp((it.r||1)-1,0,RARITY.length-1)].cls+(it.equip?' eq':'');
    cell.innerHTML=Icons.bagTag(it,'ico-bag')+'<span class="cn">'+esc(it.short||it.name)+'</span>'+
      (n>1?'<span class="qty">'+n+'</span>':'')+
      (Medical.capOf(it)&&Medical.isPartial(e)?'<span class="cap">'+Math.ceil(Medical.entryCap(e))+'</span>':'');
    cell.title=it.name+' · '+(it.w*n).toFixed(2)+'kg · 单击看详情';
    return cell;
  },

  renderBag() {
    const grid = document.getElementById('baseBagGrid');
    if (!grid) return;
    this.ensureBagHead();
    grid.innerHTML = '';
    /* 老存档可能带着超过当前容量的东西：多出来的格子照样画出来，
       让玩家能搬回仓库，别让它们卡在包里看不见 */
    const cap = Math.max(bagSlots(), Save.bag.length);
    for (let i = 0; i < cap; i++) {
      const e = Save.bag[i];
      const cell = this.makeBagCell(e);
      const it = e ? stashItem(e) : null;
      if (!it) {
        grid.appendChild(cell);
        continue;
      }
      /* 背包（藏身处与仓库页共用）：单击看详情、双击卸下（医疗品可用就先用）、
         Ctrl+左键卸下、右键 = 详情 / 卸下 / 按需追加（使用、存入保险箱、改装）。 */
      {
        const count = e.n || 1;
        cell.title = it.name + ' · ' + (it.w * count).toFixed(2) + 'kg · 单击看详情 · 双击' +
          (Medical.canUse(it, 'basebag') ? '使用' : '卸下');
        cell.onclick = ev => {
          if (ev && (ev.ctrlKey || ev.metaKey)) { Tips.hide(); this.toStash(e); return; }
          this.showItem(e, 'bag', cell);
        };
        cell.ondblclick = ev => {
          if (ev && ev.preventDefault) ev.preventDefault();
          Tips.hide();
          if (Medical.canUse(it, 'basebag')) { Medical.use(e, 'basebag'); return; }
          this.toStash(e);
        };
        cell.oncontextmenu = ev => {
          ev.preventDefault();
          ev.stopPropagation();
          const entries = [
            { label: '详情', onClick: () => this.showItem(e, 'bag', cell) },
            { label: '卸下', onClick: () => this.toStash(e) }
          ];
          if (Medical.is(it)) {
            const usable = Medical.canUse(it, 'basebag');
            entries.push({
              label: Medical.actionLabel(it, 'basebag'),
              disabled: !usable,
              onClick: () => { if (usable) Medical.use(e, 'basebag'); }
            });
          }
          if (typeof BaseSafe !== 'undefined')
            entries.push({ label: '存入保险箱', onClick: () => BaseSafe.transfer(e, 'bag', 'safe') });
          for (const a of this.extraActsFor(e, 'bag', cell)) entries.push(a);
          Ctx.show(ev.clientX, ev.clientY, entries);
        };
      }
      grid.appendChild(cell);
    }

    const w = Save.bagWeight();
    const meta = document.getElementById('bagMeta');
    if (meta) meta.textContent = Save.bag.length + ' / ' + bagSlots() + ' 格 · ' +
      w.toFixed(1) + ' / ' + CFG.BAG.CARRY + ' kg';
    const bar = document.getElementById('bagBar');
    if (bar && bar.querySelector) {
      bar.querySelector('i').style.width = Math.min(100, w / CFG.BAG.CARRY * 100) + '%';
    }
    /* 空包时按钮变灰：点它只会得到一句「背包已经是空的」，不如直接说明白 */
    const clear = document.getElementById('btnClearBag');
    if (clear) {
      const empty = !Save.bag.length;
      clear.disabled = empty;
      clear.title = empty ? '背包已经是空的' : '把背包里的东西全部放回仓库（装备栏不动）';
    }
    Save.save();
  },

  /* 背包还能不能塞下：先算再动，算不过就不搬，绝不吞东西 */
  bagBlock(it, n) {
    if (!it) return '物品不存在';
    if (Save.bagWeight() + Save.safeWeight() + it.w * n > CFG.BAG.CARRY + 1e-6) return '太重了';
    const stack = stackLimit(it);
    let room = 0;
    for (const e of Save.bag) {
      if (e.gear || e.id !== it.id) continue;
      if (Medical.capOf(it) && e.cap != null && e.cap < Medical.capOf(it) - 1e-6) continue;
      room += Math.max(0, stack - e.n);
    }
    const need = Math.max(0, n - room);
    if (need > (bagSlots() - Save.bag.length) * stack) return '格子不够';
    return '';
  },

  /* 仓库 → 背包：整叠搬（装备和用过的恢复品一件一件搬） */
  toBag(e) {
    if (!Save.stash.includes(e)) return false;
    const it = stashItem(e);
    if (!it) return false;
    const n = (e.gear || Medical.capOf(it)) ? 1 : Math.max(1, e.n || 1);
    const why = this.bagBlock(it, n);
    if (why) { this.note('放不进背包：' + why, true); return false; }
    if (e.gear) Save.addGearBag(it);
    else Save.addBag(it.id, n, e.cap);
    this.dropFrom(Save.stash, e, n);
    this.render();
    this.note('已放入背包：' + it.name + (n > 1 ? ' ×' + n : ''));
    Game.sfx('pickup');
    return true;
  },

  /* 背包 → 仓库 */
  toStash(e) {
    if (!Save.bag.includes(e)) return false;
    const it = stashItem(e);
    if (!it) return false;
    const n = (e.gear || Medical.capOf(it)) ? 1 : Math.max(1, e.n || 1);
    if(it.cat==='ammo'&&!Save.canAddStash(it.id,n)){this.note('仓库空间不足',true);return false;}
    if (e.gear) Save.addGearStash(it);
    else Save.addStash(it.id, n, e.cap);
    this.dropFrom(Save.bag, e, n);
    this.render();
    this.note('已放回仓库：' + it.name + (n > 1 ? ' ×' + n : ''));
    Game.sfx('pickup');
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
  unloadGun(it) {
    const eq = it?.equip;
    if (eq?.kind !== 'gun') return false;
    const bag = new Bag();
    bag.slots = Save.bag.map(e => ({item:stashItem(e), n:e.n||1, cap:e.cap}));
    const rounds = magazineRounds(Attachments.resolve(eq.gun,eq.attachments), eq.mag, eq.ammo, eq.rounds), counts = {};
    for (const id of rounds) counts[id] = (counts[id]||0)+1;
    for (const [id,n] of Object.entries(counts)) if (!bag.addAmmo(id,n)) {
      this.note('背包空间不足，退弹已取消', true); return false;
    }
    Save.bag = bag.slots.map(s => s.item.equip ? {id:s.item.id,n:1,gear:s.item} : {id:s.item.id,n:s.n,...(s.cap == null ? {} : {cap:s.cap})});
    eq.mag = 0; eq.rounds = []; it.note = '';
    Save.save(); Tips.hide(); this.render(); if(rounds.length)Game.sfx('pickup'); return true;
  },

  /* 局外背包的详情：和仓库 / 装备栏共用同一个浮窗，别处不要再写一套。 */
  showBagItem(e, node) { this.showItem(e, 'bag', node); },

  /* ---------------- 局外统一的物品详情 ----------------
     仓库 / 背包 / 装备栏所有格子都弹这一个浮窗（#itemTip），不再有第二套详情面板。
     动作按钮按语境给：卸下（背包、装备栏）、放进背包（仓库）、使用（医疗品）、
     存入保险箱（背包）、前往出售（仓库）；改装这类模块能力走 extraActsFor 钩子。
     where: 'stash' | 'bag' | 'gear'；装备栏的 e 是伪物品，key 是槽位名。 */
  showItem(e, where, node, key) {
    const inGear = where === 'gear';
    const it = inGear ? e : stashItem(e);
    if (!it || !node || !node.getBoundingClientRect) return;
    const inStash = where === 'stash', inBag = where === 'bag';

    const extra = [];
    /* 堆叠数量在原来的右侧面板里是单独一行，浮窗也得有，不然弹药看不出多少发 */
    if (!inGear && e && (e.n || 1) > 1)
      extra.push(['数量', (e.n || 1) + (it.cat === 'ammo' ? ' 发' : ' 件')]);
    if (!inGear && Medical.capOf(it))
      extra.push([it.effect ? '剩余次数' : '当前容量', Medical.capText(e)]);
    const hint = inStash ? '双击放进背包 · 右键不额外弹菜单'
      : inBag ? '双击卸下 · Ctrl+左键同样卸下'
      : '双击卸下 · 右键有详情与卸下';
    Tips.show(it, node.getBoundingClientRect(), hint, extra);

    const acts = [];
    /* 第一项永远是「从当前位置挪走」：装备栏/背包是卸下，仓库是放进背包 */
    if (inGear) acts.push({ label: '卸下', onClick: () => this.unequip(key) });
    else if (inBag) acts.push({ label: '卸下', onClick: () => this.toStash(e) });
    else {
      /* 背包塞不下就别给个能点的按钮，直接说明为什么 */
      const why = this.bagBlock(it, (e.gear || Medical.capOf(it)) ? 1 : Math.max(1, e.n || 1));
      acts.push({ label: '放进背包', disabled: !!why, onClick: () => this.toBag(e) });
    }

    /* 模块动作（装备 / 改装）紧跟主项，否则会被"前往出售"这类页脚按钮挤到最后 */
    for (const a of this.extraActsFor(e, where, node, key)) acts.push(a);

    if (!inGear && Medical.is(it)) {
      const w = inBag ? 'basebag' : 'stash';
      const usable = Medical.canUse(it, w);
      acts.push({
        label: Medical.actionLabel(it, w),
        disabled: !usable,
        onClick: () => { if (usable) Medical.use(e, w); }
      });
    }
    if (typeof BaseSafe !== 'undefined' && (inBag || inStash))
      acts.push({ label: '存入保险箱', onClick: () => BaseSafe.transfer(e, where, 'safe') });
    if (inStash) acts.push({ label: '前往出售', onClick: () => this.goToSell() });
    if (!inGear && it.equip?.kind === 'gun')
      acts.push({ label: '退弹到背包', onClick: () => this.unloadGun(it) });
    Tips.actions(acts);
  },

  /* ---- 仓库 ---- */
  renderFilter() {
    const el = document.getElementById('stashFilter');
    if (el.dataset.built) return;      // 只建一次，之后只切 class
    el.innerHTML = STASH_FILTERS.map(f =>
      '<button class="pill' + (f.k === this.filter ? ' on' : '') + '" data-f="' + f.k + '">' +
      '<span class="pill-name">' + f.name + '</span><span class="pill-count" data-count="' + f.k + '">0</span></button>'
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

  /* 每个分类标签后面带件数：一眼看出仓库里有什么 */
  updateFilterCounts() {
    const el = document.getElementById('stashFilter');
    if (!el || !el.dataset.built) return;
    const counts = {};
    for (const f of STASH_FILTERS) counts[f.k] = 0;
    for (const e of Save.stash) {
      const it = stashItem(e);
      if (!it) continue;
      for (const f of STASH_FILTERS) {
        if (f.k !== 'all' && !stashFilterMatch(it, f.k)) continue;
        counts[f.k] += e.n || 1;
      }
    }
    for (const f of STASH_FILTERS) {
      const span = el.querySelector('[data-count="' + f.k + '"]');
      if (span) span.textContent = String(counts[f.k]);
    }
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

  stashList() {
    return Save.stash.filter(e => {
      const it = stashItem(e);
      if (!it) return false;
      return stashFilterMatch(it, this.filter);
    }).sort((a, b) => {
      const ia = stashItem(a), ib = stashItem(b);
      return (ib.price || 0) - (ia.price || 0);
    });

  },

  renderStash() {
    const grid = document.getElementById('stashGrid');
    if (!grid) return;
    const list = this.stashList();
    this.updateFilterCounts();

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
        ((Medical.capOf(it) && Medical.isPartial(e))
          ? '<span class="cap">' + Math.ceil(Medical.entryCap(e)) + '</span>' : '');
      cell.title = it.name + (Medical.capOf(it) && Medical.isPartial(e)
          ? ' · ' + Medical.capText(e)
          : ' · ' + it.w.toFixed(2) + 'kg') + ' · ' +
        '估价 ' + formatMoney(unitPrice(it) * n) + ' · 成交价以商人报价为准 · 左键看详情';
      /* 仓库只有左键看详情、双击放进背包；右键不弹菜单（别让两套入口打架） */
      cell.onclick = () => this.showItem(e, 'stash', cell);
      cell.ondblclick = (ev) => {
        if (ev && ev.preventDefault) ev.preventDefault();
        Tips.hide();
        this.toBag(e);
      };
      cell.oncontextmenu = (ev) => { if (ev) ev.preventDefault(); };
      grid.appendChild(cell);
    }

    this.renderPager(pages, list.length);
  },

  renderPager(pages, total) {
    const el = document.getElementById('stashPager');
    if (!el) return;
    if (pages <= 1) {
      el.innerHTML = '<span>共 ' + total + ' 格</span>';
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
  goToSell(){Tips.hide();Deal.hide();if(typeof Ctx!=='undefined')Ctx.hide();if(typeof Safehouse!=='undefined')Safehouse.route('traders');return false;},
  askSell(){return this.goToSell();},
  sell(){return this.goToSell();},
  sellJunk(){return this.goToSell();},

  /* ---- 出发：背包里装了什么就带什么，不再现场买补给 ----
     opts.force：用户已经在出发前提醒里点了「继续出发」，明知有缺口也要走。
     这时跳过"没枪就拦下"的硬闸门 —— 提醒已经摆明风险，别再二次拦截。 */
  deploy(mapId, opts) {
    const map = MAP_CATALOG.find(m => m.id === (mapId || RAID_MAP.id));
    if (!map) return;
    /* 至少携带一把枪或近战武器，不再免费补发手枪 */
    this.ensureSidearm();
    if (!(opts && opts.force) && !Save.gear.weapons.some(Boolean) && !Save.gear.melee) {
      this.note('请先装备一把枪械或近战武器', true);
      return;
    }
    Save.normalizeBag();
    Save.save(); Save.flush();

    this.close();
    document.getElementById('mapVeil').classList.add('hidden');
    Game.startRun(null, map.id);
  }
};

/* Quantity selection is a preview. Only the current dialog can commit once. */
const AmmoPurchase={
  el:null,id:null,quantity:0,
  inShop(){return Game.state==='base'&&Base.tab==='gun'&&(typeof Safehouse==='undefined'||Safehouse.view==='merchant'&&MerchantUI.mode==='buy');},
  open(id){
    if(!this.inShop())return false;
    const quote=Base.ammoQuote(id,1);if(!quote.item)return false;
    Tips.hide();Deal.hide();this.close();this.id=id;this.quantity=stackLimit(quote.item);
    const it=quote.item,max=quote.max,dlg=document.createElement('dialog');this.el=dlg;dlg.className='ammo-checkout';dlg.setAttribute('aria-labelledby','ammoPurchaseTitle');
    dlg.innerHTML='<header><small>AMMUNITION / 弹药补给</small><h2 id="ammoPurchaseTitle">购买弹药</h2></header>'+ 
      '<section class="ammo-purchase-item">'+Icons.bagTag(it,'')+'<div><h3>'+esc(it.name)+'</h3><p>单价 '+formatMoney(it.price)+' / 发</p></div></section>'+
      '<label class="ammo-purchase-quantity">购买数量 <span><input data-ammo-count aria-label="弹药购买数量" type="number" min="1" max="'+max+'" step="1" value="'+this.quantity+'"> 发</span></label>'+
      '<input data-ammo-range aria-label="滑动选择弹药数量" type="range" min="1" max="'+max+'" step="1" value="'+this.quantity+'">'+
      '<div class="ammo-purchase-limits"><span>1发</span><span>最多'+Base.SHOP_AMMO_MAX_STACKS+'组 · '+max+'发</span></div>'+
      '<p class="ammo-purchase-stack">每组'+stackLimit(it)+'发 · 购买后放入仓库</p>'+
      '<footer><div class="ammo-purchase-total"><span>共计金额</span><strong data-ammo-total></strong></div><p data-ammo-wallet></p><p class="ammo-purchase-error" role="status" aria-live="polite"></p>'+ 
      '<div class="ammo-purchase-actions"><button type="button" data-ammo-pay>确定购买</button><button type="button" data-ammo-cancel>取消</button></div></footer>';
    document.body.appendChild(dlg);
    dlg.addEventListener('cancel',ev=>{ev.preventDefault();if(this.el===dlg)this.close();});
    dlg.querySelector('[data-ammo-cancel]').onclick=()=>{if(this.el===dlg)this.close();};
    const range=dlg.querySelector('[data-ammo-range]'),count=dlg.querySelector('[data-ammo-count]');
    range.oninput=()=>{if(this.el!==dlg)return;this.quantity=Number(range.value);count.value=range.value;this.refresh();};
    count.oninput=()=>{if(this.el!==dlg)return;this.quantity=count.value===''?NaN:Number(count.value);if(Number.isInteger(this.quantity)&&this.quantity>=1&&this.quantity<=max)range.value=String(this.quantity);this.refresh();};
    dlg.querySelector('[data-ammo-pay]').onclick=()=>this.pay(dlg);
    this.refresh();dlg.showModal();range.focus();return true;
  },
  refresh(){
    if(!this.el)return;const q=Base.ammoQuote(this.id,this.quantity);
    this.el.querySelector('[data-ammo-total]').textContent=q.quantity?formatMoney(q.total):'—';
    this.el.querySelector('[data-ammo-wallet]').textContent='当前余额 '+formatMoney(Save.credits);
    this.el.querySelector('.ammo-purchase-error').textContent=q.reason;
    this.el.querySelector('[data-ammo-pay]').disabled=!q.ok;
  },
  pay(dlg){
    if(this.el!==dlg||!dlg.open)return false;
    if(!this.inShop()){this.close();return false;}
    const q=Base.ammoQuote(this.id,this.quantity);if(!q.ok){this.refresh();return false;}
    const id=this.id,quantity=this.quantity;this.close();return Base.buyAmmo(id,quantity);
  },
  close(){const dlg=this.el;this.el=null;this.id=null;this.quantity=0;if(dlg){if(dlg.open)dlg.close();dlg.remove();}}
};
{
  const hide=Deal.hide;
  Deal.hide=function(){AmmoPurchase.close();return hide.apply(this,arguments);};
}

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
    Base.open();(document.querySelector('.sh-deploy') || document.getElementById('btnDeploy')).focus();
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
    const bagN=Save.bag.length, bagW=Save.bagWeight()+Save.safeWeight();
    document.getElementById('mapSupplyCost').textContent='背包 ' + bagN + ' / ' + bagSlots() +
      ' 格 · 保险箱 '+Save.safe.length+' / '+CFG.BAG.SAFE+' 格 · ' + bagW.toFixed(1) + ' / ' + CFG.BAG.CARRY + ' kg';
    document.getElementById('mapSelectionHint').textContent=
      '带什么由背包决定：子弹和药物回来还留在包里，其它东西自动入库。';
    document.getElementById('btnMapStart').disabled=false;
  },
  confirm() {
    if(Game.state!=='map-select')return;
    /* 出发前检查：有缺口先弹提醒，让玩家选「备战 / 继续 / 取消」，
       三项都干净就直接出发。 */
    if (DeployGuard.guard(this.selectedId)) return;
    Base.deploy(this.selectedId);
  }
};

/* ============================================================
   出发前提醒：生命值过低 / 未装备枪械 / 未携带药物。
   点「出发」时检查，缺任意一项就弹窗让玩家自己决定去留。
   ============================================================ */
const DeployGuard = {
  /* 生命值低于这个比例就算「过低」。取 0.5：满血 100 掉到 50 以下就提醒。 */
  HP_RATIO: 0.5,

  /* 背包里算「药物」的条目：cat === 'medical' 且局内真能用的那几类。
     Medical.is 已经覆盖 cat 判定，这里再排除纯图鉴收藏品（没有 healCap 的）。 */
  carriesMeds() {
    return Save.bag.concat(Save.safe||[]).some(e => {
      const it = ITEM_BY_ID[e.id];
      return it && Medical.is(it) && Medical.capOf(it) > 0;
    });
  },

  hasGun() {
    return Save.gear.weapons.some(Boolean) || !!Save.gear.melee;
  },

  /* 收集当前所有缺口，返回 [ { kind, title, detail } ] */
  problems() {
    const out = [];
    if (Save.hp <= CFG.P.HP * this.HP_RATIO) {
      out.push({
        kind: 'hp',
        title: '生命值过低',
        detail: '当前 ' + Save.hp + ' / ' + CFG.P.HP +
          '。带伤进场风险很高，建议先回藏身处治疗。'
      });
    }
    if (!this.hasGun()) {
      out.push({
        kind: 'gun',
        title: '未装备枪械',
        detail: '身上没有枪也没有近战武器，进场后赤手空拳。建议先去备战页配一把。'
      });
    }
    if (!this.carriesMeds()) {
      out.push({
        kind: 'med',
        title: '未携带药物',
        detail: '背包里没有可用的医疗品，中弹后无法自行治疗。建议带上绷带或急救包。'
      });
    }
    return out;
  },

  /* 有缺口就弹窗并返回 true（拦截出发）；全干净返回 false。 */
  guard(mapId) {
    const problems = this.problems();
    if (!problems.length) return false;

    const veil = document.getElementById('deployVeil');
    const warns = document.getElementById('deployWarns');
    if (!veil || !warns) return false;

    const ic = { hp: '⚠', gun: '✕', med: '＋' };
    warns.innerHTML = problems.map(p =>
      '<div class="deploy-warn warn-' + p.kind + '">' +
        '<span class="dw-ic">' + (ic[p.kind] || '!') + '</span>' +
        '<div class="dw-body"><b>' + esc(p.title) + '</b><span>' + esc(p.detail) + '</span></div>' +
      '</div>'
    ).join('');

    this._pendingMap = mapId;
    veil.classList.remove('hidden');
    /* 把焦点送进弹窗，Esc 键的关闭逻辑在这里也能用 */
    const focusBtn = document.getElementById('deployGoPrepare');
    if (focusBtn) focusBtn.focus();

    /* 通知音：这是一次需要留意的提示 */
    if (typeof SFX !== 'undefined' && SFX.ui) SFX.ui('notify');
    return true;
  },

  close() {
    const veil = document.getElementById('deployVeil');
    if (veil) veil.classList.add('hidden');
    this._pendingMap = null;
  },

  /* 前往备战：回藏身处，直接切到「备战」（装备 / 携带）页。
     safehouse 版有 Safehouse.route('loadout')；没有就退回聚焦装备页。 */
  goPrepare() {
    this.close();
    MapSelect.back();
    if (typeof Safehouse !== 'undefined' && Safehouse.route) {
      Safehouse.route('loadout');
    } else {
      const tab = document.querySelector('.sh-prepare, #paneGear');
      if (tab && tab.click) tab.click();
      else if (tab) tab.scrollIntoView();
    }
  }
};

/* ============================================================
   快速治疗：备战页的结账页（Clinic）
   版式照改枪台那套购买确认页走：商人身份块（头像 / 名字 / 身份）
   → 明细清单 → 总计与余额 → 确定支付 / 取消。

   **只卖一档：恢复到完全健康。** 不做分段治疗 ——
   医生是"缺多少补多少"报价，分几次付在账面上没有区别，
   却要额外处理"先付一半、回头补差价"的边界，不如就一条。

   价目**不另立一套**：Medical.quote(hp) 本来就等于
   "从 hp 治到满血要多少钱"，把它的明细（材料费 / 诊疗费）
   原样拆开展示，和医生页永远对得上。
   ============================================================ */
const Clinic = {
  el: null,

  /* 唯一的一档：治到满血，带明细。
     材料费 = 缺口 ÷ 绷带单次恢复量（向上取整）× 绷带售价；
     诊疗费 = max(材料费 × 服务费率, 一剂绷带的半价)，是 doctors.json 里那套规则。 */
  plan() {
    const max = CFG.P.HP;
    const hp = Math.max(0, Math.min(max, Save.hp));
    const q = Medical.quote(hp);                // { missing, medicine, service, total }
    const bandage = ITEM_BY_ID.heal01;
    const packs = q.missing > 0 ? Math.ceil(q.missing / bandage.healCap) : 0;
    const rate = Math.round(ECONOMY.doctor.serviceRate * 100);
    const floor = Math.ceil(bandage.price * ECONOMY.doctor.minimumBandageFraction);
    return {
      hp: hp, max: max, target: max,
      missing: q.missing,
      packs: packs,
      bandage: bandage,
      medicine: q.medicine,
      service: q.service,
      total: q.total,
      heal: Math.max(0, max - hp),
      rate: rate,
      floor: floor
    };
  },

  /* 接诊的医生。身份取短标签（MERCHANT_UI_CONFIG 里的 tag =「医生」），
     短标签缺席才退回 merchants 里的长描述。 */
  merchant() {
    const m = (typeof SAFEHOUSE_CONFIG !== 'undefined' && SAFEHOUSE_CONFIG.merchants
      && SAFEHOUSE_CONFIG.merchants.doctor) || null;
    const ui = (typeof MERCHANT_UI_CONFIG !== 'undefined' && MERCHANT_UI_CONFIG.doctor) || null;
    return {
      name: (m && m.name) || '值班医生',
      tag: (ui && ui.tag) || '医生',
      role: (m && m.role) || '',
      asset: (m && m.asset) || 'doctor'
    };
  },

  /* 头像走藏身处那套资源解析；资源没就位就退回占位方框，不让布局塌 */
  photo(asset) {
    try {
      if (typeof Safehouse !== 'undefined' && Safehouse.asset) return Safehouse.asset(asset);
    } catch (e) { /* 忽略：没有图也能用 */ }
    return '';
  },

  open() {
    if (Game.state !== 'base') return false;
    if (Save.hp >= CFG.P.HP - 1e-6) { Base.note('生命值已满，不需要治疗'); return false; }
    this.close();

    const dlg = document.createElement('dialog');
    dlg.className = 'clinic-checkout';
    dlg.setAttribute('aria-label', '快速治疗');
    document.body.appendChild(dlg);
    this.el = dlg;
    /* Esc 等同取消：只关窗，不扣款 */
    dlg.addEventListener('cancel', ev => { ev.preventDefault(); this.close(); });
    this.render();
    dlg.showModal();
    if (SFX.ui) SFX.ui('confirm');
    return true;
  },

  render() {
    const dlg = this.el;
    if (!dlg) return;
    const pl = this.plan();
    const doc = this.merchant();
    const st = Base.healthState();
    const src = this.photo(doc.asset);
    const poor = Save.credits < pl.total;
    const identity = doc.role && doc.role !== doc.tag ? doc.tag + ' · ' + doc.role : doc.tag;

    dlg.innerHTML =
      '<header>' +
        '<small>QUICK TREATMENT / 治疗结算</small>' +
        '<h2>恢复到完全健康</h2>' +
        '<p>医生按当前伤势一次性处理完。取消不扣款，伤势原样保留。</p>' +
      '</header>' +

      '<section class="clinic-vendor">' +
        '<div class="clinic-vendor-identity">' +
          (src ? '<img src="' + esc(src) + '" alt="' + esc(doc.name) + '">'
               : '<span class="clinic-vendor-photo" aria-hidden="true"></span>') +
          '<div><h3>' + esc(doc.name) + '</h3><small>' + esc(identity) + '</small></div>' +
          (typeof MERCHANT_DIALOGUE!=='undefined'?'<p class="clinic-vendor-quote">“'+esc(MERCHANT_DIALOGUE.doctor.beforeTreatment[0])+'”</p>':'') +
        '</div>' +
      '</section>' +

      '<div class="clinic-vitals">' +
        '<b>' + Math.round(pl.hp) + '</b><small>/ ' + pl.max + ' HP</small>' +
        '<em>' + st.label + '</em>' +
        '<i class="clinic-arrow" aria-hidden="true">→ ' + pl.max + '</i>' +
      '</div>' +

      '<section class="clinic-bill">' +
        '<h4>治疗明细</h4>' +
        '<ul>' +
          '<li><span>药品材料 · ' + esc(pl.bandage.name) + ' ×' + pl.packs +
            '<small>补足 ' + Math.round(pl.missing) + ' 点生命，每剂 ' + pl.bandage.healCap + ' 点</small></span>' +
            '<b>' + formatMoney(pl.medicine) + '</b></li>' +
          '<li><span>诊疗服务费' +
            '<small>按材料费 ' + pl.rate + '% 计，最低 ' + formatMoney(pl.floor) + '</small></span>' +
            '<b>' + formatMoney(pl.service) + '</b></li>' +
        '</ul>' +
        /* 不写「小计」：这一页只有一位收款人、一项服务，小计和下面的总计永远是同一个数，
           连着显示两遍只会让人怀疑自己看错了。改枪台那边有小计是因为可能跨多个商人。 */
      '</section>' +

      '<footer>' +
        '<div class="clinic-total"><span>总计</span><strong>' + formatMoney(pl.total) + '</strong></div>' +
        '<p class="clinic-wallet">当前余额 ' + formatMoney(Save.credits) +
          ' · 支付后 ' + Math.round(pl.target) + ' / ' + pl.max + ' HP，余额 ' +
          formatMoney(Save.credits - pl.total) + '</p>' +
        '<p class="clinic-error" role="status">' + (poor ? '信用点不足，先去凑钱。' : '') + '</p>' +
        '<div class="clinic-acts">' +
          '<button type="button" data-clinic-pay' + (poor ? ' disabled' : '') + '>确定支付</button>' +
          '<button type="button" data-clinic-cancel>取消</button>' +
        '</div>' +
      '</footer>';

    dlg.querySelector('[data-clinic-cancel]').onclick = () => this.close();
    const pay = dlg.querySelector('[data-clinic-pay]');
    if (pay) pay.onclick = () => this.pay();
  },

  /* 支付：以此刻重新报价为准 —— 从开窗到点确认之间血量理论上不会变，
     但报价函数是纯的，重算一次比信缓存的更稳。 */
  pay() {
    const pl = this.plan();
    if (!(pl.total >= 0) || pl.missing <= 0) { this.close(); return false; }
    if (Save.credits < pl.total) {
      const err = this.el && this.el.querySelector('.clinic-error');
      if (err) err.textContent = '信用点不足，先去凑钱。';
      return false;
    }
    const before = Save.hp;
    Save.credits -= pl.total;
    Save.setHP(pl.target);
    Save.save(); Save.flush();
    this.close();
    Game.sfx('sell');
    Base.render();
    Base.note('治疗完成：+' + Math.round(pl.target - before) + ' HP（-' + formatMoney(pl.total) + '）');
    return true;
  },

  close() {
    if (!this.el) return;
    if (this.el.open) this.el.close();
    this.el.remove();
    this.el = null;
  }
};
