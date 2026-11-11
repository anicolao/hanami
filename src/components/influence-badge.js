import {players as finishes} from '../catalog.js';
const names={sakura:'Sakura',chochin:'Lantern',onigiri:'Onigiri'};
const escape=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function details(reading,players){
 const leaders=reading.leaders.map(id=>players.find(p=>p.id===id)).filter(Boolean);
 const leader=leaders.length===1?leaders[0]:null;
 const color=leader?finishes[leader.color??players.indexOf(leader)]?.color:'#68786c';
 const label=`${reading.preview?'Preview · ':''}${names[reading.type]}: ${!reading.total?'no influence':leader?`${leader.name} leads with ${reading.total} influence`:`${leaders.map(p=>p.name).join(' and ')} tied at ${reading.total} influence`}`;
 return {color,label};
}
export function influenceBadge(reading,players){
 if(!reading)return '';
 const {color,label}=details(reading,players);
 return `<span class="influence-badge ${reading.preview?'is-preview':''}" data-influence-for="${escape(reading.tokenId)}" data-influence-status="${reading.status}" data-influence-total="${reading.total}" style="--influence-color:${color}" role="img" aria-label="${escape(label)}" title="${escape(label)}">${reading.total}</span>`;
}
export function updateInfluenceBadges(root,readings,players){
 for(const badge of root.querySelectorAll('[data-influence-for]')){
  const reading=readings.get(badge.dataset.influenceFor);if(!reading)continue;
  const {color,label}=details(reading,players);
  badge.textContent=String(reading.total);badge.dataset.influenceStatus=reading.status;badge.dataset.influenceTotal=String(reading.total);
  badge.classList.toggle('is-preview',reading.preview);badge.style.setProperty('--influence-color',color);
  badge.setAttribute('aria-label',label);badge.title=label;
 }
}
