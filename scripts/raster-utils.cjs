const fs=require('node:fs'),path=require('node:path'),{PNG}=require('pngjs');
const read=p=>PNG.sync.read(fs.readFileSync(p));
function write(file,png){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,PNG.sync.write(png));}
function resize(source,width,height){
 const out=new PNG({width,height}),sx=source.width/width,sy=source.height/height;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const l=x*sx,r=(x+1)*sx,t=y*sy,b=(y+1)*sy;let a=0,red=0,g=0,blue=0;
  for(let iy=Math.floor(t);iy<Math.min(source.height,Math.ceil(b));iy++)for(let ix=Math.floor(l);ix<Math.min(source.width,Math.ceil(r));ix++){
   const weight=(Math.min(r,ix+1)-Math.max(l,ix))*(Math.min(b,iy+1)-Math.max(t,iy)),p=(iy*source.width+ix)*4,alpha=source.data[p+3]*weight;
   a+=alpha;red+=source.data[p]*alpha;g+=source.data[p+1]*alpha;blue+=source.data[p+2]*alpha;
  }
  const p=(y*width+x)*4;out.data[p]=a?Math.round(red/a):0;out.data[p+1]=a?Math.round(g/a):0;out.data[p+2]=a?Math.round(blue/a):0;out.data[p+3]=Math.round(a/(sx*sy));
 }return out;
}
function crop(png,left,top,width,height){const out=new PNG({width,height});PNG.bitblt(png,out,left,top,width,height,0,0);return out;}

module.exports={read,write,resize,crop};
