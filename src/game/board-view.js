import '../components/board-pieces.css';
import { painting } from '../art.js';
import { cellLayout, visualSettings } from '../components/visual-settings.js';
import { boardGrid } from './board-grid.js';
import { boardCells } from './maps.js';
import {boardTileStack} from '../components/tile-stack.js';
import {stackLayers} from './tile-stack.js';

// Shared by the playable table and the local animation lab.
export function boardCellArt(cell, {
  map = 'nihon', visual=visualSettings(map), piece, tokens = [], legal = false, ownerName = '', playerIndex = 0,
  renderToken = () => '', repositionable=false, influence = new Map(), actionLabel = '', playerIndexFor = () => playerIndex,
}) {
  const position = cellLayout(map, cell, visual);
  const depth=stackLayers(piece).length;
  const label = piece ? `${ownerName} ${piece.name}` : cell.kind;
  const safe = (value) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return `<div class="board-cell ${cell.kind} ${piece ? 'occupied' : ''} ${legal ? 'legal' : ''}" style="left:${position.x}%;top:${position.y}%;--board-cell-width:${position.width}%;--board-cell-aspect:${position.aspect};" data-cell-wrapper="${cell.id}"><button class="space-target" data-cell="${cell.id}" data-kind="${cell.kind}" data-legal="${legal}" data-repositionable="${repositionable}" data-owner="${safe(ownerName)}" data-board-tile="${piece?.tile || ''}" data-stack-size="${depth}" aria-label="${safe(actionLabel || (depth>1&&!legal?`Inspect ${depth} tiles`:label))} at ${cell.id}" ${legal || depth>1 || repositionable ? '' : 'disabled'}>${piece ? boardTileStack(piece,playerIndex,playerIndexFor) : ''}</button>${tokens.length ? `<div class="park-pieces count-${tokens.length}">${tokens.map(token => renderToken(token, `park-${tokens.length}`, influence.get(token.id))).join('')}</div>` : ''}</div>`;
}

export function boardSurfaceArt({map,playerCount=4,visual=visualSettings(map),renderCell=()=>'',rasterGroup='board',showGrid=true}) {
  return `${painting(map,`${map} watercolor board`,'',rasterGroup)}${showGrid?boardGrid(map,playerCount,visual):''}<div class="board-hit-layer">${boardCells(map,playerCount).map(renderCell).join('')}</div>`;
}
