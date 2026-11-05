# 突击步枪第三批 · 实装记录

仅新增 `groza1`、`ak12`、`mk47_mod2` 三把枪。当前为 14 把突击步枪、23 把枪械。原有 20 把枪配置、6 种口径和 35 件配件的数值与兼容规则保持不变；5.45 弹匣的说明改为同口径通用描述，涵盖新增 AK-12。

| 武器 | 品质 | 口径 | RPM | 容量 | 价格 | 重量 | 换弹 | 裸枪瞄准时间 |
|---|---|---|---:|---:|---:|---:|---:|---:|
| OTs-14-1A Groza-1「雷暴」 | 珍罕 | 7.62×39mm | 700 | 30 | 250,000 | 3.2kg | 2.6s | 0.30s |
| AK-12 | 上乘 | 5.45×39mm | 700 | 30 | 115,000 | 3.5kg | 2.5s | 0.40s |
| MK47 MOD.2「Mutant」 | 稀见 | 7.62×39mm | 650 | 30 | 175,000 | 3.5kg | 2.6s | 0.42s |

价格采用用户建议。重量、换弹、瞄准和后坐力为本次玩法配置，不作为现实武器参数说明。

## 定位与兼容

以下倍率沿用共享步枪基准，护甲和配件继续在原有系统中计算：

| 武器 | 纵向后坐力 | 横向后坐力 | 散布 | 每发散布后坐力 |
|---|---:|---:|---:|---:|
| Groza-1 | ×1.40 | ×1.25 | ×1.05 | 0.085 |
| AK-12 | ×0.90 | ×0.85 | ×0.90 | 0.075 |
| MK47 MOD.2 | ×1.05 | ×0.90 | ×0.80 | 0.080 |

- Groza-1 的瞄准速度快于 AKM，纵横向后坐力均略高于 AKM，适合近距离快速抬枪。无托固定枪身关闭枪托槽，其余四槽接入现有配件规则。
- AK-12 具有比 AKS-74U 更低的双轴后坐力，开放全部五槽，作为稳定的现代制式选择。
- MK47 MOD.2 采用更小的散布与更低的后坐力，同口径伤害仍与 AKM 一致。它在《潮汐线》中是环礁湾工坊基于 Mk47 构思试制的虚构全自动改型；物品文案明确本地工坊试制与自编改型编号，不宣称现实厂商正式量产全自动 Mk47。

三把均支持半自动和全自动，默认全自动；保留单格、不堆叠装备规则。5.45／7.62 的五级弹药、伤害与穿透、同口径三类弹匣继续共用。扩容后均为 39 发；快速弹匣装填时间乘 0.85。

未添加新口径、新配件种类、专属技能、射击机制或角色动画。沿用已有通用突击步枪持枪与射击素材、枪声和换弹音效。

## 获取与运行入口

- AK-12 延续蓝色武器供货规则，加入军火商常驻商店。
- Groza-1、MK47 MOD.2 延续上一批新增紫／金武器规则，通过现有枪械战利品池获得；没有额外抽奖、独立掉落概率或商人限量库存。
- 三把均可进入仓库、装备、保存读取与军火商出售，遵循原有改装与交易规则。
- 打开项目根目录 `range.html` 即可选择三把新枪，按 B 切换半自动／全自动。`潮汐线.html` 已同步，保持单文件自包含。

配置主入口仍为 `design/weapons/arsenal-v1/arsenal.json`、`design/items/economy.json` 与 `design/weapons/attachments-v1/attachments.json`；本目录 `weapons.json` 是本批快照，`baseline.json` 是本次实施前记录。

## 素材与复现

三把枪分别使用内置 image_gen 生成，保存透明原稿与提示词。成品均为 48×48，主体最大 40×40；局内使用小图，开发版局外详情使用项目内原稿，离线单文件版继续使用内联小图。

- 成品：`assets/gear/groza1.png`、`assets/gear/ak12.png`、`assets/gear/mk47_mod2.png`
- 原稿、逐图元数据与预览：`assets/item-art/assault-batch-03/`
- 提示词集：`assets/source/prompts/assault-batch-03.json`
- 重导出：`node tools/prepare-assault-expansion-art.js --batch03`
- 整库审阅导出：`node tools/prepare-arsenal-art.js`，现已按素材记录查找各批原稿。

## 验证

- `node tools/test-assault-batch-03.js`：9 组通过，涵盖仅新增三把枪、旧枪／口径不变、三种定位差异、30／60／144FPS 射速、空弹匣、双轴后坐力、五级弹药、同口径配件、换弹中断、混装弹存档与仓库转移、改装、买卖和战利品可达性。
- `node tools/test-assault-batch-03-browser.js`：开发版／离线版真实鼠标半自动与全自动、键盘换弹、三把枪保存读取、AK-12 购买、原稿详情、三把枪扩容改装与枪托禁用状态、320／390px 页面、靶场逐枪射击及三张图标尺寸／边距／硬透明／独立哈希。
- `node run-test.js`：403 项通过；`node tools/test-assault-expansion.js`：上一批 13 组通过；`node tools/test-ammo-stack-limits.js`、`node tools/test-attachment-art.js` 通过。
- 商人和旧枪浏览器回归：`node tools/test-merchant-ui.js`、`node tools/test-arsenal-browser.js` 通过。
- `node tools/check-assets.js`：0 错误；`node gen-wiki.js` 与 `node build.js --assets-only` 已更新清单及离线单文件。

场景回归 `node tools/test-scene-library.js` 被已有地图草稿哈希差异拦截：`design/maps/linhai-old-quarter/layout.json` 与家具第二批测试基线不一致。本次不修改地图、场景贴图或场景登记，不重录该基线；离线构建使用 `--assets-only`，保留现有运行地图。

专项验证结果见本目录 `verification.json`、`browser-verification.json` 与截图。
