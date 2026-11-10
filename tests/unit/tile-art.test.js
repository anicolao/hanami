import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PNG} from 'pngjs';
import {BOARD_GEOMETRY} from '../../src/game/board-geometry.js';
const png=name=>PNG.sync.read(fs.readFileSync(new URL(`../../public/assets/printed-tiles/${name}`,import.meta.url)));
test('the frame owns the strength bump and the background stays inside its contour',()=>{
 const frame=png('frame-mask.png'),gold=png('frame-gold.png'),base=png('frame-silhouette.png');
 const w=frame.width,h=frame.height,n=w*h;
 assert.equal(base.width,w);assert.equal(base.height,h);
 assert.ok(frame.data[(Math.round(h*.9)*w+Math.round(w*.5))*4+3]>240,'strength bump is opaque frame ink');
 const outside=new Uint8Array(n),queue=new Uint32Array(n);let count=0;
 const seed=p=>{if(!outside[p]&&frame.data[p*4+3]<32&&gold.data[p*4+3]<32){outside[p]=1;queue[count++]=p;}};
 for(let x=0;x<w;x++){seed(x);seed((h-1)*w+x);}for(let y=0;y<h;y++){seed(y*w);seed(y*w+w-1);}
 for(let i=0;i<count;i++){const p=queue[i],x=p%w,y=Math.floor(p/w);for(const q of [x?p-1:-1,x<w-1?p+1:-1,y?p-w:-1,y<h-1?p+w:-1])if(q>=0)seed(q);}
 for(let p=0;p<n;p++)if(base.data[p*4+3]>160)assert.equal(outside[p],0,`background protrudes at ${p%w},${Math.floor(p/w)}`);
});
for(const type of ['sakura','chochin','onigiri','cat','boat','move','draw','cover','copy','back'])test(`${type} illustration is transparent outside its artwork and clear of footer wells`,()=>{
 const image=png(`cutouts/1024/${type}.png`);let transparent=0,painted=0;
 for(let p=0;p<image.width*image.height;p++){if(image.data[p*4+3]===0)transparent++;if(image.data[p*4+3]>160)painted++;}
 assert.ok(transparent>image.width*image.height*.3,'opaque paper field remains');
 assert.ok(painted>image.width*image.height*.01,'illustration is missing');
 for(const x of [.3,.5,.7])assert.equal(image.data[(Math.floor(image.height*.9)*image.width+Math.floor(image.width*x))*4+3],0,'art spills into a footer well');
});
for(const map of ['nihon','tokyo'])test(`${map} organic painting retains the board canvas dimensions`,()=>{
 const image=PNG.sync.read(fs.readFileSync(new URL(`../../public/assets/boards/${map}-organic.png`,import.meta.url)));
 assert.equal(image.width,BOARD_GEOMETRY[map].imageWidth);assert.equal(image.height,BOARD_GEOMETRY[map].imageHeight);
});

test('all six frame edges follow a regular hexagon',()=>{
 const frame=png('frame-mask.png'),w=frame.width,h=frame.height;
 assert.ok(Math.abs(w/h-2/Math.sqrt(3))<.002);
 const vertices=[[w/4,0],[3*w/4,0],[w,h/2],[3*w/4,h],[w/4,h],[0,h/2]];
 const alpha=(x,y)=>{x=Math.floor(x);y=Math.floor(y);return x<0||y<0||x>=w||y>=h?0:frame.data[(y*w+x)*4+3];};
 for(let i=0;i<6;i++){
  const [ax,ay]=vertices[i],[bx,by]=vertices[(i+1)%6],length=Math.hypot(bx-ax,by-ay),nx=-(by-ay)/length,ny=(bx-ax)/length;
  for(const t of [.2,.4,.6,.8]){
   const x=ax+(bx-ax)*t,y=ay+(by-ay)*t;
   assert.ok(alpha(x+nx*2,y+ny*2)>200,`missing frame edge ${i} at ${t}`);
   assert.equal(alpha(x-nx*2,y-ny*2),0,`frame outside edge ${i} at ${t}`);
  }
 }
});
