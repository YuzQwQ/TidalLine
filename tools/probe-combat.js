const sleep = ms => new Promise(r => setTimeout(r, ms));
document.getElementById('startVeil').style.display = 'none';
Game.startRun(Save.loadout);
const P = Game.player;

// 统计寻路开销
let pathCalls = 0, pathMs = 0;
const orig = M.findPath.bind(M);
M.findPath = function () {
  const t = performance.now();
  const r = orig.apply(null, arguments);
  pathMs += performance.now() - t;
  pathCalls++;
  return r;
};

const out = [];
for (let round = 0; round < 5; round++) {
  pathCalls = 0; pathMs = 0;
  const times = [];
  for (let i = 0; i < 3600; i++) {
    // 玩家不死、一直开火，敌人全都活着在追
    if (P.dead) { P.dead = false; P.hp = 9999; Game.state = 'playing'; }
    for (const e of Game.enemies) { if (e.dead) { e.dead = false; e.hp = e.maxHp || 60; } }
    P.mag = 30; P.reloadT = 0;
    Game.input.keys.mouseDown = true;
    const a = performance.now();
    Game.update(1 / 60);
    Game.render();
    times.push(performance.now() - a);
  }
  times.sort((x, y) => x - y);
  out.push({
    min: round + 1,
    avg: +(times.reduce((s, v) => s + v, 0) / times.length).toFixed(2),
    p99: +times[Math.floor(times.length * 0.99)].toFixed(2),
    max: +times[times.length - 1].toFixed(2),
    over16: times.filter(v => v > 16.7).length,
    pathCalls: pathCalls,
    pathAvgMs: pathCalls ? +(pathMs / pathCalls).toFixed(3) : 0,
    alive: Game.enemies.filter(e => !e.dead).length,
    corpses: Game.corpses.length,
    par: Game.particles.length
  });
}
Game.input.keys.mouseDown = false;
return JSON.stringify(out);
