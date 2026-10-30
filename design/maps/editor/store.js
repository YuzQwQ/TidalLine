/* 编辑器状态。M1 只读，但结构按可写版留好：状态集中、变更只有一个入口、订阅驱动重绘。
 * 下一阶段加命令栈时，只需在 set 外面包一层 commit(patch, undoPatch)。 */
(function (root) {
  'use strict';

  function createStore(initial) {
    let state = Object.assign({}, initial);
    const listeners = [];
    return {
      get() { return state; },
      set(patch) {
        const next = Object.assign({}, state, typeof patch === 'function' ? patch(state) : patch);
        const changed = Object.keys(next).some(k => next[k] !== state[k]);
        state = next;
        if (changed) for (const fn of listeners.slice()) fn(state);
        return state;
      },
      subscribe(fn) {
        listeners.push(fn);
        return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
      }
    };
  }

  root.EditorStore = { createStore };
})(window);
