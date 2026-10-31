/* ============================================================
   启动：读存档、加载贴图、按 URL hash 进入藏身处或直接开局
   ============================================================ */

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
