import {test,expect} from '@playwright/test';
import {TestStepHelper} from './step-helper.js';
const plan=async page=>JSON.parse(await page.locator('#app').getAttribute('data-motion-plan'));
test('The animation lab runs the production player area and animation presenter',async({browser},info)=>{
 const ca=await browser.newContext(),cb=await browser.newContext();
 const web=await ca.newPage(),guest=await cb.newPage(),lab=await ca.newPage();
 await guest.goto('/?table=PARITY&name=Bea');await web.goto('/?launch=create&table=PARITY&name=Alex');
 await lab.goto('/dev/animations/?players=2&scenario=place&duration=650&speed=1&tile=90&token=90&offsetY=-1');
 const story=new TestStepHelper(info,{Lab:lab,Web:web,Bea:guest},'The lab uses the production presenter');
 await story.step('Open the real game and the lab fixture beside it','Web',async()=>{},async()=>{
  await expect(web.locator('main')).toHaveAttribute('data-phase','gathering');
  await expect(lab.locator('[data-player] .hand-tile')).toHaveCount(5);
  await expect(lab.locator('.lab-hand-piece')).toHaveCount(0);
  await expect(lab.locator('.park-pieces .influence-badge:visible')).toHaveCount(0);
 });
 await story.step('Join the game from a second client','Bea',()=>guest.getByRole('button',{name:'Take your seat',exact:true}).click(),async()=>{
  await expect(web.locator('.gathered li')).toHaveCount(2);
 });
 await story.step('Deal the real opening hands','Web',()=>web.getByRole('button',{name:'Unfold the board',exact:true}).click(),async()=>{
  await expect(web.locator('main')).toHaveAttribute('data-phase','playing');
  await expect(web.locator('.hand-tile')).toHaveCount(5);
 });
 let tile=await web.locator('.hand-tile').first().getAttribute('data-tile');
 await story.step('Select a real held tile in the web game','Web',()=>web.locator(`[data-tile="${tile}"]`).click(),async()=>{
  await expect(web.locator(`[data-tile="${tile}"]`)).toHaveAttribute('aria-pressed','true');
  const width=p=>p.locator('.hand-tile .printed-tile').first().evaluate(el=>el.getBoundingClientRect().width);
  // Page layouts differ; both render the same rigid printed component.
  for(const page of [web,lab]){const box=await page.locator('.hand-tile .printed-tile').first().boundingBox();expect(box.width/box.height).toBeCloseTo(1.1547005384,2);}
  const bag=p=>p.locator('.draw-bag .printed-tile').evaluate(el=>el.getBoundingClientRect().width);
  expect(await bag(web)).toBeCloseTo(38,1);expect(await bag(lab)).toBeCloseTo(45,1);
 });
 let cell=await web.locator('[data-cell][data-legal=true]').first().getAttribute('data-cell');
 await story.step('Choose that same component in the lab','Lab',()=>lab.getByRole('combobox',{name:'Selected piece',exact:true}).selectOption(tile),async()=>{
  await expect(lab.locator(`[data-tile="${tile}"]`)).toHaveAttribute('aria-pressed','true');
 });
 await story.step('Place it through the production presenter in the lab','Lab',()=>lab.locator(`[data-cell="${cell}"]`).click(),async()=>{
  expect(await plan(lab)).toEqual([{source:'hand',target:'board',delay:0,duration:650,arc:60,flip:false,speed:1}]);
 });
 await story.step('Place the real tile using exactly the same flight plan','Web',()=>web.locator(`[data-cell="${cell}"]`).click(),async()=>{
  await expect(guest.locator(`[data-cell="${cell}"]`)).toHaveAttribute('data-board-tile',tile);
  expect(await plan(web)).toEqual(await plan(lab));
 });
 await story.step('Preview the production refill in the lab','Lab',()=>lab.getByRole('button',{name:'Draw tiles from the bag',exact:true}).click(),async()=>{
  expect(await plan(lab)).toEqual([{source:'bag',target:'hand',delay:0,duration:650,arc:60,flip:true,speed:1}]);
 });
 await story.step('Refill the real hand with the same perspective animation','Web',()=>web.getByRole('button',{name:'Draw tiles and finish turn',exact:true}).click(),async()=>{
  await expect(web.locator('main')).toHaveAttribute('data-turn','Bea');
  expect(await plan(web)).toEqual(await plan(lab));
 });
 await story.step('Change travel time once in the lab','Lab',()=>lab.getByRole('slider',{name:'Travel time (ms)',exact:true}).press('ArrowRight'),async()=>{
  await expect(lab.getByRole('slider',{name:'Travel time (ms)',exact:true})).toHaveValue('700');
 });
 const guestTile=await guest.locator('.hand-tile').first().getAttribute('data-tile');
 await story.step('Bea selects a real held tile','Bea',()=>guest.locator(`[data-tile="${guestTile}"]`).click(),async()=>{
  await expect(guest.locator(`[data-tile="${guestTile}"]`)).toHaveAttribute('aria-pressed','true');
 });
 const guestCell=await guest.locator('[data-cell][data-legal=true]').first().getAttribute('data-cell');
 await story.step('Bea places it on the playing field','Bea',()=>guest.locator(`[data-cell="${guestCell}"]`).click(),async()=>{
  await expect(web.locator(`[data-cell="${guestCell}"]`)).toHaveAttribute('data-board-tile',guestTile);
 });
 await story.step('Bea draws and returns the turn','Bea',()=>guest.getByRole('button',{name:'Draw tiles and finish turn',exact:true}).click(),async()=>{
  await expect(web.locator('main')).toHaveAttribute('data-turn','Alex');
 });
 tile=await web.locator('.hand-tile').first().getAttribute('data-tile');
 await story.step('Select the next real tile','Web',()=>web.locator(`[data-tile="${tile}"]`).click(),async()=>{
  await expect(web.locator(`[data-tile="${tile}"]`)).toHaveAttribute('aria-pressed','true');
 });
 cell=await web.locator('[data-cell][data-legal=true]').first().getAttribute('data-cell');
 await story.step('Select the matching lab component','Lab',()=>lab.getByRole('combobox',{name:'Selected piece',exact:true}).selectOption(tile),async()=>{
  await expect(lab.locator(`[data-tile="${tile}"]`)).toHaveAttribute('aria-pressed','true');
 });
 await story.step('Run the updated lab flight','Lab',()=>lab.locator(`[data-cell="${cell}"]`).click(),async()=>{
  expect((await plan(lab))[0].duration).toBe(700);
 });
 await story.step('The web game uses the updated production flight without a second implementation','Web',()=>web.locator(`[data-cell="${cell}"]`).click(),async()=>{
  await expect(guest.locator(`[data-cell="${cell}"]`)).toHaveAttribute('data-board-tile',tile);
  expect(await plan(web)).toEqual(await plan(lab));
 });
 story.finish();await ca.close();await cb.close();
});
