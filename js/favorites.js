/* ============================================================
   收藏标记
   ------------------------------------------------------------
   四种符号，给物品打一个「我打算拿它干什么」的记号。
   不是稀有度、不是任务标记 —— 纯粹是玩家自己做备忘：
     星   重点留着
     菱   待售
     问   待查（不知道有什么用）
     叉   忽略，别捡
   存在 Save.favorites = { [itemId]: markIndex }，跨局保留。
   一个物品只有一个标记，点同一个符号等于取消。
   ============================================================ */
const FAV_MARKS = [
  { id: 'star',  name: '重点', tip: '重点留着',  color: '#e8c46a', path: 'm12 4 2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8Z' },
  { id: 'sale',  name: '待售', tip: '打算卖掉',  color: '#5dc9a5', path: 'M12 3.5 20.5 12 12 20.5 3.5 12Z' },
  { id: 'study', name: '待查', tip: '还不确定用途', color: '#7aa8dd', path: 'M9.2 9.4a2.9 2.9 0 1 1 3.9 2.8c-.8.3-1.2.9-1.2 1.7v.7M12 17.6h.01' },
  { id: 'drop',  name: '忽略', tip: '不用留',   color: '#a8998f', path: 'm7 7 10 10M17 7 7 17' }
];

const Favorites = {
  _map() {
    if (!Save.favorites || typeof Save.favorites !== 'object') Save.favorites = {};
    return Save.favorites;
  },

  /* 这个物品的标记序号，没有就是 -1 */
  get(id) {
    const v = this._map()[id];
    return Number.isInteger(v) && v >= 0 && v < FAV_MARKS.length ? v : -1;
  },
  mark(id) { const i = this.get(id); return i < 0 ? null : FAV_MARKS[i]; },

  /* 打标记；点的是同一个符号就取消（再点一次等于反悔） */
  toggle(id, mark) {
    if (!id) return -1;
    const map = this._map();
    if (this.get(id) === mark) { delete map[id]; }
    else if (Number.isInteger(mark) && mark >= 0 && mark < FAV_MARKS.length) { map[id] = mark; }
    else return this.get(id);
    if (typeof Save !== 'undefined' && Save.save) Save.save();
    return this.get(id);
  },

  clear(id) {
    const map = this._map();
    if (id in map) { delete map[id]; if (Save.save) Save.save(); }
  },

  /* 按标记筛选，-1 表示全部 */
  ids(mark) {
    return Object.keys(this._map()).filter(id => mark == null || mark < 0 || this.get(id) === mark);
  },

  count(mark) {
    if (mark == null || mark < 0) return Object.keys(this._map()).length;
    return Object.keys(this._map()).filter(id => this.get(id) === mark).length;
  },

  /* 小图标：格子右上角、菜单项前面都用它 */
  icon(mark, size) {
    const m = typeof mark === 'number' ? FAV_MARKS[mark] : mark;
    if (!m) return '';
    const s = size || 14;
    return '<svg class="fav-ico" viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" ' +
      'stroke="' + m.color + '" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true"><path d="' + m.path + '"/></svg>';
  },

  /* 格子右上角的角标；没有标记时返回空串 */
  badge(id) {
    const m = this.mark(id);
    if (!m) return '';
    return '<span class="fav-badge" title="收藏 · ' + esc(m.name) + '" style="color:' + m.color + '">' +
      this.icon(m, 12) + '</span>';
  },

  /* 右键菜单里的收藏项（不含「详情」，那个由调用方自己放第一位）。
     点同一个符号等于取消，hint 标出当前状态。 */
  menuEntries(id, onDone) {
    const cur = this.get(id);
    const items = FAV_MARKS.map((m, i) => ({
      label: '标记 · ' + m.name,
      hint: cur === i ? '当前' : m.tip,
      onClick: () => { Favorites.toggle(id, i); if (onDone) onDone(); }
    }));
    if (cur >= 0) {
      items.push({ label: '清除标记', danger: true, onClick: () => { Favorites.clear(id); if (onDone) onDone(); } });
    }
    return items;
  }
};
