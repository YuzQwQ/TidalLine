# assets/gear —— 装备图标

48 × 48 像素 PNG，透明背景，主体占中央 40 × 40，四周留 4px。
游戏内只显示在 34～36px 的方格里，细节要粗。硬边像素、左上光源、无抗锯齿、无外投影。

## 文件清单（33 张，含1张空槽图标）

| 文件名 | 内容 | 游戏内名称 |
| --- | --- | --- |
| `rifle.png` | 侧视步枪 | 制式步枪（主武器位） |
| `shotgun.png` | 侧视短管霰弹枪 | 短管霰弹枪（主武器位） |
| `smg.png` | 侧视冲锋枪 | 冲锋枪（主武器位） |
| `pistol.png` | 侧视手枪 | 手枪（副武器位） |
| `helmet1.png` ～ `helmet6.png` | 六级头盔，Lv1 布帽 → Lv6 全罩攻坚盔 | 布面工帽 … 攻坚头盔 |
| `body1.png` ～ `body6.png` | 六级身体护甲，Lv1 帆布护胸 → Lv6 外骨骼装甲 | 帆布护胸 … 攻坚装甲 |
| `helmet1_motorcycle`、`helmet2_rescue`、`helmet3_riot`、`helmet4_light`（.png） | I–IV级新增4款头盔 | 摩托盔、救援盔、防暴盔、轻型防弹盔 |
| `body1_leather`、`body2_concealed`、`body3_fragmentation`、`body4_lightplate`（.png） | I–IV级新增4款护甲 | 皮革背心、隐蔽软甲、防片衣、轻型插板背心 |
| `bag01.png` ～ `bag05.png` | 五档背包，8 / 12 / 16 / 20 / 24格 | 旧帆布挎包 … 远征模块背包 |
| `melee01.png` ～ `melee03.png` | 折叠刀、战斗刀、砍刀 | 独立近战槽（4） |
| `bag.png` | 背包空槽图标 | 未装备背包 |

## 等级递进

剪影必须先能排序：Lv1 软塌窄小 → Lv6 方正厚重。低级别靠材质（布、纤维、织带）区分，
高级别靠厚度、覆盖面积与附件（护颈、护裆、面罩、螺栓）。不要只换颜色。

完整数值与「画什么」提示见根目录 `装备清单.html`（由 `node gen-gear-sheet.js` 生成）。

## 已完成与接入

33 张图标通过装备图标加载器用于藏身处、仓库、商人、局内装备栏和尸体装备区；每款护甲变体与背包分别使用自己的稳定ID与图标。背包原稿、提示词与预览见 `../item-art/backpacks/`，使用 `node tools/prepare-backpack-art.js` 整理。新增护甲原稿、提示词与缩小预览见 `../item-art/armor-variants/`，使用 `node tools/prepare-armor-variant-art.js` 整理。
武器采用侧面展示，护甲和头盔采用正面略侧的展示角度，和场景的 75° 俯视素材分开。
低等级主体略小、较软，高等级轮廓更宽厚；所有图标至少保留 4px 透明安全边。

使用内置 image_gen 逐张绘制。实际提示词、原稿文件名与主体尺寸见 `../gear-prompts.json`。
素材整理需要 sharp，浏览器检查需要 playwright；游戏本身不需要这些依赖：

```bash
node tools/prepare-gear-icons.js <原稿目录>
node gen-gear-sheet.js
node build.js
node tools/preview-gear-icons.js
node tools/test-gear-icons.js
```

近战图标与持刀动画由 `node tools/prepare-melee-art.js` 整理，原稿与提示词见 `../item-art/melee/manifest.json`。
