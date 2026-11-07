/* Shared by runtime and map editor. Apertures are prepared from the empty frame alpha. */
(function(root){
  const visual={
    // The approved single-cell side portal is the default in production and editor.
    isSidePortal(d){return !!d&&d.axis==='vertical'&&d.cells?.length===1&&d.sideStudy!==false;},
    // BEGIN PREPARED DOOR OPENINGS
    openings:{"door_open":[[8,7,16,25]],"sdoor_open":[[9,7,13,25]]},
    // END PREPARED DOOR OPENINGS
    openKey(d){return d.safe||d.reinforced||d.doorType==='locked'?'sdoor_open':'door_open';},
    sideGroundRect(rect,west=false,metal=false){
      const u=rect.w/32,hingeX=rect.x+16*u;
      // Crop only the wooden leaf inside the frame; its hinge edge meets the post axis.
      return{sx:metal?9:8,sy:7,sw:metal?13:16,sh:23,x:hingeX-(west?16:0)*u,y:rect.y+5*u,w:16*u,h:22*u,hingeX};
    },
    // One logical tile: north/south jambs join the wall; only the leaf changes state.
    sidePortal(c,rect,d,stone){
      const u=rect.w/32,x=rect.x,y=rect.y,w=rect.w,h=rect.h,j=5*u;
      const metal=d.safe||d.reinforced||d.doorType==='locked',locked=d.doorType==='locked'&&!d.unlocked;
      c.save();
      for(const top of [y,y+h-j]){
        c.fillStyle='#3a463b';c.fillRect(x,top,w,j);
        if(stone)c.drawImage(stone,0,0,stone.naturalWidth||32,5,x,top,w,j);
        c.fillStyle='#c4c2a8';c.fillRect(x,top,w,u);
        c.fillStyle='#596451';c.fillRect(x+w-2*u,top,2*u,j);
        c.fillStyle='#344337';c.fillRect(x,top+j-u,w,u);
        if(metal){
          c.fillStyle='#263b37';c.fillRect(x+11*u,top,10*u,j);
          c.fillStyle='#8eaaa0';c.fillRect(x+12*u,top+u,8*u,u);
          c.fillStyle='#c2c8b0';for(const dx of [12,19])c.fillRect(x+dx*u,top+3*u,u,u);
        }
      }
      if(!d.open){
        const width=metal?6:4,leafX=x+(16-width/2)*u,leafY=y+j,leafH=h-2*j;
        c.fillStyle=metal?'#1d3030':'#202c25';c.fillRect(leafX,leafY,width*u,leafH);
        c.fillStyle=metal?'#5b7771':'#827453';c.fillRect(leafX+u,leafY,(width-2)*u,leafH);
        c.fillStyle=metal?'#a1b3a5':'#ada078';c.fillRect(leafX+u,leafY,u,leafH);
        if(metal){c.fillStyle='#ced0b7';for(const t of [.2,.5,.8])c.fillRect(leafX+(width-2)*u,leafY+Math.floor(leafH*t/u)*u,u,u);}
        if(locked){
          const lx=x+18*u,ly=y+12*u;
          c.fillStyle='#252c23';c.fillRect(lx+u,ly,4*u,8*u);
          c.fillStyle='#b5a16c';c.fillRect(lx+2*u,ly+u,2*u,3*u);
          c.fillStyle='#3d3020';c.fillRect(lx,ly+3*u,6*u,6*u);
          c.fillStyle='#c39c4f';c.fillRect(lx+u,ly+4*u,4*u,4*u);
          c.fillStyle='#382d1c';c.fillRect(lx+3*u,ly+5*u,u,2*u);
        }else{c.fillStyle='#c0b187';c.fillRect(leafX+width*u,y+h*.55,2*u,2*u);}
        if(d.barred){
          // A slim diagonal timber, stepped on the native pixel grid, with small end straps.
          const west=d.kickFrom==='e';
          for(let i=0;i<12;i++){
            const tx=x+(west?17-i:14+i)*u,ty=y+(18-Math.floor(i/3))*u;
            c.fillStyle='#3d3024';c.fillRect(tx,ty,u,4*u);
            c.fillStyle=i===0||i===11?'#89643f':'#bd9966';c.fillRect(tx,ty,u,u);
            c.fillStyle=i%4===1?'#755437':'#977247';c.fillRect(tx,ty+u,u,2*u);
            if(i===2||i===3||i===9||i===10){
              c.fillStyle='#293c38';c.fillRect(tx,ty-u,u,5*u);
              c.fillStyle=i===2||i===9?'#849487':'#4b6057';c.fillRect(tx,ty,u,2*u);
              if(i===2||i===9){c.fillStyle='#b3b5a0';c.fillRect(tx,ty-u,u,u);}
            }
          }
        }
      }
      c.restore();
    },
    sideOpacity(visible){return{wall:visible?0.3:1,frame:visible?0.85:1};},
    // A single half-tile upright post, beneath the translucent wall cap.
    sidePost(c,rect,opacity){
      const w=rect.w/8,x=rect.x+(rect.w-w)/2;
      c.save();c.globalAlpha*=opacity;
      c.fillStyle='#24342b';c.fillRect(x,rect.y,w,rect.h);
      c.fillStyle='#aa9974';c.fillRect(x+w/4,rect.y,w/2,rect.h);
      c.fillStyle='#d0be94';c.fillRect(x+w/4,rect.y,w/4,rect.h);
      c.restore();
    },
    aperture(d,rect){return this.openings[this.openKey(d)].map(([x,y,w,h])=>[rect.x+x*rect.w/32,rect.y+y*rect.h/32,w*rect.w/32,h*rect.h/32]);},
    wallLayer(c,cell,rect,d,paint){
      c.save();c.beginPath();c.rect(cell.x,cell.y,cell.w,cell.h);c.clip();
      if(d.open){c.beginPath();c.rect(cell.x,cell.y,cell.w,cell.h);for(const r of this.aperture(d,rect))c.rect(...r);c.clip('evenodd');}
      paint();c.restore();
    }
  };
  if(typeof module==='object'&&module.exports)module.exports=visual;else root.DoorVisual=visual;
})(typeof globalThis!=='undefined'?globalThis:this);
