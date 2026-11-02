/* 连发载荷测试：按各枪射速把开火采样排成时间轴，过和游戏一样的总线压缩器，
   看峰值、RMS、同时发声的层数。真实录音尾巴长，连发叠起来才是削波风险所在。
   用法：node tools/audio-burst.js [枪型...] [--sec=2]
   例：node tools/audio-burst.js smg rifle shotgun pistol --sec=2 */
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const SEC = (() => {
  const hit = args.find(a => a.startsWith('--sec='));
  return hit ? parseFloat(hit.split('=')[1]) : 2;
})();
const guns = args.filter(a => !a.startsWith('--'));

(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  const p = await b.newPage();
  await p.goto(pathToFileURL(path.join(__dirname, '..', 'index.html')).href);
  await p.waitForFunction(() => typeof SFX !== 'undefined');
  await p.evaluate(() => SFX.init());

  const out = await p.evaluate(async ({ guns, SEC }) => {
    await SFX.load();
    const RPG = { rifle: 420, smg: 780, shotgun: 80, pistol: 300 };
    const rate0 = 44100;
    const res = {};

    for (const g of (guns.length ? guns : ['rifle', 'smg', 'shotgun', 'pistol'])) {
      const rpm = RPG[g] || 300;
      const iv = 60 / rpm;
      const n = Math.max(1, Math.floor(SEC / iv) + 1);
      const total = SEC;
      const off = new OfflineAudioContext(1, Math.round(rate0 * total), rate0);

      /* 和 init() 里一模一样的总线压缩器 */
      const comp = off.createDynamicsCompressor();
      comp.threshold.value = -8;
      comp.knee.value = 10;
      comp.ratio.value = 3;
      comp.attack.value = 0.003;
      comp.release.value = 0.15;
      comp.connect(off.destination);

      const prof = SFX.SHOT_SAMPLE[g];
      const ready = prof.ids.filter(id => SFX.samples[id]);
      if (!ready.length) { res[g] = { error: '没有可用采样' }; continue; }
      const gain = SFX.gainOf[ready[0]] || 0.4;
      const j = prof.jitter || 0;

      let voices = 0;
      const starts = [];
      for (let i = 0; i < n; i++) {
        const t = i * iv;
        if (t >= total) break;
        const id = ready[i % ready.length];
        const src = off.createBufferSource();
        src.buffer = SFX.samples[id];
        src.playbackRate.value = (prof.rate || 1) * (1 - j + Math.random() * j * 2);
        const gn = off.createGain();
        gn.gain.value = (SFX.gainOf[id] || 0.4) * (prof.vol || 1);
        src.connect(gn); gn.connect(comp);
        src.start(t);
        starts.push([t, t + SFX.samples[id].duration / src.playbackRate.value]);
      }
      /* 同时发声层数：任一时刻有多少个源还没放完 */
      let maxVoices = 0;
      const pts = [];
      for (const [a, z] of starts) { pts.push([a, 1]); pts.push([z, -1]); }
      pts.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
      for (const [, dv] of pts) { voices += dv; if (voices > maxVoices) maxVoices = voices; }

      const buf = await off.startRendering();
      const d = buf.getChannelData(0);
      let peak = 0, sum = 0;
      for (let i = 0; i < d.length; i++) {
        const a = Math.abs(d[i]); if (a > peak) peak = a;
        sum += d[i] * d[i];
      }
      res[g] = {
        shots: starts.length,
        maxVoices,
        peak: +peak.toFixed(3),
        peakDb: +(20 * Math.log10(peak || 1e-9)).toFixed(1),
        rms: +Math.sqrt(sum / d.length).toFixed(4),
        clip: peak >= 0.999
      };
    }
    return res;
  }, { guns, SEC });

  console.log('\n连发载荷 ' + SEC + 's   （总线压缩器 threshold -8 / ratio 3）');
  console.log('枪型      发数  叠加层  峰值dBFS   RMS    状态');
  console.log('-'.repeat(52));
  for (const g in out) {
    const r = out[g];
    if (r.error) { console.log(g.padEnd(9) + r.error); continue; }
    console.log(g.padEnd(9) + String(r.shots).padStart(4) + String(r.maxVoices).padStart(7) +
      String(r.peakDb).padStart(9) + String(r.rms).padStart(9) +
      '   ' + (r.clip ? '削波!' : (r.peakDb > -1 ? '偏紧' : 'ok')));
  }
  await b.close();
})();
