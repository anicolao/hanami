import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initial,applyChoice,currentPlayer,replay,VERSION} from '../../src/game/engine.js';
import {computerObservation} from '../../src/game/computer.js';
import {choosePracticeIntent} from '../../src/game/difficulty.js';
import {multiplayerFeatures} from '../../src/game/multiplayer-policy.js';
function gathering(mode='web',count=4){
 let s=applyChoice(initial(),'host',{type:'create',name:'Alex',mode,capacity:count,edge:mode==='tabletop'?'south-west':'south'});
 s=applyChoice(s,'host',{type:'add-computer',difficulty:'medium',...(mode==='tabletop'?{edge:'north-east',color:3}:{})});
 return s;
}
test('each computer level is a host-authored gathering choice, including physical tabletop seats',()=>{
 for(const mode of ['web','tabletop']){
  const s=gathering(mode),id=s.players[1].id;
  assert.equal(s.players[1].controller,'host');assert.equal(s.players[1].difficulty,'medium');
  if(mode==='tabletop'){assert.equal(s.players[1].edge,'north-east');assert.equal(s.players[1].color,3);assert.equal(s.players[1].name,'Pine');}
  const changed=applyChoice(s,'host',{type:'computer-level',playerId:id,difficulty:'hard'});
  assert.equal(changed.players[1].difficulty,'hard');assert.equal(s.players[1].difficulty,'medium');
  assert.throws(()=>applyChoice(s,'guest',{type:'computer-level',playerId:id,difficulty:'hard'}));
  assert.throws(()=>applyChoice(s,'host',{type:'computer-level',playerId:s.players[0].id,difficulty:'hard'}));
  assert.throws(()=>applyChoice(s,'host',{type:'computer-level',playerId:id,difficulty:'bogus'}));
  const playing=applyChoice(changed,'host',{type:'start',seed:'levels'});
  assert.throws(()=>applyChoice(playing,'host',{type:'computer-level',playerId:id,difficulty:'easy'}));
  if(mode==='tabletop'){
   assert.throws(()=>applyChoice(s,'host',{type:'add-computer',edge:'north',color:1}),/seat/);
   assert.throws(()=>applyChoice(s,'host',{type:'add-computer',edge:'south-east',color:3}),/color/);
  }
 }
});
test('three and four player level choices finish real basic and special event histories',()=>{
 for(const count of [3,4])for(const specials of [false,true]){
  const events=[];let s=initial();
  const add=intent=>{events.push({version:VERSION,sequence:events.length+1,id:`choice-${events.length}`,actor:'host',intent});s=applyChoice(s,'host',intent);};
  add({type:'create',name:'Alex',mode:count===3?'tabletop':'web',capacity:count,map:count===3?'nihon':'tokyo',specials});
  for(let i=1;i<count;i++)add({type:'add-computer',difficulty:['medium','hard','easy'][i-1]});
  add({type:'start',seed:`multiplayer:${count}:${specials}`});
  let choices=0;
  while(s.phase!=='finished'&&choices++<384){
   const p=s.phase==='choosing'?s.players.find(p=>!p.ability):currentPlayer(s),view=computerObservation(s,p.id);
   view.players.find(other=>other.id===p.id).computer=true;
   const intent=choosePracticeIntent(view,p.id,p.difficulty||'easy');assert.ok(intent);add(intent);
  }
  assert.equal(s.phase,'finished',`count=${count}, specials=${specials}`);assert.ok(s.winners.length);
  assert.deepEqual(replay(events).board,s.board);assert.deepEqual(replay(events).winners,s.winners);
 }
});
test('multiplayer learned inputs and decisions are independent of private opponent captures and hands',()=>{
 let s=gathering();s=applyChoice(s,'host',{type:'add-computer',difficulty:'hard'});s=applyChoice(s,'host',{type:'start',seed:'private-multiplayer'});s.turn=1;
 const id=s.players[1].id,first=computerObservation(s,id),values=multiplayerFeatures(first,id);
 assert.equal(values.features.length,49);assert.equal(values.extended.length,93);assert.ok(values.extended.every(Number.isFinite));
 const before=Object.fromEntries(['medium','hard'].map(level=>[level,choosePracticeIntent(first,id,level)]));
 s.players.filter(p=>p.id!==id).forEach(p=>{p.hand=['copy'];p.captured=[{id:'hidden',type:'sakura'}];});
 s.players.forEach(p=>p.deck.reverse());
 for(const level of ['medium','hard'])assert.deepEqual(choosePracticeIntent(computerObservation(s,id),id,level),before[level]);
});
