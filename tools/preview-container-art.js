/* 把容器贴图放大拼成一张预览图，方便肉眼检查 32×32 下的可辨识度。
   用法：node tools/preview-container-art.js [缩放倍数] */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { read } = require('./lib/png-read');

const SCALE = Number(process.argv[2] || 4);
const COLS = 4;
const CELL = 32 * SCALE + 20;
const BG = [18, 26, 22];

const names = [
  'crate_wastepaper', 'crate_cardboard', 'crate_workwear',
  'crate_bedside', 'crate_staff', 'crate_satchel',
  'crate_luggage', 'crate_filing', 'crate_schoolbag',
  'crate_emergency', 'crate_comms', 'crate_rescuevest',
  'crate_jewelry', 'crate_leatherbag', 'crate_sealed',
  'crate_diplomatic'
];
const rows = Math.ceil(names.length / COLS);
const W = COLS * CELL, H = rows * CELL;
const out = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) {
  out[i * 4] = BG[0]; out[i * 4 + 1] = BG[1]; out[i * 4 + 2] = BG[2]; out[i * 4 + 3] = 255;
}
names.forEach((name, i) => {
  const img = read(path.join(__dirname, '..', 'assets', 'props', name + '.png'));
  const ox = (i % COLS) * CELL + 10, oy = Math.floor(i / COLS) * CELL + 10;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const [r, g, b, a] = img.px[y][x];
    if (a < 8) continue;
    for (let sy = 0; sy < SCALE; sy++) for (let sx = 0; sx < SCALE; sx++) {
      const px = ox + x * SCALE + sx, py = oy + y * SCALE + sy;
      const k = (py * W + px) * 4;
      out[k] = r; out[k + 1] = g; out[k + 2] = b; out[k + 3] = 255;
    }
  }
});

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) out.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))
]);
const file = path.join(__dirname, '..', 'output', 'shots', 'container-art.png');
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, png);
console.log(file);
