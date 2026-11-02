/* 音频包络：按固定窗宽输出 RMS（dB），用来看清一个素材里到底有几个声音、各自在哪。
   用法：node tools/audio-envelope.js <文件> [start] [end] [窗宽秒=0.01]
   例：node tools/audio-envelope.js assets/audio/_source/x.wav 0 1.2 0.02
   输出按 42dB 动态范围画成条，方便一眼定位瞬态与间隙。 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const file = path.resolve(process.argv[2] || '');
const A = parseFloat(process.argv[3] || '0');
const B = parseFloat(process.argv[4] || '0');
const WIN = parseFloat(process.argv[5] || '0.01');

if (!process.argv[2]) {
  console.error('用法：node tools/audio-envelope.js <文件> [start] [end] [窗宽]');
  process.exit(1);
}

(async () => {
  const b64 = fs.readFileSync(file).toString('base64');
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  const p = await b.newPage();
  await p.goto('data:text/html,<body>');
  const out = await p.evaluate(async ({ b64, A, B, WIN }) => {
    const ac = new OfflineAudioContext(1, 1, 48000);
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const ab = await ac.decodeAudioData(bin.buffer);
    const d = ab.getChannelData(0), sr = ab.sampleRate;
    const st = A ? Math.floor(A * sr) : 0;
    const en = B ? Math.min(d.length, Math.ceil(B * sr)) : d.length;
    const win = Math.max(1, Math.round(sr * WIN));
    let pk = 0;
    for (let i = st; i < en; i++) { const v = Math.abs(d[i]); if (v > pk) pk = v; }
    const rows = [];
    for (let i = st; i + win <= en; i += win) {
      let s = 0;
      for (let k = i; k < i + win; k++) s += d[k] * d[k];
      const r = Math.sqrt(s / win);
      rows.push([+((i - st) / sr).toFixed(3), r > 1e-7 ? 20 * Math.log10(r) : -140]);
    }
    return { sr, dur: +ab.duration.toFixed(3), ch: ab.numberOfChannels, pk: +pk.toFixed(3), rows };
  }, { b64, A, B, WIN });

  console.log(path.basename(file) + '  ' + out.dur + 's ' + out.sr + 'Hz ' + out.ch + 'ch peak=' + out.pk);
  const maxDb = Math.max(...out.rows.map(r => r[1]));
  for (const [t, db] of out.rows) {
    const n = Math.max(0, Math.round((db - (maxDb - 42)) / 42 * 40));
    console.log(String(t).padStart(6) + 's ' + db.toFixed(0).padStart(4) + 'dB ' + '#'.repeat(n));
  }
  await b.close();
})();
