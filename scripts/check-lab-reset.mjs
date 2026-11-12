import {chromium,expect} from '@playwright/test';
const base=process.env.HANAMI_LAB_URL||'http://127.0.0.1:5191',browser=await chromium.launch();
try{
 const context=await browser.newContext(),page=await context.newPage();
 await page.goto(base);
 // Corrupt legacy display preferences only; game state still uses real events.
 await page.evaluate(()=>{localStorage.setItem('hanami:component-visuals:v1',JSON.stringify({nihon:{tile:112,duration:1400},tokyo:{tile:130}}));localStorage.setItem('hanami:route-lab:v1',JSON.stringify({viewport:'desktop',map:'tokyo'}));localStorage.setItem('hanami:animation-lab:v1',JSON.stringify({tile:112,duration:1400}));});
 await page.goto(`${base}/dev/animations/?view=routes&viewport=phone-landscape&route=web&focus=0&map=nihon&scene=opening`);
 let frame=page.frameLocator('#route-preview');await frame.locator('main[data-phase=playing][data-status=synced]').waitFor({timeout:60000});await expect(page.locator('#piece-scale')).toHaveValue('90');await expect(frame.locator('#app')).toHaveCSS('--piece-size','90%');
 const originalURL=page.url();await page.locator('#piece-scale').fill('112');await page.locator('#piece-scale').press('Tab');await expect(frame.locator('#app')).toHaveCSS('--piece-size','112%');await page.locator('#viewport').selectOption('desktop');expect(page.url()).toBe(originalURL);
 await page.reload();frame=page.frameLocator('#route-preview');await frame.locator('main[data-phase=playing][data-status=synced]').waitFor({timeout:60000});await expect(page.locator('#piece-scale')).toHaveValue('90');await expect(page.locator('#viewport')).toHaveValue('phone-landscape');await expect(frame.locator('#app')).toHaveCSS('--piece-size','90%');
 const fixture=await context.newPage();await fixture.goto(`${base}/dev/animations/?view=components&scenario=place&map=nihon&tile=112&duration=1400&gridScaleY=130&zoom=150&direction=3&hidePieces=true&overlay=true`);
 await expect(fixture.locator('[data-setting=tile]')).toHaveValue('90');await expect(fixture.locator('[data-setting=duration]')).toHaveValue('650');await expect(fixture.locator('[data-setting=zoom]')).toHaveValue('100');await expect(fixture.locator('[data-setting=hidePieces]')).not.toBeChecked();
 const fixtureURL=fixture.url();await fixture.locator('[data-setting=tile]').press('ArrowRight');await fixture.locator('[data-setting=duration]').press('ArrowRight');await expect(frame.locator('#app')).toHaveCSS('--piece-size','91%');expect(fixture.url()).toBe(fixtureURL);
 const direct=await context.newPage();await direct.goto(await page.locator('#open-route').getAttribute('href').then(path=>new URL(path,base).href));await direct.locator('main[data-phase=playing][data-status=synced]').waitFor();await expect(direct.locator('#app')).toHaveCSS('--piece-size','90%');
 await fixture.reload();await expect(fixture.locator('[data-setting=tile]')).toHaveValue('90');await expect(fixture.locator('[data-setting=duration]')).toHaveValue('650');await expect(fixture.locator('[data-setting=gridScaleY][type=number]')).toHaveValue('101.79');await expect(frame.locator('#app')).toHaveCSS('--piece-size','90%');
 const saved=await page.evaluate(()=>Object.keys(localStorage).filter(key=>['hanami:component-visuals:v1','hanami:route-lab:v1','hanami:animation-lab:v1','hanami:lab:grid-fits:v1','hanami:lab:art-grid-fits:v1'].includes(key)));expect(saved).toEqual([]);
 console.log('PASS: both labs ignore old preferences/visual URLs, preview live without saving, keep control changes out of URLs, and restore game settings on reload. Fresh real routes also start at game settings.');
}finally{await browser.close();}
