/* Two finite-ammunition human profiles. Legacy enemies retain their own update path. */
const HUMAN_UNIT_DEFS = {
  holdout: {name:'据点看守',short:'看',color:'#b8a26b',hp:48,speed:42,sight:10,fov:110*Math.PI/180,hear:1,
    dmg:4,range:6*CFG.TILE,cd:1.5,faction:'scav',human:true,arrow:true,tactical:true,
    weapon:'shotgun',levels:[[2,80],[3,20]],helmetChance:.65,bodyChance:.85,mag:6,reserve:12,reload:3,aim:.65,
    warning:1,guardRadius:3,leash:8,chaseLimit:6,quietReset:10,pump:.4,search:8,
    desc:'守着楼院和物资的人。工装、旧头盔和短霰弹枪，足够让陌生人在门口停一停。'},
  retriever: {name:'受雇回收员',short:'回',color:'#7c9684',hp:60,speed:50,sight:13,fov:110*Math.PI/180,hear:1,
    dmg:10,range:11*CFG.TILE,cd:1.6,faction:'scav',human:true,arrow:true,tactical:true,
    weapon:'rifle',levels:[[3,80],[4,20]],helmetChance:.9,bodyChance:1,mag:30,reserve:30,reload:2.6,aim:.55,
    burst:3,burstGap:.16,search:8,radioRange:10,radioGap:1,rolePeriod:6,coverRadius:6,coverPath:8,
    desc:'带着回收清单进入环礁湾的专业人员。先确认目标，再决定带走多少别的东西。'}
};
const HUMAN_ANIMS={walk:{frames:4,fps:8,loop:true,size:64},aim:{frames:2,size:64},shoot:{frames:2,size:64},reload:{frames:3,size:64},pump:{frames:2,size:64}};
Object.assign(ENEMY_TYPES,HUMAN_UNIT_DEFS);
ART.chars.push('holdout','retriever');ART.props.push('corpse_holdout','corpse_retriever');
CFG.CORPSE_BAG.factions.push('holdout','retriever');

const HumanAI={
  sequence:0,
  init(e,spawn={}){
    const d=e.t;let roll=Math.random()*d.levels.reduce((n,x)=>n+x[1],0),lv=d.levels[0][0];
    for(const [candidate,weight]of d.levels){roll-=weight;if(roll<=0){lv=candidate;break;}}
    // Select once: armor and every round share one equipment tier.
    e.gearLv=lv||d.levels[0][0];
    e.helmet=Math.random()<d.helmetChance?GEAR.random('helmet',e.gearLv):null;
    e.body=Math.random()<d.bodyChance?GEAR.random('body',e.gearLv):null;
    for(const g of [e.helmet,e.body])if(g)g.dur=g.max*U.rand(.6,.9);
    e.weaponId=d.weapon;e.ammoId=BALLISTICS.ammoId(WEAPONS[d.weapon].caliber,e.gearLv);e.penLevel=e.gearLv;
    e.spawnId=String(spawn.id||('human-'+(++this.sequence)));
    e.squadId=e.key==='retriever'?String(spawn.squadId||'').trim():'';
    e.angle=({s:Math.PI/2,n:-Math.PI/2,e:0,w:Math.PI})[spawn.facing||'s']??Math.PI/2;
    const anchor=spawn.guardAnchor||[M.tx(e.homeX),M.ty(e.homeY)];
    const p=M.navigationPoint(anchor[0],anchor[1]);
    e.ai={clock:0,mag:d.mag,reserve:d.reserve,shots:0,cd:0,phase:null,phaseT:0,phaseTotal:0,
      memory:null,engaged:false,warningStart:null,lastContact:-Infinity,lastRadio:-Infinity,lastPlan:-Infinity,
      guardX:p.x,guardY:p.y,returning:false,holdHome:false,pursuit:0,aimed:false,burstLeft:0,
      fireFlash:0,notice:'',noticeUntil:0,repath:0,retaliateUntil:0};
    e.anim={state:'idle',time:0,progress:0};
  },
  notice(e,text,seconds=1.4){e.ai.notice=text;e.ai.noticeUntil=e.ai.clock+seconds;},
  // Geometry is sampled in world coordinates, including north-projecting half-walls.
  clear(x,y,tx,ty,shots=false){
    const n=Math.max(1,Math.ceil(U.dist(x,y,tx,ty)/2));
    for(let i=1;i<=n;i++){
      const px=x+(tx-x)*i/n,py=y+(ty-y)*i/n,cx=M.tx(px),cy=M.ty(py),t=M.at(cx,cy);
      if(!t||M.wallAtPoint(px,py))return false;
      if(shots?M.blocksShot(cx,cy,px,py):(t.opaque||(t.door&&!t.door.open)||(t.prop&&!t.prop.ground&&t.prop.opaque!==false)))return false;
    }
    return true;
  },
  sees(e,o){
    if(!o||o.dead)return false;const d=U.dist(e.x,e.y,o.x,o.y);
    if(d>e.t.sight*CFG.TILE*e.senseMult())return false;
    if(d>2*CFG.TILE&&Math.abs(U.angDiff(Math.atan2(o.y-e.y,o.x-e.x),e.angle))>e.t.fov/2)return false;
    return this.clear(e.x,e.y,o.x,o.y);
  },
  observe(e){
    const p=Game.player;if(this.sees(e,p))return{x:p.x,y:p.y,kind:'player'};
    let best=null,dist=Infinity;
    for(const o of Game.enemies){if(o===e||o.dead||o.t.faction===e.t.faction)continue;const dd=U.dist(e.x,e.y,o.x,o.y);if(dd<dist&&this.sees(e,o)){dist=dd;best={x:o.x,y:o.y,kind:'enemy',ref:o};}}
    return best;
  },
  remember(e,p){e.ai.memory={...p,time:e.ai.clock};e.ai.lastContact=e.ai.clock;},
  teammates(e){return e.squadId?Game.enemies.filter(o=>o!==e&&!o.dead&&o.key==='retriever'&&o.squadId===e.squadId).sort((a,b)=>a.spawnId.localeCompare(b.spawnId)).slice(0,1):[];},
  radio(e,obs){
    const a=e.ai,d=e.t;if(!obs||!e.squadId||a.clock-a.lastRadio<d.radioGap)return;
    a.lastRadio=a.clock;
    for(const o of this.teammates(e))if(U.dist(e.x,e.y,o.x,o.y)<=d.radioRange*CFG.TILE){
      // Snapshot only; recipients must make their own visual observation before shooting.
      this.remember(o,obs);o.ai.engaged=true;this.notice(o,'收到，查看最后位置。');
    }
  },
  hurt(e,from){
    const a=e.ai;if(!a)return;
    a.engaged=true;a.lastContact=a.clock;a.retaliateUntil=a.clock+2;
    const obs=this.observe(e);if(obs)this.remember(e,obs);
    else if(!a.memory)a.memory={x:e.x,y:e.y,time:a.clock,kind:from==='player'?'player':'enemy'};
    // Do not clear phases/cooldowns: ordinary damage does not stun or grant faster attacks.
  },
  phase(e,name,duration){const a=e.ai;a.phase=name;a.phaseT=duration;a.phaseTotal=duration;},
  animate(e,dt,moved){
    const a=e.ai;let state='idle',progress=0;
    if(a.fireFlash>0){state='shoot';progress=1-a.fireFlash/.12;}
    else if(['aim','reload','pump'].includes(a.phase)){state=a.phase;progress=1-a.phaseT/a.phaseTotal;}
    else if(moved>.01)state='walk';
    if(e.anim.state!==state){e.anim.state=state;e.anim.time=0;}else e.anim.time+=dt;
    e.anim.progress=U.clamp(progress,0,1);
  },
  move(e,p,dt,speed=e.t.speed){
    if(!p)return false;const a=e.ai;a.repath-=dt;
    if(!e.path||a.repath<=0){a.repath=.65;e.setPathTo(M.tx(p.x),M.ty(p.y));}
    return e.moveAlongPath(dt,speed); // no straight-line fallback through blocked geometry
  },
  patrol(e,dt){
    const a=e.ai;e.state='patrol';
    if(e.path&&e.pathI<e.path.length)return e.moveAlongPath(dt,e.t.speed*.55);
    e.patrolCd-=dt;if(e.patrolCd>0){e.angle+=dt*.25;return;}
    e.patrolCd=2;const x=M.tx(e.homeX)+U.randInt(-e.patrolRadius,e.patrolRadius),y=M.ty(e.homeY)+U.randInt(-e.patrolRadius,e.patrolRadius);
    if(M.walkable(x,y)){const p=M.navigationPoint(x,y);if(canStand(p.x,p.y,e.r))e.setPathTo(x,y);}
  },
  // One bounded BFS generates paths for all candidates; no per-candidate A* or map-wide search.
  cover(e,target,flank){
    const a=e.ai,d=e.t;if(a.clock-a.lastPlan<1)return null;a.lastPlan=a.clock;
    if(this.planTime!==Game.time){this.planTime=Game.time;this.plansThisFrame=0;}
    if(this.plansThisFrame>=2)return null;this.plansThisFrame++;
    const sx=M.tx(e.x),sy=M.ty(e.y),nodes=[{x:sx,y:sy,path:[]}],visited=new Set([sx+','+sy]),choices=[];
    const originAngle=Math.atan2(e.y-target.y,e.x-target.x);
    for(let i=0;i<nodes.length;i++){
      const n=nodes[i],p=M.navigationPoint(n.x,n.y),distance=U.dist(p.x,p.y,target.x,target.y)/CFG.TILE;
      if(n.path.length>0&&distance>=6&&distance<=9&&this.clear(p.x,p.y,target.x,target.y,true)){
        const cover=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>!M.walkable(n.x+dx,n.y+dy));
        const angle=Math.abs(U.angDiff(Math.atan2(p.y-target.y,p.x-target.x),originAngle));
        if(!flank||angle>=Math.PI/9)choices.push({...n,cover,angle});
      }
      if(n.path.length>=d.coverPath)continue;
      for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
        const x=n.x+dx,y=n.y+dy,k=x+','+y;if(visited.has(k)||Math.hypot(x-sx,y-sy)>d.coverRadius||!M.walkable(x,y))continue;
        const p2=M.navigationPoint(x,y);if(!canStand(p2.x,p2.y,e.r))continue;
        if(!this.walkSegment(p.x,p.y,p2.x,p2.y,e.r))continue;
        visited.add(k);nodes.push({x,y,path:[...n.path,{x,y}]});
      }
    }
    choices.sort((a,b)=>Number(b.cover)-Number(a.cover)||a.path.length-b.path.length||b.angle-a.angle||a.y-b.y||a.x-b.x);
    a.coverNodes=nodes.length;return choices[0]||null;
  },
  walkSegment(x,y,tx,ty,r){const n=Math.max(1,Math.ceil(U.dist(x,y,tx,ty)/3));for(let i=1;i<=n;i++)if(!canStand(x+(tx-x)*i/n,y+(ty-y)*i/n,r))return false;return true;},
  shot(e,angle){
    const a=e.ai,d=e.t,w=WEAPONS[e.weaponId];if(a.mag<=0)return false;
    const mx=e.x+Math.cos(angle)*12,my=e.y+Math.sin(angle)*12;
    if(!this.clear(e.x,e.y,mx,my,true))return false;
    const ammo=ammoItem(w.caliber,e.gearLv);const mul=ammo?.dmgMul??1;
    for(let i=0;i<(w.pellets||1);i++){
      const ang=angle+U.rand(-w.spreadBase,w.spreadBase);
      Game.bullets.push(new Bullet(mx,my,ang,w.speed,e.t.faction,d.dmg*mul,w.range,e.penLevel));
    }
    a.mag--;a.shots++;a.fireFlash=.12;
    Noise.emit(e.x,e.y,CFG.NOISE.shoot*.8,'shot');Game.sfx(e.key==='holdout'?'shot_shotgun':'shot_rifle');
    return true;
  },
  canShoot(e,obs){return !!obs&&U.dist(e.x,e.y,obs.x,obs.y)<=e.t.range&&this.clear(e.x,e.y,obs.x,obs.y,true);},
  finishBurst(e){const a=e.ai;a.phase=null;a.burstLeft=0;a.cd=Math.max(a.cd,e.t.cd);},
  advancePhase(e,dt,obs){
    const a=e.ai,d=e.t;if(!a.phase)return false;
    if(a.phase==='reload'){
      a.phaseT-=dt;if(a.phaseT<=1e-9){const n=Math.min(d.mag-a.mag,a.reserve);a.mag+=n;a.reserve-=n;a.phase=null;a.aimed=false;}
      return true;
    }
    if(a.phase==='pump'){a.phaseT-=dt;if(a.phaseT<=1e-9)a.phase=null;return true;}
    if(!this.canShoot(e,obs)){
      if(a.phase==='burst')this.finishBurst(e);else a.phase=null;
      a.aimed=false;return false;
    }
    if(a.phase==='aim'){
      e.angle=Math.atan2(obs.y-e.y,obs.x-e.x);a.phaseT-=dt;
      if(a.phaseT<=1e-9){
        a.aimed=true;a.shotAngle=e.angle;
        if(e.key==='holdout'){
          if(this.shot(e,e.angle)){a.cd=d.cd;this.phase(e,'pump',d.pump);}else{a.phase=null;a.aimed=false;a.cd=.2;}
        }else{
          a.phase='burst';a.burstLeft=d.burst;
          if(this.shot(e,a.shotAngle))a.burstLeft--;else{this.finishBurst(e);return true;}
          a.phaseT=d.burstGap;if(a.burstLeft<=0||a.mag<=0)this.finishBurst(e);
        }
      }
      return true;
    }
    if(a.phase==='burst'){
      a.phaseT-=dt;
      if(a.phaseT<=1e-9){
        if(this.shot(e,a.shotAngle))a.burstLeft--;else a.burstLeft=0;
        if(a.burstLeft<=0||a.mag<=0)this.finishBurst(e);else a.phaseT=d.burstGap;
      }
      return true; // at most one shot per update, never catch up in a low-FPS frame
    }
    return false;
  },
  attack(e,obs){
    const a=e.ai;if(a.cd>1e-9||!this.canShoot(e,obs))return;
    e.path=null;e.angle=Math.atan2(obs.y-e.y,obs.x-e.x);
    if(e.key==='holdout'&&a.aimed){if(this.shot(e,e.angle)){a.cd=e.t.cd;this.phase(e,'pump',e.t.pump);}else a.aimed=false;}
    else this.phase(e,'aim',e.t.aim);
  },
  update(e,dt){
    if(e.dead){if(e.ai){e.ai.phase=null;e.ai.burstLeft=0;}return;}
    const a=e.ai,d=e.t,x0=e.x,y0=e.y;
    a.clock+=dt;a.cd=Math.max(0,a.cd-dt);a.fireFlash=Math.max(0,a.fireFlash-dt);e.atkCd=a.cd;e.hurtFlash=Math.max(0,e.hurtFlash-dt);
    const obs=this.observe(e),heard=e.hearNoises(dt);
    if(obs){this.remember(e,obs);if(e.key==='retriever'){a.engaged=true;this.radio(e,obs);}}
    if(!obs)a.aimed=false;
    if(a.memory&&a.clock-a.memory.time>d.search)a.memory=null;
    const done=()=>this.animate(e,dt,U.dist(x0,y0,e.x,e.y));
    if(this.advancePhase(e,dt,obs)){done();return;}
    if(a.mag===0&&a.reserve>0){this.phase(e,'reload',d.reload);this.notice(e,'换弹中',d.reload);done();return;}
    const exhausted=a.mag===0&&a.reserve===0;
    if(e.key==='holdout'){
      if(!a.engaged&&a.warningStart!==null&&a.clock-a.lastContact>=d.quietReset&&U.dist(e.x,e.y,e.homeX,e.homeY)<=Math.max(1,e.patrolRadius)*CFG.TILE){a.warningStart=null;a.memory=null;a.pursuit=0;}
      if(a.engaged&&!a.returning&&!a.holdHome)a.pursuit+=dt;
      if(a.engaged&&(U.dist(e.x,e.y,e.homeX,e.homeY)>d.leash*CFG.TILE||a.pursuit>=d.chaseLimit)){a.returning=true;a.holdHome=true;a.aimed=false;}
      if(exhausted||a.returning||a.holdHome){
        e.state=exhausted?'exhausted':'return';
        if(!exhausted&&obs&&(a.clock<a.retaliateUntil||U.dist(obs.x,obs.y,a.guardX,a.guardY)<=d.guardRadius*CFG.TILE))this.attack(e,obs);
        if(!a.phase)this.move(e,{x:e.homeX,y:e.homeY},dt);
        if(U.dist(e.x,e.y,e.homeX,e.homeY)<8){
          a.returning=false;
          if(!exhausted&&a.clock-a.lastContact>=d.quietReset){a.holdHome=false;a.engaged=false;a.pursuit=0;a.warningStart=null;a.memory=null;e.path=null;}
        }
        done();return;
      }
      if(obs&&!a.engaged){
        if(obs.kind!=='player')a.engaged=true;
        else{
          e.state='warning';e.path=null;e.angle=Math.atan2(obs.y-e.y,obs.x-e.x);
          if(a.warningStart===null){a.warningStart=a.clock;this.notice(e,'门口的人，退远点。',2);}
          if(a.clock-a.warningStart>=d.warning&&U.dist(obs.x,obs.y,a.guardX,a.guardY)<=d.guardRadius*CFG.TILE)a.engaged=true;
          else{done();return;}
        }
      }
    }else if(exhausted){e.state='exhausted';this.move(e,{x:e.homeX,y:e.homeY},dt);done();return;}
    if(a.engaged&&a.memory){
      e.state=obs?'chase':'suspect';
      if(this.canShoot(e,obs)){
        e.angle=Math.atan2(obs.y-e.y,obs.x-e.x);
        if(e.key==='retriever'){
          const mates=this.teammates(e),members=[e,...mates].sort((a,b)=>a.spawnId.localeCompare(b.spawnId));
          const flank=members.length===2&&members[(Math.floor(a.clock/d.rolePeriod)+1)%2]===e;
          const near=U.dist(e.x,e.y,obs.x,obs.y)<6*CFG.TILE;
          const covered=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>!M.walkable(M.tx(e.x)+dx,M.ty(e.y)+dy));
          if((flank||near||!covered)&&a.cd>0&&!a.moveGoal){const goal=this.cover(e,obs,flank);if(goal&&(goal.cover||flank||near)){e.path=goal.path;e.pathI=0;a.moveGoal={...M.navigationPoint(goal.x,goal.y),until:a.clock+2.5};}}
          if(a.moveGoal){
            if(a.clock<a.moveGoal.until&&e.moveAlongPath(dt,d.speed)){done();return;}
            a.moveGoal=null;e.path=null;
          }
        }
        this.attack(e,obs);
      }else{a.moveGoal=null;this.move(e,a.memory,dt);if(U.dist(e.x,e.y,a.memory.x,a.memory.y)<8)e.angle+=dt*.7;}
    }else{
      if(a.engaged){a.engaged=false;a.returning=true;a.aimed=false;e.path=null;}
      if(a.returning){e.state='return';this.move(e,{x:e.homeX,y:e.homeY},dt);if(U.dist(e.x,e.y,e.homeX,e.homeY)<8){a.returning=false;e.path=null;}}
      else if(heard){e.state='suspect';if(!a.noiseGoal||a.clock>a.noiseGoal.until)a.noiseGoal={x:heard.x,y:heard.y,until:a.clock+3};this.move(e,a.noiseGoal,dt,d.speed*.7);}
      else if(a.noiseGoal&&a.clock<a.noiseGoal.until){e.state='suspect';this.move(e,a.noiseGoal,dt,d.speed*.7);}
      else this.patrol(e,dt);
    }
    done();
  },
  corpse(e,c){
    const a=e.ai;
    const pool=ITEMS.filter(it=>e.key==='holdout'?(it.cat==='life'||it.cat==='ind'||(it.cat==='medical'&&/^heal0[1-5]$/.test(it.id))):['elec','intel','ind'].includes(it.cat));
    c.fillBag(pool);
    if(a.reserve>0)c.loot.push({item:ammoItem(WEAPONS[e.weaponId].caliber,e.gearLv),n:a.reserve});
    if(e.helmet)c.loot.push({gear:{...e.helmet}});if(e.body)c.loot.push({gear:{...e.body}});
    c.loot.push({gun:{id:e.weaponId,magCur:a.mag,ammo:e.ammoId,rounds:Array(a.mag).fill(e.ammoId)}});
  },
  drawStatus(c,e,sx,sy){
    const a=e.ai;if(!a)return;c.save();c.textAlign='center';c.font='10px monospace';
    const msg=a.noticeUntil>a.clock?a.notice:a.phase==='aim'?'瞄准中':e.state==='warning'?'警戒':e.state==='exhausted'?'弹药耗尽':'';
    if(msg){const w=c.measureText(msg).width+10;const x=U.clamp(sx,w/2+2,CFG.VIEW_W-w/2-2),y=Math.max(12,sy-28);c.fillStyle='rgba(6,12,9,.85)';c.fillRect(x-w/2,y-10,w,15);c.fillStyle=e.state==='warning'?'#e1bd6c':'#cbd7c3';c.fillText(msg,x,y);}
    if(Game.debug){c.fillStyle='#b7e8b7';c.fillText(e.state+' '+a.phase+' '+a.mag+'/'+a.reserve,sx,sy+26);if(a.memory){c.strokeStyle='#c8b35d';c.beginPath();c.moveTo(sx,sy);c.lineTo(sx+a.memory.x-e.x,sy+a.memory.y-e.y);c.stroke();}}
    c.restore();
  }
};

/* BEGIN HUMAN STATIC ANCHORS */
const HUMAN_ART_STATIC = {"holdout_e":[15.64,28],"holdout_n":[15.54,28],"holdout_s":[15.82,28],"retriever_e":[14.64,28],"retriever_n":[16.25,28],"retriever_s":[15.89,28]};
/* END HUMAN STATIC ANCHORS */
