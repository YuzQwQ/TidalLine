/* 尺度明确的矢量设计图；不生成或更改任何游戏美术素材。 */
const palette=['#eee0c4','#e7cfbf','#d9e2cc','#d0e1e5','#dfd5e9','#e4ddbe','#e5ccd1','#cedcd8'];
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const regionNames={apartment:'老公寓',clinic:'小诊所',clockshop:'钟表店',bank:'银行旧址',warehouse:'仓库兼工具铺',outdoors:'街巷 / 小院 / 河岸'};
const enemyNames={scav:'拾荒者',echo:'回响体',guard:'潮汐守卫'};
const enemyColors={scav:'#b96a36',echo:'#855da3',guard:'#3e789c'};
const cells=rect=>{const a=[];for(let y=rect[1];y<=rect[3];y++)for(let x=rect[0];x<=rect[2];x++)a.push([x,y]);return a;};
function render(data,result,view) {
  const building=data.buildings.find(b=>b.id===view.building);
  const rect=building?[Math.max(0,building.rect[0]-2),Math.max(0,building.rect[1]-2),Math.min(71,building.rect[2]+2),Math.min(55,building.rect[3]+2)]:[0,0,71,55];
  const u=building?44:20, left=62, top=150, sidebar=building?346:308;
  const mapW=(rect[2]-rect[0]+1)*u,mapH=(rect[3]-rect[1]+1)*u;
  const width=left+mapW+32+sidebar+24,height=Math.max(top+mapH+96,building?910:0),sideX=left+mapW+32;
  const px=x=>left+(x-rect[0])*u,py=y=>top+(y-rect[1])*u;
  const inView=(x,y)=>x>=rect[0]&&x<=rect[2]&&y>=rect[1]&&y<=rect[3];
  const out=[], t=(x,y,s,size=12,fill='#334e53',extra='')=>out.push(`<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${esc(s)}</text>`);
  const box=(x,y,w,h,fill,stroke='none',extra='')=>out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" ${extra}/>`);
  const circle=(x,y,r,fill,stroke='none')=>out.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}"/>`);
  function paragraph(text,y,font=12,color='#58716f') {
    let line='',amount=0;
    for(const ch of text){const weight=/[\x00-\x7f]/.test(ch)?0.57:1;if(amount+weight>(sidebar-22)/font){t(sideX,y,line,font,color);y+=font*1.7;line='';amount=0;}line+=ch;amount+=weight;}
    if(line){t(sideX,y,line,font,color);y+=font*1.7;}return y;
  }
  box(0,0,width,height,'#f6f5ef');
  box(0,0,width,112,'#163e38');
  t(30,33,'TIDELINE  /  LINHAI OLD QUARTER',11,'#9bc5b2','letter-spacing="2"');
  t(30,68,data.title+' · '+view.title,25,'#ffffff','font-weight="600"');
  t(30,94,building?'房间与门洞均按真实格坐标绘制；家具占格，金色编号为容器，圆形编号为敌人。':'72 × 56 格   ·   1 格 = 32px   ·   5 栋可进入建筑   ·   41 个容器   ·   24 个敌人',12,'#b9d4c7');
  t(width-28,34,'R01  /  独立设计评审稿',11,'#b9d4c7','text-anchor="end"');
  box(left-1,top-1,mapW+2,mapH+2,'#ffffff','#738d86');
  for(let y=rect[1];y<=rect[3];y++)for(let x=rect[0];x<=rect[2];x++) {
    const ch=data.rows[y][x], l=data.legend[ch];box(px(x),py(y),u,u,l.color);
    if(ch==='~'&&y%4===0&&x%2===0)out.push(`<path d="M${px(x)+u*.1},${py(y)+u*.6}q${u*.25},-${u*.18} ${u*.5},0t${u*.4},0" fill="none" stroke="#77aab5" stroke-width="1"/>`);
    if(ch==='='||ch==='-') for(let a=4;a<u;a+=building?9:5)out.push(`<path d="M${px(x)},${py(y)+a}h${u}" stroke="${ch==='='?'#b2a07f':'#916b48'}" stroke-width="1"/>`);
    if(ch==='w')box(px(x)+u*.25,py(y)+1,u*.5,u-2,'#b9e2e3','#4a929c','stroke-width="1.5"');
    if(ch==='s')for(let a=4;a<u;a+=building?8:4)out.push(`<path d="M${px(x)+1},${py(y)+a}h${u-2}" stroke="#718b82"/>`);
    if(ch==='/')out.push(`<path d="M${px(x)+u*.15},${py(y)+u*.2}l${u*.2},${u*.2}l-${u*.15},${u*.2}l${u*.2},${u*.2}" fill="none" stroke="#a45a3c" stroke-width="2"/>`);
  }
  const theseRooms=data.rooms.filter(r=>r.building===(building&&building.id));
  if(building)theseRooms.forEach((room,i)=>{for(const [x,y] of cells(room.rect))if(inView(x,y)&&['i','+'].includes(data.rows[y][x]))box(px(x)+.6,py(y)+.6,u-1.2,u-1.2,palette[i%palette.length]);});
  if(view.id==='tide') {
    for(const zone of data.tide.zones)for(const [x,y]of cells(zone.rect))if(inView(x,y))box(px(x)+1,py(y)+1,u-2,u-2,'#e9aaba','none','fill-opacity=".66"');
    for(const b of data.bridges){const [x1,y1,x2,y2]=b.rect;box(px(x1)+1,py(y1)+1,(x2-x1+1)*u-2,(y2-y1+1)*u-2,'none',b.id==='north'?'#297c66':'#bc6a74','stroke-width="3" stroke-dasharray="7 4"');}
  }
  // 细网格每格可见，四格加重；格边坐标与格中心标号分别表达。
  for(let x=rect[0];x<=rect[2]+1;x++)out.push(`<path d="M${px(x)},${top}v${mapH}" stroke="#5c706c" stroke-opacity="${x%4===0?.27:.10}" stroke-width="${x%4===0?1:.6}"/>`);
  for(let y=rect[1];y<=rect[3]+1;y++)out.push(`<path d="M${left},${py(y)}h${mapW}" stroke="#5c706c" stroke-opacity="${y%4===0?.27:.10}" stroke-width="${y%4===0?1:.6}"/>`);
  for(let x=rect[0];x<=rect[2];x++)if(building||x%4===0){t(px(x)+u/2,top-10,x,10,'#627c74','text-anchor="middle"');t(px(x)+u/2,top+mapH+18,x,10,'#627c74','text-anchor="middle"');}
  for(let y=rect[1];y<=rect[3];y++)if(building||y%4===0){t(left-12,py(y)+u*.65,y,10,'#627c74','text-anchor="end"');}
  for(const p of data.props)if(inView(p.x,p.y)) {
    const x=px(p.x),y=py(p.y),pad=u*.15;
    if(p.type==='tree'){circle(x+u/2,y+u/2,u*.36,'#80a078','#63855d');circle(x+u*.43,y+u*.4,u*.22,'#a3ba8b');}
    else {box(x+pad,y+pad,u-2*pad,u-2*pad,p.type==='display'?'#7eabb0':p.type==='bed'?'#9caeb5':'#9e9a82','#7c806f',`rx="${u*.06}"`);out.push(`<path d="M${x+pad},${y+u*.45}h${u-2*pad}" stroke="#eef0e5" stroke-width="1"/>`);}
  }
  if(view.id==='overview')for(const route of result.routes){
    out.push(`<polyline points="${route.points.map(([x,y])=>`${px(x)+u/2},${py(y)+u/2}`).join(' ')}" fill="none" stroke="${route.color}" stroke-opacity=".72" stroke-width="2.2" stroke-linejoin="round" stroke-dasharray="${route.id==='commercial'?'7 3':route.id==='shortcut'?'2 4':'none'}"/>`);
  }
  if(view.id!=='tide')for(const c of data.containers)if(inView(c.x,c.y)){
    const x=px(c.x),y=py(c.y),heavy=data.containerTypes[c.type].kind==='heavy';
    box(x+u*.11,y+u*.16,u*.78,u*.68,heavy?'#b58a32':'#8a805b','#fff7df','stroke-width=".8" rx="2"');
    t(x+u/2,y+u*.63,view.id==='encounters'||building?c.type+c.id.slice(1):c.type,building?11:7.4,'#ffffff','text-anchor="middle" font-family="Consolas, monospace"');
  }
  if(view.id==='encounters'||building)for(const e of data.enemies)if(inView(e.x,e.y)){
    const x=px(e.x)+u/2,y=py(e.y)+u/2;circle(x,y,u*.36,enemyColors[e.type],'#fff');t(x,y+u*.14,e.id.slice(1),building?12:9,'#fff','text-anchor="middle" font-family="Consolas, monospace"');
  }
  for(const marker of [{...data.spawn,symbol:'P',color:'#216b4e'},...data.exits.map(e=>({...e,symbol:e.id,color:'#225e83'}))])if(inView(marker.x,marker.y)) {
    const x=px(marker.x)+u/2,y=py(marker.y)+u/2;circle(x,y,u*.47,marker.color,'#fff');t(x,y+u*.17,marker.symbol,building?15:12,'#fff','text-anchor="middle" font-weight="bold"');
  }
  if(building)theseRooms.forEach((room,i)=>{const x=px(room.anchor[0])+u*.3,y=py(room.anchor[1])+u*.25;circle(x,y,10,'#fff','#526e64');t(x,y+4,i+1,11,'#355749','text-anchor="middle" font-weight="bold"');});
  if(!building) {
    const labels=[['① 老公寓',11,6],['② 小诊所',10,32],['③ 钟表店',49,16],['④ 银行旧址',60,30],['⑤ 仓库 / 工具铺',44,43],['住宅小院',19,28],['银行前场',47,34],['北石桥 · 4格',32.5,11],['南栈桥 · 3格',32.5,39],['北街封闭铺面',49,5]];
    for(const [name,x,y]of labels){const labelW=name.length*11+16,xx=px(x)+u/2,yy=py(y)+u*.5;box(xx-labelW/2,yy-10,labelW,20,'#f9f8ef','#6e8980','rx="3"');t(xx,yy+4,name,11,'#284f43','text-anchor="middle" font-weight="600"');}
    t(px(32.5)+u/2,py(28),'临 海 运 河',13,'#e3f1ef','text-anchor="middle" transform="rotate(90 '+(px(32.5)+u/2)+' '+py(28)+')" letter-spacing="4"');
    if(view.id==='tide'){for(const [name,x,y]of [['预留低地',43,40],['预留低巷',50,47],['阶梯',28,28],['阶梯',37,24]])t(px(x)+u/2,py(y)+u*.65,name,10,'#802f50','text-anchor="middle" font-weight="600"');}
  }
  // 右栏全部为可读图例和说明，不与地图或点位重叠。
  let sy=top+7;
  const heading=s=>{t(sideX,sy,s,15,'#244f41','font-weight="600"');sy+=25;};
  if(building){
    heading(building.name+' · 房间索引');
    theseRooms.forEach((room,i)=>{box(sideX,sy-11,13,13,palette[i%palette.length],'#aebaaa');t(sideX+22,sy,`${i+1}  ${room.name}`,12,'#38574c');sy+=22;});
    sy+=12;heading('空间与绕行');sy=paragraph(data.roomFlows[building.id]||building.shape,sy);sy+=15;
    heading('出入口');for(const p of data.portals.filter(p=>p.building===building.id&&p.connects.includes('outside'))){sy=paragraph(p.name+' · '+p.width+' 格宽',sy);}
    if(building.id==='bank'){sy+=15;heading('递进关系');sy=paragraph('柜台后通道 → 安保室 → 金库。安保过渡门和金库门分别封闭时，均无法从室外绕入金库。前后门通过办公后勤环路相连。',sy);}
    sy+=16;heading('点位与占格');sy=paragraph(`本栋 ${data.containers.filter(c=>c.region===building.id).length} 个容器、${data.enemies.filter(e=>e.region===building.id).length} 个敌人。金色方块为容器；棕色 / 蓝色 / 紫色圆为敌人，数字对应点位表。灰色家具按一格实体占用。`,sy);
    sy+=12;sy=paragraph('房间编号使用白色小圆；金库保险柜、药柜等均保留可达操作面。主要走廊保留两格净宽。',sy);
    sy+=18;heading('门 / 破口 / 橱窗');sy=paragraph('金色格：门洞（评审按打开状态）；赭色锯齿格：现有破口；青色格：不可通行、可透视的展示橱窗。',sy);
  } else {
    heading(view.id==='tide'?'潮汐预留 · 未实现':view.id==='encounters'?'物资与守备配额':'街区与推荐路线');
    for(const [i,b]of data.buildings.entries()){
      const n=result.stats.regions[b.id];t(sideX,sy,`${i+1}. ${b.name}`,13,'#35594b','font-weight="600"');sy+=20;
      t(sideX,sy,`${n.containers} 容器 · ${n.enemies} 敌人`,11,'#687b70');sy+=27;
    }
    sy+=8;
    if(view.id==='overview'){
      heading('三条可行路线');for(const r of result.routes){box(sideX,sy-8,18,3,r.color);t(sideX+26,sy,r.name,12,'#476252');sy+=21;t(sideX+26,sy,r.steps+' 步 · 实体占格寻路',10,'#74857a');sy+=27;}
      sy=paragraph('路线相交或重叠表示共用街巷。北桥沿主街低压过河，南桥通往低地与后勤路线。',sy);
    } else if(view.id==='encounters'){
      heading('图上编号');sy=paragraph('金色方块 B23 表示 c23 号保险箱。圆形 09 表示 e09 号敌人；完整坐标见评审页点位表。',sy);sy+=12;
      for(const type of ['scav','echo','guard']){circle(sideX+7,sy-4,7,enemyColors[type]);t(sideX+24,sy,`${enemyNames[type]} × ${result.stats.enemiesByType[type]}`,12);sy+=25;}
      sy+=8;sy=paragraph('敌人之间至少相隔 3 格，距出生点至少 12 格，两个撤离点周围 6 格无固定敌人。北桥及桥头不设固定堵桥点。',sy);
      sy+=15;heading('容器类型');for(const [type,n]of Object.entries(result.stats.containersByType)){t(sideX,sy,`${type}  ${data.containerTypes[type].name} × ${n}`,12);sy+=22;}
    } else {
      heading('粉色预留区域');sy=paragraph('只表示未来受潮汐影响的位置。本轮没有减速、封路或南桥失效规则，低地仍按可通行地形验收。',sy);sy+=14;
      for(const zone of data.tide.zones){sy=paragraph(zone.name+'：('+zone.rect[0]+','+zone.rect[1]+')–('+zone.rect[2]+','+zone.rect[3]+')',sy);sy+=6;}
      sy+=14;heading('稳定通路');sy=paragraph('模拟未来低地、阶梯与南桥不可通行后，仍可通过北桥连接两岸并抵达两个撤离点。蓝色运河始终不可涉水。',sy);
    }
    sy+=20;heading('通用图例');for(const [color,name]of [['#438697','永久运河 · 不可涉水'],['#354550','墙体 · 阻挡行动与视线'],['#c4ccd0','街道 / 巷道'],['#d8e1ce','小院 / 半开放前场'],['#d5a956','门洞 · 按打开状态评审'],['#88c6d0','橱窗 · 阻挡行动、可透视']]){box(sideX,sy-11,13,13,color);t(sideX+23,sy,name,11);sy+=23;}
  }
  const bottom=top+mapH+43;
  out.push(`<path d="M${left},${bottom}h${u*4}m-${u*4},-4v8m${u*4},-8v8" stroke="#385c4b" stroke-width="2"/>`);
  t(left+u*2,bottom+20,'4 格 = 128px（游戏逻辑尺寸）',10,'#637c6c','text-anchor="middle"');
  t(left+mapW,bottom,'上北 · 下南 · 左西 · 右东',11,'#637c6c','text-anchor="end"');
  t(left+mapW,bottom+22,'坐标为格中心编号；所有尺寸包含端点。',10,'#7a8b80','text-anchor="end"');
  t(sideX,height-26,`通过 ${result.checks.length} 项数据验收 · 游戏 / Wiki 未改动`,10,'#74877a');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc"><title id="title">${esc(data.title+' · '+view.title)}</title><desc id="desc">${esc(view.description)}</desc><g font-family="Microsoft YaHei, PingFang SC, sans-serif">${out.join('')}</g></svg>`;
}
module.exports={render,esc,regionNames,enemyNames};
