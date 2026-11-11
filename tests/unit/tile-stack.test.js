import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stackLayers} from '../../src/game/tile-stack.js';
test('Cover inspection exposes the top tile and its preserved underlying Move',()=>{
 const move={tile:'move',owner:'computer',direction:0},cover={tile:'cover',owner:'computer',covered:move};
 assert.deepEqual(stackLayers(cover),[cover,move]);assert.equal(stackLayers(cover)[1],move);
 assert.deepEqual(stackLayers(null),[]);
});
test('stack order and face-down state survive nested covers without changing the pieces',()=>{
 const bottom={tile:'boat-2',owner:'a',facedown:true},middle={tile:'cover',owner:'a',covered:bottom},top={tile:'cover',owner:'a',covered:middle};
 const before=structuredClone(top);assert.deepEqual(stackLayers(top).map(p=>p.tile),['cover','cover','boat-2']);assert.equal(stackLayers(top)[2].facedown,true);assert.deepEqual(top,before);
});
