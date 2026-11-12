import {applyChoice,abilityById,currentPlayer,parkInfluence} from './engine.js';
import {computerObservation} from './computer.js';

// Preview only a public board change. Decks and the other players' hands never
// enter the speculative reducer, and no event, capture or hand is committed.
export function previewInfluence(state,playerId,selection,cell) {
 if(!selection||state.phase!=='playing'||state.undoRequest||currentPlayer(state)?.id!==playerId)return {state,preview:false};
 const view=computerObservation(state,playerId),p=view.players.find(p=>p.id===playerId);
 let intent;
 if(cell){
  if(selection.reposition)intent={type:'reposition',source:selection.reposition,destination:cell,...(selection.tile==='copy'?{direction:selection.direction}:{})};
  else if(selection.ability){
   const kind=abilityById(p.ability)?.type;
   if(['akkorokamui','rainy-day'].includes(kind))intent={type:'ability',a:cell};
   else if(selection.targets?.length===1)intent={type:'ability',a:selection.targets[0],b:cell};
  }else if(selection.tile==='move'){
   if(selection.source)intent={type:'move',source:selection.source,destination:cell,...(selection.holding?.tile==='copy'?{direction:selection.holding.direction}:{})};
  }else if(selection.tile)intent={type:'place',tile:selection.tile,cell,...(selection.tile==='copy'?{direction:selection.direction??0}:{})};
 }
 if(intent){
  try{return {state:applyChoice(view,p.controller,{...intent,playerId}),preview:true};}catch{/* Invalid destinations leave the board unchanged. */}
 }
 if(selection.holding&&selection.source){
  view.board[selection.source]={tile:'move',cell:selection.source,owner:playerId,direction:0};
  return {state:view,preview:true};
 }
 return {state,preview:false};
}

export function influenceReadings(state,preview=false) {
 const readings=new Map();
 if(!state.players.length)return readings;
 for(const [park,tokens] of Object.entries(state.tokens))for(const token of tokens){
  const scores=parkInfluence(state,park,token.type),total=Math.max(0,...scores.map(row=>row.total));
  const leaders=total?scores.filter(row=>row.total===total).map(row=>row.playerId):[];
  readings.set(token.id,{tokenId:token.id,type:token.type,total,leaders,preview,status:!total?'none':leaders.length===1?'leader':'tie'});
 }
 return readings;
}
