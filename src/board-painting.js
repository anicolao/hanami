import './board-painting.css';
import {BOARD_GEOMETRY} from './game/board-geometry.js';

// Preserve the original painting's organic coastline. No terrain clipping/warping.
export function boardPainting(map,alt,cls='',rasterGroup='board') {
  const {imageWidth,imageHeight}=BOARD_GEOMETRY[map];
  return `<img width="${imageWidth}" height="${imageHeight}" class="painting board-painting ${cls}" src="${import.meta.env.BASE_URL}assets/boards/${map}-organic.png?raster=${rasterGroup}" alt="${alt}" data-board-art="organic-grid-removed" decoding="sync">`;
}
