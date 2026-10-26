/* 装备图标总览，按武器 / 六级头盔 / 六级护甲排列。需要 sharp。 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const manifest = require('../assets/gear-prompts.json');
(async () => {
  const groups = [manifest.icons.filter(a => ['weapon','bag'].includes(a.type)), manifest.icons.filter(a => a.type === 'helmet').sort((a,b) => a.lv - b.lv), manifest.icons.filter(a => a.type === 'body').sort((a,b) => a.lv - b.lv)];
  const width = 912, height = 548, svg = [`<rect width="${width}" height="${height}" fill="#0b1411"/>`], layers = [];
  svg.push('<text x="32" y="36" fill="#75a591" font-size="12" letter-spacing="3">TIDELINE / EQUIPMENT</text><text x="32" y="69" fill="#dce7df" font-size="24">潮汐线 · 装备图标</text><text x="880" y="64" text-anchor="end" fill="#7c978b" font-size="12">17 张 / 48 × 48 / 透明 PNG</text>');
  for (const [row, items] of groups.entries()) for (const [col, a] of items.entries()) {
    const x = 24 + col * 144, y = 92 + row * 144, colour = ['#587f91','#7d8e62','#a48a58'][row];
    svg.push(`<rect x="${x + 4}" y="${y}" width="136" height="136" rx="4" fill="#101d18" stroke="#233a2f"/><rect x="${x + 4}" y="${y}" width="3" height="136" fill="${colour}"/><text x="${x + 72}" y="${y + 112}" text-anchor="middle" fill="#c6d5cb" font-size="11">${a.lv ? 'Lv' + a.lv + ' ' : ''}${a.name}</text><text x="${x + 72}" y="${y + 128}" text-anchor="middle" fill="#668477" font-size="10" font-family="Consolas">${a.id}</text>`);
    layers.push({ input: await sharp(path.join(root, 'assets/gear', a.id + '.png')).resize(96, 96, { kernel: 'nearest' }).png().toBuffer(), left: x + 24, top: y + 2 });
  }
  const folder = path.join(root, 'output/gear-icons'); fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, 'contact-sheet.png');
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" font-family="Microsoft YaHei, sans-serif">${svg.join('')}</svg>`)).composite(layers).png().toFile(file);
  console.log(file);
})().catch(error => { console.error(error); process.exitCode = 1; });
