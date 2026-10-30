# 通用地面素材 · 第一批

6张32×32交付素材：平整水泥A/B、压实泥土A/B、潮湿痕迹、细裂纹。基础地面不透明，状态贴花透明，无碰撞语义。

[查看组合预览](index.html) · [生成记录](manifest.json) · [质量检查](quality.json) · [设计要求](../../design/maps/GROUND_BATCH_01.md)

## 原稿与整理

使用内置 image_gen 分别生成6张原稿，B变体参考对应A原稿；完整实际提示词、参考关系与原始生成位置保存在 manifest.json。项目内原稿保存在 sources/，无需依赖生成缓存。

交付文件位于 ../tiles/ground_concrete_plain_01.png、ground_concrete_plain_02.png、ground_soil_compact_01.png、ground_soil_compact_02.png，以及 ../props/decal_surface_damp_01.png、decal_surface_crack_01.png。

原稿经最近邻采样至32px、限制16色。水泥和泥土分别锁定共同2px边界，并对B做均值对齐与同组调色板匹配；A边缘做周期配对，改善重复铺设的接缝。贴花按透明轮廓裁切、缩入26px范围，保留透明外缘，并采用离散透明度。生产整理是明确的后处理步骤，并非原稿自动满足像素接缝约束。

## 预览与验证

- 两组材质各提供8×8的A、B、棋盘和固定种子混排。
- 两张贴花分别在三种适用底材上以100%、70%、40%显示强度组合，共18组。
- 四种材质连接为独立程序蒙版的验证样稿，保留原图方向；未交付运行时自动连接系统。
- 开放空地、室内、窄巷使用现有人物和物件检查辨识度，并列出现有石砖、庭院铺装作对照。
- 检查尺寸、颜色数、透明留边、A/B差异、共同边界及明度差，并以Edge验证图片加载与320/390px窄屏。

在提供 sharp、playwright 的 Node 环境运行：

```sh
node tools/prepare-ground-batch-01.js
node tools/gen-ground-batch-01.js
node tools/test-ground-batch-01.js
```

已登记场景素材库并接入编辑器：4张地形与2张无碰撞贴花；支持保存、重开和运行时预加载。当前地图未自动替换。离线版已同步。
