const sleep = ms => new Promise(r => setTimeout(r, ms));
document.getElementById('startVeil').style.display = 'none';
const out = [];
Game.startRun(Save.loadout);
const P = Game.player;
const heapMB = () => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1;
const avgMs = (fn, n) => { const a = performance.now(); for (let i = 0; i < n; i++) fn(); return (performance.now() - a) / n; };

// 每轮 = 1 分钟游戏时间，共 10 分钟，中途玩家不死（否则会切到死亡流程）
for (let round = 0; round < 10; round++) {
  const a = performance.now();
  for (let i = 0; i < 3600; i++) {
    Game.update(1 / 60);
    if (P.dead) { P.dead = false; P.hp = 9999; Game.state = 'playing'; }
  }
  const upd = (performance.now() - a) / 3600;
  const ren = avgMs(() => Game.render(), 30);
  out.push({
    min: round + 1,
    updMs: +upd.toFixed(3),
    renderMs: +ren.toFixed(2),
    alive: Game.enemies.filter(e => !e.dead).length,
    corpses: Game.corpses.length,
    par: Game.particles.length,
    noise: Noise.events.length,
    bul: Game.bullets.length,
    heap: heapMB()
  });
}

// 多局循环：撤离 → 藏身处 → 再出发，重复 5 次
for (let k = 0; k < 5; k++) {
  try { Game.showEnd(true); } catch (e) { out.push({ showEndErr: String(e) }); }
  try { Base.open(); Base.close(); } catch (e) { out.push({ baseErr: String(e) }); }
  Game.startRun(Save.loadout);
}
out.push({ afterRuns: 5, corpses: Game.corpses.length, en: Game.enemies.length, heap: heapMB(),
           renderMs: +avgMs(() => Game.render(), 30).toFixed(2) });
return JSON.stringify(out);
