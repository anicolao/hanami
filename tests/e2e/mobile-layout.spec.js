import {test,expect} from '@playwright/test';
import {TestStepHelper} from './step-helper.js';
import {assertGameFits} from './layout-assertions.js';
const sizes=[['portrait phone',390,844],['short landscape phone',480,280],['small landscape phone',568,320],['compact landscape phone',667,375],['landscape phone',844,390],['landscape phone with browser chrome',844,280],['wide landscape phone',932,430],['near-square landscape',600,500],['tablet portrait',768,1024],['tablet landscape',1180,820],['desktop',1440,900],['return to mobile landscape',844,390]];
const settle=page=>page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
for(const engine of ['Chromium','WebKit'])for(const map of ['nihon','tokyo'])test(`${engine} mobile layout survives cold loads and orientation changes on ${map}`,async({browser},info)=>{
 const contexts=await Promise.all([browser.newContext({isMobile:true,hasTouch:true,deviceScaleFactor:1,viewport:{width:844,height:390},screen:{width:844,height:390}}),browser.newContext({isMobile:true,hasTouch:true,deviceScaleFactor:1,viewport:{width:390,height:844}})]);
 try{
 // Exercise systems with permanently visible scrollbars, not only macOS's
 // overlay scrollbars. This affects intrinsic grid measurements on WebKit.
 for(const context of contexts)await context.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{const css=document.createElement('style');css.textContent='*::-webkit-scrollbar{width:15px;height:15px}';document.head.append(css);},{once:true}));
 const [a,b]=await Promise.all(contexts.map(c=>c.newPage())),errors=[],reloading=new Set(),reloadAborts=[];
 for(const page of[a,b])page.on('pageerror',e=>{
  // WebKit reports an aborted old Firestore long-poll as a CORS exception when
  // navigation destroys that document. New-document errors remain failures;
  // placement/undo below also verify the replacement stream works.
  if(engine==='WebKit'&&reloading.has(page)&&/127\.0\.0\.1:8191\/google\.firestore\.v1\.Firestore\/Listen\/channel.*due to access control checks\.$/.test(e.message))reloadAborts.push(e.message);
  else errors.push(e.message);
 });
 const story=new TestStepHelper(info,{Alex:a,Bea:b},`${engine} mobile layout · ${map}`),code=`${engine[0]}${map[0].toUpperCase()}FTHN`;
 await a.goto(`/?launch=create&table=${code}&name=AlexandriaMobilePlayer`);await b.goto(`/?table=${code}&name=Bea`);
 await story.step('Join the real invitation from a portrait phone','Bea',()=>b.getByRole('button',{name:'Take your seat',exact:true}).tap(),async()=>{await expect(a.locator('.gathered li')).toHaveCount(2);});
 await story.step('Deal directly into 844 by 390 landscape without an initial resize','Alex',async()=>{await a.getByRole('combobox',{name:'Map',exact:true}).selectOption(map);await expect(a.locator('main')).toHaveAttribute('data-status','synced');await a.getByRole('button',{name:'Unfold the board',exact:true}).tap();},async()=>{for(const p of[a,b]){await expect(p.locator('main')).toHaveAttribute('data-phase','playing');await settle(p);await assertGameFits(p);}});
 await story.step('Cold reload in landscape without a corrective window resize','Alex',async()=>{reloading.add(a);await a.reload();await expect(a.locator('main')).toHaveAttribute('data-phase','playing');reloading.delete(a);},async()=>{await settle(a);await assertGameFits(a);});
 let textMetrics;
 await story.step('Fit after text metrics change without resizing the viewport','Alex',async()=>{textMetrics=await a.addStyleTag({content:'.side-hand .turn-strip>p{font-size:14px!important}'});await settle(a);},async()=>{await assertGameFits(a);});
 for(const [name,width,height] of sizes)await story.step(`Fit every component after rotating or resizing to ${name}`,'Alex',async()=>{if(textMetrics){await textMetrics.evaluate(n=>n.remove());textMetrics=null;}await a.setViewportSize({width,height});await settle(a);},async()=>{await assertGameFits(a);expect(await a.evaluate(()=>({width:document.documentElement.clientWidth,height:document.documentElement.clientHeight}))).toEqual({width,height});});
 await test.step('The fit assertion rejects clipped artwork even if the button fits',async()=>{
  const css=await a.addStyleTag({content:'.player-area{overflow:clip!important}.hand .printed-tile{position:relative;left:100vw}'});
  try{await expect(assertGameFits(a)).rejects.toThrow(/clipped|leaves the viewport/);}finally{await css.evaluate(n=>n.remove());}
  await settle(a);await assertGameFits(a);
 });
 const tile=await a.locator('.hand-tile').evaluateAll(ns=>ns.find(n=>!['move','cover','copy','draw'].includes(n.dataset.tile)).dataset.tile);
 await story.step('Select a real tile in the fitted vertical hand','Alex',()=>a.locator(`[data-tile="${tile}"]`).tap(),async()=>{await expect(a.locator(`[data-tile="${tile}"]`)).toHaveAttribute('aria-pressed','true');});
 const cell=await a.locator('[data-cell][data-legal=true]').first().getAttribute('data-cell');
 await story.step('Place the tile and receive the actual event on the portrait phone','Alex',()=>a.locator(`[data-cell="${cell}"]`).tap(),async()=>{for(const p of[a,b])await expect(p.locator(`[data-cell="${cell}"]`)).toHaveAttribute('data-board-tile',tile);});
 await story.step('Undo from the same fitted mat','Alex',()=>a.getByRole('button',{name:'Undo last choice',exact:true}).tap(),async()=>{for(const p of[a,b])await expect(p.locator(`[data-cell="${cell}"]`)).not.toHaveAttribute('data-board-tile',tile);});
 expect(errors).toEqual([]);expect(reloadAborts.length).toBeLessThanOrEqual(1);if(reloadAborts.length)info.annotations.push({type:'WebKit navigation',description:'Old Firestore long-poll aborted during reload; replacement connection verified through placement and undo.'});story.finish();
 }finally{await Promise.all(contexts.map(c=>c.close()));}
});
