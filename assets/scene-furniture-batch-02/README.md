# 场景家具第二批

首批制作12类、每类front / side / back三向，共36张透明PNG。内置image_gen绘制原稿，原稿与实际提示词保存在本目录的sources和manifest.json中；运行时仅加载assets/props中的整理图。

|ID|名称|正/背向原生像素|正/背向占格|
|---|---|---|---|
|table_dining|老式餐桌|64×64|2×2|
|chair_wood|普通木椅|32×32|1×1|
|wardrobe_home|旧衣柜|64×32|2×1|
|sink_kitchen|厨房水槽|32×32|1×1|
|fridge_home|老式冰箱|32×32|1×1|
|cart_medical|医疗器械推车|32×32|1×1|
|screen_clinic|医用屏风|64×32|2×1|
|workbench_clock|钟表维修台|64×32|2×1|
|clock_grandfather|落地钟|32×32|1×1|
|barrier_queue|银行排队围栏|32×32|1×1|
|workbench_industrial|重型工作台|64×32|2×1|
|pallet_stack|木质托盘堆|64×32|2×1|

每格32px，侧向同时交换像素宽高与占地宽高；正面使用基名，侧向为_side，背向为_back。不旋转或镜像位图，保持75°俯视、左上光源、宽阔顶面与短立面。最终成品二值透明、最多15个可见颜色、至少2px透明边。

12类均为不可搜索实体，按完整footprint阻挡通行、弹道和视线，沿用现有家具语义。屏风提供局部视线遮挡，排队围栏占格改变路线。冰箱与衣柜本轮不新增掉落。普通木椅为站立状态，与现有翻倒椅区分。类型名称说明主要用途，不限制放置区域。

登记表为design/maps/shared/scene-assets.json。正面登记为prop并提供paint/footprint；其余登记为scene-component，使用variantOf和facing连接基名，没有独立放置入口。构建会校验父级、方向与文件名，并将三向加入游戏预加载。新家具无需_large别名，直接采用原生多格图；透明边界也通过共用登记表预计算，支持file://。

第二批10类只记录计划，不登记为可用PNG：木质书架bookshelf、洗手台sink_bathroom、候诊座椅seat_clinic、输液架iv_stand、挂钟展示墙clock_wall、银行文件柜cabinet_bank、金属储物架rack_metal、垃圾桶trash_bin、路灯streetlamp、废弃手推车cart_hand。垃圾桶后续优先核对现有crate_trash是否足够，避免重复同形素材；挂钟展示墙需按墙面组件登记，不能冒充地面。

整理与构建：

```powershell
node tools/import-furniture-batch-02.js
node tools/prepare-furniture-batch-02.js
node tools/register-furniture-batch-02.js
node tools/build-scene-library.js
node build.js --assets-only
node tools/test-scene-library.js
node tools/test-map-art-map.js
node tools/test-prop-footprints.js
node run-test.js
```

本轮只扩充素材库，沿用当前正式地图快照。map-baseline.json记录两张正式地图源文件及运行快照摘要，回归时检查未改动布点。图库与验证截图见index.html、contact-sheet.png、editor-http.png和runtime-dev.png。
