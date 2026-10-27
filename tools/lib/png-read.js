const fs=require('fs'),zlib=require('zlib');
function read(file){
  const b=fs.readFileSync(file);let p=8,ihdr=null,plte=null,trns=null,idat=[];
  while(p<b.length){
    const len=b.readUInt32BE(p),type=b.toString('ascii',p+4,p+8),data=b.slice(p+8,p+8+len);
    if(type==='IHDR')ihdr={w:data.readUInt32BE(0),h:data.readUInt32BE(4),depth:data[8],color:data[9]};
    else if(type==='PLTE')plte=data;else if(type==='tRNS')trns=data;else if(type==='IDAT')idat.push(data);
    else if(type==='IEND')break;
    p+=12+len;
  }
  const raw=zlib.inflateSync(Buffer.concat(idat));
  const ch={0:1,2:3,3:1,4:2,6:4}[ihdr.color];const bpp=ihdr.color===3?1:ch;const stride=ihdr.w*bpp;
  const out=Buffer.alloc(ihdr.h*stride);
  let pos=0;
  for(let y=0;y<ihdr.h;y++){
    const f=raw[pos++];const line=raw.slice(pos,pos+stride);pos+=stride;
    const cur=out.slice(y*stride,(y+1)*stride);const prev=y?out.slice((y-1)*stride,y*stride):Buffer.alloc(stride);
    for(let x=0;x<stride;x++){
      const a=x>=bpp?cur[x-bpp]:0,bb=prev[x],c=x>=bpp?prev[x-bpp]:0;let v=line[x];
      if(f===1)v+=a;else if(f===2)v+=bb;else if(f===3)v+=((a+bb)>>1);
      else if(f===4){const pp=a+bb-c,pa=Math.abs(pp-a),pb=Math.abs(pp-bb),pc=Math.abs(pp-c);v+= (pa<=pb&&pa<=pc)?a:(pb<=pc?bb:c);}
      cur[x]=v&255;
    }
  }
  const px=[];
  for(let y=0;y<ihdr.h;y++){const row=[];for(let x=0;x<ihdr.w;x++){
    if(ihdr.color===3){const i=out[y*stride+x];row.push([plte[i*3],plte[i*3+1],plte[i*3+2],trns&&i<trns.length?trns[i]:255]);}
    else {const o=y*stride+x*ch;row.push([out[o],out[o+1],out[o+2],ch>3?out[o+3]:255]);}
  }px.push(row);}
  return {w:ihdr.w,h:ihdr.h,color:ihdr.color,px,plte};
}
module.exports={read};
if(require.main===module){
  const r=read(process.argv[2]);
  console.log('size',r.w,r.h,'colorType',r.color,'palette',r.plte?r.plte.length/3:0);
  const chars=' .:-=+*#%@';
  for(let y=0;y<r.h;y++){let s='';for(let x=0;x<r.w;x++){const [rr,gg,bb,aa]=r.px[y][x];const l=(rr*0.3+gg*0.59+bb*0.11)/255;if(aa<20)s+=' ';else s+=chars[Math.min(9,Math.floor(l*10))];}console.log(String(y).padStart(2),s);}
  // palette dump
  if(r.plte){const n=r.plte.length/3;const arr=[];for(let i=0;i<n;i++)arr.push('#'+[r.plte[i*3],r.plte[i*3+1],r.plte[i*3+2]].map(v=>v.toString(16).padStart(2,'0')).join(''));console.log(arr.join(' '));}
}
