import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initial,applyChoice,currentPlayer} from '../../src/game/engine.js';
import {computerObservation,chooseComputerIntent} from '../../src/game/computer.js';
import {chooseModelIntent} from '../../src/game/rl-policy-v2.js';
import {choosePracticeIntent} from '../../src/game/difficulty.js';
function game(difficulty){return applyChoice(applyChoice(initial(),'host',{type:'create',name:'Player',capacity:2,computer:true,difficulty}),'host',{type:'start',seed:'difficulty-unit'});}
test('difficulty is an immutable replayed choice, with legacy computers retaining easy behavior',()=>{
 for(const difficulty of ['easy','medium','hard'])assert.equal(game(difficulty).players[1].difficulty,difficulty);
 assert.equal(game(undefined).players[1].difficulty,undefined);
 assert.throws(()=>game('impossible'),/level/i);
 assert.throws(()=>applyChoice(initial(),'host',{type:'create',name:'Player',capacity:4,computer:true,difficulty:'hard'}),/two|2/i);
 let gathering=applyChoice(initial(),'host',{type:'create',name:'Player',capacity:2});
 gathering=applyChoice(gathering,'host',{type:'add-computer',difficulty:'medium'});
 assert.equal(gathering.players[1].difficulty,'medium');
 assert.throws(()=>applyChoice(gathering,'host',{type:'configure',capacity:3}),/two|2/i);
});
test('level dispatch uses the exact frozen models; every level shares undo consent',()=>{
 const state=game('hard');state.turn=1;const id=state.players[1].id,view=computerObservation(state,id);
 assert.deepEqual(choosePracticeIntent(view,id,'easy'),chooseComputerIntent(view,id));
 for(const level of ['medium','hard']){
  const model=JSON.parse(fs.readFileSync(new URL(`../../src/game/models/${level}.json`,import.meta.url)));
  const intent=choosePracticeIntent(view,id,level);
  assert.deepEqual(intent,chooseModelIntent(view,id,model).intent);
  assert.doesNotThrow(()=>applyChoice(state,'host',intent));
 }
 view.undoRequest={id:'undo',required:[id],approved:[]};
 for(const level of ['easy','medium','hard'])assert.deepEqual(choosePracticeIntent(view,id,level),{type:'undo-vote',playerId:id,request:'undo',approve:true});
 assert.throws(()=>choosePracticeIntent(view,id,'impossible'),/level/);
 assert.equal(choosePracticeIntent(view,state.players[0].id,'hard'),null);
});
test('all levels finish genuine basic and special games on both boards',()=>{
 for(const level of ['easy','medium','hard'])for(const map of ['nihon','tokyo'])for(const specials of [false,true]){
  let state=applyChoice(initial(),'host',{type:'create',name:'Player',capacity:2,computer:true,difficulty:level,map,specials});
  state=applyChoice(state,'host',{type:'start',seed:`difficulty:${map}:${specials}`});
  let steps=0;
  while(state.phase!=='finished'&&steps++<256){
   const p=state.phase==='choosing'?state.players.find(p=>!p.ability):currentPlayer(state);
   const view=computerObservation(state,p.id);view.players.find(other=>other.id===p.id).computer=true;
   const intent=choosePracticeIntent(view,p.id,p.id===state.players[1].id?level:'easy');
   assert.ok(intent,`${level} ${map} ${specials}`);state=applyChoice(state,'host',intent);
  }
  assert.equal(state.phase,'finished',`${level} ${map} ${specials}`);assert.ok(state.winners.length);
 }
});
test('medium and hard decisions remain independent of hidden hands, bags and captured arrays',()=>{
 const state=game('hard');state.turn=1;const id=state.players[1].id;
 const before=Object.fromEntries(['medium','hard'].map(level=>[level,choosePracticeIntent(computerObservation(state,id),id,level)]));
 state.players[0].hand=['copy'];state.players[0].captured=[{id:'private',type:'sakura'}];state.players.forEach(p=>p.deck.reverse());state.seed='private';
 for(const level of ['medium','hard'])assert.deepEqual(choosePracticeIntent(computerObservation(state,id),id,level),before[level]);
});
