# 场景素材交付约定

新增或修改地图使用的场景PNG（`assets/tiles/`、`assets/props/`）时：

- 同步登记 `design/maps/shared/scene-assets.json`，记录稳定ID、名称与用途。基础地面需要独立地形字符和图例规则；贴花需要明确为可通行、无碰撞的地面装饰。方向图和墙面组件作为组件登记，不冒充可独立铺设的地面。
- 运行 `node tools/build-scene-library.js`。它生成编辑器与游戏共用的资源目录及 `assets/scene-library/index.html`；存在漏登记PNG时构建必须报错，不可绕过检查。
- 新的可放置素材必须验证编辑器选择、绘制/放置、撤销、保存重开、显示与运行时碰撞语义。更新 `tools/test-scene-library.js` 的相应用例，运行必要回归，并通过 `node build.js` 同步离线版。
- 不将生成原稿、预览图或归档文件放入运行时素材目录；它们保存在对应批次目录。

仅新增图标（物品、装备等）不属于地图素材库，本约定不要求把它们当作场景对象登记。
