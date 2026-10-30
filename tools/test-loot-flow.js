/* 容器可反复搜刮 + 背包丢弃 的浏览器端验收。
   node tools/test-loot-flow.js
   覆盖：右键菜单出现、丢弃生成地面物品堆、同格合并、物品堆搜空消失、容器拿一半还能再开。
   顺带确认 index.html 与 潮汐线.html 两个入口都没有 JS 报错。 */
const path = require('path');
const { pathToFileURL } = require('url');

let chromium = null;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  console.log('跳过：本机没装 playwright（npm i -D playwright 后再跑）');
  process.exit(0);
}

const ROOT = path.resolve(__dirname, '..');

function assert(cond, msg) {
  if (!cond) throw new Error('断言失败：' + msg);
}

async function run(file) {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  try {
    await page.goto(pathToFileURL(path.join(ROOT, file)).href);
    await page.waitForFunction(() => typeof Game !== 'undefined' && !!Game.player);

    /* 开局并清场：不想要敌人打扰这次验收 */
    await page.evaluate(() => {
      Game.startRun({ ammo: 12, bandage: 1, stone: 0 });
      Game.enemies = [];
      Game.state = 'playing';
      document.getElementById('startVeil').style.display = 'none';
    });

    /* ---- 1. 背包右键出菜单 ---- */
    await page.evaluate(() => {
      Game.player.bag.slots = [{ item: ITEM_BY_ID['heal01'], n: 2 }];
      if (!Game.bagOpen) Game.toggleBag();
      Game.renderBag();
    });
    await page.locator('#bagGrid .cell').first().click({ button: 'right' });
    await page.waitForSelector('#ctxMenu', { state: 'visible' });
    const menuText = await page.locator('#ctxMenu').innerText();
    assert(/丢弃/.test(menuText), '右键菜单里应该有「丢弃」，实际：' + menuText);
    assert(/查看详情/.test(menuText), '右键菜单里应该保留「详情」');

    /* ---- 2. 点丢弃 → 地面生成物品堆 ---- */
    const before = await page.evaluate(() => Game.boxes.length);
    await page.locator('#ctxMenu .citem.danger').click();
    await page.waitForTimeout(60);
    const drop = await page.evaluate(() => {
      const piles = Game.boxes.filter(b => b.pile);
      const p = piles[0] || null;
      return {
        piles: piles.length,
        added: Game.boxes.length,
        bagSlots: Game.player.bag.slots.length,
        known: p ? p.items.every(e => e.known === true) : false,
        n: p && p.items[0] ? p.items[0].n : 0,
        onPlayerTile: p ? (p.tx === Math.floor(Game.player.x / CFG.TILE) &&
                           p.ty === Math.floor(Game.player.y / CFG.TILE)) : false
      };
    });
    assert(drop.piles === 1, '应该生成 1 个物品堆，实际 ' + drop.piles);
    assert(drop.added === before + 1, '容器总数应该 +1');
    assert(drop.bagSlots === 0, '背包那一格应该空出来，实际 ' + drop.bagSlots);
    assert(drop.known === true, '丢下的东西应该直接可见');
    assert(drop.n === 2, '整叠一起丢，实际 ' + drop.n);
    assert(drop.onPlayerTile, '物品堆应该落在脚下那一格');

    /* 物品堆要画出来，不是隐形容器 */
    await page.evaluate(() => { if (Game.bagOpen) Game.toggleBag(); });
    await page.screenshot({ path: path.join(ROOT, 'temp-pile.png') });

    /* ---- 3. 同格再丢一件 → 并进同一堆 ---- */
    await page.evaluate(() => {
      Game.player.bag.slots = [{ item: ITEM_BY_ID['heal02'] || ITEM_BY_ID['heal01'], n: 1 }];
      Game.renderBag();
      if (!Game.bagOpen) Game.toggleBag();
      Game.dropFromBag(0);
    });
    const merged = await page.evaluate(() => {
      const piles = Game.boxes.filter(b => b.pile);
      return { piles: piles.length, items: piles[0] ? piles[0].items.length : 0 };
    });
    assert(merged.piles === 1, '同格丢弃不该刷第二个堆，实际 ' + merged.piles);
    assert(merged.items === 2, '堆里应该是两条不同物品，实际 ' + merged.items);

    /* ---- 4. 拿空 → 物品堆消失 ---- */
    const gone = await page.evaluate(() => {
      const p = Game.boxes.find(b => b.pile);
      Game.openLoot(p);
      const opened = Game.lootOpen === p;
      p.items = p.items.map(() => null);
      Game.syncBoxState(p);
      return { opened, stillThere: Game.boxes.includes(p), lootOpen: Game.lootOpen };
    });
    assert(gone.opened, '物品堆应该能打开');
    assert(!gone.stillThere, '物品堆搜空后应该消失');
    assert(gone.lootOpen === null, '搜空后应该自动关掉面板');

    /* ---- 5. 容器拿一半后仍可再次交互 ---- */
    const reopen = await page.evaluate(() => {
      const b = Game.boxes.find(x => !x.pile && x.items.filter(Boolean).length >= 2);
      if (!b) return { skip: true };
      /* 站到容器旁边，走真实交互流程 */
      Game.player.x = b.x; Game.player.y = b.y + CFG.TILE;
      Game.player.vx = 0; Game.player.vy = 0;
      Game.action = null;
      Game.handleInteract();
      if (Game.action) { Game.action.t = Game.action.total + 1; Game.updateAction(0.016); }
      const openedFirst = Game.lootOpen === b;
      Game.lootOpen.items[0] = null;      // 只拿一件
      Game.syncBoxState(b);
      Game.closeLoot();
      const interactable = Game.boxHasItems(b) && !b.opened;
      /* 再交互：应该直接开，不重新读条 */
      Game.player.x = b.x; Game.player.y = b.y + CFG.TILE;
      Game.handleInteract();
      const reopened = Game.lootOpen === b;
      const noDelay = !Game.action;
      Game.closeLoot();
      return { openedFirst, interactable, reopened, noDelay, searched: b.searched };
    });
    if (!reopen.skip) {
      assert(reopen.openedFirst, '第一次应该能打开容器');
      assert(reopen.interactable, '拿了一半的容器应该仍可交互');
      assert(reopen.searched === true, '容器应该记住掀开过');
      assert(reopen.reopened, '第二次应该能重新打开');
      assert(reopen.noDelay, '第二次打开不应再有读条');
    }

    assert(errors.length === 0, '页面不应有 JS 报错：' + errors.join(' | '));
    console.log('  ok   ' + file + '  菜单/丢弃/合并/消失/重开 全部通过');
  } finally {
    await browser.close();
  }
}

(async () => {
  try {
    await run('index.html');
    await run('潮汐线.html');
    console.log('\n全部通过');
  } catch (e) {
    console.error('FAIL ' + e.message);
    process.exit(1);
  }
})();
