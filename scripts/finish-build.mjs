import {evidenceURL,offloadManifest,offloadReadme} from './review-hosting.mjs';
import { VERSION } from "../src/game/engine.js";
import { mkdir, copyFile, writeFile, cp, access, readdir, readFile } from "node:fs/promises";
for (const path of ["gallery", "tabletop", "dev/animations", "lab"]) {
  await mkdir(`dist/${path}`, { recursive: true });
  await copyFile("dist/index.html", `dist/${path}/index.html`);
}
await writeFile(
  "dist/build.json",
  JSON.stringify({ sha: process.env.VITE_BUILD_SHA || "local", protocol: VERSION }),
);
await writeFile("dist/.nojekyll", "");

// Publish the generated step viewer alongside the playable preview.
await mkdir('dist/review',{recursive:true});
await copyFile('tests/e2e/index.html','dist/review/index.html');
const immutable=/^[a-f\d]{40}$/.test(process.env.VITE_BUILD_SHA||'');
for(const folder of immutable?['walkthroughs']:['screenshots','walkthroughs']) {
  try{await access(`tests/e2e/${folder}`);await cp(`tests/e2e/${folder}`,`dist/review/${folder}`,{recursive:true});}catch(error){if(error.code!=='ENOENT')throw error;}
}

// Screenshots remain byte-for-byte in the source commit. Pages hosts the small
// viewer/manifests; it need not mirror every full-game image for every preview.
if(immutable){
 const resolve=path=>evidenceURL(process.env.GITHUB_REPOSITORY||'anicolao/hanami',process.env.VITE_BUILD_SHA,path);
 async function visit(dir){for(const item of await readdir(dir,{withFileTypes:true})){
  const path=`${dir}/${item.name}`;
  if(item.isDirectory())await visit(path);
  else if(item.name==='steps.json')await writeFile(path,JSON.stringify(offloadManifest(JSON.parse(await readFile(path,'utf8')),resolve),null,2)+'\n');
  else if(item.name==='README.md')await writeFile(path,offloadReadme(await readFile(path,'utf8'),resolve));
 }}
 await visit('dist/review/walkthroughs');
}
