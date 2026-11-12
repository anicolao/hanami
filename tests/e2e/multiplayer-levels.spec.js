import {test,expect} from '@playwright/test';
import {TestStepHelper} from './step-helper.js';
const phase=page=>page.locator('main').getAttribute('data-phase');
const turn=page=>page.locator('main').getAttribute('data-turn');
const status=page=>page.locator('main').evaluate(el=>({phase:el.dataset.phase,turn:el.dataset.turn}));
async function humanPlacement(story,page,name,pages,area=page){
 const ids=await area.locator('.hand-tile[data-tile]').evaluateAll(nodes=>nodes.map(n=>n.dataset.tile));
 for(const tile of [...ids.filter(id=>id!=='move'),...ids.filter(id=>id==='move')]){
  await story.step(`Select ${tile} from ${name}’s real hand`,name,()=>area.locator(`[data-tile="${tile}"]`).click(),async()=>{await expect(area.locator(`[data-tile="${tile}"]`)).toHaveAttribute('aria-pressed','true');});
  let cell=await page.locator('[data-cell][data-legal=true]').count()?await page.locator('[data-cell][data-legal=true]').first().getAttribute('data-cell'):null;
  if(!cell){await story.step('Return a tile without a legal target',name,()=>page.getByRole('button',{name:'Cancel selection',exact:true}).first().click(),async()=>{await expect(area.locator('.hand-tile.selected')).toHaveCount(0);});continue;}
  let expected=tile;
  if(tile==='move'){
   expected=await page.locator(`[data-cell="${cell}"]`).getAttribute('data-board-tile');
   await story.step('Lift the real tile with Move',name,()=>page.locator(`[data-cell="${cell}"]`).click(),async()=>{await expect(area.locator('[data-held-move]')).toBeVisible();});
   cell=await page.locator('[data-cell][data-legal=true]').first().getAttribute('data-cell');
  }
  await story.step(`Place ${tile} at ${cell}`,name,()=>page.locator(`[data-cell="${cell}"]`).click(),async()=>{for(const view of pages)await expect(view.locator(`[data-cell="${cell}"]`)).toHaveAttribute('data-board-tile',expected);});
  return;
 }
 expect(ids.length,'A player without a legal placement must have an empty hand').toBe(0);
}
test('Four players choose independent computer levels and play through real victory',async({browser},info)=>{
 const ca=await browser.newContext(),cb=await browser.newContext(),host=await ca.newPage(),guest=await cb.newPage();
 await guest.goto('/?table=MLV4HN&name=Bea');await host.goto('/?launch=create&table=MLV4HN&name=Alex');
 const story=new TestStepHelper(info,{Alex:host,Bea:guest},'Four players and independently selected computer levels — complete game');
 for(const [name,level] of [['Computer','medium'],['Computer 3','hard']]){
  await story.step(`Invite ${name}`,'Alex',()=>host.getByRole('button',{name:'Add computer opponent',exact:true}).click(),async()=>{await expect(host.getByRole('combobox',{name:`${name} level`,exact:true})).toHaveValue('easy');});
  await story.step(`Set ${name} to ${level}`,'Alex',()=>host.getByRole('combobox',{name:`${name} level`,exact:true}).selectOption(level),async()=>{
   await expect(host.getByRole('combobox',{name:`${name} level`,exact:true})).toHaveValue(level);await expect(guest.locator('.gathered li').filter({has:guest.getByText(name,{exact:true})})).toContainText(`${level[0].toUpperCase()+level.slice(1)} computer`);
  });
 }
 await story.step('Bea takes the fourth seat','Bea',()=>guest.getByRole('button',{name:'Take your seat',exact:true}).click(),async()=>{await expect(host.locator('.gathered li')).toHaveCount(4);});
 await story.step('Reload and restore both computer levels from events','Alex',()=>host.reload(),async()=>{for(const [name,level] of [['Computer','medium'],['Computer 3','hard']])await expect(host.getByRole('combobox',{name:`${name} level`,exact:true})).toHaveValue(level);});
 await story.step('Deal four real hands','Alex',()=>host.getByRole('button',{name:'Unfold the board',exact:true}).click(),async()=>{await expect(host.locator('main')).toHaveAttribute('data-turn','Alex');await expect(host.locator('.player-summary')).toHaveCount(4);});
 for(let turns=0;await phase(host)==='playing'&&turns<100;turns++){
  await expect.poll(async()=>{const s=await status(host);return s.phase==='finished'||['Alex','Bea'].includes(s.turn);},{timeout:30000}).toBe(true);
  if(await phase(host)==='finished')break;
  const name=await turn(host),page=name==='Alex'?host:guest;
  await humanPlacement(story,page,name,[host,guest]);
  await story.step(`${name} refills and lets the next seats play`,name,()=>page.getByRole('button',{name:'Draw tiles and finish turn',exact:true}).click(),async()=>{
   await expect.poll(async()=>{const s=await status(host);return s.phase==='finished'||s.turn===(name==='Alex'?'Bea':'Alex');},{timeout:30000}).toBe(true);
   for(const [name,level] of [['Computer','Medium'],['Computer 3','Hard']])await expect(host.locator(`[data-seat-name="${name}"] .computer-level`)).toHaveText(level);
  });
 }
 await story.step('Both clients display the event-driven victory','Alex',async()=>{},async()=>{for(const page of [host,guest]){await expect(page.locator('main')).toHaveAttribute('data-phase','finished');await expect(page.locator('.victory')).toBeInViewport({ratio:1});}await expect(host.locator('.event-history')).toContainText('Computer finished their turn');await expect(host.locator('.event-history')).toContainText('Computer 3 finished their turn');});
 story.finish();await ca.close();await cb.close();
});
test('Tabletop computers occupy chosen corners with independently editable levels',async({browser},info)=>{
 const ca=await browser.newContext({viewport:{width:1920,height:1080},hasTouch:true}),cb=await browser.newContext(),table=await ca.newPage(),observer=await cb.newPage();
 await observer.goto('/?table=MLVTHN&name=Observer');await table.goto('/tabletop/?launch=create&table=MLVTHN');
 const story=new TestStepHelper(info,{Table:table,Observer:observer},'Choose tabletop computer corners and levels');
 await story.step('Open the south-west corner','Table',()=>table.getByRole('button',{name:'Join South-west',exact:true}).tap(),async()=>{await expect(table.getByRole('button',{name:'Join South-west as Indigo',exact:true})).toBeVisible();});
 await story.step('Take Indigo’s human seat','Table',()=>table.getByRole('button',{name:'Join South-west as Indigo',exact:true}).tap(),async()=>{await expect(table.locator('.corner-south-west .table-seat-joined')).toContainText('Indigo');});
 for(const [corner,color,level] of [['North-east','Pine','hard'],['South-east','Vermilion','medium']]){
  await story.step(`Open ${corner} for a computer`,'Table',()=>table.getByRole('button',{name:`Join ${corner}`,exact:true}).tap(),async()=>{await expect(table.getByRole('combobox',{name:`${corner} seat type`,exact:true})).toHaveValue('human');});
  await story.step(`Choose a ${level} computer`,'Table',()=>table.getByRole('combobox',{name:`${corner} seat type`,exact:true}).selectOption(level),async()=>{await expect(table.getByRole('combobox',{name:`${corner} seat type`,exact:true})).toHaveValue(level);});
  await story.step(`Seat ${color} at ${corner}`,'Table',()=>table.getByRole('button',{name:`Add ${level} computer at ${corner} as ${color}`,exact:true}).tap(),async()=>{await expect(table.getByRole('combobox',{name:`${color} level`,exact:true})).toHaveValue(level);});
 }
 await story.step('Change Pine to easy before dealing','Table',()=>table.getByRole('combobox',{name:'Pine level',exact:true}).selectOption('easy'),async()=>{await expect(table.getByRole('combobox',{name:'Pine level',exact:true})).toHaveValue('easy');});
 await story.step('Restore Pine to hard and persist it','Table',()=>table.getByRole('combobox',{name:'Pine level',exact:true}).selectOption('hard'),async()=>{await expect(table.getByRole('combobox',{name:'Pine level',exact:true})).toHaveValue('hard');});
 await story.step('Reload the physical seats and levels','Table',()=>table.reload(),async()=>{await expect(table.locator('.corner-north-east').getByRole('combobox',{name:'Pine level',exact:true})).toHaveValue('hard');await expect(table.locator('.corner-south-east').getByRole('combobox',{name:'Vermilion level',exact:true})).toHaveValue('medium');});
 await story.step('Start the real three-player picnic','Table',()=>table.getByRole('region',{name:'South table controls',exact:true}).getByRole('button',{name:'Start picnic',exact:true}).tap(),async()=>{await expect(table.locator('main')).toHaveAttribute('data-turn','Indigo');await expect(table.getByRole('button',{name:'Reveal Pine’s tiles',exact:true})).toHaveCount(0);});
 await story.step('Lift only the human screen','Table',()=>table.getByRole('button',{name:'Reveal Indigo’s tiles',exact:true}).tap(),async()=>{await expect(table.getByRole('region',{name:'Indigo’s blanket',exact:true}).locator('.hand-tile')).toHaveCount(5);});
 const area=table.getByRole('region',{name:'Indigo’s blanket',exact:true});await humanPlacement(story,table,'Indigo',[table,observer],area);
 await story.step('Both computer corners play and return the turn','Table',()=>area.getByRole('button',{name:'Draw tiles and finish turn',exact:true}).tap(),async()=>{
  await expect.poll(async()=>Number(await table.locator('main').getAttribute('data-revision')),{timeout:30000}).toBeGreaterThan(12);
  for(const [corner,level] of [['north-east','Hard computer'],['south-east','Medium computer']])await expect(table.locator(`.corner-${corner} .computer-level`)).toHaveText(level);
  await expect(observer.locator('.event-history')).toContainText('Pine finished their turn');await expect(observer.locator('.event-history')).toContainText('Vermilion finished their turn');
  await expect(table.locator('main')).toHaveAttribute('data-turn','Indigo',{timeout:30000});
 });
 story.finish();await ca.close();await cb.close();
});
