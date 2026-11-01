/* 音频事件检测：按 RMS 包络找静音间隙，把长素材切成独立事件。
   用法：node tools/audio-events.js <文件> [阈值]
   输出每个事件的起止时间、峰值、有效发声长度。 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const file = path.resolve(process.argv[2] || '');
const REL = parseFloat(process.argv[3] || '0.06');   // 相对峰值的门限
const WIN = 0.01;                                     // 10ms 分析窗

(async () => {
  const buf = fs.readFileSync(file);
  const b64 = buf.toString('base64');
  const ext = path.extname(file).slice(1).toLowerCase();
  const mime = ext === 'wav' ? 'audio/wav' : 'audio/' + ext;

  const b = await chromium.launch({ channel: 'msedge', headless: true });
  const p = await b.newPage();
  await p.goto('data:text/html,<body>');
  const r = await p.evaluate(async ({ b64, mime, REL, WIN }) => {
    const ac = new AudioContext();
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const ab = await ac.decodeAudioData(bin.buffer);
    const d = ab.getChannelData(0), sr = ab.sampleRate;
    const win = Math.max(1, Math.round(sr * WIN));
    const env = [];
    for (let i = 0; i + win <= d.length; i += win) {
      let s = 0;
      for (let k = i; k < i + win; k++) s += d[k] * d[k];
      env.push(Math.sqrt(s / win));
    }
    const peakEnv = Math.max(...env);
    const th = peakEnv * REL;

    /* 找连续超过门限的区间，间隙 < 60ms 的合并（同一动作里的细碎声） */
    const MIN_GAP = 6;   // 6 窗 = 60ms
    const events = [];
    let cur = null, gap = 0;
    for (let i = 0; i < env.length; i++) {
      if (env[i] >= th) {
        if (!cur) cur = { a: i, b: i };
        else if (gap >= MIN_GAP) { events.push(cur); cur = { a: i, b: i }; }
        else cur.b = i;
        gap = 0;
      } else if (cur) gap++;
    }
    if (cur) events.push(cur);

    /* 每个事件：略微外扩（15ms 淡入淡出余量），算峰值与 RMS */
    const PAD = Math.round(0.015 * sr);
    const out = events.map(e => {
      const s = Math.max(0, e.a * win - PAD), en = Math.min(d.length, (e.b + 1) * win + PAD);
      let pk = 0, sum = 0;
      for (let i = s; i < en; i++) { const v = Math.abs(d[i]); if (v > pk) pk = v; sum += d[i] * d[i]; }
      return {
        start: +(s / sr).toFixed(3),
        end: +(en / sr).toFixed(3),
        len: +((en - s) / sr).toFixed(3),
        peak: +pk.toFixed(3),
        rms: +Math.sqrt(sum / (en - s)).toFixed(4)
      };
    });
    await ac.close();
    return {
      dur: +ab.duration.toFixed(3), sr, ch: ab.numberOfChannels,
      frames: d.length, peakEnv: +peakEnv.toFixed(4), th: +th.toFixed(4),
      events: out
    };
  }, { b64, mime, REL, WIN });
  await b.close();

  console.log(path.basename(file));
  console.log('  时长 ' + r.dur + 's  ' + r.sr + 'Hz  ' + r.ch + 'ch  包络峰值 ' + r.peakEnv + '  门限 ' + r.th);
  console.log('  检测到 ' + r.events.length + ' 个事件：');
  const pad = (s, n) => String(s).padStart(n);
  r.events.forEach((e, i) => {
    console.log('   ' + pad(i + 1, 2) + '.  ' + pad(e.start.toFixed(2), 6) + 's → ' +
      pad(e.end.toFixed(2), 6) + 's   长度 ' + pad(e.len.toFixed(2), 5) + 's   ' +
      '峰值 ' + pad(e.peak.toFixed(2), 5) + '   RMS ' + pad(e.rms.toFixed(3), 6));
  });
})();
