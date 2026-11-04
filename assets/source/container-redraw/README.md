# 容器重绘

2026-10-27 使用内置 image_gen 分别重绘17种现有容器（包括独立垃圾桶），保持 `assets/props/crate_*.png` 文件名、现有字模和玩法数据。用户文案中的 P/E/S/X 与现行字模有冲突，本轮以游戏已接入的映射为准，不新增容器或地图实例。

- `manifest.json`：每种容器完整实际提示词、参考图、原稿来源及最终尺寸。
- `sources/`：内置工具生成的透明原稿，项目内独立保存。
- `previous/`：替换前的原图（垃圾桶原先复用装饰油桶），方便回看。
- `quality.json`：尺寸整理记录。
- `index.html`：旧版、新版三倍图与32像素原尺寸对照。

统一75°高角度正交俯视、左上光源、低饱和旧化像素。箱柜以大顶面和朝南短立面表现体积；包和衣服平放。最终32×32透明PNG，至少2像素留边、最多16色、无半透明边缘，支撑面靠近y=28。

准备与预览：

```powershell
node tools/prepare-container-redraw.js
node tools/build-container-redraw-gallery.js
node tools/preview-container-art.js 6
node gen-art-sheet.js
node gen-wiki.js
node build.js
```

前两步需要运行环境中可用的 sharp。整理过程只裁透明边、最近邻缩放、二值化alpha与减色，不以程序化画法替代原稿。游戏与清单共用 `assets/props/`；离线版通过 `build.js` 更新内嵌图片。
