import {painting} from './art.js';
export function boardArt(mode='nihon'){return `<div class="painted-board">${painting(mode,`${mode==='nihon'?'Nihon':'Tokyo'} Japanese watercolor board`)}</div>`;}
