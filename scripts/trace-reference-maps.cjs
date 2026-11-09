// Development-only color sampling of user-supplied board references. Does not edit images.
const fs=require('node:fs');const {PNG}=require('pngjs');
const markers={nihon:[
 [180,150,1,3],[306,220,1,3],[118,258,1,3],[242,335,1,3],[118,410,1,3],
 [370,408,1,3],[306,514,1,3],[498,480,1,3],[434,590,1,3],
 [438,298,1,2],[562,298,1,2],[628,407,1,2],[754,407,1,2],[882,478,1,2],[1014,482,1,2],[628,554,1,2],[754,554,2,2],[882,629,1,2],[1014,629,3,2],[1014,778,1,2],[1140,705,1,2],[1140,554,1,2],[1270,630,1,2],[1270,482,2,2],[1397,407,1,2],[1397,554,1,2],
 [1460,298,1,4],[1587,222,1,4],[1776,184,1,4],[1715,300,1,4],[1580,370,2,4],[1715,446,1,4],[1840,446,1,4],[1524,480,1,4]
],tokyo:[
 [512,182,1,3],[378,253,1,3],[578,290,1,3],[448,365,1,3],[512,477,1,3],[378,550,1,3],[250,623,1,3],[512,623,1,3],[378,698,1,3],
 [770,253,2,2],[894,253,1,2],[1025,253,1,2],[1149,331,1,2],[1406,331,1,2],[1270,399,2,2],[1406,480,1,2],[1279,552,1,2],[1149,626,1,2],[1279,701,1,2],[1025,553,1,2],[894,626,1,2],[765,553,1,2],[640,480,1,2],[700,365,1,2],[1025,402,1,2],[894,477,3,2],
 [1660,182,1,4],[1530,253,1,4],[1660,331,1,4],[1530,402,1,4],[1597,517,1,4],[1406,630,1,4],[1597,665,2,4],[1477,702,1,4]
]};
const output={version:1};
for(const name of ['nihon','tokyo']){
 const im=PNG.sync.read(fs.readFileSync(`${name}.png`)),dx=63.5*im.width/1974,dy=73.8*im.height/926,ox=54*im.width/1974,oy=im.height/926;
 const coords=(q,r)=>({q,r,x:ox+dx*q,y:oy+dy*r+dy/2*(q%2)});
 let land=[];
 for(let q=0;q<30;q++)for(let r=1;r<11;r++){
  let c=coords(q,r),hits=0;for(const xx of [-12,0,12])for(const yy of [-12,0,12]){
   const o=(Math.round(c.y+yy)*im.width+Math.round(c.x+xx))*4,[R,G,B]=im.data.slice(o,o+3);
   if(R>180&&G>100&&(name==='nihon'?B<R*.96:B>140&&Math.max(R,G,B)-Math.min(R,G,B)<65))hits++;
  }if(hits>=6&&c.y<810)land.push(c);
 }
 let rest=[...land],groups=[];while(rest.length){let group=[rest.shift()];for(let i=0;i<group.length;i++)for(let j=rest.length-1;j>=0;j--)if(Math.hypot(group[i].x-rest[j].x,group[i].y-rest[j].y)<dy*1.08){group.push(rest[j]);rest.splice(j,1);}if(group.length>=10)groups.push(group);}
 land=groups.flat();for(const c of land){c.capacity=0;c.region=name==='nihon'?(c.q<5||c.q<8&&c.r>4?3:c.q>21?4:2):(c.q<9?3:c.q>21||c.q===21&&c.r>7?4:2);}
 for(const [x,y,n,region] of markers[name]){let c=land.reduce((a,b)=>Math.hypot(a.x-x,a.y-y)<Math.hypot(b.x-x,b.y-y)?a:b);if(Math.hypot(c.x-x,c.y-y)>50)throw Error(`Missing park ${name} ${x},${y}`);if(c.capacity)throw Error('Duplicate park');c.capacity=n;c.region=region;}
 const all=land.map(c=>({...c,kind:c.capacity?'park':'land'}));
 for(const c of land)for(let q=c.q-1;q<=c.q+1;q++)for(let r=c.r-1;r<=c.r+1;r++){let n=coords(q,r);if(Math.hypot(c.x-n.x,c.y-n.y)<dy*1.08&&!all.some(a=>a.q===q&&a.r===r))all.push({...n,kind:'water',capacity:0,region:c.region});else if(!land.some(a=>a.q===q&&a.r===r)){let a=all.find(a=>a.q===q&&a.r===r);if(a)a.region=Math.min(a.region,c.region);}}
 output[name]=all.map(c=>({id:`${c.q}:${c.r}`,q:c.q,r:c.r,x:+(c.x/im.width*100).toFixed(4),y:+(c.y/im.height*100).toFixed(4),kind:c.kind,capacity:c.capacity,region:c.region}));
 console.log(name,[2,3,4].map(n=>({players:n,tokens:land.filter(c=>c.region<=n).reduce((s,c)=>s+c.capacity,0),land:land.filter(c=>c.region<=n).length})));
}
fs.writeFileSync('src/game/maps.json',JSON.stringify(output,null,2)+'\n');
