import { readVisualSettings, applyVisualSettings, VISUAL_PREVIEW_EVENT } from "../components/visual-settings.js";
import {previewInfluence,influenceReadings} from "./influence.js";
import {influenceBadge,updateInfluenceBadges} from "../components/influence-badge.js";
import {openTileStack} from "../components/tile-stack.js";
import { playerAreaArt } from "../components/player-area.js";
import { GameMotion, captureComponents } from "../components/game-motion.js";
import { installComponentDrag } from "../components/drag.js";
import { boardSurfaceArt, boardCellArt } from "./board-view.js";
import "./play.css";
import { tileArt, tokenArt, painting, asset, copyRotation } from "../art.js";
import { players as finishes } from "../catalog.js";
import {
  initial,
  replay,
  currentPlayer,
  cells,
  tileById,
  abilityById,
  availablePlacement,
  canRotateCopy,
  canReposition,
  undoTarget,
  VERSION,
} from "./engine.js";
import { connect, repository, scope } from "./repository.js";
import { readLaunch, launchChoice } from "./launcher.js";
import {computerObservation} from "./computer.js";
import {historyEntry} from "./history-view.js";
import {choosePracticeIntent,difficultyLevels} from "./difficulty.js";
const $ = (selector) => document.querySelector(selector),
  app = $("#app"),
  base = import.meta.env.BASE_URL;
const tabletop = location.pathname.includes("/tabletop");
const escape = (text) =>
  String(text ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let launch;
try {
  launch = readLaunch(location.search, { tabletop });
} catch (e) {
  launch = { table: "", name: "", mode: null };
}
let state = initial(),
  events = [],
  uid = null,
  db = null,
  repo = null,
  table = launch.table,
  ready = false,
  busy = false,
  error = "",
  selection = null,
  localSeat = null,
  joiningCorner = null,
  joiningComputer = "human",
  pendingTableSeat = null,
  inspectedCell = null,
  revealed = new Set(),
  launchBusy = false;
let name = launch.name || localStorage.getItem("hanami:name") || "",
  joinCode = table,
  formMode = "create",
  practiceDifficulty = "easy";
let influenceHover=null,influenceData=new Map();
let visual = readVisualSettings(state.map);
const motion = new GameMotion(app, () => render());
const finishIndex = p => p.color ?? state.players.indexOf(p);
const finish = p => finishes[finishIndex(p)] || finishes[0];
const controlled = () => state.players.filter((p) => p.controller === uid && !p.computer);
function viewer() {
  return (
    state.players.find((p) => p.id === localSeat && p.controller === uid && !p.computer) ||
    controlled()[0]
  );
}
function playable() {
  return (
    viewer()?.id === currentPlayer(state)?.id &&
    state.phase === "playing" &&
    !state.undoRequest &&
    !busy && !motion.running
  );
}
function updateURL() {
  const u = new URL(location.href);
  u.searchParams.set("table", table);
  history.replaceState(null, "", u);
}
function tableCode() {
  const a = new Uint8Array(4);
  crypto.getRandomValues(a);
  return (
    Array.from(a, (n) => (n % 36).toString(36))
      .join("")
      .toUpperCase() + "HN"
  );
}
function clearSelection() {
  selection = null;
}
async function send(intent, automatic = false) {
  if (busy) return;
  busy = true;
  error = "";
  render();
  try {
    await repo.append(intent);
    // Keep the physical holding spot until the acknowledged event is replayed.
    // The subscription clears selection after capturing its animation origin.
  } catch (e) {
    if (!automatic || e.message !== "The table changed. Choose again.") error = e.message;
  } finally {
    busy = false;
    if(error)motion.cancelDrop();
    if(!motion.running)render();
  }
}
async function subscribe(code) {
  if (repo) repo.close();
  table = code;
  updateURL();
  ready = false;
  render();
  repo = repository(
    db,
    uid,
    code,
    (next) => {
      if(ready && next.length === events.length)return;
      const previous=state;
      const before=ready&&next.length===events.length+1?captureComponents(app,previous):null;
      motion.finish();
      events = next;
      state = replay(events);
      selection=null;
      ready = true;
      render();
      if(before)motion.transition(before,previous,state,events.at(-1),visual);
      else motion.cancelDrop();
      void autoLaunch();
    },
    (e) => {
      motion.cancelDrop();
      error = e.message;
      ready = true;
      render();
    },
  );
}
async function autoLaunch() {
  if (tabletop) {
    if (!pendingTableSeat || launchBusy || busy || !ready) return;
    if (state.phase === "empty" && launch.mode === "join") return;
    const seat = pendingTableSeat;
    pendingTableSeat = null;
    launchBusy = true;
    await send({type: state.phase === "empty" ? "create" : "join", mode:"tabletop", ...seat});
    launchBusy = false;
    return;
  }
  if (!launch.mode || launchBusy || busy || !ready) return;
  let i;
  try {
    i = launchChoice(launch, state, uid);
  } catch (e) {
    error = e.message;
    launch.mode = null;
    render();
    return;
  }
  if (i) {
    if (i.type === "create" && launch.practice) Object.assign(i,{computer:true,capacity:2,difficulty:practiceDifficulty});
    launchBusy = true;
    await send({ ...i, mode: tabletop ? "tabletop" : "web" });
    launchBusy = false;
  }
}
async function initialize() {
  try {
    ({ db, uid } = await connect());
    if (table) await subscribe(table);
    else {
      ready = true;
      render();
    }
  } catch (e) {
    error = `Couldn’t connect to Hanami. ${e.message}`;
    ready = true;
    render();
  }
}
const status = () =>
  error ? "attention" : busy ? "saving" : !ready ? "connecting" : "synced";
function render() {
  motion.finish();
  const projected=previewInfluence(state,viewer()?.id,selection,influenceHover);
  influenceData=influenceReadings(projected.state,projected.preview);
  visual=readVisualSettings(state.map);
  applyVisualSettings(app,visual);
  const v = viewer(),
    turn = currentPlayer(state);
  document.title = `${state.phase === "finished" ? "Victory · " : ""}Hanami${table ? " · " + table : ""}`;
  app.innerHTML = `<main class="play-app ${tabletop ? "tabletop" : "web"}" data-phase="${state.phase}" data-revision="${state.revision}" data-viewer="${escape(v?.name || "Observer")}" data-turn="${escape(turn?.name || "")}" data-scope="${escape(scope)}" data-table="${escape(table)}" data-status="${status()}">
 ${tabletop || ["playing","finished"].includes(state.phase) ? "" : `<header class="play-header"><a class="brand" href="${base}">hanami <span>花見</span></a><span class="table-label">${table ? `Table <b>${table}</b>` : "Find your place under the blossoms"}</span><div class="header-tools"><a href="${base}gallery/">Collection</a><a href="${base}${tabletop ? "" : "tabletop/"}${table ? "?table=" + table : ""}">${tabletop ? "Personal view" : "Tabletop"}</a><span role="status" data-status="${status()}" aria-live="polite">${error ? escape(error) : busy ? "Placing…" : !ready ? "Connecting…" : "Connected"}</span>${error ? '<button data-action="retry">Retry</button>' : ""}</div></header>`}
 ${tabletop ? tabletopSurface(v) : state.phase === "empty" ? entrance() : state.phase === "gathering" ? gathering() : state.phase === "choosing" ? draft() : gameSurface(v)}
 ${launch.returnTo && !["playing","finished"].includes(state.phase) ? `<a class="return-room" href="${escape(launch.returnTo)}">Back to gameroom</a>` : ""}
 </main>`;
  if(inspectedCell){
    const piece=state.board[inspectedCell];
    if(piece)openTileStack(app,piece,{playerIndexFor:id=>finishIndex(state.players.find(p=>p.id===id)),playerNameFor:id=>state.players.find(p=>p.id===id)?.name,edge:tabletop?viewer()?.edge:"south",onClose:()=>{if(!app.querySelector(".tile-stack-inspector[open]"))inspectedCell=null;}});
    else inspectedCell=null;
  }
  motion.restoreDrop();
  syncPlayInformation();
  scheduleComputer();
  if (tabletop && state.phase !== "gathering" && state.phase !== "empty")
    for (const p of controlled()) {
      const field = $(`[data-player="${p.id}"]`);
      if (field) field.classList.toggle("private-open", revealed.has(p.id));
    }
}

// The production viewport alone selects this layout; the lab supplies no flags.
const sideHandQuery=matchMedia('(min-aspect-ratio: 17/10)');
let informationOpen=false;
function syncPlayInformation({focus=false}={}) {
  const main=app.querySelector('main.web'),panel=app.querySelector('#play-information');if(!main||!panel)return;
  const side=sideHandQuery.matches;main.classList.toggle('side-hand',side);main.dataset.layout=side?'side-hand':'board-first';
  if(!side)informationOpen=false;
  main.classList.toggle('information-open',informationOpen);
  panel.inert=side&&!informationOpen;
  if(side){panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Players and game log');panel.setAttribute('aria-hidden',String(!informationOpen));}
  else for(const attr of ['role','aria-modal','aria-label','aria-hidden'])panel.removeAttribute(attr);
  app.querySelector('.play-menu-toggle')?.setAttribute('aria-expanded',String(informationOpen));
  for(const element of main.querySelectorAll('.board-wrap,.play-dock>.player-area,.play-dock>.observer-note'))element.inert=informationOpen;
  if(focus&&informationOpen){const log=panel.querySelector('.event-history');if(log)log.scrollTop=-log.scrollHeight;}
  if(focus)requestAnimationFrame(()=>(informationOpen?panel.querySelector('[data-action="close-info"]'):main.querySelector('.play-menu-toggle'))?.focus({preventScroll:true}));
}
sideHandQuery.addEventListener('change',()=>syncPlayInformation());
app.addEventListener('keydown',event=>{
 if(!informationOpen)return;
 if(event.key==='Escape'){event.preventDefault();informationOpen=false;syncPlayInformation({focus:true});}
 if(event.key==='Tab'){
  const panel=app.querySelector('#play-information'),buttons=[...panel.querySelectorAll('button:not(:disabled),a[href],input,select,[tabindex="0"]')],first=buttons[0],last=buttons.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
 }
});
let computerTimer;
function scheduleComputer() {
  clearTimeout(computerTimer);
  if (!ready || busy || error || motion.running || !repo || repo.hasPending()) return;
  const computer = state.undoRequest
    ? state.players.find(p=>p.computer && state.undoRequest.required.includes(p.id) && !state.undoRequest.approved.includes(p.id))
    : state.phase === 'choosing' ? state.players.find(p=>p.computer && !p.ability) : currentPlayer(state);
  if (!computer?.computer || computer.controller !== uid) return;
  const revision=state.revision, playerId=computer.id;
  // Give the previous physical component time to settle, then make one choice.
  computerTimer=setTimeout(async()=>{
    const act=async()=>{
      if(state.revision!==revision || busy || motion.running || error || repo.hasPending())return;
      const intent=choosePracticeIntent(computerObservation(state,playerId),playerId,computer.difficulty||"easy");
      if(intent)await send(intent,true);
    };
    // Multiple host tabs share one driver; Firestore still validates revisions.
    if(navigator.locks)await navigator.locks.request(`hanami-computer:${scope}:${table}`,{ifAvailable:true},lock=>lock?act():undefined);
    else await act();
  },450);
}
const tableCorners = [
  {id:'north-west', label:'North-west'}, {id:'north-east', label:'North-east'},
  {id:'south-west', label:'South-west'}, {id:'south-east', label:'South-east'},
];
const physicalCorner = p => ({south:'south-west',north:'north-east',west:'north-west',east:'south-east'}[p.edge] || p.edge);
function computerLevelControl(p) {
 const level=p.difficulty||'easy';
 return state.host===uid?`<label class="computer-level-setting">Level<select data-computer-level="${p.id}" aria-label="${escape(p.name)} level" ${busy?'disabled':''}>${difficultyLevels.map(value=>`<option value="${value}" ${value===level?'selected':''}>${value[0].toUpperCase()+value.slice(1)}</option>`).join('')}</select></label>`:`<small>${level[0].toUpperCase()+level.slice(1)} computer</small>`;
}
function tableSeat(corner) {
  const p = state.players.find(p => physicalCorner(p) === corner.id);
  const gathering = ['empty','gathering'].includes(state.phase);
  let content;
  if (p && state.phase === 'choosing') {
    content = `<section class="table-seat-draft" data-player="${p.id}" style="--player:${finish(p).color}"><h2>${finish(p).name} ${finish(p).mark}</h2>${p.ability ? '<p>Ready</p>' : p.controller === uid && !p.computer ? `<p>Choose your ability</p><div class="draft-cards">${p.abilityOptions.map(id=>{const a=abilityById(id);return `<button data-draft="${id}" aria-label="${finish(p).name}: choose ${a.name}">${painting(a.type,a.name)}<strong>${a.name}</strong><small>${a.effect}</small></button>`;}).join('')}</div>` : '<p>Choosing an ability…</p>'}</section>`;
  } else if (p && !gathering) content = playerArea(p, p.controller === uid && !p.computer && revealed.has(p.id));
  else if (p) content = `<div class="table-seat-joined" data-player="${p.id}" style="--player:${finish(p).color}"><span class="seat-color-mark">${finish(p).mark}</span><strong>${finish(p).name}</strong>${p.computer?computerLevelControl(p):'<span>Ready</span>'}</div>`;
  else if (gathering && joiningCorner === corner.id) content = `<div class="seat-color-picker" aria-label="${corner.label} colors"><p>Choose your color</p>${state.host===uid&&state.phase==='gathering'?`<label>Seat type<select data-seat-type aria-label="${corner.label} seat type"><option value="human" ${joiningComputer==='human'?'selected':''}>Human</option>${difficultyLevels.map(level=>`<option value="${level}" ${joiningComputer===level?'selected':''}>${level[0].toUpperCase()+level.slice(1)} computer</option>`).join('')}</select></label>`:''}<div>${finishes.map((f,i)=>`<button data-seat-color="${i}" data-corner="${corner.id}" style="--player:${f.color}" aria-label="${joiningComputer==='human'?'Join':'Add '+joiningComputer+' computer at'} ${corner.label} as ${f.name}" ${state.players.some(p=>finishIndex(p)===i)||busy||!uid?'disabled':''}><span>${f.mark}</span>${f.name}</button>`).join('')}</div><button data-action="cancel-seat">Cancel</button></div>`;
  else if (gathering) content = `<button class="open-table-seat" data-join-corner="${corner.id}" aria-label="Join ${corner.label}" ${busy||!uid||state.players.length>=state.capacity?'disabled':''}><span>＋</span>Tap to join</button>`;
  else content = '';
  return `<div class="table-corner corner-${corner.id}" data-corner-position="${corner.id}" aria-label="${corner.label} seat">${content}</div>`;
}
function tableEdgeControls(v, edge) {
  const gathering = ['empty','gathering'].includes(state.phase);
  return `<div class="table-center-controls table-controls-${edge}" role="region" aria-label="${edge==='north'?'North':'South'} table controls">${error ? `<p role="status">${escape(error)} <button data-action="retry">Retry</button></p>` : ""}${gathering ? `${state.phase==='gathering' && state.host===uid ? `<div class="setup-options"><label>Board<select id="map-choice-${edge}" data-table-setting="map"><option value="nihon" ${state.map==='nihon'?'selected':''}>Nihon</option><option value="tokyo" ${state.map==='tokyo'?'selected':''}>Tokyo</option></select></label><label><input id="specials-${edge}" data-table-setting="specials" type="checkbox" ${state.specials?'checked':''}> Special tiles & abilities</label><button class="primary" data-action="start" ${state.players.length<2||busy?'disabled':''}>Start picnic</button></div>` : '<p>Choose a corner to join the picnic.</p>'}` : `<div class="turn-strip"><p>${state.phase==='choosing'?'Choose abilities at your seats':state.phase==='finished'?'The picnic is complete':`${escape(currentPlayer(state)?.name)}’s turn · ${state.turnNumber}`}</p>${hint()}${v&&undoTarget(state,uid,v.id)&&!state.undoRequest?`<button data-action="undo">${undoTarget(state,uid,v.id).consent?'Request undo':'Undo last choice'}</button>`:''}</div>`}</div>`;
}
function tabletopSurface(v) {
  const gathering = ['empty','gathering'].includes(state.phase);
  return `<section class="shared-table" aria-label="Shared tabletop" data-table-view data-motion-idle="true">
    ${tableCorners.map(tableSeat).join('')}
    <div class="shared-board"><div class="board-surface" data-map="${state.map}">${boardSurfaceArt({map:state.map,playerCount:gathering && state.players.length<2?4:state.players.length,visual,renderCell:gathering?()=>'':cellFace})}${!gathering?`<div class="tie-tray" aria-label="Tied celebration tokens">${state.ties.map(t=>tokenButton(t,'tie')).join('')}</div>`:''}</div></div>
    ${tableEdgeControls(v,'north')}${tableEdgeControls(v,'south')}
    ${state.undoRequest?undoConsent():''}${state.phase==='finished'?victory():''}
  </section>`;
}

function entrance() {
  return `<section class="entrance"><div class="welcome-art">${painting("screen", "Cherry blossoms over a tranquil river")}</div><div class="welcome-copy"><p class="kicker">FLOWERS · FOOD · FESTIVITIES</p><h1>A place for everyone.</h1><p>Gather two to four friends for a picnic across Japan.</p><form id="entrance"><label>Your name<input name="name" maxlength="24" value="${escape(name)}" autocomplete="nickname" required></label><div class="entry-tabs"><button type="button" data-action="create-mode" aria-pressed="${formMode === "create"}">New table</button><button type="button" data-action="join-mode" aria-pressed="${formMode === "join"}">Join friends</button><button type="button" data-action="practice-mode" aria-pressed="${formMode === "practice"}">Practice</button></div>${formMode === "join" ? `<label>Table code<input name="code" value="${escape(joinCode)}" minlength="5" maxlength="8" required pattern="[A-Za-z0-9]{5,8}"></label>` : ""}${formMode === "practice" ? `<label>Computer level<select id="practice-difficulty" name="difficulty">${difficultyLevels.map(level=>`<option value="${level}" ${practiceDifficulty===level?"selected":""}>${level[0].toUpperCase()+level.slice(1)}</option>`).join("")}</select></label>` : ""}<button class="primary" ${!uid || busy ? "disabled" : ""}>${formMode === "practice" ? "Practice with the computer" : formMode === "create" ? "Lay out a picnic" : "Take your seat"}</button></form>${table && launch.mode === "join" ? '<p class="waiting">Waiting for the host to open this table…</p>' : ""}</div></section>`;
}
function gathering() {
  const mine = controlled().length > 0;
  return `<section class="gathering"><div class="gathering-art">${painting(state.map, "Watercolor game board")}</div><div class="gathering-copy"><p class="kicker">THE PICNIC IS GATHERING</p><h1>Pull up a blanket.</h1><p>Share <a class="invite" href="${base}?table=${table}">${table}</a> with your friends.</p><ol class="gathered">${state.players.map((p) => `<li style="--player:${finish(p).color}"><span>${finish(p).mark}</span><b>${escape(p.name)}</b><small>${p.edge}</small>${p.computer?computerLevelControl(p):''}</li>`).join("")}</ol>${!mine ? `<form id="join"><label>Your name<input name="name" value="${escape(name)}" maxlength="24" required></label><button class="primary" ${busy ? "disabled" : ""}>Take your seat</button></form>` : ""}
 ${
   state.host === uid
     ? `<div class="setup-options"><label>Map<select id="map-choice"><option value="nihon" ${state.map === "nihon" ? "selected" : ""}>Nihon</option><option value="tokyo" ${state.map === "tokyo" ? "selected" : ""}>Tokyo</option></select></label><label>Seats<select id="capacity">${[2, 3, 4].map((n) => `<option ${n === state.capacity ? "selected" : ""} ${n < state.players.length ? "disabled" : ""}>${n}</option>`).join("")}</select></label><label><input id="specials" type="checkbox" ${state.specials ? "checked" : ""}> Special tiles & abilities</label></div>${
         !tabletop && state.players.length < state.capacity ? `<button data-action="add-computer" ${busy?"disabled":""}>Add computer opponent</button>` : tabletop && state.players.length < state.capacity
           ? `<form id="local-seat"><label>Player name<input name="name" maxlength="24" required></label><label>Table edge<select name="edge">${[
               "north",
               "west",
               "east",
               "south",
             ]
               .filter((edge) => !state.players.some((p) => p.edge === edge))
               .map((e) => `<option>${e}</option>`)
               .join(
                 "",
               )}</select></label><button>Add a player at this edge</button></form>`
           : ""
       }<button class="primary" data-action="start" ${state.players.length < 2 || busy ? "disabled" : ""}>Unfold the board</button>`
     : '<p class="waiting">The host will unfold the board when everyone is here.</p>'
 }</div></section>`;
}
function draft() {
  return `<section class="ability-draft"><p class="kicker">A LITTLE SOMETHING FOR THE AFTERNOON</p><h1>Choose your ability.</h1><p>Keep one of your two cards. Use it once during the picnic.</p>${
    tabletop
      ? controlled()
          .map(
            (p) =>
              `<button data-select-seat="${p.id}" aria-pressed="${viewer()?.id === p.id}">${escape(p.name)}</button>`,
          )
          .join("")
      : ""
  }${
    viewer()?.ability
      ? "<p>Waiting for everyone to choose their card…</p>"
      : viewer()
        ? `<div class="draft-cards">${viewer()
            .abilityOptions.map((id) => {
              const a = abilityById(id);
              return `<button data-draft="${id}" aria-label="Choose ${a.name}">${painting(a.type, a.name)}<h2>${a.name}</h2><p>${a.effect}</p></button>`;
            })
            .join("")}</div>`
        : "<p>Players are choosing their cards.</p>"
  }</section>`;
}
function personalControls(v) {
  const target=v&&!state.undoRequest?undoTarget(state,uid,v.id):null;
  return `<div class="mat-controls"><div class="turn-strip"><p aria-live="polite">${state.phase === "finished" ? "The picnic is complete" : state.undoRequest ? "Waiting for an undo decision" : `${escape(currentPlayer(state).name)}’s turn · ${state.turnNumber}`}</p>${hint()}</div>${target?`<button data-action="undo" aria-label="${target.consent?'Request undo':'Undo last choice'}"><span aria-hidden="true">↶</span><span class="undo-caption"> ${target.consent?'Ask to undo':'Undo'}</span></button>`:''}${error?`<p role="status">${escape(error)} <button data-action="retry">Retry</button></p>`:''}</div>`;
}
function gameSurface(v) {
  return `<section class="game-table" data-table-view data-motion-idle="true">
 <button class="play-menu-toggle" data-action="toggle-info" aria-label="Players and game log" aria-controls="play-information" aria-expanded="${informationOpen}"><span aria-hidden="true">☰</span></button>
 <button class="play-drawer-scrim" data-action="close-info" aria-label="Close players and game log" tabindex="-1"></button>
 <div class="board-wrap"><div class="board-surface" data-map="${state.map}">${boardSurfaceArt({map:state.map,playerCount:state.players.length,visual,renderCell:cellFace})}<div class="tie-tray" aria-label="Tied celebration tokens">${state.ties.map((token) => tokenButton(token, "tie")).join("")}${Array.from({ length: Math.max(0, 4 - state.ties.length) }, () => '<span class="empty-tie">◌</span>').join("")}</div></div></div>
 <div class="play-dock"><div id="play-information" class="play-information"><div class="drawer-heading"><h2>Players & game log</h2><button data-action="close-info" aria-label="Close players and game log">×</button></div><aside class="player-rail" aria-label="Players">${state.players.map(playerSummary).join("")}</aside>${activityHistory()}</div>
 ${v?playerArea(v,true):`<div class="observer-note">${personalControls(null)}<p>You’re watching the picnic. Players keep their tiles and gathered celebrations private.</p></div>`}
 </div>
 ${state.undoRequest?undoConsent():''}${state.phase==='finished'?victory():''}
 </section>`;
}
function hint() {
  if (state.phase !== "playing") return "";
  if (!selection) {
    const adjustable=playable()&&Object.keys(state.board).some(cell=>canRotateCopy(state,viewer().id,cell));
    return `<span class="action-hint">${playable() ? adjustable?"Tap your Copy to adjust its direction, or choose another tile.":"Choose a tile, or drag a tile placed this turn to adjust it." : "Enjoy the view while your friends place their tiles."}</span>`;
  }
  let text = selection.ability
    ? `${abilityById(viewer().ability).name}: ${selection.targets.length ? "choose the second target" : "choose a target"}`
    : selection.reposition ? "Move your tile to another highlighted hex."
    : selection.tile === "move"
      ? selection.source
        ? "Choose empty land for your tile."
        : "Choose one of your non-fast tiles to move."
      : `Choose a place for ${tileById(selection.tile).name}.`;
  return `<span class="action-hint">${escape(text)}</span><button data-action="cancel" aria-label="Cancel selection">×</button>${selection.tile === "copy" || selection.holding?.tile === "copy" ? `<button data-action="rotate" aria-label="Rotate copy direction">↻ <span aria-label="Copy direction ${selection.direction}">↑ ${selection.direction * 60}°</span></button>` : ""}`;
}
function activityHistory() {
  return `<aside class="history-rail"><h2>The afternoon</h2><ol class="event-history" aria-label="Player action history">${state.history.map((e) => `<li data-event-sequence="${e.sequence}" data-active="${e.active}" class="${e.active ? "" : "undone"}">${historyEntry(e,state.players,type=>tokenArt(type,false,"history-captured"))}</li>`).join("")}</ol></aside>`;
}
function playerSummary(p) {
  const current = p.id === currentPlayer(state)?.id,
    color = finish(p).color;
  const reveal = state.phase === "finished";
  return `<article class="player-summary ${current ? "current" : ""}" style="--player:${color}" data-player-summary="${p.id}" data-seat-name="${escape(p.name)}"><span class="seat-mark">${finish(p).mark}</span><h2>${escape(p.name)}${p.difficulty?` <small class="computer-level">${p.difficulty[0].toUpperCase()+p.difficulty.slice(1)}</small>`:""}</h2><p>${p.hand.length} tiles · ${p.deck.length} in bag</p><p>${p.captured.length} celebrations gathered</p>${reveal ? `<div class="captured-reveal">${p.captured.map((t) => tokenButton(t, "summary-captured")).join("")}</div>` : ""}${tabletop && p.controller === uid ? `<button data-select-seat="${p.id}" aria-pressed="${viewer()?.id === p.id}">${viewer()?.id === p.id ? "At this edge" : "Use this edge"}</button>` : ""}</article>`;
}
function playerArea(p, visible) {
  const can = tabletop ? !p.computer && p.controller === uid && p.id === currentPlayer(state)?.id && state.phase === "playing" && !state.undoRequest && !busy && !motion.running : playable() && viewer()?.id === p.id,
    color = finish(p).color;
  return playerAreaArt({player:p,color:finishIndex(p),visible,canPlay:can,
    selected:viewer()?.id===p.id?selection:null,
    holding:selection?.playerId===p.id?selection.holding:null,
    revealable:tabletop&&p.controller===uid&&!p.computer,
    canDraw:can&&!!(state.placed||!p.hand.length)&&state.phase!=='finished',
    canUseAbility:can&&!p.usedAbility&&!state.placed,renderToken:tokenButton,
    controls:!tabletop?personalControls(p):''});
}
function tokenButton(token, where, influence) {
  return `<button class="celebration-piece" data-token="${token.id}" data-token-type="${token.type}" aria-label="${token.type} celebration ${token.id}" ${!selection?.ability ? "disabled" : ""}>${tokenArt(token.type, false, where)}${influenceBadge(influence,state.players)}</button>`;
}
function legalCell(c) {
  if (!playable()) return false;
  if(!selection)return canRotateCopy(state,viewer().id,c.id)||canReposition(state,viewer().id,c.id);
  if(selection.reposition)return canIntent({type:'reposition',playerId:viewer().id,source:selection.reposition,destination:c.id});
  if (selection.ability) {
    const a = abilityById(viewer().ability);
    if (selection.targets.length)
      return canIntent({ type: "ability", a: selection.targets[0], b: c.id });
    switch (a.type) {
      case "bicycle":
        return !!state.board[c.id] && c.kind === "land";
      case "green-tea":
        return (
          state.board[c.id]?.owner === viewer().id &&
          ["sakura", "chochin", "onigiri"].includes(
            tileById(state.board[c.id].tile).type,
          )
        );
      case "akkorokamui":
      case "rainy-day":
        return canIntent({ type: "ability", a: c.id });
      default:
        return false;
    }
  }
  if (selection.tile === "move")
    return selection.source
      ? canIntent({ type: "move", source: selection.source, destination: c.id })
      : state.board[c.id]?.owner === viewer().id &&
          !tileById(state.board[c.id].tile).fast &&
          !state.board[c.id].facedown;
  return availablePlacement(state, viewer().id, selection.tile, c.id);
}
function canIntent(intent) {
  try {
    replay([
      ...events,
      {
        version: VERSION,
        sequence: events.length + 1,
        id: "validation-only",
        actor: uid,
        intent: { ...intent, playerId: viewer()?.id },
      },
    ]);
    return true;
  } catch {
    return false;
  }
}
function cellFace(c) {
  const piece = selection?.holding && selection.source===c.id ? {tile:"move",cell:c.id,owner:selection.playerId,direction:0} : state.board[c.id];
  const owner = piece && state.players.find((p) => p.id === piece.owner);
  return boardCellArt(c, {
    map: state.map,
    visual,
    piece: piece && { ...piece, name: tileById(piece.tile).name, definition: tileById(piece.tile) },
    tokens: state.tokens[c.id] || [],
    legal: legalCell(c),
    repositionable:playable()&&canReposition(state,viewer().id,c.id),
    actionLabel: !selection&&playable()&&canRotateCopy(state,viewer().id,c.id)?"Rotate Copy":"",
    playerIndexFor:id=>finishIndex(state.players.find(p=>p.id===id)),
    ownerName: owner?.name || "",
    playerIndex: piece ? finishIndex(owner) : 0,
    renderToken: tokenButton,
    influence: influenceData,
  });
}

function undoConsent() {
  const r = state.undoRequest;
  return `<section class="undo-consent" aria-label="Undo consent request"><p>A player asks to undo: ${escape(r.reason)}.</p>${r.required
    .map((id) => {
      const p = state.players.find((p) => p.id === id);
      return `<div><span>${escape(p.name)} · ${r.approved.includes(id) ? "agreed" : "waiting"}</span>${p.controller === uid && !p.computer && !r.approved.includes(id) ? `<button data-vote="yes" data-voter="${p.id}" aria-label="${escape(p.name)} agrees to undo">Agree</button><button data-vote="no" data-voter="${p.id}" aria-label="${escape(p.name)} declines undo">Keep playing</button>` : ""}</div>`;
    })
    .join("")}</section>`;
}
function victory() {
  return `<section class="victory" aria-label="Game result"><p class="kicker">THE LAST BLOSSOM FALLS</p><h1>${state.winners.map((id) => escape(state.players.find((p) => p.id === id).name)).join(" & ")} ${state.winners.length > 1 ? "share the victory" : "wins"}</h1><div class="victory-awards">${["sakura", "chochin", "onigiri"].map((type) => `<div>${tokenArt(type, true)}<span>${state.awards[type] ? escape(state.players.find((p) => p.id === state.awards[type]).name) : "No majority"}</span></div>`).join("")}</div><p>All captured celebrations are revealed below.</p><a href="${base}${tabletop ? "tabletop/" : ""}">Lay out another picnic</a></section>`;
}
app.addEventListener("input", (e) => {
  if (e.target.name === "name") name = e.target.value;
  if (e.target.name === "code") joinCode = e.target.value;
});
app.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = new FormData(e.target);
  name = String(data.get("name") || "").trim();
  localStorage.setItem("hanami:name", name);
  if (e.target.id === "entrance") {
    const create = formMode !== "join";
    const code = create
      ? tableCode()
      : String(data.get("code") || "").toUpperCase();
    launch = { ...launch, mode: create ? "create" : "join", table: code, name, practice: formMode === "practice" };
    if(launch.practice)practiceDifficulty=String(data.get("difficulty")||"easy");
    await subscribe(code);
  } else if (e.target.id === "join") await send({ type: "join", name });
  else if (e.target.id === "local-seat")
    await send({ type: "join", name, edge: data.get("edge") });
});
app.addEventListener("change", async (e) => {
  if(e.target.dataset.computerLevel){await send({type:'computer-level',playerId:e.target.dataset.computerLevel,difficulty:e.target.value});return;}
  if(e.target.hasAttribute('data-seat-type')){joiningComputer=e.target.value;render();return;}
  if(e.target.id==="practice-difficulty")practiceDifficulty=e.target.value;
  if (e.target.id === "map-choice" || e.target.dataset.tableSetting === "map")
    await send({ type: "configure", map: e.target.value });
  if (e.target.id === "capacity")
    await send({ type: "configure", capacity: +e.target.value });
  if (e.target.id === "specials" || e.target.dataset.tableSetting === "specials")
    await send({ type: "configure", specials: e.target.checked });
});
app.addEventListener("click", async (e) => {
  const button = e.target.closest("button");
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  if(action==='toggle-info'||action==='close-info'){informationOpen=action==='toggle-info'&&!informationOpen;syncPlayInformation({focus:true});return;}
  if(motion.running)return;
  const seatPlayer = button.closest('[data-player]')?.dataset.player;
  if (tabletop && seatPlayer && state.players.some(p=>p.id===seatPlayer&&p.controller===uid&&!p.computer) && localSeat!==seatPlayer) {
    localSeat = seatPlayer;
    clearSelection();
  }
  if (button.dataset.joinCorner) { joiningCorner=button.dataset.joinCorner; joiningComputer="human"; render(); return; }
  if (action==='cancel-seat') { joiningCorner=null; render(); return; }
  if (button.dataset.seatColor !== undefined) {
    const color=Number(button.dataset.seatColor);
    if(joiningComputer!=='human'){
      joiningCorner=null;
      await send({type:'add-computer',difficulty:joiningComputer,color,edge:button.dataset.corner});
      return;
    }
    pendingTableSeat={name:finishes[color].name,color,edge:button.dataset.corner};
    joiningCorner=null;
    if (!table) await subscribe(tableCode());
    await autoLaunch();
    return;
  }
  if (action === "create-mode" || action === "join-mode" || action === "practice-mode") {
    formMode = action.replace("-mode", "");
    render();
    return;
  }
  if (action === "retry") {
    if (!uid) return initialize();
    error = "";
    try {
      await repo?.retry();
    } catch (e) {
      error = e.message;
    }
    render();
    return;
  }
  if (button.dataset.draft) {
    await send({
      type: "choose-ability",
      ability: button.dataset.draft,
      playerId: viewer().id,
    });
    return;
  }
  if (action === "add-computer") {
    await send({type:"add-computer"});return;
  }
  if (action === "start") {
    await send({ type: "start", seed: `${table}:v1:${state.revision}` });
    return;
  }
  if (button.dataset.selectSeat) {
    localSeat = button.dataset.selectSeat;
    selection = null;
    render();
    return;
  }
  if (button.dataset.reveal) {
    const id = button.dataset.reveal;
    if (revealed.has(id)) revealed.delete(id);
    else {
      revealed.add(id);
      localSeat = id;
    }
    render();
    return;
  }
  if (action === "cancel") {
    const held=selection?.holding&&$("[data-held-move] .printed-tile");
    if(held){
      const source=selection.source,before=captureComponents(app,state);
      clearSelection();render();
      motion.transition(before,state,state,{intent:{type:'move-cancel',source}},visual);
    }else{clearSelection();render();}
    return;
  }
  if (action === "rotate") {
    rotateSelectedCopy();
    return;
  }
  if (action === "end") {
    await send({ type: "end", playerId: viewer().id });
    return;
  }
  if (action === "undo") {
    const t = undoTarget(state, uid, viewer().id);
    await send({ type: t.consent ? "undo-request" : "undo", target: t.id });
    return;
  }
  if (button.dataset.vote) {
    await send({
      type: "undo-vote",
      request: state.undoRequest.id,
      playerId: button.dataset.voter,
      approve: button.dataset.vote === "yes",
    });
    return;
  }
  if (action === "ability") {
    selection = selection?.ability ? null : { ability: true, targets: [] };
    render();
    return;
  }
  if(button.hasAttribute("data-held-move")&&selection?.holding?.tile==="copy"){rotateSelectedCopy();return;}
  if (button.dataset.tile) {
    const tile = button.dataset.tile;
    if (selection?.ability) {
      const a = abilityById(viewer().ability);
      if (["taiyaki", "dango"].includes(a.type)) {
        selection.targets = [tile];
        render();
      }
      return;
    }
    selection = selection?.tile === tile ? null : { tile, direction: 0, playerId:viewer().id };
    render();
    return;
  }
  if (button.dataset.token && selection?.ability) {
    const value = button.dataset.token;
    if (!selection.targets.length) {
      selection.targets.push(value);
      render();
    } else
      await send({
        type: "ability",
        playerId: viewer().id,
        a: selection.targets[0],
        b: value,
      });
    return;
  }
  if(button.dataset.cell){
    if(button.dataset.legal!=="true"&&Number(button.dataset.stackSize)>1){inspectedCell=button.dataset.cell;render();return;}
    await playCell(button.dataset.cell);
  }

});

async function playCell(id,gesture=null) {
  if(motion.running||busy)return;
  const target=$(`[data-cell="${id}"]`);
  if(!target||target.disabled||target.dataset.legal!=="true")return;
  if(gesture)motion.setDropOrigin(gesture);
  if(!selection){
    if(playable()&&canRotateCopy(state,viewer().id,id))await send({type:"rotate-copy",playerId:viewer().id,cell:id,direction:(state.board[id].direction+1)%6});
    if(playable()&&canReposition(state,viewer().id,id)&&state.board[id].tile!=='copy'){
      selection={reposition:id,tile:state.board[id].tile,direction:state.board[id].direction||0,playerId:viewer().id};render();
    }
    return;
  }

    if(selection.reposition){
      await send({type:'reposition',playerId:viewer().id,source:selection.reposition,destination:id,...(selection.tile==='copy'?{direction:selection.direction}:{})});
      return;
    }
    if (selection.ability) {
      const a = abilityById(viewer().ability);
      if (["akkorokamui", "rainy-day"].includes(a.type))
        await send({ type: "ability", playerId: viewer().id, a: id });
      else if (!selection.targets.length) {
        selection.targets.push(id);
        render();
      } else
        await send({
          type: "ability",
          playerId: viewer().id,
          a: selection.targets[0],
          b: id,
        });
      return;
    }
    if (selection.tile === "move") {
      if (!selection.source) {
        const before=captureComponents(app,state);
        selection.source = id;
        selection.playerId=viewer().id;
        selection.holding={...state.board[id]};
        selection.direction=selection.holding.direction||0;
        render();
        motion.transition(before,state,state,{intent:{type:"move-lift",source:id}},visual);
      } else
        await send({
          type: "move",
          playerId: viewer().id,
          source: selection.source,
          destination: id,
          ...(selection.holding?.tile==="copy"?{direction:selection.holding.direction}:{}),
        });
      return;
    }
    await send({
      type: "place",
      playerId: viewer().id,
      tile: selection.tile,
      cell: id,
      ...(selection.tile === "copy" ? { direction: selection.direction } : {}),
    });
}
function rotateSelectedCopy() {
  if(!selection || !(selection.tile==="copy" || selection.holding?.tile==="copy"))return null;
  selection.direction=((selection.holding?.direction??selection.direction??0)+1)%6;
  if(selection.holding)selection.holding.direction=selection.direction;
  const turn=copyRotation(selection.direction);
  {
    const area=app.querySelector(`[data-player="${selection.playerId}"]`);
    const piece=selection.reposition?app.querySelector(`[data-cell="${selection.reposition}"] .printed-tile`):area?.querySelector(selection.holding?'[data-held-move] .printed-tile':'[data-tile="copy"] .printed-tile');
    piece?.style.setProperty('--tile-turn',`${turn}deg`);
    piece?.querySelector('.printed-copy-arrow')?.setAttribute('aria-label',`Copy direction: ${['north','north-east','south-east','south','south-west','north-west'][selection.direction]}`);
    for(const label of app.querySelectorAll('[data-action="rotate"] span')){label.setAttribute('aria-label',`Copy direction ${selection.direction}`);label.textContent=`↑ ${selection.direction*60}°`;}
  }
  refreshInfluence();
  return turn;
}
function refreshInfluence() {
 const projected=previewInfluence(state,viewer()?.id,selection,influenceHover);
 influenceData=influenceReadings(projected.state,projected.preview);
 updateInfluenceBadges(app,influenceData,state.players);
}
installComponentDrag(app,{
  sourceSelector:'.hand-tile[data-tile],[data-held-move],.space-target[data-repositionable=true]',
  canStart:el=>!motion.running&&!motion.dropOrigin&&!busy&&state.phase==='playing'&&(el.dataset.cell?playable()&&canReposition(state,viewer().id,el.dataset.cell):el.closest('[data-player]')?.dataset.player===currentPlayer(state)?.id),
  begin:el=>{
    if(el.dataset.cell){const piece=state.board[el.dataset.cell];localSeat=piece.owner;selection={reposition:el.dataset.cell,tile:piece.tile,direction:piece.direction||0,playerId:localSeat};render();return;}
    localSeat=el.closest('[data-player]').dataset.player;
    if(el.dataset.tile&&!(selection?.tile===el.dataset.tile&&selection.playerId===localSeat))selection={tile:el.dataset.tile,direction:0,playerId:localSeat};
    render();
  },
  rotate:()=>rotateSelectedCopy(),
  hover:cell=>{if(cell!==influenceHover){influenceHover=cell;refreshInfluence();}},
  drop:(id,source,gesture)=>playCell(id,gesture),
  cancel:()=>{if(selection?.reposition){clearSelection();render();}},
});
window.addEventListener(VISUAL_PREVIEW_EVENT,()=>render());
render();
void initialize();
