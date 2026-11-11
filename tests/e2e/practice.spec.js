import {test,expect} from '@playwright/test';
import {TestStepHelper} from './step-helper.js';
const phase=p=>p.locator('main').getAttribute('data-phase');
const readyForHuman=async p=>expect.poll(async()=>await phase(p)==='finished'||await p.locator('main').getAttribute('data-turn')==='Alex',{timeout:30000}).toBe(true);

test('Practice from the front door through computer turns reload undo and victory',async({browser},info)=>{
 const ca=await browser.newContext(),cb=await browser.newContext();
 // Stabilize only the UI-generated invitation code. Auth IDs, game choices,
 // events, hands, captures and results are all produced by the real application.
 await ca.addInitScript(()=>{
  const original=Crypto.prototype.getRandomValues;
  Crypto.prototype.getRandomValues=function(array){if(array instanceof Uint8Array&&array.length===4){array.set([25,27,10,12]);return array;}return original.call(this,array);};
 });
 const human=await ca.newPage(),observer=await cb.newPage();
 await human.goto('/');await observer.goto('/?table=PRACHN&name=Observer');
 const story=new TestStepHelper(info,{Alex:human,Observer:observer},'Practice against the computer — complete game');
 await story.step('Choose practice from the entrance','Alex',async()=>{
  await human.getByRole('button',{name:'Practice',exact:true}).click();
  await human.getByRole('textbox',{name:'Your name',exact:true}).fill('Alex');
 },async()=>{await expect(human.getByRole('button',{name:'Practice with the computer',exact:true})).toBeVisible();});
 await story.step('Invite the computer through the real create choice','Alex',()=>human.getByRole('button',{name:'Practice with the computer',exact:true}).click(),async()=>{
  await expect(human.locator('.gathered li')).toHaveCount(2);await expect(observer.locator('.gathered')).toContainText('Computer');
  await expect(human.getByRole('combobox',{name:'Seats',exact:true})).toHaveValue('2');
 });
 await story.step('Deal both hands from the ordinary event log','Alex',()=>human.getByRole('button',{name:'Unfold the board',exact:true}).click(),async()=>{
  await expect(human.locator('main')).toHaveAttribute('data-turn','Alex');await expect(human.locator('.hand-tile')).toHaveCount(5);await expect(observer.locator('.hand-tile')).toHaveCount(0);
 });
 let directUndo=false,consentedUndo=false,reloaded=false,turns=0;
 while(await phase(human)==='playing'&&turns++<50) {
  await readyForHuman(human);if(await phase(human)==='finished')break;
  const ids=await human.locator('.hand-tile').evaluateAll(els=>els.map(e=>e.dataset.tile));
  const choices=[...ids.filter(id=>id!=='move'),...ids.filter(id=>id==='move')];let placed=false;
  for(const tile of choices) {
   await story.step(`Select ${tile} from the private hand`,'Alex',()=>human.locator(`[data-tile="${tile}"]`).click(),async()=>{await expect(human.locator(`[data-tile="${tile}"]`)).toHaveAttribute('aria-pressed','true');});
   let cell=await human.locator('[data-cell][data-legal=true]').count()?await human.locator('[data-cell][data-legal=true]').first().getAttribute('data-cell'):null;
   if(!cell){await story.step('Put back a tile without a legal target','Alex',()=>human.getByRole('button',{name:'Cancel selection',exact:true}).click(),async()=>{await expect(human.locator('.hand-tile.selected')).toHaveCount(0);});continue;}
   let expectedTile=tile;
   if(tile==='move') {
    expectedTile=await human.locator(`[data-cell="${cell}"]`).getAttribute('data-board-tile');
    await story.step('Replace an owned tile with Move and lift it to the holding spot','Alex',()=>human.locator(`[data-cell="${cell}"]`).click(),async()=>{await expect(human.locator('[data-held-move]')).toHaveCount(1);});
    cell=await human.locator('[data-cell][data-legal=true]').first().getAttribute('data-cell');
   }
   const destination=cell;
   await story.step(`Place ${tile} on ${destination}`,'Alex',()=>human.locator(`[data-cell="${destination}"]`).click(),async()=>{await expect(human.locator(`[data-cell="${destination}"]`)).toHaveAttribute('data-board-tile',expectedTile);await expect(observer.locator(`[data-cell="${destination}"]`)).toHaveAttribute('data-board-tile',expectedTile);});
   if(!directUndo) {
    await story.step('Undo a placement before any new information','Alex',()=>human.getByRole('button',{name:'Undo last choice',exact:true}).click(),async()=>{await expect(human.locator('.hand-tile')).toHaveCount(5);await expect(human.locator('.undo-consent')).toHaveCount(0);});
    directUndo=true;break;
   }
   placed=true;break;
  }
  if(!placed&&ids.length)continue;
  const before=Number(await human.locator('main').getAttribute('data-revision'));
  await story.step(reloaded?'Draw and let the computer play its real turn':'Draw then reload while the computer takes its turn','Alex',async()=>{
   await human.getByRole('button',{name:'Draw tiles and finish turn',exact:true}).click();
   if(!reloaded){await expect(human.locator('main')).toHaveAttribute('data-turn','Computer');await human.reload();reloaded=true;}
  },async()=>{
   await expect.poll(async()=>Number(await human.locator('main').getAttribute('data-revision'))).toBeGreaterThan(before);
   await readyForHuman(human);
   if(await phase(human)!=='finished')await expect(human.locator('.event-history')).toContainText('Computer finished their turn');
  });
  if(!consentedUndo&&await phase(human)==='playing') {
   await story.step('Ask to undo after the draw and the computer response','Alex',()=>human.getByRole('button',{name:'Request undo',exact:true}).click(),async()=>{
    await expect(human.locator('.undo-consent')).toHaveCount(0);await expect(human.locator('.event-history')).toContainText('Computer agreed to undo');await expect(human.locator('main')).toHaveAttribute('data-turn','Alex');
   });
   consentedUndo=true;
   const repeatRevision=Number(await human.locator('main').getAttribute('data-revision'));
   await story.step('Repeat the draw and let the computer resume from replay','Alex',()=>human.getByRole('button',{name:'Draw tiles and finish turn',exact:true}).click(),async()=>{await expect.poll(async()=>Number(await human.locator('main').getAttribute('data-revision'))).toBeGreaterThan(repeatRevision);await readyForHuman(human);});
  }
 }
 await story.step('Reveal the true event-driven result to both clients','Alex',async()=>{},async()=>{
  await expect(human.locator('main')).toHaveAttribute('data-phase','finished');await expect(observer.locator('main')).toHaveAttribute('data-phase','finished');
  await expect(human.locator('.victory')).toBeVisible();
 });
 const revision=await human.locator('main').getAttribute('data-revision');
 await story.step('Reload the complete practice game without adding choices','Alex',()=>human.reload(),async()=>{await expect(human.locator('main')).toHaveAttribute('data-phase','finished');await expect(human.locator('main')).toHaveAttribute('data-revision',revision);});
 story.finish();await ca.close();await cb.close();
});

test('Add a computer to a normal gathering and let it choose a special ability',async({browser},info)=>{
 const context=await browser.newContext(),page=await context.newPage();await page.goto('/?launch=create&table=BOTAB&name=Alex');
 const story=new TestStepHelper(info,{Alex:page},'Invite a computer and choose special abilities');
 await story.step('Add a computer to an ordinary gathering','Alex',()=>page.getByRole('button',{name:'Add computer opponent',exact:true}).click(),async()=>{await expect(page.locator('.gathered li')).toHaveCount(2);});
 await story.step('Choose Tokyo','Alex',()=>page.getByRole('combobox',{name:'Map',exact:true}).selectOption('tokyo'),async()=>{await expect(page.getByRole('combobox',{name:'Map',exact:true})).toHaveValue('tokyo');});
 await story.step('Include the special components','Alex',()=>page.getByRole('checkbox',{name:'Special tiles & abilities',exact:true}).check(),async()=>{await expect(page.getByRole('checkbox',{name:'Special tiles & abilities',exact:true})).toBeChecked();});
 await story.step('Deal ability choices for both players','Alex',()=>page.getByRole('button',{name:'Unfold the board',exact:true}).click(),async()=>{await expect(page.locator('.draft-cards button')).toHaveCount(2);await expect.poll(async()=>page.locator('main').getAttribute('data-revision')).toBe('6');});
 await story.step('Choose a real ability card; the computer has chosen its own','Alex',()=>page.locator('.draft-cards button').first().click(),async()=>{await expect(page.locator('main')).toHaveAttribute('data-phase','playing');await expect(page.locator('.personal-ability')).toHaveCount(1);});
 story.finish();await context.close();
});
