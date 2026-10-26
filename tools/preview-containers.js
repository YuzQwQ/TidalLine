/* 新增容器总览，需要 sharp。 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const entries = [['crate_tool','工具箱','快取 · 工业'], ['crate_med','医疗柜','标准 · 医疗'], ['crate_elec','电子设备柜','标准 · 电子/工业'], ['crate_supply','防水补给箱','重型 · 补给']];
(async () => {
  const layers = [], svg = ['<rect width="672" height="236" fill="#0b1411"/>', '<text x="24" y="32" fill="#dce7df" font-size="20">新增容器 · 统一俯视透视</text>', '<text x="24" y="54" fill="#759685" font-size="12">每件占一格 · 人物不可穿过 · 空箱保留碰撞</text>'];
  for (const [i, [id, name, tier]] of entries.entries()) {
    const x = 20 + i * 160, y = 72;
    svg.push(`<rect x="${x}" y="${y}" width="152" height="148" rx="4" fill="#12221a" stroke="#2b4536"/><text x="${x + 76}" y="${y + 117}" text-anchor="middle" fill="#c3d6ca" font-size="13">${name}</text><text x="${x + 76}" y="${y + 135}" text-anchor="middle" fill="#6d8c7a" font-size="11">${tier}</text>`);
    layers.push({ input: await sharp(path.join(root, 'assets/props', id + '.png')).resize(96, 96, { kernel: 'nearest' }).png().toBuffer(), left: x + 28, top: y + 3 });
  }
  const folder = path.join(root, 'output/scene-art'); fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, 'new-containers.png');
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="672" height="236" font-family="Microsoft YaHei, sans-serif">${svg.join('')}</svg>`)).composite(layers).png().toFile(file);
  console.log(file);
})().catch(error => { console.error(error); process.exitCode = 1; });
