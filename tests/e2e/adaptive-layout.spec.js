import {test,expect} from '@playwright/test';
import {TestStepHelper} from './step-helper.js';
const resize=async(p,width,height)=>{await p.setViewportSize({width,height});await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
const sizes=[['laptop',1440,800,'board-first'],['desktop',1920,1080,'board-first'],['small phone',568,320,'board-first'],['compact phone',667,375,'board-first'],['wide phone',844,390,'side-hand'],['ultrawide',1280,480,'side-hand']];
for(const map of ['nihon','tokyo'])test(`Landscape play chooses usable board and hand space on ${map}`,async({browser},info)=>{
 const ca=await browser.newContext({hasTouch:true}),cb=await browser.newContext({hasTouch:true}),a=await ca.newPage(),b=await cb.newPage();
 const code=map==='nihon'?'LAYNHN':'LAYTHN';await a.goto(`/?launch=create&table=${code}&name=Alex`);await b.goto(`/?table=${code}&name=Bea`);
 const story=new TestStepHelper(info,{Alex:a,Bea:b},`Adaptive landscape board and hand · ${map==='nihon'?'Nihon':'Tokyo'}`);
 await story.step('Join through the real invitation','Bea',()=>b.getByRole('button',{name:'Take your seat',exact:true}).tap(),async()=>{await expect(a.locator('.gathered li')).toHaveCount(2);});
 await story.step('Choose the board through the normal setup control','Alex',()=>a.getByRole('combobox',{name:'Map',exact:true}).selectOption(map),async()=>{await expect(a.getByRole('combobox',{name:'Map',exact:true})).toHaveValue(map);await expect(a.locator('main')).toHaveAttribute('data-status','synced');});
 await story.step('Deal actual hands','Alex',()=>a.getByRole('button',{name:'Unfold the board',exact:true}).tap(),async()=>{for(const p of [a,b])await expect(p.locator('main')).toHaveAttribute('data-phase','playing');});
 const initialRevision=await a.locator('main').getAttribute('data-revision');
 for(const [name,width,height,layout] of sizes)await story.step(`Choose the best board and hand fit on ${name}`,'Alex',async()=>{for(const p of[a,b])await resize(p,width,height);},async()=>{
  for(const p of[a,b]){
   await expect(p.locator('main')).toHaveAttribute('data-layout',layout);await expect(p.locator('main')).toHaveAttribute('data-revision',initialRevision);
   const size=await p.evaluate(()=>{const r=s=>document.querySelector(s).getBoundingClientRect();const board=r('.board-surface'),hand=r('.hand-tile .printed-tile'),cell=document.querySelector('.board-cell'),fraction=parseFloat(getComputedStyle(cell).getPropertyValue('--piece-size'))/100;return{board:board.toJSON(),hand:hand.toJSON(),boardTile:cell.getBoundingClientRect().width*fraction};});
   if(layout==='side-hand'){
    expect(size.hand.width).toBeCloseTo(size.boardTile,1);expect(size.hand.x).toBeGreaterThan(size.board.right);expect((size.board.top+size.board.bottom)/2).toBeCloseTo(height/2,1);expect(height-8-size.board.height).toBeLessThanOrEqual(size.hand.height+7);
   }else{
    expect(size.hand.top).toBeGreaterThan(size.board.bottom);expect(size.hand.width).toBeGreaterThanOrEqual(size.boardTile-1);
    if(width===667||width===568)expect(size.hand.width).toBeGreaterThan(50);
   }
  }
 });
 const tile=await a.locator('.hand-tile').evaluateAll(ns=>ns.find(n=>!['move','cover','copy','draw'].includes(n.dataset.tile)).dataset.tile);
 await story.step('Hold a real tile beside the board','Alex',()=>a.locator(`[data-tile="${tile}"]`).tap(),async()=>{await expect(a.locator(`[data-tile="${tile}"]`)).toHaveAttribute('aria-pressed','true');});
 await story.step('Resize to the bottom hand without losing the choice','Alex',async()=>{for(const p of[a,b])await resize(p,667,375);},async()=>{await expect(a.locator('main')).toHaveAttribute('data-layout','board-first');await expect(a.locator(`[data-tile="${tile}"]`)).toHaveAttribute('aria-pressed','true');await expect(a.locator('main')).toHaveAttribute('data-revision',initialRevision);});
 const cell=await a.locator('[data-cell][data-legal=true]').first().getAttribute('data-cell');
 await story.step('Place the selected component on its real hex','Alex',()=>a.locator(`[data-cell="${cell}"]`).tap(),async()=>{for(const p of[a,b]){await expect(p.locator(`[data-cell="${cell}"]`)).toHaveAttribute('data-board-tile',tile);await expect(p.locator('main')).toHaveAttribute('data-revision',String(Number(initialRevision)+1));}});
 await story.step('Open player information beside the compact bottom hand','Alex',()=>a.getByRole('button',{name:'Players and game log',exact:true}).tap(),async()=>{await expect(a.getByRole('dialog',{name:'Players and game log',exact:true})).toBeVisible();await expect.poll(async()=>Math.round((await a.getByRole('dialog',{name:'Players and game log',exact:true}).boundingBox()).x)).toBe(0);expect(await a.locator('.board-wrap').evaluate(n=>n.inert)).toBe(true);});
 await story.step('Close the drawer and return to the same mat','Alex',()=>a.keyboard.press('Escape'),async()=>{await expect(a.locator('.play-menu-toggle')).toHaveAttribute('aria-expanded','false');expect(await a.locator('.board-wrap').evaluate(n=>n.inert)).toBe(false);});
 await story.step('Undo the placement directly from the bottom mat','Alex',()=>a.getByRole('button',{name:'Undo last choice',exact:true}).tap(),async()=>{for(const p of[a,b]){await expect(p.locator(`[data-cell="${cell}"]`)).not.toHaveAttribute('data-board-tile',tile);await expect(p.locator('main')).toHaveAttribute('data-revision',String(Number(initialRevision)+2));}});
 story.finish();await ca.close();await cb.close();
});
