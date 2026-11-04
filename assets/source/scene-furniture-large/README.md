# 双格家具原生图

9类家具 × 正面/侧面/背面 = 27张透明PNG。按方向采用64×32或32×64，保留硬边像素、16色以内、至少2px透明边和固定左上光源。

原始美术由内置 image_gen 生成。本次从保存的高分辨率原稿重新裁边、最近邻缩小、二值透明和调色板量化，未放大32×32旧成品，也未重新生成造型。完整原稿保存在 `sources/`；[记录](manifest.json) 中保留原生成提示词及来源，新交付规格由 canvas / footprint 字段定义。

[三向总览](../scene-furniture-directions/index.html) · [原生图对照](contact-sheet.png) · [验收记录](quality.json)。

`tools/prepare-large-furniture.js` 负责重新导出；`Art.prop` 为多格实例选择 `_large` 版本；`tools/build-prop-bounds.js` 更新渲染裁边信息。执行 `node build.js` 同步开发数据与离线单文件。

旧单格贴图和原始方向图保留，不影响小型物件或旧地图。
