/* 用 CDP 控制 headless 浏览器截图。
   比 --screenshot 可靠：可以等真实时间、可以读页面里的状态。
   用法：node tools/cdp-shot.js <url> <输出png> [等待毫秒] [要读的表达式]

   例：
     node tools/cdp-shot.js "file:///.../潮汐线.html#play,13,4" shots/a.png 1500
     node tools/cdp-shot.js "http://localhost:8765/index.html" shots/b.png 800 "Game.state"
*/
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const EDGE = process.env.EDGE_PATH ||
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9333;

const url = process.argv[2];
const outPng = process.argv[3] || 'shot.png';
const waitMs = parseInt(process.argv[4] || '1500', 10);
const expr = process.argv[5] || null;
const postWait = parseInt(process.argv[6] || '0', 10);

if (!url) {
  console.error('用法: node tools/cdp-shot.js <url> <out.png> [waitMs] [expr]');
  process.exit(1);
}

const profile = path.join(require('os').tmpdir(), 'edge-cdp-' + Date.now());
const args = [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + profile,
  '--window-size=1460,1000',
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
  // 等浏览器起来
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
  if (!page) throw new Error('没有可用的 page target');

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
  // 固定视口，避免 headless 默认尺寸导致画面被缩得很小
  await send('Emulation.setDeviceMetricsOverride', {
    width: parseInt(process.env.SHOT_W || '1480', 10),
    height: parseInt(process.env.SHOT_H || '1000', 10),
    deviceScaleFactor: 1, mobile: false
  });
  await send('Page.navigate', { url });

  // 等 load，但别死等
  await Promise.race([loaded, sleep(6000)]);

  // 等真实时间（图片解码、rAF 都在真实时间轴上）
  await sleep(waitMs);

  if (expr) {
    try {
      const r = await send('Runtime.evaluate', {
        expression: expr, returnByValue: true, awaitPromise: true
      });
      const v = r.result && r.result.value;
      console.log('表达式结果:', typeof v === 'object' ? JSON.stringify(v) : v);
    } catch (e) {
      console.log('表达式失败:', e.message);
    }
  }

  // 表达式可能会改游戏状态，给它一点时间让下一帧渲染出来
  if (expr && postWait > 0) await sleep(postWait);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.mkdirSync(path.dirname(path.resolve(outPng)), { recursive: true });
  fs.writeFileSync(outPng, Buffer.from(shot.data, 'base64'));
  console.log('已截图 ' + outPng);

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
