/* 从 data.js 生成物品清单页（贴图用）。
   以后加物品，重跑一次即可：node gen-item-sheet.js */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { writeSheet } = require('./tools/wiki-layout');

const dir = __dirname;
const money=n=>'¥'+Number(n).toLocaleString('en-US');
require('./tools/build-economy.js').build();
const ctx = { console, Math, Object, Array };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(dir, 'js/config.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(dir, 'js/data.js'), 'utf8'), ctx);
vm.runInContext('globalThis.ITEMS=ITEMS;globalThis.CATS=CATS;globalThis.RARITY=RARITY;globalThis.COLLECTION_CATS=COLLECTION_CATS;globalThis.ITEM_GROUPS=ITEM_GROUPS;globalThis.itemGroup=itemGroup;globalThis.itemCategoryLabel=itemCategoryLabel;globalThis.MEDICAL_GROUPS=MEDICAL_GROUPS;', ctx);

const { ITEMS, CATS, RARITY, COLLECTION_CATS, ITEM_GROUPS, itemGroup, itemCategoryLabel } = ctx;
const classification=require('./design/items/classification.json');
const classificationById=new Map(classification.items.map(item=>[item.id,item]));
const iconId = id => ITEMS.find(i=>i.id===id)?.iconId || id;
const hasIcon = id => fs.existsSync(path.join(dir, 'assets', 'items', iconId(id) + '.png'));
const iconCount = ITEMS.filter(it => hasIcon(it.id)).length;

/* 每个物品的「视觉提示」——画图时看这一句就够了 */
const VISUAL = {
  life01: '白底蓝边的搪瓷缸，口沿磕掉一块瓷，露出深色铁胎',
  life02: '发黄的旧报纸折了一角，头版有大字标题，纸面有水渍',
  life03: '绿色玻璃灯罩的台灯，灯罩内侧熏黑，底座是深色胶木',
  life04: '圆角铁皮饼干盒，红绿花纹褪色，盖子上有个凹痕',
  life05: '带透明塑料包装的叠好的毛巾，包装印褪色的商标',

  /* 生活用品：29 件。基础层＝工业时代通用器物；文化层＝不同传统交汇；
     独有层＝环礁湾自己的机构、商业与工艺史。 */
  life06: '扁方形铝饭盒，盖子上有一排钉出来的工号数字，边角磕凹',
  life08: '圆柱形玻璃糖罐，金属螺旋盖，罐底结着一块深褐色糖块',
  life10: '布袋口散出十几颗玻璃弹珠，其中一颗内部有三道彩纹',
  life11: '双铃机械闹钟，圆形表盘加两只铃铛，指针停在 5:47，背面贴一张小纸条',
  life13: '发条铁皮小火车，绿漆掉了一半，烟囱歪向一侧',
  life15: '千禧年前的重金属电熨斗，胶木手柄，调温旋钮，底面磨得发亮',
  life19: '黑色铸铁缝纫机机头，侧面金色贴花磨淡，手轮裸露，无底座',
  life20: '白瓷礼盒部分展开，盘沿一圈海鸟与海浪印花，内衬纸泛黄',
  life22: '深色丝绸礼服，立领加一排盘扣，西式肩线，袖口一块同色补丁',
  life28: '木盒里的纯银刀叉勺，手柄背面打有成色印记，绒布内衬，金属发暗',
  life32: '深棕色真皮手提箱，黄铜锁扣，钥匙插在锁上',
  life33: '实金细框圆眼镜，折叠镜腿，内侧有细小成色戳记，镜片清晰',
  /* 城市公共生活 */
  life36: '折叠数层的米黄色城市地图，蓝色道路与红色地名标记，边缘磨损',
  life37: '深色金属检票钳，手钳结构，手柄包黑色胶木',
  life38: '米白色按键电话机，灰色卷线，十二个黑色数字键，顶部红色指示灯',
  life39: '银色圆柱保温杯，深蓝色塑料盖，底部一圈防滑橡胶',
  life41: '透明灰塑料磁带收纳盒半开，露出六盘黑色卡式磁带与彩色手写标签',
  life43: '小型红白条纹旋转木马，金色微型立柱，底座带黄铜发条钥匙',
  life44: '褪色海军蓝帆布圆筒行李包，白色粗绳束口，侧面三层印刷编号',
  life45: '桌面机械呼叫铃，圆形金属底座，顶部圆钮，黄铜与银色两种版本',
  life46: '深棕色拉链洗漱包半敞，露出金属剃须刀、折叠牙刷和小镜子',
  life47: '深绿色皮面日程簿，金色书角，黑色束带，夹一支细长圆珠笔',
  life48: '深蓝色紧凑机械打字机，银色按键，前部金属铭牌，侧面折叠把手',
  life49: '小型黄铜机械打火机，外露齿轮与点火轮，底部敲着 000 编号，表面自然氧化',

  elec01: '米黄色塑料外壳的便携收音机，拉出半截天线，刻度盘发黄',
  elec02: '深蓝或银色的方形随身听，透明观察窗里能看见一盒磁带',
  elec03: '黑灰塑料计算器，太阳能条发暗，屏幕显示一个「0」',
  elec04: '绿色电路板，上面有几颗电容和插槽，边缘有小缺口',
  elec05: '淡黄色塑料掌机，墨绿色液晶屏，红色方向键与两个圆形按钮',
  elec06: '黑银双色方形即时成像相机，突出镜头与前部白色相纸出口',
  elec07: '半透明湖蓝色蛋形电子宠物机，墨绿色点阵屏，三颗黄色按钮，顶部银色钥匙链',
  elec08: '银灰色扁平录像机，透明磁带舱、黑色功能键与侧面接口，旁边一小盘录像带',
  elec09: '深黑色小型寻呼机，绿色长条液晶屏，金色功能按钮，侧面凸起的安全模块',
  elec10: '米灰色厚重笔记本电脑，展开的墨绿色显示屏，密集实体键盘，侧面软盘驱动器',
  elec11: '军绿色金属短波电台，伸缩天线、数个大型调节旋钮和一只黑色手持话筒',
  elec12: '深蓝灰色导航终端，绿色单色显示屏、右侧大旋钮、底部金属安装支架',
  elec13: '银灰色仪器箱，正面八个整齐的信号接口，窄绿色显示屏，顶部折叠提手',
  elec14: '黑银双色实验终端，厚重金属机壳，正面小型绿色 CRT 屏，左右不对称模块插槽，红色机械电源开关',
  elec15: '短圆柱钛合金深海探测核心，三道深灰耐压固定环，中段狭长观察窗露出墨绿电路板与铜色线圈，正面深蓝珐琅铭牌刻着 VII，底部三角合金支架',

  ind01: '一段截断的黄铜管，切面发亮，管身氧化发暗绿',
  ind02: '金属轴承，外圈锈斑，内圈还能看见打磨的亮面',
  ind03: '圆形压力表，白色表盘，红色指针顶在最大刻度',
  ind04: '四五颗灰黑色六角螺栓散放，带红褐锈迹，其中一颗套着拧不下来的螺母',
  ind05: '灰色方形混凝土试块，表面粗糙带气孔，侧面白色油漆编号，右上角磕损',
  ind06: '三段长短不一的深灰色螺纹钢筋斜向叠放，表面红褐浮锈，其中一根弯了',
  ind07: '两卷黑色绝缘胶带，一卷扯出短截且边缘沾金属粉末，另一卷仍裹透明塑封，塑封上有印刷标签',
  ind08: '黄铜截止阀，红色圆形手轮，两端螺纹接口，阀体有一道扳手划痕',
  ind09: '黑色弧面手持电焊面罩，深绿色矩形滤光窗，手柄缠着旧胶布，掌心位置磨得发亮',
  ind10: '银灰不锈钢游标卡尺，量爪微张，刻度清晰，搁在打开的木盒上',
  ind11: '乳白色厚壁陶瓷轴套，中心圆孔，边缘精密，嵌在深蓝泡棉包装里',
  ind12: '深灰矩形液压阀组，顶部多个黄铜接头，侧面钢管接口，局部残留机油',
  ind13: '银灰色梯形钛合金锭，表面细密铸造纹理与深色钢印，边缘有金属光泽',
  ind14: '精密陀螺组件，银色双层万向环包着中央金色转子，深灰底座带刻度',
  ind15: '打开的深色收藏箱，银灰长方体量块按尺寸排在深蓝绒布凹槽内，中央一块有极浅划痕，盒盖内侧黄色校准证书',
  ammo:   '散装步枪弹，黄铜弹壳配铜色弹头，三发并排',

  med01: '卷起的白色绷带，外层有一小块暗红污渍',
  med02: '透明塑料注射器，黑色刻度，白色推杆，带针头保护套，斜向摆放',
  med03: '深灰色半透明 X 光胶片，中央白灰色胸腔骨骼影像，后面露出一角棕色档案袋',
  med06: '深棕木质标本盒半开，内部排列透明玻璃载片，部分带紫色染色区与白色编号标签，盒盖内侧有小型分类表',
  med07: '米白医疗监护仪，正面黑色显示屏上显示绿色心电波形与数字读数，右侧一列灰蓝色按键，侧边垂下导联线',
  med08: '黑色硬质收纳盒内排列四枚银黑双色金属物镜，镜筒长度不同，带彩色倍率环与细密刻字',
  med09: '深蓝无菌器械盒，内放银黑环形机械瓣膜，中央两片深色瓣叶，外围缝合环，白色保护泡棉',
  med10: '浅灰长条形注射泵，侧面固定一支透明注射器，前面板绿色数字窗与蓝色功能键，机械推进滑轨清晰',
  med11: '银灰紧凑圆形机械泵，中央透明观察窗，外围精密金属环、两根短接管与蓝色固定支架',
  med12: '透明厚壁六棱柱树脂标本，内部淡粉色分枝状人工组织，深灰金属展示座，正面金色 00 铭牌',
  med13: '米白便携式除颤仪，顶部提手，正面小屏与能量调节旋钮，两只黑色电极板用卷线连接，带橙色按钮',
  med15: '米白紧凑型心电图机，顶部小屏，前端伸出一截印有黑色心电波形的白色热敏纸，侧面接彩色电极导线',
  med14: '米白厚重金属控制主机，面板多个黑色旋钮、拨杆与绿色数字窗，底部排列气路与电路接口',

  antiq01: '深棕实木座钟，顶部对称雕花，圆形白色罗马数字表盘，表盘下方透过玻璃门可见停止摆动的黄铜钟摆',
  antiq02: '圆形黄铜怀表，表盖半开，内盖隐约可见两个字母、其中一个已磨平，表冠与短链条露出一部分',
  antiq03: '一枚发黑的小硬币，边缘磨损，图案已经看不清',
  antiq04: '银灰色圆形硬币，正面浮雕明显偏向一侧，另一侧留大片空白，币缘部分区域没有完整齿纹，金属表面较亮',
  antiq05: '长方形绿锈铜门牌，四角留有固定孔，刻着「临海路 7 号」，数字较大，边缘有磨损',
  antiq07: '半展开的米黄色航海图卷，蓝色海岸轮廓、红色航路、黑色水深标记与角落小型罗盘，纸边轻微卷起',
  antiq08: '正面朝上的乳白色椭圆陶瓷面具，空洞眼孔、蓝色对称花纹，眼角两滴金色釉彩，边缘系浅棕棉绳',
  antiq09: '横向长方形暗红色铜版，密布细密的城市建筑与港口凹刻线条，中央旧城区、远处海湾与船只，四角浅绿氧化，斜靠深色木框',
  antiq06: '长方形深灰金属釉色母版，表面排列十余块釉面试样（蓝绿、米白、深红、灰褐），细窄金属隔线分开，最后一格半烧制、边缘有浅色未覆盖区',

  art04:  '深紫色长方形游戏卡带，正面黑色蒸汽火车与黄色站台灯，后方露出彩色包装盒一角，盒上银色限定标记',
  art05:  '微微卷曲的竖版深蓝色电影海报，中央白色灯塔，底部一行暗红色大字，边缘有折痕',
  art01:  '黑色黑胶唱片从老式纸质封套中露出一半，中心贴纸褪色发红，封套一角有手写编号',
  art02:  '小型横向油画，灰蓝色海面与阴沉天空、无船无海鸥，深色木框掉漆，右下角签名模糊',
  art03:  '一条 35mm 摄影底片，四格画面，对着光能看到模糊的人影',

  lux04:  '椭圆形深蓝色珐琅音乐盒，银色雕花边框，盒盖半开露出小型金色音乐滚筒，盖面中央白色庄园',
  lux05:  '展翼海鸟造型的银白色胸针，中央大型深蓝色多面切割宝石，两翼镶嵌细小白色钻石，斜侧俯视',
  lux01:  '银金双色高级机械腕表，深色表盘，细长金属指针，一个小型复杂功能副盘，抛光表壳，深棕皮革表带',
  lux02:  '厚实金黄色梯形金条，表面铸造纹理，中央压有重量、纯度与序列编号钢印，三分之二俯视',
  lux03:  '黑色抛光树脂钢笔，笔帽旋开置于一侧，露出金色笔尖，银金双色笔夹与细窄装饰环',

  spec01: '一枚巴掌大的黄白色螺旋贝壳，螺纹清晰，边缘有一点破损，斜侧俯视',
  spec02: '不规则深灰岩石，表面覆盖簇状蓝绿色晶体（孔雀石与蓝铜矿共生外观），一侧贴小型纸质标签',
  spec03: '压平的绿色叶片夹在两张发黄薄纸之间，叶脉清晰，纸角微微翘起',
  spec04: '深灰不规则石块，中央一枚黄褐色螺旋菊石，清晰的弧形分节线与微微突起的化石轮廓',

  mil01: '暗橄榄绿色长方形铁制弹链盒，顶部折叠金属提手，侧面褪色白色批次字样，盒盖微开露出深色空腔与锈迹',
  mil02: '扁圆形铝制军用水壶，橄榄绿磨损漆面，短小黑色旋盖，壶颈系一截棕色细绳，斜侧俯视，突出扁平壶身与肩部轮廓，不画布套与餐杯',
  mil03: '两枚银灰色椭圆形金属身份牌串在细珠链上，牌面浅黑色编号与规则压印，两片磨损程度不同',
  mil04: '深绿色筒形金属信号灯，前端红色圆形滤光罩，侧面小型拨动开关，棕色帆布提带',
  mil05: '方形铁灰色警戒牌，中央黑黄警戒图案，底部白色军事识别条带，边缘有螺孔与刮痕，略微倾斜',
  mil06: '打开的深绿色金属军用罗盘，中央圆形方位盘，白色刻度与橙色指针，翻开盖板内可见小镜片与瞄准结构',
  mil07: '深橄榄绿方形野战电话箱，盒盖打开，内部黑色听筒、金属接线柱与一段短电缆，侧面带折叠摇柄',
  mil08: '一组紧凑的深灰色机械枪机零件，切削面有银色反光，置于打开的棕色防锈纸包装内，旁边有小检验标签',
  mil09: '黑灰色短筒状夜视仪，前端大口径镜头呈深绿色反光，侧面调焦环、金属安装座与橡胶眼罩',
  mil10: '深灰色扁平矩形电子模块，一端密集金属触点，正面两个小型状态灯，侧面贴红白资产标签，九十年代工业电子质感',
  mil11: '橄榄绿色小型矩形检测仪，正面白色模拟表盘与黑色指针，侧面连接短圆柱形探头，黑色旋钮与背带',
  mil12: '厚重黑色长方体热成像仪，前端大型圆形红外镜头带紫黑色镀膜，顶部提手，后端小型绿色观察屏与电缆接口',
  mil13: '深灰绿色双目式光学测距仪，前端两个大小不同的圆形镜头，中央厚重金属主体，侧面精细旋钮与刻度环',
  mil14: '军绿色矩形金属通信主机，正面排列多组旋钮、黑色接口与绿色状态灯，部分插槽空置，底部厚重散热与安装支架',
  mil15: '紧凑长方形金属框军事标图板，深灰绿边框，内部浅黄色旧城区地图上覆盖透明标绘层，可见红蓝黑三色路线、圆形集合点与被擦除的旧线，右下角白色时间记录格，斜侧俯视',
  intel01: '一张发黄的长条货运单，表格线清晰，右上角有红色港口印章，底部横着一道蓝色修改笔迹',
  intel02: '一本厚重的浅黄色旧电话簿，深绿色封面，书页边缘呈阶梯式索引结构，封面有磨损的电话听筒图案',
  intel03: '米黄色横向登记卡，顶部红色编号，中央排列填写栏与黑色印刷字，右下角有蓝色圆形公章，边缘轻微折起',
  intel04: '半展开的深蓝色工程图纸，白色地下管线网格，局部红色路线标记，纸角有白色标题栏',
  intel05: '透明浅灰色紧凑型录音磁带，中央两枚白色卷轴，外壳贴一张米黄色手写标签',
  intel06: '翻开的蓝灰色硬皮记录簿，左页密集数字表格，右页手绘潮位曲线，中央夹着一截白色自动记录纸带',
  intel07: '窄长的浅黄色电报纸，密集排列打字机印出的字母与数字，顶部带两处蓝色时间戳',
  intel08: '一册深绿色窄长名册，封面黑色标题与红色权限标记，翻开内页显示姓名列表、通行区域代码与印章',
  intel09: '三张深灰色 3.5 英寸软盘错开叠放，顶部贴不同颜色的纸质编号标签，最上面一张露出银色金属滑盖',
  intel10: '一盘黑色专业录音带装在扁平圆形保护盘中，中央白色编号标签，旁边搭着一小截展开的磁带',
  intel11: '一份厚实的灰白色勘测报告，深蓝色封面印有测绘网格标志，侧面露出折叠地形图与红色索引标签',
  intel12: '一摞厚重的灰黄色档案纸以红色棉绳交叉捆扎，顶部放着一张黑白现场照片，纸张侧边露出不同颜色的索引签',
  intel13: '一本摊开的暗蓝色线装观测簿，泛黄纸页上有密集黑色数字、蓝色曲线与少量红色修订标记，左侧规整水文表格，右侧渐变为简略道路与建筑轮廓，书页边缘带水渍',
  occ01:  '一条略微弯曲的三色编织细绳，红白黑线交错，带五个大小不同的结，末端磨损起毛',
  occ02:  '三四截粗短的灰白色粉笔，断口粗糙，其中一截沾着暗红色颜料粉末，斜向散放',
  occ03:  '七枚大小相近的暗金色小铜环串在黑色细绳上，排列成下垂弧形，绳结清晰',
  occ04:  '一枚暗黄铜圆盘，外圈十二个抽象几何符号，中央短黑色旋转指针，局部有绿锈',
  occ05:  '暗褐色三足小香炉，敞口矮圆形，炉口有四处黑色磨痕，内有浅灰香灰',
  occ06:  '两段折叠展开的黄铜测量尺，黑色木柄，细密几何刻度，中央有精致转轴',
  occ07:  '一根修长的银色仪式针，针柄缠绕螺旋银丝，顶部一颗暗红玻璃珠，斜向放置',
  occ08:  '深棕色短木柄的黑石印章，印面朝向观众，可见嵌套三角与圆环图案，边缘沾少量暗红封蜡',
  occ09:  '圆形黑曜石镜面近乎纯黑，仅留一道冷白色弧形反光，背后为细致的银色支架',
  occ10:  '扁平的不规则深灰石板，表面刻着三组交错弧线与小圆孔，边缘呈海水侵蚀后的粗糙质感',
  occ11:  '一卷部分展开的浅黄皮纸，边缘卷曲，纸面排列黑褐色细密奇异文字，左右两端有深色木轴',
  occ12:  '多层交错的金色同心圆环，中央一颗深蓝色小球，金属环刻着细密符号，立体而对称',
  occ13:  '三枚相互交锁的金、银、暗铜色细戒，中央形成三重环形结构，局部有细小雕刻符文',
  occ14:  '古银色细长小铃，顶部圆环提手，铃口朝向观众可见空无一物的内部，外壁三道细密环纹',
  occ15:  '一页不规则浅灰黄色古老文献，装在细窄的暗金色保护框中，纸面数行黑褐色古文字，顶部三重圆环符号，左侧一排细小装订孔，底部文字在边缘突然中断',
  odd01:  '半透明的青色不规则结晶，内部有像声波一样的纹路',
  odd02:  '精致的复古黄铜天文仪，三重交错金属圆环，外环有刻度、齿轮和机械装饰，略带锈蚀与海盐结晶。中央悬浮深海蓝透明水球，内部可见微缩海洋、弯曲银白浪线和极小的白色灯塔剪影，下方为三足机械底座。古铜金、深海蓝、银白色为主，少量冷青反光；完整呈现、透明背景，不加文字、场景或大面积发光。',
  odd03:  '银色怀表，表盖敞开，指针停在同一个位置，表面有水痕'
};

const byCat = {};
for (const it of ITEMS) {
  (byCat[it.cat] = byCat[it.cat] || []).push(it);
}
const catOrder = Object.values(ITEM_GROUPS).flatMap(group=>group.cats);

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function card(it) {
  const r = RARITY[it.r - 1];
  const cat = CATS[it.cat];
  const isStack = it.stack > 1;
  const vis = it.visual || VISUAL[it.id] || ({ammo_556:'橄榄色弹药盒＋细长尖头5.56×45mm步枪弹',ammo_9mm:'蓝灰色弹药盒＋短粗圆头9×19mm手枪弹',ammo_12g:'暗红色弹药盒＋红色圆柱12号霰弹壳'})[iconId(it.id)] || '';
  return `
    <div class="item" data-item="${it.id}" style="--rc:${r.color}">
      <div class="thumb"${it.cat==='ammo'?` style="background:${r.color}26"`:''}>
        ${hasIcon(it.id) ? `<img src="assets/items/${esc(iconId(it.id))}.png" width="48" height="48" alt="${esc(it.name)}">` : '<span>待绘制</span><b>48×48</b>'}
      </div>
      <div class="meta">
        <div class="name">${esc(it.name)}${isStack ? '<i class="tag">可堆叠 ' + it.stack + '</i>' : ''}${it.noCodex ? '<i class="tag dim">不进图鉴</i>' : ''}</div>
        <div class="sub"><code>${esc(it.id)}</code> · <span style="color:${cat.color}">${itemCategoryLabel(it)}</span> · <span style="color:${r.color}">${r.name}</span> · ${it.w}kg · ${it.price > 0 ? money(it.price) : '不定价'}${it.short ? ' · 背包简称 <b style="color:#a8c4ba">' + esc(it.short) + '</b>' : ''}</div>
        <div class="desc">${esc(it.desc)}</div>
        ${it.medicalGroup ? `<div class="vis"><b>${esc(ctx.MEDICAL_GROUPS[it.medicalGroup])} · ${esc(it.source)}</b>${it.healCap ? `启动 ${it.healStart} 秒 · ${it.healRate} HP/秒 · 容量 ${it.healCap} · 局内持续治疗 / 局外立即` : `效果待开放 · 预留：${esc(it.reservedEffect)} · 本轮不掉落`}<br>品牌与历史叙事来自医疗产业提案，尚未并入正式世界观。</div>` : ''}
        ${classificationById.has(it.id)?`<div class="vis"><b>分类依据</b>${esc(classificationById.get(it.id).reason)}</div>`:''}
        ${vis ? `<div class="vis"><b>画什么</b>${esc(vis)}</div>` : ''}
      </div>
    </div>`;
}

let body = '';
for (const [groupId,group] of Object.entries(ITEM_GROUPS)) {
  const groupItems=ITEMS.filter(item=>itemGroup(item)===groupId);
  body+=`<section class="item-group" data-item-group="${groupId}"><h2 class="item-group-title">${group.name}<span>${groupItems.length} 件</span></h2><p class="category-description">${groupId==='collectible'?'按九类组织，用于探索、交易与图鉴收集。':'用于装填与治疗，不计入收集图鉴。'}</p>`;
  for (const k of group.cats) {
  const list = byCat[k] || [];
  const cat = CATS[k];
  body += `
  <section class="cat" data-item-category="${k}">
    <h3><span class="dot" style="background:${cat.color}"></span>${cat.name}<em>${k}</em><i>${list.length} 件</i></h3>
    <p class="category-description"><b>${cat.theme}</b> · ${cat.desc}</p>
    ${!list.length?'<p class="category-empty">目前没有符合此类别的既有物品，保留分类供后续扩充。</p>':''}
    ${k==='medical' ? Object.entries(ctx.MEDICAL_GROUPS).map(([key,label])=>`<section class="medical-group" data-medical-group="${key}"><h4>${label} · ${list.filter(i=>i.medicalGroup===key).length} 件</h4><div class="grid">${list.filter(i=>i.medicalGroup===key).map(card).join('')}</div></section>`).join('') : `<div class="grid">${list.map(card).join('')}</div>`}
  </section>`;
  }
  body+='</section>';
}

const rarityBar = RARITY.map(r =>
  `<div class="sw" data-rarity="${r.k}"><span style="background:${r.color}"></span>${r.name}<em>${r.k} · ${ITEMS.filter(i=>itemGroup(i)==='collectible'&&i.r===r.k).length} 件收集品</em></div>`).join('');

const catBar = catOrder.map(k =>
  `<div class="sw"><span style="background:${CATS[k].color}"></span>${CATS[k].name}<em>${k}</em></div>`).join('');

const total = ITEMS.filter(i => !i.noCodex).length;
const economy=vm.runInContext('ECONOMY',ctx);
const valueBands=economy.collectionBands.map(b=>`<div class="value-band" data-value-band="${b.rarity}" style="--rc:${RARITY[b.rarity-1].color}"><span class="value-stripe"></span><b>${RARITY[b.rarity-1].name}</b><span>${b.role}</span><strong>${money(b.min)}–${b.max===null?money(b.referenceUpper)+'+':money(b.max)}</strong></div>`).join('');

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>潮汐线 · 物品清单（贴图用）</title>
</head>
<body>

<header>
  <div class="kicker">TIDELINE · ITEM SHEET</div>
  <h1>物品清单</h1>
  <div class="lede">
    共 ${ITEMS.length} 件：${ITEMS.filter(i=>itemGroup(i)==='collectible').length} 件收集品、${ITEMS.filter(i=>itemGroup(i)==='supply').length} 件物资；${total} 件进图鉴。这份清单直接从 <code>js/data.js</code> 生成，
    和游戏里的数据完全一致；改完物品表重跑 <code>node gen-item-sheet.js</code> 就会更新。<br>
    <a href="assets/item-art/ammunition/index.html">弹药三口径图标</a> · 已配置图标 <b>${iconCount} / ${ITEMS.length}</b>，下方预览与游戏共用 <code>assets/items/</code> 中的贴图。<a href="assets/item-art/collectibles/index.html">新增收集品图标总览</a> · <a href="assets/item-art/electronics/index.html">新增电子产品9件</a> · <a href="assets/item-art/medical-collectibles/index.html">新增医疗收集品10件</a> · <a href="assets/item-art/industrial/index.html">新增工业器材12件</a> · <a href="assets/item-art/heritage/index.html">新增文物藏品8件</a> · <a href="assets/item-art/military/index.html">新增军事物资15件</a> · <a href="assets/item-art/intel/index.html">新增情报资料13件</a> · <a href="assets/item-art/occult/index.html">新增神秘学物品15件</a>。
    <br>收集品保留九类，物资单独分为弹药类与医疗物品。<a href="design/items/CLASSIFICATION.md">逐件分类与世界观依据</a>。
    <br>医疗品18件图标已全部绘制，5件开放恢复HP，其余效果待开放。<a href="assets/item-art/medical/index.html">查看医疗图标总览</a>。<a href="design/items/MEDICAL.md">医疗系统说明</a> · <a href="design/world setting/医疗产业提案.md">医疗产业提案（非正式历史）</a>。
    <br>稀有度采用白、绿、蓝、紫、金、红六级。<a href="design/items/RARITY.md">查看 ${ITEMS.filter(i=>itemGroup(i)==='collectible').length} 件收集品的稀有度评级</a>；
    生活用品按"工业通用 / 多传统交汇 / 环礁湾独有"三层收敛为 ${ITEMS.filter(i=>i.cat==='life').length} 件，说明见 <a href="design/items/LIFE_COLLECTIBLES.md">生活器物</a>。
  </div>
</header>

<div class="spec">
  <div class="panel">
    <h3>贴图规格</h3>
    <p><b>尺寸</b>　48 × 48 像素，PNG，透明背景。物品本体建议占满画布的 40×40，四周留 4px 空隙。</p>
    <p><b>风格</b>　像素画，关闭抗锯齿（游戏里用 <code>image-rendering: pixelated</code> 渲染）。深色背景下要看得清，尽量别用纯黑描边。</p>
    <p><b>命名</b>　文件名就是物品 id：<code>antiq03.png</code>、<code>lux01.png</code>。</p>
    <p><b>位置</b>　<code>tide/assets/items/</code> 目录下。</p>
    <p><b>游戏接入</b>　搜刮、背包、安全箱和仓库共用这套图标。执行 <code>node build.js</code> 后，单文件游戏也会内嵌所有贴图。</p>
  </div>
  <div class="panel">
    <h3>稀有度色（用于边框 / 角标）</h3>
    <div class="sws">${rarityBar}</div>
    <h3 style="margin-top:18px">类别色（用于图鉴分册 / 容器提示）</h3>
    <div class="sws">${catBar}</div>
  </div>
</div>

<section class="economy-guide"><h2>收集品价值体系</h2><p>单位：游戏货币 ¥。色条仅表示稀有度层次，不按金额线性缩放。医疗品与装备采用各自定价。<a href="design/items/ECONOMY.md">逐件价格与经济说明</a></p><div class="value-bands">${valueBands}</div></section>

${body}

<footer>
  清单由 <code>gen-item-sheet.js</code> 生成。价格源为 <code>design/items/economy.json</code>，重跑生成脚本或构建后同步游戏与页面。
</footer>

</body>
</html>`;

writeSheet('物品清单.html', html, 'items');
console.log('已生成 物品清单.html（' + ITEMS.length + ' 件）');
