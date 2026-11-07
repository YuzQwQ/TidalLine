# 东西向钢蓝门重绘

内置image_gen分别重绘三张图：`assets/props/sdoor.png`（强化关闭门）、`sdoor_open.png`（开启空门框）、`door_locked.png`（上锁门及铜锁）。门板和外框均改为钢蓝色，带冷色边缘高光和铆钉；上锁门有明显铜锁、方形锁梁与深色钥匙孔，对应南北向锁门的标记。

原稿在`sources/`，旧成品在`previous/`，提示词和生成路径为`assets/source/prompts/blue-steel-doors-v6.json`。整理命令：`node tools/prepare-blue-steel-doors.js`。按开启门框的分区比例整理原稿，保留原生32×32画布、x6/y4的19×26外轮廓和三边3px门框；开口仍为x9/y7起13px宽。硬alpha、16色，未烘焙地面、墙体或阴影。

沿用稳定ID并同步场景登记表。`DoorVisual.openings.sdoor_open`已根据新空门框alpha重新生成，仍为`[[9,7,13,25]]`。南北向强化/上锁门开启时复用新`sdoor.png`的中间门板，原裁切x9/y7/13×23和门轴位置保持不变。锁门解锁后的空门框继续使用`sdoor_open.png`，不残留铜锁。

验证：

- 场景库构建186张，素材体检0错误、0提示；离线版已同步。
- `test-door-overlays-browser.js`：六种门图边距/等厚门框、单/双格门的墙面复用与开洞地板，开发/离线通过。
- `test-door-variants-browser.js`：四种关闭区分、锁标记移除、门板裁切与复用，开发/离线通过。
- 基础检查486通过、0失败。
- `quality.json`记录原生像素的钢蓝色占比、铜锁颜色、16色和硬alpha，以及两组浏览器结果。`preview.png`从左到右为强化关闭、强化开启空门框、上锁关闭。
- 完整场景回归仍受已有地图SHA快照差异阻塞；未修改地图或旧SHA基线。
