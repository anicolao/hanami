import './board-painting.css';

// Preserve the original painting's organic coastline. No terrain clipping/warping.
export function boardPainting(map,alt,cls='',rasterGroup='board') {
  return `<img class="painting board-painting ${cls}" src="${import.meta.env.BASE_URL}assets/boards/${map}-organic.png?raster=${rasterGroup}" alt="${alt}" data-board-art="organic-grid-removed" decoding="sync">`;
}
