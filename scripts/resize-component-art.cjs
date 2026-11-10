// Area-average the original watercolor pixels before displaying tiny pieces.
// Premultiplied alpha avoids dark fringes on transparent celebration artwork.
// Run with: node scripts/resize-component-art.cjs
const {PNG} = require('pngjs');
const fs = require('node:fs');
const path = require('node:path');
const directory = path.join(__dirname, '../public/assets/watercolor');
for (const file of fs.readdirSync(directory).filter(f => f.endsWith('.png') && !['nihon.png','tokyo.png','screen.png','box.png'].includes(f))) {
  const source = PNG.sync.read(fs.readFileSync(path.join(directory, file)));
  for (const size of [64, 128, 256]) {
    const width = Math.round(source.width * size / Math.max(source.width, source.height));
    const height = Math.round(source.height * size / Math.max(source.width, source.height));
    const out = new PNG({width, height});
    const sx = source.width / width, sy = source.height / height;
    for (let y=0; y<height; y++) for (let x=0; x<width; x++) {
      const left=x*sx, right=(x+1)*sx, top=y*sy, bottom=(y+1)*sy;
      let alpha=0, red=0, green=0, blue=0;
      for(let iy=Math.floor(top); iy<Math.ceil(bottom); iy++) for(let ix=Math.floor(left); ix<Math.ceil(right); ix++) {
        const weight=(Math.min(right,ix+1)-Math.max(left,ix))*(Math.min(bottom,iy+1)-Math.max(top,iy));
        const p=(iy*source.width+ix)*4, a=source.data[p+3]*weight;
        alpha+=a;red+=source.data[p]*a;green+=source.data[p+1]*a;blue+=source.data[p+2]*a;
      }
      const p=(y*width+x)*4;
      out.data[p]=alpha?Math.round(red/alpha):0;
      out.data[p+1]=alpha?Math.round(green/alpha):0;
      out.data[p+2]=alpha?Math.round(blue/alpha):0;
      out.data[p+3]=Math.round(alpha/(sx*sy));
    }
    const target=path.join(directory, 'small', String(size));
    fs.mkdirSync(target,{recursive:true});
    fs.writeFileSync(path.join(target,file),PNG.sync.write(out));
  }
}
