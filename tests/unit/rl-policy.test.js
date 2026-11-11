import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initial,applyChoice} from '../../src/game/engine.js';
import {computerObservation} from '../../src/game/computer.js';
import {chooseRlIntent,initialModel,decisionOptions,featureNames} from '../../src/game/rl-policy.js';
import {fixtures,summarize} from '../../scripts/rl/pool.mjs';
import {playGame} from '../../scripts/rl/environment.mjs';
function game(){let s=applyChoice(initial(),'host',{type:'create',name:'Player',capacity:2,computer:true,map:'nihon',specials:false});return applyChoice(s,'host',{type:'start',seed:'rl-unit'});}
test('RL choices cannot depend on redacted opponent hands, captures, decks or seed',()=>{
 const s=game(),id=s.players[0].id,model=initialModel();
 const before=chooseRlIntent(computerObservation(s,id),id,model);
 s.players[1].hand=['copy'];s.players[1].captured=[{id:'hidden',type:'sakura'}];s.players.forEach(p=>p.deck.reverse());s.seed='hidden';
 assert.deepEqual(chooseRlIntent(computerObservation(s,id),id,model),before);
 assert.doesNotThrow(()=>applyChoice(s,'host',before.intent));
});
test('RL options use production legal actions and sampling emits finite policy gradients',()=>{
 const s=game(),id=s.players[0].id,view=computerObservation(s,id);
 const options=decisionOptions(view,id);assert.ok(options.length>1);
 for(const option of options)assert.doesNotThrow(()=>applyChoice(s,'host',option.intent));
 const choice=chooseRlIntent(view,id,initialModel(),{sample:true,record:true,random:()=>.5});
 assert.equal(choice.gradient.length,featureNames.length);assert.ok(choice.gradient.every(Number.isFinite));assert.ok(choice.entropy>0);
 assert.doesNotThrow(()=>applyChoice(s,'host',choice.intent));
});
test('evaluation balances all eight settings and counts draws and unfinished games as non-wins',()=>{
 const games=fixtures('test',16);assert.equal(new Set(games.map(g=>`${g.map}/${g.specials}/${g.seat}`)).size,8);
 assert.equal(games[0].seed,games[1].seed);
 const rows=games.map((g,i)=>({...g,win:i<8,draw:i===8,truncated:i===9,turns:1}));
 const metrics=summarize(rows);assert.equal(metrics.winRate,.5);assert.equal(metrics.wins,8);assert.equal(metrics.losses,6);assert.equal(metrics.draws,1);assert.equal(metrics.truncated,1);
 assert.throws(()=>fixtures('bad',7));
});
test('RL match results replay through production events without injected state or winners',()=>{
 const result=playGame({seed:'rl-event-audit',model:initialModel(),verifyReplay:true,keepEvents:true});
 assert.ok(result.events.length>10);assert.ok(result.events.every(e=>e.intent.type&&!('board' in e.intent)&&!('winners' in e.intent)));
 assert.equal(result.reward,result.win?1:result.draw?0:-1);
});
