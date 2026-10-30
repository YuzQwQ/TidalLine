# 3×3庭院树木

内置 image_gen 重绘三张96×96透明像素图，使用固定左上光源和16色以内的调色板。原稿在 `sources/`，实际提示词在 [manifest.json](manifest.json)，`initialPrompt` 记录首次偏宽构图，`prompt` 为最终近方形树冠规格。

[交互预览](index.html) 可切换玩家所在行和树木方向，查看30%不透明度效果。

地图视觉范围3×3，底部中央一格为实体碰撞：`collisionCells:[[1,2]]` 为零基列、行，即一基第3行第2列。上两行淡化，底行侧边不触发淡化；树干碰撞同时作用于行走、寻路、子弹和视线。

重新导出：`node tools/prepare-tree-canopy.js`；重新构建：`node build.js`；验收：`node tools/test-tree-canopy.js`。旧版单格树图保留为历史素材。
