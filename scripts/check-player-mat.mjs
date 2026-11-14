import {chromium,expect} from '@playwright/test';
import {assertGameFits} from '../tests/e2e/layout-assertions.js';
const browser=await chromium.launch(),context=await browser.newContext(),base=process.env.HANAMI_LAB_URL||'http://127.0.0.1:5191',errors=[],results=[];
const ready=async p=>p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
const inspect=async p=>{
 await ready(p);await assertGameFits(p).catch(async e=>{await p.screenshot({path:"/tmp/hanami-mat-check-failure.png"});console.error(await p.locator(".table-center-controls").evaluateAll(nodes=>nodes.map(n=>({html:n.outerHTML,box:n.getBoundingClientRect().toJSON()}))));throw e;});
 return p.locator('.player-area.private-open').evaluateAll(areas=>areas.map(area=>{
  const box=el=>el.getBoundingClientRect().toJSON();
  const hand=[...area.querySelectorAll('.hand .hand-tile')].map(box),card=box(area.querySelector('.personal-ability')),pile=box(area.querySelector('.draw-bag .printed-tile'));
  const controls=[...area.querySelectorAll('.hand-tile,.personal-ability,.draw-bag,.private-captures:not([data-tray=none])')].map(box);
  const overlaps=[];
  for(let i=0;i<controls.length;i++)for(let j=0;j<i;j++){const a=controls[i],b=controls[j];if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)overlaps.push([i,j]);}
  return {hand,card,pile,overlaps,countFont:parseFloat(getComputedStyle(area.querySelector('.pile-status')).fontSize)};
 }));
};
try {
 for(const route of ['web','tabletop']) {
  const lab=await context.newPage();lab.on('pageerror',e=>errors.push(e.message));await lab.goto(`${base}/dev/animations/?view=routes&route=${route}&scene=opening&players=4`);await expect(lab.locator('#app')).toHaveAttribute('data-ready','true',{timeout:30000});
  const src=await lab.locator('#route-preview').getAttribute('src'),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(new URL(src,base).href);await expect(page.locator('main')).toHaveAttribute('data-phase','playing');await lab.close();
  if(route==='tabletop')while(await page.getByRole('button',{name:/^Reveal .*tiles$/}).count())await page.getByRole('button',{name:/^Reveal .*tiles$/}).first().click();
  // Preserve the hand sizes on established layouts; compact 568px landscape
  // now deliberately uses the larger bottom hand instead of tiny side tiles.
  const sizes=route==='web'?[[1180,820,100,64],[1440,900,100,64],[844,390,29.453125,40],[568,320,55.421875,40],[390,844,50,64]]:[[1180,820,45.84375,48],[1920,1080,74.609375,48]];
  for(const [width,height,handWidth,oldCardWidth] of sizes) {
   await page.setViewportSize({width,height});
   const mats=await inspect(page);
   for(const mat of mats){expect(mat.hand).toHaveLength(5);for(const tile of mat.hand)expect(tile.width).toBeCloseTo(handWidth,1);expect(mat.pile.width).toBeCloseTo(handWidth,1);expect(mat.card.width).toBeGreaterThan(oldCardWidth);expect(mat.card.width/mat.card.height).toBeCloseTo(1,3);expect(mat.countFont).toBeGreaterThanOrEqual(16);expect(mat.overlaps).toEqual([]);}
   results.push({route,width,height,mats:mats.length,handWidth,card:mats[0].card.width});
  }
  await page.setViewportSize({width:1180,height:820});
  // Use the real Torii card, then recheck its reverse across the viewports.
  const area=page.locator('.player-area.private-open').filter({has:page.getByRole('button',{name:'Use Torii · Indigo',exact:true})});
  await area.getByRole('button',{name:'Use Torii · Indigo',exact:true}).click();
  const tokens=await page.locator('.park-pieces.count-1 [data-token]:not(:disabled)').evaluateAll(ns=>ns.map(n=>({id:n.dataset.token,type:n.dataset.tokenType})));
  for(const t of [tokens[0],tokens.find(t=>t.type!==tokens[0].type)])await page.locator(`[data-token="${t.id}"]`).click();
  await expect(area.locator('.personal-ability [data-ability-card]')).toHaveAttribute('data-ability-card','back');
  for(const [width,height]of sizes.map(s=>s.slice(0,2))){await page.setViewportSize({width,height});for(const mat of await inspect(page))expect(mat.overlaps).toEqual([]);}
  await page.setViewportSize({width:1180,height:820});
  const normal=area.locator('.hand-tile').first(),tile=await normal.getAttribute('data-tile');await normal.click();const target=page.locator('[data-cell="2:3"][data-legal=true]'),cell=await target.getAttribute('data-cell');await target.click();await expect(page.locator(`[data-cell="${cell}"]`)).toHaveAttribute('data-board-tile',tile);await page.locator('[data-motion-idle=true]').waitFor();await inspect(page);
  const bag=area.getByRole('button',{name:'Draw tiles and finish turn',exact:true});await expect(bag).toBeEnabled();await expect(bag).toHaveAttribute('aria-description','14 tiles remaining');
  const revision=Number(await page.locator('main').getAttribute('data-revision'));await bag.click();await expect(bag).toHaveAttribute('aria-description','13 tiles remaining');await expect.poll(async()=>Number(await page.locator('main').getAttribute('data-revision'))).toBeGreaterThan(revision);await inspect(page);
  if(route==='tabletop') {
   const next=page.locator('.player-area.private-open').filter({has:page.getByRole('button',{name:'Use Torii · Pine',exact:true})});
   await next.getByRole('button',{name:/^Maneki-neko strength/}).first().click();await page.locator('[data-cell="3:2"][data-legal=true]').click();await page.locator('[data-motion-idle=true]').waitFor();await next.getByRole('button',{name:'Draw tiles and finish turn',exact:true}).click();
   await expect.poll(()=>page.locator('.private-captures>.celebration-piece').count()).toBeGreaterThan(0);
   for(const [width,height] of sizes.map(s=>s.slice(0,2))){await page.setViewportSize({width,height});for(const mat of await inspect(page))expect(mat.overlaps).toEqual([]);}
  }
  await page.close();
 }
 expect(errors).toEqual([]);console.log(JSON.stringify({viewports:results,capturesAndRefill:'real Torii/place/end events; celebration claimed by completing a park',errors}));
}finally{await browser.close();}
