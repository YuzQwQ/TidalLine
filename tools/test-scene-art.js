/* 场景素材浏览器集成检查。需要 playwright；先运行 node build.js。 */
const assert = require('assert/strict');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const manifest = require('../assets/asset-prompts.json');
const entries = [...manifest.assets, ...manifest.optional].flatMap(a => a.facing
  ? a.dirs.map(dir => a.group + '/' + a.id + '_' + dir) : [a.group + '/' + a.id]);
const output = path.join(root, 'output', 'scene-art');
const server = http.createServer((req, res) => {
  const target = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(target, (error, bytes) => {
    if (error) { res.writeHead(404).end(); return; }
    const ext = path.extname(target);
    res.writeHead(200, { 'Content-Type': ext === '.png' ? 'image/png' : ext === '.js' ? 'text/javascript' : 'text/html; charset=utf-8' }).end(bytes);
  });
});

(async () => {
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1480, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const origin = 'http://127.0.0.1:' + server.address().port;
    await page.goto(origin + '/index.html#play,4,4');
    await page.waitForFunction(keys => keys.every(key => Art.map[key]), entries);
    const specs = await page.evaluate(keys => keys.map(key => {
      const image = Art.map[key], canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const w=canvas.width,h=canvas.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, w, h).data;
      let visible = 0, padding = 0, opaque = 0, partial = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const a = pixels[(y * w + x) * 4 + 3];
        if (a) visible++;
        if (a === 255) opaque++;
        if (a > 0 && a < 255) partial++;
        if ((x < 2 || y < 2 || x >= w-2 || y >= h-2) && a) padding++;
      }
      return { key, width: image.naturalWidth, height: image.naturalHeight, visible, padding, opaque, partial };
    }), entries);
    for (const s of specs) {
      const entry=[...manifest.assets,...manifest.optional].find(a=>s.key===a.group+'/'+a.id||a.facing&&s.key.startsWith(a.group+'/'+a.id+'_'));const size=entry.canvas||[32,32];assert.equal(s.width,size[0],s.key);assert.equal(s.height,size[1],s.key);
      assert(s.visible > 16, s.key + ' is empty'); assert.equal(s.partial, 0, s.key);
      if (s.key.startsWith('tiles/')) assert.equal(s.opaque, s.width*s.height, s.key + ' terrain coverage');
      else assert.equal(s.padding, 0, s.key + ' transparent margin');
    }
    console.log('OK: all ' + entries.length + ' scene PNGs, dimensions, transparency, terrain coverage');

    assert(await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
      const ctx = canvas.getContext('2d');
      for (const id of ['door_open', 'door_side_open', 'sdoor_open', 'sdoor_side_open']) {
        ctx.clearRect(0, 0, 32, 32); ctx.drawImage(Art.get('props', id), 0, 0);
        const center = ctx.getImageData(14, 14, 4, 4).data;
        for (let i = 3; i < center.length; i += 4) if (center[i]) return false;
      }
      for (const id of ['door_side', 'sdoor_side']) {
        ctx.clearRect(0, 0, 32, 32); ctx.drawImage(Art.get('props', id), 0, 0);
        const data = ctx.getImageData(0, 0, 32, 32).data;
        let left = 32, right = -1, top = 32, bottom = -1;
        for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (data[(y * 32 + x) * 4 + 3]) {
          left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
        if (right - left + 1 > (bottom - top + 1) * 0.6) return false;
      }
      return true;
    }), 'open-door passage must be transparent; closed side doors must follow the north-south axis');

    assert(await page.evaluate(() => ART.chars.every(id => {
      for (const [angle, dir, flip] of [[0, 'e', false], [Math.PI, 'e', true], [Math.PI / 2, 's', false], [-Math.PI / 2, 'n', false]]) {
        const sprite = Art.char(id, angle);
        if (!sprite || !sprite.exact || sprite.img !== Art.map['chars/' + id + '_' + dir] || sprite.flip !== flip) return false;
      }
      const canvas = document.createElement('canvas'), reference = document.createElement('canvas');
      canvas.width = canvas.height = reference.width = reference.height = 32;
      const ctx = canvas.getContext('2d'), ref = reference.getContext('2d');
      Art.drawChar(ctx, id, Math.PI, 16, 16);
      ref.drawImage(Art.map['chars/' + id + '_e'], 0, 0);
      const a = ctx.getImageData(0, 0, 32, 32).data, b = ref.getImageData(0, 0, 32, 32).data;
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) for (let k = 0; k < 4; k++) {
        if (a[(y * 32 + x) * 4 + k] !== b[(y * 32 + 31 - x) * 4 + k]) return false;
      }
      return true;
    })), 'all characters need three exact directions and correct left-facing pixels');
    assert(await page.evaluate(() => DECOR.every(d => MAP_ROWS[d.y][d.x] === '.' || MAP_ROWS[d.y][d.x] === '~' || MAP_ROWS[d.y][d.x] === ',')));

    assert(await page.evaluate(() => {
      Game.state = 'ended';
      const player = Game.player, old = { x: player.x, y: player.y };
      const start = M.playerSpawn;
      try {
        for (const box of Game.boxes) {
          if (M.walkable(box.tx, box.ty)) return false;
          // 至少有一个能实际触发箱柜交互的操作面；邻近门时另一侧可能优先选门。
          const face = [[1,0],[-1,0],[0,1],[0,-1]].find(([dx,dy]) => {
            if (!M.walkable(box.tx + dx, box.ty + dy) || !M.findPath(start.x, start.y, box.tx + dx, box.ty + dy)) return false;
            const offset = CFG.TILE / 2 + player.r + 1;
            player.x = box.x + dx * offset; player.y = box.y + dy * offset;
            const interaction = Game.findInteractable();
            return canStand(player.x, player.y, player.r) && interaction && interaction.type === 'box' && interaction.obj === box;
          });
          if (!face) return false;
          const [dx, dy] = face, offset = CFG.TILE / 2 + player.r + 1;
          player.x = box.x + dx * offset; player.y = box.y + dy * offset;
          if (!canStand(player.x, player.y, player.r)) return false;
          const interaction = Game.findInteractable();
          if (!interaction || interaction.type !== 'box' || interaction.obj !== box) return false;
          const actor = { x: player.x, y: player.y, r: player.r };
          moveEntity(actor, -dx * CFG.TILE * 4, -dy * CFG.TILE * 4);
          if (!canStand(actor.x, actor.y, actor.r) || M.tx(actor.x) === box.tx && M.ty(actor.y) === box.ty) return false;
          const opened = box.opened; box.opened = true;
          if (M.walkable(box.tx, box.ty)) return false;
          box.opened = opened;
        }
        return DECOR.every(prop => M.walkable(prop.x, prop.y) === !!prop.ground) &&
          M.extracts.every(ex => !!M.findPath(start.x, start.y, ex.x, ex.y));
      } finally { player.x = old.x; player.y = old.y; }
    }), 'all containers must block movement while retaining a reachable interactive face; decals/exits stay walkable');
    console.log('OK: physical container/furniture collision, interaction faces, ground decals, escape routes');

    // 捕获真实渲染调用，确认开关门、三种容器、装饰、尸体和角色都使用贴图。
    const rendered = await page.evaluate(() => {
      Game.state = 'ended'; M.seen.fill(1); M.visible.fill(1);
      const calls = new Set(), ctx = Game.ctx, original = ctx.drawImage;
      ctx.drawImage = function(image, ...args) {
        for (const [key, value] of Object.entries(Art.map)) if (value === image) calls.add(key);
        return original.call(this, image, ...args);
      };
      try {
        for (const [i, key] of ['scav', 'echo', 'guard'].entries()) {
          Game.corpses.push({ x: M.cx(4 + i), y: M.cy(4), key, opened: false, items: [] });
        }
        Game.renderTerrain(ctx, 0, 0); Game.renderObjects(ctx, 0, 0); Game.renderEntities(ctx, 0, 0);
        const doors = M.grid.flat().filter(tile => tile.door).map(tile => ({
          door: tile.door, axis: tile.door.axis, open: tile.door.open
        }));
        for (const axis of ['horizontal', 'vertical']) for (const open of [false, true]) {
          for (const { door } of doors) { door.axis = axis; door.open = open; }
          Game.renderObjects(ctx, 0, 0);
        }
        for (const saved of doors) { saved.door.axis = saved.axis; saved.door.open = saved.open; }
        Game.cam.x = 0; Game.cam.y = 0; Game.render();
      } finally { ctx.drawImage = original; }
      return [...calls];
    });
    for (const key of entries.filter(key => key.startsWith('props/'))) assert(rendered.includes(key), key + ' must be drawn');
    for (const id of ['player', 'scav', 'echo', 'guard']) assert(rendered.some(key =>
      key.startsWith('chars/' + id + '_') || id === 'player' && key.startsWith('anim/player_')), id);
    assert(await page.evaluate(() => {
      for (const safe of [false, true]) for (const open of [false, true]) for (const axis of ['horizontal', 'vertical']) {
        const key = (safe ? 'sdoor' : 'door') + (axis === 'vertical' ? '_side' : '') + (open ? '_open' : '');
        if (Art.door({ safe, open, axis }) !== Art.get('props', key)) return false;
      }
      return true;
    }), 'every door kind/axis/state must select its exact PNG');
    await page.screenshot({ path: path.join(output, 'gameplay.png') });
    await page.evaluate(() => { Game.debug = true; Game.render(); });
    await page.screenshot({ path: path.join(output, 'collision.png') });
    await page.evaluate(() => { Game.debug = false; Game.render(); });
    console.log('OK: character facing/mirroring, valid decoration positions, live render branches');

    await page.goto(origin + '/' + encodeURIComponent('美术清单.html'));
    await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
    assert.equal(await page.locator('.asset.done').count(), manifest.assets.length + manifest.optional.length);
    await page.screenshot({ path: path.join(output, 'art-sheet.png'), fullPage: true });

    const offline = await browser.newPage();
    offline.on('pageerror', error => errors.push(error.message));
    const external = [];
    offline.on('request', request => { if (/\/assets\//.test(request.url())) external.push(request.url()); });
    await offline.goto(pathToFileURL(path.join(root, '潮汐线.html')).href + '#play');
    await offline.waitForFunction(keys => keys.every(key => Art.map[key]), entries);
    assert.equal(external.length, 0, 'offline game cannot load external PNGs');
    assert(await offline.evaluate(keys => keys.every(key => window.__SPRITES__[key].startsWith('data:image/png;base64,')), entries));
    await offline.evaluate(async () => {
      await Art.init({ ...window.__SPRITES__, 'chars/player_n': 'data:image/png;base64,invalid',
        'props/desk': 'data:image/png;base64,invalid', 'props/door_side': 'data:image/png;base64,invalid' });
    });
    assert(await offline.evaluate(() => {
      const sprite = Art.char('player', -Math.PI / 2);
      return sprite && !sprite.exact && !Art.get('props', 'desk') &&
        Art.door({ safe: false, open: false, axis: 'vertical' }) === Art.get('props', 'door');
    }));
    assert.deepEqual(errors, []);
    console.log('OK: art sheet, offline bundle, missing-image fallback, no browser errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
