// Display geometry measured against the shipped watercolor bitmaps, rather than
// the original rulebook photographs. Logical q/r coordinates and rules stay intact.
export const BOARD_GEOMETRY = Object.freeze({
  nihon: Object.freeze({
    imageWidth: 1831, imageHeight: 859,
    // Final visual registration: 1.5 artwork pixels east and south of the edge fit.
    originX: 49.275646, originY: -1.572354,
    columnStep: 59.301199, rowStep: 68.501509,
  }),
  tokyo: Object.freeze({
    imageWidth: 1825, imageHeight: 862,
    originX: 57.049012, originY: 3.368386,
    columnStep: 58.631940, rowStep: 68.106852,
  }),
});

export function paintedCell(map, cell) {
  const grid = BOARD_GEOMETRY[map];
  if (!grid) throw new Error(`Unknown board artwork: ${map}`);
  return {
    ...cell,
    x: (grid.originX + cell.q * grid.columnStep) / grid.imageWidth * 100,
    y: (grid.originY + (cell.r + (cell.q % 2) / 2) * grid.rowStep) / grid.imageHeight * 100,
  };
}

export function boardMetrics(map) {
  const grid = BOARD_GEOMETRY[map];
  return {
    cellWidth: Number((grid.columnStep * 4 / 3 / grid.imageWidth * 100).toFixed(3)),
    cellAspect: Number((grid.columnStep * 4 / 3 / grid.rowStep).toFixed(3)),
  };
}
