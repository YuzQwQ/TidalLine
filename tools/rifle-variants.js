/* 步枪开火音的诊断变体定义。浏览器（试听页）与 node（导出脚本）共用这一份，
   避免两边参数走偏。

   A：原参数，五个层全开
   B：去掉 Sub，其余不动 —— 验证"低频咚声"是不是主因
   C：去 Sub + Crack 主瞬态收到 3ms（带弱残余）+ Body 改成中频带通短爆，
      不再靠一条长低通下扫

   三层都走同一套信号链（tanh 软削波 → 干声），种子与响度目标也一致，
   所以 A/B/C 之间、层与层之间可以直接对比。 */
(function (root, factory) {
  const def = factory();
  if (typeof module === 'object' && module.exports) module.exports = def;
  else root.RIFLE_VARIANTS = def;
})(typeof self !== 'undefined' ? self : this, function () {
  const clone = o => JSON.parse(JSON.stringify(o));

  return {
    seed: 20261102,
    targetRms: 0.10,     // 统一按"有声段 RMS"对齐，三层同目标
    maxPeak: 0.891,      // 约 -1.0dBFS，留出余量不削波
    versions: {
      A: {
        label: 'A 原始',
        note: '五个层全开，未做任何改动',
        layers: ['crack', 'body', 'sub', 'tail', 'mech'],
        profile: null,
        patch: null
      },
      B: {
        label: 'B 去 Sub',
        note: '只关掉 Sub，其余与原参数一致',
        layers: ['crack', 'body', 'tail', 'mech'],
        profile: null,
        patch: null
      },
      C: {
        label: 'C 短瞬态 + 中频爆裂',
        note: '去 Sub；Crack 主瞬态 30ms → 3ms，后接 30ms 弱残余；' +
          'Body 由 5.2k→520 的长低通下扫改成 2.6k→900 的带通短爆（80ms，起音 1ms）',
        layers: ['crack', 'body', 'tail', 'mech'],
        profile: 'derived',
        /* 只在 A 的参数上打补丁，其余层（tail / mech / vol / drive）原样保留 */
        patch(prof) {
          const p = clone(prof);
          p.crack = {
            freq: 4200, q: 0.9, gain: 0.55, dur: 0.003,
            resid: { freq: 2600, gain: 0.20, dur: 0.042, type: 'highpass' }
          };
          p.body = {
            from: 2600, to: 900, type: 'bandpass', q: 1.0,
            gain: 1.15, dur: 0.110, attack: 0.001
          };
          return p;
        }
      }
    }
  };
});
