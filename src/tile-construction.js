import {tileArt} from './art.js';
import {players,tiles} from './catalog.js';
import './tile-construction.css';

// Render the real component seven times: assembled and each isolated print layer.
// No alternate drawings or independently positioned approximations are used.
export function mountTileConstruction(root) {
  const layers=[
    {id:'background',name:'Backgrounds',selector:'.printed-background',description:'The background and frame use the same mathematically regular hexagon.'},
    {id:'art',name:'Illustration',selector:'.printed-illustration',description:'New watercolor art is transparent; original art can cover the background.'},
    {id:'frame',name:'Colorable frame',selector:'.printed-frame',description:'The player-colored frame includes the filled strength bump and gold section dividers.'},
    {id:'value',name:'Strength / direction',selector:'.printed-value',description:'An ivory ink mask sits in the frame’s inset.'},
    {id:'owner',name:'Player mark',selector:'.printed-owner',description:'A separate ink mask identifies the player’s pattern.'},
    {id:'action',name:'Action mark',selector:'.printed-action',description:'Fast or Special ink appears when the tile needs it.'},
  ];
  const enabled=Object.fromEntries(layers.map(layer=>[layer.id,true]));
  let chosen='boat-2',player=0,back=false,direction=0,artMode='transparent';
  root.innerHTML=`<div class="section-title"><div><p class="eyebrow">INSIDE A PLAYER TILE</p><h2>How the layers fit.</h2></div><p>The actual game component, separated into its print layers.<br>Switch layers on and off to inspect the assembly.</p></div>
  <div class="construction-controls"><label>Tile<select data-construction="tile">${tiles.map(t=>`<option value="${t.id}" ${t.id===chosen?'selected':''}>${t.name}${t.strength?' · '+t.strength:''}${t.fast?' · Fast':''}</option>`).join('')}</select></label><label>Player<select data-construction="player">${players.map((p,i)=>`<option value="${i}">${p.name} · ${p.pattern}</option>`).join('')}</select></label><label>Copy direction<select data-construction="direction">${['North','North-east','South-east','South','South-west','North-west'].map((label,i)=>`<option value="${i}">${label} · ${i*60}°</option>`).join('')}</select></label><label>Illustration<select data-construction="art"><option value="transparent">New · transparent</option><option value="original">Original scene</option></select></label><label>Paper / background<input data-construction="paper" type="color" aria-label="Paper / background color" value="#f8edd8"></label><label class="construction-back"><input data-construction="back" type="checkbox"> Show reverse</label></div>
  <div class="construction-workbench"><figure class="construction-assembled"><div class="construction-paper construction-composite"></div><figcaption><strong>Assembled tile</strong><span class="construction-status" role="status"></span></figcaption></figure><div class="construction-parts"></div></div>
  <p class="construction-note">Each separated layer keeps its exact size and position within the same hex. The checkerboard shows transparency. The frame is one colorable component with transparent wells. Its gold inlay stays gold; the CSS background and illustration show through its open wells. The filled strength bump belongs to the frame itself. Rotating Copy turns the complete assembly.</p>`;
  function render() {
    const t=tiles.find(tile=>tile.id===chosen),art=tileArt({...t,direction:t.type==='copy'?direction:undefined},player,back,'gallery',artMode);
    const composite=root.querySelector('.construction-composite');
    composite.innerHTML=art;
    root.querySelector('[data-construction="direction"]').disabled=t.type!=='copy';
    const parts=layers.map((layer,index)=>{
      const exists=!!composite.querySelector(layer.selector);
      composite.dataset[layer.id]=String(enabled[layer.id]);
      return `<figure class="construction-part"><div class="construction-paper construction-isolated" data-isolate="${layer.id}" aria-hidden="true">${exists?art:'<span class="construction-empty">Not used<br>on this tile</span>'}</div><figcaption><span class="construction-order">${index+1}</span><strong>${layer.name}</strong><p>${layer.description}</p><label><input type="checkbox" data-layer="${layer.id}" aria-label="Show ${layer.name.toLowerCase()} in assembly" ${enabled[layer.id]&&exists?'checked':''} ${exists?'':'disabled'}> ${exists?'Show in assembly':'Not used'}</label></figcaption></figure>`;
    }).join('');
    root.querySelector('.construction-parts').innerHTML=parts;
    refreshComposite();
  }
  function refreshComposite() {
    const composite=root.querySelector('.construction-composite'),t=tiles.find(tile=>tile.id===chosen);
    let present=0,visible=0;
    for(const layer of layers){
      const element=composite.querySelector(layer.selector);
      if(element){present++;if(enabled[layer.id])visible++;element.toggleAttribute('hidden',!enabled[layer.id]);}
    }
    root.querySelector('.construction-status').textContent=`${t.name}${back?' reverse':''} · ${visible} of ${present} layers visible`;
  }
  root.addEventListener('change',event=>{
    const control=event.target;
    if(control.dataset.layer){enabled[control.dataset.layer]=control.checked;refreshComposite();return;}
    const setting=control.dataset.construction;
    if(setting==='paper'){root.style.setProperty('--tile-paper',control.value);return;}
    if(setting==='tile')chosen=control.value;
    if(setting==='art')artMode=control.value;
    if(setting==='player')player=Number(control.value);
    if(setting==='direction')direction=Number(control.value);
    if(setting==='back')back=control.checked;
    if(setting)render();
  });
  render();
}
