import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initial,applyChoice,cells} from '../../src/game/engine.js';
import {adjacent} from '../../src/game/maps.js';
test('the fourth tied celebration ends the current turn without passing to another player',()=>{
 let state=initial();for(const [actor,intent]of [['a',{type:'create',name:'A'}],['b',{type:'join',name:'B'}],['a',{type:'start',seed:'four-ties'}]])state=applyChoice(state,actor,intent);
 const park=cells(state).find(c=>c.kind==='park'&&c.capacity===1),fourth=state.tokens[park.id][0];
 const tied=Object.values(state.tokens).flat().filter(t=>t.id!==fourth.id).slice(0,3),ids=new Set(tied.map(t=>t.id));state.ties=tied;
 for(const tokens of Object.values(state.tokens))for(let n=tokens.length-1;n>=0;n--)if(ids.has(tokens[n].id))tokens.splice(n,1);
 // Equal wild influence ties this completed park; other token types stay on the map.
 for(const [n,cell]of adjacent(park,cells(state)).filter(c=>c.kind==='land').entries())state.board[cell.id]={tile:'cat-0',cell:cell.id,owner:n%2?'b':'a'};
 state.placed=1;assert.equal(state.phase,'playing');assert.equal(state.ties.length,3);
 const result=applyChoice(state,'a',{type:'end',playerId:'a'});
 assert.equal(result.ties.length,4);assert.equal(result.phase,'finished');assert.equal(result.turn,0);assert.equal(result.turnNumber,1);assert.ok(result.winners.length);
 assert.ok(['sakura','chochin','onigiri'].every(type=>Object.values(result.tokens).flat().some(t=>t.type===type)));
});
