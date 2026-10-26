/* node design/maps/linhai-old-quarter/build.cjs；需要 sharp，仅写本设计目录。 */
const fs=require('fs');
const path=require('path');
const sharp=require('sharp');
const {data}=require('./source.cjs');
const {validate}=require('./validate.cjs');
const {render,esc,regionNames,enemyNames}=require('./render.cjs');
const result=validate(data);
const views=[
 {id:'overview',title:'格子总览与推荐路线',description:'72×56 格的完整平面、坐标、比例尺、两岸分区、双桥、四栋主楼与仓库，以及三条实体占格可行路线。'},
 {id:'apartment',building:'apartment',title:'老公寓 · 房间放大图',description:'两间卧室、厨房、客厅、储藏间、门厅、侧廊与双出入口。'},
 {id:'clinic',building:'clinic',title:'小诊所 · 房间放大图',description:'候诊、诊疗、药品储藏、两格后勤廊与东侧破损入口。'},
 {id:'clockshop',building:'clockshop',title:'钟表店 · 房间放大图',description:'临街橱窗、营业厅、柜台、维修间、后仓与内部环路。'},
 {id:'bank',building:'bank',title:'银行旧址 · 房间放大图',description:'前厅、柜台、办公室、后通道、后勤环廊、安保与金库，以及前后两条进出路线。'},
 {id:'encounters',title:'物资与敌人分布',description:'全部 41 个容器、24 个敌人的类型、编号与固定格坐标，分区配额和出生/撤离缓冲说明。'},
 {id:'tide',title:'未来潮汐影响区预留',description:'仅标注南桥东端低地、仓库东巷、两岸阶梯；不接入动态潮汐。'}
];
const table=(heads,rows)=>`<div class="table-scroll"><table><thead><tr>${heads.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const coord=(x,y)=>`(${x}, ${y})`;
const notes={
 overview:['坐标从左上角 (0,0) 开始，范围包含端点。方格代表真实占地，展示图本身不改变游戏。','两座桥是仅有的跨岸通路。住宅小院与银行前场各为 8×8 格。背景封闭铺面不算可进入建筑。','主街保留 6 格净宽，支巷至少 3 格，室内主要走廊 2 格；灰色家具、树木与容器均占一个实体格。'],
 apartment:[data.roomFlows.apartment,'东北四格凹口形成附属后院；南侧门厅、东侧后巷门是两条独立入口。卧室和储藏间为支路，主要活动空间形成绕行环路。'],
 clinic:[data.roomFlows.clinic,'药柜位于独立药储空间。破口进入后勤侧廊后还需转向通过药储门，不能从室外直接走进药柜区。'],
 clockshop:[data.roomFlows.clockshop,'展示橱窗面向西侧商业街，标为不可通行、可透视。前店与后仓分区清楚，后门提供绕行路线。'],
 bank:[data.roomFlows.bank,'银行守备分为前厅/营业区、办公室、安保区三层。金库内不堆敌人；后门也必须经过安保过渡后才能进入金库。','银行没有新钥匙、门禁或机关，设计挑战来自空间推进、守备和回撤路径。'],
 encounters:['首稿配额与当前版本相同：41 个容器、24 个敌人；不扩大掉落总量。','北桥及桥头不设固定堵桥点；南桥不设固定战斗关卡，邻近街区的巡逻和暴露地形构成风险。','敌人至少相隔 3 格，距出生点至少 12 格，撤离点周围 6 格无固定敌人。'],
 tide:['粉色仅代表未来潮汐预留区。当前设计验收按正常可通行低地检查，没有运行时水位、减速或封路逻辑。','常态运河一直不可涉水；北桥、普通街区、两个撤离点属于稳定路线。','额外模拟预留区和南桥同时封闭，仍能通过北桥抵达两处撤离点。这是设计可行性检查，不是游戏功能。']
};
function panel(view,index) {
 const relatedRooms=data.rooms.filter(r=>r.building===view.building);
 let extra='';
 if(view.building){
  extra+='<h3>房间 / 功能区索引</h3>'+table(['图中编号','空间','格子范围'],relatedRooms.map((r,i)=>[i+1,r.name,coord(r.rect[0],r.rect[1])+'–'+coord(r.rect[2],r.rect[3])]));
  extra+='<h3>独立出入口</h3>'+table(['名称','宽度','格坐标'],data.portals.filter(p=>p.building===view.building&&p.connects.includes('outside')).map(p=>[p.name,p.width+' 格',p.cells.map(c=>coord(...c)).join(' / ')]));
 }
 if(view.id==='encounters'){
  extra+='<h3>分区配额</h3>'+table(['分区','容器','敌人'],Object.entries(result.stats.regions).map(([id,n])=>[regionNames[id],n.containers,n.enemies]));
  extra+='<details><summary>展开全部 41 个容器点位</summary>'+table(['图上编号 / 数据 ID','类别','分区','坐标','掉落偏好（规划）'],data.containers.map(c=>[c.type+c.id.slice(1)+' / '+c.id,data.containerTypes[c.type].name,regionNames[c.region],coord(c.x,c.y),c.preference.join(' / ')]))+'</details>';
  extra+='<details><summary>展开全部 24 个敌人点位</summary>'+table(['图上编号 / 数据 ID','类型','分区','坐标','巡逻选点半径'],data.enemies.map(e=>[e.id.slice(1)+' / '+e.id,enemyNames[e.type],regionNames[e.region],coord(e.x,e.y),e.patrolRadius+' 格']))+'</details>';
 }
 if(view.id==='tide')extra+='<h3>预留边界</h3>'+table(['区域','范围','本轮状态'],data.tide.zones.map(z=>[z.name,coord(z.rect[0],z.rect[1])+'–'+coord(z.rect[2],z.rect[3]),'仅标注，未实现']));
 if(view.id==='overview')extra+='<details><summary>查看 '+result.checks.length+' 项设计验收</summary><ul>'+result.checks.map(c=>'<li>✓ '+esc(c.name)+'</li>').join('')+'</ul></details>';
 return `<section id="${view.id}" class="review-panel" aria-label="${view.title}"${index?' hidden':''}>
  <div class="panel-title"><div><span class="eyebrow">DESIGN REVIEW / ${String(index+1).padStart(2,'0')}</span><h2>${view.title}</h2></div><div class="downloads"><a href="figures/${view.id}.png" download>PNG</a><a href="figures/${view.id}.svg" download>SVG</a></div></div>
  <p class="lede">${view.description}</p>
  <div class="art"><img src="figures/${view.id}.svg" alt="${view.description}" width="${view.pixelWidth}" height="${view.pixelHeight}"></div>
  <div class="reading-notes"><h3>评审要点</h3><ul>${notes[view.id].map(n=>'<li>'+esc(n)+'</li>').join('')}</ul>${extra}</div>
 </section>`;
}
function html() {
 return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>临海路旧街区 · 设计评审</title><style>
*{box-sizing:border-box}body{margin:0;background:#f0f1eb;color:#29493d;font-family:"Microsoft YaHei","PingFang SC",sans-serif}a{color:#287f68;text-underline-offset:4px}button,input{font:inherit}button,a:focus-visible,input:focus-visible{outline-offset:4px}a:focus-visible,button:focus-visible,input:focus-visible{outline:2px solid #43836b}header{background:#163e38;color:#fff;padding:25px max(24px,calc((100vw - 1500px)/2));}header .eyebrow{color:#a6c7b7}h1{font-size:27px;margin:8px 0}header p{color:#b7d0c3;font-size:13px;line-height:1.8;margin:8px 0 0}.header-meta{display:flex;gap:14px;flex-wrap:wrap;margin-top:16px;font-size:12px}.header-meta span{border:1px solid #477260;border-radius:4px;padding:6px 10px}.header-meta a{color:#cbe4d6}.eyebrow{font:10px Consolas,monospace;letter-spacing:2px;color:#6e9180}.page{max-width:1548px;margin:0 auto;padding:22px 24px 60px}nav{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px}nav a{text-decoration:none;padding:10px 15px;border:1px solid #cad8ca;border-radius:4px;color:#657b6a;font-size:13px;background:#f9faf5}nav a[aria-current="page"]{background:#245c49;color:#fff;border-color:#245c49}.toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 14px;border:1px solid #ccd8ca;border-radius:6px;background:#f8faf3;margin-bottom:15px;font-size:12px}.toolbar button{background:#fff;border:1px solid #b9cbb9;border-radius:4px;color:#395f4b;padding:5px 10px;cursor:pointer}.toolbar label{display:flex;align-items:center;gap:8px}.toolbar input{width:130px}.toolbar .hint{margin-left:auto;color:#71836e}.review-panel{background:#fffef8;border:1px solid #cfdaca;border-radius:8px;overflow:hidden}[hidden]{display:none!important}.panel-title{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:22px 24px 0}.panel-title h2{margin:6px 0 0;font-size:21px}.downloads{display:flex;gap:8px;font:11px Consolas,monospace}.downloads a{padding:6px 9px;border:1px solid #d3dccf;border-radius:4px;text-decoration:none}.lede{margin:12px 24px 20px;font-size:13px;line-height:1.8;color:#70816b}.art{overflow:auto;background:#e5e9df;border-top:1px solid #d5dfce;border-bottom:1px solid #d5dfce;max-height:1050px}.art img{display:block;width:100%;height:auto;max-width:none}.reading-notes{padding:20px 24px 26px;font-size:13px;line-height:1.9}.reading-notes h3{font-size:14px;color:#365e47;margin:16px 0 12px}.reading-notes ul{padding-left:20px}.reading-notes li{margin:7px 0}.table-scroll{overflow:auto}table{width:100%;border-collapse:collapse;font-size:12px}td,th{text-align:left;padding:10px 12px;border-bottom:1px solid #dfe5d9}th{background:#eff3e8;color:#53744e;white-space:nowrap}td{color:#5b7055}details{margin:18px 0;border:1px solid #d4dfca;padding:12px;border-radius:5px}summary{cursor:pointer;font-size:13px;color:#52764d}footer{font-size:11px;color:#819278;line-height:1.9;padding:18px 0}footer a{margin-right:12px}@media(max-width:640px){header{padding:22px 16px}h1{font-size:23px}.page{padding:16px 12px 40px}nav{gap:5px}nav a{flex:1 0 28%;text-align:center;padding:9px 5px;font-size:12px}.panel-title{padding:17px 15px 0;align-items:flex-start}.panel-title h2{font-size:18px}.lede{margin:12px 15px 16px}.reading-notes{padding:14px}.toolbar .hint{width:100%;margin:0}.toolbar input{width:100px}.art{max-height:750px}.downloads{flex-direction:column;gap:4px}}
</style></head><body><header><div class="eyebrow">TIDELINE · MAP DESIGN / R01</div><h1>临海路旧街区 · 设计评审</h1><p>两岸街区、中央运河与双桥路线。先评审空间、功能和布防，再安排专用美术及游戏接入。</p><div class="header-meta"><span>72 × 56 格</span><span>${data.buildings.length} 栋建筑 · ${data.rooms.length} 个房间 / 功能区</span><span>41 容器 · 24 敌人</span><span>通过 ${result.checks.length} 项验收</span><span>独立设计稿 · 未接入游戏</span></div></header>
<main class="page"><nav aria-label="设计图导航">${views.map((v,i)=>`<a href="#${v.id}" data-view="${v.id}"${i?'':' aria-current="page"'}>${({overview:'全图总览',apartment:'老公寓',clinic:'小诊所',clockshop:'钟表店',bank:'银行旧址',encounters:'物资与布防',tide:'潮汐预留'})[v.id]}</a>`).join('')}</nav>
<div class="toolbar"><button id="fit" type="button">适应窗口</button><button id="actual" type="button">原图尺寸</button><label>缩放 <input id="zoom" type="range" min="70" max="250" step="10" value="100"><output id="zoomValue">100%</output></label><span class="hint">放大后可在图内横向滚动 · 图片均可导出</span></div>
${views.map(panel).join('')}<footer><a href="layout.json">格子草案 JSON</a><a href="validation.json">验收报告 JSON</a><a href="README.md">设计说明</a><a href="${encodeURI(data.reference)}">原始概念图</a><br>所有图稿与统计由同一份设计源生成。专用美术、动态潮汐和游戏接入未包含在本轮交付中。</footer></main>
<script>(()=>{const panels=[...document.querySelectorAll('.review-panel')],links=[...document.querySelectorAll('[data-view]')],zoom=document.getElementById('zoom'),out=document.getElementById('zoomValue');let active;function fit(){const img=active.querySelector('img');img.style.width='100%';zoom.value=100;out.textContent='100%';active.querySelector('.art').scrollTo(0,0)}function show(){active=panels.find(p=>p.id===location.hash.slice(1))||panels[0];panels.forEach(p=>p.hidden=p!==active);links.forEach(l=>{if(l.dataset.view===active.id)l.setAttribute('aria-current','page');else l.removeAttribute('aria-current')});document.title='临海路旧街区 · '+active.getAttribute('aria-label');fit();window.scrollTo(0,0)}window.addEventListener('hashchange',show);window.addEventListener('load',()=>window.scrollTo(0,0));document.getElementById('fit').addEventListener('click',fit);document.getElementById('actual').addEventListener('click',()=>{const img=active.querySelector('img');img.style.width=img.naturalWidth+'px';out.textContent='原图'});zoom.addEventListener('input',()=>{active.querySelector('img').style.width=zoom.value+'%';out.textContent=zoom.value+'%'});show()})();</script></body></html>`;
}
function readme() {
 const regionRows=Object.entries(result.stats.regions).map(([id,n])=>`| ${regionNames[id]} | ${n.containers} | ${n.enemies} |`).join('\n');
 return `# 临海路旧街区 · R01 设计评审稿\n\n[打开交互评审页](index.html) · [格子数据](layout.json) · [验收报告](validation.json)\n\n本目录是独立设计稿，不替换当前游戏地图，不改变存档、游戏构建或 Wiki。专用美术与游戏接入安排在布局确认之后；动态潮汐本轮只做预留。\n\n## 图稿\n\n${views.map(v=>`- ${v.title}：[PNG](figures/${v.id}.png) / [SVG](figures/${v.id}.svg)`).join('\n')}\n\n![全图总览](figures/overview.png)\n\n## 尺度与空间\n\n固定 **72×56 格**，1 格对应游戏逻辑 32px；坐标从左上角 (0,0) 开始，x 向东、y 向南。所有范围包含端点。\n\n| 建筑 | 格子范围 | 外包围尺寸 |\n| --- | --- | --- |\n${data.buildings.map(b=>`| ${b.name} | (${b.rect[0]},${b.rect[1]})–(${b.rect[2]},${b.rect[3]}) | ${b.rect[2]-b.rect[0]+1}×${b.rect[3]-b.rect[1]+1} |`).join('\n')}\n\n运河水面 x30–35，宽 6 格，南北贯穿；两侧驳岸 x29、x36。北石桥 y12–15，宽 4 格；南栈桥 y40–42，宽 3 格。运河常态不可涉水，只有双桥可过河。仓库临河背面封闭，交通通过北侧前场和东侧三格巷道绕行。北街封闭铺面只是背景街坊，不算可进入建筑。\n\n西岸主街 x23–28，东岸主街 x37–42，均为 6 格净宽。公寓后巷、诊所后巷、钟表店侧巷、银行北/东/南路和仓库东巷至少保留 3 格净宽；室内主要走廊保留 2 格。所有净宽在家具和容器占格之后验证；门洞允许局部为 1–2 格。住宅小院 (15,25)–(22,32)、银行前场 (43,31)–(50,38) 均为 8×8 格。\n\n## 室内动线\n\n${data.buildings.filter(b=>b.id!=='warehouse').map(b=>`### ${b.name}\n\n${b.shape}。${data.roomFlows[b.id]}\n\n房间与功能区：${data.rooms.filter(r=>r.building===b.id).map(r=>r.name).join('、')}。`).join('\n\n')}\n\n### 仓库兼工具铺\n\n北侧装卸入口接南桥低地，东侧侧门接三格绕行巷。中央两格通道和横向两格通道穿过货架布置，形成可绕行的装卸空间。普通工具箱靠入口，防水补给箱位于内部。\n\n实体家具、箱柜、树木均占一格；河面与驳岸不可通行。橱窗阻挡行动但可透视，现有破口无需新交互。门洞按打开状态检查连通性；不引入钥匙、门禁、破墙操作或机关。\n\n## 物资与守备\n\n| 分区 | 容器 | 敌人 |\n| --- | ---: | ---: |\n${regionRows}\n\n全图 **41 个容器、24 个敌人、${data.props.length} 处实体家具/摆设**。敌人为 12 名拾荒者、7 只回响体、5 名银行守卫。容器类型为 C 抽屉 9、L 储物柜 10、B 保险箱 8、T 工具箱 4、M 医疗柜 5、R 电子设备柜 3、K 防水补给箱 2。\n\n物资偏好是规划标注，不修改现有掉落表：住宅偏生活，诊所偏医疗，钟表店偏古玩/奢侈品，银行偏保险物资与收藏品，仓库偏工业/电子。所有固定点位在评审页和 JSON 中有编号及坐标。\n\n银行 5 名守卫分布在前厅、柜台、办公室及安保区。金库内不堆怪；前厅与金库之间始终有办公和安保过渡。北桥与桥头不设固定堵桥点，南桥也不设固定关卡。敌人之间至少相距 3 格，距出生点至少 12 格，两处撤离点 6 格范围内没有固定敌人。巡逻半径是未来接入建议，不运行 AI；调查与追击规则本轮不改。\n\n## 起点与三条路线\n\n出生 P：(7,4)。西岸撤离 A：(6,51)；东岸撤离 B：(67,51)。\n\n${result.routes.map(r=>`- **${r.name}**：${r.id==='residential'?'公寓 → 小院/后巷 → 诊所 → 西岸撤离':r.id==='commercial'?'公寓 → 北桥 → 钟表店 → 银行 → 东岸撤离':'诊所后巷 → 南桥 → 仓库/银行后勤 → 东岸撤离'}；图中为实体占格 BFS 寻路，共 ${r.steps} 个格间步长（含搜刮折返）。`).join('\n')}\n\n## 潮汐预留\n\n${data.tide.zones.map(z=>`- ${z.name}：(${z.rect[0]},${z.rect[1]})–(${z.rect[2]},${z.rect[3]})。`).join('\n')}\n\n本轮没有水位、减速、低地封路、南桥失效或河岸上水逻辑。低地在设计稿中仍可通行；蓝色运河则始终不可涉水。验收额外模拟这些预留区域与南桥封闭，证明未来局部潮汐不会切断北桥和两处撤离路线。\n\n## 数据与复现\n\n- source.cjs：唯一手工设计源，含地形、建筑轮廓、房间、门、家具、点位、净宽与路线节点。\n- layout.json：由设计源生成，包含图例、格子行、建筑和房间、门洞、橱窗、家具、容器、敌人、起点、撤离点、桥、潮汐预留与实际路线。\n- validate.cjs：验收逻辑，可独立读取已交付 JSON；不依赖游戏运行环境。\n- render.cjs / build.cjs：同源 SVG/PNG 与评审页生成。PNG 需要 sharp。\n\n在项目根目录运行：\n\n\`\`\`powershell\nnode design/maps/linhai-old-quarter/validate.cjs\nnode design/maps/linhai-old-quarter/build.cjs\n\`\`\`\n\n若 sharp 未在默认模块路径中，可使用本机已配置的 Node 依赖目录设置 NODE_PATH。源数据是设计评审格式，不作为可直接替换现有 MAP_ROWS 的游戏数据。\n\n## 验收结果\n\n${result.checks.map(c=>`- [x] ${c.name}`).join('\n')}\n`;
}
(async()=>{
 const figureDir=path.join(__dirname,'figures');fs.mkdirSync(figureDir,{recursive:true});
 await Promise.all(views.map(async view=>{
   const svg=render(data,result,view);const svgFile=path.join(figureDir,view.id+'.svg');
   fs.writeFileSync(svgFile,svg,'utf8');
   const buffer=await sharp(Buffer.from(svg)).png().toBuffer();const metadata=await sharp(buffer).metadata();
   view.pixelWidth=metadata.width;view.pixelHeight=metadata.height;
   fs.writeFileSync(path.join(figureDir,view.id+'.png'),buffer);
 }));
 const output={...data,routes:result.routes};
 fs.writeFileSync(path.join(__dirname,'layout.json'),JSON.stringify(output,null,2)+'\n','utf8');
 fs.writeFileSync(path.join(__dirname,'validation.json'),JSON.stringify({status:'passed',checks:result.checks,stats:result.stats},null,2)+'\n','utf8');
 fs.writeFileSync(path.join(__dirname,'README.md'),readme(),'utf8');
 fs.writeFileSync(path.join(__dirname,'index.html'),html(),'utf8');
 console.log(`已生成 ${views.length} 组 SVG/PNG、交互评审页、草案数据与说明；通过 ${result.checks.length} 项验收。`);
})().catch(error=>{console.error(error);process.exitCode=1;});
