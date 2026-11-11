import {tileArt} from '../art.js';
import {tiles,players} from '../catalog.js';
import {stackLayers} from '../game/tile-stack.js';
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const definition=piece=>piece.definition||tiles.find(t=>t.id===piece.tile);
const face=(piece,color,family)=>tileArt({...definition(piece),direction:piece.direction},color,!!piece.facedown,family);

export function boardTileStack(piece,playerIndex=0,playerIndexFor=()=>playerIndex) {
 const layers=stackLayers(piece);
 if(!layers.length)return '';
 const top=face(layers[0],playerIndexFor(layers[0].owner),'board');
 if(layers.length===1)return top;
 // Keep the top first in DOM: the shared motion presenter picks this physical
 // tile as its flight target. Lower tiles peek out without shifting that target.
 return `<div class="board-tile-stack">${top}${layers.slice(1).map((p,i)=>`<span class="board-under-tile" style="--stack-depth:${i+1};z-index:${9-i}">${face(p,playerIndexFor(p.owner),'board')}</span>`).join('')}</div>`;
}

export function openTileStack(root,piece,{playerIndexFor=()=>0,playerNameFor=owner=>String(owner),onClose=()=>{},edge='south'}={}) {
 if(root.querySelector('.tile-stack-inspector'))return;
 const layers=stackLayers(piece),dialog=document.createElement('dialog');
 dialog.className='tile-stack-inspector';
 const angle=String(edge).startsWith('north')?180:edge==='west'?90:edge==='east'?-90:0;dialog.style.transform=`rotate(${angle}deg)`;dialog.setAttribute('aria-labelledby','tile-stack-title');
 dialog.innerHTML=`<header><div><h2 id="tile-stack-title">Tiles in this hex</h2><p>${layers.length} ${layers.length===1?'tile':'tiles'} · top to bottom</p></div><button type="button" aria-label="Close tile inspection">×</button></header><div class="inspected-tile-layers">${layers.map((p,i)=>{
  const t=definition(p),color=playerIndexFor(p.owner),owner=playerNameFor(p.owner)||players[color]?.name||'Player';
  return `<figure data-stack-level="${i}" data-stack-tile="${safe(p.tile)}">${face(p,color,'gallery')}<figcaption><b>${i===0?'Top':'Underneath'} · ${safe(owner)}</b><span>${p.facedown?'Face-down tile':`${safe(t.name)}${t.strength?' · '+t.strength:''}${t.fast?' · Fast':''}`}</span></figcaption></figure>`;
 }).join('')}</div>`;
 dialog.addEventListener('click',event=>{
  if(event.target.closest('button')){event.stopPropagation();dialog.close();return;}
  const box=dialog.getBoundingClientRect();
  if(event.target===dialog&&(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)){event.stopPropagation();dialog.close();}
 });
 dialog.addEventListener('close',()=>{dialog.remove();onClose();},{once:true});
 root.append(dialog);dialog.showModal();
}
