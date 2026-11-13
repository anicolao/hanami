import './routes.css';
import {readVisualSettings,previewVisualSettings,resetVisualPreviews,clearLegacyLabPreferences,VISUAL_DEFAULTS,VISUAL_PREVIEW_EVENT} from '../components/visual-settings.js';
import {viewports,routePath} from './route-presets.js';
import {prepareRouteScene,canPrepareLocalGame} from './route-scene.js';
const root=document.querySelector('#app'),base=import.meta.env.BASE_URL,params=new URLSearchParams(location.search);
clearLegacyLabPreferences();
const value=(key,fallback)=>params.get(key)||fallback;
let profile=viewports.find(p=>p.id===value('viewport','ipad-air-landscape'))||viewports[0];
const config={viewport:profile.id,route:value('route','web')==='tabletop'?'tabletop':'web',map:value('map','nihon')==='tokyo'?'tokyo':'nihon',players:[2,3,4].includes(Number(value('players',2)))?Number(value('players',2)):2,scene:['opening','midgame','gathering','powers'].includes(value('scene','midgame'))?value('scene','midgame'):'midgame'};
let width=profile.width,height=profile.height,zoom=params.get('focus')==='1'||profile.id.startsWith('phone')?'100':'fit',game=null,preparing=false,inspectStop=()=>{};
const options=(rows,current)=>rows.map(([id,name])=>`<option value="${id}" ${String(id)===String(current)?'selected':''}>${name}</option>`).join('');
root.className=`route-lab${params.get('focus')==='1'?' is-focused':''}`;document.title='Real route layouts · Hanami animation lab';
root.innerHTML=`<header class="route-header"><a href="${base}">hanami <span>花見</span></a><h1>Animation lab · route layouts</h1><a href="${base}dev/animations/?view=components&scenario=place" target="_blank" rel="noopener">Isolated motion fixtures ↗</a></header>
<div class="route-workbench"><aside aria-label="Route preview controls"><h2>Viewport</h2><label>Preset<select id="viewport">${options(viewports.map(p=>[p.id,p.name]),config.viewport)}</select></label><div class="route-dimensions"><label>Width<input id="viewport-width" type="number" min="320" max="3000" value="${width}"></label><label>Height<input id="viewport-height" type="number" min="320" max="2000" value="${height}"></label></div><div class="route-zoom"><button data-zoom="fit" aria-pressed="true">Fit preview</button><button data-zoom="100" aria-pressed="false">100%</button><button id="focus-route">Focus route</button></div><p class="route-note">Sizes are CSS pixels. Fit scales the surrounding preview; the route keeps its selected viewport.</p>
<h2>Pieces</h2><label>Tile scale (%)<input id="piece-scale" type="number" min="70" max="140" step="1"></label><button id="reviewed-piece-scale">Reviewed size · 90%</button><p class="route-note">Live preview only. Reload restores game settings; nothing is saved.</p><h2>Real game</h2><label>Route<select id="route">${options([['web','Personal game · /'],['tabletop','Shared table · /tabletop/']],config.route)}</select></label><label>Board<select id="map">${options([['nihon','Nihon'],['tokyo','Tokyo']],config.map)}</select></label><label>Players<select id="players">${options([2,3,4].map(n=>[n,n]),config.players)}</select></label><label>Starting point<select id="scene">${options([['opening','Opening hand'],['midgame','Three rounds played'],['gathering','Before dealing'],['powers','Power selection']],config.scene)}</select></label><button id="prepare" ${canPrepareLocalGame?'':'disabled'}>New local game</button><p class="route-note">${canPrepareLocalGame?'Real Firestore emulator events. Play directly inside the preview.':'Start the emulator dev server to prepare local games.'}</p><a id="open-route" target="_blank" rel="noopener">Open this real route ↗</a><p class="route-note">The frame loads the production entry point, CSS, components and animations. Layout edits belong in the game renderer.</p></aside>
<main class="route-stage-area"><div class="route-toolbar"><strong id="route-title"></strong><span id="route-status" role="status">Preparing local game…</span></div><div class="route-stage"><div class="route-frame-size"><p id="route-message" role="status">Preparing a local game…</p><iframe id="route-preview" title="Production route preview"></iframe></div><div class="route-focus-exit"><button id="exit-focus">Return to lab controls</button><span>Escape also returns to the controls.</span></div></div><output id="route-metrics" aria-live="polite"></output></main></div>`;
const $=s=>root.querySelector(s),frame=$('#route-preview'),stage=$('.route-stage'),box=$('.route-frame-size');
function refreshPieceScale(){$('#piece-scale').value=readVisualSettings(config.map).tile;}
function setPieceScale(value){const settings=readVisualSettings(config.map);previewVisualSettings(config.map,{...settings,tile:Math.max(70,Math.min(140,Number(value)||VISUAL_DEFAULTS.tile))});refreshPieceScale();}
window.addEventListener(VISUAL_PREVIEW_EVENT,refreshPieceScale);

function fit(){
 const scale=zoom==='100'?1:Math.max(.05,Math.min(1,(stage.clientWidth-48)/width,(stage.clientHeight-48)/height));
 box.style.width=`${width*scale}px`;box.style.height=`${height*scale}px`;
 Object.assign(frame.style,{width:`${width}px`,height:`${height}px`,transform:scale===1?'none':`scale(${scale})`});
 $('#route-title').textContent=`${width} × ${height} · ${config.route==='web'?'/':'/tabletop/'} · ${Math.round(scale*100)}%`;
 root.querySelectorAll('[data-zoom]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.zoom===zoom)));
}
function metrics(){
 try{const win=frame.contentWindow,doc=win.document,main=doc.querySelector('main.play-app');if(!main)return;
  const board=doc.querySelector('.board-surface')?.getBoundingClientRect();
  $('#route-metrics').textContent=`Actual viewport ${win.innerWidth} × ${win.innerHeight} · page ${doc.documentElement.scrollWidth} × ${doc.documentElement.scrollHeight}${board?` · board ${Math.round(board.width)} × ${Math.round(board.height)}`:''} · ${main.dataset.phase} · ${main.dataset.status}`;
  frame.dataset.phase=main.dataset.phase;frame.dataset.status=main.dataset.status;
 }catch{}
}
function navigate(){
 inspectStop();const path=routePath(config.route,base),url=`${path}${game?`?table=${game.code}`:''}`;
 frame.hidden=false;$('#route-message').hidden=true;frame.src=url;$('#open-route').href=url;fit();
 $('#route-status').textContent=game?`${game.code} · local events · ${game.revision} choices`:'Production entry route';
}
frame.addEventListener('load',()=>{
 inspectStop();let scheduled=false;const refresh=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;metrics();});};
 const win=frame.contentWindow,doc=win.document,key=event=>{if(event.key==='Escape'&&!doc.querySelector('dialog[open]'))exitFocus();},resize=new win.ResizeObserver(refresh),changes=new win.MutationObserver(refresh);
 resize.observe(doc.documentElement);changes.observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-phase','data-status']});
 win.addEventListener('keydown',key);inspectStop=()=>{resize.disconnect();changes.disconnect();win.removeEventListener('keydown',key);};metrics();
});
async function prepare(){
 if(preparing)return;resetVisualPreviews();refreshPieceScale();preparing=true;root.dataset.ready='preparing';$('#prepare').disabled=true;for(const id of ['route','map','players','scene'])$('#'+id).disabled=true;$('#route-status').textContent='Creating a local event stream…';
 frame.hidden=true;frame.removeAttribute('src');$('#route-message').hidden=false;$('#route-message').textContent='Preparing a local game…';inspectStop();
 try{game=await prepareRouteScene({route:config.route,map:config.map,count:config.players,scene:config.scene});navigate();root.dataset.ready='true';}
 catch(error){$('#route-status').textContent=error.message;$('#route-message').textContent=`Could not prepare the local game: ${error.message} Check that the Auth and Firestore emulators are running, then choose New local game to retry.`;root.dataset.ready='error';}
 finally{preparing=false;$('#prepare').disabled=!canPrepareLocalGame;for(const id of ['route','map','players','scene'])$('#'+id).disabled=false;}
}
root.addEventListener('change',event=>{
 const id=event.target.id;
 if(id==='piece-scale'){setPieceScale(event.target.value);return;}
 if(id==='viewport'){profile=viewports.find(p=>p.id===event.target.value);config.viewport=profile.id;if(profile.id.startsWith('phone'))zoom='100';width=profile.width;height=profile.height;$('#viewport-width').value=width;$('#viewport-height').value=height;fit();return;}
 if(id==='viewport-width'||id==='viewport-height'){width=Math.max(320,Math.min(3000,Number($('#viewport-width').value)||1180));height=Math.max(320,Math.min(2000,Number($('#viewport-height').value)||820));$('#viewport-width').value=width;$('#viewport-height').value=height;fit();return;}
 if(['route','map','players','scene'].includes(id)){config[id]=id==='players'?Number(event.target.value):event.target.value;refreshPieceScale();if(canPrepareLocalGame)void prepare();else navigate();}
});
function exitFocus(){root.classList.remove('is-focused');fit();}
window.addEventListener('keydown',event=>{if(event.key==='Escape')exitFocus();});
root.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.dataset.zoom){zoom=button.dataset.zoom;fit();}else if(button.id==='focus-route'){zoom='100';root.classList.add('is-focused');fit();}else if(button.id==='exit-focus')exitFocus();else if(button.id==='reviewed-piece-scale')setPieceScale(VISUAL_DEFAULTS.tile);else if(button.id==='prepare')void prepare();});
new ResizeObserver(fit).observe(stage);refreshPieceScale();fit();if(canPrepareLocalGame)void prepare();else navigate();
