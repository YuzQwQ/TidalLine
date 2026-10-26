/* 场景美术总览。需要 sharp。node tools/preview-scene-art.js */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const manifest = require('../assets/asset-prompts.json');
const labels = { s: '正面', n: '背面', e: '右侧' };
const entries = [...manifest.assets, ...manifest.optional].flatMap(a => a.facing
  ? a.dirs.map(dir => ({ group: a.group, id: a.id + '_' + dir, name: a.name + ' · ' + labels[dir] }))
  : [{ group: a.group, id: a.id, name: a.name }]);
const esc = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;');
(async () => {
  const columns = 6, cell = 144, margin = 24, header = 92;
  const width = columns * cell + margin * 2, height = Math.ceil(entries.length / columns) * cell + header + margin;
  const layers = [], svg = [`<rect width="${width}" height="${height}" fill="#0b1411"/>`];
  svg.push('<text x="32" y="36" fill="#75a591" font-size="12" letter-spacing="3">TIDELINE / WORLD ART</text>');
  svg.push(`<text x="32" y="69" fill="#dce7df" font-size="24">潮汐线 · 场景美术</text><text x="${width - 32}" y="64" text-anchor="end" fill="#7c978b" font-size="12">${entries.length} 张 / 32 × 32</text>`);
  for (let i = 0; i < entries.length; i++) {
    const a = entries[i], x = margin + (i % columns) * cell, y = header + Math.floor(i / columns) * cell;
    const color = { chars: '#577d99', props: '#8e8159', tiles: '#4a8069' }[a.group];
    svg.push(`<rect x="${x + 4}" y="${y}" width="136" height="136" rx="4" fill="#101d18" stroke="#233a2f"/><rect x="${x + 4}" y="${y}" width="3" height="136" fill="${color}"/>`);
    svg.push(`<text x="${x + 72}" y="${y + 111}" text-anchor="middle" fill="#c6d5cb" font-size="12">${esc(a.name)}</text><text x="${x + 72}" y="${y + 127}" text-anchor="middle" fill="#668477" font-size="10" font-family="Consolas">${a.group}/${a.id}</text>`);
    layers.push({ input: await sharp(path.join(root, 'assets', a.group, a.id + '.png')).resize(96, 96, { kernel: 'nearest' }).png().toBuffer(), left: x + 24, top: y + 2 });
  }
  const folder = path.join(root, 'output', 'scene-art'); fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, 'contact-sheet.png');
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" font-family="Microsoft YaHei, sans-serif">${svg.join('')}</svg>`)).composite(layers).png().toFile(file);
  console.log(file);
})().catch(error => { console.error(error); process.exitCode = 1; });
