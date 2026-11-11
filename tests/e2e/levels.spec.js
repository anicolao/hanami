import {test,expect} from '@playwright/test';
import {TestStepHelper} from './step-helper.js';
for(const level of ['medium','hard'])test(`${level} practice persists its level through real turns reload and undo`,async({browser},info)=>{
 const context=await browser.newContext(),code=level==='medium'?'PRMDHN':'PRHDHN';
 await context.addInitScript(bytes=>{
  const original=Crypto.prototype.getRandomValues;
  Crypto.prototype.getRandomValues=function(array){if(array instanceof Uint8Array&&array.length===4){array.set(bytes);return array;}return original.call(this,array);};
 },Array.from(code.slice(0,4),c=>parseInt(c,36)));
 const page=await context.newPage();await page.goto('/');
 const title=level[0].toUpperCase()+level.slice(1),story=new TestStepHelper(info,{Player:page},`${title} computer: level, turn, reload and undo`);
 const humanTurn=async()=>{await expect(page.locator('main')).toHaveAttribute('data-turn','Alex',{timeout:30000});await expect(page.locator('.player-summary[data-seat-name="Computer"] .computer-level')).toHaveText(title);};
 await story.step(`Select ${title} practice`,'Player',async()=>{
  await page.getByRole('button',{name:'Practice',exact:true}).click();
  await page.getByRole('textbox',{name:'Your name',exact:true}).fill('Alex');
  await page.getByRole('combobox',{name:'Computer level',exact:true}).selectOption(level);
 },async()=>{await expect(page.getByRole('combobox',{name:'Computer level',exact:true})).toHaveValue(level);});
 await story.step('Create a table with the selected computer level','Player',()=>page.getByRole('button',{name:'Practice with the computer',exact:true}).click(),async()=>{
  await expect(page.locator('.gathered li')).toHaveCount(2);await expect(page.locator('.gathered li').last()).toContainText(title);
  await expect(page.getByRole('combobox',{name:'Seats',exact:true}).getByRole('option',{name:'3',exact:true})).toBeDisabled();
  await expect(page.getByRole('combobox',{name:'Seats',exact:true}).getByRole('option',{name:'4',exact:true})).toBeDisabled();
 });
 await story.step('Reload the chosen level before dealing','Player',()=>page.reload(),async()=>{await expect(page.locator('.gathered li').last()).toContainText(title);});
 await story.step('Start a real game','Player',()=>page.getByRole('button',{name:'Unfold the board',exact:true}).click(),async()=>{await humanTurn();await expect(page.locator('.hand-tile')).toHaveCount(5);});
 const tile=await page.locator('.hand-tile').first().getAttribute('data-tile');
 await story.step('Select a tile from the real private hand','Player',()=>page.locator(`[data-tile="${tile}"]`).click(),async()=>{await expect(page.locator('[data-cell][data-legal=true]').first()).toBeVisible();});
 const cell=await page.locator('[data-cell][data-legal=true]').first().getAttribute('data-cell');
 await story.step('Place it on the board','Player',()=>page.locator(`[data-cell="${cell}"]`).click(),async()=>{await expect(page.locator(`[data-cell="${cell}"]`)).toHaveAttribute('data-board-tile',tile);});
 const revision=Number(await page.locator('main').getAttribute('data-revision'));
 await story.step('Draw and reload while the selected computer takes its turn','Player',async()=>{
  await page.getByRole('button',{name:'Draw tiles and finish turn',exact:true}).click();
  await expect(page.locator('main')).toHaveAttribute('data-turn','Computer');await page.reload();
 },async()=>{await expect.poll(async()=>Number(await page.locator('main').getAttribute('data-revision'))).toBeGreaterThan(revision+1);await humanTurn();await expect(page.locator('.event-history')).toContainText('Computer finished their turn');});
 await story.step('Request undo and receive consent from this level','Player',()=>page.getByRole('button',{name:'Request undo',exact:true}).click(),async()=>{await humanTurn();await expect(page.locator('.undo-consent')).toHaveCount(0);await expect(page.locator('.event-history')).toContainText('Computer agreed to undo');});
 const repeatRevision=Number(await page.locator('main').getAttribute('data-revision'));
 await story.step('Draw again and let the same computer resume','Player',()=>page.getByRole('button',{name:'Draw tiles and finish turn',exact:true}).click(),async()=>{await expect.poll(async()=>Number(await page.locator('main').getAttribute('data-revision'))).toBeGreaterThan(repeatRevision+1);await humanTurn();});
 story.finish();await context.close();
});
