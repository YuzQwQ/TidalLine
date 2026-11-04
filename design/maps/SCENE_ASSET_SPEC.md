# 场景素材规范

> 适用对象：给《潮汐线》补素材的人 / AI（含 codex）。写新素材、登记、接入编辑器与游戏前先读这一份。
> 相关入口：[地图编辑器](editor/index.html) · [素材总览页](scene-library.html) · [登记表](shared/scene-assets.json) · [素材库说明](SCENE_LIBRARY.md)

三条硬规则，先记住这三条，其余都是细节：

1. **一张图只有一处真身。** 运行时图只在 `assets/` 的固定目录里；生成原稿、审核页、多版本对比放 `assets/source/`。
2. **登记表是唯一真相。** 图放进目录还不够，必须在 `design/maps/shared/scene-assets.json` 里登记；编辑器的素材列表**完全由这份表生成**，没登记 = 编辑器里选不到，哪怕地图上已经有这件家具。
3. **两道闸门都会拦。** `node build.js` 漏登记会直接报错；`node tools/check-assets.js` 体检目录与元数据。两个都过才算接完。

---

## 1. 目录结构

```
assets/
├─ tiles/           地块 PNG（地面、墙体、水面、桥面…）
├─ props/           场景物件 PNG（家具、贴花、门、容器、方向变体、放大版）
├─ chars/           角色贴图            anim/   角色动画帧
├─ items/           物品 48px 图标      gear/   装备 48px 图标
├─ effects/         特效（飘字图集等）
├─ ui/              界面样式与图片（.css / .png / .webp；立绘在 ui/safehouse/）
├─ audio/           成品采样 .wav / .ogg + manifest.json + bundle.js（生成）
├─ item-art/        物品原稿，按分类分子目录（每个分类含 sources/ 与审核页 index.html）
├─ item-details/    物品详情图索引 catalog.json
├─ npc-art/         NPC 立绘，按批分子目录
└─ source/          素材来源归档，不参与打包
   ├─ prompts/        提示词与生成记录 JSON
   ├─ <类别>-batch-NN/ 一次生成的完整批次：manifest.json + quality.json + sources/ + 预览图
   └─ archive/        被替换掉的旧版本
```

**该放哪：**

| 内容 | 位置 | 说明 |
| --- | --- | --- |
| 游戏要加载的图 | `assets/tiles` / `props` / `chars` / `anim` / `items` / `gear` / `effects` / `ui` | 只有这些目录会被 `build.js` 内联进离线版 |
| 生成原稿（高分辨率、未切边） | `assets/source/<批次>/sources/` 或 `assets/item-art/<分类>/sources/` | 大文件，别放运行时目录 |
| 提示词 / 生成参数 | `assets/source/prompts/*.json` | 一个类别一份，随批次更新 |
| 审核页、对比图、截图 | `assets/source/<批次>/` | 与 manifest 同级 |
| 被推翻的旧版 | `assets/source/archive/` | 不要留在运行时目录里 |

**不要在 `assets/` 根目录放文件。** 新素材要么进运行时目录，要么进 `assets/source/`。

---

## 2. 命名

- **素材 ID / 文件名**：小写 snake_case，全项目唯一，`<id>.png`。家具用 `<物件>_<材质/场景>`：`bed_clinic`、`counter_bank`、`table_dining`。
- **方向变体**：`<基名>_side`、`<基名>_back`（正面就是基名本身，不加 `_front`）。
- **放大版**：`<基名>_large`、`<基名>_large_side`、`<基名>_large_back`。
- **批次目录**：`<类别>-batch-NN`，如 `furniture-batch-03`、`ground-batch-02`。
  2026-11 之前的历史批次（`scene-furniture*`、`container-*`、`door-redraw`、`wall-volume`、`tree-canopy`）保留原名，不再改动。
- **中文名**：登记表里的 `name` 必须是给人看的中文（`诊疗床`），不能抄 ID。

---

## 3. 画布

| 类型 | 画布 | 说明 |
| --- | --- | --- |
| 单格家具 / 地块 / 贴花 | 32×32 | 一格 |
| 双格家具（正面） | 64×32（宽两格）或 32×64（高两格） | 同时提供 `_large_side`（宽高互换）与 `_large_back` |
| 2×2 家具（如餐桌） | 64×64 | 只给基名，不拆方向也可以 |
| 3×3 树木 | 96×96 | 碰撞只占树干格，见 §5 的 `collisionCells` |
| 物品图标 | 48×48 | 主体占中央 40×40，四周留 4px 透明边 |
| 装备图标 | 48×48 | 同上 |

统一 75° 俯视、左上光源、硬边像素、透明背景、无抗锯齿、无外投影。素材边距不要裁到 0——`build-prop-bounds` 会预计算透明边，留白是正常的。

---

## 4. 登记表 `scene-assets.json`

结构：`{ "schemaVersion": 1, "assets": [ ... ] }`，按 `group` + `id` 唯一。

`group` 只能是 `tiles`（地块类）或 `props`（物件类）。`role` 决定它在编辑器里怎么用：

| role | 用途 | 编辑器表现 |
| --- | --- | --- |
| `ground` | 基础地面，自带一个地图字符 | 「地面」分类，可直接刷 |
| `decal` | 地面贴花，可通行无碰撞 | 「装饰」分类，单击放置 |
| `prop` | **可放置家具**，必须声明 footprint | 「装饰」分类，可放置 |
| `terrain-component` | 墙体、桥面、水面等地块组件 | 不单独放置，由地图字符引用 |
| `scene-component` | 方向变体、门、尸体、集装箱、栏杆 | 不单独放置 |

### 4.1 地面（ground）

```json
{
  "group": "tiles", "id": "ground_concrete_plain_01", "name": "平整水泥 A",
  "role": "ground", "ch": "1",
  "rule": { "name": "平整水泥 A", "walkable": true, "opaque": false,
            "color": "#737d70", "art": "ground_concrete_plain_01" }
}
```

- `ch` 必须是**没被占用**的单字符（现有：`1 2 3 4 # X . r q i ~ k = - + / w s`）。
- `walkable` 必须 `true`、`opaque` 必须 `false`——基础地面是走上去的，挡人/挡视线的用 `terrain-component`。

### 4.2 贴花（decal）

```json
{
  "group": "props", "id": "decal_surface_crack_01", "name": "细裂纹",
  "role": "decal",
  "paint": { "kind": "prop", "type": "decal_surface_crack_01",
             "label": "细裂纹", "name": "细裂纹",
             "footprint": [1, 1], "ground": true }
}
```

`ground: true` 是"无碰撞"的开关。贴花只允许放在可通行地面上。

### 4.3 家具（prop）—— 最容易出错的一类

```json
{
  "group": "props", "id": "bed_clinic", "name": "诊疗床",
  "role": "prop",
  "usage": "不可搜索实体家具；按 footprint 阻挡通行、弹道与视线。",
  "large": true,
  "paint": { "kind": "prop", "type": "bed_clinic",
             "label": "诊疗床", "name": "诊疗床",
             "footprint": [1, 2] }
}
```

- `paint.type` 必须等于 `id`；`paint.footprint` 是**正面朝向**的 `[宽, 高]`（格）。侧面由编辑器自动换算成宽高互换。
- 有多格放大图时写 `"large": true`，并且 `_large` / `_large_side` / `_large_back` 三张必须齐。
- `footprint` 的推断方式：`_large` 图宽高 ÷ 32；没有 `_large` 就用基图 ÷ 32（此时通常 1×1）。
- 只有部分格子挡人（树）：加 `collisionCells`，它是 **0 起的 [列, 行] 偏移**，相对家具左上角：

```json
"paint": { "type": "tree_courtyard_canopy", "footprint": [3, 3],
           "collisionCells": [[1, 2]],
           "canopy": { "fadeRows": 2, "opacity": 0.3 } }
```

`canopy.fadeRows`：角色站进树冠下 N 行时树冠半透明，`opacity` 是那时的透明度。

**窄而高的家具：`visual`（绘制盒）**
落地钟这类"占 1 格、实际一米八高"的家具，按 1 格等比换算会缩成一小撮。给它单独声明绘制盒：

```json
"paint": { "kind": "prop", "type": "clock_grandfather", "footprint": [1, 1],
           "visual": [1, 1.5] }
```

- `visual` 是 `[宽, 高]`，单位跟 `footprint` 一样是**格**，可以是小数；只影响**贴图怎么画**，碰撞、挡子弹、挡视线、寻路一律仍按 `footprint`。
- 只能放大、不能缩小：构建时 `visual` 任一维小于 `footprint` 直接报错。
- 位置规则固定：**底边贴住占地底边、水平在占地上居中**，也就是只会向上长，不会往下沉或整体偏移。
- 32px 的贴图本身有留白（落地钟内容只占 11×25），所以 `[1, 1.5]` 画出来的可见高度约为 1.17 格；想让画面本身就有 1.5 格高，得给到 `[1, 1.92]` 左右。
- 不写 `visual` 时绘制盒 = `footprint`，即旧行为。

### 4.4 方向变体（scene-component）

```json
{ "group": "props", "id": "bed_clinic_side", "name": "诊疗床 · 侧面",
  "role": "scene-component", "variantOf": "bed_clinic", "facing": "side" }
```

- `id` 必须等于 `variantOf + "_" + facing`，`facing` 只能是 `side` / `back`。
- 基名必须存在，且基名自己不能是方向变体。
- **方向表不用另外维护**：`map-art-map.js` 从这些条目推导出「哪些家具能转、缺哪一向」，缺图时编辑器会明确提示而不是静默回退。

---

## 5. 接入流程

```bash
# 1) 切好图，放进运行时目录（文件名 = 素材 ID）
#    assets/props/table_wicker.png

# 2) 在 design/maps/shared/scene-assets.json 里登记（照 §4 挑一种 role）

# 3) 编译素材库：校验登记 + 重建 scene-library.js / data.js / 总览页
node tools/build-scene-library.js

# 4) 体检目录与元数据
node tools/check-assets.js

# 5) 编辑器回归（会自动打开浏览器，检查放置/撤销/保存重开/碰撞）
node tools/test-scene-library.js

# 6) 同步离线单文件版（会把 props/tiles 内联进 潮汐线.html）
node build.js --assets-only
```

地图上真的用起来（可选，但改地图后必做）：

```bash
node tools/build-linhai-map.js     # 编译 layout.json → js/data.js（会先跑校验器）
```

### 交付前自查

- [ ] 编辑器「装饰」分类里能看到它，缩略图正常，占地与预期一致
- [ ] 放一个到空地：朝向自动切换正常、多格件铺满不留白、树只有树干挡人
- [ ] 撤销 / 保存重开之后还在，`layout.json` 里字段没丢
- [ ] 游戏里（`index.html` 与 `潮汐线.html` 各看一次）显示与碰撞一致
- [ ] `node tools/check-assets.js` 输出 0 错误

---

## 6. 常见报错怎么办

| 报错 | 原因 | 处理 |
| --- | --- | --- |
| `新素材未登记：props/xxx.png` | 图放进了 `assets/props` 但表里没有 | 登记，或把图挪回 `assets/source/` |
| `家具放置规则不完整` | `paint` 缺 `kind`/`type`/`footprint`，或 `type ≠ id` | 照 §4.3 补齐 |
| `家具必须声明 footprint` | 没写占地 | 按 `_large` 或基图尺寸 ÷32 填 |
| `登记了 large 但缺图` | 写了 `large:true` 但少了 `_large*` 三张之一 | 补齐，或去掉 `large` |
| `方向变体的 id 必须是 基名_方向` | 命名不符 | 改名，或改用 `variantOf` |
| `方向变体找不到基名` | 基名写错 / 基名没登记 | 先登记基名 |
| `assets 根目录不允许放文件` | 把东西丢在 `assets/` 根下了 | 移进运行时目录或 `assets/source/` |
| `assets/source/<x> 命名不规范` | 新批次没按 `<类别>-batch-NN` | 改名 |

**「素材库里有、编辑器里选不到」**——先看 `role`：只有 `ground` / `decal` / `prop` 会进调色板，`scene-component` 是给别的对象当零件的。仍不对就 `node tools/build-scene-library.js` 重建一次（编辑器读的是生成后的 `scene-library.js`）。

---

## 7. 不要做

- 不要直接把图丢进 `assets/` 根目录、或在 `props/` 里建子目录放原稿。
- 不要在 `assets/props` / `assets/tiles` 里放 `.jpg` / `.webp` / `.psd`——这两个目录只收 PNG。
- 不要给同一个物件起两个 ID（`sofa` 与 `sofa_home` 这种历史别名只保留在 `map-art-map.js` 的兼容表里，新素材一律用真实基名）。
- 不要手改 `design/maps/shared/scene-library.js`、`design/maps/scene-library.html`、`js/data.js` 里的 `/* BEGIN SCENE LIBRARY */` 块——都由 `build-scene-library` 生成。
- 不要把运行时图挪进 `assets/source/`：`build.js` 只内联固定目录，挪进去就等于游戏里不显示。
