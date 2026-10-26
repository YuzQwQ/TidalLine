# 物品贴图

已配置全部 33 件物品的像素图标（含弹药），文件名与 `js/data.js` 的物品 id 对应。

- 规格：48 × 48 像素，PNG，透明背景
- 命名：`antiq03.png`、`lux01.png`（id 见 `物品清单.html`）
- 物品本体建议占满 40×40，四周留 4px
- 像素风，不要抗锯齿

图标用于搜刮列表、背包、安全箱和藏身处仓库；缺图仍会退回稀有度色块。

用内置 image_gen 逐件生成原稿，再按透明边界裁切、最近邻缩放，整理为 32 色、硬边透明的 48×48 PNG。
完整提示词由 `../item-icon-prompts.json` 的 `stylePrompt` 加上每件物品的 `subject` 组成，其中也保留了原稿文件名。

原稿保存在本机 Codex 的 `generated_images` 目录；重新整理原稿可运行：

```powershell
# 需要 sharp（仅素材整理时使用，游戏本身无需依赖）
node tools/prepare-item-icons.js <原稿目录>
node gen-item-sheet.js
node build.js
```

画完执行 `node build.js`，图标会被转成 base64 内联进 `潮汐线.html`，
这样单文件发给别人也不会丢图。开发模式下（`index.html`）直接读本目录，改完刷新即可。
`物品清单.html` 直接预览本目录图标，更新贴图后运行 `node gen-item-sheet.js` 刷新清单。
