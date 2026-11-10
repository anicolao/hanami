import test from 'node:test';
import assert from 'node:assert/strict';
import {visualSettings,readVisualSettings,saveVisualSettings,cellLayout} from '../../src/components/visual-settings.js';
import {boardCells} from '../../src/game/maps.js';
test('the reviewed fit is the shared default for both maps',()=>{
 for(const map of ['nihon','tokyo']){
  const settings=visualSettings(map);
  assert.equal(settings.tile,90);assert.equal(settings.token,90);assert.equal(settings.offsetY,-1);
  assert.equal(settings.gridLine,1);assert.equal(settings.gridOpacity,20);assert.equal(settings.gridBorder,'#000000');
 }
});
test('saved lab fit and timing are read by game presenters independently for each map',()=>{
 const data=new Map(),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
 saveVisualSettings('nihon',{...visualSettings('nihon'),tile:93,duration:1200,gridX:2.5},storage);
 assert.equal(readVisualSettings('nihon',storage).tile,93);assert.equal(readVisualSettings('nihon',storage).duration,1200);
 assert.equal(readVisualSettings('tokyo',storage).tile,90);assert.equal(readVisualSettings('tokyo',storage).duration,650);
 const cell=boardCells('nihon',4)[0];
 assert.deepEqual(cellLayout('nihon',cell,readVisualSettings('nihon',storage)),cellLayout('nihon',cell,{...visualSettings('nihon'),tile:93,duration:1200,gridX:2.5}));
});
test('a broken local preference cannot prevent a game from loading',()=>{
 assert.deepEqual(readVisualSettings('nihon',{getItem:()=>'{broken'}),visualSettings('nihon'));
});
