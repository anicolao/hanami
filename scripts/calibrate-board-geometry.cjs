// Read-only registration of the painted hex lines. Prints fits; never edits artwork.
const fs=require('node:fs'),path=require('node:path');const{PNG}=require('pngjs');
const configured=require('../src/game/board-geometry.js').BOARD_GEOMETRY;
const maps=require('../src/game/maps.json');
for(const name of ['nihon','tokyo']){
 const im=PNG.sync.read(fs.readFileSync(path.join(__dirname,'../public/assets/watercolor',`${name}.png`)));
 const gray=new Float32Array(im.width*im.height);for(let i=0;i<gray.length;i++)gray[i]=(im.data[i*4]*.299+im.data[i*4+1]*.587+im.data[i*4+2]*.114);
 function lum(x,y){if(x<5||y<5||x>=im.width-5||y>=im.height-5)return 0;const ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy,a=iy*im.width+ix;return gray[a]*(1-u)*(1-v)+gray[a+1]*u*(1-v)+gray[a+im.width]*(1-u)*v+gray[a+im.width+1]*u*v;}
 const verts=[[-2/3,0],[-1/3,-.5],[1/3,-.5],[2/3,0],[1/3,.5],[-1/3,.5]];const samples=[];
 for(const c of maps[name])for(let edge=0;edge<3;edge++){
  const a=verts[edge],b=verts[(edge+1)%6];
  for(const f of [.18,.34,.5,.66,.82])samples.push([c.q+a[0]+(b[0]-a[0])*f,c.r+(c.q%2)/2+a[1]+(b[1]-a[1])*f,b[0]-a[0],b[1]-a[1]]);
 }
 function score([ox,oy,dx,dy]){let total=0,n=0;for(const[sx,sy,vx,vy]of samples){const x=ox+sx*dx,y=oy+sy*dy;if(x<25||x>im.width-25||y<25||y>im.height-90)continue;const len=Math.hypot(vx*dx,vy*dy),nx=-vy*dy/len,ny=vx*dx/len;
 const center=(lum(x,y)+lum(x+nx*.65,y+ny*.65)+lum(x-nx*.65,y-ny*.65))/3;
 const surround=(lum(x+nx*3.3,y+ny*3.3)+lum(x-nx*3.3,y-ny*3.3))/2;
 total+=Math.max(-12,Math.min(45,surround-center));n++;}return total/n;}
 function regression(points){const mx=points.reduce((s,p)=>s+p[0],0)/points.length,my=points.reduce((s,p)=>s+p[1],0)/points.length;const step=points.reduce((s,p)=>s+(p[0]-mx)*(p[1]-my),0)/points.reduce((s,p)=>s+(p[0]-mx)**2,0);return[my-step*mx,step];}
 const [ox,dx]=regression(maps[name].map(c=>[c.q,c.x*im.width/100]));
 const [oy,dy]=regression(maps[name].map(c=>[c.r+(c.q%2)/2,c.y*im.height/100]));
 const original=[ox,oy,dx,dy];let p=[...original],best=score(p);
 for(const step of [4,2,1,.5,.25,.125,.0625])for(let pass=0;pass<20;pass++){
  let changed=false;
  for(let k=0;k<4;k++)for(const direction of [-1,1]){
   const q=[...p];q[k]+=direction*step*(k<2?1:.06);
   if(Math.abs(q[k]-original[k])>(k<2?30:2))continue;
   const v=score(q);if(v>best){p=q;best=v;changed=true;}
  }if(!changed)break;
 }
 const g=configured[name];
 console.log(JSON.stringify({configuredScore:score([g.originX,g.originY,g.columnStep,g.rowStep]),name,width:im.width,height:im.height,original,originalScore:score(original),fitted:p,score:best,normalized:p.map((v,i)=>v/(i%2===0?im.width:im.height)*100)},null,2));
}
