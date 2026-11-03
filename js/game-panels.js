/* ============================================================
   面板：搜刮列表、背包与装备、弹药选择、结算页
   Game 的字段和生命周期在 game.js，这里用 Object.assign 挂上去。
   ============================================================ */

Object.assign(Game, {

  /* ---------------- 搜刮面板 ---------------- */
  /* opts.silent：这次打开是「刚搜完这个容器」的收尾，声音已经在交互那一刻响过了，
     别再响第二下 —— 一个容器一次交互只该有一声。 */
  openLoot(obj, isCorpse, opts) {
    Medical.cancel();
    if (!(opts && opts.silent) && typeof SFX !== 'undefined') {
      SFX.play('search', { at: isCorpse ? 'corpse' : (obj.art || obj.kind) });
    }
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

    /* 人类尸体的容器带随机等级背包：这只包本身也是战利品，摸出来能背；
       它的等级同时决定能翻出几件普通物品（子弹与身上装备不算）。
       放在标题下面单独一行 —— 塞进标题会被右边的状态文字挤成省略号。 */
    const sub = document.getElementById('lootSub');
    if (isCorpse && obj.bagLv > 0) {
      const n = ((CFG.CORPSE_BAG || {}).itemsByLevel || {})[obj.bagLv] || obj.bagLv;
      sub.textContent = obj.bagName + ' · 可翻 ' + n + ' 件物品';
      sub.style.display = '';
    } else {
      sub.textContent = '';
      sub.style.display = 'none';
    }

    this.search = null;
    this._searchBar = null;
    this.autoSearch = true;      // 打开就一件件往下搜，点某一件才转成目标搜索
    this.renderLootList();
    this.stepAutoSearch();

    // 搜刮时背包一起打开（左侧），关面板时如果是自动开的就收回去
    if (!this.bagOpen) {
      this.bagWasAuto = true;
      this.toggleBag({ silent: true });
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
      if (this.bagOpen) this.toggleBag({ silent: true });
    }
  },

  /* 按稀有度算这一件要搜多久 */
  searchTime(it) {
    const arr = CFG.ITEM_SEARCH.timeByRarity;
    return arr[U.clamp(it.r - 1, 0, arr.length - 1)];
  },

  stepAutoSearch() {
    if (!this.autoSearch || this.search || !this.lootOpen) return;
    const arr = this.lootOpen.items || [];
    for (let i = 0; i < arr.length; i++) {
      const e = arr[i];
      if (e && e.item && !e.known) { this.startItemSearch(i); return; }
    }
    this.autoSearch = false;      // 都搜完了
  },

  startItemSearch(idx, manual) {
    const box = this.lootOpen;
    if (!box || !box.items) return false;
    const e = box.items[idx];
    if (!e || e.known) return false;

    if (manual) this.autoSearch = false;
    this.search = { idx: idx, t: 0, total: this.searchTime(e.item), noiseT: 0 };
    this.renderLootList();
    /* 逐件搜索不出声：容器在交互那一刻已经响过一声，翻每一件再响就成了复读机 */
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

      /* ---- 尸体身上的装备：已经画在上面的装备格里，不在下面重复 ----
         背包同理（corpseBag 是尸体背的那只），只在上方四格里出现 ---- */
      if (entry.gear || entry.gun || entry.corpseBag) return;

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
        (it.equip ? Icons.bagTag(it) : Icons.tag(it.id)) +
        '<span class="nm">' + it.name + badges + '</span>' +
        '<span class="vv">' + it.w.toFixed(2) + 'kg · ' +
        (it.price > 0 ? formatMoney(it.price) : '—') + '</span>';

      row.onclick = () => {
        const cur = this.lootOpen && this.lootOpen.items[i];
        if (!cur) return;
        /* 装备不占普通格子：能穿就穿上，穿不下才进背包 */
        if (it.equip) { this.takeGear(cur, i); return; }
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
        Tips.show(it, row.getBoundingClientRect(),
          it.equip ? '左键装备（没有同类就直接穿上）' : '左键装进背包');
      };
      el.appendChild(row);
    });
  },

  /* ---------------- 尸体装备：方格布局 ---------------- */
  /* 和背包顶部同一套方格：头盔 / 护甲 / 背包 / 武器 四格，左键穿上、右键带回 */
  renderLootGear() {
    const bar = document.getElementById('lootGear');
    const tip = document.getElementById('lootGearTip');
    if (!bar) return;

    const arr = (this.lootOpen && this.lootOpen.items) || [];
    const at = {
      helmet: arr.findIndex(e => e && e.gear && e.gear.type === 'helmet'),
      body: arr.findIndex(e => e && e.gear && e.gear.type === 'body'),
      bag: arr.findIndex(e => e && e.corpseBag),
      gun: arr.findIndex(e => e && e.gun)
    };
    const any = at.helmet >= 0 || at.body >= 0 || at.bag >= 0 || at.gun >= 0;

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
        icon: GEAR.icon(g),
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
        icon: GEAR.icon(g),
        fb: g ? '甲' : '—',
        label: g ? g.short : '护甲',
        tag: g ? Math.ceil(g.dur) + '/' + g.max : '',
        tagCls: g ? (GEAR.state(g) === 'ok' ? '' : GEAR.state(g)) : '',
        own: !!(P && P.body),
        item: g ? EQUIP.armor(g) : null
      });
    }

    /* 背包：尸体背的那只，本身就是战利品，点了直接背走（旧包落地） */
    {
      const e = at.bag >= 0 ? arr[at.bag] : null;
      const it = e ? e.item : null;
      const eq = it && it.equip;
      cells.push({
        idx: at.bag,
        icon: it ? it.icon : null,
        fb: it ? '包' : '—',
        label: it ? it.short : '背包',
        tag: eq ? eq.slots + '格' : '',
        isBag: true,
        own: !!(P && P.back),
        item: it || null
      });
    }

    /* 武器 */
    {
      const e = at.gun >= 0 ? arr[at.gun] : null;
      const id = e ? this.gunId(e) : null;
      const w = id ? Attachments.resolve(id, e.gun.attachments) : null;
      cells.push({
        idx: at.gun,
        icon: id,
        fb: w ? w.short.charAt(0) : '—',
        label: w ? w.short : '武器',
        tag: w ? (e.gun.magCur!=null?e.gun.magCur+'/'+w.mag:w.mag)+'发' : '',
        own: !!(P && w && (w.slot === 'primary' ? (P.weapons[0] && P.weapons[1]) : P.weapons[2])),
        item: w ? this.corpseGun(e) : null
      });
    }

    /* 身上已经有同类装备时，这一格点下去是"放进背包"，用角标提示；
       背包例外：只有更大的才换上，小的那只进背包格子（角标同样亮"包"） */
    const hintOf = c => c.isBag
      ? (c.own ? ' · 比现在这只大就换上，旧包丢在脚边' : ' · 点击背上')
      : (c.own ? ' · 已有同类，点击放进背包' : ' · 点击穿上');
    bar.innerHTML = cells.map(c =>
      '<div class="eqs' + (c.icon ? '' : ' empty') + '" title="' +
        esc(c.label) +
        (c.icon ? hintOf(c) + ' · 右键看详情' : '') + '">' +
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
          Tips.show(c.item, node.getBoundingClientRect(), c.isBag
            ? (c.own ? '左键背上（比现在这只大才换，旧包丢在脚边）' : '左键直接背上')
            : (c.own ? '已有同类，左键放进背包' : '左键直接穿上'));
        };
      }
    }
  },

  /* 尸体上的枪可能存成 id 字符串，也可能是早期写的整份 WEAPONS 对象 */
  gunId(entry) {
    const g = entry && entry.gun;
    if (!g) return null;
    return canonicalWeaponId(typeof g === 'string' ? g : (g.id || null));
  },

  corpseGun(entry){
    const id=this.gunId(entry),w=WEAPONS[id];if(!w)return null;
    const g=entry.gun;
    return g.magCur!=null?EQUIP.gun(id,g.magCur,g.ammo,g.rounds,g):EQUIP.gun(id,Math.max(1,Math.round(w.mag*.3)));
  },

  /* 装备条目有两种形态：尸体身上的是 { gear } / { gun }，
     容器里掉出来的是 { item:{equip} }。统一成一份规格再走同一套流程。 */
  gearSpec(entry) {
    if (!entry) return null;
    if (entry.gear) return { g: entry.gear, isGun: false, bag: false };
    if (entry.gun) {
      const id = this.gunId(entry);
      return { g: Attachments.resolve(id,entry.gun.attachments), isGun: true, gunId: id, gunItem:this.corpseGun(entry), bag: false };
    }
    const eq = entry.item && entry.item.equip;
    if (!eq) return null;
    if (eq.kind === 'gun') return { g: Attachments.resolve(eq.gun,eq.attachments), isGun: true, gunId: canonicalWeaponId(eq.gun), gunItem:EQUIP.gun(eq.gun,eq.mag,eq.ammo,eq.rounds,eq),bag: false };
    if (eq.kind === 'bag') return { g: BACKPACK.make(eq.bag), isGun: false, bag: true };
    if (eq.kind === 'armor') return { g: eq.gear, isGun: false, bag: false };
    return null;
  },

  takeGear(entry, idx) {
    const P = this.player;
    if (!P || !entry) return false;
    if(entry.item?.equip?.kind==='attachment'){
      if(!this.lootOpen||this.lootOpen.items[idx]!==entry)return false;
      const res=P.bag.canAdd(entry.item,1);if(!res.ok){this.toast(res.why);return false;}
      P.bag.add(entry.item,1);this.lootOpen.items[idx]=null;this.syncBoxState(this.lootOpen);if(this.lootOpen)this.renderLootList();this.renderBag();Game.sfx('pickup');return true;
    }
    const s = this.gearSpec(entry);
    if (!s || !s.g) return false;
    const g = s.g;

    let msg = '';
    let dropOld = null;        // 换下来又塞不进背包的（只有背包会走到这）

    if (s.isGun) {
      /* 主武器进 0/1，副武器进 2；有空位就先穿上 */
      const range = g.slot === 'primary' ? [0, 1] : [2];
      const free = range.find(k => !P.weapons[k]);
      if (free != null) {
        const snap=s.gunItem.equip,got=snap.mag;
        P.weapons[free] = Object.assign({}, g, { attachments:{...snap.attachments},magCur: got,ammo:snap.ammo,rounds:[...snap.rounds],fireMode:snap.fireMode,cycleRemaining:snap.cycleRemaining });
        if (!P.weapons[P.slot] || P.slot===free) { P.slot = free; P.mag = got; }
        msg = '换上 ' + g.name + '（' + got + ' 发）';
      }
    } else if (s.bag) {
      /* 背包不能塞进背包，换下来那只直接丢在脚边 —— 但只有更大的才值得换，
         更小的那只走下面的"放进背包"，别把身上好的那只抖到地上 */
      const cur = P.back;
      if (!cur || g.slots > cur.slots) {
        if (cur) dropOld = EQUIP.bag(cur.id);
        P.back = BACKPACK.make(g.id);
        msg = '背上 ' + g.name + (dropOld ? '，' + dropOld.name + ' 丢在脚边' : '');
      }
    } else if (!P[g.type]) {
      P[g.type] = Object.assign({}, g);
      msg = '穿上 ' + g.name;
    }

    if (!msg) {
      const item = s.isGun
        ? s.gunItem
        : (s.bag ? (entry.item || EQUIP.bag(g.id)) : EQUIP.armor(g));
      const res = P.bag.canAdd(item, 1);
      if (!res.ok) { this.toast(res.why); return false; }
      P.bag.add(item, 1);
      msg = '放进背包 · ' + g.name;
    }

    this.lootOpen.items[idx] = null;
    if (dropOld) this.dropItem(dropOld, 1);
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
    if(eq.kind==='attachment')return false;
    let old = null;

    if (eq.kind === 'melee') return MeleeSystem.equipBag(i);
    if (eq.kind === 'gun') {
      const def = Attachments.resolve(eq.gun,eq.attachments);
      if (!def) return false;
      const range = def.slot === 'primary' ? [0, 1] : [2];
      const free = range.find(k => !P.weapons[k]);
      const at = (free != null) ? free : (range.includes(P.slot)?P.slot:range[0]);
      const cur = P.weapons[at];
      if (cur) old = Gunplay.snapshot(cur);
      P.weapons[at] = Object.assign({}, def, {
        magCur: eq.mag || 0,
        rounds: magazineRounds(def, eq.mag || 0, eq.ammo, eq.rounds),
        fireMode:eq.fireMode||def.defaultMode,cycleRemaining:eq.cycleRemaining||0,
        ammo: (AMMO_BY_ID[eq.ammo] && AMMO_BY_ID[eq.ammo].caliber === def.caliber) ? eq.ammo : def.ammo
      });
      Gunplay.cancel(P,true); AmmoQuick.cancel();
      P.slot = at;
      P.mag = P.weapons[at].magCur;
    } else {
      const g = eq.gear;
      const cur = P[g.type];
      if (cur) old = EQUIP.armor(cur);
      P[g.type] = Object.assign({}, g);
    }

    P.resetAim(); // also applies when replacing a weapon with the same model
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
      this.toast('新收录：' + it.name, 'good');
    }
    Save.codex[it.id].count++;
    Save.save();
  },

  /* ---------------- 背包面板 ---------------- */
  /* opts.silent：背包不是玩家自己按出来的（搜容器时自动带出来、结算/死亡时自动收起），
     这时不开拉链声。以前两种情况都响，翻一个箱子先响一声拉链，
     听着像是在开自己的包 —— 现在只有玩家自己按 Tab 或点背包按钮才有声音。 */
  toggleBag(opts) {
    const silent = !!(opts && opts.silent);
    this.bagOpen = !this.bagOpen;
    const el = document.getElementById('bagBox');
    el.classList.toggle('open', this.bagOpen);
    if (this.bagOpen) this.renderBag();
    /* 开合背包：一声拉链。开包和关包音高差一点，听得出是合上还是拉开 */
    if (!silent && typeof SFX !== 'undefined') SFX.play('bag_zip', { rate: this.bagOpen ? 1.06 : 0.9 });
  },

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
        icon: GEAR.icon(g),
        fb: g ? (type === 'helmet' ? '盔' : '甲') : '',
        label: g ? g.short : (type === 'helmet' ? '头盔' : '护甲'),
        tag: g ? 'Lv' + g.lv : '',
        tagCls: st === 'ok' ? '' : st,
        click: null
      });
    }

    /* --- 背包：只显示当前容量，局内不能换（回藏身处才能换） --- */
    const bp = Save.gear.back;
    cells.push({
      icon: bp ? bp.id : 'bag',
      fb: '包',
      label: bp ? bp.short : '背包',
      tag: bagSlots() + '格',
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
      if (n < 3 && P.weapons[n]) nodes[n].oncontextmenu = ev => {
        ev.preventDefault(); ev.stopPropagation();
        Ctx.show(ev.clientX, ev.clientY, [{label:'退弹', onClick:() => P.unloadWeapon(n)},...(n===P.slot&&P.weapon.modes.length>1?[{label:'切换射击模式（B）',onClick:()=>{Gunplay.nextMode(P);Game.renderGearPanel();}}]:[])]);
      };
    }
  },

  unloadLooseGun(it) {
    const eq = it?.equip, p = this.player;
    if (!p || eq?.kind !== 'gun') return false;
    const snapshot = p.bag.slots.map(s => ({...s}));
    const rounds = magazineRounds(Attachments.resolve(eq.gun,eq.attachments), eq.mag, eq.ammo, eq.rounds);
    const counts = {}; for (const id of rounds) counts[id] = (counts[id] || 0) + 1;
    for (const [id,n] of Object.entries(counts)) if (!p.bag.addAmmo(id,n)) {
      p.bag.slots = snapshot; this.toast('背包空间不足，退弹已取消'); return false;
    }
    eq.mag = 0; eq.rounds = []; it.note = '';
    this.renderBag(); return true;
  },

  renderBag() {
    const P = this.player;
    if (!P) return;
    this.renderGearPanel();
    const grid = document.getElementById('bagGrid');
    grid.innerHTML = '';
    /* 超容量的老存档也照样画出来，好让玩家搬回仓库 */
    const bcap = Math.max(bagSlots(), P.bag.slots.length);
    for (let i = 0; i < bcap; i++) {
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
            ...(it.equip?.kind === 'gun' ? [{label:'退弹', onClick:() => this.unloadLooseGun(it)}] : []),
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
          if (P.bag.slots.length >= bagSlots()) { this.toast('背包满了'); return; }
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

  /* ---------------- 结算 ---------------- */
  applyEquipmentLoss() {
    const P=this.player;
    if(!P)return [];
    if(P._equipmentLoss)return P._equipmentLoss;
    const lost=[];
    P.weapons.forEach((w,i)=>{if(w)lost.push(Gunplay.snapshot(w,i===P.slot?P.mag:w.magCur));});
    if(P.helmet)lost.push(EQUIP.armor(P.helmet));
    if(P.body)lost.push(EQUIP.armor(P.body));
    if(P.back)lost.push(EQUIP.bag(P.back.id));
    P._equipmentLoss=lost;
    P.weapons=[null,null,null];P.mag=0;P.slot=0;P.helmet=null;P.body=null;P.back=null;
    P.reloadPending=false;P.reloadT=0;P.meleeAttack=null;
    this.syncGear();Save.flush();
    return lost;
  },

  showEnd(success, reason) {
    this.action = null;
    this.closeLoot();
    /* 结算页已经算局外了，大厅音乐接着响 —— 死回来不至于一片死寂 */
    if (typeof Music !== 'undefined') Music.play('base');
    if (this.bagOpen) this.toggleBag({ silent: true });
    if (typeof MedHud !== 'undefined') MedHud.reset();   // 收尾：轮盘、快捷栏、进度条一起清
    if (success || !this._deathSoundPlayed) SFX.play(success ? 'extract' : 'death');

    const P = this.player;
    Save.setHP(success ? P.hp : 1);
    const lostEquipment=success?[]:this.applyEquipmentLoss();
    const carried = P.bag.slots.slice();
    const safe = P.bag.safe.slice();
    const kept = success ? carried.concat(safe) : safe;

    /* 回藏身处自动分拣：子弹和药物留在背包里（下一趟接着用），
       收集品、物资、装备一律回仓库。死亡时只有安全箱里的东西参与分拣。
       背包实在塞不下的时候退回仓库，宁可多走一步也不吞东西。 */
    Save.normalizeBag();
    const newIds = new Set((this.stats.newItems || []).map(x => x.id));
    const lines = [];
    let bagged = 0, baggedValue = 0;
    for (const s of kept) {
      const it = s.item;
      const stays = !it.equip && (it.cat === 'ammo' || Medical.is(it));
      if (stays && !Base.bagBlock(it, s.n)) {
        Save.addBag(it.id, s.n, s.cap);
        bagged++;
        baggedValue += (it.price || 0) * s.n;
        lines.push({ it, n: s.n, name: it.name + (s.n > 1 ? ' ×' + s.n : ''), price: (it.price || 0) * s.n, bag: true, isNew: false });
        continue;
      }
      if (it.equip) {
        Save.addGearStash(it);
        lines.push({ it, n: 1, name: it.name, price: it.sell || 0, gear: true, isNew: false });
        continue;
      }
      Save.addStash(it.id, s.n, s.cap);
      if (!it.noCodex && !Save.codex[it.id]) {
        Save.codex[it.id] = { first: Date.now(), count: 1 };
      }
      lines.push({
        it, n: s.n, name: it.name + (s.n > 1 ? ' ×' + s.n : ''), price: (it.price || 0) * s.n,
        isNew: newIds.has(it.id)
      });
    }

    const total = lines.reduce((a, b) => a + b.price, 0);
    const lost = carried.map(s => ({
      it: s.item,
      name: s.item.name + (s.n > 1 ? ' ×' + s.n : ''),
      price: (unitPrice(s.item) || 0) * s.n
    }));
    for(const item of lostEquipment)lost.push({it:item,name:item.name+'（已装备）',price:unitPrice(item)||0});
    const lostValue = success ? 0 : lost.reduce((a, b) => a + b.price, 0);
    const prevBest = Save.bestHaul || 0;
    const isRecord = success && total > prevBest && total > 0;

    Save.runs = (Save.runs || 0) + 1;
    if (isRecord) Save.bestHaul = total;
    Save.save();
    Save.flush();          // 一局结束，立刻落盘，不等节流

    const known = Save.codexCount();
    const totalItems = ITEMS.filter(i => !i.noCodex).length;
    this._end = {
      success: !!success,
      reason: reason || '',
      mapTitle: (M.map || RAID_MAP).title,
      time: this.time,
      tide: M.tideEnabled ? this.tidePhase + 1 : 0,
      kills: this.stats.kills,
      found: this.stats.found,
      keptCount: kept.length,
      gearCount: kept.filter(s => s.item.equip).length,
      bagged: bagged,
      baggedValue: baggedValue,
      total: total,
      lost: success ? [] : lost,
      lostValue: lostValue,
      lines: lines,
      newOnes: (this.stats.newItems || []).slice(),
      known: known,
      totalItems: totalItems,
      prevBest: prevBest,
      isRecord: isRecord
    };
    this.endPage('cover');
    document.getElementById('endVeil').classList.remove('hidden');
  },

  endPage(which) {
    const card = document.getElementById('endCard');
    if (!card || !this._end) return;
    card.innerHTML = which === 'detail' ? this.endDetailHTML() : this.endCoverHTML();
    const hide = () => document.getElementById('endVeil').classList.add('hidden');
    const again = document.getElementById('btnAgain');
    if (again) again.onclick = () => { hide(); Base.open(); };
    const again2 = document.getElementById('btnAgain2');
    if (again2) again2.onclick = () => { hide(); Base.open(); };
    const det = document.getElementById('btnEndDetail');
    if (det) det.onclick = () => this.endPage('detail');
    const back = document.getElementById('btnEndBack');
    if (back) back.onclick = () => this.endPage('cover');
  },

  /* ---- 第一页：这一趟值多少 ---- */
  endCoverHTML() {
    const d = this._end;
    const head = d.success
      ? '<div class="kicker">EXTRACTED</div><h1>撤离成功</h1>'
      : '<div class="kicker">LOST IN THE TIDE</div><h1>没能出来</h1>';
    const sub = d.success
      ? d.mapTitle + ' · 用时 ' + this.fmtTime(d.time) + (d.tide ? ' · 潮汐第 ' + d.tide + ' 阶段' : '')
      : (d.reason || '你倒在了' + d.mapTitle + '里');

    let hero;
    if (d.success) {
      hero = '<div class="end-hero">' +
        '<span class="end-hero-cap">本局收益</span>' +
        '<span class="end-hero-num">' + formatMoney(d.total) + '</span>' +
        '<span class="end-hero-sub">带回 ' + d.keptCount + ' 件 · 击杀 ' + d.kills +
          ' · 开箱 ' + d.found + (d.bagged ? ' · 备弹药物 ' + d.bagged + ' 件' : '') + '</span>' +
        (d.isRecord ? '<span class="end-record">新纪录 · 上一趟最好 ' + formatMoney(d.prevBest) + '</span>' : '') +
        '</div>';
    } else {
      hero = '<div class="end-hero bad">' +
        '<span class="end-hero-cap">这一趟的损失</span>' +
        '<span class="end-hero-num">−' + formatMoney(d.lostValue) + '</span>' +
        '<span class="end-hero-sub">' +
          (d.keptCount ? '安全箱保住 ' + d.keptCount + ' 件（' + formatMoney(d.total) + '）' : '安全箱是空的') +
          ' · 用时 ' + this.fmtTime(d.time) + ' · 击杀 ' + d.kills + ' · 开箱 ' + d.found + '</span>' +
        '</div>';
    }

    const top = d.lines.filter(l => l.price > 0).sort((a, b) => b.price - a.price).slice(0, 4);
    let cards;
    if (top.length) {
      cards = '<h2>' + (d.success ? '最值钱的几件' : '保住的这几件') + '</h2><div class="end-cards">' +
        top.map(l => {
          const it = l.it;
          const rar = RARITY[U.clamp((it.r || 1) - 1, 0, RARITY.length - 1)];
          return '<div class="end-card-item ' + rar.cls + '">' +
            (l.isNew ? '<em>NEW</em>' : '') +
            '<span class="ic">' + Icons.bagTag(it, 'ico-bag') + '</span>' +
            '<b>' + esc(it.short || it.name) + '</b>' +
            '<i>' + formatMoney(l.price) + '</i>' +
          '</div>';
        }).join('') + '</div>';
    } else {
      cards = '<div class="tip">' + (d.success
        ? '这一趟什么都没带出来。'
        : '安全箱是空的。下次先把最值钱的那件塞进去。') + '</div>';
    }

    const newBlock = d.newOnes.length
      ? '<div class="end-new"><span>新收录</span>' +
        d.newOnes.slice(0, 5).map(x => '<b>' + esc(x.name) + '</b>').join('') +
        (d.newOnes.length > 5 ? '<span>等 ' + d.newOnes.length + ' 件</span>' : '') + '</div>'
      : '';

    return head +
      '<div class="sub">' + esc(sub) + '</div>' +
      hero + cards + newBlock +
      '<div class="end-acts">' +
        '<button id="btnAgain">回 藏 身 处</button>' +
        '<button id="btnEndDetail" class="ghost">本 局 明 细</button>' +
      '</div>';
  },

  /* ---- 第二页：想看数字的人才点进来 ---- */
  endDetailHTML() {
    const d = this._end;
    let html = '<div class="kicker">REPORT</div><h1 style="font-size:22px">本局明细</h1>' +
      '<div class="sub">' + esc(d.mapTitle) + ' · ' + this.fmtTime(d.time) + '</div>';

    html += '<h2>这一趟</h2>';
    html += '<div class="settle-row"><span>击杀</span><b>' + d.kills + '</b></div>';
    html += '<div class="settle-row"><span>开过的容器</span><b>' + d.found + '</b></div>';
    html += '<div class="settle-row"><span>带出物品</span><b>' + d.keptCount + ' 件 / ' + formatMoney(d.total) + '</b></div>';
    if (d.gearCount) {
      html += '<div class="settle-row"><span>带出装备</span><b>' + d.gearCount + ' 件 · 已进仓库</b></div>';
    }
    if (d.bagged) {
      html += '<div class="settle-row"><span>子弹 / 药物留背包</span><b>' + d.bagged + ' 件 / ' + formatMoney(d.baggedValue) + '</b></div>';
    }
    if (!d.success) {
      html += '<div class="settle-row"><span>损失</span><b class="bad-val">−' + formatMoney(d.lostValue) + '</b></div>';
    }
    html += '<div class="settle-row"><span>新收录</span><b>' + d.newOnes.length + '</b></div>';
    html += '<div class="settle-row"><span>信用点余额</span><b>' + formatMoney(Save.credits) + '</b></div>';

    if (d.lost.length) {
      html += '<h2>丢在里面的东西</h2>';
      for (const l of d.lost) {
        html += '<div class="settle-row"><span>' + esc(l.name) + '</span><b class="dim">' + formatMoney(l.price) + '</b></div>';
      }
      html += '<div class="tip">死亡或行动失败会失去已装备的枪械、头盔、护甲和背包；近战槽与安全箱保留。</div>';
    }

    if (d.lines.length) {
      html += '<h2>' + (d.success ? '带回' : '保住的') + '</h2>';
      for (const l of d.lines) {
        html += '<div class="settle-row"><span>' + esc(l.name) +
          (l.isNew ? '<span class="newtag">NEW</span>' : '') +
          (l.bag ? '<span class="inbag">留背包</span>' : '') +
          '</span><b>' + formatMoney(l.price) + '</b></div>';
      }
    }

    html += '<h2>图鉴</h2>';
    html += '<div class="settle-row"><span>已收录</span><b>' + d.known + ' / ' + d.totalItems + '</b></div>';
    html += '<div class="bar" style="margin-top:8px"><i style="width:' +
      (d.known / d.totalItems * 100) + '%"></i></div>';
    html += '<div class="tip" style="margin-top:18px">弹药和药物留在背包里，下一趟接着用；其它的已经进仓库了。</div>';
    html += '<div class="end-acts">' +
      '<button id="btnEndBack">返 回</button>' +
      '<button id="btnAgain2" class="ghost">回 藏 身 处</button>' +
      '</div>';
    return html;
  },

  fmtTime(s) {
    const m = Math.floor(s / 60), ss = Math.floor(s % 60);
    return m + ':' + (ss < 10 ? '0' : '') + ss;
  }
});
