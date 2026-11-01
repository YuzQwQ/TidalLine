/* 从长素材里切一段，归一化峰值，加淡入淡出，导出 16bit 单声道 WAV。
   用法：node tools/audio-slice.js <输入> <输出> <start> <end> [--peak=0.89] [--in=5] [--out=15]
   例：node tools/audio-slice.js assets/audio/x.wav assets/audio/step_hard_1.wav 0.01 0.18
   采样率保持源文件不变（WebAudio 解码时会统一），只做截取与增益。 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const [input, output, a, b] = process.argv.slice(2);
const opt = k => {
  const hit = process.argv.find(x => x.startsWith('--' + k + '='));
  return hit ? parseFloat(hit.split('=')[1]) : null;
};
const PEAK = opt('peak') ?? 0.89;
const RMS = opt('rms');            // 给了就按响度归一，否则按峰值
const TRIM = opt('trim');          // 给了就自动裁掉头尾低于此比例的静音（0.05 ≈ 峰值 5%）
const FADE_IN = opt('in') ?? 5;
const FADE_OUT = opt('out') ?? 15;

if (!input || !output || a == null || b == null) {
  console.error('用法：node tools/audio-slice.js <输入> <输出> <start> <end> [--peak=0.89]');
  process.exit(1);
}

/* 读源文件采样率：decodeAudioData 会按 AudioContext 的频率重采样，
   所以先自己读头，再用 OfflineAudioContext 指定同样的频率解码。 */
function srcRate(buf, file) {
  if (/\.wav$/i.test(file)) {
    const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    for (let o = 12; o + 8 <= buf.byteLength;) {
      const id = buf.toString('ascii', o, o + 4), sz = v.getUint32(o + 4, true);
      if (id === 'fmt ') return v.getUint32(o + 12, true);
      o += 8 + sz + (sz % 2);
    }
  } else if (/\.ogg$/i.test(file) && buf.toString('ascii', 0, 4) === 'OggS') {
    const P = 27 + buf[26];
    if (buf[P] === 1 && buf.toString('ascii', P + 1, P + 7) === 'vorbis') return buf.readUInt32LE(P + 12);
  }
  return 0;
}

(async () => {
  const src = path.resolve(input);
  const buf = fs.readFileSync(src);
  const mime = /\.wav$/i.test(src) ? 'audio/wav' : 'audio/' + path.extname(src).slice(1).toLowerCase();

  const br = await chromium.launch({ channel: 'msedge', headless: true });
  const p = await br.newPage();
  await p.goto('data:text/html,<body>');
  const rate = srcRate(buf, src);
  const out = await p.evaluate(async ({ b64, mime, rate, start, end, PEAK, RMS, TRIM, FADE_IN, FADE_OUT }) => {
    /* 指定采样率解码，避免被声卡频率重采样 */
    const ac = new OfflineAudioContext(1, 1, rate || 48000);
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const ab = await ac.decodeAudioData(bin.buffer);
    const sr = ab.sampleRate;
    const s = Math.max(0, Math.floor(start * sr));
    const e = Math.min(ab.length, Math.ceil(end * sr));
    const n = e - s;

    /* 多声道降成单声道：取平均 */
    const mono = new Float32Array(n);
    for (let c = 0; c < ab.numberOfChannels; c++) {
      const d = ab.getChannelData(c);
      for (let i = 0; i < n; i++) mono[i] += d[s + i] / ab.numberOfChannels;
    }

    /* 自动裁头尾：低于峰值的 TRIM 比例视为静音，两端各留 5ms 余量 */
    let s0 = 0, s1 = mono.length;
    if (TRIM) {
      let raw = 0;
      for (let i = 0; i < mono.length; i++) { const v = Math.abs(mono[i]); if (v > raw) raw = v; }
      const th = raw * TRIM, pad = Math.round(0.005 * sr);
      while (s0 < mono.length && Math.abs(mono[s0]) < th) s0++;
      while (s1 > s0 && Math.abs(mono[s1 - 1]) < th) s1--;
      s0 = Math.max(0, s0 - pad); s1 = Math.min(mono.length, s1 + pad);
    }
    const body = mono.subarray(s0, s1);
    const n2 = body.length;

    /* 归一化：给 --rms 就按响度对齐（同组素材听感一致），否则按峰值 */
    let pk = 0, sum = 0;
    for (let i = 0; i < n2; i++) { const v = Math.abs(body[i]); if (v > pk) pk = v; sum += body[i] * body[i]; }
    const rms = Math.sqrt(sum / n2);
    let g;
    if (RMS) {
      g = rms > 1e-6 ? RMS / rms : 1;
      if (pk * g > 0.95) g = 0.95 / pk;      // 别为了响度削波
    } else {
      g = pk > 1e-6 ? PEAK / pk : 1;
    }
    for (let i = 0; i < n2; i++) body[i] *= g;

    /* 淡入淡出：避免开头爆音与截断的咔声 */
    const fi = Math.min(n2, Math.round(FADE_IN / 1000 * sr));
    const fo = Math.min(n2, Math.round(FADE_OUT / 1000 * sr));
    for (let i = 0; i < fi; i++) body[i] *= i / fi;
    for (let i = 0; i < fo; i++) body[n2 - 1 - i] *= i / fo;

    /* 16bit PCM WAV */
    const bytes = new ArrayBuffer(44 + n2 * 2);
    const v = new DataView(bytes);
    const put = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
    put(0, 'RIFF'); v.setUint32(4, 36 + n2 * 2, true); put(8, 'WAVE');
    put(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    put(36, 'data'); v.setUint32(40, n2 * 2, true);
    for (let i = 0; i < n2; i++) {
      const x = Math.max(-1, Math.min(1, body[i]));
      v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
    }
    let txt = '';
    const u8 = new Uint8Array(bytes);
    for (let i = 0; i < u8.length; i += 0x8000) {
      txt += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    }
    return { b64: btoa(txt), sr, samples: n2, srcPeak: pk, srcRms: rms, gain: g,
      dur: n2 / sr, srcCh: ab.numberOfChannels };
  }, { b64: buf.toString('base64'), mime, rate, start: parseFloat(a), end: parseFloat(b),
       PEAK, RMS, TRIM, FADE_IN, FADE_OUT });
  await br.close();

  const dst = path.resolve(output);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, Buffer.from(out.b64, 'base64'));
  console.log(path.basename(dst) + '  ' + out.dur.toFixed(3) + 's  ' + out.sr + 'Hz 单声道 16bit  ' +
    (fs.statSync(dst).size / 1024).toFixed(1) + ' KB  增益 ' + (20 * Math.log10(out.gain)).toFixed(1) + 'dB');
})();
