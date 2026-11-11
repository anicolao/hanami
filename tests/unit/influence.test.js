import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initial,applyChoice,cells,parkInfluence} from '../../src/game/engine.js';
import {adjacent} from '../../src/game/maps.js';
import {influenceReadings,previewInfluence} from '../../src/game/influence.js';
import {influenceBadge} from '../../src/components/influence-badge.js';
function fixture(){
 let s=initial();
 for(const [actor,intent] of [['a',{type:'create',name:'Alex',map:'tokyo',capacity:2}],['b',{type:'join',name:'Bea'}],['a',{type:'start',seed:'influence'}]])s=applyChoice(s,actor,intent);
 const park=cells(s).find(c=>c.kind==='park'&&adjacent(c,cells(s)).filter(c=>c.kind==='land').length>=3);
 const land=adjacent(park,cells(s)).filter(c=>c.kind==='land');
 s.tokens={[park.id]:['sakura','onigiri','chochin'].map(type=>({id:type,type}))};
 const put=(i,tile,owner='a',extra={})=>s.board[land[i].id]={cell:land[i].id,tile,owner,direction:0,...extra};
 return {s,park,land,put};
}
const totals=s=>Object.fromEntries([...influenceReadings(s)].map(([id,row])=>[id,row.total]));
test('a 2 cat and 3 sakura produce 5 sakura and 2 for each other celebration',()=>{
 const {s,put}=fixture();put(0,'cat-2');put(1,'sakura-3');
 assert.deepEqual(totals(s),{sakura:5,onigiri:2,chochin:2});
 put(2,'cat-5','b');
 assert.deepEqual(totals(s),{sakura:5,onigiri:4,chochin:4});
 assert.deepEqual(influenceReadings(s).get('onigiri').leaders,['b']);
});
test('empty parks show zero, while equal strongest players show a tie',()=>{
 const {s,put}=fixture();assert.equal(influenceReadings(s).get('sakura').status,'none');
 put(0,'cat-2');put(1,'sakura-2','b');
 assert.deepEqual(influenceReadings(s).get('sakura').leaders,['a','b']);
 assert.equal(influenceReadings(s).get('sakura').status,'tie');
});
test('covered and face-down pieces use precisely the scoring totals',()=>{
 const {s,park,put}=fixture();put(0,'cover','a',{covered:{tile:'sakura-4',owner:'a'}});put(1,'cat-5','a',{facedown:true});put(2,'move');
 assert.deepEqual(totals(s),{sakura:3,onigiri:3,chochin:3});
 assert.equal(parkInfluence(s,park,'sakura')[0].total,3);
});
test('hovering a placement previews influence without mutating state or consuming the deck',()=>{
 const {s,land}=fixture();s.players[0].hand=['draw'];s.players[0].deck=['sakura-4'];
 const before=structuredClone(s),result=previewInfluence(s,'a',{tile:'draw'},land[0].id);
 assert.equal(result.preview,true);assert.deepEqual(totals(result.state),{sakura:1,onigiri:1,chochin:1});
 assert.deepEqual(s,before);assert.deepEqual(result.state.players[0].deck,[]);
 assert.equal(previewInfluence(s,'b',{tile:'draw'},land[0].id).preview,false);
 assert.equal(previewInfluence(s,'a',{tile:'draw'},'invalid').state,s);
 assert.equal(previewInfluence(s,'a',{tile:'draw'},null).state,s);
});
test('a held Move tile stops contributing at its source and previews its destination',()=>{
 const {s,land,put}=fixture();put(0,'sakura-3');s.players[0].hand=['move'];
 const selection={tile:'move',source:land[0].id,holding:s.board[land[0].id]};
 assert.equal(totals(previewInfluence(s,'a',selection,null).state).sakura,0);
 const projected=previewInfluence(s,'a',selection,land[1].id);
 assert.equal(projected.preview,true);assert.equal(projected.state.board[land[1].id].tile,'sakura-3');assert.equal(totals(projected.state).sakura,3);
 assert.equal(s.board[land[0].id].tile,'sakura-3');
});
test('Copy rotation previews change the actual influence calculation and badge markup is accessible',()=>{
 const {s,land,put}=fixture();put(0,'sakura-3');s.players[0].hand=['copy'];
 const values=Array.from({length:6},(_,direction)=>totals(previewInfluence(s,'a',{tile:'copy',direction},land[1].id).state).sakura);
 assert.ok(values.includes(6));assert.ok(values.includes(3));
 const row=influenceReadings(s,true).get('sakura'),html=influenceBadge(row,s.players);
 assert.match(html,/Preview · Sakura: Alex leads with 3 influence/);assert.match(html,/data-influence-total="3"/);assert.match(html,/--influence-color:#345c79/);
 assert.doesNotMatch(html,/ hidden /);
 assert.match(influenceBadge({...row,total:0,leaders:[],status:'none'},s.players),/ hidden /);
 assert.equal(influenceBadge(undefined,s.players),'');
});
