const escape=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={sakura:'sakura',onigiri:'onigiri',chochin:'lantern'};

// Claims are derived during replay from the before/after capture collections,
// so a later capture or undo cannot change what this historical turn recorded.
export function historyEntry(event,players,renderToken) {
 const actor=event.intent.playerId||event.actor;
 const claims=[...(event.claims||[])].sort((a,b)=>(b.playerId===actor)-(a.playerId===actor));
 return escape(event.label)+claims.map(claim=>{
  const name=players.find(p=>p.id===claim.playerId)?.name||'Player';
  const counts=Object.entries(names).map(([type,label])=>{
   const count=claim.tokens.filter(t=>t.type===type).length;
   return count?`${count} ${label}${count>1&&type==='chochin'?'s':''}`:'';
  }).filter(Boolean).join(', ');
  return `${claim.playerId===actor?'':` · ${escape(name)} claimed`}<span class="history-claims" role="img" aria-label="${escape(name)} claimed ${counts}">${claim.tokens.map(t=>`<span class="history-claim-token" data-claimed-type="${escape(t.type)}" aria-hidden="true">${renderToken(t.type)}</span>`).join('')}</span>`;
 }).join('');
}
