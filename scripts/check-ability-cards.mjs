import{chromium,expect}from'@playwright/test';
import{assertGameFits}from'../tests/e2e/layout-assertions.js';
const browser=await chromium.launch(),context=await browser.newContext(),base=process.env.HANAMI_LAB_URL||'http://127.0.0.1:5191',errors=[];
const ready=async p=>{await p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});};
try{
 const gallery=await context.newPage();await gallery.goto(base+'/gallery/',{waitUntil:'networkidle'});await ready(gallery);
 const faces=await gallery.locator('.ability-grid [data-ability-card]').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.abilityCard,n.outerHTML])));
 const galleryFit=await gallery.locator('.ability-grid [data-ability-card]').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect(),p=n.querySelector('.printed-ability-card__rules')?.getBoundingClientRect();return{id:n.dataset.abilityCard,ratio:b.width/b.height,bottom:p?(p.bottom-b.top)/b.height:0};}));for(const c of galleryFit){expect(c.ratio).toBeCloseTo(1,3);expect(c.bottom).toBeLessThan(.98);}
 await gallery.getByRole('button',{name:'Inspect Green Tea',exact:true}).click();await expect(gallery.locator('#inspector [data-ability-card=green-tea]')).toHaveCount(1);await expect(gallery.locator('#inspector .eyebrow')).toHaveCount(0);await gallery.getByRole('button',{name:'Close inspection',exact:true}).click();
 const prepare=async(route,scene,players)=>{const lab=await context.newPage();lab.on('pageerror',e=>errors.push(e.message));await lab.goto(`${base}/dev/animations/?view=routes&viewport=ipad-air-landscape&route=${route}&scene=${scene}&players=${players}`);await expect(lab.locator('#app')).toHaveAttribute('data-ready','true',{timeout:30000});const src=await lab.locator('#route-preview').getAttribute('src');const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.setViewportSize({width:1180,height:820});await p.goto(new URL(src,base).href);await expect(p.locator('main')).toHaveAttribute('data-phase',scene==='powers'?'choosing':'playing');await ready(p);await lab.close();return p;};
 const draft=await prepare('web','powers',2);
 for(const[width,height]of[[1180,820],[844,390],[568,320],[390,844]]){
  await draft.setViewportSize({width,height});await ready(draft);await assertGameFits(draft);
  for(const card of await draft.locator('[data-draft] [data-ability-card]').all()){
   const value=await card.evaluate(n=>{const b=n.getBoundingClientRect(),art=n.querySelector('img').getBoundingClientRect(),rules=n.querySelector('.printed-ability-card__rules').getBoundingClientRect();return{id:n.dataset.abilityCard,html:n.outerHTML,ratio:b.width/b.height,artWidth:art.width/b.width,artHeight:art.height/b.height,textBottom:(rules.bottom-b.top)/b.height,font:parseFloat(getComputedStyle(n.querySelector('.printed-ability-card__rules')).fontSize)/b.width};});
   expect(value.html).toBe(faces[value.id]);expect(value.ratio).toBeCloseTo(1,3);expect(value.artWidth).toBeCloseTo(.92,2);expect(value.artHeight).toBeCloseTo(.56,2);expect(value.textBottom).toBeLessThan(.98);expect(value.font).toBeCloseTo(.047,3);
  }
 }
 await draft.close();
 const table=await prepare('tabletop','powers',4);await expect(table.locator('[data-draft]')).toHaveCount(8);await assertGameFits(table);
 for(const card of await table.locator('[data-draft] [data-ability-card]').all()){const value=await card.evaluate(n=>({id:n.dataset.abilityCard,html:n.outerHTML,b:n.getBoundingClientRect().toJSON()}));expect(value.html).toBe(faces[value.id]);expect(value.b.width/value.b.height).toBeCloseTo(1,3);}
 
 await table.close();
 const game=await prepare('web','opening',2);const card=game.locator('.personal-ability [data-ability-card]');expect(await card.evaluate(n=>n.outerHTML)).toBe(faces['torii-0']);await assertGameFits(game);
 const beforeAbility=Number(await game.locator('main').getAttribute('data-revision'));
 await game.getByRole('button',{name:'Use Torii · Indigo',exact:true}).click();const tokens=await game.locator('.park-pieces.count-1 [data-token]:not(:disabled)').evaluateAll(ns=>ns.map(n=>({id:n.dataset.token,type:n.dataset.tokenType})));const pair=[tokens[0],tokens.find(t=>t.type!==tokens[0].type)];expect(pair[1]).toBeTruthy();for(const t of pair)await game.locator(`[data-token="${t.id}"]`).click();
 await expect(card).toHaveAttribute('data-ability-card','back');await expect(game.locator('main')).toHaveAttribute('data-revision',String(beforeAbility+1));await ready(game);expect(await card.evaluate(n=>n.outerHTML)).toBe(faces.back);await expect(game.locator('.personal-ability')).toBeDisabled();await assertGameFits(game);
 for(const[width,height]of[[568,320],[390,844]]){await game.setViewportSize({width,height});await ready(game);await assertGameFits(game);const b=await card.boundingBox();expect(b.width/b.height).toBeCloseTo(1,3);}
 const viewer=await context.newPage();await viewer.setViewportSize({width:1600,height:1000});await viewer.goto(base+'/tests/e2e/index.html#two-friends-join-and-play-a-complete-event-driven-hanami-game/linux/0');await expect(viewer.locator('.view img')).toHaveCount(2);await ready(viewer);const phone=viewer.locator('.view[data-phone=true] img');expect(await phone.evaluate(i=>({natural:i.naturalWidth,shown:i.getBoundingClientRect().width}))).toEqual({natural:844,shown:844});
 await viewer.goto(base+'/tests/e2e/index.html?native-size=568#power-cards-and-undo-consent-fit-the-real-game-at-every-viewport-on-nihon/linux/8');await expect(viewer.locator('.view img')).toHaveCount(2);await ready(viewer);expect(await viewer.locator('.view img').first().evaluate(i=>({natural:i.naturalWidth,shown:i.getBoundingClientRect().width}))).toEqual({natural:568,shown:568});
 expect(errors).toEqual([]);console.log(JSON.stringify({gallery:galleryFit.length,selectionViewports:4,tabletopCards:8,matFrontShared:true,usedReverseShared:true,realAbilityEvent:true,landscapePhoneViewer:'844px at 1:1',errors}));
}finally{await browser.close();}
