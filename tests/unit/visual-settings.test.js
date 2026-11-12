import test from 'node:test';
import assert from 'node:assert/strict';
import {visualSettings,readVisualSettings,previewVisualSettings,resetVisualPreviews,clearLegacyLabPreferences,cellLayout} from '../../src/components/visual-settings.js';
import {boardCells} from '../../src/game/maps.js';
test('the reviewed fit is the shared default for both maps',()=>{
 for(const map of ['nihon','tokyo']){
  const settings=visualSettings(map);
  assert.equal(settings.tile,90);assert.equal(settings.token,90);assert.equal(settings.offsetY,-1);
  assert.equal(settings.gridLine,1);assert.equal(settings.gridOpacity,20);assert.equal(settings.gridBorder,'#000000');
 }
});
test('live previews use the shared geometry, remain map-specific and reset to game settings',()=>{
 try{
  previewVisualSettings('nihon',{...visualSettings('nihon'),tile:93,duration:1200,gridX:2.5});
  assert.equal(readVisualSettings('nihon').tile,93);assert.equal(readVisualSettings('nihon').duration,1200);
  assert.equal(readVisualSettings('tokyo').tile,90);assert.equal(readVisualSettings('tokyo').duration,650);
  const cell=boardCells('nihon',4)[0];
  assert.deepEqual(cellLayout('nihon',cell,readVisualSettings('nihon')),cellLayout('nihon',cell,{...visualSettings('nihon'),tile:93,duration:1200,gridX:2.5}));
  resetVisualPreviews();assert.deepEqual(readVisualSettings('nihon'),visualSettings('nihon'));
 }finally{resetVisualPreviews();}
});
test('lab cleanup removes old visual preferences and preserves authentication and pending game actions',()=>{
 const keys=['hanami:component-visuals:v1','hanami:route-lab:v1','hanami:animation-lab:v1','hanami:lab:grid-fits:v1','hanami:lab:art-grid-fits:v1'],data=new Map([...keys.map(key=>[key,'old settings']),['firebase-auth','session'],['hanami:pending:table','action']]);
 clearLegacyLabPreferences({removeItem:key=>data.delete(key)});
 for(const key of keys)assert.equal(data.has(key),false);
 assert.equal(data.get('firebase-auth'),'session');assert.equal(data.get('hanami:pending:table'),'action');
});
