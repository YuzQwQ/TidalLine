const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),h=fs.readFileSync(path.join(root,'run-test.js'),'utf8').split('let pass = 0')[0];
const c=new Function('require','__dirname',h+'\nreturn ctx;')(require,root);
const {Game,Save,CFG,Base,GEAR}=c;
const {EQUIP,BACKPACK,ITEM_BY_ID}=vm.runInContext('({EQUIP,BACKPACK,ITEM_BY_ID})',c);
Game.init();
function equip(){
  Save.hp=100;Save.bag=[];Save.stash=[];Save.gear={weapons:[EQUIP.gun('rifle',11),EQUIP.gun('shotgun',3),EQUIP.gun('pistol',4)],helmet:GEAR.make('helmet',3),body:GEAR.make('body',4),back:BACKPACK.make('bag04'),melee:EQUIP.melee('melee02',true)};
  Save.meleeGiftClaimed=true;Game.startRun(null);Game.enemies=[];
  Game.player.bag.slots=[{item:ITEM_BY_ID.life01,n:1},{item:EQUIP.gun('smg',2),n:1}];
  Game.player.bag.safe=[{item:EQUIP.armor(GEAR.make('helmet',2)),n:1},{item:ITEM_BY_ID.antiq03,n:1}];
}
function lost(){assert(Save.gear.weapons.every(w=>w===null));assert.equal(Save.gear.helmet,null);assert.equal(Save.gear.body,null);assert.equal(Save.gear.back,null);assert.equal(Save.gear.melee.equip.melee,'melee02');assert(Save.gear.melee.equip.bound);}
equip();Game.player.hp=0;Game.player.dead=true;Game.beginDying();lost();
assert.equal(Game.player._equipmentLoss.length,6);Save.load();lost();Base.open();lost();
console.log('OK: death immediately persists loss of six equipped items, refresh/base cannot refund guns');
Game.showEnd(false);lost();assert.equal(Save.hp,1);assert.equal(Game._end.lost.filter(e=>e.name.includes('已装备')).length,6);
assert(!Save.stash.some(e=>e.gear?.equip?.gun==='smg'));assert(Save.stash.some(e=>e.gear?.equip?.gear?.lv===2));assert(Save.stash.some(e=>e.id==='antiq03'));
console.log('OK: settlement lists worn gear losses; carried gear lost, safe gear and collectibles retained');
Game.startRun(null);assert(Game.player.weapons.every(w=>w===null));assert(Game.player.meleeActive);assert.equal(Game.player.melee.equip.melee,'melee02');
console.log('OK: melee-only redeployment neither creates a pistol nor a phantom loaded weapon');
equip();Game.doExtract();assert(Save.gear.weapons[0]);assert(Save.gear.helmet);assert(Save.gear.body);assert(Save.gear.back);
console.log('OK: successful extraction preserves equipment');
equip();Game.showEnd(false,'行动时间已结束');lost();assert.equal(Game._end.lost.filter(e=>e.name.includes('已装备')).length,6);
console.log('OK: other failed runs use the same equipment penalty');
Save.gear.melee=null;Save.gear.weapons=[null,null,null];Save.flush();Game.startRun(null);assert(!Game.player.meleeActive);assert.equal(Game.player.tryShoot(),false);assert.equal(Game.player.tryReload(),false);assert.equal(Game.player.mag,0);
console.log('OK: no-weapon debug entry cannot fire or reload an imaginary rifle');
