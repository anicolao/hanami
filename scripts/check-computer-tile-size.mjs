import {chromium,expect} from '@playwright/test';
const base=process.env.HANAMI_LAB_URL||'http://127.0.0.1:5191',browser=await chromium.launch();
try {
 for(const map of ['nihon','tokyo'])for(const preset of ['phone-landscape','ipad-air-landscape']){
  const viewport=preset==='phone-landscape'?{width:844,height:390}:{width:1180,height:820};
  const context=await browser.newContext({viewport});
  try{
   const page=await context.newPage();await page.goto(`${base}/dev/animations/?view=routes&focus=1&viewport=${preset}&route=web&scene=opening&players=2&map=${map}`);
   await page.frameLocator('#route-preview').locator('main[data-phase=playing][data-status=synced]').waitFor({timeout:60000});
   const route=page.frames().find(f=>f.url().includes('?table=LAB')).url();await page.goto(route);await page.locator('main[data-phase=playing][data-status=synced]').waitFor();
   await page.locator('.hand-tile').first().click();await page.locator('[data-cell][data-legal=true]').first().click();await page.locator('.board-cell.occupied').waitFor();await page.locator('[data-motion-idle=true]').waitFor();
   await page.getByRole('button',{name:'Draw tiles and finish turn',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('main')?.dataset.turn.startsWith('Computer')&&document.querySelector('[data-cell][data-owner^="Computer"]')&&JSON.parse(document.querySelector('#app').dataset.motionPlan||'[]').some(f=>f.target==='board')&&document.querySelector('.component-tile-flight'),{},{timeout:30000,polling:'raf'});
   const sizes=await page.evaluate(async()=>{
    const measurements=[],target=document.querySelector('[data-cell][data-owner^="Computer"] .printed-tile'),flight=document.querySelector('.component-tile-flight'),board=target.getBoundingClientRect().width;
    for(let n=0;n<120&&flight.isConnected;n++){
     const a=flight.getBoundingClientRect();measurements.push({flight:a.width,board,x:a.x,y:a.y});
     await new Promise(requestAnimationFrame);
    }return measurements;
   });
   expect(sizes.length).toBeGreaterThan(2);for(const size of sizes)expect(size.flight).toBeCloseTo(size.board,1);
   const landed=await page.locator('[data-cell][data-owner^="Computer"] .printed-tile').first().evaluate(el=>el.getBoundingClientRect().width);
   expect(landed).toBeCloseTo(sizes[0].board,1);
   await page.waitForFunction(()=>document.querySelector('main')?.dataset.turn==='Indigo'&&document.querySelector('.component-transit .printed-tile'),{},{timeout:30000,polling:'raf'});
   const refill=await page.locator('.component-transit .printed-tile').evaluateAll(elements=>elements.map(el=>el.getBoundingClientRect().width));
   expect(refill.length).toBeGreaterThan(0);for(const width of refill)expect(width).toBeCloseTo(landed,1);
   await page.locator('[data-motion-idle=true]').waitFor();
   console.log(`${map} / ${preset}: computer placement matches board size throughout flight and landing (${landed.toFixed(2)}px); hidden refill targets use the same size.`);
  }finally{await context.close();}
 }
}finally{await browser.close();}
