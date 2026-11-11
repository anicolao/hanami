import {test,expect} from '@playwright/test';
import {TestStepHelper} from './step-helper.js';
const rev=p=>p.locator('main').getAttribute('data-revision');
test('Real special tiles share placement, holding, cover, Copy and flip motion',async({browser},info)=>{
 const ca=await browser.newContext({viewport:{width:1920,height:1080},hasTouch:true}),cb=await browser.newContext();
 const table=await ca.newPage(),observer=await cb.newPage();
 const story=new TestStepHelper(info,{Table:table,Observer:observer},'Special tile motions through real events');
 const controls=()=>table.getByRole('region',{name:'South table controls',exact:true});
 const area=name=>table.getByRole('region',{name:`${name}’s blanket`,exact:true});
 await observer.goto('/?table=M01565&name=Observer');await table.goto('/tabletop/?launch=create&table=M01565');
 await story.step('Open an advanced picnic table and an independent observer','Table',async()=>{},async()=>{
  await expect(table.locator('[data-join-corner]')).toHaveCount(4);
  await expect(observer.locator('main')).toHaveAttribute('data-phase','empty');
 });
 for(const [corner,color] of [['South-west','Indigo'],['North-east','Pine']]){
  await story.step(`Tap the ${corner} seat`,'Table',()=>table.getByRole('button',{name:`Join ${corner}`,exact:true}).tap(),async()=>{
   await expect(table.getByRole('button',{name:`Join ${corner} as ${color}`,exact:true})).toBeVisible();
  });
  await story.step(`Join as ${color}`,'Table',()=>table.getByRole('button',{name:`Join ${corner} as ${color}`,exact:true}).tap(),async()=>{
   await expect(table.locator(`.corner-${corner.toLowerCase()} .table-seat-joined`)).toContainText(color);
  });
 }
 await story.step('Enable the real special tile set','Table',()=>controls().getByRole('checkbox',{name:'Special tiles & abilities',exact:true}).check(),async()=>{
  await expect(table.getByRole('region',{name:'North table controls',exact:true}).getByRole('checkbox',{name:'Special tiles & abilities',exact:true})).toBeChecked();
 });
 await story.step('Deal the production deck and ability choices','Table',()=>controls().getByRole('button',{name:'Start picnic',exact:true}).tap(),async()=>{
  await expect(table.locator('main')).toHaveAttribute('data-phase','choosing');
 });
 for(const [color,ability] of [['Indigo','Rainy Day'],['Pine','Akkorokamui']]){
  await story.step(`${color} chooses ${ability}`,'Table',()=>table.getByRole('button',{name:`${color}: choose ${ability}`,exact:true}).tap(),async()=>{
   await expect(table.getByRole('button',{name:`${color}: choose ${ability}`,exact:true})).toHaveCount(0);
  });
 }
 await story.step('Lift Indigo’s screen to inspect the actual dealt tiles','Table',()=>table.getByRole('button',{name:'Reveal Indigo’s tiles',exact:true}).tap(),async()=>{
  for(const tile of ['move','cover','draw','copy'])await expect(area('Indigo').locator(`[data-tile="${tile}"]`)).toBeVisible();
  for(const tile of ['draw','cover'])await expect(area('Indigo').locator(`[data-tile="${tile}"] [aria-label="Fast tile"]`)).toHaveCount(1);
  await expect(observer.locator('.hand-tile')).toHaveCount(0);
 });
 const choose=async(color,tile)=>story.step(`${color} selects ${tile}`,'Table',()=>area(color).locator(`[data-tile="${tile}"]`).tap(),async()=>{
  await expect(area(color).locator(`[data-tile="${tile}"]`)).toHaveAttribute('aria-pressed','true');
 });
 const place=async(tile,cell)=>story.step(`Place ${tile} at ${cell}`,'Table',()=>table.locator(`[data-cell="${cell}"]`).tap(),async()=>{
  await expect(table.locator(`[data-cell="${cell}"]`)).toHaveAttribute('data-board-tile',tile);
  await expect(observer.locator(`[data-cell="${cell}"]`)).toHaveAttribute('data-board-tile',tile);
 });
 const pass=async(color,next)=>story.step(`${color} refills and passes to ${next}`,'Table',()=>area(color).getByRole('button',{name:'Draw tiles and finish turn',exact:true}).tap(),async()=>{
  await expect(table.locator('main')).toHaveAttribute('data-turn',next);
 });
 await choose('Indigo','draw');await place('draw','14:6');
 // Draw is fast: its freshly drawn normal tile can be placed in this same turn.
 await choose('Indigo','onigiri-2');await place('onigiri-2','15:7');
 await pass('Indigo','Pine');
 await story.step('Lift Pine’s north-facing hand','Table',()=>table.getByRole('button',{name:'Reveal Pine’s tiles',exact:true}).tap(),async()=>{
  await expect(area('Pine').locator('.hand-tile')).toHaveCount(5);
 });
 await choose('Pine','boat-3');await place('boat-3','15:5');
 await choose('Pine','cat-0');await place('cat-0','14:7');await pass('Pine','Indigo');
 await choose('Indigo','copy');
 for(const direction of [1,2,3])await story.step(`Point Copy ${['','north-east','south-east','south'][direction]}`,'Table',()=>controls().getByRole('button',{name:'Rotate copy direction',exact:true}).tap(),async()=>{
  await expect(area('Indigo').locator('[data-tile=copy] [aria-label^="Copy direction:"]')).toHaveAttribute('aria-label',`Copy direction: ${['','north-east','south-east','south'][direction]}`);
 });
 await story.step('Drag the selected Copy and turn it with R before landing','Table',async()=>{
  const from=await area('Indigo').locator('[data-tile="copy"]').boundingBox(),to=await table.locator('[data-cell="16:7"]').boundingBox();
  await table.mouse.move(from.x+from.width/2,from.y+from.height/2);await table.mouse.down();
  await table.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:12});await table.keyboard.press('r');
  await expect(table.locator('.component-drag-ghost .printed-tile')).toHaveCSS('--tile-turn','60deg');
  await table.mouse.up();
 },async()=>{
  for(const page of [table,observer])await expect(page.locator('[data-cell="16:7"] [aria-label^="Copy direction:"]')).toHaveAttribute('aria-label','Copy direction: south-west');
 });
 await story.step('Adjust the landed Copy before finishing the turn','Table',()=>table.getByRole('button',{name:'Rotate Copy at 16:7',exact:true}).tap(),async()=>{
  for(const page of [table,observer])await expect(page.locator('[data-cell="16:7"] [aria-label^="Copy direction:"]')).toHaveAttribute('aria-label','Copy direction: north-west');
  expect(JSON.parse(await table.locator('#app').getAttribute('data-motion-plan'))[0].arc).toBe(0);
 });
 await choose('Indigo','move');
 const beforeMove=await rev(table);
 await story.step('Move replaces Copy and lifts it into the holding spot','Table',()=>table.locator('[data-cell="16:7"]').tap(),async()=>{
  await expect(area('Indigo').locator('[data-held-move]')).toBeVisible();
  await expect(table.locator('[data-cell="16:7"]')).toHaveAttribute('data-board-tile','move');
  await expect(observer.locator('[data-cell="16:7"]')).toHaveAttribute('data-board-tile','copy');expect(await rev(table)).toBe(beforeMove);
 });
 await story.step('Rotate the held Copy across north using the direction control','Table',()=>controls().getByRole('button',{name:'Rotate copy direction',exact:true}).tap(),async()=>{
  await expect(area('Indigo').locator('[data-held-move] [aria-label^="Copy direction:"]')).toHaveAttribute('aria-label','Copy direction: north');expect(await rev(table)).toBe(beforeMove);
 });
 await story.step('Tap the held Copy to turn it again','Table',()=>area('Indigo').locator('[data-held-move]').tap(),async()=>{
  await expect(area('Indigo').locator('[data-held-move] [aria-label^="Copy direction:"]')).toHaveAttribute('aria-label','Copy direction: north-east');
 });
 await story.step('Fly Copy to its new destination with the chosen direction','Table',()=>table.locator('[data-cell="16:8"]').tap(),async()=>{
  await expect(table.locator('[data-held-move]')).toHaveCount(0);
  for(const page of [table,observer]){
   await expect(page.locator('[data-cell="16:7"]')).toHaveAttribute('data-board-tile','move');
   await expect(page.locator('[data-cell="16:8"] [aria-label^="Copy direction:"]')).toHaveAttribute('aria-label','Copy direction: north-east');
  }
  await expect(table.locator('#app')).toHaveAttribute('data-motion-flights','1');await expect(observer.locator('#app')).toHaveAttribute('data-motion-flights','3');
 });
 await story.step('Turn the relocated Copy on the board','Table',()=>table.getByRole('button',{name:'Rotate Copy at 16:8',exact:true}).tap(),async()=>{
  for(const page of [table,observer])await expect(page.locator('[data-cell="16:8"] [aria-label^="Copy direction:"]')).toHaveAttribute('aria-label','Copy direction: south-east');
 });
 // Cover still covers a previously played tile; it does not use empty land.
 await choose('Indigo','cover');await place('cover','15:7');
 await story.step('Inspect the two real tiles stacked in the covered hex','Table',()=>table.getByRole('button',{name:'Inspect 2 tiles at 15:7',exact:true}).tap(),async()=>{
  const dialog=table.getByRole('dialog',{name:'Tiles in this hex',exact:true});
  await expect(dialog).toBeVisible();await expect(dialog.locator('[data-stack-level="0"]')).toHaveAttribute('data-stack-tile','cover');
  await expect(dialog.locator('[data-stack-level="1"]')).toHaveAttribute('data-stack-tile','onigiri-2');
  await expect(table.locator('[data-cell="15:7"] .board-under-tile')).toHaveCount(1);await expect(observer.locator('.tile-stack-inspector')).toHaveCount(0);
 });
 await story.step('Close tile inspection without making a game choice','Table',()=>table.getByRole('button',{name:'Close tile inspection',exact:true}).tap(),async()=>{await expect(table.locator('.tile-stack-inspector')).toHaveCount(0);});
 await pass('Indigo','Pine');
 await expect(table.locator('[data-cell="16:8"]')).toBeDisabled();
 await story.step('Activate Akkorokamui before placing a tile','Table',()=>area('Pine').getByRole('button',{name:'Use Akkorokamui',exact:true}).tap(),async()=>{
  await expect(area('Pine').locator('.personal-ability')).toHaveClass(/selected/);
 });
 await story.step('Flip the real boat in place','Table',()=>table.locator('[data-cell="15:5"]').tap(),async()=>{
  await expect(table.locator('[data-cell="15:5"] img.printed-illustration')).toHaveAttribute('alt','Pine tile reverse');
  await expect(observer.locator('[data-cell="15:5"] img.printed-illustration')).toHaveAttribute('alt','Pine tile reverse');
 });
 await choose('Pine','onigiri-3');await place('onigiri-3','14:8');await pass('Pine','Indigo');
 await story.step('Reload the observer and replay the same special-tile board','Observer',()=>observer.reload(),async()=>{
  for(const [cell,tile] of [['15:7','cover'],['16:8','copy'],['16:7','move']])await expect(observer.locator(`[data-cell="${cell}"]`)).toHaveAttribute('data-board-tile',tile);
  expect(await rev(observer)).toBe(await rev(table));
 });
 story.finish();await ca.close();await cb.close();
});
