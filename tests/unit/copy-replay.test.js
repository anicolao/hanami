import {test} from 'node:test';
import assert from 'node:assert/strict';
import {replay,cells,undoTarget,canRotateCopy} from '../../src/game/engine.js';

test('a Copy placed under protocol 2 can be adjusted under protocol 3, undone and replayed',()=>{
 let events=[],state;
 const add=(actor,intent,version=2)=>{events.push({actor,intent,version,id:`copy-${events.length}`,sequence:events.length+1});state=replay(events);return state;};
 for(let trial=0;trial<100;trial++){
  events=[];add('a',{type:'create',name:'Alex',capacity:2,specials:true});add('b',{type:'join',name:'Bea'});add('a',{type:'start',seed:`copy-replay:${trial}`});
  if(state.players[0].hand.includes('copy'))break;
 }
 assert.ok(state.players[0].hand.includes('copy'));
 for(const p of state.players)add(p.controller,{type:'choose-ability',playerId:p.id,ability:p.abilityOptions[0]});
 const cell=cells(state).find(c=>c.kind==='land').id;
 add('a',{type:'place',tile:'copy',cell,direction:0});
 assert.equal(canRotateCopy(state,'a',cell),true);
 add('a',{type:'rotate-copy',cell,direction:2},3);
 assert.equal(state.board[cell].direction,2);
 const target=undoTarget(state,'a');assert.equal(target.consent,false);
 add('a',{type:'undo',target:target.id},3);
 assert.equal(state.board[cell].direction,0);
 assert.equal(state.history.find(e=>e.id===target.id).active,false);
 add('a',{type:'rotate-copy',cell,direction:5},3);
 assert.equal(state.board[cell].direction,5);
 assert.deepEqual(replay(events),state);
 assert.equal(state.normalUsed,true);
 add('a',{type:'end'},3);
 assert.equal(canRotateCopy(state,'a',cell),false);
});
