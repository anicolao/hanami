import '../game/play.css';
import './style.css';
import { painting, tileArt, tokenArt } from '../art.js';
import { tiles, players } from '../catalog.js';
import { boardCells, adjacent } from '../game/maps.js';
import { BOARD_GEOMETRY, paintedCell, boardMetrics } from '../game/board-geometry.js';
import { initial, setupTokens } from '../game/engine.js';
import { VISUAL_DEFAULTS, REVIEWED_GRID_FITS, cellLayout, applyVisualSettings, saveVisualSettings } from '../components/visual-settings.js';
import { boardGrid } from '../game/board-grid.js';
import { boardSurfaceArt, boardCellArt } from '../game/board-view.js';
import { installComponentDrag } from '../components/drag.js';
import { MotionTimeline, elementPose, playComponentFlights, moveLiftFlights } from '../components/motion.js';

const scenarios = {
  place: ['Place a tile', 'Select a tile, then tap a highlighted hex. You can also drag it from your hand.'],
  move: ['Move a tile', 'Place Move on an occupied hex. Its tile returns to your holding spot; then tap or drag it to empty land.'],
  cover: ['Cover a tile', 'Drop Cover onto a placed tile. Review the overlap and the landing motion.'],
  copy: ['Point a Copy tile', 'Choose a direction, then place Copy beside a tile. Inspect its arrow at board size.'],
  capture: ['Capture celebrations', 'Tap a park to gather its tokens, or preview a three-token capture.'],
  deal: ['Draw & refill', 'Tap the illustrated bag to deal three tiles into the hand.'],
  flip: ['Flip a boat', 'Tap a placed boat to turn it face down.'],
};
const defaults = {
  ...VISUAL_DEFAULTS, map: 'nihon', boardArt: 'clean', players: 4, scenario: 'place', surface: 'desktop', edge: 'south', owner: 0,
  zoom:100, cell:boardMetrics('nihon').cellWidth, aspect:boardMetrics('nihon').cellAspect,
  gridVersion:2,overlay:false,hidePieces:false,labels:false,direction:0,
};
const numeric = { players:[2,4], owner:[0,3], zoom:[25,220], speed:[.25,2], duration:[150,1800], arc:[0,180], cell:[3,5.5], tile:[70,140], aspect:[.75,1.4], offsetX:[-20,20], offsetY:[-20,20], token:[60,160], direction:[0,5], gridScaleX:[50,150], gridScaleY:[50,150], gridX:[-100,100], gridY:[-100,100], gridLine:[.2,3], gridHaloSize:[0,4], gridOpacity:[0,100] };
let saved = {};
try { saved = JSON.parse(localStorage.getItem('hanami:animation-lab:v1') || '{}'); } catch {}
const config = { ...defaults, ...saved };
const params = new URLSearchParams(location.search);
for (const key of Object.keys(defaults)) {
  if (params.has(key)) config[key] = params.get(key);
  if (key in numeric) config[key] = Math.max(numeric[key][0], Math.min(numeric[key][1], (Number.isFinite(Number(config[key])) ? Number(config[key]) : defaults[key])));
  if (typeof defaults[key] === 'boolean') config[key] = config[key] === true || config[key] === 'true';
}
for (const key of ['players','owner','direction']) config[key] = Math.round(config[key]);
for (const [key, allowed] of Object.entries({map:['nihon','tokyo'], scenario:Object.keys(scenarios), surface:['desktop','tabletop','phone'], edge:['south','north','west','east'], gridStyle:['diagnostic','gameplay'], boardArt:['clean','previous']})) if (!allowed.includes(config[key])) config[key] = defaults[key];
for(const key of ['gridBorder','gridHalo'])if(!/^#[0-9a-f]{6}$/i.test(config[key]))config[key]=defaults[key];
const gridKeys=['gridScaleX','gridScaleY','gridX','gridY'];
const reviewedFits=REVIEWED_GRID_FITS;
const canonicalFit=()=>({gridScaleX:100,gridScaleY:100,gridX:0,gridY:0});
const previousFits=Object.fromEntries(['nihon','tokyo'].map(map=>[map,{...canonicalFit(),...reviewedFits[map]}]));
try{const stored=JSON.parse(localStorage.getItem('hanami:lab:grid-fits:v1')||'{}');for(const map of ['nihon','tokyo'])if(stored[map])for(const key of gridKeys){const value=Number(stored[map][key]);if(Number.isFinite(value)&&value>=numeric[key][0]&&value<=numeric[key][1])previousFits[map][key]=value;}}catch{}
const migratingOrganic=(params.get('boardArt')||saved.boardArt)==='fitted';
const fitsByArt={previous:previousFits,clean:structuredClone(previousFits)};
try{const stored=JSON.parse(localStorage.getItem('hanami:lab:art-grid-fits:v1')||'{}');for(const art of ['previous','clean'])for(const map of ['nihon','tokyo'])for(const key of gridKeys){const value=Number(stored[art]?.[map]?.[key]);if(Number.isFinite(value)&&value>=numeric[key][0]&&value<=numeric[key][1])fitsByArt[art][map][key]=value;}}catch{}
let gridFits=fitsByArt[config.boardArt];
if(migratingOrganic||!gridKeys.some(key=>params.has(key)))Object.assign(config,gridFits[config.map]);
if(migratingOrganic)Object.assign(config,{overlay:true,hidePieces:false,gridStyle:'gameplay',gridLine:1,gridHaloSize:0,gridOpacity:20,gridBorder:'#000000',gridCenters:false});
// Upgrade the old default fit, including URLs already open in a browser.
// Deliberately tuned custom sizes/offsets remain untouched.
const currentGrid = boardMetrics(config.map);
const version = params.get('gridVersion') ?? ((params.has('cell') || params.has('aspect')) ? 1 : saved.gridVersion ?? 1);
const oldGrid = Number(version) < 2;
if ((!params.has('cell') && saved.cell === undefined) || (oldGrid && Math.abs(config.cell - 4.15) < .0001)) config.cell = currentGrid.cellWidth;
if ((!params.has('aspect') && saved.aspect === undefined) || (oldGrid && Math.abs(config.aspect - 1.155) < .0001)) config.aspect = currentGrid.cellAspect;
if(params.has('map') && params.get('map')!==saved.map && ['nihon','tokyo'].includes(saved.map)) {
  const previousGrid=boardMetrics(saved.map);
  if(!params.has('cell')&&Math.abs(config.cell-previousGrid.cellWidth)<.001)config.cell=currentGrid.cellWidth;
  if(!params.has('aspect')&&Math.abs(config.aspect-previousGrid.cellAspect)<.001)config.aspect=currentGrid.cellAspect;
}
config.gridVersion = 2;
let state, lastAction, selected = 0, source = null;
let serial = 0;
const root = document.querySelector('#app');
root.className = 'lab-root';
document.title = 'Animation lab · Hanami';
const tile = id => tiles.find(item => item.id === id);
const cells = () => boardCells(config.map, config.players).map(cell => cellLayout(config.map,cell,config));
const byId = id => cells().find(cell => cell.id === id);
const occupied = (id, tileId, owner = config.owner) => ({ cell:id, tile:tileId, owner, direction:config.direction, facedown:false });
const options = (values, current) => values.map(([value,label]) => `<option value="${value}" ${String(value)===String(current)?'selected':''}>${label}</option>`).join('');
const select = (label,key,values) => `<label>${label}<select data-setting="${key}">${options(values,config[key])}</select></label>`;
const range = (label,key,min,max,step=1) => `<label class="lab-range">${label}<output data-output="${key}">${config[key]}</output><input aria-label="${label}" data-setting="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${config[key]}"></label>`;
const gridRange = (label,key,min,max,step) => `<label class="lab-range"><span>${label}</span><input class="lab-grid-number" aria-label="${label} value" data-setting="${key}" type="number" min="${min}" max="${max}" step="${step}" value="${config[key]}"><input aria-label="${label}" data-setting="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${config[key]}"></label>`;
root.innerHTML = `<header class="lab-header"><a href="${import.meta.env.BASE_URL}">hanami <span>花見</span></a><h1>Animation lab</h1><span class="lab-local">Local fixtures · no connection needed</span><nav><a href="${import.meta.env.BASE_URL}gallery/">Gallery</a><button data-action="tools">Hide controls</button></nav></header>
<div class="lab-workbench"><aside class="lab-controls" aria-label="Animation lab controls">
<section><h2>Scene</h2>${select('Scenario','scenario',Object.entries(scenarios).map(([key,value])=>[key,value[0]]))}<p id="scenario-hint"></p><div class="lab-two">${select('Board','map',[['nihon','Nihon'],['tokyo','Tokyo']])}${select('Players','players',[[2,'2'],[3,'3'],[4,'4']])}</div><div class="lab-two">${select('Surface','surface',[['desktop','Desktop'],['tabletop','Shared table'],['phone','Phone']])}${select('Acting edge','edge',[['south','South'],['west','West'],['north','North'],['east','East']])}</div>${select('Artwork','boardArt',[['clean','Original art · grid removed'],['previous','Original art · printed grid']])}${select('Player color','owner',players.map((p,i)=>[i,p.name]))}<label>Selected piece<select id="piece-choice">${options(tiles.map(t=>[t.id,`${t.name}${t.strength?' '+t.strength:''}${t.fast?' · fast':''}`]),'sakura-3')}</select></label><div class="lab-buttons"><button data-action="preview" class="lab-primary">Preview motion</button><button data-action="reset">Reset scene</button></div></section>
<section><h2>Playback</h2><div class="lab-buttons"><button data-action="replay">Replay</button><button data-action="pause">Pause</button><button data-action="step">+100 ms</button><button data-action="undo">Undo motion</button></div><label class="lab-range">Timeline<output id="time-label">0 ms</output><input id="scrub" aria-label="Animation timeline" type="range" min="0" max="1000" value="0"></label>${select('Speed','speed',[[.25,'¼×'],[.5,'½×'],[1,'1×'],[2,'2×']])}${range('Travel time (ms)','duration',150,1800,50)}${range('Lift / arc (px)','arc',0,180,5)}</section>
<section><h2>Board fit</h2><h3>Grid registration</h3>${gridRange('Grid horizontal scale (%)','gridScaleX',50,150,.01)}${gridRange('Grid vertical scale (%)','gridScaleY',50,150,.01)}${gridRange('Grid X offset (image px)','gridX',-100,100,.1)}${gridRange('Grid Y offset (image px)','gridY',-100,100,.1)}<div class="lab-buttons"><button data-action="reset-grid">Reset grid registration</button><button data-action="reviewed-grid">Use artwork grid</button></div><p id="lab-grid-metrics" class="lab-muted"></p><p class="lab-muted">Scale is anchored at the board center. Grid changes move hexes, hit areas and pieces together. Image-pixel offsets stay consistent at every zoom.</p><h3>Grid rendering</h3><button data-action="preferred-grid">Black · 20% · 1 px</button><label class="lab-check"><input data-setting="overlay" type="checkbox" ${config.overlay?'checked':''}> Show grid overlay</label><label class="lab-check"><input data-setting="hidePieces" type="checkbox" ${config.hidePieces?'checked':''}> Hide tiles & celebrations</label><p class="lab-muted lab-grid-key">Borders follow the calculated grid. Center crosses are optional. Includes occupied spaces and spaces unavailable to the selected tile.</p><label class="lab-check"><input data-setting="labels" type="checkbox" ${config.labels?'checked':''}> Show cell coordinates</label>${select('Grid appearance','gridStyle',[['gameplay','Gameplay borders'],['diagnostic','Cyan diagnostic']])}<div class="lab-two"><label>Border color<input type="color" aria-label="Grid border color" data-setting="gridBorder" value="${config.gridBorder}"></label><label>Halo color<input type="color" aria-label="Grid halo color" data-setting="gridHalo" value="${config.gridHalo}"></label></div>${range('Border width (px)','gridLine',.2,3,.1)}${range('Halo width (px)','gridHaloSize',0,4,.1)}${range('Border opacity (%)','gridOpacity',0,100,1)}<label class="lab-check"><input data-setting="gridCenters" type="checkbox" ${config.gridCenters?'checked':''}> Show hex centers</label><p class="lab-muted">Gameplay borders default to black at 20% opacity, 1 px wide, without a halo. Cyan diagnostic uses unbacked hairlines. Halo width is measured on each side of the line.</p><h3>Hex & piece fit</h3><div class="lab-buttons"><button data-action="fit">Fit the hex</button><button data-action="current-fit">Current game fit</button></div>${range('Cell width (%)','cell',3,5.5,.001)}${range('Piece size (%)','tile',70,140,1)}${range('Horizontal offset (%)','offsetX',-20,20,.5)}${range('Vertical offset (%)','offsetY',-20,20,.5)}${range('Celebration size (%)','token',60,160,1)}<div class="lab-buttons"><button data-action="copy-settings">Copy preset</button><button data-action="download">Save preset</button></div><p class="lab-muted">Fit controls are lab overrides. They are saved in this browser and in the URL, ready to carry into the game once approved.</p></section>
</aside><main class="lab-stage-area"><div class="lab-stage-toolbar"><p id="lab-status" role="status">Ready</p><div class="lab-quick"><button data-action="replay">Replay</button><button data-action="pause">Play</button><button data-action="reset">Reset</button></div><label>Zoom <input aria-label="Board zoom" data-setting="zoom" type="range" min="25" max="220" value="${config.zoom}"><output data-output="zoom">${config.zoom}%</output></label><button data-action="direction">Copy ↑ · 0°</button></div><div class="lab-viewport"><div class="lab-scene"><div class="lab-board-scroll"><div class="lab-board board-surface" aria-label="Interactive lab board"></div></div><section class="lab-blanket" aria-label="Player hand"><header><h2 id="hand-title"></h2><span>Tap or drag a piece</span></header><div class="lab-hand-row"><div class="lab-hand"></div><div class="lab-move-holding" aria-label="Tile holding spot"></div></div><footer><button class="lab-bag" data-action="deal" aria-label="Draw tiles from the bag">${tileArt({id:'back'},0,true,'lab-bag')}<span>Draw & refill</span></button><div class="lab-bowl" aria-label="Captured celebrations"><span>Gathered celebrations</span><div class="lab-captures"></div></div></footer></section></div></div><div class="lab-inspector"><span id="lab-inspect">Select a piece and inspect its fit on the board.</span><span id="lab-event">Scene ready</span></div></main></div>`;
const $ = selector => root.querySelector(selector);
const status = message => { $('#lab-status').textContent = message; };
const controls = $('.lab-controls'), sections = controls.querySelectorAll(':scope > section');
controls.insertBefore(sections[2], sections[1]);
const scrubber = $('#scrub').closest('label');
scrubber.classList.add('lab-timeline');
$('.lab-inspector').before(scrubber);

const timeline = new MotionTimeline(root, motion => {
  $('#scrub').value = motion.duration ? motion.time / motion.duration * 1000 : 0;
  $('#time-label').textContent = `${Math.round(motion.time)} / ${Math.round(motion.duration)} ms`;
  root.querySelectorAll('[data-action="pause"]').forEach(button => button.textContent = motion.running ? 'Pause' : 'Play');
  root.classList.toggle('lab-moving', motion.running);
});

function persist() {
  gridFits[config.map]=Object.fromEntries(gridKeys.map(key=>[key,config[key]]));
  localStorage.setItem('hanami:lab:grid-fits:v1',JSON.stringify(fitsByArt.previous));
  localStorage.setItem('hanami:lab:art-grid-fits:v1',JSON.stringify(fitsByArt));
  localStorage.setItem('hanami:animation-lab:v1',JSON.stringify(config));
  saveVisualSettings(config.map,config);
  const url = new URL(location.href);
  for (const [key,value] of Object.entries(config)) url.searchParams.set(key,String(value));
  history.replaceState(null,'',url);
}
function applyFit() {
  applyVisualSettings(root,config);
  for(const cell of cells()){
    const element=elementForCell(cell.id);
    if(element){element.style.left=`${cell.x}%`;element.style.top=`${cell.y}%`;element.style.setProperty('--board-cell-width',`${cell.width}%`);element.style.setProperty('--board-cell-aspect',cell.aspect);}
  }
  const grid=BOARD_GEOMETRY[config.map];
  $('#lab-grid-metrics').textContent=`Spacing in artwork pixels: columns ${(grid.columnStep*config.gridScaleX/100).toFixed(3)} · rows ${(grid.rowStep*config.gridScaleY/100).toFixed(3)}`;
  $('.lab-scene').style.setProperty('--lab-zoom',config.zoom/100);
  $('.lab-scene').dataset.surface = config.surface;
  $('.lab-scene').dataset.edge = config.edge;
  root.classList.toggle('show-grid',config.overlay);
  root.dataset.gridStyle=config.gridStyle;
  root.classList.toggle('show-coordinates',config.labels);
  root.classList.toggle('hide-board-pieces',config.hidePieces);
  root.style.setProperty('--lab-player',players[config.owner].color);
  for (const control of root.querySelectorAll('[data-setting]')) {
    const key=control.dataset.setting;
    if(control.type==='checkbox') control.checked=config[key]; else control.value=config[key];
  }
  for (const output of root.querySelectorAll('[data-output]')) output.textContent = `${config[output.dataset.output]}${output.dataset.output==='zoom'?'%':''}`;
  timeline.speed=config.speed;
  $('[data-action="direction"]').textContent=`Copy ${['↑','↗','↘','↓','↙','↖'][config.direction]} · ${config.direction*60}°`;
  requestAnimationFrame(()=>{drawGridOverlay();timeline.relayout();});
}
// Trace the rendered hit targets, rather than fitting a second grid to the art.
// This makes the overlay a faithful diagnostic of the positions used by play.
function drawGridOverlay() {
  const svg=$('.board-grid-overlay');
  if(svg)svg.outerHTML=boardGrid(config.map,config.players,config).replace('class="board-grid-overlay"','class="board-grid-overlay lab-grid-overlay"');
}
function fixture() {
  const s=initial();s.map=config.map;s.players=Array.from({length:config.players},(_,i)=>({id:`lab-${i}`}));setupTokens(s,`lab:${config.map}:${config.players}`);
  state={board:{},tokens:s.tokens,hand:['sakura-3','chochin-2','cat-1','boat-2','copy'],captured:[]};
  const land=cells().filter(c=>c.kind==='land'), water=cells().filter(c=>c.kind==='water');
  const center=land.toSorted((a,b)=>Math.abs(a.x-50)-Math.abs(b.x-50))[0];
  const add=(c,id,owner=config.owner)=>{if(c)state.board[c.id]=occupied(c.id,id,owner)};
  if(['move','cover','copy'].includes(config.scenario)) {
    add(center,'sakura-3');add(adjacent(center,land)[0],'chochin-2',(config.owner+1)%config.players);
    state.hand[0]=config.scenario==='move'?'move':config.scenario==='cover'?'cover':'copy';
  }
  if(config.scenario==='capture') {
    const park=cells().find(c=>c.kind==='park'&&c.capacity===3)||cells().find(c=>c.kind==='park');
    adjacent(park,land).forEach((c,i)=>add(c,['sakura-4','cat-3','chochin-4','onigiri-4'][i%4],i%config.players));
  }
  if(config.scenario==='flip') {add(water[Math.floor(water.length/2)],'boat-2');add(water[Math.floor(water.length/2)+1],'boat-3',1);}
  if(config.scenario==='deal') state.hand=['sakura-3','boat-1'];
  selected=0;source=null;lastAction=null;
}
function tokenButton(token,group) {return `<button class="celebration-piece" data-lab-token="${token.id}" aria-label="${token.type} celebration">${tokenArt(token.type,false,`lab-${group}`)}</button>`;}
function canTarget(cell) {
  const piece=state.board[cell.id], hand=tile(state.hand[selected]);
  if(config.scenario==='capture') return cell.kind==='park'&&state.tokens[cell.id]?.length;
  if(config.scenario==='flip') return !!piece&&!piece.facedown&&tile(piece.tile).type==='boat';
  if(config.scenario==='move') return state.moveHolding ? cell.kind==='land'&&!piece : !!piece&&state.hand.includes('move');
  if(!hand) return false;
  if(hand.type==='cover') return !!piece;
  return !piece&&cell.kind===(hand.type==='boat'?'water':'land');
}
function render() {
  $('#scenario-hint').textContent=scenarios[config.scenario][1];
  $('.lab-board').innerHTML=boardSurfaceArt({map:config.map,playerCount:config.players,visual:config,rasterGroup:config.boardArt==='previous'?'lab-board-previous':'lab-board',renderCell:c=>{
    const p=state.board[c.id],def=p&&tile(p.tile);
    return boardCellArt(c,{map:config.map,visual:config,piece:p&&{...p,name:def.name,definition:def},tokens:state.tokens[c.id]||[],legal:canTarget(c),ownerName:p?players[p.owner].name:'',playerIndex:p?.owner||0,renderToken:tokenButton});
  }});
  $('.board-grid-overlay').classList.add('lab-grid-overlay');
  for(const c of cells()) {
    const el=$(`.lab-board [data-cell-wrapper="${c.id}"]`);
    el.dataset.coordinate=c.id;
    el.classList.toggle('lab-source',c.id===source);
    if(config.scenario==='capture') el.querySelectorAll('.celebration-piece').forEach(b=>b.dataset.park=c.id);
  }
  $('.lab-hand').innerHTML=state.hand.map((id,i)=>`<button class="lab-hand-piece ${i===selected?'selected':''}" data-hand="${i}" aria-pressed="${i===selected}" aria-label="${tile(id).name}${tile(id).strength?' strength '+tile(id).strength:''}">${tileArt({...tile(id),direction:id==='copy'?config.direction:undefined},config.owner,false,'lab-hand')}</button>`).join('');
  $('.lab-move-holding').innerHTML=state.moveHolding ? `<span>Place this tile</span><button class="lab-hand-piece selected" data-held-move aria-label="Place held ${tile(state.moveHolding.tile).name}">${tileArt({...tile(state.moveHolding.tile),direction:state.moveHolding.tile==='copy'?state.moveHolding.direction:undefined},state.moveHolding.owner,state.moveHolding.facedown,'lab-hand')}</button>` : '';
  $('.lab-captures').innerHTML=state.captured.map(t=>tokenButton(t,'captured')).join('');
  $('#hand-title').textContent=`${players[config.owner].name} · ${config.edge}`;
  $('#piece-choice').value=state.hand[selected]||tiles[0].id;
  applyFit();
}
function reset() {timeline.clear();fixture();render();status('Ready · '+scenarios[config.scenario][0]);$('#lab-event').textContent='Scene reset';}
function elementForCell(id) {return $(`.lab-board [data-cell-wrapper="${id}"]`);}
function pieceRect(element) {return elementPose(element.querySelector('.painted-tile')||element);}
function handElement(index) {return $(`.lab-hand [data-hand="${index}"]`);}
function finishPrevious() {if(timeline.items.length){timeline.seek(1);timeline.clear();}}
function run(action, beforeOverride) {
  finishPrevious();
  const before=structuredClone(beforeOverride||state), flights=[];
  const add=(from,find,extra={})=>flights.push({from,find,...extra});
  let message='';
  if(action.type==='place') {
    const id=state.hand[action.hand],def=tile(id),old=state.board[action.cell];
    const from=pieceRect(handElement(action.hand));
    const underlay=old&&elementForCell(action.cell).querySelector('.painted-tile').cloneNode(true);
    state.board[action.cell]=occupied(action.cell,id);
    state.hand.splice(action.hand,1);selected=0;
    add(from,()=>elementForCell(action.cell),{underlay});
    message=`${def.name}${def.strength?' '+def.strength:''} → ${action.cell}${old?' · covering '+tile(old.tile).name:''}`;
  } else if(action.type==='move-lift') {
    const from=pieceRect(elementForCell(action.from));
    const index=state.hand.indexOf('move'), origin=pieceRect(handElement(index));
    state.moveHolding={...state.board[action.from],from:action.from};
    state.board[action.from]=occupied(action.from,'move');
    state.hand.splice(index,1);
    flights.push(...moveLiftFlights({moveFrom:origin,tileFrom:from,replacement:()=>elementForCell(action.from),holding:()=> $('[data-held-move]')},config));
    source=null;selected=0;
    message=`Move replaces ${tile(state.moveHolding.tile).name} at ${action.from} · choose a destination for the held tile`;
  } else if(action.type==='move-place') {
    const from=pieceRect($('[data-held-move]')),held=state.moveHolding;
    state.board[action.to]={...held,cell:action.to};
    delete state.board[action.to].from;
    delete state.moveHolding;
    add(from,()=>elementForCell(action.to));
    message=`${tile(held.tile).name} from holding spot → ${action.to}`;
  } else if(action.type==='capture') {
    const tokens=state.tokens[action.cell]||[];
    const origins=tokens.map(t=>$(`.lab-board [data-lab-token="${t.id}"]`).getBoundingClientRect());
    state.captured.push(...tokens);state.tokens[action.cell]=[];
    tokens.forEach((t,i)=>add(origins[i],()=> $(`.lab-captures [data-lab-token="${t.id}"]`),{delay:i*130}));
    message=`Gather ${tokens.length} celebrations from ${action.cell}`;
  } else if(action.type==='deal') {
    const from=pieceRect($('.lab-bag')),start=state.hand.length;
    const draw=['cat-0','onigiri-3','draw'].slice(0,Math.max(0,5-state.hand.length));
    if(!draw.length){status('Your hand is full. Place a tile before refilling.');return;}
    const fromArt=$('.lab-bag .painted-tile').outerHTML;state.hand.push(...draw);
    draw.forEach((_,i)=>add(from,()=>handElement(start+i),{delay:i*160,flip:true,fromArt}));
    message=`Refill ${draw.length} tile${draw.length===1?'':'s'} from the bag`;
  } else if(action.type==='flip') {
    const from=pieceRect(elementForCell(action.cell)),fromArt=elementForCell(action.cell).querySelector('.painted-tile').outerHTML;state.board[action.cell].facedown=!state.board[action.cell].facedown;
    add(from,()=>elementForCell(action.cell),{flip:true,arc:0,fromArt});message=`Flip boat at ${action.cell}`;
  }
  lastAction={before,action:structuredClone(action)};
  render();
  playComponentFlights(timeline,flights,config);status(message);$('#lab-event').textContent=message;
}
function cellAction(id, hand=selected, from=source) {
  if(timeline.running) return;
  const c=byId(id);if(!c)return;
  $('#lab-inspect').textContent=`${id} · ${c.kind}${c.capacity?' · '+c.capacity+' tokens':''} · center ${c.x.toFixed(2)}%, ${c.y.toFixed(2)}%`;
  if(config.scenario==='capture') {if(state.tokens[id]?.length)run({type:'capture',cell:id});return;}
  if(config.scenario==='flip') {if(canTarget(c))run({type:'flip',cell:id});return;}
  if(config.scenario==='move') {
    if(!canTarget(c))return;
    if(state.moveHolding)run({type:'move-place',to:id});
    else run({type:'move-lift',from:id});
    return;
  }
  selected=hand;
  if(canTarget(c))run({type:'place',cell:id,hand});
  else status('That piece does not fit this space. Choose a highlighted hex.');
}
function replayLast() {
  if(!lastAction)return preview();
  const last=structuredClone(lastAction);
  timeline.clear();state=structuredClone(last.before);selected=last.action.hand||0;source=null;
  render();return run(last.action,last.before);
}
function preview() {
  finishPrevious();
  if(config.scenario==='move') {
    if(state.moveHolding) {
      const from=state.moveHolding.from;
      const to=cells().find(c=>canTarget(c)&&adjacent(byId(from),cells()).includes(c))||cells().find(canTarget);
      if(to)run({type:'move-place',to:to.id});
    } else if(state.hand.includes('move')) {
      const from=Object.keys(state.board)[0];
      if(from)run({type:'move-lift',from});
    } else return replayLast();
    return;
  }
  if(lastAction&&!['place','copy'].includes(config.scenario))return replayLast();
  if(config.scenario==='deal')return run({type:'deal'});
  const targets=cells().filter(canTarget);
  const target=config.scenario==='capture'?targets.toSorted((a,b)=>(state.tokens[b.id]?.length||0)-(state.tokens[a.id]?.length||0))[0]:targets.toSorted((a,b)=>Math.abs(a.x-50)-Math.abs(b.x-50))[0];
  if(target)cellAction(target.id);else status('Reset this scene to preview it again.');
}
root.addEventListener('click',async event=>{
  const action=event.target.closest('[data-action]')?.dataset.action;
  if(action==='tools'){root.classList.toggle('tools-hidden');event.target.textContent=root.classList.contains('tools-hidden')?'Show controls':'Hide controls';return;}
  if(action==='preview')return preview();
  if(action==='reset')return reset();
  if(action==='replay')return replayLast();
  if(action==='pause'){if(!timeline.items.length)return preview();if(timeline.running)timeline.pause();else{if(timeline.time===timeline.duration)timeline.seek(0);timeline.play(timeline.reverse,timeline.onEnd);}return;}
  if(action==='step'){timeline.seek((timeline.time+100)/(timeline.duration||1));return;}
  if(action==='undo'){if(!lastAction)return;timeline.seek(1);timeline.play(true,()=>{state=structuredClone(lastAction.before);timeline.clear();render();status('Returned to the state before this motion.');});return;}
  if(action==='deal'){if(!timeline.running)run({type:'deal'});return;}
  if(action==='direction'){config.direction=(config.direction+1)%6;persist();finishPrevious();render();return;}
  if(action==='preferred-grid'){Object.assign(config,{overlay:true,gridStyle:'gameplay',gridBorder:'#000000',gridLine:1,gridHaloSize:0,gridOpacity:20,gridCenters:false});applyFit();persist();return;}
  if(action==='reviewed-grid'){Object.assign(config,reviewedFits[config.map]);applyFit();persist();return;}
  if(action==='reset-grid'){Object.assign(config,{gridScaleX:100,gridScaleY:100,gridX:0,gridY:0});applyFit();persist();return;}
  if(action==='fit'||action==='current-fit'){const metrics=boardMetrics(config.map);Object.assign(config,action==='fit'?{cell:metrics.cellWidth,tile:90,aspect:metrics.cellAspect,offsetX:0,offsetY:-1,token:90}:{cell:metrics.cellWidth,tile:112,aspect:1,offsetX:0,offsetY:0,token:100});applyFit();persist();return;}
  if(action==='copy-settings'||action==='download'){
    const text=JSON.stringify({version:1,settings:config,scene:state},null,2);
    if(action==='copy-settings'){try{await navigator.clipboard.writeText(text);status('Preset copied · includes fit settings and scene.');}catch{status('Clipboard unavailable. Use Save preset instead.');}}
    else{const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='hanami-animation-preset.json';link.click();URL.revokeObjectURL(url);status('Preset saved.');}return;
  }
  if(event.target.closest('[data-held-move]')){status('Choose an empty land hex, or drag the held tile there.');return;}
  const hand=event.target.closest('[data-hand]');
  if(hand){if(timeline.running)return;finishPrevious();selected=Number(hand.dataset.hand);source=null;render();status(`${tile(state.hand[selected]).name} selected · tap or drag to a highlighted hex.`);return;}
  const park=event.target.closest('[data-park]');if(park)return cellAction(park.dataset.park);
  const cell=event.target.closest('.lab-board [data-cell]');if(cell)cellAction(cell.dataset.cell);
});
function updateSetting(control) {
  const key=control.dataset.setting;if(!key)return;
  const previousMetrics=boardMetrics(config.map);
  let value=control.type==='checkbox'?control.checked:control.value;
  if(key in numeric){
    if(value===''||!Number.isFinite(Number(value)))return;
    value=Math.max(numeric[key][0],Math.min(numeric[key][1],Number(value)));
  }
  const oldMap=config.map;
  config[key]=value;
  if(key==='boardArt'){gridFits[oldMap]=Object.fromEntries(gridKeys.map(k=>[k,config[k]]));gridFits=fitsByArt[value];Object.assign(config,gridFits[config.map]);}
  if(key==='gridStyle')config.gridCenters=value==='diagnostic';
  if(key==='map'){gridFits[oldMap]=Object.fromEntries(gridKeys.map(k=>[k,config[k]]));Object.assign(config,gridFits[value]);}
  if(key==='map'){const nextMetrics=boardMetrics(config.map);if(Math.abs(config.cell-previousMetrics.cellWidth)<.001)config.cell=nextMetrics.cellWidth;if(Math.abs(config.aspect-previousMetrics.cellAspect)<.001)config.aspect=nextMetrics.cellAspect;}
  if(key==='arc')for(const item of timeline.items)item.arc=config.scenario==='flip'?0:config.arc;
  persist();
  if(['map','boardArt','players','scenario','owner'].includes(key))reset();else applyFit();
}
root.addEventListener('input',event=>{
  if(event.target.id==='scrub'){timeline.seek(Number(event.target.value)/1000);return;}
  // Commit typed numbers on blur/Enter so partial entries are not overwritten.
  if(event.target.type!=='number')updateSetting(event.target);
});
root.addEventListener('change',event=>{if(event.target.type==='number')updateSetting(event.target);});
$('#piece-choice').addEventListener('change',event=>{finishPrevious();state.hand[selected||0]=event.target.value;render();status(tile(event.target.value).effect);});
root.addEventListener('pointerover',event=>{
  const element=event.target.closest('.lab-board [data-cell-wrapper]');
  const cell=element&&byId(element.dataset.cellWrapper);
  if(cell)$('#lab-inspect').textContent=`${cell.id} · ${cell.kind}${cell.capacity?' · '+cell.capacity+' tokens':''} · center ${cell.x.toFixed(2)}%, ${cell.y.toFixed(2)}%`;
});
installComponentDrag(root,{
  sourceSelector:'[data-hand],[data-held-move]',canStart:()=>!timeline.running,
  begin:el=>{if(el.dataset.hand!==undefined)selected=Number(el.dataset.hand);render();},
  drop:(id,el)=>cellAction(id,el.dataset.hand===undefined?selected:Number(el.dataset.hand),source),
  cancel:()=>status('Returned to the hand · drop on a highlighted hex.'),
});
window.addEventListener('resize',()=>requestAnimationFrame(()=>{drawGridOverlay();timeline.relayout();}));
new ResizeObserver(()=>drawGridOverlay()).observe($('.lab-board'));
window.addEventListener('keydown',event=>{if(event.code==='Space'&&!event.target.matches('input,select,button')){event.preventDefault();if(timeline.running)timeline.pause();else if(timeline.items.length)timeline.play(timeline.reverse,timeline.onEnd);else preview();}});
reset();persist();
