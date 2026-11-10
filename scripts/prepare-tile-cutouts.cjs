// Register the imagegen cutouts into the actual illustration aperture.
// Whole subjects fit inside the frame: they are not scenes cropped by a hex.
const path=require('node:path'),{PNG}=require('pngjs');
const {read,write,resize,crop}=require('./raster-utils.cjs');
const root=path.join(__dirname,'../public/assets/printed-tiles');
const types=['sakura','chochin','onigiri','cat','boat','move','draw','cover','copy','back'];
const W=1024,H=Math.round(W*Math.sqrt(3)/2);
const aperture=resize(read(path.join(root,'art-window.png')),W,H);
for(const type of types){
 const raw=read(path.join(__dirname,'../art/printed-tiles/cutouts',type+'.png'));
 let x0=raw.width,y0=raw.height,x1=0,y1=0;
 for(let y=0;y<raw.height;y++)for(let x=0;x<raw.width;x++)if(raw.data[(y*raw.width+x)*4+3]>80){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
 if(x1<x0||y1<y0)throw Error('Empty illustration '+type);
 const image=crop(raw,x0,y0,x1-x0+1,y1-y0+1),out=new PNG({width:W,height:H});
 if(type==='back'){
  const pattern=resize(raw,W,H);
  for(let p=0;p<W*H;p++){pattern.data[p*4+3]=Math.round(pattern.data[p*4+3]*aperture.data[p*4+3]/255);}
  pattern.data.copy(out.data);
 }else{
  const samples=[];
  for(let y=0;y<image.height;y+=3)for(let x=0;x<image.width;x+=3)if(image.data[(y*image.width+x)*4+3]>120)samples.push([x,y]);
  let scale=Math.min(W*.87/image.width,H*.7/image.height),left,top;
  for(let step=0;step<100;step++){
   left=W/2-image.width*scale/2;top=H*.42-image.height*scale/2;
   const fits=samples.every(([x,y])=>{const xx=Math.round(left+x*scale),yy=Math.round(top+y*scale);return xx>=0&&xx<W&&yy>=0&&yy<H&&aperture.data[(yy*W+xx)*4+3]>220;});
   if(fits)break;scale*=.98;
  }
  const fitted=resize(image,Math.max(1,Math.round(image.width*scale)),Math.max(1,Math.round(image.height*scale)));
  PNG.bitblt(fitted,out,0,0,fitted.width,fitted.height,Math.round(W/2-fitted.width/2),Math.round(H*.42-fitted.height/2));
 }
 for(const size of [64,128,256,512,1024])write(path.join(root,'cutouts',String(size),type+'.png'),resize(out,size,Math.round(size*Math.sqrt(3)/2)));
}
