import {test} from 'node:test';
import assert from 'node:assert/strict';
import {historyEntry} from '../../src/game/history-view.js';
const players=[{id:'alex',name:'Alex'},{id:'bea',name:'Bea & Bo'}];
const art=type=>`<img src="${type}.png">`;
test('turn history renders one image for each claimed token and labels other recipients',()=>{
 const event={label:'Alex finished their turn',actor:'alex',intent:{type:'end'},claims:[
  {playerId:'bea',tokens:[{id:'l',type:'chochin'}]},
  {playerId:'alex',tokens:[{id:'a',type:'sakura'},{id:'b',type:'sakura'},{id:'c',type:'onigiri'}]},
 ]};
 const html=historyEntry(event,players,art);
 assert.equal((html.match(/data-claimed-type="sakura"/g)||[]).length,2);
 assert.equal((html.match(/data-claimed-type="onigiri"/g)||[]).length,1);
 assert.equal((html.match(/data-claimed-type="chochin"/g)||[]).length,1);
 assert.match(html,/aria-label="Alex claimed 2 sakura, 1 onigiri"/);
 assert.match(html,/Bea &amp; Bo claimed/);
 assert.ok(html.indexOf('sakura.png')<html.indexOf('chochin.png'));
});
test('empty claims and older entries keep their original text, safely escaped',()=>{
 for(const claims of [undefined,[]])assert.equal(historyEntry({label:'A & B finished their turn',actor:'alex',intent:{type:'end'},claims},players,art),'A &amp; B finished their turn');
});
