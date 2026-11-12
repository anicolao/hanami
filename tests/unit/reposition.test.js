import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initial,applyChoice,cells,canReposition,replay,VERSION,undoTarget,tileById} from '../../src/game/engine.js';
import {neighbors} from '../../src/game/maps.js';
function fixture(){let s=initial();for(const [actor,intent]of [['a',{type:'create',name:'A'}],['b',{type:'join',name:'B'}],['a',{type:'start',seed:'correction'}]])s=applyChoice(s,actor,intent);s.players[0].hand=['sakura-2','draw','cover','move','copy','boat-2'];return s;}
const play=(s,intent)=>applyChoice(s,'a',{...intent,playerId:'a'});
test('a correction preserves hand, normal-placement usage and turn; old and other-player pieces stay fixed',()=>{
 let s=fixture();const land=cells(s).filter(c=>c.kind==='land'),[a,b,c]=land;
 s=play(s,{type:'place',tile:'sakura-2',cell:a.id});const hand=[...s.players[0].hand];
 s=play(s,{type:'reposition',source:a.id,destination:b.id});assert.equal(s.board[a.id],undefined);assert.equal(s.board[b.id].tile,'sakura-2');assert.deepEqual(s.players[0].hand,hand);assert.equal(s.placed,1);assert.equal(s.normalUsed,true);assert.equal(s.turnNumber,1);
 s=play(s,{type:'reposition',source:b.id,destination:c.id});assert.equal(s.placed,1);
 assert.throws(()=>applyChoice(s,'b',{type:'reposition',source:c.id,destination:a.id,playerId:'b'}));
 s=play(s,{type:'end'});assert.equal(canReposition(s,'a',c.id),false);
 assert.throws(()=>play(s,{type:'reposition',source:c.id,destination:a.id}));
});
test('Draw correction never draws again; terrain and occupied destinations remain enforced',()=>{
 let s=fixture();const land=cells(s).filter(c=>c.kind==='land'),water=cells(s).find(c=>c.kind==='water');
 s=play(s,{type:'place',tile:'draw',cell:land[0].id});const hand=[...s.players[0].hand],deck=[...s.players[0].deck];
 s=play(s,{type:'reposition',source:land[0].id,destination:land[1].id});assert.deepEqual(s.players[0].hand,hand);assert.deepEqual(s.players[0].deck,deck);assert.equal(s.placed,1);
 assert.throws(()=>play(s,{type:'reposition',source:land[1].id,destination:water.id}));
 s=play(s,{type:'place',tile:'sakura-2',cell:land[2].id});assert.throws(()=>play(s,{type:'reposition',source:land[1].id,destination:land[2].id}));
 s=play(s,{type:'place',tile:'boat-2',cell:water.id});assert.throws(()=>play(s,{type:'reposition',source:water.id,destination:land[3].id}));
});
test('Cover correction restores its old stack and covers an owned destination; moved tiles can be corrected while Move stays anchored',()=>{
 let s=fixture();const land=cells(s).filter(c=>c.kind==='land'),[a,b,c]=land;
 s.board[a.id]={tile:'sakura-3',cell:a.id,owner:'a'};s.board[b.id]={tile:'onigiri-3',cell:b.id,owner:'a'};
 s=play(s,{type:'place',tile:'cover',cell:a.id});s=play(s,{type:'reposition',source:a.id,destination:b.id});assert.equal(s.board[a.id].tile,'sakura-3');assert.equal(s.board[b.id].covered.tile,'onigiri-3');assert.equal(s.placed,1);
 assert.throws(()=>play(s,{type:'reposition',source:b.id,destination:c.id}));
 s=fixture();s.board[a.id]={tile:'copy',cell:a.id,owner:'a',direction:1};s=play(s,{type:'move',source:a.id,destination:b.id});
 assert.equal(canReposition(s,'a',a.id),false);assert.equal(canReposition(s,'a',b.id),true);
 s=play(s,{type:'reposition',source:b.id,destination:c.id,direction:4});assert.equal(s.board[c.id].direction,4);assert.equal(s.board[a.id].tile,'move');assert.equal(s.placed,1);
});
test('Bicycle corrections stay adjacent to the original cell',()=>{
 let s=fixture();s.players[0].ability='bicycle';const land=cells(s).filter(c=>c.kind==='land');const a=land.find(a=>land.filter(b=>neighbors(a,b)).length>=2),adj=land.filter(b=>neighbors(a,b)),far=land.find(b=>b.id!==a.id&&!neighbors(a,b));
 s.board[a.id]={tile:'sakura-3',cell:a.id,owner:'a'};s=play(s,{type:'ability',a:a.id,b:adj[0].id});
 s=play(s,{type:'reposition',source:adj[0].id,destination:adj[1].id});assert.equal(s.players[0].usedAbility,true);assert.throws(()=>play(s,{type:'reposition',source:adj[1].id,destination:far.id}));
});
test('corrections replay and undo independently, including a protocol-3 table continued with protocol 4',()=>{
 const events=[];const add=(actor,intent,version=VERSION)=>{const event={actor,intent,version,id:`e${events.length}`,sequence:events.length+1};const s=replay([...events,event]);events.push(event);return s;};
 add('a',{type:'create',name:'A'},3);add('b',{type:'join',name:'B'},3);let s=add('a',{type:'start',seed:'correction'},3);
 const tile=s.players[0].hand.find(id=>!tileById(id).fast&&id!=='copy'),land=cells(s).filter(c=>c.kind==='land');
 s=add('a',{type:'place',playerId:'a',tile,cell:land[0].id,...(tile==='copy'?{direction:0}:{})});
 s=add('a',{type:'reposition',playerId:'a',source:land[0].id,destination:land[1].id});assert.deepEqual(replay(events),s);
 const undo=undoTarget(s,'a','a');assert.equal(undo.consent,false);s=add('a',{type:'undo',target:undo.id});assert.equal(s.board[land[0].id].tile,tile);assert.equal(s.board[land[1].id],undefined);assert.equal(s.normalUsed,true);
});
