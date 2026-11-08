/* 随机入场 / 入场点封闭：浏览器验收（多文件版 + 离线单文件版）
   node tools/test-infiltration-browser.js
   产出截图：design/ui/infiltration-v1/ */
const fs = require('fs'), path = require('path'), http = require('http');
const { pathToFileURL } = require('url'), { chromium } = require('playwright');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'design/ui/infiltration-v1');

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
  const ok = (file, name, cond, extra) => results.push([file, name, !!cond, extra || '']);
  try {
    for (const file of ['index.html', '潮汐线.html']) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(pathToFileURL(path.join(root, file)).href + '#play');
      await page.waitForFunction(() => typeof M !== 'undefined' && typeof Game !== 'undefined' && Game.state === 'playing');

      const state = await page.evaluate(() => {
        const all = M.extracts, open = M.openExtracts();
        return {
          total: all.length,
          closed: all.filter(e => e.closed).length,
          open: open.length,
          inf: M.infiltration && { id: M.infiltration.id, name: M.infiltration.name, x: M.infiltration.x, y: M.infiltration.y },
          spawn: { ...M.playerSpawn },
          px: Game.player.x, py: Game.player.y,
          atExit: M.infiltration ? Math.abs(Game.player.x - M.cx(M.infiltration.x)) < 1 && Math.abs(Game.player.y - M.cy(M.infiltration.y)) < 1 : false,
          toasts: Game.toasts.map(t => t.msg),
          candidates: Game.findInteractables().filter(i => i.type === 'extract').map(i => ({ id: i.obj.id, closed: !!i.closed })),
          hud: typeof Game.openExtracts === 'function' ? null : null
        };
      });
      ok(file, '至少 2 个撤离点', state.total >= 2, state.total + ' 个');
      ok(file, '随机挑中一个入场点并封闭', !!state.inf && state.closed === 1, JSON.stringify(state.inf));
      ok(file, '其余撤离点仍开放', state.open === state.total - 1, state.open + ' 个');
      ok(file, '玩家出生在入场点上', state.atExit, state.px + ',' + state.py);
      ok(file, '出生点落在入场格', state.spawn.x === state.inf.x && state.spawn.y === state.inf.y);
      ok(file, '开局提示写明入场点已封闭', state.toasts.some(t => t.includes('已封闭') && t.includes('入场')),
        state.toasts.join(' | '));
      ok(file, '封闭点在交互候选表里', state.candidates.some(c => c.closed), JSON.stringify(state.candidates));

      const act = await page.evaluate(() => {
        const closed = M.extracts.find(e => e.closed), open = M.openExtracts()[0];
        Game.boxes = []; Game.corpses = []; Game.enemies = [];
        const go = ex => {
          Game.player.x = M.cx(ex.x); Game.player.y = M.cy(ex.y);
          Game.action = null; Game.interactKey = null; Game._interactAnchor = null;
          Game.handleInteract();
          return Game.action && Game.action.type;
        };
        const blocked = go(closed), allowed = go(open);
        Game.action = null;
        return { blocked, allowed, label: Game.interactLabel({ type: 'extract', obj: closed, closed: true }, true) };
      });
      ok(file, '封闭点按 E 不会开始撤离', act.blocked === null || act.blocked === undefined, String(act.blocked));
      ok(file, '开放点按 E 开始撤离读条', act.allowed === 'extract', String(act.allowed));
      ok(file, '封闭点提示写明已封闭', act.label.includes('已封闭'), act.label);

      /* HUD 面板与地图上的红叉都靠 render 画，这里只保证绘制不抛异常 */
      await page.evaluate(() => { Game.updateCamera(true); Game.render(); });
      await page.screenshot({ path: path.join(out, file === 'index.html' ? 'raid-hud.png' : 'offline-raid-hud.png') });
      ok(file, '无脚本错误', errors.length === 0, errors.slice(0, 3).join(' | '));
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }

  let bad = 0;
  for (const [file, name, pass, extra] of results) {
    if (!pass) bad++;
    console.log('  ' + (pass ? 'ok  ' : 'FAIL') + '  [' + file + '] ' + name + (extra ? '  ' + extra : ''));
  }
  console.log('\n通过 ' + (results.length - bad) + ' / 失败 ' + bad + '，截图：design/ui/infiltration-v1/');
  process.exit(bad ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
