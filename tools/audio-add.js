/* 把切好的成品 wav 登记进 assets/audio/manifest.json：自动读头、算峰值/RMS/哈希。
   用法：node tools/audio-add.js <wav 路径> --id=shot_rifle --from=serutonin-auto-rifle --note="说明"
   同名 id 已存在时覆盖那一条（改了切法重新切完直接重登记即可）。
   --from 指向 manifest.sources 里的素材 id；新素材先用 --source 加一条来源。 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const argv = process.argv.slice(2);
const file = argv.find(a => !a.startsWith('--'));
const opt = k => {
  const hit = argv.find(x => x.startsWith('--' + k + '='));
  return hit ? hit.slice(k.length + 3).replace(/^"|"$/g, '') : null;
};

if (!file || !opt('id')) {
  console.error('用法：node tools/audio-add.js <wav> --id=xxx --from=素材id --note="说明"');
  process.exit(1);
}

const ROOT = path.join(__dirname, '..');
const MAN = path.join(ROOT, 'assets/audio/manifest.json');
const id = opt('id');
const abs = path.resolve(file);

/* ---- 读 16bit PCM WAV 头与采样 ---- */
function readWav(buf) {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const str = o => buf.toString('ascii', o, o + 4);
  if (str(0) !== 'RIFF' || str(8) !== 'WAVE') throw new Error('不是 RIFF/WAVE');
  let fmt = null, dataOff = 0, dataLen = 0;
  for (let o = 12; o + 8 <= buf.length;) {
    const cid = str(o), sz = v.getUint32(o + 4, true);
    if (cid === 'fmt ') fmt = {
      ch: v.getUint16(o + 10, true),
      rate: v.getUint32(o + 12, true),
      bits: v.getUint16(o + 22, true)
    };
    if (cid === 'data') { dataOff = o + 8; dataLen = sz; }
    o += 8 + sz + (sz % 2);
  }
  if (!fmt) throw new Error('缺 fmt 块');
  if (fmt.bits !== 16) throw new Error('目前只算 16bit');
  const n = Math.floor(dataLen / 2 / fmt.ch);
  let peak = 0, sum = 0;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < fmt.ch; c++) {
      const s = v.getInt16(dataOff + (i * fmt.ch + c) * 2, true) / 32768;
      if (Math.abs(s) > peak) peak = Math.abs(s);
      sum += s * s;
    }
  }
  return {
    dur: +(n / fmt.rate).toFixed(3),
    sampleRate: fmt.rate,
    channels: fmt.ch,
    bits: fmt.bits,
    peak: +peak.toFixed(3),
    rms: +Math.sqrt(sum / Math.max(1, n * fmt.ch)).toFixed(4),
    bytes: buf.length,
    sha256_16: crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16)
  };
}

const buf = fs.readFileSync(abs);
const stats = readWav(buf);
const man = JSON.parse(fs.readFileSync(MAN, 'utf8'));

const entry = Object.assign({
  id,
  file: path.basename(abs),
  from: opt('from') || null,
  note: opt('note') || ''
}, stats);

const i = (man.assets || []).findIndex(a => a.id === id);
if (i >= 0) man.assets[i] = entry;
else man.assets.push(entry);

fs.writeFileSync(MAN, JSON.stringify(man, null, 2) + '\n');
console.log((i >= 0 ? '更新 ' : '新增 ') + id.padEnd(20) +
  stats.dur.toFixed(3) + 's ' + stats.sampleRate + 'Hz ' + stats.channels + 'ch ' +
  '峰 ' + stats.peak + ' RMS ' + stats.rms + ' ' + Math.round(stats.bytes / 1024) + 'KB');
