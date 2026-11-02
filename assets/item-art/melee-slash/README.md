# 扇形刀气

[两张原图与三种武器范围预览](index.html) · [实际提示词与原稿](manifest.json) · [验证报告](quality.json)

内置 image_gen 分别生成左→右、右→左两张透明原稿，副本在 sources/。运行时使用 `assets/effects/melee_slash_lr.png`、`melee_slash_rl.png`，均为128×64、16色、二值透明、4px留边。`node tools/prepare-melee-slash.js` 负责透明裁切、最近邻整理与预览生成。

每次成功起手交替使用左右方向，命中判定后显示160ms并淡出；挥空也显示。按实际武器半径及扇角计算宽度与弧高，随命中时方向旋转，绘制时裁切到真实扇形，贴图不产生伤害、碰撞或飞行物。F1保留判定调试层。中断的挥砍不显示刀气。

这些是瞬态战斗特效，不是可铺设场景素材；使用独立effects预加载与离线内嵌，不登记为地图物块。构建使用 `node build.js --assets-only`，测试为 `node tools/test-melee-slash.js`，覆盖双向、三种武器、四种朝向、裁切、淡出、交替和开发/离线资源一致性。

显示调整：横向长度不变，纵向高度为原先2.5倍，让刀气更清晰；仍保留真实扇形裁切。
