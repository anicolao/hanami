// Exact logical-cell reference diagrams for image generation, not finished artwork.
import fs from 'node:fs';
import raster from './raster-utils.cjs';
import {PNG} from 'pngjs';
import maps from '../src/game/maps.json' with {type:'json'};
import {BOARD_GEOMETRY,paintedCell,boardMetrics} from '../src/game/board-geometry.js';
function polygon(png,points,color){
 const minX=Math.max(0,Math.floor(Math.min(...points.map(p=>p[0])))),maxX=Math.min(png.width-1,Math.ceil(Math.max(...points.map(p=>p[0]))));
 const minY=Math.max(0,Math.floor(Math.min(...points.map(p=>p[1])))),maxY=Math.min(png.height-1,Math.ceil(Math.max(...points.map(p=>p[1]))));
 for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
  let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){
   const [a,b]=points[i],[c,d]=points[j];if((b>y+.5)!==(d>y+.5)&&(x+.5<(c-a)*(y+.5-b)/(d-b)+a))inside=!inside;
  }if(inside)png.data.set([...color,255],(y*png.width+x)*4);
 }
}
function line(png,a,b,color,width=1){const count=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*2);for(let n=0;n<=count;n++){const x=a[0]+(b[0]-a[0])*n/count,y=a[1]+(b[1]-a[1])*n/count;for(let dy=-width;dy<=width;dy++)for(let dx=-width;dx<=width;dx++){const xx=Math.round(x+dx),yy=Math.round(y+dy);if(xx>=0&&xx<png.width&&yy>=0&&yy<png.height)png.data.set([...color,255],(yy*png.width+xx)*4);}}}
for(const map of ['nihon','tokyo']){
 const g=BOARD_GEOMETRY[map],png=new PNG({width:g.imageWidth,height:g.imageHeight});
 for(let p=0;p<png.width*png.height;p++)png.data.set([47,89,117,255],p*4);
 const shapes=[];
 const mask=new PNG({width:g.imageWidth*2,height:g.imageHeight*2});
 for(const cell of maps[map]){
  const c=paintedCell(map,cell),x=c.x/100*g.imageWidth,y=c.y/100*g.imageHeight;
  const half=boardMetrics(map).cellWidth/100*g.imageWidth/2,height=half/boardMetrics(map).cellAspect;
  const points=[[x-half,y],[x-half/2,y-height],[x+half/2,y-height],[x+half,y],[x+half/2,y+height],[x-half/2,y+height]];
  if(cell.kind!=='water')polygon(mask,points.map(([x,y])=>[x*2,y*2]),[255,255,255]);
  polygon(png,points,cell.kind==='land'?[239,221,177]:cell.kind==='park'?[121,158,111]:[107,163,192]);shapes.push(points);
 }
 for(const cell of maps[map].filter(c=>c.kind==='park')){
  const c=paintedCell(map,cell),x=c.x/100*g.imageWidth,y=c.y/100*g.imageHeight;
  const offsets=cell.capacity===3?[[-8,5],[8,5],[0,-8]]:cell.capacity===2?[[-8,0],[8,0]]:[[0,0]];
  for(const [dx,dy]of offsets)for(let py=-4;py<=4;py++)for(let px=-4;px<=4;px++)if(px*px+py*py<=16){const xx=Math.round(x+dx+px),yy=Math.round(y+dy+py);if(xx>=0&&xx<png.width&&yy>=0&&yy<png.height)png.data.set([30,50,30,255],(yy*png.width+xx)*4);}
 }
 fs.writeFileSync(`art/boards/guides/${map}-terrain.png`,PNG.sync.write(png));
 for(const points of shapes)for(let i=0;i<6;i++)line(png,points[i],points[(i+1)%6],[32,38,43],0);
 fs.writeFileSync(`art/boards/guides/${map}-grid.png`,PNG.sync.write(png));
 fs.mkdirSync('public/assets/boards',{recursive:true});
 fs.writeFileSync(`public/assets/boards/${map}-land-mask.png`,PNG.sync.write(raster.resize(mask,g.imageWidth,g.imageHeight)));
 console.log(map,maps[map].length,'cells',png.width,png.height);
}
