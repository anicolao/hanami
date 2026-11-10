import { mkdir, copyFile, writeFile } from "node:fs/promises";
for (const path of ["gallery", "tabletop", "dev/animations", "lab"]) {
  await mkdir(`dist/${path}`, { recursive: true });
  await copyFile("dist/index.html", `dist/${path}/index.html`);
}
await writeFile(
  "dist/build.json",
  JSON.stringify({ sha: process.env.VITE_BUILD_SHA || "local", protocol: 1 }),
);
await writeFile("dist/.nojekyll", "");
