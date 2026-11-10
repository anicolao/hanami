import { boardCells } from './maps.js';
import { BOARD_GEOMETRY } from './board-geometry.js';

import { cellLayout, visualSettings } from '../components/visual-settings.js';

// Use the same centers as tile placement, including cells outside this game's regions.
export function boardGrid(map, playerCount = 4, visual=visualSettings(map)) {
  const grid = BOARD_GEOMETRY[map], all = boardCells(map, 4);
  const active = new Set(boardCells(map, playerCount).map(cell => cell.id));
  const layout=cellLayout(map,all[0],visual);
  const width=layout.width/100*grid.imageWidth,height=width/layout.aspect;
  const centers=[];
  const edges = new Map();
  const shade = all.map(cell => {
    const center = cellLayout(map, cell, visual);
    const x = center.x * grid.imageWidth / 100, y = center.y * grid.imageHeight / 100;
    if(visual.gridCenters)centers.push(`M${x-1.5},${y}h3 M${x},${y-1.5}v3`);
    const vertices = [[x-width/2,y],[x-width/4,y-height/2],[x+width/4,y-height/2],[x+width/2,y],[x+width/4,y+height/2],[x-width/4,y+height/2]];
    for (let i=0;i<6;i++) {
      const a=vertices[i].map(n=>n.toFixed(3)).join(','), b=vertices[(i+1)%6].map(n=>n.toFixed(3)).join(',');
      edges.set([a,b].sort().join('|'), `M${a}L${b}`);
    }
    return `<polygon data-grid-cell="${cell.id}" data-in-play="${active.has(cell.id)}" points="${vertices.map(v=>v.join(',')).join(' ')}"/>`;
  }).join('');
  return `<svg class="board-grid-overlay" viewBox="0 0 ${grid.imageWidth} ${grid.imageHeight}" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><g class="board-region-shading">${shade}</g>${visual.gridHaloSize>0?`<path class="board-grid-halo" d="${[...edges.values()].join('')}"/>`:''}${visual.gridCenters?`<path class="board-grid-centers" d="${centers.join('')}"/>`:''}<path class="board-grid-lines" d="${[...edges.values()].join('')}" vector-effect="non-scaling-stroke"/></svg>`;
}
