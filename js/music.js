/* ============================================================
   背景音乐（当前只有局外大厅一首：《退潮之后 / After the Ebb》）
   ------------------------------------------------------------
   和 SFX 两条路：SFX 是 WebAudio 现场合成 + 短采样，音乐是整首流式播放。

   为什么不用 decodeAudioData 喂给 AudioBuffer：三分多钟的双声道浮点缓冲
   要 70MB 常驻内存，换来的只是"能接进 SFX 总线"——而音乐本来就不需要
   和枪声一起进压缩器。用 <audio> 流式播，内存是几十 KB。

   为什么不用 createMediaElementSource 接进 SFX.ctx：file:// 打开时浏览器把
   本地音频当跨域，MediaElementSource 会直接输出静音。单文件版就是 file:// 跑的，
   这条路在最重要的使用场景上是哑的。所以音量走 el.volume，自己淡入淡出。
   ============================================================ */
const Music = {
  el: null,
  cur: null,          // 当前曲目 id
  vol: 0.5,           // 曲目基准音量
  on: true,
  _timer: null,
  _retry: false,

  TRACKS: {
    base: { file: 'assets/audio/bgm_base.mp3', vol: 0.45, name: '退潮之后 / After the Ebb' }
  },

  ensure() {
    if (this.el) return this.el;
    const el = new Audio();
    el.loop = true;
    el.preload = 'auto';
    el.volume = 0;
    el.crossOrigin = 'anonymous';
    el.addEventListener('error', () => {
      /* 单文件版没有内联音乐（太大），加载不到就安静算了，别刷控制台 */
      if (typeof console !== 'undefined' && console.info) console.info('[music] 曲目不可用，跳过背景音乐');
    });
    this.el = el;
    return el;
  },

  /* 单文件版把整首内联成 data URI（window.__MUSIC__），多文件版直接读文件 */
  urlOf(id) {
    const inline = (typeof window !== 'undefined') && window.__MUSIC__;
    if (inline && inline[id]) return inline[id];
    const t = this.TRACKS[id];
    return t ? t.file : '';
  },

  play(id) {
    const t = this.TRACKS[id];
    if (!t || !this.on) return;
    const url = this.urlOf(id);
    if (!url) return;
    const el = this.ensure();
    if (this.cur !== id) {
      this.cur = id;
      el.src = url;
      try { el.currentTime = 0; } catch (e) { /* 还没元数据，忽略 */ }
    }
    this.vol = t.vol;
    this._start();
  },

  _start() {
    const el = this.el;
    if (!el) return;
    let p;
    try { p = el.play(); } catch (e) { return; }
    if (p && p.catch) p.catch(() => {
      /* 自动播放被拦：等下一次真实手势补一次（从 URL 直插 #base 时会走到这） */
      if (this._retry) return;
      this._retry = true;
      const wake = () => { this._retry = false; el.play().catch(() => {}); };
      window.addEventListener('pointerdown', wake, { once: true, capture: true });
      window.addEventListener('keydown', wake, { once: true, capture: true });
    });
    this.fadeTo(this.vol, 1.2);
  },

  stop(fade) {
    if (!this.el) return;
    clearInterval(this._timer);
    this.fadeTo(0, fade == null ? 0.8 : fade, () => {
      try { this.el.pause(); } catch (e) { /* 忽略 */ }
    });
  },

  /* 音量过渡：切场景时别硬切，1 秒左右滑过去 */
  fadeTo(v, secs, done) {
    clearInterval(this._timer);
    const el = this.el;
    if (!el) return;
    const from = el.volume;
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const ms = Math.max(1, (secs == null ? 1 : secs) * 1000);
    this._timer = setInterval(() => {
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const k = Math.min(1, (now - t0) / ms);
      el.volume = Math.max(0, Math.min(1, from + (v - from) * k));
      if (k >= 1) {
        clearInterval(this._timer);
        this._timer = null;
        if (done) done();
      }
    }, 40);
  },

  setOn(on) {
    this.on = !!on;
    if (!this.on) this.stop(0.4);
    else if (this.cur) this._start();
  }
};
