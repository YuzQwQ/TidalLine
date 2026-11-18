/* 收藏标记专项：四种符号、切换语义、存档读写、脏数据清洗。
   node tools/test-favorites.js

   收藏是纯玩家备忘：不改价格、不改掉落、不影响任何数值。
   所以这里除了功能，还专门钉一条「标记前后物品本身没变」。
*/
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.resolve(__dirname, '..');

const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};

const ctx = vm.createContext({
  console, Math, performance: { now: () => Date.now() },
  Uint8Array, Float32Array, Int32Array, Set, Map, Array, Object, JSON,
  localStorage, setTimeout, clearTimeout
});
for (const f of ['config.js', 'data.js', 'common.js', 'attachment-data.js', 'attachments.js', 'core.js', 'save.js', 'favorites.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, { filename: f });
}

const G = vm.runInContext('({ FAV_MARKS, Favorites, Save, ITEMS, ITEM_BY_ID, itemGroup, CFG })', ctx);
const { FAV_MARKS, Favorites, Save, ITEMS, ITEM_BY_ID, itemGroup } = G;

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name + (extra ? '  ' + extra : '')); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  ' + extra : '')); }
}

/* 两个有代表性的收集品：一个常见、一个红色 */
const col = ITEMS.filter(i => itemGroup(i) === 'collectible');
const A = col[0].id, B = col.find(i => i.r === 6)?.id || col[1].id;

console.log('\n=== 1. 四种符号 ===');
{
  ok('正好 4 种', FAV_MARKS.length === 4, FAV_MARKS.map(m => m.name).join(' / '));
  ok('每种都有名字、颜色、图形', FAV_MARKS.every(m => m.id && m.name && m.color && m.path));
  ok('名字互不重复', new Set(FAV_MARKS.map(m => m.name)).size === 4);
  ok('颜色互不重复', new Set(FAV_MARKS.map(m => m.color)).size === 4);
  ok('icon 生成 svg 且带颜色', Favorites.icon(0).includes('<svg') && Favorites.icon(0).includes(FAV_MARKS[0].color));
  ok('icon 传非法值返回空串', Favorites.icon(null) === '');
}

console.log('\n=== 2. 打标记 / 切换 / 清除 ===');
{
  Save.favorites = {};
  ok('初始没有标记', Favorites.get(A) === -1);
  ok('初始 badge 为空', Favorites.badge(A) === '');

  Favorites.toggle(A, 0);
  ok('打上「重点」', Favorites.get(A) === 0, FAV_MARKS[0].name);
  ok('badge 带符号与颜色', Favorites.badge(A).includes('fav-badge') && Favorites.badge(A).includes(FAV_MARKS[0].color));

  Favorites.toggle(A, 1);
  ok('改标记会覆盖，不是叠加', Favorites.get(A) === 1 && Favorites.count() === 1, FAV_MARKS[1].name);

  Favorites.toggle(A, 1);
  ok('再点同一个符号 = 取消', Favorites.get(A) === -1 && Favorites.count() === 0);

  Favorites.toggle(A, 2);
  Favorites.toggle(B, 2);
  Favorites.toggle(col[2].id, 3);
  ok('按符号计数', Favorites.count(2) === 2 && Favorites.count(3) === 1, '待查 2 / 忽略 1');
  ok('全部计数', Favorites.count() === 3);

  Favorites.clear(A);
  ok('clear 只清一个', Favorites.get(A) === -1 && Favorites.get(B) === 2);

  ok('toggle 传非法符号不写入', (() => { const before = Favorites.get(B); Favorites.toggle(B, 9); return Favorites.get(B) === before; })());
}

console.log('\n=== 3. 菜单条目 ===');
{
  Save.favorites = {};
  Favorites.toggle(A, 0);
  const items = Favorites.menuEntries(A);
  ok('菜单有 4 个标记项', items.filter(x => /^标记 · /.test(x.label)).length === 4);
  ok('当前标记的 hint 写「当前」', items.find(x => x.label === '标记 · ' + FAV_MARKS[0].name).hint === '当前');
  ok('有标记时多一条「清除标记」', items.some(x => x.label === '清除标记'));
  ok('没有标记时不给清除项', !Favorites.menuEntries(col[3].id).some(x => x.label === '清除标记'));
}

console.log('\n=== 4. 存档读写 ===');
{
  Save.favorites = {};
  Favorites.toggle(A, 1);
  Favorites.toggle(B, 3);
  Save.flush();
  const raw = JSON.parse(store[Save.key]);
  ok('写进存档', raw.favorites && raw.favorites[A] === 1 && raw.favorites[B] === 3,
    JSON.stringify(raw.favorites));

  /* 重新读档 */
  Save.favorites = {};
  Save.load();
  ok('读档后标记还在', Favorites.get(A) === 1 && Favorites.get(B) === 3);
}

console.log('\n=== 5. 脏数据清洗 ===');
{
  /* 越界值、非法 id、非数字，读档时都该被丢掉 */
  const raw = JSON.parse(store[Save.key]);
  raw.favorites = { [A]: 9, [B]: -1, not_an_item: 0, [col[4].id]: '2' };
  store[Save.key] = JSON.stringify(raw);
  Save.load();
  ok('越界序号被丢', Favorites.get(A) === -1, 'A=' + Favorites.get(A));
  ok('负数被丢', Favorites.get(B) === -1);
  ok('不存在的物品被丢', !('not_an_item' in Save.favorites));
  ok('字符串 "2" 被丢（只收整数）', Favorites.get(col[4].id) === -1);
  ok('清洗后总数为 0', Favorites.count() === 0);

  /* 老存档根本没有这个字段 */
  delete raw.favorites;
  store[Save.key] = JSON.stringify(raw);
  Save.load();
  ok('老存档缺字段时是空表', Save.favorites && typeof Save.favorites === 'object' && Favorites.count() === 0);
  ok('缺字段不会崩', Favorites.get(A) === -1);
}

console.log('\n=== 6. 收藏不影响任何数值 ===');
{
  Save.favorites = {};
  const it = ITEM_BY_ID[A];
  const snap = JSON.stringify(it);
  Favorites.toggle(A, 0);
  ok('物品定义没被改动', JSON.stringify(it) === snap);
  ok('标记不写进物品本身', !('fav' in it) && !('favorite' in it));
  ok('价格不受影响', it.price === JSON.parse(snap).price);
}

console.log('\n---------------------------------------');
console.log('  通过 ' + pass + ' / 失败 ' + fail);
console.log('---------------------------------------');
process.exit(fail ? 1 : 0);
