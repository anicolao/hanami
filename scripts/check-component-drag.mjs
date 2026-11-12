import {chromium,expect} from '@playwright/test';
const base=process.env.HANAMI_LAB_URL||'http://127.0.0.1:5191';
const browser=await chromium.launch();
try {
 for(const mode of ['mouse','touch','tabletop','phone-mouse','phone-touch']) {
  const phone=mode.startsWith('phone'),touchInput=mode!=='mouse'&&mode!=='phone-mouse';
  const context=await browser.newContext({viewport:phone?{width:844,height:390}:{width:1180,height:820},hasTouch:touchInput});
  try {
   const page=await context.newPage();
   await page.goto(`${base}/dev/animations/?view=routes&focus=1&viewport=${phone?'phone-landscape':'ipad-air-landscape'}&route=${mode==='tabletop'?'tabletop':'web'}&scene=opening&players=2&map=nihon`);
   const frame=page.frameLocator('#route-preview');await frame.locator('main[data-phase=playing][data-status=synced]').waitFor({timeout:60000});
   const route=page.frames().find(f=>f.url().includes('?table=LAB')).url();await page.goto(route);
   await page.locator('main[data-phase=playing][data-status=synced]').waitFor();await page.locator('[data-motion-idle=true]').waitFor();
   if(mode==='tabletop')await page.getByRole('button',{name:'Reveal Indigo’s tiles',exact:true}).click();
   const remote=await context.newPage();await remote.goto(route);await remote.locator('main[data-phase=playing][data-status=synced]').waitFor();
   const pointer=touchInput?await context.newCDPSession(page):null;
   const touch=async(type,x,y)=>pointer.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,radiusX:8,radiusY:8,force:1,id:1}]});
   const tile=page.locator('.hand-tile:enabled').first(),tileBox=await tile.boundingBox();
   const start={x:tileBox.x+tileBox.width/2,y:tileBox.y+tileBox.height/2};
   if(pointer){await touch('touchStart',start.x,start.y);await touch('touchMove',start.x,start.y-20);}else{await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x,start.y-20,{steps:4});}
   const target=page.locator('.space-target[data-legal=true]').first(),cell=await target.getAttribute('data-cell'),box=await target.boundingBox();
   const width=await page.locator(`[data-cell-wrapper="${cell}"]`).evaluate(el=>el.getBoundingClientRect().width*(parseFloat(getComputedStyle(el).getPropertyValue('--piece-size'))||90)/100);
   const x=box.x+box.width/2,y=box.y+box.height/2+width/1.1547005384*.7+8;
   if(pointer)await touch('touchMove',x,y);else await page.mouse.move(x,y,{steps:12});
   await page.waitForTimeout(160);
   const ghost=await page.locator('.component-drag-ghost').boundingBox();expect(ghost.width).toBeCloseTo(width,1);expect(ghost.y+ghost.height).toBeLessThan(y);
   const before=await page.locator('.board-cell.occupied').count();
   if(pointer)await touch('touchEnd',x,y);else await page.mouse.up();
   await expect(page.locator(`[data-cell="${cell}"]`)).not.toHaveAttribute('data-board-tile','',{timeout:15000});
   await expect(page.locator('.board-cell.occupied')).toHaveCount(before+1);
   const plan=JSON.parse(await page.locator('#app').getAttribute('data-motion-plan'));
   expect(plan).toContainEqual(expect.objectContaining({source:'drag',target:'board',duration:160,arc:0}));expect(plan.some(f=>f.source==='hand')).toBe(false);
   await expect(remote.locator('.board-cell.occupied')).toHaveCount(before+1);
   const remotePlan=JSON.parse(await remote.locator('#app').getAttribute('data-motion-plan'));expect(remotePlan.some(f=>f.source==='drag')).toBe(false);
   await page.locator('[data-motion-idle=true]').waitFor();await expect(page.locator('.component-drag-ghost')).toHaveCount(0);
   // Pick the actual placed component back up and correct its position.
   await expect(page.locator(`[data-cell="${cell}"]`)).toHaveAttribute('data-repositionable','true');
   const handCount=await page.locator('.hand-tile').count();
   const placedBox=await page.locator(`[data-cell="${cell}"]`).boundingBox();
   const sx=placedBox.x+placedBox.width/2,sy=placedBox.y+placedBox.height/2;
   if(pointer){await touch('touchStart',sx,sy);await touch('touchMove',sx+10,sy);}else{await page.mouse.move(sx,sy);await page.mouse.down();await page.mouse.move(sx+10,sy,{steps:3});}
   const corrected=page.locator('.space-target[data-legal=true]').first(),correctedCell=await corrected.getAttribute('data-cell'),correctedBox=await corrected.boundingBox();
   const cx=correctedBox.x+correctedBox.width/2,cy=correctedBox.y+correctedBox.height/2+width/1.1547005384*.7+8;
   if(pointer)await touch('touchMove',cx,cy);else await page.mouse.move(cx,cy,{steps:10});
   if(pointer)await touch('touchEnd',cx,cy);else await page.mouse.up();
   await expect(page.locator(`[data-cell="${cell}"]`)).toHaveAttribute('data-board-tile','');
   await expect(page.locator(`[data-cell="${correctedCell}"]`)).not.toHaveAttribute('data-board-tile','');
   await expect(remote.locator(`[data-cell="${correctedCell}"]`)).not.toHaveAttribute('data-board-tile','');
   await expect(page.locator('.hand-tile')).toHaveCount(handCount);
   expect(JSON.parse(await page.locator('#app').getAttribute('data-motion-plan'))).toContainEqual(expect.objectContaining({source:'drag',duration:160,arc:0}));
   await page.locator('[data-motion-idle=true]').waitFor();
   if(mode==='mouse') {
    await page.locator('.player-area [data-action=undo]').click();await expect(page.locator(`[data-cell="${cell}"]`)).not.toHaveAttribute('data-board-tile','');await page.locator('[data-motion-idle=true]').waitFor();
    await page.locator('.player-area [data-action=undo]').click();await expect(page.locator('.board-cell.occupied')).toHaveCount(before);await page.locator('[data-motion-idle=true]').waitFor();
    await page.locator('.hand-tile').first().click();await page.locator('.space-target[data-legal=true]').first().click();await expect(page.locator('.board-cell.occupied')).toHaveCount(before+1);
    const tap=JSON.parse(await page.locator('#app').getAttribute('data-motion-plan'));expect(tap).toContainEqual(expect.objectContaining({source:'hand',duration:650,arc:60}));
   }
   console.log(`${mode}: board-size tile above pointer, release-position settle, re-grab correction without spending a tile, replicated real events; remote flight preserved${mode==='mouse'?'; undo and tap flight preserved':''}.`);
  } finally {await context.close();}
 }
} finally {await browser.close();}
