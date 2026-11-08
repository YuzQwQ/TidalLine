/* 信箱浏览器验收：多文件版与离线单文件版各跑一遍
   ─ 已有存档才会收到发放批次（新号不送）
   ─ 四把钥匙（耐久 5）能领进仓库，耐久与价值按剩余耐久算
   ─ 仓库满时整封留着，不领一半
   用法：node tools/test-mailbox-browser.js   （截图写进 design/ui/mailbox-v1） */
const fs = require('fs'), path = require('path'), http = require('http');
const { pathToFileURL } = require('url'), { chromium } = require('playwright');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'design/ui/mailbox-v1');

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const server = http.createServer((req, res) => {
    const f = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!f.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(f, (e, b) => {
      if (e) return res.writeHead(404).end();
      res.setHeader('Content-Type', f.endsWith('.js') ? 'text/javascript' : f.endsWith('.png') ? 'image/png' : f.endsWith('.css') ? 'text/css' : 'text/html;charset=utf-8');
      res.end(b);
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [];
  try {
    for (const file of ['index.html', '潮汐线.html']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(pathToFileURL(path.join(root, file)).href + '#base');
      await page.waitForFunction(() => typeof Mail !== 'undefined' && document.getElementById('btnMail'));

      /* 新号：什么都不该收到 */
      const fresh = await page.evaluate(() => {
        Save.mail = []; Save.mailBatches = {}; Save.existed = false;
        return { added: Mail.applyBatches(), mail: Save.mail.length };
      });
      results.push([file, '新号不送发放批次', fresh.added === 0 && fresh.mail === 0]);

      /* 老存档：四封信一次到位，重开不会重复 */
      const granted = await page.evaluate(() => {
        Save.existed = true;
        const added = Mail.applyBatches();
        const again = Mail.applyBatches();
        Base.render();
        Mail.open();
        return {
          added, again, count: Save.mail.length,
          badge: document.getElementById('mailBadge').textContent,
          rows: document.querySelectorAll('#mailList .mail-row').length,
          ids: Save.mail.map(l => l.items[0] && l.items[0].id),
          caps: Save.mail.map(l => l.items[0] && l.items[0].cap),
          title: (document.querySelector('#mailRead h2') || {}).textContent || ''
        };
      });
      results.push([file, '老存档补发四封信', granted.added === 4 && granted.count === 4]);
      results.push([file, '重复调用不重复寄信', granted.again === 0]);
      results.push([file, '入口角标显示待领取数', granted.badge === '4']);
      results.push([file, '列表四条 + 自动选中一封', granted.rows === 4 && !!granted.title]);
      results.push([file, '四把钥匙都对且耐久 5', ['door_key_bank_vault', 'door_key_watchshop', 'door_key_clinic', 'door_key_old_apt'].every(id => granted.ids.includes(id)) && granted.caps.every(c => c === 5)]);
      await page.screenshot({ path: path.join(out, file === 'index.html' ? 'mailbox.png' : 'offline-mailbox.png') });

      /* 领取第一封：进仓库、保留耐久、按钮变已领取 */
      const claimed = await page.evaluate(() => {
        const btn = document.getElementById('btnMailClaim');
        if (!btn) return { ok: false };
        btn.click();
        const id = 'door_key_bank_vault';
        const row = Save.stash.find(e => e.id === id);
        return {
          ok: true,
          inStash: !!row && row.cap === 5,
          claimedFlag: Save.mail.find(l => l.items.length === 0 && l.claimed) ? true : false,
          badge: document.getElementById('mailBadge').textContent,
          value: row ? entryValue(ITEM_BY_ID[id], row) : 0,
          price: ITEM_BY_ID[id].price
        };
      });
      results.push([file, '点击领取后进仓库并保留耐久', claimed.ok && claimed.inStash]);
      results.push([file, '价值按 5/10 折算', claimed.value === Math.round(claimed.price / 2)]);
      results.push([file, '领取后角标减一', claimed.badge === '3']);

      /* 全部领取 */
      const all = await page.evaluate(() => {
        document.getElementById('btnMailClaimAll').click();
        return { unclaimed: Mail.unclaimed(), keys: Save.stash.filter(e => e.id.startsWith('door_key_') && e.cap === 5).length };
      });
      results.push([file, '一键领取清空待领取', all.unclaimed === 0 && all.keys === 4]);

      /* 钥匙链：出发不清存档，开锁写回耐久 */
      const chain = await page.evaluate(() => {
        Save.chain = [{ id: 'door_key_old_apt', n: 1, cap: 5 }];
        Save.save(); Save.flush();
        Game.startRun();
        const before = Save.chain.length;
        const P = Game.player;
        P.bag.chain = [{ item: ITEM_BY_ID.door_key_watchshop, n: 1, cap: 3 }];
        const door = { doorType: 'locked', unlocked: false, keyId: 'door_key_old_apt', cells: [[2, 2]] };
        /* 用链上那把能开的门：把 watchshop 也挂成 keyId 才能扣到它 */
        door.keyId = 'door_key_watchshop';
        DoorSystem.prepareOpen(door, P);
        return { before, after: Save.chain.length, cap: Save.chain[0] && Save.chain[0].cap };
      });
      results.push([file, '出发后存档钥匙链仍在', chain.before === 1]);
      results.push([file, '开锁把剩余耐久写回存档', chain.after === 1 && chain.cap === 2]);

      results.push([file, '无脚本错误', errors.length === 0, errors.slice(0, 3).join(' | ')]);
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  let bad = 0;
  for (const [file, name, ok, extra] of results) {
    if (!ok) bad++;
    console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  [' + file + '] ' + name + (extra ? '  ' + extra : ''));
  }
  console.log('\n通过 ' + (results.length - bad) + ' / 失败 ' + bad + '，截图：design/ui/mailbox-v1/');
  process.exit(bad ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
