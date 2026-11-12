/* Mixed magazines, atomic unloading and save compatibility. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const harness=fs.readFileSync(path.join(root,'run-test.js'),'utf8').split('let pass = 0')[0];
const c=new Function('require','__dirname',harness+'\nreturn ctx;')(require,root);
const {Game,Save,CFG}=c;
const {EQUIP,BACKPACK,ITEM_BY_ID}=vm.runInContext('({EQUIP,BACKPACK,ITEM_BY_ID})',c);
Game.init();
function fresh(rounds=[]){
  Save.gear.back=BACKPACK.make('bag05'); Save.bag=[];
  Save.gear.weapons=[EQUIP.gun('rifle',rounds.length,'ammo_556_1',rounds),null,EQUIP.gun('pistol',0)];
  Game.startRun(null); Game.enemies=[]; Game.bullets=[];
  Game.player.bag.slots=[]; return Game.player;
}
function reload(p){assert(p.tryReload());p.reloadT=0;p.finishReloadIfDone();}
let p=fresh();p.bag.addAmmo('ammo_556_1',4);p.bag.addAmmo('ammo_556_3',8);p.bag.addAmmo('ammo_9mm_5',50);
reload(p);assert.equal(p.mag,12);assert.equal(p.weapon.rounds.join(','),[...Array(4).fill('ammo_556_1'),...Array(8).fill('ammo_556_3')].join(','));
for(let n=0;n<4;n++){p.fireCd=0;assert(p.tryShoot());assert.equal(Game.bullets.at(-1).pen,c.BALLISTICS.flesh('556',1).P);}
assert.equal(p.ammoId,'ammo_556_3');
assert(p.unloadWeapon());assert.equal(p.mag,0);assert.equal(p.bag.ammoCount('ammo_556_3'),8);
assert(p.unloadWeapon());assert.equal(p.bag.ammoCount('ammo_556_3'),8);
console.log('OK: mixed reload, caliber isolation, firing order, exact unload and repeated unload');
p=fresh(['ammo_556_1','ammo_556_5']);
p.bag.slots=Array.from({length:c.bagSlots()-1},()=>({item:ITEM_BY_ID.life01,n:1}));
const before=JSON.stringify(p.bag.slots);assert.equal(p.unloadWeapon(),false);assert.equal(JSON.stringify(p.bag.slots),before);assert.equal(p.mag,2);
assert.equal(p.loadAmmo('ammo_556_3'),false);assert.equal(p.weapon.ammo,'ammo_556_1');
console.log('OK: multi-type return rolls back entirely when a later stack cannot fit');
p=fresh(['ammo_556_1','ammo_556_4']);p.bag.addAmmo('ammo_556_3',10);
assert(p.loadAmmo('ammo_556_3'));assert.equal(p.mag,0);assert(p.reloadPending);p.reloadT=0;p.finishReloadIfDone();
assert.equal(p.weapon.rounds[0],'ammo_556_3');assert.equal(p.weapon.rounds.at(-1),'ammo_556_4');
Game.syncGear();Save.save();const rounds=JSON.stringify(Save.gear.weapons[0].equip.rounds);Save.load();
assert.equal(JSON.stringify(Save.gear.weapons[0].equip.rounds),rounds);p.fillWeapons(Save.gear.weapons);assert.equal(JSON.stringify(p.weapon.rounds),rounds);
assert.equal(EQUIP.gun('rifle',3,'ammo_556_4').equip.rounds.join(','),Array(3).fill('ammo_556_4').join(','));
console.log('OK: selection unloads/reloads, preserves mixed order across save and old-magazine migration');
p=fresh();p.bag.addAmmo('ammo_556_1',20);assert(p.tryReload());p.switchWeapon(2);p.reloadT=0;p.finishReloadIfDone();assert.equal(p.mag,0);assert.equal(p.bag.ammoCount('ammo_556_1'),20);
console.log('OK: switching weapon cancels pending reload without consuming ammunition');
