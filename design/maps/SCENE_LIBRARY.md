# 场景素材库与编辑器登记

入口：[地图编辑器](editor/index.html) · [完整素材库](scene-library.html) · **[素材规范](SCENE_ASSET_SPEC.md)**

统一登记表为 `shared/scene-assets.json`，生成的 `shared/scene-library.js` 同时支持浏览器与 Node。
当前覆盖运行时 `assets/tiles/`（18 张）与 `assets/props/`（162 张）共 180 张 PNG：
其中可放置家具 26 种、地面贴花 2 种、基础地面 4 种，其余是地块组件与方向/门/尸体/集装箱等组件。
原稿、预览与归档不纳入运行时目录，统一放 `assets/source/`。

## 三类可放置素材

| role | 编辑器分类 | 用法 | 保存方式 |
| --- | --- | --- | --- |
| `ground` | 地面 | 画笔 / 矩形 / 油漆桶 | 字符 + 图例的 `art` 字段 |
| `decal` | 装饰 | 单击放置，透明贴花 | `ground:true`、`solid:false`、`opaque:false` |
| `prop` | 装饰 | 单击放置，按 `footprint` 占格 | `type` / `name` / `footprint`（+ 可选 `collisionCells`、`canopy`） |

选择素材不修改地图；第一次绘制时才在同一撤销事务中补上图例。新建地图和已存在地图都能选到全部素材，
不需要先放一个实例。贴花保持透明边缘与原生 32px 比例，先于家具绘制，不参与移动、子弹或视线碰撞；
装饰层开关控制贴花显示。

## 关键变化：调色板由登记表生成

`design/maps/editor/palette.js` 的「装饰」分类不再从地图里的 `prop.type` 反推，而是遍历
`SceneLibrary.placeables`（登记表中 `role: "prop"` 的全部条目），只把"图上在用但没登记"的旧类型补在后面兜底。
这样：

- 新家具登记完就出现在编辑器里，不用先在地图上摆一件用来"发现"它；
- 诊疗床（`bed_clinic`）、银行柜台（`counter_bank`）、安保监控台（`console_security`）这类
  曾经被并进通用「床 / 柜台 / 桌子」的家具，现在各自独立可选；
- 每一行都有缩略图（以前旧类型只有色块），占地写在条目说明里。

## 交付流程

完整流程、字段定义与常见报错处理见 **[SCENE_ASSET_SPEC.md](SCENE_ASSET_SPEC.md)**。要点：

1. 图放进 `assets/tiles/` 或 `assets/props/`，文件名 = 素材 ID；
2. 在 `shared/scene-assets.json` 登记（role / name / footprint / 方向变体 / large）；
3. `node tools/build-scene-library.js` — 生成素材页、编辑器目录与游戏预加载列表，漏登记即报错；
4. `node tools/check-assets.js` — 目录体检（散文件、命名、缺图、footprint）；
5. `node tools/test-scene-library.js` — 编辑器放置、撤销、保存重开、运行时碰撞；
6. `node build.js --assets-only` — 同步离线单文件版。

编辑器使用的是实际底材和独立贴花。材质连接图仍为预览样稿，没有因此新增运行时自动过渡系统。
