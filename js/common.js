/* ============================================================
   公共基础：物品索引 / HTML 转义
   全局都被用，所以放在 data.js 之后、其它模块之前。
   ============================================================ */

/* ---------------- 物品图标 ----------------
   约定：assets/items/{id}.png，48×48 透明 PNG。
   缺图不会报错，会退回成带稀有度颜色的色块。
   打包成单文件时 build.js 会把这些图转成 base64 内联进来。
   -------------------------------------------------- */
const ITEM_BY_ID = {};
for (const it of ITEMS) ITEM_BY_ID[it.id] = it;

/* Shared per-item capacity. Keys use cap for remaining durability so transfers,
   dropped items and save entries preserve the same state as medical supplies. */
const ItemCapacity={
  max(item){return item ? (item.maxDur||item.healCap||item.effect?.uses||0) : 0;},
  remaining(entry){const item=entry&&(entry.item||stashItem(entry)),max=this.max(item);return !max?0:typeof entry.cap==='number'?(Number.isFinite(entry.cap)?Math.max(0,Math.min(max,entry.cap)):0):max;},
  isPartial(entry){return this.remaining(entry)<this.max(entry&&(entry.item||stashItem(entry)));},
  text(entry){const item=entry&&(entry.item||stashItem(entry));return item?.cat==='key'?this.remaining(entry)+' / '+this.max(item):Medical.capText(entry);},
  /* 详情表格里的精确读数统一成「N / 上限」：和容量条 / 次数条的口径一致 */
  value(entry){const max=this.max(entry&&(entry.item||stashItem(entry)));return max?Math.ceil(this.remaining(entry))+' / '+max:'—';},
  label(item){return item?.cat==='key'?'剩余耐久':item?.effect?'剩余次数':'当前容量';}
};

/* innerHTML 拼字符串时统一过一遍，名字里有 & < > 也不会把结构搞坏 */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ------------------------------------------------------------
   当前携带容量
   装了背包就用背包的容量，没装就是基础 4 格 —— 是替换，不是叠加。
   调用点遍布局内与藏身处，所以放这里；Save 在 save.js 定义，
   这个函数只会在运行时被调用，那时它一定已经初始化好了。
   ------------------------------------------------------------ */
function bagSlots() {
  const g = Save.gear && Save.gear.back;
  return (g && g.slots) || BASE_BAG_SLOTS;
}
