/* 浏览器集成检查：需要 playwright；先运行 node build.js。 */
const assert = require('assert/strict');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output', 'item-icons');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const target = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(target, (error, bytes) => {
    if (error) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream' }).end(bytes);
  });
});

(async () => {
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // 延迟图片返回，验证清单初次渲染早于贴图加载时也能刷新。
    await page.route('**/assets/items/*.png', async route => {
      await new Promise(resolve => setTimeout(resolve, 100));
      await route.continue();
    });
    await page.goto(origin + '/index.html#base', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      Save.stash = ITEMS.map(item => ({ id: item.id, n: 1 }));
      Base.renderStash();
    });
    await page.waitForFunction(() => ITEMS.every(item => Icons.get(item.id)));
    await page.waitForFunction(() => document.querySelectorAll('#stashList img').length === ITEMS.length);
    assert.equal(await page.locator('#stashList img').count(), 33);
    const specs = await page.evaluate(() => ITEMS.map(item => {
      const image = Icons.get(item.id);
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 48;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, 48, 48).data;
      let visible = 0, invalidAlpha = 0, margin = 0;
      for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
        const alpha = pixels[(y * 48 + x) * 4 + 3];
        if (alpha) visible++;
        if (alpha !== 0 && alpha !== 255) invalidAlpha++;
        if ((x < 4 || y < 4 || x >= 44 || y >= 44) && alpha) margin++;
      }
      return { id: item.id, width: image.naturalWidth, height: image.naturalHeight, visible, invalidAlpha, margin };
    }));
    for (const icon of specs) {
      assert.equal(icon.width, 48, icon.id); assert.equal(icon.height, 48, icon.id);
      assert(icon.visible > 50, icon.id + ' is empty');
      assert.equal(icon.invalidAlpha, 0, icon.id + ' alpha');
      assert.equal(icon.margin, 0, icon.id + ' padding');
    }
    await page.screenshot({ path: path.join(output, 'warehouse.png') });
    console.log('OK: 33 local PNGs, dimensions, binary transparency, padding, initial warehouse refresh');

    await page.evaluate(() => {
      Base.close(); Game.startRun(Save.loadout);
      Game.player.bag.slots = ITEMS.slice(0, 24).map(item => ({ item, n: 1 }));
      Game.player.bag.safe = ITEMS.slice(24, 28).map(item => ({ item, n: 1 }));
      if (!Game.bagOpen) Game.toggleBag(); else Game.renderBag();
      Game.openLoot({ kind: 'heavy', items: ITEMS.map(item => ({ item, n: 1, known: true })) });
    });
    assert.equal(await page.locator('#bagGrid img').count(), 24);
    assert.equal(await page.locator('#safeGrid img').count(), 4);
    assert(await page.locator('#safeGrid img').evaluateAll(images => images.every(image => {
      const icon = image.getBoundingClientRect(), cell = image.parentElement.getBoundingClientRect();
      return icon.width >= 40 && icon.left >= cell.left && icon.right <= cell.right && icon.bottom <= cell.bottom;
    })), 'safe-box icons must fit within their cells');
    assert.equal(await page.locator('#lootList img').count(), 33);
    await page.evaluate(() => Game.closeLoot());
    await page.screenshot({ path: path.join(output, 'inventory.png') });
    console.log('OK: loot, inventory, safe box');

    await page.goto(origin + '/' + encodeURIComponent('物品清单.html'));
    await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth === 48));
    assert.equal(await page.locator('.thumb img').count(), 33);
    await page.screenshot({ path: path.join(output, 'item-sheet.png'), fullPage: true });
    console.log('OK: item sheet shows all 33 icons');

    const offline = await browser.newPage();
    offline.on('pageerror', error => errors.push(error.message));
    const externalImages = [];
    offline.on('request', request => {
      if (/\/assets\/items\//.test(request.url())) externalImages.push(request.url());
    });
    await offline.goto(pathToFileURL(path.join(root, '潮汐线.html')).href + '#play,4,6,ui');
    await offline.waitForFunction(() => ITEMS.every(item => Icons.get(item.id)));
    assert.equal(await offline.evaluate(() => {
      const sprites = window.__SPRITES__ || window.__ICONS__;
      return Object.keys(sprites).filter(key => key.startsWith('items/') || !key.includes('/')).length;
    }), 33);
    assert.equal(externalImages.length, 0, 'single-file game must not load external icons');
    await offline.evaluate(async () => {
      const broken = { ...(window.__SPRITES__ || window.__ICONS__),
        'items/life01': 'data:image/png;base64,invalid', life01: 'data:image/png;base64,invalid' };
      await Icons.init(broken);
    });
    assert(await offline.evaluate(() => !Icons.get('life01') && Icons.tag('life01').includes(' ph')));
    assert(await offline.evaluate(() => !!Icons.get('life02')));
    assert.deepEqual(errors, []);
    console.log('OK: offline embedded icons, missing-image fallback, no browser errors');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => server.close());
