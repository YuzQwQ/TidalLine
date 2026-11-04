# 素材交付约定

> 完整规范（目录、命名、画布、登记表字段、报错处理）：[`design/maps/SCENE_ASSET_SPEC.md`](design/maps/SCENE_ASSET_SPEC.md)。下面是必须遵守的摘要。

## 场景素材（`assets/tiles/`、`assets/props/`）

- **登记是硬要求**：图放进目录后必须同步 `design/maps/shared/scene-assets.json`（稳定 ID、中文名、role、footprint）。
  编辑器的素材列表**完全由这份表生成**——没登记，编辑器里就选不到，即使地图上已经摆了这件家具。
- **可放置家具用 `role: "prop"`** 并声明 `paint.footprint`；方向变体登记成 `scene-component` + `variantOf` + `facing`（`<基名>_side` / `_back`）；
  有多格放大图时加 `"large": true` 并保证 `_large` / `_large_side` / `_large_back` 三张齐全。
- **两级校验**：
  ```bash
  node tools/build-scene-library.js   # 生成 scene-library.js / data.js / 素材总览页；漏登记直接报错
  node tools/check-assets.js          # 目录与元数据体检（根目录散文件、命名、footprint、缺图）
  ```
  两个都必须 0 错误，不可绕过。
- **改动后跑回归**：`node tools/test-scene-library.js`（编辑器放置/撤销/保存重开/碰撞），必要时补该物件的专用测试；
  最后 `node build.js --assets-only` 同步离线单文件版。
- **原稿不进运行时目录**：生成原稿、预览图、对比截图、旧版本放 `assets/source/<批次>/`；提示词放 `assets/source/prompts/`。

## 图标（物品、装备）

不属于场景素材库，不需要登记为场景对象：物品图标进 `assets/items/`、装备图标进 `assets/gear/`（48×48，主体 40×40 居中），
原稿进 `assets/item-art/<分类>/sources/`，生成记录进 `assets/source/prompts/`。

## 音频

成品采样进 `assets/audio/`（`<id>.wav`），用 `node tools/audio-add.js` 登记进 `manifest.json`，再 `node build.js --audio-only`。
下载来的原始文件放 `assets/audio/_source/`（不入库）。
