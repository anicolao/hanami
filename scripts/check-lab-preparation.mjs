import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch(),context=await browser.newContext(),base=process.env.HANAMI_LAB_URL||'http://127.0.0.1:5191',pages=[],errors=[];
const prepared=async page=>{
 await expect(page.locator('#app')).toHaveAttribute('data-ready','true',{timeout:20000});
 await expect(page.frameLocator('#route-preview').locator('main')).toHaveAttribute('data-phase','playing',{timeout:15000});
};
try{
 // Keep the workbenches AND their production iframes open. Closing parents
 // would hide the HTTP channel leak this regression is intended to catch.
 for(let i=0;i<3;i++){
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));pages.push(page);
  await page.goto(`${base}/dev/animations/?view=routes&route=web&scene=opening&players=2`);await prepared(page);
 }
 const page=pages[0];await page.bringToFront();await page.locator('#scene').selectOption('midgame');await prepared(page);
 await page.locator('#prepare').click();await prepared(page);
 // A blocked write must return usable retry controls, rather than leave the
 // lab indefinitely saying "Preparing". No game outcomes are substituted.
 const held=[];await page.route('**/documents:commit?*',route=>{held.push(route);});
 await page.locator('#prepare').click();await expect.poll(()=>held.length).toBeGreaterThan(0);
 await expect(page.locator('#app')).toHaveAttribute('data-ready','error',{timeout:20000});await expect(page.locator('#prepare')).toBeEnabled();await expect(page.locator('#route-message')).toContainText('event write timed out');
 await page.unrouteAll({behavior:'ignoreErrors'});await Promise.all(held.map(route=>route.abort().catch(()=>{})));
 await page.locator('#prepare').click();await prepared(page);
 expect(errors).toEqual([]);console.log(JSON.stringify({openWorkbenches:3,realRouteFrames:3,midgame:true,repeatPreparation:true,blockedWrite:'bounded error and successful retry',errors}));
}finally{await browser.close();}
