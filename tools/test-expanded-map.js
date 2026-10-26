/* 单文件游戏的扩建地图验证与实机区域截图；需要 playwright + Edge。 */
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const root = path.resolve(__dirname,'..');
const output = path.join(root,'output/map');
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(pathToFileURL(path.join(root,'潮汐线.html')).href+'#play');
    await page.waitForFunction(()=>Game.player && ART.props.every(id=>Art.get('props',id)));
    const result=await page.evaluate(()=>{
      Game.state='ended';
      Game.startRun(); Game.state='ended';
      const sp=M.playerSpawn;
      const spawnOK=Game.enemies.every(enemy=>canStand(enemy.x,enemy.y,enemy.r));
      Game.state='playing';
      const begin=performance.now();
      for(let i=0;i<600;i++) { Game.update(1/60); if(i%6===0) Game.render(); }
      const elapsed=performance.now()-begin;
      Game.state='ended';
      return {width:M.W,height:M.H,boxes:Game.boxes.length,enemies:SPAWNS.length,spawnOK,
        stillSafe:!Game.player.dead,playerStand:canStand(Game.player.x,Game.player.y,Game.player.r),
        livingEnemiesStand:Game.enemies.filter(enemy=>!enemy.dead).every(enemy=>canStand(enemy.x,enemy.y,enemy.r)),
        escapePaths:M.extracts.every(ex=>M.findPath(sp.x,sp.y,ex.x,ex.y)),simulationMs:Math.round(elapsed)};
    });
    assert.equal(result.width,64);assert.equal(result.height,44);
    assert.equal(result.boxes,41);assert.equal(result.enemies,24);
    assert(result.spawnOK && result.playerStand && result.livingEnemiesStand,'角色必须位于合法站立位置');
    assert(result.stillSafe,'出生缓冲区应提供准备时间');assert(result.escapePaths);
    for(const [name,x,y] of [['shelter',10,38],['market',32,9],['archive',52,9],['pump',32,25],['lab',53,25],['dock',53,37]]) {
      await page.evaluate(({x,y})=>{
        Game.startRun();Game.state='ended';
        M.visible.fill(1);M.seen.fill(1);M.tideLevel=0;
        Game.cam.x=U.clamp(M.cx(x)-CFG.VIEW_W/2,0,M.W*CFG.TILE-CFG.VIEW_W);
        Game.cam.y=U.clamp(M.cy(y)-CFG.VIEW_H/2,0,M.H*CFG.TILE-CFG.VIEW_H);
        Game.render();
      },{x,y});
      await page.locator('#frame').screenshot({path:path.join(output,'game-'+name+'.png')});
    }
    // 潮水封港后，堤顶路仍连通三个撤离点。
    assert(await page.evaluate(()=>{
      M.tideLevel=3;const sp=M.playerSpawn;
      return M.extracts.every(ex=>M.findPath(sp.x,sp.y,ex.x,ex.y)) && !M.walkable(52,37);
    }));
    assert.deepEqual(errors,[]);
    console.log('OK: 单文件地图与贴图、全部敌人合法出生、10 秒真实更新、出生缓冲、角色碰撞、跨区寻路、涨潮撤离、6 个街区截图');
    console.log(JSON.stringify(result));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
