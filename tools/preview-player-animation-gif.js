/* 可分享的动作 GIF 总览，需要 sharp。 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const manifest = require('../assets/player-animation-prompts.json');
(async () => {
  const states = Object.entries(manifest.actions), dirs = ['s','n','e','w'];
  const width = 546, height = 60 + states.length * 112 + 16;
  const labels = ['正面','背面','右侧','左侧'];
  const svg = [`<rect width="${width}" height="${height}" fill="#0b1411"/>`, '<text x="12" y="25" fill="#bcdac9" font-size="17">潮汐线 · 玩家动画</text>'];
  for (let col = 0; col < 4; col++) svg.push(`<text x="${144 + col * 112}" y="48" text-anchor="middle" fill="#78a58b" font-size="11">${labels[col]}</text>`);
  for (let row = 0; row < states.length; row++) {
    const [state, action] = states[row], y = 60 + row * 112;
    svg.push(`<text x="12" y="${y + 35}" fill="#c4dbcd" font-size="13">${action.name}</text><text x="12" y="${y + 53}" fill="#6c8e79" font-size="10">${action.frames} 帧</text>`);
    for (let col = 0; col < 4; col++) svg.push(`<rect x="${90 + col * 112}" y="${y}" width="108" height="106" rx="3" fill="#12251a" stroke="#264333"/>`);
  }
  const base = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" font-family="Microsoft YaHei, sans-serif">${svg.join('')}</svg>`)).png().toBuffer();
  const sprites = {};
  for (const [state, action] of states) for (const dir of dirs) for (let frame = 0; frame < action.frames; frame++) {
    const size = action.size || 32;
    let pipeline = sharp(path.join(root, 'assets/anim', 'player_' + state + '_' + (dir === 'w' ? 'e' : dir) + '.png'))
      .extract({ left: frame * size, top: 0, width: size, height: size }).resize(size * 2, size * 2, { kernel: 'nearest' });
    if (size > 48) pipeline = pipeline.extract({ left: size - 48, top: size - 48, width: 96, height: 96 });
    if (size < 48) pipeline = pipeline.extend({ top: 48 - size, bottom: 48 - size, left: 48 - size, right: 48 - size, background: '#00000000' });
    if (dir === 'w') pipeline = pipeline.flop();
    sprites[state + '_' + dir + '_' + frame] = await pipeline.png().toBuffer();
  }
  const pages = [];
  for (let i = 0; i < 36; i++) {
    const time = i * 0.08, layers = [];
    for (const [row, [state, action]] of states.entries()) {
      const duration = action.frames / action.fps;
      const elapsed = action.loop ? time : time % (duration + 0.45);
      const step = Math.floor(elapsed * action.fps), frame = action.loop ? step % action.frames : Math.min(action.frames - 1, step);
      for (const [col, dir] of dirs.entries()) layers.push({ input: sprites[state + '_' + dir + '_' + frame], left: 96 + col * 112, top: 65 + row * 112 });
    }
    pages.push(await sharp(base).composite(layers).ensureAlpha().raw().toBuffer());
  }
  const folder = path.join(root, 'output/player-animation'); fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, 'player-animation.gif');
  await sharp(Buffer.concat(pages), { raw: { width, height: height * pages.length, channels: 4, pageHeight: height } })
    .gif({ loop: 0, delay: Array(pages.length).fill(80), colours: 64, dither: 0, effort: 6 }).toFile(file);
  console.log(file);
})().catch(error => { console.error(error); process.exitCode = 1; });
