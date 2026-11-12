import {test} from 'node:test';
import assert from 'node:assert/strict';
import {replay,cells,tileById,availablePlacement,VERSION,scoreGame,initial} from '../../src/game/engine.js';
function setup(){
 let events,state;
 for(let n=0;n<100;n++){
  events=[{actor:'a',intent:{type:'create',name:'A',capacity:2}},{actor:'b',intent:{type:'join',name:'B'}},{actor:'a',intent:{type:'start',seed:`normal-Move-${n}`}}].map((e,i)=>({...e,version:4,id:`e${i}`,sequence:i+1}));state=replay(events);
  const hand=state.players[0].hand.map(tileById);
  if(hand.some(t=>t.id==='move')&&hand.filter(t=>!t.fast&&t.id!=='move').length>=2&&hand.some(t=>t.fast))break;
 }
 const add=(actor,intent,version=VERSION)=>{const event={actor,intent,version,id:`e${events.length}`,sequence:events.length+1};state=replay([...events,event]);events.push(event);return state;};
 const land=cells(state).filter(c=>c.kind==='land');
 const source=land[0].id,tile=state.players[0].hand.find(id=>id!=='move'&&!tileById(id).fast);
 add('a',{type:'place',tile,cell:source},4);add('a',{type:'end'},4);
 const their=state.players[1].hand.flatMap(tile=>cells(state).filter(c=>availablePlacement(state,'b',tile,c.id)).map(c=>({tile,cell:c.id})))[0];
 add('b',{type:'place',...their},4);add('b',{type:'end'},4);
 return {get events(){return events;},get state(){return state;},add,source,land};
}
test('Move consumes the normal placement; fast tiles remain legal afterwards',()=>{
 const t=setup(),destination=t.land.find(c=>!t.state.board[c.id]).id;
 assert.equal(tileById('move').fast,false);
 t.add('a',{type:'move',source:t.source,destination});assert.equal(t.state.normalUsed,true);
 const normal=t.state.players[0].hand.find(id=>!tileById(id).fast),target=t.land.find(c=>!t.state.board[c.id]).id;
 assert.throws(()=>t.add('a',{type:'place',tile:normal,cell:target}),/normal tile/);
 const fast=t.state.players[0].hand.find(id=>tileById(id).fast),cell=cells(t.state).find(c=>availablePlacement(t.state,'a',fast,c.id)).id;
 t.add('a',{type:'place',tile:fast,cell});assert.equal(t.state.normalUsed,true);assert.equal(t.state.placed,2);
});
test('a normal placement prevents Move, including when continuing a protocol-4 turn',()=>{
 const t=setup(),normal=t.state.players[0].hand.find(id=>id!=='move'&&!tileById(id).fast),cell=t.land.find(c=>!t.state.board[c.id]).id;
 t.add('a',{type:'place',tile:normal,cell},4);
 const destination=t.land.find(c=>!t.state.board[c.id]).id;
 assert.throws(()=>t.add('a',{type:'move',source:t.source,destination}),/normal tile/);
});
test('historical protocol-4 Move followed by a normal tile stays replayable',()=>{
 const t=setup(),destination=t.land.find(c=>!t.state.board[c.id]).id;
 t.add('a',{type:'move',source:t.source,destination},4);assert.equal(t.state.normalUsed,false);
 const normal=t.state.players[0].hand.find(id=>!tileById(id).fast),cell=t.land.find(c=>!t.state.board[c.id]).id;
 t.add('a',{type:'place',tile:normal,cell},4);assert.equal(replay(t.events).normalUsed,true);
});
test('the L8BVHN tiebreak counts other categories before total tokens',()=>{
 const s=initial();s.players=[['a',[3,3,2]],['b',[3,1,5]]].map(([id,counts])=>({id,captured:counts.flatMap((n,i)=>Array.from({length:n},(_,k)=>({id:`${id}-${i}-${k}`,type:['sakura','chochin','onigiri'][i]})))}));
 scoreGame(s);assert.deepEqual(s.awards,{chochin:'a',onigiri:'b'});assert.deepEqual(s.winners,['a']);
});
