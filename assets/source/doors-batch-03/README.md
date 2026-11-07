# 横墙门：格内门框覆盖层

东西走向墙上的门改为格内覆盖层，六张成品均为32×32透明PNG，实际门框高26px，小于一格。普通/受阻门宽22px，强化/上锁门宽19px，两侧及上方保留透明边；空门框的顶部、左侧、右侧均为3px厚。开门图只保留三边门框，门洞一直透明到画布底部，不保留门板或底部横框。

成品位于`assets/props/`：

- `door.png`、`door_open.png`：普通木门和空门框。
- `sdoor.png`、`sdoor_open.png`：强化铁门和空门框。
- `door_barricade.png`、`door_locked.png`：受阻木门和上锁铁门。

素材由内置image_gen逐张生成，完整提示词及原始生成路径见`assets/source/prompts/front-door-overlays-v3.json`；原稿副本在`sources/`，被替换成品在`previous/`，本批次`manifest.json`记录当前成品、尺寸和开门裁切范围。整理命令：`node tools/prepare-door-overlays.js`。

局内先在门格绘制地板，再复用现有`Art.drawWallFaces`绘制墙面，最后叠加门素材。门框外的透明边露出墙面。开门时，`js/door-visual.js`按空门框alpha生成的内缘区域裁去墙面，洞内直接显示地板；不在主画布上使用destination-out，以免把地板或其他物体一起擦掉。共用门框按整扇门缩放，再按各自门格裁切，支持单/双格。相邻墙与横向门格视为视觉连通，避免门边出现多余墙端立面。竖墙侧向门继续使用上一批俯视素材。

编辑器加载相同的`DoorVisual`合成规则，关闭门框的透明边同样露出墙体。`Art.doorRect`不再给门素材增加半格立面高度；门上方墙顶仍沿用此前的30%可见投影规则。

侧向位置试验：南北走向门与半格墙顶交换的是屏幕上下位置。整扇门上移16px，原上方墙顶移到末格下半部；贴图尺寸、碰撞格、交互坐标不变，双格侧门中间不再重复插入墙顶。编辑器同步此显示位置。调整前后实景为`side-position-before.png`和`side-position-after.png`。

下半格继续调整：墙顶按实际覆盖的末格`M.visible`判断，可见时不透明度0.3，否则1。其下层门框仅是一根4px宽、16px高的竖柱，由`DoorVisual.sidePost`用硬边矩形绘制；不画横梁、两端框或门板。可见时门框不透明度0.85，保留深色外缘与暖灰亮面，经过上层30%墙顶后仍能辨认。未观察时墙顶不透明，避免下层门框泄露视野。编辑器预览同样使用0.85/0.3叠加；没有新增图片，也未改碰撞。

验证：

- `node tools/build-scene-library.js`：185张登记素材。
- `node tools/check-assets.js`：0错误、0提示。
- `node tools/test-door-overlays-browser.js`：六张素材透明边距、硬alpha、16色、空门框、三边等厚；四种门×两种宽度，逐像素确认开门洞显示地板及门外露出墙面；开发/离线两版通过。结果为`quality.json`，实景为`runtime.png`和`offline-runtime.png`。
- `node tools/test-special-doors-browser.js`、`node tools/test-door-builder-browser.js`、`node tools/test-wall-overhang-browser.js`：开发/离线交互、编辑器序列化、搭建工具及墙顶透明通过。
- `node run-test.js`：479通过、0失败。
- `node build.js --assets-only`：离线版已同步。

完整`tools/test-scene-library.js`仍被已有正式地图SHA快照差异阻塞；未修改地图草稿或SHA基线。
