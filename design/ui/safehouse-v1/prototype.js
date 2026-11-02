/* Static proposal: no game modules, storage access, transactions, timers or animation loop. */
const assets='../../../assets/';
const inventory=[
 {name:'突击步枪',file:'gear/rifle.png',type:'gear',r:'上乘',color:'#6d95b8',note:'武器槽 · 弹匣状态由游戏数据提供'},
 {name:'II级头盔',file:'gear/helmet2.png',type:'gear',r:'良品',color:'#85a679',note:'头部防护 · 详情保留耐久与重量'},
 {name:'II级护甲',file:'gear/body2.png',type:'gear',r:'良品',color:'#85a679',note:'身体防护 · 详情保留瞄准惩罚'},
 {name:'民用旅行背包',file:'gear/bag02.png',type:'gear',r:'良品',color:'#85a679',note:'容量12格 · 容量与负重分别展示'},
 {name:'绷带',file:'items/heal01.png',type:'medical',r:'寻常',color:'#b8bca9',n:'容量 20',note:'医疗详情保留剩余容量、使用、转移与出售等实际可用动作'},
 {name:'家庭急救包',file:'items/heal03.png',type:'medical',r:'上乘',color:'#6d95b8',n:'容量 50',note:'示意完整容量；局外用药由现有医疗规则计算'},
 {name:'5.56×45mm',file:'items/ammo_556.png',type:'ammo',r:'良品',color:'#85a679',n:'×60',note:'弹药口径、等级和数量都需要可读标签'},
 {name:'9×19mm',file:'items/ammo_9mm.png',type:'ammo',r:'寻常',color:'#b8bca9',n:'×90',note:'原型不修改弹药数量与堆叠上限'},
 {name:'12 Gauge',file:'items/ammo_12g.png',type:'ammo',r:'上乘',color:'#6d95b8',n:'×20',note:'弹药稀有度通过边框与文字共同表达'}
];
const itemMarkup=(item)=>`<button class="item" style="--accent:${item.color}" data-item="${inventory.indexOf(item)}"><img src="${assets+item.file}" alt=""><b>${item.name}</b><small>${item.r}</small>${item.n?`<span class="qty">${item.n}</span>`:''}</button>`;
function fill(id,list){document.getElementById(id).innerHTML=list.map(itemMarkup).join('');}
function go(page){document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===page));document.querySelectorAll('[data-page]').forEach(x=>{x.classList.toggle('active',x.dataset.page===page);x.setAttribute('aria-current',x.dataset.page===page?'page':'false');});document.getElementById('title').textContent={overview:'行动之间，整理自己。',loadout:'带什么进去，由你决定。',stash:'每一格，都有它的位置。',traders:'可信赖的货物，各自的规矩。'}[page];}
const merchants={armor:{name:'玛拉·维恩',role:'防护装备与物资供应',id:'merchant_armor',quote:'柜台上的都是公开货。价钱写着，规矩也写着。',goods:[1,2,3]},guns:{name:'埃德加·洛克',role:'军械供应与技术维护',id:'merchant_guns',quote:'口径、用途、预算。按这个顺序说。',goods:[0,6,7,8]},doctor:{name:'林岑',role:'医疗用品与收费治疗',id:'merchant_doctor',quote:'先坐下。告诉我哪里不舒服。',goods:[4,5]}};
function trader(key){const m=merchants[key];document.getElementById('portrait').src=assets+'npc-art/merchants/'+m.id+'.png';document.getElementById('portrait').alt=m.name;document.getElementById('merchant-name').textContent=m.name;document.getElementById('merchant-role').textContent=m.role;document.getElementById('quote').textContent=m.quote;document.getElementById('service').hidden=key!=='doctor';fill('offers',m.goods.map(i=>inventory[i]));document.querySelectorAll('[data-merchant]').forEach(x=>x.classList.toggle('selected',x.dataset.merchant===key));}
function message(text){document.getElementById('detail-content').innerHTML='<h2>操作位置示意</h2><p class="muted"></p>';document.querySelector('#detail-content p').textContent=text;document.getElementById('details').showModal();}
document.addEventListener('click',ev=>{
 const b=ev.target.closest('button');if(!b)return;
 if(b.dataset.page)go(b.dataset.page);
 if(b.dataset.jump){go(b.dataset.jump==='doctor'?'traders':b.dataset.jump);if(b.dataset.jump==='doctor')trader('doctor');}
 if(b.dataset.merchant)trader(b.dataset.merchant);
 if(b.hasAttribute('data-map'))document.getElementById('map').showModal();
 if(b.hasAttribute('data-close')||b.classList.contains('close'))b.closest('dialog').close();
 if(b.dataset.info)message(b.dataset.info);
 if(b.dataset.item!==undefined){const item=inventory[+b.dataset.item];document.getElementById('detail-content').innerHTML=`<img class="detail-icon" src="${assets+item.file}" alt=""><h2>${item.name}</h2><p class="muted">${item.r} · ${item.note}</p><p class="muted">此处只评审详情抽屉的位置，不操作库存、不购买、不出售。</p><button class="secondary" data-close>关闭预览</button>`;document.getElementById('details').showModal();}
 if(b.dataset.filter){filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('selected',x===b));renderStash();}
});
let filter='all';function renderStash(){const search=document.getElementById('search').value.trim().toLowerCase();const list=inventory.filter(x=>(filter==='all'||x.type===filter)&&x.name.toLowerCase().includes(search));fill('stash-items',list);document.getElementById('results').textContent=`显示 ${list.length} 件演示物品`;}
document.getElementById('search').addEventListener('input',renderStash);
fill('gear',inventory.slice(0,4));fill('bag',inventory.slice(4,8));fill('loadout-stash',inventory);fill('trader-stash',inventory.slice(1,7));renderStash();trader('armor');

document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();go('overview');});
