# 散落物品堆与容器灰描边

使用内置image_gen绘制原稿，原稿保留于`sources/loot_pile.png`；完整提示词见`assets/source/prompts/loot-pile-v1.json`。成品为`assets/props/loot_pile.png`，32×32透明PNG，26×17像素主体、16色、硬边透明。使用`node tools/prepare-loot-pile.js <原稿路径>`重导出。

登记为`props/loot_pile`，中文名“散落物品堆”，role为scene-component、footprint为1×1；仅由局内掉落动态生成，不作为地图静态家具放置。`ART.props`显式预加载。替换的是原来的程序绘制杂物堆，原实现没有独立PNG。缺图时仍有原代码图形兜底。

25种静态可搜索容器以及动态物品堆，均通过`Art.containerOutline()`生成1逻辑像素灰绿色外轮廓（#9da59f，降低亮度以减少刺眼感）。轮廓按图片对象缓存，在32×32离屏canvas上生成：灰绿色alpha蒙版向8方向外扩后扣掉原蒙版，不覆盖内部颜色。搜过的容器原图保持变暗，轮廓亮度降至65%。无需改现有容器PNG，不读取canvas像素，可用于file多文件版本。迷雾仍按原有逻辑遮挡，物品堆不可见时不画。

验证：

- `node tools/build-scene-library.js`、`node tools/check-assets.js`：0错误。
- `node run-test.js`：479项通过。
- `node tools/test-container-outlines-browser.js`：成品尺寸、透明边和色数，25种容器+物品堆的外轮廓、灰色像素、内部不覆盖、缓存复用、搜过状态及隐藏物品堆；HTTP、多文件file、离线单文件均通过。详见quality.json及container-review截图。
- 已执行`node tools/test-scene-library.js`：被现有正式地图草稿SHA不符阻塞；独立编辑器自测另有4项地图校验/双格门夹具失败。未改地图、未更新这些测试基线。本批素材专测不替代该完整回归。
- `node build.js --assets-only`同步离线版，保留当前已编译地图。
