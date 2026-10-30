# 场景素材库与编辑器登记

入口：[地图编辑器](editor/index.html) · [完整素材库](../../assets/scene-library/index.html)

统一登记表为 `shared/scene-assets.json`，生成的 `shared/scene-library.js` 同时支持浏览器与Node。当前覆盖运行时 `assets/tiles/` 和 `assets/props/` 的141张PNG，包含基础素材、方向图、容器和建筑组件。原稿、预览与归档不纳入运行时目录。

## 第一批地面接入

| 素材 | 编辑器用法 | 保存方式 |
| --- | --- | --- |
| 平整水泥A/B | 地面分类，画笔/矩形/油漆桶 | 字符1/2，图例保存art字段 |
| 压实泥土A/B | 地面分类，画笔/矩形/油漆桶 | 字符3/4，图例保存art字段 |
| 潮湿痕迹、细裂纹 | 装饰分类，单击放置 | ground:true、solid:false、opaque:false、collisionCells:[] |

选择素材不修改地图；第一次绘制时才在同一撤销事务中补上图例。新建地图和已存在地图均能选到这批素材，不需要先放一个实例。原有地图没有批量换地面。

贴花保持透明边缘与原生32px比例，先于家具绘制；可与物件叠放，不参与移动、子弹或视线碰撞。保存、重开和游戏编译保留这些字段。装饰层开关控制贴花显示。

## 后续素材交付流程

1. 将交付PNG放进 `assets/tiles/` 或 `assets/props/`，并在登记表添加稳定ID、名称、用途。方向图和墙面组件登记为组件，不直接作为可铺地面。
2. 新基础地面使用 `role:ground`，声明未占用的单字符ch，以及包含name/walkable/opaque/color/art的rule。不要复用既有字符。
3. 新贴花使用 `role:decal`，填写paint（kind:prop、type与ID一致、名称、footprint、ground:true）；编辑器会自动建立无碰撞记录。
4. 新家具使用 `role:prop`，填写paint（kind:prop、type与ID一致、名称及footprint）；会自动加入装饰列表并按实体放置。方向变体继续作为组件随基物件使用。
5. 运行 `node tools/build-scene-library.js` 或 `node build.js`。会生成全量素材页、编辑器目录与游戏预加载列表；有任何运行时PNG漏登记时构建报错。
6. 验证编辑器放置、撤销、保存重开与游戏显示/碰撞。执行 `node tools/test-scene-library.js`，必要时补充物件特定测试；`node build.js`同步离线版。

项目根目录 `AGENTS.md` 已记录以上交付要求，后续绘图任务也必须遵守。

编辑器使用的是实际底材和独立贴花。本批的材质连接图仍为预览样稿，没有因此新增运行时自动过渡系统。
