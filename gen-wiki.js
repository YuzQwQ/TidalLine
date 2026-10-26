/* 统一更新入口：node gen-wiki.js。无需服务器，双击 wiki.html 即可浏览。 */
const { execFileSync } = require('child_process');
const path = require('path');
for (const file of ['gen-item-sheet.js', 'gen-gear-sheet.js', 'gen-container-sheet.js']) {
  execFileSync(process.execPath, [path.join(__dirname, file)], { cwd: __dirname, stdio: 'inherit' });
}
require('./tools/wiki-layout').writeWiki();
console.log('已生成 wiki.html（物品 / 装备 / 容器）');
