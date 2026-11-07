# 侧向门俯角修正

东西朝向（装在南北走向墙体上）的门改为75°俯视的“北端门框—窄门板顶边—南端门框”，不再绘制直立门框。普通/强化门的开门图保留两个端点，门板向东摆开；受阻门在东侧显示木闩，上锁铁门保留锁标记。

- 运行时：`assets/props/door_side.png`、`door_side_open.png`、`sdoor_side.png`、`sdoor_side_open.png`、`door_barricade_side.png`、`door_locked_side.png`，均为32×32透明PNG。
- 原稿：`sources/`；被替换图：`previous/`；对比：`comparison.png`（上旧下新，顺序同上）。
- 由内置image_gen逐张生成，完整提示词记录在`assets/source/prompts/side-doors-v2.json`。归一化工具：`node tools/prepare-side-door-perspective.js`。
- `Art.doorRect`和编辑器按侧向单格绘制，不增加正面门的半格立面高度；双格侧门仍按两格连续绘制。
- 素材登记保留稳定ID，canvas和generationManifest已同步，正面门素材不变。

验证：素材库构建通过；素材体检0错误；479项基础检查通过。`tools/test-special-doors-browser.js`通过开发/离线两版的六张侧门尺寸与绘制框、双轴单向门与钥匙交互、编辑器序列化和撤销重做；场景截图为`arena-closed.png`和`offline-arena-closed.png`。

完整`tools/test-scene-library.js`仍在启动时被原有正式地图SHA快照差异阻塞，未修改地图或旧SHA基线。

## 测试页搭建工具

刷新`index.html#doors-test`或打开`doors.html`，左上角提供铺墙、开门洞、擦除、游玩测试四种模式。铺墙和擦除支持左键连续拖动；编辑模式下右键擦除，Esc返回游玩。顶部标题可折叠工具栏，以便检查被面板遮住的位置。

门洞只允许放在现有墙体上，可自动判断或指定墙体走向，设置单/双格、普通/强化/单向/上锁类型、允许踹开侧和钥匙ID；双格从落点向东或向南延伸。“领取对应钥匙”按输入的ID生成测试钥匙。支持按整次拖动撤销/重做；擦除双格门时会移除整个门，防止留下孤立状态。门状态复位保留搭建布局；重置场景恢复初始五扇门。

布局仅在本次测试中生效，刷新会恢复默认；不写入正式地图或玩家存档。`tools/test-door-builder-browser.js`覆盖实际鼠标操作、拖动插值、撤销重做、双格状态/碰撞、自动轴向、钥匙按钮与E键交互、玩家位置保护和存档隔离，两版均通过；结果见`builder-verification.json`，截图见`builder.png`及`offline-builder.png`。
