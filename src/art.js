import { players } from "./catalog.js";
export const asset = (name) =>
  `${import.meta.env.BASE_URL}assets/watercolor/${name}.png`;
// Separate display sizes keep Chromium's decoded resize cache independent.
// Every group still serves the same original watercolor bytes.
export const painting = (name, alt = "", cls = "", rasterGroup = "") =>
  `<img class="painting ${cls}" src="${asset(name)}${rasterGroup ? `?raster=${rasterGroup}` : ""}" alt="${alt}" loading="eager" decoding="sync">`;
// Compatibility for gallery ability placeholders while printed references are pending.
export const svg = (body) => body;
export const icon = (type) => painting(type, "Watercolor illustration");
export function tileArt(t, p = 0, back = false, rasterGroup = "tile") {
  const a = players[p];
  return `<div class="painted-tile" style="--player:${a.color}"><div class="tile-face">${painting(back ? "back" : t.type, back ? `${a.name} tile reverse` : `${t.name} watercolor`, "", rasterGroup)}${back ? `<span class="player-seal back-seal">${a.mark}</span>` : `<span class="player-seal">${a.mark}</span>${t.fast ? '<span class="fast-seal" title="Fast tile">»</span>' : ""}<span class="influence" aria-label="Influence ${t.strength || 0}">${Array.from({ length: t.strength || 0 }, () => "<i></i>").join("")}</span>${t.direction !== undefined ? `<span class="copy-direction" style="--direction:${t.direction * 60}deg" aria-label="Copy direction: north">↑</span>` : ""}${t.group === "Special" ? '<span class="special-seal">✦</span>' : ""}`}</div></div>`;
}
export function tokenArt(type, large = false, rasterGroup = "gallery") {
  return `<div class="painted-token ${large ? "victory-token" : ""}">${painting(`token-${type}`, `${type} ${large ? "victory marker" : "celebration token"}`, "", large ? "victory" : rasterGroup)}${large ? '<span class="victory-seal" aria-label="Victory">✦</span>' : ""}</div>`;
}
export function screenArt(p) {
  let a = players[p];
  return `<div class="painted-screen" style="--player:${a.color}">${painting("screen", `${a.name} watercolor player screen`)}<span class="screen-fold fold-left"></span><span class="screen-fold fold-right"></span><span class="screen-seal">${a.mark}</span></div>`;
}
