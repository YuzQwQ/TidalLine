const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{pathToFileURL}=require('url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'assets/source/doors-batch-02');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true}),results=[];
  try{for(const entry of ['index.html','潮汐线.html']){
    const p=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.goto(pathToFileURL(path.join(root,entry)).href+'#doors-test');await p.waitForFunction(()=>typeof DoorTest!=='undefined'&&document.querySelector('[data-door-mode]'));
    const storage=await p.evaluate(()=>JSON.stringify(localStorage));
    const mode=async name=>p.locator('[data-door-mode="'+name+'"]').click();
    const point=async(x,y)=>p.evaluate(([x,y])=>{const r=Game.canvas.getBoundingClientRect();return{x:r.left+(M.cx(x)-Math.round(Game.cam.x))*r.width/CFG.VIEW_W,y:r.top+(M.cy(y)-Math.round(Game.cam.y))*r.height/CFG.VIEW_H};},[x,y]);
    const click=async(x,y,button='left')=>{const a=await point(x,y);await p.mouse.click(a.x,a.y,{button});};
    const drag=async(x,y,xx,yy)=>{const a=await point(x,y),b=await point(xx,yy);await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(b.x,b.y,{steps:2});await p.mouse.up();};
    await mode('wall');const ammo=await p.evaluate(()=>Game.player.mag);await drag(4,11,8,11);
    assert(await p.evaluate(()=>[4,5,6,7,8].every(x=>M.wallCell(M.at(x,11)))),'wall stroke left holes');
    assert(await p.evaluate(()=>!Game.input.mouseDown&&!Game.input.mousePressed&&!Game.input.dodgePressed),'builder leaked combat input');
    assert.equal(await p.evaluate(()=>Game.player.mag),ammo);
    await p.locator('[data-door-undo]').click();assert(await p.evaluate(()=>[4,5,6,7,8].every(x=>!M.at(x,11).solid)));
    await p.locator('[data-door-redo]').click();assert(await p.evaluate(()=>[4,5,6,7,8].every(x=>M.at(x,11).solid)));
    await p.locator('[data-door-width]').selectOption('2');await p.locator('[data-door-type]').selectOption('barricade');await p.locator('[data-door-side]').selectOption('second');await mode('door');await click(5,11);
    assert(await p.evaluate(()=>{const d=M.at(5,11).door;return d&&d===M.at(6,11).door&&d.axis==='horizontal'&&d.kickFrom==='s'&&!M.walkable(5,11)&&M.blocksShot(6,11);}), 'double door state/collision');
    await click(5,11,'right');assert(await p.evaluate(()=>!M.at(5,11).door&&!M.at(6,11).door&&M.walkable(5,11)),'right erase must remove whole double door');
    await p.locator('[data-door-undo]').click();assert(await p.evaluate(()=>M.at(5,11).door===M.at(6,11).door&&!!M.at(5,11).door));
    await mode('wall');await drag(12,9,12,13);await mode('door');await p.locator('[data-door-type]').selectOption('locked');await p.locator('[data-door-key-id]').fill('custom_room_key');await click(12,10);
    assert(await p.evaluate(()=>{const d=M.at(12,10).door;return d&&d===M.at(12,11).door&&d.axis==='vertical'&&d.keyId==='custom_room_key';}),'automatic vertical door');
    const count=await p.evaluate(()=>M.doors.length);await click(14,11);assert.equal(await p.evaluate(()=>M.doors.length),count,'door allowed on floor');
    await p.evaluate(()=>{Game.player.bag.slots=[];Game.player.bag.safe=[];Game.player.x=M.cx(13);Game.player.y=M.cy(10);Game.updateCamera(true);});
    await p.locator('[data-door-wrong]').click();await mode('play');await p.keyboard.press('e');await p.waitForTimeout(60);assert.equal(await p.evaluate(()=>M.at(12,10).door.open),false);
    /* 钥匙房开锁现在是 1.5s 读条：按 E 只起手，读满才解锁并扣耐久。 */
    await p.locator('[data-door-key]').click();await p.keyboard.press('e');
    await p.waitForFunction(()=>Game.action?.type==='unlock');
    assert(await p.evaluate(()=>!M.at(12,10).door.open&&!M.at(12,10).door.unlocked&&Game.player.bag.slots.some(e=>e.item?.id==='custom_room_key')),'读条起手不能开门或扣耐久');
    await p.evaluate(()=>Game.updateAction(Game.action.total+0.1));
    assert(await p.evaluate(()=>M.at(12,10).door.open&&M.at(12,10).door.unlocked),JSON.stringify(await p.evaluate(()=>({door:M.at(12,10).door,bag:Game.player.bag.slots,pos:[Game.player.x,Game.player.y],mode:DoorTest.mode,state:Game.state,key:Game.input.interactPressed,candidates:Game.findInteractables().map(i=>({type:i.type,x:i.obj.x,y:i.obj.y})),action:Game.action,toasts:Game.toasts}))));
    await mode('wall');await click(13,10);assert.equal(await p.evaluate(()=>M.at(13,10).solid),false,'paint trapped player');
    await p.locator('[data-door-states]').click();assert(await p.evaluate(()=>!M.at(12,10).door.open&&!M.at(12,10).door.unlocked&&M.at(4,11).solid),'reset lost custom layout');
    await p.locator('[data-door-undo]').click();assert.equal(await p.evaluate(()=>M.at(12,10).door.open),true);
    await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>DoorTest.mode),'play');
    assert.equal(await p.evaluate(()=>JSON.stringify(localStorage)),storage,'builder wrote player storage');
    await mode('door');const a=await point(12,12);await p.mouse.move(a.x,a.y);await p.screenshot({path:path.join(folder,entry==='index.html'?'builder.png':'offline-builder.png')});
    await p.locator('[data-door-reset]').click();assert.equal(await p.evaluate(()=>M.doors.length),7);assert.equal(await p.evaluate(()=>DoorTest.undoStack.length),0);
    assert.deepEqual(errors,[]);results.push({entry,dragWall:true,strokeUndoRedo:true,doubleDoor:true,wholeDoorErase:true,automaticAxes:true,customKeyInteraction:true,playerProtected:true,resetPreservesLayout:true,isolatedStorage:true,errors});await p.close();
  }}finally{await browser.close();}
  fs.writeFileSync(path.join(folder,'builder-verification.json'),JSON.stringify({passed:true,results},null,2)+'\n');console.log('PASS: wall strokes, undo/redo, double doors, erase, axes, custom keys, collision, input and save isolation; development/offline');
})().catch(e=>{console.error(e);process.exitCode=1;});
