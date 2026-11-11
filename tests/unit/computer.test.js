import {test} from 'node:test';
import assert from 'node:assert/strict';
import {replay,VERSION,currentPlayer,applyChoice} from '../../src/game/engine.js';
import {computerObservation,chooseComputerIntent} from '../../src/game/computer.js';
function game(map='nihon',specials=false) {
 const events=[];const add=intent=>{events.push({version:VERSION,sequence:events.length+1,id:`event-${events.length+1}`,actor:'host',intent});return replay(events);};
 add({type:'create',name:'You',computer:true,capacity:2,map,specials});
 add({type:'start',seed:`practice:${map}:${specials}`});
 return {events,add,get state(){return replay(events);}};
}
test('computer seats are host-controlled choices, limited to gathering web games',()=>{
 const events=[{version:VERSION,sequence:1,id:'create',actor:'host',intent:{type:'create',name:'You',computer:true,capacity:2}}];
 const s=replay(events);assert.equal(s.players.length,2);assert.equal(s.players[1].computer,true);assert.equal(s.players[1].controller,'host');assert.notEqual(s.players[0].id,s.players[1].id);
 assert.throws(()=>applyChoice(s,'guest',{type:'add-computer'}));
 assert.throws(()=>applyChoice(s,'host',{type:'add-computer'}));
 assert.throws(()=>applyChoice({...s,mode:'tabletop',capacity:4},'host',{type:'add-computer'}));
 assert.equal(applyChoice({...s,capacity:4},'host',{type:'add-computer'}).players.length,3);
});
test('policy never receives hidden hands, captured totals, decks, seed or history',()=>{
 const g=game(),s=g.state,id=s.players[1].id;
 s.turn=1;const view=computerObservation(s,id),choice=chooseComputerIntent(view,id);
 assert.deepEqual(view.players[0].hand,[]);assert.deepEqual(view.players[0].captured,[]);assert.deepEqual(view.players[1].deck,[]);assert.deepEqual(view.players[1].hand,s.players[1].hand);
 assert.equal(view.seed,undefined);assert.equal(view.history,undefined);
 s.players[0].hand=['copy'];s.players[0].captured=[{id:'secret',type:'sakura'}];s.players[1].deck.reverse();s.seed='secret';
 assert.deepEqual(chooseComputerIntent(computerObservation(s,id),id),choice);
 assert.doesNotThrow(()=>applyChoice(s,'host',choice));
});
test('practice computers consent to human undo without inspecting revealed information',()=>{
 const g=game(),s=g.state,p=s.players[1];
 s.undoRequest={id:'request',required:[p.id],approved:[]};
 assert.deepEqual(chooseComputerIntent(computerObservation(s,p.id),p.id),{type:'undo-vote',playerId:p.id,request:'request',approve:true});
 s.undoRequest.approved=[p.id];assert.equal(chooseComputerIntent(computerObservation(s,p.id),p.id),null);
});
test('legal practice decisions complete both maps with basic and special components and replay to the same victory',()=>{
 for(const map of ['nihon','tokyo'])for(const specials of [false,true]) {
  const g=game(map,specials);let choices=0;
  while(g.state.phase!=='finished'&&choices++<180) {
   const state=g.state;
   const p=state.phase==='choosing'?state.players.find(p=>!p.ability):currentPlayer(state);
   // Let the same policy supply legal decisions for the simulated human too.
   const view=computerObservation(state,p.id);view.players.find(other=>other.id===p.id).computer=true;
   const intent=chooseComputerIntent(view,p.id);
   assert.ok(intent,`${map} specials=${specials} turn=${state.turnNumber} ${p.name} must have a legal decision`);
   g.add(intent);
  }
  assert.equal(g.state.phase,'finished',`${map} specials=${specials}`);
  assert.ok(g.state.winners.length);assert.deepEqual(replay(g.events),g.state);
  assert.ok(g.events.every(e=>!('board' in e.intent)&&!('winner' in e.intent)));
 }
});
