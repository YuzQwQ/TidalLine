/* 局内交互音效总览页（tools/audio-actions.html）的防漂移测试。
   这一页是"人读的文档 + 试听器"，最容易出的问题是它跟代码脱节：
   采样 id 写错、LOUD 键改名、或者 js 里的行号挪了位。
   所以这里把页面里的每一条声明都拿去和真实代码对一遍。

   跑法：node tools/test-audio-actions.js */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PAGE = path.join(ROOT, 'tools', 'audio-actions.html');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

(async () => {
  /* ---------- 1. 页面里的行号引用必须还对得上 ---------- */
  const html = fs.readFileSync(PAGE, 'utf8');
  const whereBlocks = html.match(/where:\s*'([^']+)'/g) || [];
  assert(whereBlocks.length >= 20, '页面里至少列了 20 条动作');

  const fileLines = new Map();
  const lineOf = (file, n) => {
    if (!fileLines.has(file)) {
      const p = path.join(ROOT, file);
      if (!fs.existsSync(p)) return null;
      fileLines.set(file, fs.readFileSync(p, 'utf8').split(/\r?\n/));
    }
    const lines = fileLines.get(file);
    return n >= 1 && n <= lines.length ? lines[n - 1] : null;
  };

  let checked = 0;
  for (const block of whereBlocks) {
    const text = block.replace(/where:\s*'/, '');
    /* 同一段里可能有 "js/a.js:12 · :34" 这种省略文件名的写法，
       跟着上一个文件名走 */
    let cur = null;
    const parts = text.split(/·|,|：/).flatMap(s => s.split(/(?=js\/[\w-]+\.js)/));
    for (const part of parts) {
      const m = part.match(/(js\/[\w-]+\.js):(\d+)/);
      if (m) { cur = m[1]; }
      const n = part.match(/:(\d+)/);
      if (!n || !cur) continue;
      const line = lineOf(cur, +n[1]);
      assert(line !== null, cur + ':' + n[1] + ' 指向的行不存在（代码挪位了？）');
      /* 这一行既可能是调用点，也可能是配置项（泵动的 after/vol 之类），
         只要还跟音效沾边就行 —— 目的是发现"代码挪了、文档没跟"。
         允许上下漂几行：这一节天天有人改，别人加删一两行就会把行号顶偏，
         那种偏移不代表文档写错了；真要挪走整段函数，这里照样会红。 */
      const soundish = l => l && /sfx|SFX|\bplay\(|\bui\(|toggleBag|gearVoice|pump|rate:|vol:|data-sfx/.test(l);
      const near = [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6, 6]
        .map(d => lineOf(cur, +n[1] + d)).find(soundish);
      assert(near, cur + ':' + n[1] + ' 附近六行都不像音效相关：' + line.trim().slice(0, 60));
      checked++;
    }
  }
  assert(checked >= 20, '至少核对了 20 条行号引用（实际 ' + checked + '）');

  /* ---------- 2. 页面里的采样 id 必须都在 manifest 里 ---------- */
  const manifest = JSON.parse(read('assets/audio/manifest.json'));
  const ids = manifest.assets.map(a => a.id);
  const claimed = new Set();
  for (const m of html.match(/sounds:\s*\[([^\]]*)\]/g) || []) {
    for (const id of m.match(/'([a-z0-9_]+)'/g) || []) claimed.add(id.slice(1, -1));
  }
  assert(claimed.size >= 30, '页面声明了 30 段以上采样（实际 ' + claimed.size + '）');
  for (const id of claimed) {
    assert(ids.includes(id), '页面声明的采样 ' + id + ' 不在 manifest 里');
  }

  /* ---------- 3. 缺口：hurt 确实还空着（660770 是打中敌人，不是挨打） ---------- */
  const jsFiles = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js'));
  const hurtCalls = jsFiles.filter(f => /sfx\('hurt'/.test(read('js/' + f)));
  assert.deepEqual(hurtCalls, [],
    'hurt 已经接进局内了（' + hurtCalls.join(', ') + '）：页面上的"缺口"要改成"已接入"');

  /* ---------- 4. 页面自身跑起来：数据自洽 ---------- */
  const browser = await chromium.launch({
    channel: 'msedge', headless: true,
    args: ['--no-proxy-server', '--mute-audio', '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(pathToFileURL(PAGE).href);
  await page.waitForTimeout(1200);

  const r = await page.evaluate(() => {
    const rows = [];
    for (const g of GROUPS) for (const row of g.rows) rows.push({ g: g.name, ...row });
    return {
      groups: GROUPS.length,
      rows: rows.length,
      claimed: rows.reduce((n, x) => n + (x.sounds || []).length, 0),
      ladder: LADDER.map(l => l[0]),
      loudKeys: Object.keys(SFX.LOUD),
      gaps: GAPS.map(g => g.name),
      /* 页面里所有试听按钮都得真的能发出声音：抓 SFX.play 的调用 */
      buttons: document.querySelectorAll('#groups .ab').length
    };
  });
  assert.equal(errs.length, 0, '页面加载没有 JS 报错：' + errs.slice(0, 2).join(' | '));
  assert(r.groups >= 6, '至少 6 个分组');
  assert(r.rows >= 20, '至少 20 条动作');
  assert(r.ladder.length >= 20, '响度阶梯至少 20 行');
  for (const k of r.ladder) {
    assert(r.loudKeys.includes(k), '响度阶梯里的 ' + k + ' 不在 SFX.LOUD 里');
  }
  assert(r.gaps.some(g => /hurt/.test(g)), '缺口里要列出 hurt（玩家挨打还没声音）');

  /* ---------- 5. 点一遍所有按钮，确认都触发得到声音 ---------- */
  const played = await page.evaluate(async () => {
    const hits = [];
    const realPlay = SFX.play.bind(SFX);
    const realUi = SFX.ui.bind(SFX);
    const realGear = SFX.gear.bind(SFX);
    SFX.play = (n, o) => { hits.push(n); return realPlay(n, o); };
    SFX.ui = (k, o) => { hits.push('ui:' + k); return realUi(k, o); };
    SFX.gear = (k, o) => { hits.push('gear:' + k); return realGear(k, o); };
    for (const b of document.querySelectorAll('#groups .ab')) {
      b.click();
      await new Promise(r => setTimeout(r, 30));
    }
    SFX.play = realPlay; SFX.ui = realUi; SFX.gear = realGear;
    return hits;
  });
  const uniq = [...new Set(played)];
  assert(uniq.length >= 20, '点一遍按钮至少触发 20 种声音（实际 ' + uniq.length + '）');
  for (const need of ['pickup', 'search', 'bag_zip', 'reload', 'hit',
                      'headshot', 'break', 'sprint', 'melee', 'dodge', 'drop', 'door', 'extract',
                      'death', 'sell', 'gear:helmet', 'gear:body', 'gear:back',
                      'ui:click', 'ui:tap', 'ui:confirm', 'ui:notify']) {
    assert(uniq.includes(need), '试听按钮没触发 ' + need);
  }

  await browser.close();
  console.log('音效总览页：' + r.groups + ' 组 / ' + r.rows + ' 条动作 / ' +
    r.ladder.length + ' 档响度 / ' + checked + ' 条行号引用 / ' +
    uniq.length + ' 种试听触发 —— 全部通过');
})().catch(e => { console.error(e); process.exit(1); });
