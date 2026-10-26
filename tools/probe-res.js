const sleep = ms => new Promise(r => setTimeout(r, ms));
document.getElementById('startVeil').style.display = 'none';
Game.startRun(Save.loadout);
const cv = document.getElementById('game');
const avg = (fn, n) => { const a = performance.now(); for (let i = 0; i < n; i++) fn(); return (performance.now() - a) / n; };
for (const e of Game.enemies) { e.dead = false; e.hp = 60; }
Game.input.keys.mouseDown = true;
await sleep(1500);
const upd = avg(() => Game.update(1 / 60), 600);
const ren = avg(() => Game.render(), 120);
Game.input.keys.mouseDown = false;
let last = performance.now(); const gaps = [];
const tick = () => { const n = performance.now(); gaps.push(n - last); last = n; requestAnimationFrame(tick); };
requestAnimationFrame(tick);
await sleep(3000);
const s = gaps.slice().sort((a, b) => a - b);
return JSON.stringify({
  win: window.innerWidth + 'x' + window.innerHeight,
  canvas: cv.width + 'x' + cv.height,
  updateMs: +upd.toFixed(3),
  renderMs: +ren.toFixed(3),
  frameMed: +s[Math.floor(s.length / 2)].toFixed(1),
  frameP95: +s[Math.floor(s.length * 0.95)].toFixed(1),
  glyphs: Pix._cache.size
});
