import {chromium} from '@playwright/test';
import {PNG} from 'pngjs';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {viewports} from '../src/lab/route-presets.js';
const base=process.env.HANAMI_LAB_URL||'http://127.0.0.1:5191';
const directory=new URL('../art/layout-baselines/',import.meta.url);await mkdir(directory,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--disable-gpu','--force-device-scale-factor=1','--font-render-hinting=none','--disable-lcd-text','--disable-font-subpixel-positioning','--force-color-profile=srgb','--disable-skia-runtime-opts','--disable-partial-raster','--disable-checker-imaging','--run-all-compositor-stages-before-draw']});
const records=[];
async function settled(page){
 await page.locator('main[data-phase="playing"][data-status="synced"]').waitFor();
 await page.locator('[data-table-view][data-motion-idle="true"]').waitFor();
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode()));});
}
async function stable(take){let previous,identical=0;for(let n=0;n<15;n++){const buffer=await take(),png=PNG.sync.read(buffer);if(previous&&png.data.equals(previous.data))identical++;else identical=0;if(identical===2)return buffer;previous=png;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Layout did not settle to three identical frames');}
try{
 for(const route of ['web','tabletop']){
  const profiles=route==='web'?['ipad-air-landscape','phone-landscape','desktop']:['ipad-air-landscape','phone-landscape'];
  for(const id of profiles){
   // Fresh documents, identical CSS viewports and device-pixel origins. This
   // avoids comparing a resized/previously sampled image with a cold image.
   const context=await browser.newContext({viewport:{width:2000,height:1300},deviceScaleFactor:1,locale:'en-CA',timezoneId:'America/Toronto'});
   try{
    const profile=viewports.find(p=>p.id===id),lab=await context.newPage(),errors=[];
    lab.on('pageerror',error=>errors.push(error.message));
    await lab.goto(`${base}/dev/animations/?view=routes&focus=1&route=${route}&viewport=${id}&scene=midgame&players=2&map=nihon`);
    await lab.locator('#app[data-ready="true"]').waitFor({timeout:60000});
    await lab.frameLocator('#route-preview').locator('main[data-phase="playing"][data-status="synced"]').waitFor({timeout:30000});
    const child=lab.frames().find(frame=>frame.url().includes('?table=LAB'));
    if(!child)throw Error('The lab did not load an ordinary game invitation route');
    await settled(child);
    const viewport=await child.evaluate(()=>({width:innerWidth,height:innerHeight}));
    if(viewport.width!==profile.width||viewport.height!==profile.height)throw Error(`Wrong real viewport: ${JSON.stringify(viewport)}`);
    const bounds=await lab.locator('#route-preview').boundingBox();
    if(bounds.x!==0||bounds.y!==0)throw Error('Focused frame is not at the device pixel origin');
    const direct=await context.newPage();await direct.setViewportSize(viewport);await direct.goto(child.url());await settled(direct);
    if(route==='tabletop'){for(const page of [child,direct]){await page.getByRole('button',{name:'Reveal Indigo’s tiles',exact:true}).click();await settled(page);}}
    await lab.mouse.move(profile.width-1,profile.height/2);await direct.mouse.move(profile.width-1,profile.height/2);
    const framed=await stable(()=>lab.locator('#route-preview').screenshot({animations:'disabled'}));
    const standalone=await stable(()=>direct.screenshot({animations:'disabled'}));
    const a=PNG.sync.read(framed),b=PNG.sync.read(standalone);
    let different=0;if(a.width!==b.width||a.height!==b.height)throw Error('Frame size differs from the standalone viewport');
    for(let i=0;i<a.data.length;i+=4)if(!a.data.subarray(i,i+4).equals(b.data.subarray(i,i+4)))different++;
    const dom=await child.locator('#app').ariaSnapshot(),directDom=await direct.locator('#app').ariaSnapshot(),name=`${route}-${id}`;
    await writeFile(new URL(`${name}.png`,directory),standalone);await writeFile(new URL(`${name}.dom.txt`,directory),dom+'\n');
    if(different||dom!==directDom){await writeFile(new URL(`${name}-framed.png`,directory),framed);throw Error(`${name}: ${different} pixels differ; DOM equal=${dom===directDom}`);}
    await rm(new URL(`${name}-framed.png`,directory),{force:true});
    const metrics=await direct.evaluate(()=>{const board=document.querySelector('.board-surface').getBoundingClientRect();return {viewport:{width:innerWidth,height:innerHeight},page:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},board:{width:Math.round(board.width),height:Math.round(board.height)},route:location.pathname};});
    if(metrics.route!==(route==='web'?'/':'/tabletop/'))throw Error('Capture did not use the production route');
    if(errors.length)throw Error(errors.join('\n'));
    records.push({name,profile:profile.name,mode:route,metrics,differentPixels:different});
    console.log(`${name}: exact route/frame pixels and DOM match; page ${metrics.page.width} × ${metrics.page.height}`);
   }finally{await context.close();}
  }
 }
 await writeFile(new URL('manifest.json',directory),JSON.stringify(records,null,2)+'\n');
 await writeFile(new URL('README.md',directory),`# Current production-route layout baselines\n\nGenerated by \`npm run lab:capture\` against the local emulator dev server. Every capture uses the actual game route and a legal event-created three-round game. Tabletop screens were opened using the real reveal control. Both documents start fresh at the same viewport and pixel origin (Focus route), aligning Chromium's background dithering as well as layout. No game-layout overrides, state injection, masks or image post-processing. Each framed viewport matched the standalone route's decoded RGBA pixels and accessible DOM exactly.\n\n${records.map(r=>`## ${r.profile} · ${r.mode}\n\nViewport ${r.metrics.viewport.width} × ${r.metrics.viewport.height}; page ${r.metrics.page.width} × ${r.metrics.page.height}; board ${r.metrics.board.width} × ${r.metrics.board.height}. Pixel differences: ${r.differentPixels}.\n\n![Current ${r.mode} layout](${r.name}.png)\n\n[Accessible DOM](${r.name}.dom.txt)`).join('\n\n')}\n`);
}finally{await browser.close();}
