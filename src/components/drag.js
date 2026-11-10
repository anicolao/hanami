import { elementPose } from './motion.js';

// One pointer/touch gesture for a physical tile in either presenter.
export function installComponentDrag(root,{sourceSelector,canStart=()=>true,begin=()=>{},drop=()=>{},cancel=()=>{}}) {
  let drag=null,suppressClick=false;
  root.addEventListener('click',event=>{if(suppressClick){event.preventDefault();event.stopImmediatePropagation();}},true);
  root.addEventListener('pointerdown',event=>{
    const source=event.target.closest(sourceSelector);
    if(event.button!==0||!source||source.disabled||!canStart(source))return;
    const piece=source.querySelector('.painted-tile')||source;
    drag={pointer:event.pointerId,x:event.clientX,y:event.clientY,source,pose:elementPose(piece),art:piece.cloneNode(true),active:false};
  });
  root.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.pointer)return;
    if(!drag.active&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<7)return;
    if(!drag.active){
      drag.active=true;begin(drag.source);root.setPointerCapture(event.pointerId);
      const ghost=document.createElement('div');ghost.className='component-drag-ghost';ghost.setAttribute('aria-hidden','true');ghost.append(drag.art);
      Object.assign(ghost.style,{position:'fixed',width:`${drag.pose.localWidth}px`,height:`${drag.pose.localHeight}px`,left:'0',top:'0',margin:'0',transformOrigin:'center'});
      Object.assign(drag.art.style,{width:'100%',height:'100%',left:'0',top:'0',transform:'none'});
      root.append(ghost);drag.ghost=ghost;
    }
    event.preventDefault();
    drag.ghost.style.transform=`translate(${event.clientX-drag.pose.localWidth/2}px,${event.clientY-drag.pose.localHeight/2}px) rotate(${drag.pose.angle}deg) scale(1.06)`;
  });
  const clear=()=>{if(drag?.ghost)drag.ghost.remove();if(drag&&root.hasPointerCapture(drag.pointer))root.releasePointerCapture(drag.pointer);drag=null;};
  root.addEventListener('pointerup',event=>{
    if(!drag||event.pointerId!==drag.pointer)return;
    const current=drag;clear();if(!current.active)return;
    suppressClick=true;setTimeout(()=>suppressClick=false,0);
    const cell=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-cell-wrapper]');
    if(cell)drop(cell.dataset.cellWrapper,current.source);else cancel(current.source);
  });
  root.addEventListener('pointercancel',()=>{clear();cancel();});
}
