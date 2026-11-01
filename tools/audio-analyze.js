/* 音频素材体检：读源文件规格 + 解码后量响度/静音头尾。
   用法：node tools/audio-analyze.js assets/audio/Audio-RPG
   输出一张表，用来判断哪些适合做一次性音效（时长、是否削波、要不要裁头）。 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.resolve(ROOT, process.argv[2] || 'assets/audio/Audio-RPG');
const EXT = /\.(ogg|wav|mp3|m4a)$/i;

/* Ogg Vorbis 头 → 源采样率/声道/时长（decodeAudioData 会按声卡重采样，不能用） */
function oggInfo(buf) {
  if (buf.toString('ascii', 0, 4) !== 'OggS') return null;
  const P = 27 + buf[26];
  if (buf[P] !== 1 || buf.toString('ascii', P + 1, P + 7) !== 'vorbis') return null;
  const rate = buf.readUInt32LE(P + 12);
  const ch = buf[P + 11];
  let last = 0;
  for (let i = buf.length - 27; i > 0; i--) {
    if (buf.toString('ascii', i, i + 4) === 'OggS') { last = i; break; }
  }
  const gran = Number(buf.readBigUInt64LE(last + 6));
  return { rate, ch, dur: rate ? gran / rate : 0 };
}
function wavInfo(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF') return null;
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let o = 12, fmt = null, dl = null;
  while (o + 8 <= buf.byteLength) {
    const id = buf.toString('ascii', o, o + 4), sz = v.getUint32(o + 4, true);
    if (id === 'fmt ') fmt = { ch: v.getUint16(o + 10, true), rate: v.getUint32(o + 12, true), bits: v.getUint16(o + 22, true) };
    else if (id === 'data') dl = sz;
    o += 8 + sz + (sz % 2);
    if (fmt && dl != null) break;
  }
  if (!fmt || dl == null) return null;
  return { ...fmt, dur: dl / (fmt.rate * fmt.ch * (fmt.bits / 8)) };
}

(async () => {
  const files = fs.readdirSync(DIR).filter(f => EXT.test(f)).sort((a, b) => a.localeCompare(b, 'en'));
  if (!files.length) { console.error('目录里没有音频：' + DIR); process.exit(1); }

  const items = files.map(f => {
    const buf = fs.readFileSync(path.join(DIR, f));
    const info = /\.ogg$/i.test(f) ? oggInfo(buf) : wavInfo(buf);
    return { file: f, bytes: buf.length, src: info, b64: buf.toString('base64') };
  });

  const b = await chromium.launch({ channel: 'msedge', headless: true });
  const p = await b.newPage();
  await p.goto('data:text/html,<body>');
  const stats = await p.evaluate(async (list) => {
    const ac = new AudioContext();
    const out = [];
    for (const it of list) {
      try {
        const bin = Uint8Array.from(atob(it.b64), c => c.charCodeAt(0));
        const ab = await ac.decodeAudioData(bin.buffer);
        const ch0 = ab.getChannelData(0);
        let peak = 0, sum = 0;
        for (let i = 0; i < ch0.length; i++) {
          const v = Math.abs(ch0[i]);
          if (v > peak) peak = v;
          sum += ch0[i] * ch0[i];
        }
        const rms = Math.sqrt(sum / ch0.length);
        // 头尾静音（|x| < 0.005 视为静音）
        const TH = 0.005;
        let head = 0, tail = 0;
        while (head < ch0.length && Math.abs(ch0[head]) < TH) head++;
        while (tail < ch0.length && Math.abs(ch0[ch0.length - 1 - tail]) < TH) tail++;
        out.push({
          ok: true,
          peak: +peak.toFixed(3),
          rms: +rms.toFixed(4),
          headMs: Math.round(head / ab.sampleRate * 1000),
          tailMs: Math.round(tail / ab.sampleRate * 1000),
          decCh: ab.numberOfChannels,
          decRate: ab.sampleRate
        });
      } catch (e) {
        out.push({ ok: false, err: String(e && e.message || e) });
      }
    }
    await ac.close();
    return out;
  }, items.map(it => ({ file: it.file, b64: it.b64 })));
  await b.close();

  /* ---------- 报表 ---------- */
  const pad = (s, n) => String(s).padEnd(n);
  const padL = (s, n) => String(s).padStart(n);
  console.log(pad('文件', 26) + padL('时长', 7) + padL('源', 12) + padL('KB', 7) +
    padL('峰值', 7) + padL('RMS', 8) + padL('头静', 7) + padL('尾静', 7) + '  标记');
  let warn = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i], st = stats[i] || {};
    const src = it.src ? (it.src.rate / 1000) + 'k/' + it.src.ch + 'ch' : '?';
    const flags = [];
    if (!st.ok) flags.push('解码失败');
    else {
      if (st.peak > 0.995) flags.push('削波');
      if (st.peak < 0.2) flags.push('偏轻');
      if (st.headMs > 40) flags.push('头部空' + st.headMs + 'ms');
      if (st.tailMs > 120) flags.push('尾部空' + st.tailMs + 'ms');
    }
    const dur = it.src ? it.src.dur : (st.ok ? 0 : 0);
    if (dur > 1.5) flags.push('偏长');
    if (flags.length) warn.push(it.file + ' → ' + flags.join('、'));
    console.log(
      pad(it.file, 26) + padL(dur.toFixed(2) + 's', 7) +
      padL(src, 12) + padL((it.bytes / 1024).toFixed(1), 7) +
      padL(st.ok ? st.peak : '-', 7) + padL(st.ok ? st.rms : '-', 8) +
      padL(st.ok ? st.headMs : '-', 7) + padL(st.ok ? st.tailMs : '-', 7) +
      (flags.length ? '  ' + flags.join('、') : '')
    );
  }
  console.log('\n共 ' + items.length + ' 个，' + (items.reduce((a, x) => a + x.bytes, 0) / 1024).toFixed(0) + ' KB');
  if (warn.length) {
    console.log('\n需要处理：');
    for (const w of warn) console.log('  ' + w);
  }
})();
