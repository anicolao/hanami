import { elementPose, boardPieceDimensions, isolateMovingRasters } from './motion.js';

// The same physical gesture and release pose in real routes and motion fixtures.
export function installComponentDrag(root,{sourceSelector,canStart=()=>true,begin=()=>{},drop=()=>{},cancel=()=>{},rotate=null,hover=()=>{}}) {
  let drag=null,suppressClick=false;
  root.addEventListener('dragstart',event=>{if(event.target.closest(sourceSelector))event.preventDefault();});
  root.addEventListener('click',event=>{if(suppressClick){event.preventDefault();event.stopImmediatePropagation();}},true);
  root.addEventListener('pointerdown',event=>{
    const source=event.target.closest(sourceSelector);
    if(drag||event.isPrimary===false||event.button!==0||!source||source.disabled||!canStart(source))return;
    const piece=source.querySelector('.painted-tile')||source,pose=elementPose(piece);
    const angle=pose.angle*Math.PI/180,scale=pose.width/(Math.abs(Math.cos(angle))*pose.localWidth+Math.abs(Math.sin(angle))*pose.localHeight);
    const player=source.closest('[data-player]')?.dataset.player;
    const selector=`${player?`[data-player="${CSS.escape(player)}"] `:''}${source.dataset.cell?`[data-cell="${CSS.escape(source.dataset.cell)}"]`:source.hasAttribute('data-held-move')?'[data-held-move]':source.dataset.tile?`[data-tile="${CSS.escape(source.dataset.tile)}"]`:`[data-hand="${CSS.escape(source.dataset.hand)}"]`}`;
    drag={pointer:event.pointerId,x:event.clientX,y:event.clientY,source,selector,pose,width:pose.localWidth*scale,height:pose.localHeight*scale,art:piece.cloneNode(true),active:false};
  });
  const cellAt=(x,y)=>document.elementFromPoint(x,y)?.closest('[data-cell-wrapper]')||null;
  root.addEventListener('pointerleave',()=>{if(!drag?.active)hover(null);});
  function position(event){
    const board=root.querySelector('.board-surface'),bounds=board?.getBoundingClientRect();
    // Raise the tile north of the finger; its centre, not the covered finger,
    // chooses the hex. The lower edge reaches the board before the pointer does.
    const inBoard=bounds&&event.clientX>=bounds.left&&event.clientX<=bounds.right&&event.clientY>=bounds.top&&event.clientY-drag.height/2<=bounds.bottom;
    const {width,height}=inBoard?boardPieceDimensions(root):{width:drag.width,height:drag.height};
    const x=event.clientX,y=event.clientY-(inBoard?height*.7+8:0);
    Object.assign(drag.ghost.style,{width:`${width}px`,height:`${height}px`,left:`${x}px`,top:`${y}px`,transform:`translate(-50%,-50%) rotate(${drag.pose.angle}deg)`});
    drag.cell=inBoard?cellAt(x,y):null;
    drag.ghost.dataset.overBoard=String(!!inBoard);
    hover(drag.cell?.dataset.cellWrapper||null);
  }
  root.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.pointer){hover(cellAt(event.clientX,event.clientY)?.dataset.cellWrapper||null);return;}
    if(!drag.active&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<7)return;
    if(!drag.active){
      drag.active=true;begin(drag.source);root.setPointerCapture(event.pointerId);
      const ghost=document.createElement('div');ghost.className='component-drag-ghost';ghost.setAttribute('aria-hidden','true');ghost.append(drag.art);
      Object.assign(ghost.style,{position:'fixed',width:`${drag.width}px`,height:`${drag.height}px`,left:'0',top:'0',margin:'0',transformOrigin:'center'});
      Object.assign(drag.art.style,{width:'100%',height:'100%',left:'0',top:'0',transform:'none'});
      isolateMovingRasters(drag.art,'drag');
      document.body.append(ghost);drag.ghost=ghost;
      drag.live=root.querySelector(drag.selector);if(drag.live)drag.live.style.visibility='hidden';
    }
    event.preventDefault();position(event);
  });
  window.addEventListener('keydown',event=>{
    if(!drag?.active || !rotate || event.key.toLowerCase()!=='r' || event.ctrlKey || event.metaKey || event.altKey)return;
    const turn=rotate(drag.source);
    if(!Number.isFinite(turn))return;
    event.preventDefault();event.stopImmediatePropagation();
    drag.art.style.setProperty('--tile-turn',`${turn}deg`);
  });
  const release=current=>{current.ghost?.remove();if(current.live)current.live.style.visibility='';};
  const clear=()=>{if(drag)release(drag);if(drag&&root.hasPointerCapture(drag.pointer))root.releasePointerCapture(drag.pointer);drag=null;};
  root.addEventListener('pointerup',event=>{
    if(!drag||event.pointerId!==drag.pointer)return;
    const current=drag;if(!current.active){clear();return;}
    position(event);const from={...elementPose(current.ghost),turn:parseFloat(getComputedStyle(current.art).getPropertyValue('--tile-turn'))||0},cell=current.cell?.dataset.cellWrapper;
    if(root.hasPointerCapture(current.pointer))root.releasePointerCapture(current.pointer);drag=null;
    suppressClick=true;setTimeout(()=>suppressClick=false,0);
    const gesture={from,cell,selector:current.selector,release:()=>release(current)};
    if(cell){try{Promise.resolve(drop(cell,current.source,gesture)).finally(()=>{if(!gesture.retained)gesture.release();});}catch(error){gesture.release();throw error;}}
    else{gesture.release();cancel(current.source);}
    hover(null);
  });
  root.addEventListener('pointercancel',()=>{clear();hover(null);cancel();});
}
