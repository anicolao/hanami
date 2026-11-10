import {test,expect} from '@playwright/test';
import {TestStepHelper} from './step-helper.js';
const rev=async p=>Number(await p.locator('main').getAttribute('data-revision'));
test('Tabletop corner colors, private phone and unanimous undo',async({browser},info)=>{
 const tableContext=await browser.newContext({viewport:{width:1920,height:1080},hasTouch:true});
 const phoneContext=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 const table=await tableContext.newPage(),phone=await phoneContext.newPage();
 const story=new TestStepHelper(info,{Table:table,Phone:phone},'Four corner seats and a private phone');
 const north=()=>table.getByRole('region',{name:'North table controls',exact:true});
 const south=()=>table.getByRole('region',{name:'South table controls',exact:true});
 await phone.goto('/?table=PICNIC&name=River');
 await table.goto('/tabletop/?launch=create&table=PICNIC');
 await story.step('Open a header-free table with four corner seats','Table',async()=>{},async()=>{
  await expect(table.locator('main')).toHaveAttribute('data-phase','empty');
  await expect(table.locator('.play-header')).toHaveCount(0);
  await expect(table.locator('input[name=name]')).toHaveCount(0);
  await expect(table.locator('[data-join-corner]')).toHaveCount(4);
  await expect(table.locator('.corner-north-west')).toHaveCSS('transform','matrix(-1, 0, 0, -1, 0, 0)');
 });
 await story.step('Tap the south-west corner','Table',()=>table.getByRole('button',{name:'Join South-west',exact:true}).tap(),async()=>{
  await expect(table.getByRole('button',{name:'Join South-west as Indigo',exact:true})).toBeVisible();
 });
 await story.step('Join south-west as Indigo without entering a name','Table',()=>table.getByRole('button',{name:'Join South-west as Indigo',exact:true}).tap(),async()=>{
  await expect(table.locator('.table-seat-joined')).toHaveCount(1);
  await expect(phone.locator('.gathered li')).toHaveCount(1);
 });
 await story.step('Tap the north-east corner','Table',()=>table.getByRole('button',{name:'Join North-east',exact:true}).tap(),async()=>{
  await expect(table.getByRole('button',{name:'Join North-east as Indigo',exact:true})).toBeDisabled();
 });
 await story.step('Join north-east as Pine','Table',()=>table.getByRole('button',{name:'Join North-east as Pine',exact:true}).tap(),async()=>{
  await expect(table.locator('.table-seat-joined')).toHaveCount(2);
  await expect(north().getByRole('button',{name:'Start picnic',exact:true})).toBeEnabled();
  await expect(south().getByRole('button',{name:'Start picnic',exact:true})).toBeEnabled();
 });
 await story.step('Join the same table from a private phone','Phone',()=>phone.getByRole('button',{name:'Take your seat',exact:true}).tap(),async()=>{
  await expect(table.locator('.table-seat-joined')).toHaveCount(3);
 });
 await story.step('Start the picnic from the north edge','Table',()=>north().getByRole('button',{name:'Start picnic',exact:true}).tap(),async()=>{
  await expect(table.locator('main')).toHaveAttribute('data-phase','playing');
  await expect(phone.locator('.hand-tile')).toHaveCount(5);
  await expect(table.locator('.hand-tile')).toHaveCount(0);
  await expect(table.locator('.privacy-screen')).toHaveCount(3);
  await expect(table.locator('.park-pieces .celebration-piece')).toHaveCount(30);
  await expect(table.locator('[data-in-play=false]')).not.toHaveCount(0);
  await expect(north()).toContainText('Indigo’s turn');await expect(south()).toContainText('Indigo’s turn');
 });
 const bounds=await table.locator('.board-surface').boundingBox();
 const seatSizes=await table.locator('.table-corner').evaluateAll(nodes=>nodes.map(el=>el.getBoundingClientRect().height));
 await story.step('Lift the south-west screen without resizing the board','Table',()=>table.getByRole('button',{name:'Reveal Indigo’s tiles',exact:true}).tap(),async()=>{
  await expect(table.locator('.hand-tile')).toHaveCount(5);
  expect(await table.locator('.board-surface').boundingBox()).toEqual(bounds);
  expect(await table.locator('.table-corner').evaluateAll(nodes=>nodes.map(el=>el.getBoundingClientRect().height))).toEqual(seatSizes);
  expect(seatSizes.every(height=>height>=68)).toBe(true);
  await expect(phone.locator('.player-area')).toHaveCount(1);
 });
 const tile=await table.locator('.hand-tile:not([data-tile=move])').first().getAttribute('data-tile');
 await story.step('Touch a held watercolor tile','Table',()=>table.locator(`[data-tile="${tile}"]`).tap(),async()=>{
  await expect(table.locator(`[data-tile="${tile}"]`)).toHaveAttribute('aria-pressed','true');
 });
 const cell=await table.locator('[data-cell][data-legal=true]').first().getAttribute('data-cell');let old=await rev(table);
 await story.step('Place it on the shared grid through a real event','Table',()=>table.locator(`[data-cell="${cell}"]`).tap(),async()=>{
  await expect.poll(()=>rev(table)).toBeGreaterThan(old);await expect.poll(()=>rev(phone)).toBeGreaterThan(old);
  await expect(phone.locator(`[data-cell="${cell}"]`)).toHaveAttribute('data-owner','Indigo');
 });
 await story.step('Draw and pass to the north-east player','Table',()=>table.getByRole('region',{name:'Indigo’s blanket',exact:true}).getByRole('button',{name:'Draw tiles and finish turn',exact:true}).tap(),async()=>{
  await expect(table.locator('main')).toHaveAttribute('data-turn','Pine');
 });
 await story.step('Request undo after drawing new information','Table',()=>south().getByRole('button',{name:'Request undo',exact:true}).tap(),async()=>{
  await expect(phone.getByRole('button',{name:'River agrees to undo',exact:true})).toBeVisible();
  await expect(table.getByRole('button',{name:'Pine agrees to undo',exact:true})).toBeVisible();
 });
 await story.step('Pine independently agrees at the table','Table',()=>table.getByRole('button',{name:'Pine agrees to undo',exact:true}).tap(),async()=>{
  await expect(table.locator('.undo-consent')).toContainText('Pine · agreed');
  await expect(table.locator('main')).toHaveAttribute('data-turn','Pine');
 });
 await story.step('The phone player supplies final consent','Phone',()=>phone.getByRole('button',{name:'River agrees to undo',exact:true}).tap(),async()=>{
  await expect(table.locator('.undo-consent')).toHaveCount(0);await expect(table.locator('main')).toHaveAttribute('data-turn','Indigo');
 });
 let shortTileWidth;
 await story.step('Fit the board and hands to a shorter display','Table',()=>table.setViewportSize({width:1920,height:900}),async()=>{
  shortTileWidth=await table.locator('.hand-tile .printed-tile').first().evaluate(el=>el.getBoundingClientRect().width);
  const boardTile=await table.locator('.board-cell .printed-tile').first().evaluate(el=>el.getBoundingClientRect().width);
  expect(Math.abs(shortTileWidth-boardTile)).toBeLessThan(1);
 });
 await story.step('Use surplus vertical space for larger hands up to board tile size','Table',()=>table.setViewportSize({width:1920,height:1400}),async()=>{
  const hand=await table.locator('.hand-tile .printed-tile').first().evaluate(el=>el.getBoundingClientRect().width);
  const boardTile=await table.locator('.board-cell .printed-tile').first().evaluate(el=>el.getBoundingClientRect().width);
  expect(hand).toBeGreaterThan(shortTileWidth);expect(Math.abs(hand-boardTile)).toBeLessThan(1);
  expect((await table.locator('.board-surface').boundingBox()).width).toBeCloseTo(1920,0);
 });
 await story.step('Return to the original tabletop display','Table',()=>table.setViewportSize({width:1920,height:1080}),async()=>{
  expect(await table.locator('.board-surface').boundingBox()).toEqual(bounds);
 });
 await story.step('Fold the screen without changing board geometry','Table',()=>table.getByRole('button',{name:'Hide Indigo’s tiles',exact:true}).tap(),async()=>{
  await expect(table.locator('.hand-tile')).toHaveCount(0);expect(await table.locator('.board-surface').boundingBox()).toEqual(bounds);
 });
 story.finish();await tableContext.close();await phoneContext.close();
});
test("Gameroom guests wait for their creator and reload never seats duplicates", async ({
  browser,
}, info) => {
  const ca = await browser.newContext(),
    cb = await browser.newContext(),
    a = await ca.newPage(),
    b = await cb.newPage(),
    story = new TestStepHelper(
      info,
      { Host: a, Guest: b },
      "A guest arriving before the host",
    );
  await a.goto("/");
  await b.goto("/?launch=join&table=EARLYHN&name=Friend");
  await expect(b.locator("[role=status]")).toHaveAttribute(
    "data-status",
    "synced",
  );
  await story.step(
    "Follow a join URL before the creator arrives",
    "Guest",
    async () => {},
    async () => {
      await expect(b.locator("main")).toHaveAttribute("data-phase", "empty");
      await expect(b.locator(".waiting")).toContainText("Waiting for the host");
    },
  );
  await story.step(
    "Open the intended host URL",
    "Host",
    () => a.goto("/?launch=create&table=EARLYHN&name=Friend"),
    async () => {
      await expect(a.locator(".gathered li")).toHaveCount(2);
      await expect(b.locator(".gathered li")).toHaveCount(2);
    },
  );
  const old = await rev(b);
  await story.step(
    "Reload the same invitation without another join",
    "Guest",
    () => b.reload(),
    async () => {
      await expect(b.locator(".gathered li")).toHaveCount(2);
      expect(await rev(b)).toBe(old);
    },
  );
  story.finish();
  await ca.close();
  await cb.close();
});
