import {players} from './catalog.js';
export const asset=(name)=>`/assets/watercolor/${name}.png`;
export const painting=(name,alt='',cls='')=>`<img class="painting ${cls}" src="${asset(name)}" alt="${alt}" loading="lazy" decoding="async">`;
// Compatibility for gallery ability placeholders while printed references are pending.
export const svg=(body)=>body;
export const icon=(type)=>painting(type,'Watercolor illustration');
export function tileArt(t,p=0,back=false){const a=players[p];return `<div class="painted-tile" style="--player:${a.color}"><div class="tile-face">${painting(back?'back':t.type,back?`${a.name} tile reverse`:`${t.name} watercolor`)}${back?`<span class="player-seal back-seal">${a.mark}</span>`:`<span class="player-seal">${a.mark}</span>${t.fast?'<span class="fast-seal" title="Fast tile">»</span>':''}<span class="influence" aria-label="Influence ${t.strength||0}">${Array.from({length:t.strength||0},()=>'<i></i>').join('')}</span>${t.direction!==undefined?`<span class="copy-direction" style="--direction:${t.direction*60}deg" aria-label="Copy direction: upper right">↗</span>`:''}${t.group==='Special'?'<span class="special-seal">✦</span>':''}`}</div></div>`;}
export function tokenArt(type,large=false){return `<div class="painted-token ${large?'victory-token':''}">${painting(`token-${type}`,`${type} ${large?'victory marker':'celebration token'}`)}${large?'<span class="victory-seal" aria-label="Victory">✦</span>':''}</div>`;}
export function screenArt(p){let a=players[p];return `<div class="painted-screen" style="--player:${a.color}">${painting('screen',`${a.name} watercolor player screen`)}<span class="screen-fold fold-left"></span><span class="screen-fold fold-right"></span><span class="screen-seal">${a.mark}</span></div>`;}
