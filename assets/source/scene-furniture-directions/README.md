# 家具与摆设三向图

14种原有正面加28张新增侧面/背面，统一32×32透明像素图。使用内置 image_gen 逐件绘制；正式原稿保存在 `sources/`，游戏图在 `assets/props/`。

[三向总览](index.html) · [实际提示词与生成记录](manifest.json) · [紧凑对照图](contact-sheet.png)。记录中的 `initialPrompt` / `initialSource` 是方向复核未通过的首稿，`prompt` / `originalSource` 为最终选用版本；`finalUsesReference:false` 表示修正版仅使用文字规格重绘。

范围：住宅床、诊疗床、灶台、沙发、长椅、展柜、商店柜台、银行柜台、监控台、树木，以及旧办公桌、翻倒椅、货架、油桶。容器与建筑结构不属于本批。

地图物件配置示例：`{art:'sofa_home', facing:'back'}`。正面省略 facing 或填写 front。只提供侧向一侧和背向，不通过旋转/镜像假造其他方向。

整理：`node tools/prepare-furniture-directions.js`。
总览：`node tools/gen-furniture-directions-gallery.js`。
构建：`node build.js`。
验收：`node tools/test-furniture-directions.js`（需要 sharp / playwright）。

临海路本批配置了11处朝向。后续已加入多格占地，详见 [占地规范](../../design/PROP_FOOTPRINTS.md)；本记录中的生成提示词保留当时原文。
