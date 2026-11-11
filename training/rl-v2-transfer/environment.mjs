import {applyChoice,initial,currentPlayer,replay,VERSION} from '../../src/game/engine.js';
import {computerObservation,chooseComputerIntent} from '../../src/game/computer.js';
import {chooseRlIntent} from '../../src/game/rl-policy.js';
import {chooseModelIntent} from '../../src/game/rl-policy-v2.js';
import {random} from '../../src/game/random.js';
export function playGame({seed,map='nihon',specials=false,seat=0,model,opponentModel=null,sample=false,keepEvents=false,verifyReplay=false}){
 let state=initial();const events=[],rng=random(`${seed}:policy:${seat}`),gradient=model.weights.map(()=>0);let decisions=0,entropy=0,truncated=false,reason=null;
 const add=intent=>{const event={version:VERSION,actor:'host',sequence:events.length+1,id:`choice-${events.length+1}`,intent};state=applyChoice(state,'host',intent);events.push(event);};
 add({type:'create',name:'Seat 0',capacity:2,computer:true,map,specials});add({type:'start',seed});
 const learner=state.players[seat].id;
 for(let step=0;state.phase!=='finished'&&step<256;step++){
  const p=state.phase==='choosing'?state.players.find(p=>!p.ability):currentPlayer(state);
  const view=computerObservation(state,p.id);let intent;
  if(p.id===learner){const choice=chooseModelIntent(view,p.id,model,{sample,random:rng,record:sample});intent=choice.intent;if(choice.gradient){choice.gradient.forEach((x,i)=>gradient[i]+=x);entropy+=choice.entropy;decisions++;}}
  else{
   // The production policy's computer flag is a UI/controller-role guard.
   // Normalize only that flag when the frozen opponent occupies seat zero.
   view.players.find(other=>other.id===p.id).computer=true;
   intent=opponentModel?chooseRlIntent(view,p.id,opponentModel).intent:chooseComputerIntent(view,p.id);
  }
  if(!intent){truncated=true;reason='no-legal-choice';break;}
  add(intent);
 }
 if(state.phase!=='finished'){truncated=true;reason??='decision-cap';}
 if(verifyReplay){const projected=replay(events);if(projected.phase!==state.phase||JSON.stringify(projected.winners)!==JSON.stringify(state.winners)||JSON.stringify(projected.board)!==JSON.stringify(state.board)||JSON.stringify(projected.players.map(p=>p.captured))!==JSON.stringify(state.players.map(p=>p.captured)))throw Error('Fast simulator diverged from event replay');}
 const win=!truncated&&state.winners.length===1&&state.winners[0]===learner;
 const draw=!truncated&&state.winners.length>1;
 return {seed,map,specials,seat,win,draw,truncated,reason,reward:win?1:draw?0:-1,decisions,entropy:decisions?entropy/decisions:0,gradient,turns:state.turnNumber,choices:events.length,...(keepEvents?{events}:{}),winners:state.winners.map(id=>state.players.findIndex(p=>p.id===id))};
}
