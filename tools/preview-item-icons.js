/* 素材总览，仅用于验收；需要 sharp。node tools/preview-item-icons.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({});
for (const name of ['config', 'data']) vm.runInContext(fs.readFileSync(path.join(root, 'js', name + '.js'), 'utf8'), context);
const items = vm.runInContext('ITEMS', context);
const rarities = vm.runInContext('RARITY', context);
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

(async () => {
  const columns = 6, cell = 144, margin = 24, header = 92;
  const width = columns * cell + margin * 2;
  const height = Math.ceil(items.length / columns) * cell + header + margin;
  const layers = [], svg = [];
  svg.push(`<rect width="${width}" height="${height}" fill="#0b1411"/>`);
  svg.push('<text x="32" y="36" fill="#75a591" font-size="12" letter-spacing="3">TIDELINE / INVENTORY</text>');
  svg.push(`<text x="32" y="69" fill="#dce7df" font-size="24">潮汐线 · 物品图标</text><text x="${width - 32}" y="64" text-anchor="end" fill="#7c978b" font-size="12">${items.length} 件 / 48 × 48 / 透明 PNG</text>`);
  for (let i = 0; i < items.length; i++) {
    const item = items[i], x = margin + (i % columns) * cell, y = header + Math.floor(i / columns) * cell;
    svg.push(`<rect x="${x + 4}" y="${y}" width="136" height="136" rx="4" fill="#101d18" stroke="#233a2f"/>`);
    svg.push(`<rect x="${x + 4}" y="${y}" width="3" height="136" fill="${rarities[item.r - 1].color}"/>`);
    svg.push(`<text x="${x + 72}" y="${y + 111}" text-anchor="middle" fill="#c6d5cb" font-size="13">${esc(item.name)}</text>`);
    svg.push(`<text x="${x + 72}" y="${y + 127}" text-anchor="middle" fill="#668477" font-size="10" font-family="Consolas">${item.id}</text>`);
    layers.push({ input: await sharp(path.join(root, 'assets', 'items', item.id + '.png')).resize(96, 96, { kernel: 'nearest' }).png().toBuffer(), left: x + 24, top: y + 2 });
  }
  const folder = path.join(root, 'output', 'item-icons'); fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, 'contact-sheet.png');
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" font-family="Microsoft YaHei, sans-serif">${svg.join('')}</svg>`))
    .composite(layers).png().toFile(file);
  console.log(file);
})().catch(error => { console.error(error); process.exitCode = 1; });
