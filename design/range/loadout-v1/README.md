# 靶场战斗测试台 V1

2026-11-09。把开发者靶场（`index.html#range`）从「只调枪械手感」扩成能验证战斗系统 V1 与最新敌人数值的测试台。开发版与离线单文件版行为一致。

[验收截图：敌人靶](enemy-dummies.png) · [面板现状](panel.png) · [离线版面板](offline-panel.png)

## 做了什么

| 区块 | 内容 |
|---|---|
| 射击手感 · 六项 | 射速 / 瞄准时间 / 纵向后坐力 × / 横向后坐力 × / 连射扩散增长 × / 基础散布 ×；下方实时显示派生出来的冲击像素、连射增长与散布角度 |
| 敌人靶 · 最新数据 | 可选钢板靶 / 拾荒者 / 回响体 / 潮汐守卫 / 据点看守 / 受雇回收员；护甲档「实战规则 / 无甲 / Lv1–Lv6」；显示剩余 HP、护甲等级与材质、耐久、有效防护值 A、最近一发结算、击杀枪数；一键复位 |
| 弹药等级 | 当前枪口径的 Lv1–Lv5，切换即换满弹匣并清空在途子弹；显示当前 B/P 与 5 级对照 |
| 配件改装 | 5 个槽位 × 各自兼容件，装/卸即时生效；显示词条与当前属性（弹匣/散布/瞄准/重量） |
| 战斗数值表 | 5 种敌人最新 HP 与当前口径 5 级固定 B/P，附四条结算公式 |

三个选择（靶型、护甲档、弹药等级、配件槽位）与六项调参值写入 `tide.range.tune.v2`，刷新后保留；读到旧 `v1` 会自动把「每发后坐力 / 基础散布」折成倍率，全局滑块一律丢弃。

## 六项调参

旧面板有 28 项滑块（射速、击发延迟、两轴冲击、随机扰动、上限、回正、准星抖动、弹速、射程、弹丸数……），大部分是全枪共用的物理常量，逐局调只会让「这一局的枪」和实战永久脱节。现在压缩成六项，每把枪只存倍率：

| 参数 | 范围 | 含义 |
|---|---|---|
| 射速 | 30–1200 RPM | 枪械自身规格 |
| 瞄准时间 | 0.05–1.2 s | 枪械自身规格 |
| 纵向后坐力 | 0.1–3 × | 乘 `CFG.RECOIL.axis.v.kick`（3.4px） |
| 横向后坐力 | 0.1–3 × | 乘 `CFG.RECOIL.axis.h.kick`（2.4px） |
| 连射扩散增长 | 0.1–3 × | 乘 `CFG.RECOIL.perShot`（0.075/发） |
| 基础散布 | 0.2–2.5 × | 同时乘 `spreadBase` 0.040 与 `spreadMax` 0.260 |

`Firearms.derive(w)` 是唯一派生入口：`V=3.4×Mv`、`H=2.4×Mh`、`G=0.075×Mg`、`Smin=0.040×Ms`、`Smax=0.260×Ms`。水平随机 ±0.9px、两轴上限 30/±16、回正延迟 0.18/0.10s、回正速度 5.0/7.5、散布恢复延迟 0.15s 与半衰期 0.18s、散布上限 1.0，全部留在 `CFG.RECOIL`，不上面板。

改全游戏手感 → 改 `js/config.js`；改单把枪 → 改 `design/weapons/arsenal-v1/arsenal.json` 的六个字段（`tools/apply-tune.js` 可把靶场导出的 JSON 写回去）。

`Range.apply()` 不再是「把调参值盖到枪上」，而是拿「原厂枪 + 当前六项」当基准，再让 `Attachments.resolve(id, parts, base)` 在它上面派生配件效果。所以调参与改装同时生效，互不覆盖 —— 旧版点完配件看似没变化，就是因为 `apply()` 紧接着把配件算出来的散布/后坐又盖回了调参快照。

## 数据怎么同步

**不复制数值。** 敌人靶的 HP 直接读 `ENEMY_TYPES[key].hp`，护甲由 `GEAR.random(type, lv)` 生成（自带材质字段），穿甲概率与等级抽取沿用 `HUMAN_UNIT_DEFS` 的 `levels / helmetChance / bodyChance`；伤害走 `Combat.resolve()` + `Combat.applyDurability()` 这条和实战完全相同的纯函数链。因此上一轮把 HP 改成 90／110／175／110／145 之后，靶场不需要单独改任何常量。

- `RDummy` 与钢板靶共用 `Bullet.targets()` 的路径（放 `Game.targets`），只实现 `dead / r / headR / hurt()`，不带 AI、不掉物、不写存档。
- `hurt()` 按 `Bullet.resolveHit` 的 **7 参**签名接参：`B / 阵营 / 部位 / P / 伤害类型 / meta / 距离衰减`，距离衰减传进 `Combat.resolve({mul})`。
- 顺手修好钢板靶的同名问题：旧代码按 6 参写，把第 6 个「致伤 meta 对象」当成了倍率，玩家实弹打靶会算出 `NaN`；现在 `meta` 被正确忽略、第 7 参距离衰减生效。`tools/test-range-headshots.js` 的 8800 发步进回归仍全绿（测试距离 < 260px，衰减为 1）。
- 配件改装走 `Attachments.resolve(W.id, parts, base)` 的纯派生（`base` = 原厂枪 + 当前六项），替换 `Game.player.weapons[slot]` 后同步弹匣与余弹，不调用 `Attachments.commit`，不会扣款、动库存或写存档。
- 面板事件改为「从 `e.target` 往上找最近的 `[data-*]` 按钮」。旧代码只看 `e.target.dataset`，点配件按钮里的说明文字（`<small>`）时目标变成了子元素，于是 `data-part` 读不到、点了没反应 —— 这是本次修掉的真实 bug。
- 弹药切换用 `ammoItem(caliber, lv)` 取真实弹药物品 id，`magazineRounds()` 按口径过滤，跨口径不可能装填；12 Gauge 自动落到 `CFG.AMMO.SHOTGUN_COMPAT`。

## 用法

打开 `index.html#range`，F2 收起/展开面板（面板可滚动，F3 清弹孔，F4 复位靶子）。

典型验证流程：选「潮汐守卫」→ 护甲 Lv4 → 弹药 Lv1（P16 < A40，钝伤）看面板「最近一发」，再切 Lv5（P55 ≥ A40，穿透吃全额 B）对比；换 Lv6 护甲量击杀枪数；配件装上瞄具看瞄准时间与散布变化。

## 验证

`node tools/test-range-loadout-browser.js`：开发版 + 离线版 **94 项断言**，覆盖面板四区块、最新 HP 表、钢板靶 meta 修复、敌人靶生成与护甲档、真实子弹链路、穿透/钝伤/磨甲、击杀枪数与复位、同口径 Lv1–Lv5 与 12 Gauge 兼容表、**六项调参与派生读数、无全局滑块、旧 v1 调参迁移、点说明文字也能装配件、配件倍率与调参相乘**、配件装/卸与「不改存档」、切回钢板靶、无页面脚本错误。

相关：`tools/test-range-headshots.js`（8800 发步进）、`tools/test-range-headshots-browser.js`、`node run-test.js`、`node smoke-test.js`。
