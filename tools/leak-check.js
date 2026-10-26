/* 性能探针：连上 headless 浏览器，跑一段脚本，前后各做一次强制 GC + 量堆。
   比看帧率可靠 —— 泄漏看的是 GC 之后还留着多少。

   用法：node tools/perf-probe.js <url> <脚本文件> [等待毫秒]
   脚本文件里 export 一个 async 函数体（会包成 IIFE 执行），返回值会被打印。 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const EDGE = process.env.EDGE_PATH ||
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9334;

const url = process.argv[2];
const waitMs = parseInt(process.argv[3] || '2500', 10);

if (!url) {
  console.error('用法: node tools/leak-check.js <url> [waitMs]');
  process.exit(1);
}
const profile = path.join(require('os').tmpdir(), 'edge-perf-' + Date.now());
const args = [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + profile,
  '--window-size=1460,1000',
  '--js-flags=--expose-gc',
  '--no-first-run', '--no-default-browser-check',
  'about:blank'
];

const child = spawn(EDGE, args, { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

function getJSON(p) {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:' + PORT + p, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

async function main() {
  let targets = null;
  for (let i = 0; i < 60; i++) {
    try {
      targets = await getJSON('/json/list');
      if (targets && targets.length) break;
    } catch (e) { /* 还没起来 */ }
    await sleep(200);
  }
  if (!targets || !targets.length) throw new Error('浏览器没起来');

  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let msgId = 0;
  const pending = new Map();

  const send = (method, params) => new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });

  const loaded = new Promise(r => {
    ws.addEventListener('message', ev => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id);
        pending.delete(m.id);
        if (m.error) p.reject(new Error(m.error.message));
        else p.resolve(m.result);
      }
      if (m.method === 'Page.loadEventFired') r();
    });
  });

  await new Promise((r, j) => {
    ws.addEventListener('open', r);
    ws.addEventListener('error', j);
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('HeapProfiler.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1480, height: 1000, deviceScaleFactor: 1, mobile: false
  });
  await send('Page.navigate', { url });
  await Promise.race([loaded, sleep(6000)]);
  await sleep(waitMs);

  const heap = async () => {
    await send('HeapProfiler.collectGarbage');
    await sleep(300);
    const u = await send('Runtime.getHeapUsage');
    return Math.round(u.usedSize / 1024);     // KB
  };

  const run = async (label, expr) => {
    const r = await send('Runtime.evaluate', {
      expression: expr, returnByValue: true, awaitPromise: true, timeout: 600000
    });
    if (r.exceptionDetails) {
      console.log(label + ' 抛错:', r.exceptionDetails.text);
      return null;
    }
    const v = r.result && r.result.value;
    const h = await heap();
    console.log(label.padEnd(26) + ' 堆=' + String(h).padStart(6) + ' KB' +
      (v === undefined ? '' : '  ' + (typeof v === 'object' ? JSON.stringify(v) : v)));
    return h;
  };

  console.log('=== 多局泄漏检测 ===');
  await run('页面刚加载', '1');
  await run('开局', "document.getElementById('startVeil').style.display='none'; Game.startRun(Save.loadout); Game.state");

  const STEP_PLAY = `(function(){
    const P = Game.player;
    for (let i = 0; i < 1800; i++) {
      Game.update(1/60);
      if (P.dead) { P.dead = false; P.hp = 9999; Game.state = 'playing'; }
    }
    for (let i = 0; i < 30; i++) Game.render();
    return 'corpses=' + Game.corpses.length + ' en=' + Game.enemies.filter(e=>!e.dead).length;
  })()`;

  for (let i = 1; i <= 4; i++) {
    await run('第 ' + i + ' 局·玩 30 秒游戏时间', STEP_PLAY);
    await run('第 ' + i + ' 局·撤离+藏身处',
      "Game.showEnd(true); Base.open(); Base.close(); Game.startRun(Save.loadout); 'ok'");
  }

  await run('静置 5 秒', "new Promise(r=>setTimeout(()=>r('ok'),5000))");
  ws.close();
}


main()
  .catch(e => { console.error('失败:', e.message); process.exitCode = 1; })
  .finally(async () => {
    await sleep(150);
    try { child.kill(); } catch (e) {}
    await sleep(200);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
    process.exit();
  });
