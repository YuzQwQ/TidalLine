/* ============================================================
   局内绘制：地形、物件、实体、粒子、噪声边、HUD
   Game 的字段和生命周期在 game.js，这里用 Object.assign 挂上去。
   ============================================================ */

Object.assign(Game, {

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
});
