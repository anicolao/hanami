import {test,expect} from '@playwright/test';
import {TestStepHelper} from './step-helper.js';
const sizes=[['iPad Air',1180,820],['iPad',1024,768],['desktop',1440,900],['short landscape',1024,620],['phone landscape',844,390],['compact phone landscape',667,375],['small phone landscape',568,320],['phone portrait',390,844]];
for(const map of ['nihon','tokyo'])test(`Power cards and undo consent fit the real game at every viewport on ${map}`,async({browser},info)=>{
 const ca=await browser.newContext({hasTouch:true}),cb=await browser.newContext({hasTouch:true});
 const a=await ca.newPage(),b=await cb.newPage();
 const story=new TestStepHelper(info,{Alex:a,Bea:b},`Readable powers and undo consent without scrolling · ${map==='nihon'?'Nihon':'Tokyo'}`);
 const code=map==='nihon'?'FITNHN':'FITTHN';
 await a.goto(`/?launch=create&table=${code}&name=Alex`);await b.goto(`/?table=${code}&name=Bea`);
 await story.step('Join the picnic through the real invitation','Bea',()=>b.getByRole('button',{name:'Take your seat',exact:true}).tap(),async()=>{await expect(a.locator('.gathered li')).toHaveCount(2);});
 await story.step('Deal two single-use powers to each player','Alex',async()=>{
  const before=Number(await a.locator('main').getAttribute('data-revision'));
  await a.getByRole('combobox',{name:'Map',exact:true}).selectOption(map);
  await expect.poll(async()=>Number(await a.locator('main').getAttribute('data-revision'))).toBeGreaterThan(before);
  await a.getByRole('checkbox',{name:'Special tiles & abilities',exact:true}).check();
  await expect(a.getByRole('checkbox',{name:'Special tiles & abilities',exact:true})).toBeChecked();
  await expect(a.locator('main')).toHaveAttribute('data-status','synced');
  await a.getByRole('button',{name:'Unfold the board',exact:true}).tap();
 },async()=>{for(const page of [a,b])await expect(page.locator('[data-draft]')).toHaveCount(2);});
 for(const [name,width,height]of sizes){
  await story.step(`Read both power cards on ${name}`,'Alex',async()=>{await a.setViewportSize({width,height});await b.setViewportSize({width,height});},async()=>{
   const card=a.locator('[data-draft]').first();const normal=await card.evaluate(el=>({paper:getComputedStyle(el).backgroundColor,ink:getComputedStyle(el).color}));
   await card.hover();await expect(card).toHaveCSS('background-color',normal.paper);await expect(card).toHaveCSS('color',normal.ink);await expect(card).toHaveCSS('outline-color','rgb(255, 220, 85)');
  },{parkMouse:false});
 }
 await story.step('Keyboard focus gives the same gold glow without darkening','Alex',async()=>{for(let presses=0;presses<8;presses++){await a.keyboard.press('Tab');if(await a.locator('[data-draft]').first().evaluate(el=>document.activeElement===el))break;}await expect(a.locator('[data-draft]').first()).toBeFocused();},async()=>{
  await expect(a.locator('[data-draft]').first()).toHaveCSS('background-color','rgb(240, 226, 196)');await expect(a.locator('[data-draft]').first()).toHaveCSS('outline-color','rgb(255, 220, 85)');
 });
 await story.step('Alex keeps one of the actual dealt powers','Alex',()=>a.locator('[data-draft]').first().tap(),async()=>{await expect(a.locator('[data-draft]')).toHaveCount(0);});
 await story.step('Bea keeps a power and begins real play','Bea',()=>b.locator('[data-draft]').first().tap(),async()=>{for(const page of [a,b])await expect(page.locator('main')).toHaveAttribute('data-phase','playing');});
 const tile=await a.locator('.hand-tile').evaluateAll(nodes=>nodes.find(n=>!['move','cover','copy','draw'].includes(n.dataset.tile)).dataset.tile);
 await story.step('Select a real tile from the private hand','Alex',()=>a.locator(`[data-tile="${tile}"]`).tap(),async()=>{await expect(a.locator(`[data-tile="${tile}"]`)).toHaveAttribute('aria-pressed','true');});
 const cell=await a.locator('[data-legal=true]').first().getAttribute('data-cell');
 await story.step('Place that tile on a legal hex','Alex',()=>a.locator(`[data-cell="${cell}"]`).tap(),async()=>{for(const page of [a,b])await expect(page.locator(`[data-cell="${cell}"]`)).toHaveAttribute('data-board-tile',tile);});
 await story.step('Draw new information and finish the turn','Alex',()=>a.getByRole('button',{name:'Draw tiles and finish turn',exact:true}).tap(),async()=>{for(const page of [a,b])await expect(page.locator('main')).toHaveAttribute('data-turn','Bea');});
 await story.step('Ask permission to undo the draw','Alex',()=>a.getByRole('button',{name:'Request undo',exact:true}).tap(),async()=>{for(const page of [a,b])await expect(page.getByRole('dialog',{name:'Undo consent request',exact:true})).toBeVisible();});
 for(const [name,width,height]of sizes){
  await story.step(`Keep every consent control over the map on ${name}`,'Bea',async()=>{await a.setViewportSize({width,height});await b.setViewportSize({width,height});for(const page of [a,b]){await page.mouse.wheel(0,600);await page.keyboard.press('PageDown');}},async()=>{
   const dialog=b.getByRole('dialog',{name:'Undo consent request',exact:true});
   await expect(dialog).toBeInViewport({ratio:1});await expect(b.getByRole('button',{name:'Bea agrees to undo',exact:true})).toBeInViewport({ratio:1});
   expect(await dialog.evaluate(el=>el.matches(':modal'))).toBe(true);
   const box=await dialog.boundingBox(),map=await b.locator('.board-surface').boundingBox();expect(box.y).toBeLessThan(map.y+map.height);expect(box.y+box.height).toBeGreaterThan(map.y);
  });
 }
 await story.step('Decline from the visible dialog without scrolling','Bea',()=>b.getByRole('button',{name:'Bea declines undo',exact:true}).tap(),async()=>{for(const page of [a,b])await expect(page.locator('.undo-consent')).toHaveCount(0);});
 await story.step('Request consent again through the player mat','Alex',()=>a.getByRole('button',{name:'Request undo',exact:true}).tap(),async()=>{await expect(b.getByRole('button',{name:'Bea agrees to undo',exact:true})).toBeVisible();});
 await story.step('Agree and replay the actual undo event','Bea',()=>b.getByRole('button',{name:'Bea agrees to undo',exact:true}).tap(),async()=>{for(const page of [a,b]){await expect(page.locator('.undo-consent')).toHaveCount(0);await expect(page.locator('main')).toHaveAttribute('data-turn','Alex');}});
 story.finish();await ca.close();await cb.close();
});
