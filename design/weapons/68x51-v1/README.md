# 6.8×51mm 武器扩展 V1 · 实装记录

本批正式接入2把枪、2件专属枪口、2种弹药和6件弹匣。M7不生成定义、不进入商店或掉落。
新姿态、键位与瞄准镜头已接入正式战局，靶场仅保留独立调参。本批没有增加人形敌人的装备池或专属持枪动画。

## 枪械与手感初值

| 字段 | SIG MCX SPEAR | GD RM277 |
|---|---:|---:|
| ID | mcx_spear | rm277 |
| 稀有度 | r5 金 | r4 紫 |
| 价格 | ¥650,000 | ¥390,000 |
| 重量 | 4.2kg | 3.8kg |
| 射速 | 800 | 700 |
| 原厂容量 | 20 | 20 |
| 瞄准时间 | 0.48s | 0.40s |
| 纵向后坐倍率 | 1.55 | 1.35 |
| 横向后坐倍率 | 1.35 | 1.15 |
| 连射散布增长 | 1.20 | 1.10 |
| 基础散布倍率 | 0.85 | 0.90 |
| 瞄准精度倍率 | 0.45 | 0.45 |
| 装填时间 | 2.8s | 2.9s |
| 模式 | 单发／全自动 | 单发／全自动 |
| 槽位 | 瞄具、握把、枪托、枪口、弹匣 | 瞄具、握把、枪口、弹匣 |

未指定的手感参数为首版游戏初值，沿用七参数与双轴系统，可在靶场现场调试。
速度与射程沿用突击步枪族620px/s、640px，不借本批改动全局弹道。
枪械的全自动配置、重量、稀有度与手感均为本作设定，不把民用型号描述为现实全自动量产型号。
RM277现实原型的.277 TVCM与本作统一6.8×51的简化在物品描述中明确标注。

## 专属枪口

| ID / 名称 | 价格 / kg | 纵后坐 | 横后坐 | 枪声范围 | 瞄准时间 | 接口 |
|---|---|---:|---:|---:|---:|---|
| att_muzzle11 · SIG SLX 战术抑制器 | ¥155,000 / 0.40 | −16% | −15% | −68% | +10% | muzzle_spear_clutchlok |
| att_muzzle12 · Delta P BREVIS II 抑制器 | ¥135,000 / 0.34 | −12% | −18% | −60% | +7% | muzzle_rm277_delta |

两者均r5。前者预留M7，当前只有SPEAR；后者只有RM277。兼容按接口标签判定，绝不因口径相同而通用。
现有普通步枪枪口、皮卡汀尼瞄具及握把继续可用；SPEAR可用现有可更换枪托，RM277枪托槽禁用。
玩家与NPC的实际AI听觉半径均应用抑制器修正，双方原有基础噪声差异保留，不修改音频音量。
噪声倍率下限从0.35调至0.32，使SLX的−68%完整生效；其他属性下限保持不变。

## 弹药与供弹

| ID | 名称 | r | B / P | 单发价格 | 20发成本 |
|---|---|---:|---|---:|---:|
| ammo_68x51_4 | SIG FMJ | 4 | 47 / 49 | ¥2,500 | ¥50,000 |
| ammo_68x51_5 | SIG Hybrid | 5 | 42 / 63 | ¥7,500 | ¥150,000 |

各自一组60发，每发0.024kg。默认装弹为FMJ；没有6.8的L1–L3物品，也没有L6。
默认弹种、靶场按钮、商店与容器池只选实际存在等级。爆头仍走共享1.5倍，未穿甲时先结算护甲。
Hybrid的文案解释混合材料弹壳，不把这一名称本身等同穿甲弹头。

两组接口族分别为sr25_pattern与rm277。当前跨族互斥；各组预留calibers=[68x51,762x51]。
未来7.62×51平台必须同时满足可拆弹匣供弹、接口族、可用类型和口径才能安装；本批不生成任何7.62×51武器或弹药。

| 每组弹匣 | r | kg | 价格 | 效果 |
|---|---:|---:|---:|---|
| 20发竞赛型 | 3 | 0.18 | ¥28,000 | 原厂容量、装填−18% |
| 20发聚合物 | 2 | 0.12 | ¥19,000 | 原厂容量、瞄准时间−10% |
| 25发扩容型 | 3 | 0.25 | ¥38,000 | 固定25发、瞄准+8%、装填+5% |

竞赛型与聚合物按裸枪容量读取，不给未来不同原厂容量平台硬写20发。未开放弹鼓。
容量缩小时按原先装弹顺序保留，完整退回溢出的对应等级余弹。

## 获取、存档与素材

按用户补充决定：本批枪械／弹药只出售RM277和FMJ。既有商人不增加等级系统。
SPEAR进现有r5枪械池，RM277也进r4枪械池；Hybrid仅现有r5弹药池与对应地表池。
6.8弹药每次掉落6–12发，只有抽到r4/r5时才参与；既有容器弹药池占比保持不变。
专属抑制器进r5配件池；六款r2/r3弹匣沿用现有商店与配件掉落规则。
新增物品沿用现有存档格式；旧物品ID与V2迁移标记保持，加载不重复补偿。
全部武器／配件保持单格；枪声、切枪与持枪动作复用现有突击步枪通用素材。

12张图标使用内置image_gen生成，48×48透明PNG，主体40×40居中。
成品为assets/gear/{id}.png和assets/items/ammo_68x51_{fmj,hybrid}.png。
原稿与元数据：assets/item-art/68x51-v1/；提示词：assets/source/prompts/68x51-v1.json、68x51-25round.json及SLX重试记录。
[图标预览](../../../assets/item-art/68x51-v1/preview.png)；[商店](runtime-shop.png)；[改枪](runtime-gunsmith.png)；[SPEAR靶场](runtime-mcx_spear-range.png)；[RM277靶场](runtime-rm277-range.png)。

## 验证

- node tools/test-68x51.js：12142项，真实开火／换弹、混装余弹、存档、销售、稀疏等级掉落、未来接口及实际玩家／NPC噪声。
- node tools/test-68x51-browser.js：普通版／离线版，两枪、L4/L5按钮、图标、商店与改枪。
- node tools/test-arsenal.js：16组；node tools/test-attachments.js：19组；node tools/test-attachments-v2.js：2419项。
- node tools/test-ammo-stack-limits.js、node tools/test-range-loadout-browser.js、node tools/test-attachments-v2-browser.js。
- node run-test.js：581通过；node tools/check-assets.js：0错误；node build.js --assets-only：离线版已同步。

枪械数据源沿用arsenal-v1/arsenal.json，价格沿用design/items/economy.json，配件沿用attachments-v1/attachments.json。
tools/add-68x51-expansion.js为幂等源数据导入器；构建仍用共享构建器，原稿不内联预加载。

原型事实参考：[SIG官方目录](https://www.sigsauer.com/media/sigsauer/resources/2023_DSG_CATALOG_v1.pdf)、[GD原型资料](https://www.fbcinc.com/source/virtualhall_images/MWC/ngsw.pdf)。表内全部游戏参数遵循用户方案与本次补充决定。
