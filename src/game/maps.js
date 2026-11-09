import maps from "./maps.json" with { type: "json" };
export const MAP_VERSION = 1;
export function neighbors(a, b) {
  return a.q === b.q
    ? Math.abs(a.r - b.r) === 1
    : Math.abs(a.q - b.q) === 1 &&
        (b.r === a.r || b.r === a.r + (a.q % 2 ? 1 : -1));
}
export function boardCells(map, count) {
  return maps[map].filter((c) => c.region <= count);
}
export function adjacent(c, cells) {
  return cells.filter((n) => neighbors(c, n));
}
