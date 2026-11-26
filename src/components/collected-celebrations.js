const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const types=[['sakura','sakura'],['onigiri','onigiri'],['chochin','lanterns']];

// A public collection is independent of the screen hiding a player's hand.
// Counts are derived from replayed tokens, never cached separately.
export function collectedCelebrationsArt(player,renderType) {
 const captured=player.captured;
 return `<div class="collected-celebrations" role="group" aria-label="${safe(player.name)}’s collected celebrations" data-collected-player="${safe(player.id)}"><span class="collection-total">${captured.length} gathered</span>${types.map(([type,label])=>{
  const count=captured.filter(token=>token.type===type).length;
  return `<span class="collection-type" data-collection-type="${type}" data-count="${count}" aria-label="${count} ${label}"><span aria-hidden="true">${renderType(type)}</span><strong aria-hidden="true">${count}</strong></span>`;
 }).join('')}</div>`;
}
