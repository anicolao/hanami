// Only normalize export dimensions. Organic coastlines are never masked or warped.
import {BOARD_GEOMETRY} from '../src/game/board-geometry.js';
import raster from './raster-utils.cjs';
for(const map of ['nihon','tokyo']){
 const geometry=BOARD_GEOMETRY[map];
 raster.write(`public/assets/boards/${map}-organic.png`,raster.resize(raster.read(`art/boards/clean/${map}.png`),geometry.imageWidth,geometry.imageHeight));
}
