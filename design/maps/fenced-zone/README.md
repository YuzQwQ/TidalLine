# 围栏区 · 临时安置点：地形原型

2026-11-12 按 reference-concept.png 重构。此文描述当前版本，优先于 REBUILD_PLAN.md 中第一轮已填充地图的记录。

- 64×44 格。左上登记所、左下安置营地、右侧物资堆场、右下沿水泵站。
- 南侧偏西入口固定出生；北侧、西侧、东南三个撤离点。
- 中央四格主堤，西侧营地环路、东侧堆场环路；支路连接建筑与场地。
- 登记所和泵站采用不规则外轮廓，各有三间房和两处普通外门。
- 营地五处帐篷地坪、堆场四处作业基座只用地形预留，尚未放置帐篷模型、货物或箱柜。
- 容器、地面散落物、敌人、家具全部留空。保留潮汐框架，东南积水为永久水域，沿岸堤道可通行；不新增开泵玩法。
- 全部复用现有贴图，未新增美术素材。围栏暂用既有墙体表达封闭边界。

layout.json 为编辑器设计稿，编译结果进入 js/data.js 的 FENCED_MAP；旧 runtime.json 留作历史快照，不作为当前地图数据源。

重建：node tools/build-fenced-layout.js → node design/maps/fenced-zone/validate.cjs → node tools/build-fenced-map.js → node build.js --assets-only。

验收：node tools/test-fenced-layout.js；node tools/test-map-selection.js。审核总览 overview.png，实际贴图全图 runtime-overview.png。
