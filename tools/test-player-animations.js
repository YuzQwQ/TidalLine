/* 玩家动画浏览器检查，需要 playwright。先构建游戏和预览页。 */
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const manifest = require('../assets/player-animation-prompts.json');
const output = path.join(root, 'output/player-animation');
const server = http.createServer((req, res) => {
  const target = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(target, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': target.endsWith('.png') ? 'image/png' : target.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8' }).end(data);
  });
});
(async () => {
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const origin = 'http://127.0.0.1:' + server.address().port;
    await page.goto(origin + '/index.html#play,4,4');
    await page.waitForFunction(() => Object.keys(PLAYER_ANIMS).every(state => ART.charDirs.every(dir => Art.map['anim/player_' + state + '_' + dir])));
    const specs = await page.evaluate(() => {
      const output = [];
      for (const [state, clip] of Object.entries(PLAYER_ANIMS)) for (const dir of ART.charDirs) {
        const image = Art.map['anim/player_' + state + '_' + dir];
        const size = clip.size || 32;
        const canvas = document.createElement('canvas'); canvas.width = clip.frames * size; canvas.height = size;
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
        const hashes = []; let visible = 0, partial = 0, padding = 0;
        for (let frame = 0; frame < clip.frames; frame++) {
          const data = ctx.getImageData(frame * size, 0, size, size).data;
          let count = 0, hash = 2166136261;
          for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
            const i = (y * size + x) * 4, a = data[i + 3];
            if (a) count++;
            if (a && a !== 255) partial++;
            if ((x < 2 || y < 2 || x >= size - 2 || y >= size - 2) && a) padding++;
            for (let j = 0; j < 4; j++) hash = Math.imul(hash ^ data[i + j], 16777619);
          }
          visible += count > 30 ? 1 : 0; hashes.push(hash);
        }
        output.push({ state, dir, size, width: image.naturalWidth, height: image.naturalHeight, frames: clip.frames, visible, partial, padding, distinct: new Set(hashes).size });
      }
      return output;
    });
    assert.equal(specs.length, 21);
    for (const s of specs) {
      const key = s.state + '_' + s.dir;
      assert.equal(s.width, s.frames * s.size, key); assert.equal(s.height, s.size, key);
      assert.equal(s.visible, s.frames, key + ' nonempty frames');
      assert.equal(s.partial, 0, key + ' alpha'); assert.equal(s.padding, 0, key + ' margins');
      assert(s.distinct >= 2, key + ' must contain actual changes');
    }
    console.log('OK: 21 strips / 60 nonempty changing frames, dimensions, transparency, margins');

    assert(await page.evaluate(() => {
      Game.state = 'ended';
      const player = Game.player, canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
      const ctx = canvas.getContext('2d');
      for (const [state, clip] of Object.entries(PLAYER_ANIMS)) {
        for (const [angle, dir, flip] of [[0,'e',false], [Math.PI,'e',true], [Math.PI / 2,'s',false], [-Math.PI / 2,'n',false]]) {
          player.dodgeAngle = angle;
          for (let frame = 0; frame < clip.frames; frame++) {
            player.anim = { state, time: (frame + 0.1) / clip.fps };
            const sprite = Art.drawChar(ctx, 'player', angle, 16, 16, player);
            if (!sprite.animated || sprite.frame !== frame || sprite.dir !== dir || sprite.flip !== flip) return false;
          }
        }
        player.anim = { state, time: 999 };
        const sprite = Art.drawChar(ctx, 'player', 0, 16, 16, player);
        if (!clip.loop && sprite.frame !== clip.frames - 1) return false;
      }
      const key = 'anim/player_walk_s', saved = Art.map[key]; Art.map[key] = null;
      player.anim = { state: 'walk', time: 0.2 };
      const fallback = Art.drawChar(ctx, 'player', Math.PI / 2, 16, 16, player);
      Art.map[key] = saved;
      return fallback && !fallback.animated && fallback.exact;
    }), 'all action frames, facing, west mirror, one-shot clamp and missing-strip fallback');
    console.log('OK: renderer uses every frame, three directions, west mirror, static fallback');

    const northScale = await page.evaluate(() => {
      const player = Game.player;
      function measure(state, time) {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
        const ctx = canvas.getContext('2d');
        player.anim = { state, time };
        Art.drawChar(ctx, 'player', -Math.PI / 2, 32, 32, player);
        const data = ctx.getImageData(0, 0, 64, 64).data, rows = [];
        let bottom = -1;
        for (let y = 0; y < 64; y++) {
          let count = 0;
          for (let x = 0; x < 64; x++) if (data[(y * 64 + x) * 4 + 3]) count++;
          rows.push(count); if (count) bottom = y;
        }
        const width = Math.max(...rows);
        // 细长枪管不是身体：用有足够横向覆盖的第一行定位帽兜/肩部。
        return { bottom, width, height: bottom - rows.findIndex(count => count >= width * 0.5) + 1 };
      }
      return { idle: measure('idle', 0), shots: [measure('shoot', 0), measure('shoot', 0.08)] };
    });
    for (const shot of northScale.shots) {
      assert(Math.abs(shot.height - northScale.idle.height) <= 2, 'north shoot must retain body height');
      assert(shot.width >= northScale.idle.width - 2, 'north shoot must retain body width');
      assert.equal(shot.bottom, northScale.idle.bottom, 'north shoot feet must stay anchored');
    }
    console.log('OK: north-facing firing retains idle body scale and foot anchor');

    const death = await page.evaluate(() => {
      Game.startRun(); Game.enemies = [];
      const runs = Save.runs, time = Game.time;
      Game.player.hurt(999);
      const initial = Game.state === 'dying' && Game.player.anim.state === 'death';
      const seen = new Set();
      for (let i = 0; i < 36; i++) {
        Game.update(1 / 60);
        seen.add(Math.min(3, Math.floor(Game.player.anim.time * PLAYER_ANIMS.death.fps)));
      }
      const beforeEnd = Game.state === 'dying' && Save.runs === runs;
      for (let i = 0; i < 30; i++) Game.update(1 / 60);
      const result = { initial, beforeEnd, frames: seen.size, ended: Game.state === 'ended', settledOnce: Save.runs === runs + 1, worldFrozen: Game.time === time };
      for (let i = 0; i < 30; i++) Game.update(1 / 60);
      result.noDoubleSettlement = Save.runs === runs + 1;
      return result;
    });
    assert.deepEqual(death, { initial: true, beforeEnd: true, frames: 4, ended: true, settledOnce: true, worldFrozen: true, noDoubleSettlement: true });
    console.log('OK: full death animation before settlement, frozen world, no duplicate rewards');

    await page.goto(origin + '/' + encodeURIComponent('玩家动画.html'));
    await page.waitForFunction(() => window.previewReady);
    await page.evaluate(() => window.previewAt(0.2));
    await page.screenshot({ path: path.join(output, 'preview.png'), fullPage: true });
    assert.equal(await page.locator('canvas').count(), 28);

    const offline = await browser.newPage();
    offline.on('pageerror', error => errors.push(error.message));
    const external = []; offline.on('request', req => { if (req.url().includes('/assets/')) external.push(req.url()); });
    await offline.goto(pathToFileURL(path.join(root, '潮汐线.html')).href + '#play');
    await offline.waitForFunction(() => Object.keys(PLAYER_ANIMS).every(state => ART.charDirs.every(dir => Art.map['anim/player_' + state + '_' + dir])));
    assert.equal(await offline.evaluate(() => Object.keys(window.__SPRITES__).filter(key => key.startsWith('anim/')).length), 21);
    assert.equal(external.length, 0); assert.deepEqual(errors, []);
    console.log('OK: interactive preview, all 21 strips embedded offline, no browser errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
