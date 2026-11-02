# 两种人类敌人正式美术

内置imagegen逐项绘制，共35张运行时PNG、80帧。每项JSON及`manifest.json`记录完整提示词、方向、动作、原稿路径与目标；`sources/`保留原始透明图，不进入运行时资源目录。

`node tools/prepare-human-art.js`用sharp整理：裁切等分帧、硬透明、最近邻、32色，无程序绘制替代角色。动画以身体头脚距离归一到约26px，同一条动画使用同一缩放倍率；64px帧脚底固定(32,44)。静态图通过锚点保持身体位置，枪械可在32px图内偏置，不缩小人物。

静态输出至`assets/chars/`，动作至`assets/anim/`，尸体至`assets/props/`。尸体为运行时场景组件，无碰撞，不作为独立可铺地面登记。预览与测试入口见上级`index.html`，绘制规格与检查结果见`../IMPLEMENTATION.md`。
