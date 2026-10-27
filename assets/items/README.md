# 物品贴图

医疗品18件图标已全部完成，统一48×48透明像素图，文件为heal01.png至heal18.png；绷带已按新描述重绘。旧med01.png保留作为历史素材，运行时已使用heal01.png。其他物品贴图状态以Wiki清单为准。

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

医疗品完整绘制要求见 [医疗源数据](../../design/items/medical.json) 与 [物品清单](../../物品清单.html)。全部医疗品已设置独立iconId，并内嵌进离线版。医疗原稿在 assets/item-art/medical/sources/，完整提示词和来源在 assets/medical-generation.json；审核页为 assets/item-art/medical/index.html。重新整理医疗品时，将上述sources目录传给prepare-item-icons.js，并以第三参数指定heal01至heal18逐件处理。


本轮新增收集品共27件：24件生活用品、2件电子产品、1件文物藏品。最终图标均为48×48透明PNG、16色内、4px透明留边，运行时按ID自动装载。原稿在 assets/item-art/collectibles/sources，完整生成提示词与来源在 assets/collectibles-generation.json，审核页在 assets/item-art/collectibles/index.html。重新整理时以该sources目录为输入，并用prepare-item-icons.js第三参数逐件指定manifest中的ID。
