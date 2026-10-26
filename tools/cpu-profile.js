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
  console.error('用法: node tools/cpu-profile.js <url> [waitMs]');
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

  const run = async (label, expr) => {
    const r = await send('Runtime.evaluate', {
      expression: expr, returnByValue: true, awaitPromise: true, timeout: 600000
    });
    if (r.exceptionDetails) { console.log(label + ' 抛错:', r.exceptionDetails.text); return; }
    const v = r.result && r.result.value;
    console.log(label + ': ' + (typeof v === 'object' ? JSON.stringify(v) : v));
  };

  await sleep(2000);
  await run('开局', "document.getElementById('startVeil').style.display='none'; Game.startRun(Save.loadout); Game.state");

  await send('Profiler.enable');
  await send('Profiler.setSamplingInterval', { interval: 200 });
  await send('Profiler.start');
  console.log('--- 采样 20 秒（玩家原地不动，让敌人自己跑）---');
  await sleep(20000);
  const prof = await send('Profiler.stop');

  const nodes = new Map();
  for (const n of prof.profile.nodes) nodes.set(n.id, n);
  const self = new Map();
  const deltas = prof.profile.timeDeltas || [];
  const samples = prof.profile.samples || [];
  for (let i = 0; i < samples.length; i++) {
    const n = nodes.get(samples[i]);
    if (!n) continue;
    const k = (n.callFrame.functionName || '(anonymous)') + ' @' +
      (n.callFrame.url || '').split('/').pop() + ':' + (n.callFrame.lineNumber + 1);
    self.set(k, (self.get(k) || 0) + (deltas[i] || 0) / 1000);
  }
  const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18);
  const total = [...self.values()].reduce((a, b) => a + b, 0) || 1;
  console.log('总采样时长 ' + (total / 1000).toFixed(1) + ' s（含空闲）');
  for (const [k, ms] of top) {
    console.log('  ' + (ms / 1000).toFixed(2).padStart(7) + ' s  ' + k);
  }
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
