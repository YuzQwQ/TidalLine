/* 门的八种方向/状态对照；需要 sharp。 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const states = [['', '正向 · 关闭'], ['_open', '正向 · 打开'], ['_side', '侧向 · 关闭'], ['_side_open', '侧向 · 打开']];
(async () => {
  const width = 672, height = 388, layers = [];
  const svg = [`<rect width="${width}" height="${height}" fill="#0b1411"/>`, '<text x="24" y="32" fill="#dce7df" font-size="20">门洞方向与开关状态</text>', '<text x="24" y="54" fill="#759685" font-size="12">正向：东西墙 / 上下通行　　侧向：南北墙 / 左右通行</text>'];
  for (const [row, base] of ['door', 'sdoor'].entries()) for (const [col, [suffix, label]] of states.entries()) {
    const x = 20 + col * 160, y = 72 + row * 152, id = base + suffix;
    svg.push(`<rect x="${x}" y="${y}" width="152" height="144" rx="4" fill="#12221a" stroke="#2b4536"/>`);
    svg.push(`<text x="${x + 76}" y="${y + 116}" text-anchor="middle" fill="#c3d6ca" font-size="12">${row ? '避难门' : '普通门'} · ${label}</text><text x="${x + 76}" y="${y + 133}" text-anchor="middle" fill="#6d8c7a" font-family="Consolas" font-size="10">${id}</text>`);
    layers.push({ input: await sharp(path.join(root, 'assets/props', id + '.png')).resize(96, 96, { kernel: 'nearest' }).png().toBuffer(), left: x + 28, top: y + 3 });
  }
  const folder = path.join(root, 'output/scene-art'); fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, 'door-comparison.png');
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" font-family="Microsoft YaHei, sans-serif">${svg.join('')}</svg>`)).composite(layers).png().toFile(file);
  console.log(file);
})().catch(error => { console.error(error); process.exitCode = 1; });
