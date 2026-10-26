/* 装备图标浏览器检查，需要 playwright。先生成清单并运行 build.js。 */
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output/gear-icons');
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
    const page = await browser.newPage({ viewport: { width: 1480, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/assets/gear/*.png', async route => {
      await new Promise(resolve => setTimeout(resolve, 120)); await route.continue();
    });
    const origin = 'http://127.0.0.1:' + server.address().port;
    await page.goto(origin + '/index.html#base', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      Save.gear.helmet = GEAR.make('helmet', 1); Save.gear.body = GEAR.make('body', 1); Base.renderGear();
    });
    await page.waitForFunction(() => ART.gear.every(id => Icons.gear[id]));
    await page.waitForFunction(() => document.querySelectorAll('#baseGear img').length === 6);
    const specs = await page.evaluate(() => ART.gear.map(id => {
      const image = Icons.gear[id], canvas = document.createElement('canvas'); canvas.width = canvas.height = 48;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, 48, 48).data;
      let opaque = 0, partial = 0, padding = 0;
      for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
        const a = data[(y * 48 + x) * 4 + 3]; if (a) opaque++;
        if (a && a !== 255) partial++;
        if ((x < 4 || y < 4 || x >= 44 || y >= 44) && a) padding++;
      }
      return { id, width: image.naturalWidth, height: image.naturalHeight, opaque, partial, padding };
    }));
    assert.equal(specs.length, 17);
    for (const s of specs) {
      assert.equal(s.width, 48, s.id); assert.equal(s.height, 48, s.id);
      assert(s.opaque > 60, s.id); assert.equal(s.partial, 0, s.id); assert.equal(s.padding, 0, s.id);
    }
    console.log('OK: 17 icons, dimensions, hard transparency, 4px margins, first-load base refresh');

    for (let lv = 1; lv <= 6; lv++) {
      await page.evaluate(level => {
        Save.gear.helmet = GEAR.make('helmet', level); Save.gear.body = GEAR.make('body', level); Base.renderGear();
      }, lv);
      assert.equal(await page.locator('#baseGear img[src$="/helmet' + lv + '.png"]').count(), 1);
      assert.equal(await page.locator('#baseGear img[src$="/body' + lv + '.png"]').count(), 1);
    }
    await page.evaluate(() => { Save.gear.weapons[0] = 'smg'; Base.renderGear(); });
    assert.equal(await page.locator('#baseGear img[src$="/smg.png"]').count(), 1);
    assert(await page.locator('#baseGear img').evaluateAll(images => images.every(image => {
      const box = image.getBoundingClientRect(), cell = image.parentElement.getBoundingClientRect();
      return box.width > 0 && box.left >= cell.left && box.right <= cell.right && box.bottom <= cell.bottom;
    })));
    await page.screenshot({ path: path.join(output, 'base.png') });
    console.log('OK: all six armour levels, switched weapon, base icon layout');

    await page.evaluate(() => {
      Base.close(); Game.startRun(Save.loadout); Game.state = 'ended';
      if (!Game.bagOpen) Game.toggleBag(); else Game.renderBag();
      Game.openLoot({ enemy: { t: { name: '拾荒者' } }, items: [
        { gun: 'rifle' }, { gear: GEAR.make('helmet', 4) }, { gear: GEAR.make('body', 5) }
      ] }, true);
    });
    assert.equal(await page.locator('#eqStrip img').count(), 6);
    assert.equal(await page.locator('#lootGear img').count(), 3);
    await page.screenshot({ path: path.join(output, 'inventory-loot.png') });
    console.log('OK: inventory equipment strip and corpse equipment icons');

    await page.goto(origin + '/' + encodeURIComponent('装备清单.html'));
    await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth === 48));
    assert.equal(await page.locator('.thumb img').count(), 17);
    await page.screenshot({ path: path.join(output, 'gear-sheet.png'), fullPage: true });

    const offline = await browser.newPage(); const external = [];
    offline.on('pageerror', error => errors.push(error.message));
    offline.on('request', req => { if (req.url().includes('/assets/')) external.push(req.url()); });
    await offline.goto(pathToFileURL(path.join(root, '潮汐线.html')).href + '#base');
    await offline.waitForFunction(() => ART.gear.every(id => Icons.gear[id]));
    assert.equal(await offline.evaluate(() => Object.keys(window.__SPRITES__).filter(key => key.startsWith('gear/')).length), 17);
    assert.equal(external.length, 0);
    assert(await offline.evaluate(() => {
      const saved = Icons.gear.rifle; Icons.gear.rifle = null;
      const fallback = Icons.gearIcon('rifle', '步'); Icons.gear.rifle = saved;
      return fallback.includes('步') && !fallback.includes('<img');
    }));
    assert.deepEqual(errors, []);
    console.log('OK: gear sheet, offline embedded PNGs, missing-image text fallback, no browser errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
