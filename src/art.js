import {boardPainting} from "./board-painting.js";
import { players } from "./catalog.js";
import "./tile-icons.css";
import "./printed-tiles.css";
export const asset = (name) =>
  `${import.meta.env.BASE_URL}assets/watercolor/${name}.png`;
// Small components use area-filtered derivatives: shrinking the full-resolution
// paper texture directly in a clipped/transformed layer aliases into speckles.
// Keep size families separate for Chromium's decoded resize cache as well.
export function painting(name, alt = "", cls = "", rasterGroup = "") {
  if(['nihon','tokyo'].includes(name)&&rasterGroup!=='lab-board-previous')return boardPainting(name,alt,cls,rasterGroup||'board');
  const small = rasterGroup && rasterGroup!=='lab-board-previous' && rasterGroup !== 'gallery' && !['nihon','tokyo','screen','box'].includes(name);
  const query = rasterGroup ? `?raster=${rasterGroup}` : '';
  const derivative = size => `${import.meta.env.BASE_URL}assets/watercolor/small/${size}/${name}.png${query}`;
  return `<img class="painting ${cls}" src="${small ? derivative(64) : asset(name) + query}"${small ? ` srcset="${derivative(64)} 1x, ${derivative(128)} 2x, ${derivative(256)} 4x"` : ''} alt="${alt}" loading="eager" decoding="sync">`;
}
// Compatibility for gallery ability placeholders while printed references are pending.
export const svg = (body) => body;
export const icon = (type) => painting(type, "Watercolor illustration");
// Each image badge has an explicit semantic label; no font glyphs or CSS dots.
function badge(index, cls, label, extra = '') {
  const x=(index%4)*100/3, y=Math.floor(index/4)*50;
  return `<span class="tile-overlay ${cls}" role="img" aria-label="${label}" title="${label}" style="background-image:url('${import.meta.env.BASE_URL}assets/icons/tile-badges-v2.png');background-position:${x}% ${y}%;${extra}"></span>`;
}
const printedAsset = path => `${import.meta.env.BASE_URL}assets/printed-tiles/${path}`;
function printInk(index, cls, label) {
  return `<span class="printed-ink ${cls}" role="img" aria-label="${label}" style="mask-image:url('${printedAsset(`marks/${index}.png`)}')"></span>`;
}
export function tileArt(t, p = 0, back = false, rasterGroup = "gallery", artMode = "transparent") {
  const player=players[p],type=back?'back':t.type;
  const rotation=t.type==='copy'&&!back?((t.direction||0)*60+180)%360:0;
  const directions=['north','north-east','south-east','south','south-west','north-west'];
  const main=back?printInk(8+p,'printed-value',`${player.name} tile reverse`)
    :t.strength?printInk(t.strength-1,'printed-value',`Influence ${t.strength}`)
    :t.type==='copy'?printInk(5,'printed-value printed-copy-arrow',`Copy direction: ${directions[(t.direction||0)%6]}`)
    :t.type==='move'?printInk(4,'printed-value','Fast tile · Move'):'';
  const owner=printInk(8+p,'printed-owner',`${player.name} · ${player.pattern}`);
  const action=back?'':t.fast&&t.type!=='move'?printInk(4,'printed-action','Fast tile')
    :t.group==='Special'?printInk(6,'printed-action','Special tile'):'';
  const family=rasterGroup||'gallery';
  const face=size=>artMode==='original'?`${asset(type)}?raster=${family}`:`${printedAsset(`cutouts/${size}/${type}.png`)}?raster=${family}`;
  return `<div class="painted-tile printed-tile" style="--player:${player.color};--value-ink:${p===2?'#182b38':'#f8ebcd'};--tile-turn:${rotation}deg"><div class="tile-face"><span class="printed-background" aria-hidden="true" style="mask-image:url('${printedAsset('frame-silhouette.png')}')"></span><img class="painting printed-illustration" data-illustration="${artMode}" style="${artMode==='original'?`mask-image:url('${printedAsset('art-window.png')}')`:''}" src="${face(128)}" srcset="${face(64)} 64w, ${face(128)} 128w, ${face(256)} 256w, ${face(512)} 512w, ${face(1024)} 1024w" sizes="${family==='gallery'?'320px':family==='board'?'48px':'96px'}" alt="${back?player.name+' tile reverse':t.name+' printed watercolor tile'}" loading="eager" decoding="sync"><span class="printed-frame" aria-hidden="true"><span class="printed-frame-ink" style="mask-image:url('${printedAsset('frame-mask.png')}')"></span><img src="${printedAsset('frame-gold.png')}" alt=""></span>${main}${owner}${action}</div></div>`;
}
export function tokenArt(type, large = false, rasterGroup = "gallery") {
  return `<div class="painted-token ${large ? "victory-token" : ""}">${painting(`token-${type}`, `${type} ${large ? "victory marker" : "celebration token"}`, "", large ? "victory" : rasterGroup)}${large ? badge(7,'tile-victory','Victory') : ""}</div>`;
}
export function screenArt(p) {
  let a = players[p];
  return `<div class="painted-screen" style="--player:${a.color}">${painting("screen", `${a.name} watercolor player screen`)}<span class="screen-fold fold-left"></span><span class="screen-fold fold-right"></span><span class="screen-seal">${a.mark}</span></div>`;
}
