import './ability-card.css';
import {asset} from '../art.js';
import {players} from '../catalog.js';
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Printed copy is concise, while keeping every restriction on the physical face.
const rules={
 torii:'Swap any two celebration tokens on the board. A park cannot contain two of the same type.',
 takoyaki:'Swap a celebration behind your screen with one in the ties area.',
 taiyaki:'Place one of your tiles on water. Treat it as a fast boat tile.',
 akkorokamui:'Flip any boat tile face down.',
 'green-tea':'Swap one of your Sakura, Chochin or Onigiri tiles on the board with any tile of the same type.',
 'rainy-day':'Flip any strength 1 or 2 Sakura, Chochin or Onigiri tile face down.',
 bicycle:'Move any tile on land to an available adjacent land space.',
 dango:'Play one of your strength 1 or 2 tiles as a fast tile.',
 'fruit-sandwich':'Swap any two celebration tokens on the board. A park cannot contain two of the same type.',
};
// One square printed object. Hosts choose its size; they never rearrange its face.
export function abilityCardArt(ability,{back=false}={}){
 const ink=!back&&ability?.player!==undefined?players[ability.player].color:'#8a744c';
 const name=ability?.type==='torii'?'Torii':ability?.name;
 return `<div class="printed-ability-card${back?' is-back':''}" data-ability-card="${back?'back':safe(ability.id)}" style="--card-ink:${ink}">${back?`<img class="printed-ability-card__reverse" src="${asset('back')}" alt="Ability card reverse"><span class="printed-ability-card__brand">hanami<small>花見</small></span>`:`<img class="printed-ability-card__art" src="${asset(ability.type)}" alt="${safe(name)} watercolor illustration"><h3 class="printed-ability-card__name">${safe(name)}</h3><p class="printed-ability-card__rules">${safe(rules[ability.type]||ability.effect)}</p>`}</div>`;
}
