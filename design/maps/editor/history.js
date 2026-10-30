/* 撤销栈。数据整份快照，事务边界由调用方决定：
 *   begin(label) …直接改 data… end()      → 一次拖拽 = 一步撤销
 *   run(label, fn)                        → 一次性动作（放置、删除、改字段）
 * 快照粒度是"每次提交"，不是"每个格子"：一次刷墙两百格只占一份快照。
 * 72×56 的 layout.json 序列化约 130KB，80 步上限约 10MB，浏览器完全够用。 */
(function (root) {
  'use strict';

  const Core = root.MapCore;

  function createHistory(store, options) {
    const limit = (options && options.limit) || 80;
    let undoStack = [];
    let redoStack = [];
    let pending = null;

    const snap = () => Core.clone(store.get().data);
    const print = d => JSON.stringify(d);
    const bump = () => store.set({ docVersion: (store.get().docVersion || 0) + 1 });

    function push(label, before) {
      undoStack.push({ label, data: before });
      if (undoStack.length > limit) undoStack.shift();
      redoStack = [];
    }

    return {
      get canUndo() { return undoStack.length > 0; },
      get canRedo() { return redoStack.length > 0; },
      get depth() { return undoStack.length; },

      labels() {
        return {
          undo: undoStack.length ? undoStack[undoStack.length - 1].label : '',
          redo: redoStack.length ? redoStack[redoStack.length - 1].label : ''
        };
      },

      /* 拖拽起点：先把当前状态拍下来，松手时再决定要不要进栈。 */
      begin(label) {
        if (!store.get().data) return false;
        if (pending) pending.label = label;
        else pending = { label, data: snap() };
        return true;
      },

      end() {
        if (!pending) return false;
        const before = pending.data;
        const label = pending.label;
        pending = null;
        if (print(before) === print(store.get().data)) return false;
        push(label, before);
        bump();
        return true;
      },

      cancel() { pending = null; },

      /* 一次性动作：跑 fn，真的有变化才进栈。 */
      run(label, fn) {
        if (!store.get().data) return false;
        if (pending) { fn(store.get().data); return true; }
        const before = snap();
        fn(store.get().data);
        if (print(before) === print(store.get().data)) return false;
        push(label, before);
        bump();
        return true;
      },

      /* 先做操作、再决定要不要进栈：fn 的返回值会被透传。
       * 用于"操作本身可能失败"的场合（放置、填充），这样失败时不会留下空气撤销步。 */
      apply(label, fn) {
        if (!store.get().data) return { changed: false, value: null };
        const before = snap();
        const value = fn(store.get().data);
        if (print(before) === print(store.get().data)) return { changed: false, value };
        if (pending) return { changed: true, value };
        push(label, before);
        bump();
        return { changed: true, value };
      },

      undo() {
        if (!undoStack.length) return false;
        const entry = undoStack.pop();
        redoStack.push({ label: entry.label, data: snap() });
        store.set({ data: entry.data });
        bump();
        return true;
      },

      redo() {
        if (!redoStack.length) return false;
        const entry = redoStack.pop();
        undoStack.push({ label: entry.label, data: snap() });
        store.set({ data: entry.data });
        bump();
        return true;
      },

      clear() { undoStack = []; redoStack = []; pending = null; }
    };
  }

  root.EditorHistory = { createHistory };
})(window);
