# 战斗人声 V1（2026-11-07）

用户提供的一批音效，放在 `assets/audio/_source/新一批音效/`（不入库，12 份原始 wav / mp3）。
全部按项目的规格切成 **16bit 单声道 WAV**，落在 `assets/audio/` 顶层、文件名即 SFX id，
由 `node tools/import-combat-audio-v1.js` 一键重建并登记进 `assets/audio/manifest.json`。
来源登记为 `batch-combat-20261107`（许可证 TODO）。

## 原始素材 → 成品

| 原始文件 | 成品 id | 时长 | 用途 |
| --- | --- | --- | --- |
| 男受伤-作为玩家受伤音效1.wav | `hurt_player_1` | 0.324s | 玩家受伤人声 A · 短促闷哼 |
| 男性疼痛声_作为玩家受伤音效2.mp3 | `hurt_player_2` | 0.255s | 玩家受伤人声 B · 吸气疼痛 |
| 男受伤2_作为玩家受伤音效3.wav | `hurt_player_3` | 0.446s | 玩家受伤人声 C · 长一点 |
| 男人受伤的声音_作为人形敌人的受伤音效1.wav | `hurt_enemy_1` | 0.445s | 人形敌人受伤 A |
| 男性受伤突然疼痛 作为人形敌人的受伤音效2.mp3 | `hurt_enemy_2` | 0.478s | 人形敌人受伤 B |
| 男性闷哼一声然后长叹，可以作为玩家死亡音效.mp3 | `death_player` | 2.328s | 玩家阵亡 · 闷哼 + 长叹 |
| 受伤或死亡时惨叫声…一共8段可以切分复用.mp3 | `death_enemy_1` … `_8` | 0.246–1.311s | 人形敌人死亡惨叫，8 段各自成一条 |
| 可以作为异常生物敌人的接战语音音效.mp3 | `echo_engage` | 0.974s | 异常生物接战语音（先给回响体） |
| 可以作为异常生物敌人的死亡音效.mp3 | `echo_death` | 1.301s | 异常生物死亡（先给回响体） |
| 拔剑出鞘,可以作为切刀音效.mp3 | `switch_melee` | 0.564s | 枪切近战 · 拔刃出鞘 |
| 跑步后喘息声，可以作为低体力时的音效.mp3 | `breath_low` | 1.200s | 低体力喘息 |
| 丧尸怒吼大叫，可以留给后续畸变生物敌人.wav | `mutant_roar` | 2.011s | **预留**，暂不接线 |

长惨叫合辑总长 15.91s，用解码包络量出 8 段活动区间（1.06–1.43 / 2.74–3.12 /
4.44–5.06 / 6.39–6.63 / 8.09–8.29 / 9.67–10.04 / 11.35–12.61 / 13.98–14.59），
各留 0.06s 头尾余量后切出。所有成品统一 `--peak=0.89 --trim=0.03` 加 4/12ms 淡入淡出；
喘息那条原始 RMS 只有 0.0058，改按 `--rms=0.08` 归一，避免播放增益被上限夹住。

## 响度档

`SFX.LOUD` 新增：`hurtEnemy 0.085`、`deathEnemy 0.095`、`echoEngage 0.10`、
`echoDeath 0.11`、`breath 0.045`。玩家受伤沿用 `hurt 0.11`、阵亡沿用 `death 0.13`。
`_targetFor()` 按 id 前缀分组对齐，同池子里的每一条听上去一样响。
`death_player` 这类峰高 RMS 低的素材会被 0.95/peak 再卡一道增益，有效 RMS 略低于
目标值 —— 这是防削波，不是没对齐。

## 随机池与触发间隔

`SFX.POOL` / `SFX.POOL_GAP` / `_playPool()`：随机抽一条、排除上一条、音高抖 ±3.5%；
间隔内**直接返回 true**（表示这次触发已处理），不落回合成音，否则节流会变成每发子弹
补一声电子哔。间隔是整条池子全局的，不是每个敌人各算一份。

| 池 | 条数 | 间隔 | 触发点 |
| --- | --- | --- | --- |
| `hurtPlayer` | 3 | 0.80s | `Player.hurt()`，护甲完全挡下或已阵亡不出声 |
| `hurtEnemy` | 2 | 0.45s | `Enemy.hurt()`，只给 `t.human` |
| `deathEnemy` | 8 | 0.22s | `Game.onEnemyKilled()`，人形敌人 |
| `echoEngage` | 1 | 2.00s | `Enemy.enterCombat()`，仅 `faction === 'echo'` |
| `echoDeath` | 1 | 0.40s | `Game.onEnemyKilled()`，回响体 |
| `breathLow` | 1 | 3.20s | `Game.update()`，力竭或体力 <25% 且冲刺 |

## 接战音为什么不会乱响

`Enemy.enterCombat()` 是进入 `chase` 的唯一入口，看见玩家、被同伴叫来、挨了一枪、
发现敌对阵营四条路径都改走它。只有 `state !== 'chase'` 的那一次算「接战」，
才 `Game.sfx('echoEngage')`；`Game.update` 每帧照常跑也不会重播，
2 秒的池间隔再兜住 `chase ↔ suspect` 来回抖动。
人形战术单位走 `HumanAI` 的 `ai.engaged`，不吃这条异常生物语音。
被打死时不进战斗、只播死亡声，避免一具尸体同时喊两嗓子。

## 分流与兜底

- 回响体：接战 `echo_engage`、死亡 `echo_death`。
- 人形敌人：受伤 `hurtEnemy`、死亡 `deathEnemy`；机械守卫无声带，保持安静。
- 玩家：受伤 `hurtPlayer`、阵亡 `deathPlayer`；结算面板的失败音仍是旧的扫弦 `death.wav`。
- 切近战：`switchMelee`，采样缺失时自动退回 `shot_switch`。
- `mutant_roar` 已切片 / 登记 / 内联、响度档也备好，但按素材说明留给后续畸变生物敌人，
  **不接任何触发点**；以后新增这类敌人时照回响体的 `enterCombat` / `onEnemyKilled` 挂上即可。

## 回归

- `node run-test.js`：随机池、间隔、不与上一条重复、接战一次性、人形敌人不吃异常音。
- `node tools/test-combat-audio-browser.js`：开发版 + 离线版，19 条解码 / 响度对齐 /
  不削波 / 每个触发点真能播到对应采样。产物 `verification.json` 在同目录。
- `node tools/test-audio-actions.js`：`tools/audio-actions.html` 新增「战斗人声」一组 8 条，
  响度阶梯补 5 档，缺口从「玩家挨打没声音」改成「畸变生物怒吼预留」；
  顺带把全页 47 条 `文件:行号` 引用对齐到当前源码。
- `node tools/test-audio-sample.js` / `test-sfx-wiring.js` / `test-audio-layers.js`：
  清单与顶层 WAV 一一对应、内联、既有采样路由不受影响。
