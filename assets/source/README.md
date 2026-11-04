# assets/source —— 素材来源归档

这里的东西**不参与打包**（`build.js` 只内联 `assets/{items,chars,props,tiles,anim,gear,effects}` 和 `assets/audio` 顶层 wav）。
放在这里是为了把"生成过程"和"运行时素材"分开：运行时目录里只有一张最终图，原稿、多版本对比、审核页都在这里。

```
source/
├─ prompts/            提示词与生成记录（*.json）。工具按类别读写，例如 item-icon-prompts.json
├─ <类别>-batch-NN/    一次生成的完整批次
│  ├─ manifest.json       本批每张图的提示词、原稿名、目标路径（必填）
│  ├─ quality.json        质检记录（可选）
│  ├─ sources/            生成原稿，高分辨率、未切边（体积主要在这里）
│  ├─ index.html          审核页（由 tools/gen-*.js 生成）
│  └─ *.png               拼图预览、对比截图
└─ archive/            被推翻的旧版本（按主题分子目录）
```

## 规则

1. **新批次命名 `<类别>-batch-NN`**：`furniture-batch-03`、`ground-batch-02`、`container-batch-05`。
2. **一次生成一个目录**，不要往别人的批次目录里塞散图；同批的三种渲染（正面 / 侧 / 背）算同一批。
3. **成品图不在这里**：切好边、定好尺寸的 PNG 必须落到 `assets/props`、`assets/tiles` 等运行时目录，并在
   `design/maps/shared/scene-assets.json` 登记。这里放的是它们的前身。
4. **`sources/` 可以很大**（单个批次常 20–35MB），提交前确认没有把中间稿堆了几百张；只留真正用到的原稿。
5. 目录里不要放 `.DS_Store`、压缩包、编辑器临时文件。

## 历史批次（保留原名，不再改）

`scene-furniture`、`scene-furniture-directions`、`scene-furniture-large`、`scene-furniture-batch-02`、
`tree-canopy`、`wall-volume`、`door-redraw`、`container-redraw`、`container-small-safe`、
`container-large-safe`、`container-military-supply`。
这些目录已被代码、文档和审核页大量引用，改名收益小于风险，`tools/check-assets.js` 对它们显式豁免。

## 相关

- 目录与登记规范：[design/maps/SCENE_ASSET_SPEC.md](../../design/maps/SCENE_ASSET_SPEC.md)
- 目录体检：`node tools/check-assets.js`
- 音频的原始下载包另有约定：`assets/audio/_source/`（不入库，见 `.gitignore`）
