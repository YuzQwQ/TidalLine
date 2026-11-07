# 房间钥匙图标

五把物理钥匙统一采用75°俯视，匙柄朝左上、齿尖朝右下，左上光源。通过匙柄轮廓、材质、色块和齿形辨认，图面不印文字编号。

| 编号 | 物品ID | 外观 |
|---|---|---|
|002|door_key_old_apt|圆形暗红胶木匙柄，旧黄铜单边齿|
|005|door_key_clinic|白紫梯形匙柄、医疗十字，银色短齿|
|007|door_key_watchshop|三叶花形黄铜匙柄、青绿小嵌片，传统方齿|
|006|door_key_bank_vault|黑红六角重型匙柄，宽钢制安全齿|
|008|door_key_warehouse|橄榄绿矩形匙柄、橙色识别条，灰钢工业齿|

原稿在sources/，运行时成品在assets/items/<物品ID>.png，48×48，主体不超过40×40，至少4px透明边。物品通过iconId引用；详情页沿用原稿索引。价格、耐久、稀有度和掉落参数保留现有配置，包括008仓库钥匙现有的金色／¥20,500,000／耐久10。

内置image_gen生成，完整提示词在assets/source/prompts/room-keys-v1.json。manifest.json登记原稿和成品，preview.png为放大对照，index.html同时展示实际尺寸与原稿入口。

验证：node tools/test-key-art.js；node tools/test-key-art-browser.js。
