/* 采样音效：内联加载、时长校验、多段序列、降级。
   用法：node tools/test-audio-sample.js */
const path = require('path');
const assert = require('assert/strict');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const man = require('../assets/audio/manifest.json');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    /* ---------- 1. 单文件版：8 段采样全部解码，时长对得上 ---------- */
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.goto(pathToFileURL(path.join(ROOT, '潮汐线.html')).href + '#base');
    await page.waitForFunction(() => typeof SFX !== 'undefined' && Game.state === 'base');

    const injected = await page.evaluate(() => Object.keys(window.__AUDIO__ || {}));
    assert.equal(injected.length, man.assets.length, '内联的音频数量');
    assert.deepEqual(injected.sort(), man.assets.map(a => a.id).sort(), '内联 id 与 manifest 一致');

    /* init 会建 AudioContext 并异步 load */
    await page.evaluate(() => SFX.init());
    const loaded = await page.evaluate(async () => {
      await SFX.load();
      const out = {};
      for (const id of Object.keys(SFX.samples)) {
        out[id] = { dur: +SFX.samples[id].duration.toFixed(3), ch: SFX.samples[id].numberOfChannels };
      }
      return out;
    });
    assert.equal(Object.keys(loaded).length, man.assets.length, '解码成功的段数');
    for (const a of man.assets) {
      assert(loaded[a.id], a.id + ' 已解码');
      assert(Math.abs(loaded[a.id].dur - a.dur) < 0.02, a.id + ' 时长对得上 manifest');
      assert.equal(loaded[a.id].ch, 1, a.id + ' 是单声道');
    }

    /* ---------- 1.5 近战 / 出售：新素材按各自的响度档对齐，不落进默认值 ---------- */
    const extra = await page.evaluate(() => ({
      melee: SFX.gainOf.melee, sell: SFX.gainOf.sell,
      loudMelee: SFX.LOUD.melee, loudSell: SFX.LOUD.sell,
      durMelee: SFX.samples.melee && SFX.samples.melee.duration,
      durSell: SFX.samples.sell && SFX.samples.sell.duration,
      durShotgun: SFX.samples.shot_shotgun && SFX.samples.shot_shotgun.duration
    }));
    assert(extra.melee > 0 && extra.sell > 0, '近战 / 出售采样有各自的播放增益');
    const rms = id => man.assets.find(a => a.id === id).rms;
    assert(Math.abs(extra.melee * rms('melee') - extra.loudMelee) < 0.02, '近战对齐到 LOUD.melee');
    assert(Math.abs(extra.sell * rms('sell') - extra.loudSell) < 0.02, '出售对齐到 LOUD.sell');
    assert(extra.durMelee < 0.55, '近战挥砍短于折叠刀 0.55s 攻击间隔');
    /* 霰弹开火必须留得住衰减尾音——早期版本切到 0.4s，听着像被人掐断。
       现在换成带完整尾音的录音（0.78s），只卡下限：换更长的素材不用改测试。 */
    assert(extra.durShotgun >= 0.70, '霰弹留得住衰减尾音，实际 ' + extra.durShotgun.toFixed(3) + 's');

    /* ---------- 1.6 搜索音按容器固定：一个容器一个声，不随机 ---------- */
    const sr = await page.evaluate(() => {
      /* 同一个容器连搜 12 次，必须每次都是同一条 */
      const stable = {};
      const hit = (at) => {
        const got = [];
        const real = SFX._playSample.bind(SFX);
        SFX._playSample = (id) => { got.push(id); return real(id); };
        for (let i = 0; i < 12; i++) SFX.play('search', { at });
        SFX._playSample = real;
        return got;
      };
      for (const at of ['crate_luggage', 'crate_filing', 'crate_tool', 'crate_leatherbag', 'crate_fast']) {
        const got = hit(at);
        stable[at] = { kinds: [...new Set(got)].sort(), n: got.length };
      }
      stable.corpse = (() => { const got = hit('corpse'); return { kinds: [...new Set(got)].sort(), n: got.length }; })();
      /* 没配素材的容器（垃圾桶）应该落回合成音，不播任何采样 */
      const trash = hit('crate_trash');
      /* 材质对照：几个代表容器必须落到各自的声上 */
      const pick = {};
      for (const at of ['crate_luggage', 'crate_workwear', 'crate_fast', 'crate_heavy',
                        'crate_filing', 'crate_tool', 'crate_jewelry']) {
        pick[at] = hit(at)[0];
      }
      return {
        stable, trash, pick,
        /* 容器表里不该再有"打开音"，也不该再出现拉链 */
        mapValues: Object.values(SFX.CONTAINER_SFX),
        hasOpenField: Object.values(SFX.CONTAINER_SFX).some(v => v && typeof v === 'object'),
        gains: SFX.SEARCH_SAMPLE.map(id => SFX.gainOf[id]),
        loud: SFX.LOUD.search,
        rms: SFX.SEARCH_SAMPLE.map(id => SFX._measure(SFX.samples[id])),
        zip: SFX.gainOf.bag_zip, zipLoud: SFX.LOUD.bagZip,
        zipRms: SFX.samples.bag_zip ? SFX._measure(SFX.samples.bag_zip) : 0
      };
    });
    for (const [at, v] of Object.entries(sr.stable)) {
      assert.equal(v.kinds.length, 1, at + ' 每次都是同一个声，实际 ' + v.kinds.join('/'));
    }
    /* 材质分工：包=长拉链、衣服=布料、抽屉=滑轨、保险箱=锁舌、纸=翻纸 */
    assert.equal(sr.pick.crate_luggage, 'search_zipper', '旅行箱是长拉链');
    assert.equal(sr.pick.crate_workwear, 'search_cloth', '衣服是布料翻找');
    assert.equal(sr.pick.crate_fast, 'search_drawer', '抽屉是滑轨声');
    assert.equal(sr.pick.crate_heavy, 'search_lock', '小型保险箱是锁舌声');
    assert.equal(sr.pick.crate_filing, 'search_paper3', '文件柜是翻纸声');
    assert.equal(sr.pick.crate_tool, 'search_toolbox', '工具箱是金属翻找');
    assert.equal(sr.pick.crate_jewelry, 'search_purse', '珠宝匣是皮革小包声');
    assert.equal(sr.stable.corpse.kinds[0], 'search_cloth', '翻尸体是布料的声');
    assert.equal(sr.trash.length, 0, '没配素材的容器落回合成音，不播采样');
    /* 拉链只归玩家背包：容器表里不许再出现 bag_zip，也不许再有"打开音"这一层 */
    assert.equal(sr.mapValues.includes('bag_zip'), false, '容器不再用拉链声（那是玩家背包的）');
    assert.equal(sr.hasOpenField, false, '容器表只剩一个搜索音，没有"打开音"字段');
    /* 九条素材都对齐到 LOUD.search：换到哪个容器都一样响 */
    sr.gains.forEach((g, i) => {
      assert(Math.abs(g * sr.rms[i] - sr.loud) < 0.02, '搜索素材 ' + i + ' 对齐到 LOUD.search');
      assert(g >= 0.15 && g <= 3, '搜索素材 ' + i + ' 增益没被钳住（' + g.toFixed(2) + '）');
    });
    assert(Math.abs(sr.zip * sr.zipRms - sr.zipLoud) < 0.02, '拉链对齐到 LOUD.bagZip');

    /* ---------- 2. 换弹序列：三段按 0 / 0.55 / 1.05 排，长度落在 1.5s 内 ---------- */
    const seq = await page.evaluate(() => SFX.SEQ.reload);
    assert.equal(seq.length, 3, '换弹分三段');
    assert.deepEqual(seq.map(x => x[1]), [0, 0.55, 1.05], '时间轴');
    const last = man.assets.find(a => a.id === seq[2][0]);
    const tail = seq[2][1] + last.dur;
    assert(tail <= 1.5 + 1e-6, '末段收在换弹 1.5 秒之内，实际 ' + tail.toFixed(3) + 's');

    /* stopSeq 要能掐掉没播的段：起播后立刻停，定时器应清空 */
    const stopped = await page.evaluate(() => {
      SFX.play('reload');
      const had = (SFX.seqTimers.reload || []).length;
      SFX.stopSeq('reload');
      return { had, after: (SFX.seqTimers.reload || []).length };
    });
    assert.equal(stopped.had, 2, '除首段外还有两个定时器');
    assert.equal(stopped.after, 0, 'stopSeq 清干净');

    /* ---------- 3. 采样优先：有采样的名字不会落到合成分支 ---------- */
    const routed = await page.evaluate(() => {
      const seen = [];
      const orig = SFX._playSample.bind(SFX);
      SFX._playSample = (id, o) => { seen.push(id); return orig(id, o); };
      SFX.play('shot_switch');
      SFX.play('step_stone_3', { rate: 1.02 });
      SFX._playSample = orig;
      return seen;
    });
    assert.deepEqual(routed, ['shot_switch', 'step_stone_3'], '有采样时走采样');

    /* ---------- 4. 调用点：换枪走 shot_switch、换弹走 reload、打断时掐序列 ---------- */
    const ent = require('fs').readFileSync(path.join(ROOT, 'js/entities.js'), 'utf8');
    const switchBody = /switchWeapon\(i\)\s*\{([\s\S]*?)\n  \}/.exec(ent);
    assert(switchBody, '找得到 switchWeapon');
    /* 换枪音可以按枪型覆盖（霰弹有专属泵动声），但必须回落到 shot_switch */
    assert(/sfx\([^)]*'shot_switch'\)/.test(switchBody[1]), '换枪播 shot_switch 或其变体');
    assert(!/sfx\('reload'\)/.test(switchBody[1]), '换枪不再误播换弹声');
    assert(/SFX\.stopSeq\('reload'\)/.test(switchBody[1]), '换枪掐掉换弹序列');
    const reloadBody = /tryReload\(\)\s*\{([\s\S]*?)\n  \}/.exec(ent);
    assert(reloadBody, '找得到 tryReload');
    /* 换弹调用可以带 opts.model（专属整段换弹按型号路由），但必须播 reload */
    assert(/sfx\('reload'/.test(reloadBody[1]), '换弹开始播 reload');
    assert(/step_stone_/.test(ent), '玩家脚步已接入');
    await page.close();

    /* ---------- 5. 多文件版：bundle.js 让双击也能有声音；拿掉后静默降级 ---------- */
    const plain = await browser.newPage();
    const perr = [];
    plain.on('pageerror', e => perr.push(String(e)));
    await plain.goto(pathToFileURL(path.join(ROOT, 'index.html')).href + '#base');
    await plain.waitForFunction(() => typeof SFX !== 'undefined');

    const multi = await plain.evaluate(async () => {
      SFX.init();
      const n = await SFX.load();
      return { n, ids: Object.keys(SFX.samples).sort() };
    });
    assert.equal(multi.n, man.assets.length, '多文件版靠 bundle.js 也拿到全部采样');
    assert.deepEqual(multi.ids, man.assets.map(a => a.id).sort());

    /* 开火路由：四把枪各自指向自己的录音、手枪三条轮换、素材缺失才落回合成 */
    const routing = await plain.evaluate(async () => {
      const hits = [];
      let synth = 0;
      const realSample = SFX._playSample.bind(SFX);
      const realShot = SFX._shot.bind(SFX);
      SFX._playSample = (id, o) => { hits.push({ id, rate: o && o.rate, lp: o && o.lp }); return true; };
      SFX._shot = (...a) => { synth++; return realShot(...a); };

      const table = {};
      for (const [gun, p] of Object.entries(SFX.SHOT_SAMPLE)) {
        table[gun] = p.ids.every(id => !!SFX.samples[id]);
      }

      for (let i = 0; i < 4; i++) SFX.play('shot', { gun: 'pistol' });
      const pistol = hits.map(h => h.id);

      hits.length = 0;
      for (const g of ['rifle', 'smg', 'rem870']) SFX.play('shot', { gun: g });
      const others = hits.map(h => h.id);
      const rates = hits.map(h => +h.rate.toFixed(2));

      /* 半自动霰弹不该跟着拉泵：saiga12 / mp155 的 cycleTime 都是 0 */
      hits.length = 0;
      for (const g of ['saiga12', 'mp155']) SFX.play('shot', { gun: g });
      const semiauto = hits.map(h => h.id);

      /* 型号专属枪声：AKM 走自己的录音，同枪型的其它步枪不受影响 */
      hits.length = 0;
      SFX.play('shot', { gun: 'akm' });
      const ak = hits.map(h => h.id);
      hits.length = 0;
      SFX.play('shot', { gun: 'm4a1' });
      const m4 = hits.map(h => h.id);

      hits.length = 0;
      SFX.play('enemyShot');
      const enemy = hits[0] || null;

      /* 把采样清空：必须落回合成音，不能变成哑的 */
      const kept = SFX.samples;
      SFX.samples = {};
      hits.length = 0;
      SFX.play('shot', { gun: 'rifle' });
      const fellBack = synth === 1 && hits.length === 0;
      SFX.samples = kept;

      SFX._playSample = realSample;
      SFX._shot = realShot;
      return { table, pistol, others, rates, enemy, fellBack, semiauto, ak, m4, model: SFX.SHOT_MODEL };
    });
    assert(Object.values(routing.table).every(Boolean), '四把枪的录音都齐全');
    assert.deepEqual(routing.pistol,
      ['shot_pistol_1', 'shot_pistol_2', 'shot_pistol_3', 'shot_pistol_1'],
      '手枪三条独立录音按顺序轮换，不重复同一发');
    assert.deepEqual(routing.others.slice(0, 3), ['shot_rifle', 'shot_smg', 'shot_shotgun'],
      '其余三把各走自己的录音');
    /* 泵动霰弹枪开完要补一声拉泵（排在音频时钟上，跟着这一发走） */
    assert.equal(routing.others[3], 'shot_shotgun_pump', '霰弹开火后跟一声拉泵');
    assert.equal(routing.others.length, 4, '其余枪型不额外补音');
    assert.deepEqual(routing.semiauto, ['shot_shotgun', 'shot_shotgun'],
      '半自动霰弹只响枪声，不补拉泵（' + routing.semiauto.join(',') + '）');
    assert.deepEqual(routing.ak, ['shot_ak47'], 'AKM 走自己的 7.62 录音');
    assert.deepEqual(routing.m4, ['shot_rifle'], '同枪型的 M4A1 还是 5.56 那条，没被 AK 顶掉');
    assert.equal(routing.model.akm, 'ak47', '型号 → 枪声的映射登记在 SHOT_MODEL');
    assert(routing.rates[1] > routing.rates[0], '冲锋枪是升调播放（' + routing.rates[1] + ' > ' + routing.rates[0] + '）');
    assert(routing.enemy && routing.enemy.lp > 0, '敌人枪声走同一批录音并低通处理');
    assert(routing.fellBack, '采样缺失时落回合成音，不会变哑');

    /* 模拟没有内联数据（旧浏览器 / 文件缺失）：不崩，退回合成音 */
    const fallback = await plain.evaluate(async () => {
      delete window.__AUDIO__;
      SFX.samples = {}; SFX.loading = null;
      const n = await SFX.load();
      SFX.play('reload');              // 走合成音分支
      SFX.play('step_stone_1');        // 没有采样，静默跳过
      return { loaded: n, hasSamples: Object.keys(SFX.samples).length, on: SFX.on };
    });
    assert.equal(fallback.loaded, 0, '没有数据时加载到 0 段');
    assert.equal(fallback.hasSamples, 0);
    assert.equal(fallback.on, true, '降级后合成音仍可用');
    await plain.close();

    assert.deepEqual(errs, [], '单文件版无脚本错误');
    assert.deepEqual(perr, [], '多文件版无脚本错误');
    console.log('OK: ' + man.assets.length + ' 段采样内联解码、时长对齐 manifest、换弹三段序列收在 1.5s、' +
      '四把枪走实弹录音（手枪三发轮换、冲锋枪升调）、敌人枪声低通、\n' +
      '素材缺失落回合成音、删掉 __AUDIO__ 后静默降级');
  } finally {
    await browser.close();
  }
})();
