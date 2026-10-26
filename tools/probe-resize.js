/* 缩放探针：在同一会话里改视口，看画面比例与仓库格子是否跟着重算。
   用法：node tools/probe-resize.js <url> */
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const EDGE = process.env.EDGE_PATH ||
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9335;
const url = process.argv[2];
if (!url) {
  console.error('用法: node tools/probe-resize.js <url>');
  process.exit(1);
}

const profile = path.join(require('os').tmpdir(), 'edge-rs-' + Date.now());
const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile,
  '--window-size=1460,1000', '--no-first-run', '--no-default-browser-check', 'about:blank'
], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const getJSON = p => new Promise((resolve, reject) => {
  http.get('http://127.0.0.1:' + PORT + p, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
  }).on('error', reject);
});

(async () => {
  let targets = null;
  for (let i = 0; i < 60; i++) {
    try {
      targets = await getJSON('/json/list');
      if (targets && targets.length) break;
    } catch (e) { /* 还没起来 */ }
    await sleep(200);
  }
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
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  await send('Page.enable');
  await send('Runtime.enable');

  const evalIn = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return 'ERR ' + r.exceptionDetails.text;
    return r.result && r.result.value;
  };

  const sizes = [[1280, 720], [1600, 900], [1920, 1080], [2560, 1440], [1440, 960], [1366, 768]];

  await send('Emulation.setDeviceMetricsOverride', {
    width: sizes[0][0], height: sizes[0][1], deviceScaleFactor: 1, mobile: false
  });
  await send('Page.navigate', { url });
  await Promise.race([loaded, sleep(6000)]);
  await sleep(2600);

  await evalIn("document.getElementById('startVeil').style.display='none'; Save.stash=[]; for(let i=0;i<20;i++) Save.addStash(ITEMS[i].id,2); Base.open(); Base.render(); 'ok'");

  const probe = `(() => {
    const cv = document.getElementById('game');
    const g = document.getElementById('stashGrid');
    const b = document.querySelector('#stashGrid .scell');
    return JSON.stringify({
      win: innerWidth + 'x' + innerHeight,
      canvas: cv.style.width + 'x' + cv.style.height,
      ratio: +(parseFloat(cv.style.width) / parseFloat(cv.style.height)).toFixed(3),
      scale: +Game._scale.toFixed(2),
      rs: +Game._rs.toFixed(2),
      cells: b ? b.offsetWidth + 'x' + b.offsetHeight : '-',
      cols: getComputedStyle(g).gridTemplateColumns.split(' ').length,
      n: g.children.length,
      scroll: g.scrollHeight > g.clientHeight
    });
  })()`;

  console.log('--- 同一会话里连续改窗口 ---');
  for (const [w, h] of sizes) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await sleep(450);
    console.log(String(w + 'x' + h).padEnd(10), await evalIn(probe));
  }

  ws.close();
  child.kill();
  process.exit(0);
})().catch(e => { console.error(e); child.kill(); process.exit(1); });
