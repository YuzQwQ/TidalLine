/* 三份清单与合并 Wiki 共用页面外壳；生成任一清单后自动刷新 Wiki。 */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const pages = [
  { key: 'items', name: '物品清单', file: '物品清单.html' },
  { key: 'gear', name: '装备清单', file: '装备清单.html' },
  { key: 'containers', name: '容器清单', file: '容器清单.html' }
];

function navigation(active, combined = false) {
  return `<nav class="wiki-nav" aria-label="清单导航">
  <a class="wiki-brand" href="wiki.html">潮汐线 <span>WIKI</span></a>
  <div class="wiki-links">${pages.map(p => `<a data-wiki-link="${p.key}" href="${combined ? '' : 'wiki.html'}#${p.key}"${active === p.key ? ' aria-current="page"' : ''}>${p.name}</a>`).join('')}</div>
  <a class="wiki-game" href="index.html">进入游戏 ↗</a>
</nav>`;
}

function writeWiki() {
  if (!pages.every(p => fs.existsSync(path.join(root, p.file)))) return;
  const sections = pages.map((p, index) => {
    const html = fs.readFileSync(path.join(root, p.file), 'utf8');
    const body = html.match(/<main class="wiki-sheet">([\s\S]*?)<\/main>/);
    // 旧清单尚未重新生成时，等下一份生成完成再整合。
    if (!body) return null;
    return `<section id="${p.key}" data-wiki-page="${p.key}" aria-label="${p.name}"${index ? ' hidden' : ''}>${body[1]}</section>`;
  });
  if (sections.some(s => !s)) return;
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>潮汐线 Wiki · 物品清单</title>
<link rel="stylesheet" href="wiki.css">
</head>
<body>
${navigation('items', true)}
<noscript><p class="wiki-noscript">导航切换需要 JavaScript，也可直接打开 ${pages.map(p => `<a href="${p.file}">${p.name}</a>`).join(' · ')}。</p></noscript>
<main class="wiki-sheet">${sections.join('\n')}</main>
<script src="wiki.js"></script>
</body>
</html>`;
  fs.writeFileSync(path.join(root, 'wiki.html'), html, 'utf8');
}

function writeSheet(file, html, key) {
  const result = html.replace('</head>', '<meta name="viewport" content="width=device-width, initial-scale=1">\n<link rel="stylesheet" href="wiki.css">\n</head>')
    .replace('<body>', `<body>\n${navigation(key)}\n<main class="wiki-sheet">`)
    .replace('</body>', '</main>\n</body>');
  fs.writeFileSync(path.join(root, file), result, 'utf8');
  writeWiki();
}

module.exports = { writeSheet, writeWiki };
