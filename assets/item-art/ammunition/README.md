# 弹药三口径主体图

[图标与五档底色预览](index.html) · [实际生成提示词](manifest.json) · [质量检查](quality.json)

使用内置image_gen分别生成三张透明原稿，保存在sources/。成品位于：

- `assets/items/ammo_556.png`：5.56×45mm，橄榄盒、细长尖头弹。
- `assets/items/ammo_9mm.png`：9×19mm，蓝灰盒、短圆头弹。
- `assets/items/ammo_12g.png`：12 Gauge，暗红盒、圆柱霰弹壳。

每张48×48，中央40×40以内，四周至少4px透明边，二值alpha与16色。原稿经透明轮廓裁切、最近邻采样和量化，再以8位RGBA封装。没有文字、品牌、等级标记或背景。

AMMO_ITEMS通过iconId按口径共享图片，不产生15张等级图；Icons.init按资源键复用图片对象，Icons.tag在UI中独立添加各等级的稀有度底色。物品清单采用相同图片和稀有度数据。弹药的伤害、价格、堆叠和装填逻辑未调整。

整理：`node tools/prepare-ammunition-art.js`；清单：`node gen-item-sheet.js`；只更新素材的离线包：`node build.js --assets-only`。

验证：`node tools/test-ammunition-art.js`，覆盖尺寸、透明边、颜色数量、15件物品共用3个图片对象、五种等级底色、开发/离线加载、清单和窄屏。另通过286项运行时回归和23组弹药/护甲检查。

这些为背包物品图标，不属于地图场景PNG目录，按AGENTS.md的范围无需作为可放置物块登记。
