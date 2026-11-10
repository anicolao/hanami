import {applyChoice, availablePlacement, cells, currentPlayer, strength, tileById, abilityById} from './engine.js';
import {adjacent, neighbors} from './maps.js';

// Deliberate information boundary: no other hand, draw order, captured tokens,
// shuffle seed or event history reaches the policy (even in trusted-client play).
export function computerObservation(state, playerId) {
  return {
    phase:state.phase,map:state.map,host:state.host,mode:state.mode,
    turn:state.turn,turnNumber:state.turnNumber,normalUsed:state.normalUsed,
    placed:state.placed,abilityUsedThisTurn:state.abilityUsedThisTurn,
    board:structuredClone(state.board),tokens:structuredClone(state.tokens),ties:structuredClone(state.ties),
    undoRequest:structuredClone(state.undoRequest),
    players:state.players.map(p=>({
      id:p.id,controller:p.controller,name:p.name,edge:p.edge,color:p.color,
      computer:!!p.computer,ability:p.ability,usedAbility:p.usedAbility,
      abilityOptions:p.id===playerId?[...(p.abilityOptions||[])]:[],
      hand:p.id===playerId?[...p.hand]:[],deck:[],
      captured:p.id===playerId?structuredClone(p.captured):[],
    })),
  };
}

function* abilityChoices(s,p,spaces) {
  const kind=abilityById(p.ability)?.type,board=Object.values(s.board);
  const tokens=Object.values(s.tokens).flat();
  const pair=(a,b)=>({type:'ability',a,b});
  if(kind==='torii'||kind==='fruit-sandwich') {
    for(let i=0;i<tokens.length;i++)for(let j=i+1;j<tokens.length;j++)
      if(tokens[i].type!==tokens[j].type)yield pair(tokens[i].id,tokens[j].id);
  } else if(kind==='takoyaki') {
    for(const a of p.captured)for(const b of s.ties)yield pair(a.id,b.id);
  } else if(kind==='taiyaki'||kind==='dango') {
    for(const id of p.hand)for(const c of spaces) {
      const t=tileById(id);
      if(kind==='taiyaki'?c.kind==='water'&&!s.board[c.id]:t.strength<=2&&c.kind==='land')yield pair(id,c.id);
    }
  } else if(kind==='akkorokamui'||kind==='rainy-day') {
    for(const a of board)if(a.owner!==p.id)yield {type:'ability',a:a.cell};
  } else if(kind==='green-tea') {
    for(const a of board.filter(a=>a.owner===p.id))for(const b of board.filter(b=>b.owner!==p.id))yield pair(a.cell,b.cell);
  } else if(kind==='bicycle') {
    const byId=new Map(spaces.map(c=>[c.id,c]));
    for(const a of board)for(const b of spaces)
      if(b.kind==='land'&&!s.board[b.id]&&neighbors(byId.get(a.cell),b))yield pair(a.cell,b.id);
  }
}

// A deterministic one-ply practice policy: secure celebrations, build influence,
// deny opponents, and conserve a once-per-game ability unless it improves play.
export function chooseComputerIntent(view, playerId) {
  const p=view.players.find(p=>p.id===playerId);
  if(!p?.computer)return null;
  if(view.undoRequest) {
    const r=view.undoRequest;
    return r.required.includes(p.id)&&!r.approved.includes(p.id)
      ?{type:'undo-vote',playerId:p.id,request:r.id,approve:true}:null;
  }
  if(view.phase==='choosing'&&!p.ability) {
    const preference=['taiyaki','dango','bicycle','green-tea','fruit-sandwich','rainy-day','akkorokamui','takoyaki'];
    const ability=[...p.abilityOptions].sort((a,b)=>preference.indexOf(abilityById(a).type)-preference.indexOf(abilityById(b).type))[0];
    return ability?{type:'choose-ability',playerId:p.id,ability}:null;
  }
  if(view.phase!=='playing'||currentPlayer(view)?.id!==p.id)return null;
  const spaces=cells(view),parks=spaces.filter(c=>c.kind==='park').map(c=>({id:c.id,around:adjacent(c,spaces)}));
  const score=s=>{
    let value=s.players.reduce((n,other)=>n+other.captured.length*(other.id===p.id?72:8),0);
    for(const park of parks) {
      const remaining=s.tokens[park.id]||[];if(!remaining.length)continue;
      const open=park.around.filter(c=>c.kind==='land'&&!s.board[c.id]).length;
      for(const token of remaining) {
        const scores=s.players.map(other=>park.around.reduce((n,c)=>n+(s.board[c.id]?.owner===other.id?strength(s,s.board[c.id],token.type):0),0));
        const ours=scores[s.players.findIndex(other=>other.id===p.id)],theirs=Math.max(0,...scores.filter((_,i)=>s.players[i].id!==p.id));
        if(!open)value+=40+(ours>theirs?32:ours<theirs?-32:0);
        else value+=(Math.tanh((ours-theirs)/3)*8+Math.min(ours,10)*.3)/(1+open*.5);
      }
    }
    return value;
  };
  const base=score(view);let best=null,bestValue=-Infinity;
  const consider=(intent,penalty=0)=>{
    try {
      const next=applyChoice(view,p.controller,{...intent,playerId:p.id});
      const value=score(next)-penalty;
      if(value>bestValue+1e-7){bestValue=value;best={...intent,playerId:p.id};}
    }catch{/* The production engine is the authority for candidate legality. */}
  };
  // End first: do not waste extra tiles after a productive turn.
  consider({type:'end'});
  for(const id of p.hand) {
    const t=tileById(id);if(t.type==='move')continue;
    for(const c of spaces)if(availablePlacement(view,p.id,id,c.id))
      for(let direction=0;direction<(t.type==='copy'?6:1);direction++)
        consider({type:'place',tile:id,cell:c.id,...(t.type==='copy'?{direction}:{})},.08+(t.strength||0)*.015);
  }
  if(p.hand.includes('move'))for(const source of Object.values(view.board))
    if(source.owner===p.id&&!tileById(source.tile).fast&&!source.facedown)
      for(const c of spaces)if(c.kind==='land'&&!view.board[c.id])consider({type:'move',source:source.cell,destination:c.id},.1);
  if(!p.usedAbility&&!view.placed&&!view.abilityUsedThisTurn)
    for(const intent of abilityChoices(view,p,spaces)) {
      // Only spend an ability for an immediate improvement, never as filler.
      try {if(score(applyChoice(view,p.controller,{...intent,playerId:p.id}))>base+1)consider(intent,1);}catch{}
    }
  return best;
}
