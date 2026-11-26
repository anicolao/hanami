import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collectedCelebrationsArt} from '../../src/components/collected-celebrations.js';
const art=type=>`<img src="${type}.png">`;
test('public collection derives total and each type from captured tokens',()=>{
 const player={id:'a',name:'A & B',captured:[{type:'sakura'},{type:'sakura'},{type:'chochin'}]};
 const html=collectedCelebrationsArt(player,art);
 assert.match(html,/A &amp; B’s collected celebrations/);
 assert.match(html,/3 gathered/);
 for(const [type,count] of [['sakura',2],['onigiri',0],['chochin',1]])assert.ok(html.includes(`data-collection-type="${type}" data-count="${count}"`));
 // Undo/replay replaces the collection; the display must not retain old counts.
 player.captured=[];
 const undone=collectedCelebrationsArt(player,art);
 assert.match(undone,/0 gathered/);assert.equal((undone.match(/data-count="0"/g)||[]).length,3);
});
