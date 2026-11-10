// Mechanical separation of the assembled imagegen design into print layers.
// No illustrations or glyphs are drawn here. Sources remain available for review.
const fs=require('node:fs'),path=require('node:path'),{PNG}=require('pngjs');
const root=path.join(__dirname,'../public/assets/printed-tiles');
const inputs=path.join(__dirname,'../art/printed-tiles/source');
const {read,write,resize,crop}=require('./raster-utils.cjs');
// Split the 4x3 glyph sheet into transparent, tightly bounded ink masks.
const marks=read(path.join(inputs,'marks.png'));
for(let n=0;n<12;n++){
 const left=Math.round(n%4*marks.width/4),top=Math.round(Math.floor(n/4)*marks.height/3);
 const cell=crop(marks,left,top,Math.round((n%4+1)*marks.width/4)-left,Math.round((Math.floor(n/4)+1)*marks.height/3)-top);
 const mask=new Uint8Array(cell.width*cell.height);
 for(let p=0;p<mask.length;p++){
  const [r,g,b,a]=cell.data.subarray(p*4,p*4+4);
  // Separate ivory/indigo ink from the alpha fringe in the generated sheet.
  mask[p]=a>100&&(n<8?(r>210&&g>180&&b>140&&r-g>5&&g-b>8):(b>r*1.05&&b>g*1.05&&r<130&&g<130))?1:0;
 }
 const visited=new Uint8Array(mask.length),components=[];
 for(let p=0;p<mask.length;p++)if(mask[p]&&!visited[p]){
  const pixels=[p];visited[p]=1;
  for(let q=0;q<pixels.length;q++){
   const v=pixels[q],x=v%cell.width,y=Math.floor(v/cell.width);
   for(const k of [x>0?v-1:-1,x<cell.width-1?v+1:-1,y>0?v-cell.width:-1,y<cell.height-1?v+cell.width:-1])if(k>=0&&mask[k]&&!visited[k]){visited[k]=1;pixels.push(k);}
  }components.push(pixels);
 }
 const largest=Math.max(...components.map(c=>c.length));
 const accepted=components.filter(c=>c.length>largest*.08).flat();
 if(!accepted.length)throw Error('Missing glyph '+n);
 let x0=cell.width,y0=cell.height,x1=0,y1=0;const output=new PNG({width:cell.width,height:cell.height});
 for(const p of accepted){const x=p%cell.width,y=Math.floor(p/cell.width);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);output.data.fill(255,p*4,p*4+4);}
 write(path.join(root,'marks',`${n}.png`),resize(crop(output,x0,y0,x1-x0+1,y1-y0+1),Math.round(128*(x1-x0+1)/Math.max(x1-x0+1,y1-y0+1)),Math.round(128*(y1-y0+1)/Math.max(x1-x0+1,y1-y0+1))));
}
// Structural frame, its transparent wells and backgrounds are separated together.
require('./separate-tile-frame.cjs');
require('./prepare-tile-cutouts.cjs');
