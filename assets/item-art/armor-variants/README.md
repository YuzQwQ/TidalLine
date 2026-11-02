# I–IV级护甲变体图标

8张48×48透明PNG已接入游戏、清单与离线版。运行时文件仅在`assets/gear/<型号ID>.png`。

- `sources/`保留逐张生成的原稿；各型号JSON与`manifest.json`记录名称、完整提示词、原稿及运行时目标。
- `node tools/prepare-armor-variant-art.js`使用sharp裁边、最近邻缩放到40px内、中心对齐48px画布、硬透明及64色整理。四周至少4px安全边，不烘焙稀有度底色。
- [index.html](index.html)提供48／34／24px预览及防暴盔面罩五底色检查；[preview.png](preview.png)为8张汇总图。
- 模型、数值、获取与验证见`design/equipment/armor-variants-v1/IMPLEMENTATION.md`。图标不是地图可放置场景素材，不登记场景资源库。
