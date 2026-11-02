/* Read-only review of the design package and portrait gallery. Never opens the game. */
const fs = require('fs'), path = require('path'), http = require('http');
const assert = require('assert/strict'), { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const designDir = path.join(root, 'design/merchants');
const artDir = path.join(root, 'assets/npc-art/merchants');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (error, data) => {
    const type = file.endsWith('.png') ? 'image/png' : file.endsWith('.json') ? 'application/json' : 'text/html;charset=utf-8';
    if (error) return res.writeHead(404).end();
    res.writeHead(200, { 'Content-Type': type }).end(data);
  });
});
(async () => {
  let browser;
  const errors = [], failed = [], checks = [];
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) failed.push(response.url());
    });
    const origin = 'http://127.0.0.1:' + server.address().port;
    const assertImages = async () => {
      await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0));
      assert.deepEqual(await page.locator('img').evaluateAll(images => images.map(img => [img.naturalWidth, img.naturalHeight])), [[768, 960], [768, 960], [768, 960]]);
    };
    const assertNarrow = async () => {
      for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 850 });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'horizontal overflow at ' + width + ': ' + page.url());
        checks.push({ page: new URL(page.url()).pathname, width, noHorizontalOverflow: true });
      }
    };
    await page.goto(origin + '/design/merchants/index.html');
    await assertImages();
    assert.equal(await page.locator('.merchant').count(), 3);
    assert.equal(await page.locator('.quests article').count(), 18);
    for (const id of ['merchant_armor', 'merchant_guns', 'merchant_doctor']) {
      await page.locator('button[data-target="' + id + '"]').click();
      assert.equal(await page.locator('.merchant:visible').count(), 1);
      assert(await page.locator('.merchant[data-id="' + id + '"]').isVisible());
    }
    await page.locator('button[data-target="all"]').click();
    assert.equal(await page.locator('.merchant:visible').count(), 3);
    await page.screenshot({ path: path.join(designDir, 'preview.png') });
    await assertNarrow();
    await page.screenshot({ path: path.join(designDir, 'preview-mobile.png') });
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.goto(origin + '/assets/npc-art/merchants/index.html');
    await assertImages();
    assert.equal(await page.locator('article').count(), 3);
    await page.screenshot({ path: path.join(artDir, 'preview.png') });
    await assertNarrow();
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    const quality = { status: 'passed', scope: 'design_only', portraits: 3, size: [768, 960], navigation: 'all_three_filters_passed', browserErrors: errors, failedResources: failed, responsiveChecks: checks };
    fs.writeFileSync(path.join(artDir, 'quality.json'), JSON.stringify(quality, null, 2) + '\n');
    console.log('PASS: 3 portraits, 18 quest cards, merchant navigation, desktop and 320/390px layouts; no game/storage access');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
