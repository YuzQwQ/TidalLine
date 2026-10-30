# 连续墙体 · 体积重绘

[查看新旧对照、连接与地图实景](index.html) · [生成提示词与原稿记录](manifest.json) · [质量检查](quality.json) · [墙体规范](../../design/maps/WALL_VOLUME.md)

本次使用内置 image_gen，分别绘制连续墙顶、南向立面和东向短侧面。参考三张经典像素场景的墙地分层、连续墙面与收口方法，颜色、材质和建筑组合按本项目重新设计；现有木箱作为像素和光照参考。实际提示词与每张原稿引用保存在 manifest.json，原稿副本在 sources/。

交付素材：

- `../tiles/wall.png`，32×32不透明墙顶，替换原有墙顶图；旧图保留为 wall-before.png。
- `../tiles/wall_face_s.png`，32×32不透明南向抹灰立面，含压顶线和墙脚。
- `../tiles/wall_face_e.png`，4×48不透明东向侧面，独立生成，不旋转南向图。

后处理采用最近邻采样、16色量化和连接边配对；东向原稿裁去外部白画布，亮度降至80%，统一“墙顶最亮、南向面居中、东向面较暗”的光照层次。素材未烘焙地面、投影、家具或单格独立边框。

`Art.wallCell`判定普通墙，`Art.wallEdges`读取邻接关系，`Art.drawWallFaces`仅在暴露边画立面。墙体视觉为32×48，墙脚固定并向北扩展16px；碰撞与视觉一致，为32×48。加高部分遵循相邻格的探索状态，在角色后叠加，保持完全不透明；破口和玻璃覆盖格沿用原有图，记忆层只暗化，不逐格描框。开发版和离线版共用此逻辑。

重新整理、构建与验证：

```sh
node tools/prepare-wall-volume.js
node tools/gen-wall-volume-gallery.js
node gen-art-sheet.js
node build.js
node tools/test-wall-volume.js
node tools/test-wall-collision.js
```

浏览器检查会生成对照页所用的连接图、新旧组合图及公寓/银行局部图。它们调用游戏中的实际墙体绘制函数。`quality.json`记录开发版和离线版的16种邻接、绘制范围、48px实体范围、特殊覆盖格、未探索/记忆视野及窄屏检查。

本次未新增建筑专用外立面或屋顶。地图编辑器的独立画布渲染仍是后续同步范围；本轮已装载的是游戏运行时与素材清单。

实体范围统一由 M.wallCell、M.wallAtPoint 和 M.collisionRects 提供；移动按矩形与角色圆形检测，子弹使用实际世界坐标，寻路在北侧剩余半格使用偏移导航点。门洞与玻璃/破口保持各自通行规则。F1显示包含新增半格在内的碰撞矩形。
