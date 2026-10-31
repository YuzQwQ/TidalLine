/* ============================================================
   局内每帧逻辑：更新、交互判定、容器与遗落堆、死亡与撤离
   Game 的字段和生命周期在 game.js，这里用 Object.assign 挂上去。
   ============================================================ */

Object.assign(Game, {

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
            items: Loot.fill(kind, type.cats || (spot && spot.preference), type),
            opened: false,
            searched: false             // 有没有被掀开过；和"是否已空"分开记
          };
          t.box = box;
          this.boxes.push(box);
        }
      }
    }
  },

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
  }
});
