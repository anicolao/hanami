// Color-separate the imagegen structural frame. All artwork remains generated.
// Transparent connected wells also provide the exact image/background apertures.
const path=require('node:path'),{PNG}=require('pngjs');
const {read,write,resize}=require('./raster-utils.cjs');
const root=path.join(__dirname,'../public/assets/printed-tiles');
const sources=path.join(__dirname,'../art/printed-tiles/source');
const width=1024,height=Math.round(width*Math.sqrt(3)/2),pixels=width*height;
const frame=resize(read(path.join(sources,'frame.png')),width,height);
const ink=new PNG({width,height}),gold=new PNG({width,height}),wall=new Uint8Array(pixels);
for(let n=0;n<pixels;n++){
 const p=n*4,[r,g,b,a]=frame.data.subarray(p,p+4);
 const isGold=r>90&&g>65&&r>g*1.06&&g>b*1.15;
 if(a>15&&isGold){frame.data.copy(gold.data,p,p,p+4);}
 else if(a>15&&Math.max(r,g,b)<125){ink.data.fill(255,p,p+3);ink.data[p+3]=a;}
 if(ink.data[p+3]>100||gold.data[p+3]>100)wall[n]=1;
}
// Close subpixel antialias gaps solely for finding the transparent wells.
const barrier=new Uint8Array(pixels);
for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(wall[y*width+x])for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(x+dx>=0&&x+dx<width&&y+dy>=0&&y+dy<height)barrier[(y+dy)*width+x+dx]=1;
function well(x,y){
 const start=Math.floor(y*height)*width+Math.floor(x*width);
 if(barrier[start])throw Error('Well seed is covered by frame');
 const mask=new Uint8Array(pixels),queue=new Uint32Array(pixels);let count=1;queue[0]=start;mask[start]=1;
 for(let i=0;i<count;i++){
  const p=queue[i],px=p%width,py=Math.floor(p/width);
  for(const q of [px>0?p-1:-1,px<width-1?p+1:-1,py>0?p-width:-1,py<height-1?p+width:-1])if(q>=0&&!barrier[q]&&!mask[q]){mask[q]=1;queue[count++]=q;}
 }
 if(mask[0]||count<1000)throw Error('Frame well is open to the exterior or too small');
 return {mask,count};
}
const art=well(.5,.4),value=well(.5,.9),owner=well(.3,.9),action=well(.7,.9);
for(const [name,part] of Object.entries({value,owner,action}))if(part.mask[Math.floor(.4*height)*width+Math.floor(.5*width)])throw Error(name+' well connects to illustration well');
// The strength bump is an integral filled part of the frame, not a background.
for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(value.mask[y*width+x])for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
 const xx=x+dx,yy=y+dy;if(xx>=0&&xx<width&&yy>=0&&yy<height){const p=(yy*width+xx)*4;ink.data.fill(255,p,p+4);}
}
// The physical outline is a mathematically regular flat-top hexagon.
// Retain the generated strength-bump detail, but replace the irregular outer rim.
const vertices=[[width/4,0],[width*3/4,0],[width,height/2],[width*3/4,height],[width/4,height],[0,height/2]];
function edgeDistance(x,y){let distance=Infinity;for(let i=0;i<6;i++){const [ax,ay]=vertices[i],[bx,by]=vertices[(i+1)%6];distance=Math.min(distance,((bx-ax)*(y-ay)-(by-ay)*(x-ax))/Math.hypot(bx-ax,by-ay));}return distance;}
const sourceInk=Buffer.from(ink.data),sourceGold=Buffer.from(gold.data),silhouette=new Uint8Array(pixels);
const rim=width*.04,goldInset=width*.022,goldWidth=width*.0021;
let baseline=Math.round(height*.855),best=0;
for(let y=Math.floor(height*.82);y<height*.89;y++){
 let score=0;for(let x=Math.floor(width*.21);x<width*.34;x++)if(sourceGold[(y*width+x)*4+3]>120)score++;
 if(score>best){best=score;baseline=y;}
}
let leftEnd=width*.35,rightEnd=width*.65;
for(let x=Math.floor(width*.30);x<width*.46;x++)if(sourceGold[(baseline*width+x)*4+3]>80)leftEnd=x;
for(let x=Math.floor(width*.70);x>width*.54;x--)if(sourceGold[(baseline*width+x)*4+3]>80)rightEnd=x;
const coverage=value=>Math.max(0,Math.min(1,value));
for(let y=0;y<height;y++)for(let x=0;x<width;x++){
 const p=(y*width+x)*4,d=edgeDistance(x+.5,y+.5),outer=coverage(d+.5);
 const footer=y>height*.74&&x>width*.29&&x<width*.71;
 const separator=(x<=leftEnd||x>=rightEnd)&&d>=goldInset&&Math.abs(y-baseline)<5;
 const alpha=Math.max(coverage(rim-d+.5),footer?sourceInk[p+3]/255:0,separator?1:0)*outer;
 ink.data.fill(255,p,p+3);ink.data[p+3]=Math.round(alpha*255);
 const outerGold=coverage(goldWidth/2-Math.abs(d-goldInset)+.5);
 const horizontalGold=(x<=leftEnd||x>=rightEnd)&&d>=goldInset?coverage(goldWidth/2-Math.abs(y-baseline)+.5):0;
 const curveGold=footer&&y<height*.91?sourceGold[p+3]/255:0;
 const ga=Math.max(outerGold,horizontalGold,curveGold)*outer;
 gold.data[p]=189;gold.data[p+1]=160;gold.data[p+2]=95;gold.data[p+3]=Math.round(ga*255);
 if(d>1.5)silhouette[y*width+x]=1;
}
function maskImage(mask){const image=new PNG({width,height});for(let p=0;p<pixels;p++)if(mask[p])image.data.fill(255,p*4,p*4+4);return image;}
// Keep the image plate just inside its aperture so old painted rules never remain.
const aperture=new Uint8Array(pixels);
for(let y=3;y<height-3;y++)for(let x=3;x<width-3;x++){
 const p=y*width+x;
 if(edgeDistance(x+.5,y+.5)>rim+4&&art.mask[p]&&[[-3,0],[3,0],[0,-3],[0,3]].every(([dx,dy])=>art.mask[(y+dy)*width+x+dx]))aperture[p]=1;
}
write(path.join(root,'frame-silhouette.png'),resize(maskImage(silhouette),512,Math.round(512*Math.sqrt(3)/2)));
write(path.join(root,'frame-mask.png'),resize(ink,512,Math.round(512*Math.sqrt(3)/2)));
write(path.join(root,'frame-gold.png'),resize(gold,512,Math.round(512*Math.sqrt(3)/2)));
write(path.join(root,'art-window.png'),resize(maskImage(aperture),512,Math.round(512*Math.sqrt(3)/2)));
write(path.join(root,'value-window.png'),resize(maskImage(value.mask),512,Math.round(512*Math.sqrt(3)/2)));
console.log('Separated transparent frame wells:',JSON.stringify({illustration:art.count,value:value.count,owner:owner.count,action:action.count}));

