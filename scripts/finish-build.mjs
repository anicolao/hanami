import { mkdir, copyFile, writeFile, cp, access } from "node:fs/promises";
for (const path of ["gallery", "tabletop", "dev/animations", "lab"]) {
  await mkdir(`dist/${path}`, { recursive: true });
  await copyFile("dist/index.html", `dist/${path}/index.html`);
}
await writeFile(
  "dist/build.json",
  JSON.stringify({ sha: process.env.VITE_BUILD_SHA || "local", protocol: 1 }),
);
await writeFile("dist/.nojekyll", "");

// Publish the generated step viewer alongside the playable preview.
await mkdir('dist/review',{recursive:true});
await copyFile('tests/e2e/index.html','dist/review/index.html');
for(const folder of ['screenshots','walkthroughs']) {
  try{await access(`tests/e2e/${folder}`);await cp(`tests/e2e/${folder}`,`dist/review/${folder}`,{recursive:true});}catch(error){if(error.code!=='ENOENT')throw error;}
}
