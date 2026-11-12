const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),h=fs.readFileSync(path.join(root,'run-test.js'),'utf8').split('let pass = 0')[0];
const c=new Function('require','__dirname',h+'\nreturn ctx;')(require,root);
const {W,A,D,E,B,Ammo,C,S,G,L,F,Ground,N,CFG}=vm.runInContext('({W:WEAPONS,A:Attachments,D:ATTACHMENT_DEFS,E:EQUIP,B:BALLISTICS,Ammo:AMMO_ITEMS,C:Combat,S:Save,G:Game,L:Loot,F:Firearms,Ground:GroundSpawns,N:Noise,CFG})',c);
let checks=0;const ok=(b,message)=>{assert(b,message);checks++;},near=(a,b)=>ok(Math.abs(a-b)<1e-8,a+' != '+b);
G.init();c.Base.render=()=>{};
ok(!W.m7&&!W.M7,'M7 stays unimplemented');
ok(Ammo.filter(a=>a.caliber==='68x51').length===2,'exactly two actual grades');
ok(!vm.runInContext("ammoItem('68x51',1)||ammoItem('68x51',2)||ammoItem('68x51',3)",c),'no fictional lower grades');
ok(vm.runInContext("defaultAmmo('68x51').id",c)==='ammo_68x51_4','default is actual FMJ');
for(const [level,damage,pen,price]of [[4,47,49,2500],[5,42,63,7500]]){
 const a=Ammo.find(a=>a.caliber==='68x51'&&a.level===level);ok(a&&a.B===damage&&a.P===pen&&a.price===price&&a.r===level&&a.stack===60,'ammo data');
 near(C.resolve({B:a.B,P:a.P,part:'head'}).health,damage*1.5);
}
for(const [gun,rpm,price,muzzle,family,stock]of [['mcx_spear',800,650000,'att_muzzle11','sr25_pattern',true],['rm277',700,390000,'att_muzzle12','rm277',false]]){
 const w=W[gun];ok(w.rpm===rpm&&w.price===price&&w.mag===20&&w.ammo==='ammo_68x51_4','gun spec');
 ok(w.modes.join(',')==='semi,auto'&&w.attachmentSlots.stock===stock,'modes and stock');
 ok(E.gun(gun,20).stack===1,'single cell item');
 for(const optic of Object.keys(D).filter(id=>id.startsWith('att_optic')))ok(A.compatible(gun,optic),'existing optic '+optic);
 ok(A.compatible(gun,muzzle)&&!A.compatible(gun,muzzle==='att_muzzle11'?'att_muzzle12':'att_muzzle11'),'exclusive interface');
 for(const oldGun of Object.keys(W).filter(id=>!['mcx_spear','rm277'].includes(id)))ok(!A.compatible(oldGun,muzzle),'no old gun fits exclusive muzzle');
 for(const id of ['att_muzzle01','att_muzzle09','att_muzzle10'])ok(A.compatible(gun,id),'universal rifle muzzle remains compatible');
 const x=A.resolve(gun,{muzzle});near(x.noiseRadius,muzzle==='att_muzzle11'?.32:.4);near(x.rpm,rpm);
 for(const kind of ['competition','polymer','25']){
  const id='att_mag_68x51_'+family+'_'+kind;ok(A.compatible(gun,id),'own magazine fits');
  const x=A.resolve(gun,{magazine:id});ok(x.mag===(kind==='25'?25:20),'fixed/original capacity');
  ok(!A.compatible(gun,'att_mag_68x51_'+(family==='rm277'?'sr25_pattern':'rm277')+'_'+kind),'same caliber wrong interface refuses');
  const future={...w,id:'future762',caliber:'762x51'};ok(A.compatible(future,id),'matching interface supports planned 7.62x51');
  ok(!A.compatible({...future,caliber:'556'},id),'unlisted caliber refuses even with interface');
 }
 S.gear.weapons=[E.gun(gun,20,'ammo_68x51_4'),null,null];S.bag=[];G.startRun(null);G.enemies=[];G.action=null;G.lootOpen=null;G.bagOpen=false;
 const p=G.player;p.meleeActive=false;p.fireCd=0;p.updateAimPoint(p.x+200,p.y);ok(p.tryShoot(),'actual shot');near(G.bullets.at(-1).dmg,47);ok(p.mag===19,'round consumed');
 p.bag.add(Ammo.find(a=>a.id==='ammo_68x51_5'),30);p.weapon.ammo='ammo_68x51_5';p.weapon.rounds=[];p.mag=p.weapon.magCur=0;
 p.tryReload();for(let i=0;i<400;i++)p.update(.01,{mx:0,my:0,sneak:false,sprint:false,dodge:false,aimAngle:0});ok(p.mag===20&&p.weapon.rounds.every(id=>id==='ammo_68x51_5'),'actual Hybrid reload');
 S.gear.weapons=[E.gun(gun,25,'ammo_68x51_4',[...Array(20).fill('ammo_68x51_4'),...Array(5).fill('ammo_68x51_5')],{attachments:{magazine:'att_mag_68x51_'+family+'_25'}}),null,null];
 S.stash=[];G.state='base';const t=A.targets().find(t=>t.owner==='base-equipped'),result=A.commit(t,'magazine',null);ok(result.ok&&result.gun.equip.mag===20,'shrink to 20');ok(S.stashCount('ammo_68x51_5')===5,'typed surplus returned');
 S.save();S.flush();S.load();ok(S.gear.weapons[0].equip.gun===gun&&S.gear.weapons[0].equip.mag===20&&S.stashCount('ammo_68x51_5')===5,'new gun and ammo survive save');
 // Actual player/NPC shot paths use the exclusive suppressor's acoustic factor.
 const acoustic=vm.runInContext(`(()=>{const previous=Noise.emit,seen=[];Noise.emit=(x,y,r,type)=>{if(type==='shot')seen.push(r);};try{
 M.load(Array(45).fill('.'.repeat(50)),null,[],null);Game.state='playing';Game.action=null;Game.lootOpen=null;Game.bagOpen=false;
 const p=Game.player;p.fillWeapons([EQUIP.gun('${gun}',20,null,null,{attachments:{muzzle:'${muzzle}'}})]);p.fireCd=0;p.reloadT=0;p.dodgeT=0;p.meleeActive=false;p.tryShoot();
 const enemy=new Enemy('scav',550,500,0,{facing:'e'});enemy.weaponId='${gun}';enemy.gearLv=4;enemy.gun=Attachments.resolve('${gun}',{muzzle:'${muzzle}'});enemy.ai.mag=20;enemy.ai.fireCd=0;HumanAI.shot(enemy,0);return seen;
 }finally{Noise.emit=previous;}})()`,c);
 near(acoustic[0],CFG.NOISE.shoot*x.noiseRadius);near(acoustic[1],CFG.NOISE.shoot*.8*x.noiseRadius);
}
S.stash=[];S.credits=2000000;G.state='base';ok(c.Base.buyGun('rm277'),'RM277 sold');ok(!c.Base.buyGun('mcx_spear'),'SPEAR not sold');
ok(c.Base.buyAmmo('ammo_68x51_4',60),'FMJ sold');ok(!c.Base.buyAmmo('ammo_68x51_5',1),'Hybrid not sold');
const seen=new Set();for(let i=0;i<12000;i++){const drop=L.rollAmmo('secret',vm.runInContext('AMMO_POOL',c));ok(!!drop.item,'loot never emits a missing grade');if(drop.item.caliber==='68x51')seen.add(drop.item.id);}
ok(seen.size===2,'both grades reachable in rare loot');
const ground=Ground.candidates('ammo');ok(ground.some(a=>a.id==='ammo_68x51_4')&&ground.some(a=>a.id==='ammo_68x51_5'),'ground pools include actual ammo');
console.log('PASS: '+checks+' 6.8x51 data, interfaces, future caliber, live fire/reload, mixed surplus, persistence, sales and sparse-grade loot checks');
