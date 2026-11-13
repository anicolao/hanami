import {expect} from '@playwright/test';

// Run against the production document after every walkthrough step. The lab's
// outer workbench may scroll; its real-route iframe obeys these same checks.
export async function assertGameFits(page) {
 const issues=await page.evaluate(()=>{
  const main=document.querySelector('main.play-app');if(!main)return [];
  const problems=[],viewport={left:0,top:0,right:innerWidth,bottom:innerHeight};
  const label=el=>el.getAttribute('aria-label')||el.id||`${el.tagName.toLowerCase()}.${el.className}`;
  const visible=el=>el.getClientRects().length&&el.checkVisibility({visibilityProperty:true,opacityProperty:true})&&getComputedStyle(el).clipPath!=='inset(50%)';
  const inside=(a,b)=>a.left>=b.left-1&&a.top>=b.top-1&&a.right<=b.right+1&&a.bottom<=b.bottom+1;
  const documentBox=document.scrollingElement;
  if(documentBox.scrollWidth>innerWidth+1||documentBox.scrollHeight>innerHeight+1||scrollX||scrollY)
   problems.push(`Document scrolls: ${documentBox.scrollWidth}×${documentBox.scrollHeight} at ${scrollX},${scrollY}; viewport ${innerWidth}×${innerHeight}`);
  const dialogs=[...document.querySelectorAll('dialog[open], [role=dialog][aria-modal=true]')].filter(visible);
  const foreground=document.activeElement?.closest('dialog[open]')||dialogs.at(-1)||main;
  const regions=new Set([...main.querySelectorAll('[data-table-view],.board-surface,.player-area,.hand,.hand-row,.mat-controls,.table-center-controls,.table-seat-draft,.ability-draft,.victory'),...document.querySelectorAll('dialog[open]')]);
  for(const el of regions){
   if(!visible(el)||el.closest('[inert]'))continue;
   if(!inside(el.getBoundingClientRect(),viewport))problems.push(`${label(el)} leaves the viewport`);
   const style=getComputedStyle(el);
   // Rotating a hex also rotates transparent image corners. Their paint bounds
   // can exceed a non-scrolling hand; test its actual controls and text below.
   if((['auto','scroll'].includes(style.overflowX)&&el.scrollWidth>el.clientWidth+1)||(['auto','scroll'].includes(style.overflowY)&&el.scrollHeight>el.clientHeight+1))problems.push(`${label(el)} requires scrolling or clips its contents (${el.scrollWidth}×${el.scrollHeight} in ${el.clientWidth}×${el.clientHeight})`);
  }
  for(const el of foreground.querySelectorAll('button,input,select,a,.turn-strip>p,.action-hint,.player-area h2,.undo-consent p,.ability-draft>h1,.ability-draft>p,.victory h1,.victory>p,.victory>a')){
   if(!visible(el)||el.closest('[inert]')||el.closest('.private-captures,.captured-reveal')||el.matches('.play-drawer-scrim,.celebration-piece'))continue;
   const box=el.getBoundingClientRect();
   if(!inside(box,viewport)){problems.push(`${label(el)} leaves the viewport`);continue;}
   // Top-layer dialogs escape their ancestors' clipping, as in the browser.
   for(let parent=el.parentElement;parent&&parent!==foreground.parentElement;parent=parent.parentElement){
    const style=getComputedStyle(parent),clipX=['hidden','clip','auto','scroll'].includes(style.overflowX),clipY=['hidden','clip','auto','scroll'].includes(style.overflowY);
    const bounds=parent.getBoundingClientRect();
    if((clipX&&(box.left<bounds.left-1||box.right>bounds.right+1))||(clipY&&(box.top<bounds.top-1||box.bottom>bounds.bottom+1))){problems.push(`${label(el)} is clipped by ${label(parent)}`);break;}
    if(parent.matches('dialog[open]'))break;
   }
  }
  for(const card of main.querySelectorAll('[data-draft]')){
   if(!visible(card))continue;
   for(const child of card.querySelectorAll('img,h2,strong,p,small'))if(!inside(child.getBoundingClientRect(),card.getBoundingClientRect()))problems.push(`${label(card)} clips its artwork or explanation`);
  }
  return [...new Set(problems)];
 });
 expect(issues,'The real game must fit without page scrolling, clipped controls or overflowing play areas').toEqual([]);
}
