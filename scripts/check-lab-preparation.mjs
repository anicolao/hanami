import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch(),context=await browser.newContext(),base=process.env.HANAMI_LAB_URL||'http://127.0.0.1:5191',pages=[],errors=[];
const prepared=async page=>{
 await expect(page.locator('#app')).toHaveAttribute('data-ready','true',{timeout:20000});
 await expect(page.frameLocator('#route-preview').locator('main')).toHaveAttribute('data-phase','playing',{timeout:15000});
};
try{
 // Keep the workbenches AND their production iframes open. Closing parents
 // would hide the HTTP channel leak this regression is intended to catch.
 for(let i=0;i<8;i++){
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));pages.push(page);
  await page.goto(`${base}/dev/animations/?view=routes&route=web&scene=opening&players=2`);await prepared(page);
 }
 // Make a real choice with eight workbenches open and observe it through a
 // ninth production client. Then close the original tab and verify that live
 // delivery continues after the shared connection changes owner.
 const actor=pages.at(-1).frameLocator('#route-preview'),peer=await context.newPage();
 await peer.goto(new URL(await pages.at(-1).locator('#route-preview').getAttribute('src'),base).href);
 await expect(peer.locator('main')).toHaveAttribute('data-phase','playing',{timeout:15000});
 const revision=Number(await actor.locator('main').getAttribute('data-revision'));
 const tile=actor.locator('.hand-tile:not(:disabled)').first(),tileId=await tile.getAttribute('data-tile');await tile.click();
 const target=actor.locator('[data-cell][data-legal=true]').first(),cell=await target.getAttribute('data-cell');await target.click();
 await expect(peer.locator(`[data-cell="${cell}"]`)).toHaveAttribute('data-board-tile',tileId,{timeout:15000});
 await expect(peer.locator('main')).toHaveAttribute('data-revision',String(revision+1));
 await pages[0].close();await actor.locator('[data-motion-idle=true]').waitFor();
 await actor.locator('.player-area [data-action=undo]').click();
 await expect(peer.locator(`[data-cell="${cell}"]`)).not.toHaveAttribute('data-board-tile',tileId,{timeout:15000});
 await expect(peer.locator('main')).toHaveAttribute('data-revision',String(revision+2));await peer.close();
 const page=pages[1];await page.bringToFront();await page.locator('#scene').selectOption('midgame');await prepared(page);
 await page.locator('#prepare').click();await prepared(page);
 // A blocked write must return usable retry controls, rather than leave the
 // lab indefinitely saying "Preparing". No game outcomes are substituted.
 const held=[];await page.route('**/documents:commit?*',route=>{held.push(route);});
 await page.locator('#prepare').click();await expect.poll(()=>held.length).toBeGreaterThan(0);
 await expect(page.locator('#app')).toHaveAttribute('data-ready','error',{timeout:20000});await expect(page.locator('#prepare')).toBeEnabled();await expect(page.locator('#route-message')).toContainText('event write timed out');
 await page.unrouteAll({behavior:'ignoreErrors'});await Promise.all(held.map(route=>route.abort().catch(()=>{})));
 await page.locator('#prepare').click();await prepared(page);
 expect(errors).toEqual([]);console.log(JSON.stringify({openWorkbenches:pages.length,realRouteFrames:pages.length,replicatedPlacementAndUndo:true,primaryTabClosed:true,midgame:true,repeatPreparation:true,blockedWrite:'bounded error and successful retry',errors}));
}finally{await browser.close();}
