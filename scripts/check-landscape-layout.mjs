import {chromium,expect} from '@playwright/test';
const base=process.env.HANAMI_LAB_URL||'http://127.0.0.1:5191',browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:844,height:390}});
 await page.goto(`${base}/dev/animations/?view=routes&focus=1&viewport=phone-landscape&route=web&scene=midgame&players=4&map=tokyo`);
 await page.frameLocator('#route-preview').locator('main[data-phase=playing][data-status=synced]').waitFor({timeout:60000});
 const route=page.frames().find(f=>f.url().includes('?table=LAB')).url();await page.goto(route);await page.locator('main[data-phase=playing][data-status=synced]').waitFor();
 for(const viewport of [{width:844,height:390},{width:667,height:375},{width:1440,height:720}]) {
  await page.setViewportSize(viewport);await expect(page.locator('main')).toHaveAttribute('data-layout','side-hand');
  await expect(page.locator('#play-information')).toHaveAttribute('aria-hidden','true');
  await expect(page.locator('.player-summary').first()).not.toBeVisible();
  const geometry=await page.evaluate(()=>{
   const board=document.querySelector('.board-surface').getBoundingClientRect(),hand=[...document.querySelectorAll('.hand-tile')].map(el=>el.getBoundingClientRect()),boardTile=document.querySelector('.board-cell .printed-tile').getBoundingClientRect(),held=document.querySelector('.hand-tile .printed-tile').getBoundingClientRect();
   return {board:{right:board.right,top:board.top,bottom:board.bottom},hand:hand.map(r=>({x:r.x,y:r.y,right:r.right,bottom:r.bottom})),boardSize:boardTile.width,handSize:held.width,page:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}};
  });
  expect(geometry.handSize).toBeCloseTo(geometry.boardSize,1);
  expect((geometry.board.top+geometry.board.bottom)/2).toBeCloseTo(viewport.height/2,1);
  expect(geometry.page.width).toBe(viewport.width);expect(geometry.page.height).toBe(viewport.height);
  for(const tile of geometry.hand){expect(tile.x).toBeGreaterThan(geometry.board.right);expect(tile.right).toBeLessThanOrEqual(viewport.width);expect(tile.y).toBeGreaterThanOrEqual(0);expect(tile.bottom).toBeLessThanOrEqual(viewport.height);expect(tile.x).toBeCloseTo(geometry.hand[0].x,1);}
  const menu=page.getByRole('button',{name:'Players and game log',exact:true});await menu.click();await expect(menu).toHaveAttribute('aria-expanded','true');
  const drawer=page.getByRole('dialog',{name:'Players and game log',exact:true});await expect(drawer).toBeVisible();await expect(drawer.locator('.player-summary')).toHaveCount(4);await expect(drawer.locator('.event-history')).toHaveCount(1);await expect(drawer.locator('.event-history li').last()).toBeInViewport();
  await expect(drawer.getByRole('button',{name:'Close players and game log',exact:true})).toBeFocused();expect(await page.locator('.board-wrap').evaluate(el=>el.inert)).toBe(true);
  await page.keyboard.press('Tab');await expect(drawer.getByRole('button',{name:'Close players and game log',exact:true})).toBeFocused();
  if(viewport.width===844){await expect.poll(async()=>Math.round((await drawer.boundingBox()).x)).toBe(0);await page.screenshot({path:'art/layout-baselines/web-phone-landscape-drawer.png'});}
  await page.keyboard.press('Escape');await expect(menu).toHaveAttribute('aria-expanded','false');await expect(menu).toBeFocused();
  await menu.click();await page.locator('.play-drawer-scrim').click({position:{x:viewport.width-10,y:viewport.height/2}});await expect(menu).toHaveAttribute('aria-expanded','false');
  console.log(`${viewport.width} × ${viewport.height}: vertical hand matches board scale; no page overflow; drawer, focus trap, Escape and backdrop work.`);
 }
 await page.getByRole('button',{name:'Players and game log',exact:true}).click();await page.setViewportSize({width:1180,height:820});await expect(page.locator('main')).toHaveAttribute('data-layout','board-first');await expect(page.locator('.player-summary').first()).toBeVisible();await expect(page.locator('.play-menu-toggle')).not.toBeVisible();expect(await page.locator('.board-wrap').evaluate(el=>el.inert)).toBe(false);console.log('iPad resize restores the bottom dock, closes the drawer and preserves the same game.');
}finally{await browser.close();}
