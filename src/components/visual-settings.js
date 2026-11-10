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
export const VISUAL_STORAGE_KEY='hanami:component-visuals:v1';
export function visualSettings(map, overrides={}) {
  return {...VISUAL_DEFAULTS,cell:boardMetrics(map).cellWidth,...REVIEWED_GRID_FITS[map],...overrides};
}
export function readVisualSettings(map, storage=globalThis.localStorage) {
  try {return visualSettings(map,JSON.parse(storage?.getItem(VISUAL_STORAGE_KEY)||'{}')[map]);}
  catch {return visualSettings(map);}
}
export function saveVisualSettings(map, config, storage=globalThis.localStorage) {
  let saved={};try{saved=JSON.parse(storage.getItem(VISUAL_STORAGE_KEY)||'{}');}catch{}
  const keys=[...Object.keys(VISUAL_DEFAULTS),'cell'];
  saved[map]=Object.fromEntries(keys.map(key=>[key,config[key]??visualSettings(map)[key]]));
  storage.setItem(VISUAL_STORAGE_KEY,JSON.stringify(saved));
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
    'piece-size':`${visual.tile}%`,'piece-x':`${visual.offsetX}%`,'piece-y':`${visual.offsetY}%`,'token-scale':visual.token/100,
    'grid-border':visual.gridStyle==='diagnostic'?'#60f1fc':visual.gridBorder,'grid-line':visual.gridStyle==='diagnostic'?.4:visual.gridLine,
    'grid-opacity':visual.gridOpacity/100,'grid-halo':visual.gridHalo,'grid-halo-stroke':visual.gridLine+2*visual.gridHaloSize,
  }))root.style.setProperty(`--${key}`,value);
}
