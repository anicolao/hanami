import { BOARD_GEOMETRY, boardMetrics, paintedCell } from '../game/board-geometry.js';

export const VISUAL_DEFAULTS = Object.freeze({
  tile:90, token:90, offsetX:0, offsetY:-1, duration:650, arc:60, speed:1,
  gridScaleX:100, gridScaleY:100, gridX:0, gridY:0,
  gridBorder:'#000000',gridLine:1,gridOpacity:20,gridHalo:'#eee9dc',gridHaloSize:0,gridCenters:false,gridStyle:'gameplay',
});
export const REVIEWED_GRID_FITS = Object.freeze({
  nihon:{gridScaleX:100,gridScaleY:101.79,gridX:-.1,gridY:-1.6},
  tokyo:{gridScaleX:100,gridScaleY:100,gridX:-3.6,gridY:-6.1},
});
export const VISUAL_PREVIEW_EVENT='hanami:visual-preview-changed';
const previews=new Map();
const previewKeys=[...Object.keys(VISUAL_DEFAULTS),'cell'];
const channel=typeof window!=='undefined'&&typeof BroadcastChannel!=='undefined'?new BroadcastChannel('hanami:live-visual-preview'):null;
export function visualSettings(map, overrides={}) {
  return {...VISUAL_DEFAULTS,map,cell:boardMetrics(map).cellWidth,...REVIEWED_GRID_FITS[map],...overrides};
}
function notifyPreview(){globalThis.dispatchEvent?.(new Event(VISUAL_PREVIEW_EVENT));}
function applyPreview(map,config){
  if(!Object.hasOwn(REVIEWED_GRID_FITS,map))return;
  previews.set(map,Object.fromEntries(previewKeys.filter(key=>Object.hasOwn(config,key)).map(key=>[key,config[key]])));
  notifyPreview();
}
// Live changes reach already-open presenters, but there is no saved state or
// catch-up handshake. Every new/reloaded document starts at game settings.
channel?.addEventListener('message',event=>{if(event.data?.type==='preview'&&event.data.settings)applyPreview(event.data.map,event.data.settings);});
export function readVisualSettings(map){return visualSettings(map,previews.get(map));}
export function previewVisualSettings(map,config){
  applyPreview(map,config);channel?.postMessage({type:'preview',map,settings:previews.get(map)});
}
export function resetVisualPreviews(){previews.clear();notifyPreview();}
export function clearLegacyLabPreferences(storage=globalThis.localStorage){
  for(const key of ['hanami:component-visuals:v1','hanami:route-lab:v1','hanami:animation-lab:v1','hanami:lab:grid-fits:v1','hanami:lab:art-grid-fits:v1'])try{storage?.removeItem(key);}catch{}
}
export function cellLayout(map, cell, visual=visualSettings(map)) {
  const position=paintedCell(map,cell),art=BOARD_GEOMETRY[map];
  return {...position,
    x:50+(position.x-50)*visual.gridScaleX/100+visual.gridX/art.imageWidth*100,
    y:50+(position.y-50)*visual.gridScaleY/100+visual.gridY/art.imageHeight*100,
    width:visual.cell*visual.gridScaleX/100,
    aspect:boardMetrics(map).cellAspect*visual.gridScaleX/visual.gridScaleY};
}
export function applyVisualSettings(root, visual) {
  for(const [key,value] of Object.entries({
    'board-aspect':BOARD_GEOMETRY[visual.map]?.imageWidth/BOARD_GEOMETRY[visual.map]?.imageHeight||2.13,
    'board-piece-fraction':visual.cell*visual.gridScaleX*visual.tile/1000000,
    'piece-size':`${visual.tile}%`,'piece-x':`${visual.offsetX}%`,'piece-y':`${visual.offsetY}%`,'token-scale':visual.token/100,
    'grid-border':visual.gridStyle==='diagnostic'?'#60f1fc':visual.gridBorder,'grid-line':visual.gridStyle==='diagnostic'?.4:visual.gridLine,
    'grid-opacity':visual.gridOpacity/100,'grid-halo':visual.gridHalo,'grid-halo-stroke':visual.gridLine+2*visual.gridHaloSize,
  }))root.style.setProperty(`--${key}`,value);
}
