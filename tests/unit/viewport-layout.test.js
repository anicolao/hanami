import {test} from 'node:test';
import assert from 'node:assert/strict';
import {viewportLayout} from '../../src/game/viewport-layout.js';
import {BOARD_GEOMETRY} from '../../src/game/board-geometry.js';
for(const [map,art] of Object.entries(BOARD_GEOMETRY)) {
 const choose=(width,height)=>viewportLayout({width,height,aspect:art.imageWidth/art.imageHeight,pieceFraction:.038862});
 test(`${map}: compact phones and ordinary landscape desktops keep the bottom hand`,()=>{
  for(const [w,h] of [[667,375],[568,320],[1024,620],[1440,720],[1440,800],[1920,1080],[1180,820],[1440,900]])assert.equal(choose(w,h).side,false,`${w}×${h}`);
 });
 test(`${map}: a right-hand mat must enlarge the board and nearly fill its height`,()=>{
  for(const [w,h] of [[844,390],[1280,480],[2560,1080]]){
   const result=choose(w,h);assert.equal(result.side,true,`${w}×${h}`);
   assert.ok(result.boardWidth<=w-8);assert.ok(result.boardWidth/(art.imageWidth/art.imageHeight)<=h-8);
   assert.ok(h-8-result.boardWidth/(art.imageWidth/art.imageHeight)<=result.boardWidth*.038862/1.1547005384+6);
  }
 });
 test(`${map}: portrait and spacious landscape keep the existing full-width board`,()=>{
  for(const [w,h] of [[390,844],[1180,820],[1440,900]])assert.equal(choose(w,h).boardWidth,w-8);
 });
}
