/* 容量 / 次数 / 耐久条：浏览器验收（多文件版 + 离线单文件版）
   node tools/test-medcap-bar-browser.js
   产出截图：design/ui/medcap-v1/

   检查医疗品（healCap 容量式 / effect.uses 次数式）与钥匙（maxDur 耐久）在所有显示位置
   都换成和护甲耐久条同款的 .dbar：格子、仓库、详情浮窗、快捷栏、轮盘、
   信件附件卡。护甲仍是原来的三段耐久条。 */
const fs = require('fs'), path = require('path'), http = require('http');
const { pathToFileURL } = require('url'), { chromium } = require('playwright');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'design/ui/medcap-v1');

const FULL_HEAL = { id: 'heal03', n: 1 };                 // 家庭急救包 120 容量，满
const USED_HEAL = { id: 'heal03', n: 1, cap: 30 };        // 120 → 30（25%）
const FULL_USES = { id: 'heal12', n: 1 };                 // 手术系统 8 次，满
const USED_USES = { id: 'heal12', n: 1, cap: 2 };         // 8 → 2（25%）
const KEY = { id: 'door_key_old_apt', n: 1, cap: 5 };     // 钥匙：仍是数字角标
const PLAIN = { id: 'life01', n: 1 };                     // 普通物品：没有条

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const server = http.createServer((req, res) => {
    const f = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!f.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(f, (e, b) => {
      if (e) return res.writeHead(404).end();
      res.setHeader('Content-Type', f.endsWith('.js') ? 'text/javascript' : f.endsWith('.png') ? 'image/png'
        : f.endsWith('.css') ? 'text/css' : f.endsWith('.json') ? 'application/json' : 'text/html;charset=utf-8');
      res.end(b);
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [];
  const ok = (file, name, cond, extra) => results.push([file, name, !!cond, extra || '']);
  /* 浏览器会把 style.width 的 25.00% 归一化成 25%，统一按数值比 */
  const pct = v => parseFloat(String(v == null ? '' : v).replace('%', '')) || 0;
  try {
    for (const file of ['index.html', '潮汐线.html']) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 2 });
      const page = await ctx.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const url = (file === 'index.html' ? 'http://127.0.0.1:' + server.address().port + '/' + file
        : pathToFileURL(path.join(root, file)).href);

      /* ---------------- 藏身处：仓库格 / 背包格 / 详情浮窗 ---------------- */
      await page.goto(url + '#base');
      await page.waitForFunction(() => typeof CapBar !== 'undefined' && typeof Base !== 'undefined' && Game.state === 'base');

      const base = await page.evaluate(entries => {
        const probe = el => {
          const bar = el.querySelector('.dbar-capacity'), cap = el.querySelector('.cap');
          if (!bar) return { bar: false, cap: cap && cap.textContent, dbar: !!el.querySelector('.dbar'), hasDbar: el.classList.contains('has-dbar') };
          const g = bar.querySelector('.dg'), s = bar.querySelector('.ds');
          return {
            bar: true, g: g.style.width, s: s.style.width, title: bar.title,
            label: bar.getAttribute('aria-label'), display: getComputedStyle(bar).display,
            cap: cap && cap.textContent, hasDbar: el.classList.contains('has-dbar')
          };
        };
        Save.stash = Object.values(entries).map(e => ({ ...e }));
        Save.bag = []; Save.safe = []; Save.chain = [];
        Base.filter = 'all'; Base.page = 0;
        Base.renderStash();
        const stashCells = [...document.querySelectorAll('#stashGrid .scell:not(.empty)')];
        const find = id => stashCells.find(c => (c.title || '').includes(id));
        const cells = {};
        for (const k of Object.keys(entries)) {
          const c = Base.makeBagCell({ ...entries[k] });
          document.body.appendChild(c);
          cells[k] = probe(c);
          c.remove();
        }
        /* 仓库里按名字认格子（title 里带完整物品名） */
        const byName = name => {
          const c = stashCells.find(c => (c.title || '').startsWith(name));
          return c ? probe(c) : null;
        };
        return {
          cells,
          stash: {
            full: byName('家庭急救包'), used: byName('家庭急救包'),
            surgery: byName('模块化战地手术系统'), key: byName('老公寓3号房钥匙')
          },
          stashBars: [...document.querySelectorAll('#stashGrid .dbar-capacity')].length,
          stashCaps: [...document.querySelectorAll('#stashGrid .scell .cap')].length,
          readouts: Object.values(entries).map(e => CapBar.readout({ ...e })),
          htmlKey: CapBar.html({ ...entries.KEY }),
          htmlPlain: CapBar.html({ ...entries.PLAIN }),
          ratioUsed: CapBar.ratio({ ...entries.USED_HEAL }),
          ratioUses: CapBar.ratio({ ...entries.USED_USES }),
          mailCard: Mail.card({ ...entries.USED_HEAL }),
          mailKeyCard: Mail.card({ ...entries.KEY }),
          attach: (() => {
            const d = document.createElement('div');
            CapBar.attach(d, { ...entries.FULL_HEAL });
            CapBar.attach(d, { ...entries.FULL_HEAL });
            return d.querySelectorAll('.dbar-capacity').length;
          })()
        };
      }, { FULL_HEAL, USED_HEAL, FULL_USES, USED_USES, KEY, PLAIN });

      ok(file, '容量式医疗品挂上同款进度条（满）',
        base.cells.FULL_HEAL.bar && pct(base.cells.FULL_HEAL.g) === 100 && pct(base.cells.FULL_HEAL.s) === 0,
        JSON.stringify(base.cells.FULL_HEAL));
      ok(file, '容量式医疗品不再用数字角标', !base.cells.FULL_HEAL.cap && base.cells.FULL_HEAL.hasDbar);
      ok(file, '残容量 30/120 → 绿 25% / 灰 75%',
        pct(base.cells.USED_HEAL.g) === 25 && pct(base.cells.USED_HEAL.s) === 75,
        base.cells.USED_HEAL.g + ' / ' + base.cells.USED_HEAL.s);
      ok(file, '次数式医疗品满次数整条绿',
        base.cells.FULL_USES.bar && pct(base.cells.FULL_USES.g) === 100 && /8 \/ 8/.test(base.cells.FULL_USES.title),
        base.cells.FULL_USES.title);
      ok(file, '次数式 2/8 → 绿 25%',
        pct(base.cells.USED_USES.g) === 25 && /剩余次数 2 \/ 8/.test(base.cells.USED_USES.title),
        base.cells.USED_USES.title);
      ok(file, '进度条没有被修理窗样式压成 block',
        base.cells.FULL_HEAL.display === 'flex', base.cells.FULL_HEAL.display);
      ok(file, '钥匙也挂同款耐久条（5/10 → 绿 50% / 灰 50%）',
        base.cells.KEY.bar && pct(base.cells.KEY.g) === 50 && pct(base.cells.KEY.s) === 50 &&
        !base.cells.KEY.cap && /width:50\.00%/.test(base.htmlKey) &&
        /剩余耐久 5 \/ 10/.test(base.cells.KEY.title),
        JSON.stringify(base.cells.KEY));
      ok(file, '普通物品没有条也没有角标',
        !base.cells.PLAIN.bar && !base.cells.PLAIN.cap && base.htmlPlain === '');
      ok(file, '仓库格里的医疗品也挂条', base.stashBars >= 4, base.stashBars + ' 条');
      ok(file, '仓库格不再显示数字角标', base.stashCaps === 0, base.stashCaps + ' 个角标');
      ok(file, '仓库格中钥匙也挂条（5/10 → 50%）',
        base.stash.key && base.stash.key.bar && pct(base.stash.key.g) === 50 && !base.stash.key.cap,
        JSON.stringify(base.stash.key));
      ok(file, 'readout 给钥匙 / 医疗的精确读数',
        /剩余耐久 5 \/ 10/.test(base.readouts[4]) && /当前容量 30 \/ 120/.test(base.readouts[1]) &&
        /剩余次数 2 \/ 8/.test(base.readouts[3]), JSON.stringify(base.readouts));
      ok(file, 'ratio 与格子宽度一致（0.25 / 0.25）',
        base.ratioUsed === 0.25 && base.ratioUses === 0.25, base.ratioUsed + ' / ' + base.ratioUses);
      ok(file, '信件附件卡（医疗 / 钥匙）都挂同款条',
        /dbar-capacity/.test(base.mailCard) && /25.00%/.test(base.mailCard) &&
        /dbar-capacity/.test(base.mailKeyCard) && /50.00%/.test(base.mailKeyCard));
      ok(file, 'CapBar.attach 不会叠第二条', base.attach === 1, String(base.attach));

      /* 详情浮窗：条 + 精确数字行 */
      const tip = await page.evaluate(() => {
        const e = Save.stash.find(x => x.id === 'heal03' && x.cap === 30);
        const cell = [...document.querySelectorAll('#stashGrid .scell:not(.empty)')].find(c => (c.title || '').includes('30 / 120'));
        Base.showItem(e, 'stash', cell || document.body);
        const box = document.getElementById('itemTip');
        return {
          bar: !!box.querySelector('.tip-dura .dbar-capacity'),
          g: box.querySelector('.tip-dura .dg') && box.querySelector('.tip-dura .dg').style.width,
          text: box.innerText.slice(0, 400)
        };
      });
      ok(file, '详情浮窗挂条且宽度同步', tip.bar && pct(tip.g) === 25, tip.g);
      ok(file, '详情浮窗仍保留精确读数', /30 \/ 120/.test(tip.text), tip.text.slice(0, 120).replace(/\n/g, ' '));

      /* 医疗操作浮窗（Tips.show 的第 5 个参数 entry） */
      const medTip = await page.evaluate(() => {
        const e = Save.stash.find(x => x.id === 'heal12');
        Medical.open(e, 'stash', document.querySelector('#stashGrid .scell:not(.empty)') || document.body);
        const box = document.getElementById('itemTip');
        return { bar: !!box.querySelector('.dbar-capacity'), text: box.innerText.slice(0, 300) };
      });
      ok(file, '医疗操作浮窗也挂条', medTip.bar, medTip.text.slice(0, 100).replace(/\n/g, ' '));

      /* 钥匙详情浮窗：条 + 原来的「剩余耐久」精确读数行 */
      const keyTip = await page.evaluate(() => {
        const e = Save.stash.find(x => x.id === 'door_key_old_apt');
        const cell = [...document.querySelectorAll('#stashGrid .scell:not(.empty)')]
          .find(c => (c.title || '').startsWith('老公寓3号房钥匙'));
        Base.showItem(e, 'stash', cell || document.body);
        const box = document.getElementById('itemTip');
        return {
          bar: !!box.querySelector('.tip-dura .dbar-capacity'),
          g: box.querySelector('.tip-dura .dg') && box.querySelector('.tip-dura .dg').style.width,
          text: box.innerText.slice(0, 300)
        };
      });
      ok(file, '钥匙详情浮窗挂条且保留剩余耐久读数',
        keyTip.bar && pct(keyTip.g) === 50 && /剩余耐久/.test(keyTip.text),
        JSON.stringify(keyTip).slice(0, 200));

      /* 切到真正的仓库页再截图：#stashGrid 在藏身处主页是隐藏的 */
      await page.evaluate(() => { Tips.hide(); Safehouse.route('stash'); Base.renderStash(); });
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(out, file === 'index.html' ? 'stash.png' : 'offline-stash.png') });
      /* 第一行格子放大裁剪：肉眼看得出满 / 半 / 次数 / 钥匙四种条 */
      const zoom = await page.evaluate(() => {
        const cells = [...document.querySelectorAll('#stashGrid .scell:not(.empty)')].slice(0, 6);
        if (cells.length < 6) return null;
        const a = cells[0].getBoundingClientRect(), b = cells[5].getBoundingClientRect();
        return { x: a.left - 4, y: a.top - 4, width: b.right - a.left + 8, height: a.height + 8 };
      });
      if (zoom) await page.screenshot({
        path: path.join(out, file === 'index.html' ? 'stash-zoom.png' : 'offline-stash-zoom.png'), clip: zoom
      });

      /* 商人详情面板：选中一件残容量的药，检查右侧检视区也挂条 */
      const merchantBar = await page.evaluate(() => {
        try {
          Safehouse.route('shop');
          if (!MerchantUI.mounted) MerchantUI.mount();
          const e = Save.stash.find(x => x.id === 'heal03' && x.cap === 30);
          const o = { key: 'probe', item: ITEM_BY_ID.heal03, entry: e, meta: { kind: 'medical' },
            cell: document.createElement('div'), quantity: 1, price: ITEM_BY_ID.heal03.price };
          /* buy 模式才会走 renderSelection 自己的面板（sell 委派给 MerchantSales） */
          MerchantUI.mode = 'buy'; MerchantUI.offers = [o]; MerchantUI.selected = o;
          MerchantUI.renderSelection();
          const panel = MerchantUI.detail && MerchantUI.detail.querySelector('.mb-inspector');
          const bar = panel && panel.querySelector('.dbar-capacity');
          return { bar: !!bar, g: bar && bar.querySelector('.dg').style.width,
            rows: panel && /30 \/ 120/.test(panel.innerText) };
        } catch (err) { return { err: String(err) }; }
      });
      ok(file, '商人详情挂同款条并保留精确读数',
        merchantBar.bar && pct(merchantBar.g) === 25 && merchantBar.rows, JSON.stringify(merchantBar));

      /* ---------------- 局内：背包 / 安全箱 / 钥匙链 / 快捷栏 ---------------- */
      /* 同一个 URL 只改 hash 不会重新执行 boot，必须 reload 一次才真正开局 */
      await page.goto(url + '#play');
      await page.reload();
      await page.waitForFunction(() => typeof CapBar !== 'undefined' && Game.state === 'playing' && !!Game.player);
      const raid = await page.evaluate(() => {
        const it = id => ITEM_BY_ID[id];
        const P = Game.player;
        P.bag.slots = [
          { item: it('heal03'), n: 1 }, { item: it('heal03'), n: 1, cap: 30 },
          { item: it('heal12'), n: 1, cap: 2 }, { item: it('door_key_old_apt'), n: 1, cap: 5 },
          { item: it('life01'), n: 1 }
        ];
        P.bag.safe = [{ item: it('heal03'), n: 1, cap: 60 }];
        P.bag.chain = [{ item: it('door_key_old_apt'), n: 1, cap: 3 }];
        Game.renderBag();
        const probe = sel => [...document.querySelectorAll(sel + ' .cell:not(.empty)')].map(c => ({
          title: c.title, bar: !!c.querySelector('.dbar-capacity'),
          g: c.querySelector('.dbar-capacity .dg') && c.querySelector('.dbar-capacity .dg').style.width,
          cap: c.querySelector('.cap') && c.querySelector('.cap').textContent,
          hasDbar: c.classList.contains('has-dbar')
        }));
        return {
          bag: probe('#bagGrid'), safe: probe('#safeGrid'), chain: probe('#chainGrid'),
          groups: MedQuick.groups().map(g => ({ id: g.id, ratio: g.ratio, text: g.text })),
          quickBefore: (MedBar.refresh(), MedBar.state())
        };
      });
      ok(file, '局内背包：满容量 / 残容量 / 次数式都有条',
        raid.bag[0].bar && pct(raid.bag[0].g) === 100 && raid.bag[1].bar && pct(raid.bag[1].g) === 25
        && raid.bag[2].bar && pct(raid.bag[2].g) === 25,
        JSON.stringify(raid.bag.map(x => x.g)));
      ok(file, '局内背包：钥匙也挂 50% 条、普通物品无条',
        raid.bag[3].bar && pct(raid.bag[3].g) === 50 && !raid.bag[3].cap &&
        !raid.bag[4].bar && !raid.bag[4].cap,
        JSON.stringify(raid.bag.slice(3)));
      ok(file, '局内安全箱：残容量 60/120 → 50%',
        raid.safe.length === 1 && raid.safe[0].bar && pct(raid.safe[0].g) === 50, JSON.stringify(raid.safe));
      ok(file, '局内钥匙链：也挂同款条（3/10 → 30%）',
        raid.chain[0].bar && pct(raid.chain[0].g) === 30 && !raid.chain[0].cap, JSON.stringify(raid.chain));
      ok(file, '轮盘分组带上容量比例',
        raid.groups.some(g => g.id === 'heal03' && g.ratio === 0.25) &&
        raid.groups.some(g => g.id === 'heal12' && g.ratio === 0.25), JSON.stringify(raid.groups));

      /* 轮盘是 canvas：确认每个扇区都带着比例绘制，且画条不抛异常 */
      const wheel = await page.evaluate(() => {
        const opened = MedWheel.open();
        let err = null;
        try { MedWheel.draw(); } catch (e) { err = String(e); }
        const ratios = MedWheel.sectors.map(s => s.ratio);
        return { opened, err, ratios, count: MedWheel.sectors.length };
      });
      ok(file, '轮盘扇区带比例绘制不报错',
        wheel.opened && !wheel.err && wheel.count >= 2 &&
        wheel.ratios.every(r => r != null && r >= 0 && r <= 1), JSON.stringify(wheel));
      await page.screenshot({ path: path.join(out, file === 'index.html' ? 'med-wheel.png' : 'offline-med-wheel.png') });
      await page.evaluate(() => MedWheel.close());

      const quick = await page.evaluate(() => {
        const bar = document.querySelector('#medBar .dbar-capacity');
        const before = bar && { g: bar.querySelector('.dg').style.width, title: bar.title, display: getComputedStyle(bar).display };
        /* 治疗中容量每帧都在掉：确认条跟着变，而不是只有文字变 */
        Game.player.bag.slots[1].cap = 90;
        MedBar.refresh();
        const after = bar && { g: document.querySelector('#medBar .dbar-capacity .dg').style.width, title: document.querySelector('#medBar .dbar-capacity').title };
        return { before, after, hasBar: !!bar };
      });
      ok(file, '快捷栏挂同款容量条',
        quick.hasBar && quick.before && quick.before.display === 'flex' && pct(quick.before.g) === 25,
        JSON.stringify(quick.before));
      ok(file, '快捷栏容量变化实时反映到条上',
        quick.after && pct(quick.after.g) === 75 && /90 \/ 120/.test(quick.after.title), JSON.stringify(quick.after));

      /* 打开背包面板再截图，否则格子都被藏起来 */
      await page.evaluate(() => {
        if (!Game.bagOpen) Game.toggleBag({ silent: true });
        Game.updateCamera(true); Game.render();
      });
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(out, file === 'index.html' ? 'raid-bag.png' : 'offline-raid-bag.png') });
      ok(file, '无脚本错误', errors.length === 0, errors.slice(0, 3).join(' | '));
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }

  let bad = 0;
  for (const [file, name, pass, extra] of results) {
    if (!pass) bad++;
    console.log('  ' + (pass ? 'ok  ' : 'FAIL') + '  [' + file + '] ' + name + (extra ? '  ' + extra : ''));
  }
  console.log('\n通过 ' + (results.length - bad) + ' / 失败 ' + bad + '，截图：design/ui/medcap-v1/');
  process.exit(bad ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
