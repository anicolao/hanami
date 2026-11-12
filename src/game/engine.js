import { tiles as tileManifest, abilities, celebrations, players as playerFinishes } from "../catalog.js";
import { shuffle } from "./random.js";
import { boardCells, adjacent, neighbors } from "./maps.js";
export const VERSION = 4;
// Version 4 records this-turn placement corrections without repeating tile effects.
// Version 3 permits choosing a relocated Copy direction and adjusting a Copy
// placed this turn. Versions 1 and 2 remain replayable without rewriting events.
// Version 1 mistakenly treated Draw/Cover as normal tiles. Replay its choices
// under those rules, including historical Move targets, without rewriting logs.
const isFast = (tile, version) => version === 1 && ["draw", "cover"].includes(tile.id) ? false : !!tile.fast;
const types = celebrations.map((c) => c.id);
export const tileById = (id) => tileManifest.find((t) => t.id === id);
export const abilityById = (id) => abilities.find((a) => a.id === id);
const fail = (message) => {
  throw new Error(message);
};
const requireThat = (yes, message) => {
  if (!yes) fail(message);
};
export function initial() {
  return {
    version: VERSION,
    revision: 0,
    phase: "empty",
    host: null,
    mode: "web",
    capacity: 4,
    map: "nihon",
    specials: false,
    players: [],
    board: {},
    tokens: {},
    ties: [],
    turn: 0,
    turnNumber: 1,
    normalUsed: false,
    placed: 0,
    abilityUsedThisTurn: false,
    winners: [],
    awards: {},
    history: [],
    undoRequest: null,
  };
}
export function currentPlayer(s) {
  return s.players[s.turn];
}
export function seatFor(s, actor, playerId) {
  return s.players.find(
    (p) => p.id === (playerId || actor) && p.controller === actor,
  );
}
export function cells(s) {
  return boardCells(s.map, s.players.length);
}
export function setupTokens(s, seed) {
  const parks = cells(s).filter((c) => c.kind === "park");
  let pool = types.flatMap((t) => Array(s.players.length * 3 + 1).fill(t));
  s.tokens = {};
  for (const park of parks.filter((p) => p.capacity === 3)) {
    s.tokens[park.id] = types.map((type, i) => ({
      id: `${park.id}-${i}`,
      type,
    }));
    for (const type of types) pool.splice(pool.indexOf(type), 1);
  }
  pool = shuffle(pool, `${seed}:tokens`);
  for (const park of parks.filter((p) => p.capacity === 2)) {
    const a = pool.shift(),
      index = pool.findIndex((t) => t !== a),
      b = pool.splice(index, 1)[0];
    s.tokens[park.id] = [a, b].map((type, i) => ({
      id: `${park.id}-${i}`,
      type,
    }));
  }
  for (const park of parks.filter((p) => p.capacity === 1))
    s.tokens[park.id] = [{ id: `${park.id}-0`, type: pool.shift() }];
  requireThat(pool.length === 0, "Map and celebration supply do not agree.");
}
function begin(s, seed) {
  s.phase = s.specials ? "choosing" : "playing";
  s.seed = seed;
  setupTokens(s, seed);
  const specialIds = shuffle(
    abilities.filter((a) => a.group === "Special").map((a) => a.id),
    `${seed}:abilities`,
  );
  for (const [i, p] of s.players.entries()) {
    p.deck = shuffle(
      tileManifest
        .filter((t) => s.specials || t.group !== "Special")
        .map((t) => t.id),
      `${seed}:player:${i}`,
    );
    p.hand = p.deck.splice(0, 5);
    p.captured = [];
    p.usedAbility = false;
    p.ability = s.specials ? null : `torii-${p.color ?? i}`;
    p.abilityOptions = s.specials ? specialIds.slice(i * 2, i * 2 + 2) : [];
  }
}
// A placement's full definition is reconstructed from its ID, never persisted as an outcome.
export function strength(s, placement, celebration, visited = new Set()) {
  if (!placement || placement.facedown || visited.has(placement.cell)) return 0;
  const tile = tileById(placement.tile);
  if (tile.type === "copy") {
    visited.add(placement.cell);
    const origin = cells(s).find((c) => c.id === placement.cell),
      targets = adjacent(origin, cells(s));
    const angle = ((placement.direction ?? 0) * Math.PI) / 3 - Math.PI / 2;
    const target = targets
      .map((c) => ({
        c,
        score: Math.cos(
          Math.atan2((c.y - origin.y) * 0.47, c.x - origin.x) - angle,
        ),
      }))
      .sort((a, b) => b.score - a.score)[0];
    return target && target.score > 0.9
      ? strength(s, s.board[target.c.id], celebration, visited)
      : 0;
  }
  if (
    placement.boat ||
    ["cat", "boat", "cover", "draw"].includes(tile.type) ||
    tile.type === celebration
  )
    return tile.strength || 0;
  return 0;
}
// Public influence totals shared by scoring and the live board badges.
export function parkInfluence(s, park, celebration, surrounding) {
  const cell=typeof park==='string'?cells(s).find(c=>c.id===park):park;
  const around=surrounding||adjacent(cell,cells(s));
  return s.players.map(p=>({playerId:p.id,total:around.reduce((n,c)=>
    n+(s.board[c.id]?.owner===p.id?strength(s,s.board[c.id],celebration):0),0)}));
}
function capture(s) {
  for (const park of cells(s).filter(
    (c) => c.kind === "park" && s.tokens[c.id]?.length,
  )) {
    const surrounding = adjacent(park, cells(s));
    if (
      !surrounding.filter((c) => c.kind === "land").every((c) => s.board[c.id])
    )
      continue;
    for (const token of s.tokens[park.id]) {
      const scores = parkInfluence(s,park,token.type,surrounding).map(row=>row.total);
      const best = Math.max(...scores),
        winning = s.players.filter((_, i) => scores[i] === best);
      if (best > 0 && winning.length === 1) winning[0].captured.push(token);
      else s.ties.push(token);
    }
    s.tokens[park.id] = [];
  }
}
export function scoreGame(s) {
  const awards = {};
  for (const type of types) {
    const counts = s.players.map(
        (p) => p.captured.filter((t) => t.type === type).length,
      ),
      max = Math.max(...counts);
    const leaders = s.players.filter((_, i) => counts[i] === max);
    if (max && leaders.length === 1) awards[type] = leaders[0].id;
  }
  s.awards = awards;
  const rows = s.players.map((p) => {
    const won = types.filter((t) => awards[t] === p.id);
    return {
      id: p.id,
      points: won.length,
      other: p.captured.filter((t) => !won.includes(t.type)).length,
      total: p.captured.length,
    };
  });
  const max = Math.max(...rows.map((p) => p.points));
  let leaders = rows.filter((p) => p.points === max);
  if (max === 0) {
    const total = Math.max(...leaders.map((p) => p.total));
    leaders = leaders.filter((p) => p.total === total);
  } else if (leaders.length > 1) {
    const other = Math.max(...leaders.map((p) => p.other));
    leaders = leaders.filter((p) => p.other === other);
    const total = Math.max(...leaders.map((p) => p.total));
    leaders = leaders.filter((p) => p.total === total);
  }
  s.winners = leaders.map((p) => p.id);
  s.phase = "finished";
}
export function canReposition(s,playerId,cellId) {
  const piece=s.board[cellId];
  return s.phase==='playing'&&!s.undoRequest&&currentPlayer(s)?.id===playerId&&
    piece?.owner===playerId&&!piece.facedown&&piece.placementTurn===s.turnNumber&&
    (piece.tile!=='move'||piece.boat);
}
export function canRotateCopy(s, playerId, cellId) {
  const piece=s.board[cellId];
  return s.phase==="playing" && !s.undoRequest && currentPlayer(s)?.id===playerId &&
    piece?.owner===playerId && piece.tile==="copy" && !piece.facedown && piece.placedTurn===s.turnNumber;
}
function validateCopyDirection(direction) {
  requireThat(Number.isInteger(direction) && direction>=0 && direction<6,"Choose a copy direction.");
}
export function availablePlacement(s, playerId, tileId, cellId) {
  try {
    validatePlacement(s, playerId, tileId, cellId);
    return true;
  } catch {
    return false;
  }
}
function validatePlacement(s, playerId, tileId, cellId, version = VERSION) {
  const p = currentPlayer(s),
    tile = tileById(tileId),
    cell = cells(s).find((c) => c.id === cellId);
  requireThat(
    tile && tile.type !== "move",
    "Choose a non-fast tile to relocate first.",
  );
  requireThat(
    s.phase === "playing" && !s.undoRequest,
    "Finish the current decision first.",
  );
  requireThat(p?.id === playerId, "Wait for your turn.");
  requireThat(p.hand.includes(tileId), "That tile is not in your hand.");
  requireThat(
    !s.normalUsed || isFast(tile, version),
    "You already placed your normal tile.",
  );
  requireThat(cell && cell.kind !== "park", "Choose a playable space.");
  if (tile.type === "cover")
    requireThat(
      s.board[cellId]?.owner === playerId,
      "Cover one of your own tiles.",
    );
  else
    requireThat(
      !s.board[cellId] &&
        (tile.type === "boat" ? cell.kind === "water" : cell.kind === "land"),
      "Choose an empty space of the right terrain.",
    );
}
function place(s, p, i, version) {
  validatePlacement(s, p.id, i.tile, i.cell, version);
  const tile = tileById(i.tile);
  if (tile.type === "copy")
    requireThat(
      Number.isInteger(i.direction) && i.direction >= 0 && i.direction < 6,
      "Choose a copy direction.",
    );
  const placement = {
    tile: i.tile,
    owner: p.id,
    cell: i.cell,
    direction: i.direction ?? 0,
    ...(tile.type === "copy" ? {placedTurn:s.turnNumber} : {}),
    ...(version>=4?{placementTurn:s.turnNumber,placementTerrain:tile.type==='cover'?'cover':tile.type==='boat'?'water':'land'}:{}),
    ...(tile.type === "cover" ? { covered: s.board[i.cell] } : {}),
  };
  s.board[i.cell] = placement;
  p.hand.splice(p.hand.indexOf(i.tile), 1);
  s.placed++;
  if (tile.type === "move") fail("Use the move intent to relocate a tile.");
  if (!isFast(tile, version)) s.normalUsed = true;
  if (tile.type === "draw" && p.deck.length) p.hand.push(p.deck.shift());
}
function basic(s, actor, i, version = VERSION) {
  let p = seatFor(s, actor, i.playerId);
  if (i.type === "create") {
    requireThat(s.phase === "empty", "This table already exists.");
    requireThat(validName(i.name), "Enter a name of 1–24 characters.");
    s.host = actor;
    s.mode = i.mode === "tabletop" ? "tabletop" : "web";
    s.capacity = i.capacity ?? 4;
    requireThat([2, 3, 4].includes(s.capacity), "Choose 2–4 seats.");
    s.map = i.map === "tokyo" ? "tokyo" : "nihon";
    s.specials = !!i.specials;
    s.phase = "gathering";
    requireThat(!i.edge || ["south", "north", "west", "east", ...(s.mode === "tabletop" ? ["south-west", "south-east", "north-west", "north-east"] : [])].includes(i.edge), "Choose a free seat.");
    s.players.push(
      player(
        s.mode === "tabletop" ? `${actor}:${i.edge || "south"}` : actor,
        actor,
        i.name,
        s.mode === "tabletop" ? (i.edge || "south") : "south",
        playerColor(s, i.color),
      ),
    );
    if (i.computer === true) addComputer(s, actor, i.difficulty, i);
    return;
  }
  if (i.type === "add-computer") {
    addComputer(s, actor, i.difficulty, i);
    return;
  }
  if (i.type === "computer-level") {
    requireThat(actor===s.host && s.phase==='gathering', 'Only the host can change computer levels before play.');
    requireThat(p?.computer, 'Choose a computer seat.');
    requireThat(['easy','medium','hard'].includes(i.difficulty), 'Choose a computer level.');
    p.difficulty=i.difficulty;
    return;
  }
  if (i.type === "join") {
    requireThat(s.phase === "gathering", "This table is not gathering.");
    requireThat(s.players.length < s.capacity, "This table is full.");
    requireThat(validName(i.name), "Enter a name of 1–24 characters.");
    const local = actor === s.host && s.mode === "tabletop";
    const edge =
      i.edge ||
      (s.players.some(p => p.edge.includes("-")) ? ["south-west", "south-east", "north-west", "north-east"] : ["south", "north", "west", "east"]).find(
        (edge) => !s.players.some((player) => seatPosition(s, player.edge) === seatPosition(s, edge)),
      );
    const id = local ? `${actor}:${edge}` : actor;
    requireThat(
      !s.players.some((p) => p.id === id),
      "You already have this seat.",
    );
    requireThat(
      ["south", "north", "west", "east", ...(s.mode === "tabletop" ? ["south-west", "south-east", "north-west", "north-east"] : [])].includes(edge) &&
        !s.players.some((p) => seatPosition(s, p.edge) === seatPosition(s, edge)),
      "Choose a free edge.",
    );
    s.players.push(player(id, actor, i.name, edge, playerColor(s, i.color)));
    return;
  }
  requireThat(
    s.players.some((p) => p.controller === actor),
    "Take a seat first.",
  );
  if (i.type === "configure") {
    requireThat(
      actor === s.host && s.phase === "gathering",
      "Only the host configures the gathering.",
    );
    if (i.map !== undefined) {
      requireThat(["nihon", "tokyo"].includes(i.map), "Unknown map.");
      s.map = i.map;
    }
    if (i.specials !== undefined) s.specials = !!i.specials;
    if (i.capacity !== undefined) {
      requireThat(
        [2, 3, 4].includes(i.capacity) && i.capacity >= s.players.length,
        "Keep every occupied seat.",
      );
      s.capacity = i.capacity;
    }
    return;
  }
  if (i.type === "start") {
    requireThat(
      actor === s.host && s.phase === "gathering" && s.players.length >= 2,
      "Gather at least two players.",
    );
    requireThat(
      typeof i.seed === "string" && i.seed.length > 0 && i.seed.length < 100,
      "Missing shuffle seed.",
    );
    begin(s, i.seed);
    return;
  }
  if (i.type === "choose-ability") {
    requireThat(
      p &&
        s.phase === "choosing" &&
        !p.ability &&
        p.abilityOptions.includes(i.ability),
      "Choose one of your two ability cards.",
    );
    p.ability = i.ability;
    p.abilityOptions = [];
    if (s.players.every((p) => p.ability)) s.phase = "playing";
    return;
  }
  requireThat(
    p && s.phase === "playing" && !s.undoRequest,
    "Finish the current decision first.",
  );
  requireThat(currentPlayer(s).id === p.id, "Wait for your turn.");
  if (i.type === "place") {
    place(s, p, i, version);
    return;
  }
  if(i.type==='reposition') {
    requireThat(version>=4,'Placement corrections require protocol 4.');
    requireThat(canReposition(s,p.id,i.source),'Only a tile placed or relocated this turn can be adjusted.');
    const piece=s.board[i.source],cell=cells(s).find(c=>c.id===i.destination),terrain=piece.placementTerrain;
    requireThat(i.source!==i.destination&&cell&&cell.kind!=='park','Choose a different playable space.');
    if(terrain==='cover')requireThat(s.board[i.destination]?.owner===p.id,'Cover one of your own tiles.');
    else requireThat(!s.board[i.destination]&&cell.kind===terrain,'Choose an empty space of the right terrain.');
    if(piece.adjustmentOrigin)requireThat(neighbors(cells(s).find(c=>c.id===piece.adjustmentOrigin),cell),'Keep the Bicycle tile adjacent to its original space.');
    if(i.direction!==undefined){requireThat(piece.tile==='copy','Only Copy has a direction.');validateCopyDirection(i.direction);}
    const next={...piece,cell:i.destination,...(i.direction===undefined?{}:{direction:i.direction})};
    if(terrain==='cover'){s.board[i.source]=piece.covered;next.covered=s.board[i.destination];}
    else delete s.board[i.source];
    s.board[i.destination]=next;
    return;
  }
  if (i.type === "rotate-copy") {
    requireThat(version>=3,"Copy adjustment requires protocol 3.");
    requireThat(canRotateCopy(s,p.id,i.cell),"Only your Copy placed or moved this turn can be rotated.");
    validateCopyDirection(i.direction);
    s.board[i.cell].direction=i.direction;
    return;
  }
  if (i.type === "move") {
    const tile = tileById("move"),
      source = s.board[i.source],
      destination = cells(s).find((c) => c.id === i.destination);
    requireThat(
      p.hand.includes("move") &&
        source?.owner === p.id &&
        !isFast(tileById(source.tile), version) &&
        !source.facedown,
      "Choose your own non-fast tile to move.",
    );
    requireThat(
      destination?.kind === "land" && !s.board[i.destination],
      "Choose empty land for the moved tile.",
    );
    const direction=version>=3?i.direction:undefined;
    requireThat(direction===undefined || source.tile==="copy","Only Copy has a direction.");
    if(direction!==undefined)validateCopyDirection(direction);
    const {adjustmentOrigin,...movingSource}=source;
    s.board[i.destination] = { ...movingSource, cell: i.destination,
      ...(version>=4?{placementTurn:s.turnNumber,placementTerrain:'land'}:{}),
      ...(source.tile==="copy"?{direction:direction??source.direction,placedTurn:s.turnNumber}:{}) };
    s.board[i.source] = {
      tile: tile.id,
      cell: i.source,
      owner: p.id,
      direction: 0,
    };
    p.hand.splice(p.hand.indexOf("move"), 1);
    s.placed++;
    return;
  }
  if (i.type === "ability") {
    requireThat(
      !p.usedAbility && !s.placed && !s.abilityUsedThisTurn,
      "Use your ability before placing any tiles.",
    );
    useAbility(s, p, i, version);
    p.usedAbility = true;
    s.abilityUsedThisTurn = true;
    return;
  }
  if (i.type === "end") {
    requireThat(s.placed > 0 || p.hand.length === 0, "Place a tile first.");
    capture(s);
    while (p.hand.length < 5 && p.deck.length) p.hand.push(p.deck.shift());
    const remaining = Object.values(s.tokens).flat();
    if (
      types.some((t) => !remaining.some((token) => token.type === t)) ||
      s.ties.length >= 4
    ) {
      scoreGame(s);
      return;
    }
    s.turn = (s.turn + 1) % s.players.length;
    s.turnNumber++;
    s.normalUsed = false;
    s.placed = 0;
    s.abilityUsedThisTurn = false;
    return;
  }
  fail("Unknown player choice.");
}
function addComputer(s, actor, difficulty, options={}) {
  requireThat(difficulty === undefined || ["easy", "medium", "hard"].includes(difficulty), "Choose a computer level.");
  requireThat(actor === s.host && s.phase === "gathering", "Only the host can add a computer before play.");
  requireThat(s.players.length < s.capacity, "This table is full.");
  const edges=s.mode==='tabletop'?["south-west","south-east","north-west","north-east"]:["north","west","east","south"];
  const edge=options.edge||edges.find(edge=>!s.players.some(p=>seatPosition(s,p.edge)===seatPosition(s,edge)));
  requireThat(edges.includes(seatPosition(s,edge))&&!s.players.some(p=>seatPosition(s,p.edge)===seatPosition(s,edge)), 'Choose a free seat.');
  const color=playerColor(s,options.color),name=s.mode==='tabletop'?playerFinishes[color].name:"Computer"+(s.players.some(p=>p.computer)?` ${color+1}`:"");
  s.players.push({...player(`${actor}:computer:${color}`,actor,name,edge,color),computer:true,...(difficulty?{difficulty}:{})});
}
const validName = (name) =>
  typeof name === "string" && name.trim().length > 0 && name.length <= 24;
function seatPosition(s, edge) {
  return s.mode === "tabletop" ? ({south:"south-west",north:"north-east",west:"north-west",east:"south-east"}[edge] || edge) : edge;
}
function playerColor(s, requested) {
  const used = s.players.map((p, index) => p.color ?? index);
  const color = requested ?? [0, 1, 2, 3].find(c => !used.includes(c));
  requireThat(Number.isInteger(color) && color >= 0 && color < 4 && !used.includes(color), "Choose an available color.");
  return color;
}
function player(id, controller, name, edge, color) {
  return {
    id,
    controller,
    name: name.trim(),
    edge,
    color,
    hand: [],
    deck: [],
    captured: [],
    usedAbility: false,
  };
}
function useAbility(s, p, i, version = VERSION) {
  const a = abilityById(p.ability),
    A = s.board[i.a],
    B = s.board[i.b],
    cellA = cells(s).find((c) => c.id === i.a),
    cellB = cells(s).find((c) => c.id === i.b);
  switch (a.type) {
    case "torii":
    case "fruit-sandwich": {
      const from = Object.values(s.tokens).find((list) =>
          list.some((t) => t.id === i.a),
        ),
        to = Object.values(s.tokens).find((list) =>
          list.some((t) => t.id === i.b),
        );
      requireThat(
        from && to && from !== to,
        "Choose tokens in two different parks.",
      );
      const x = from.findIndex((t) => t.id === i.a),
        y = to.findIndex((t) => t.id === i.b),
        ta = from[x],
        tb = to[y];
      requireThat(
        !from.some((t, index) => index !== x && t.type === tb.type) &&
          !to.some((t, index) => index !== y && t.type === ta.type),
        "A park cannot hold matching tokens.",
      );
      [from[x], to[y]] = [to[y], from[x]];
      break;
    }
    case "takoyaki": {
      const x = p.captured.findIndex((t) => t.id === i.a),
        y = s.ties.findIndex((t) => t.id === i.b);
      requireThat(
        x >= 0 && y >= 0,
        "Choose one of your tokens and a tied token.",
      );
      [p.captured[x], s.ties[y]] = [s.ties[y], p.captured[x]];
      break;
    }
    case "taiyaki": {
      requireThat(
        p.hand.includes(i.a) && cellB?.kind === "water" && !B,
        "Choose a held tile and empty water.",
      );
      p.hand.splice(p.hand.indexOf(i.a), 1);
      s.board[i.b] = {
        tile: i.a,
        cell: i.b,
        owner: p.id,
        direction: 0,
        boat: true,
        ...(version>=4?{placementTurn:s.turnNumber,placementTerrain:"water"}:{}),
        ...(i.a==="copy"?{placedTurn:s.turnNumber}:{}),
      };
      s.placed++;
      break;
    }
    case "akkorokamui":
      requireThat(
        A && (tileById(A.tile).type === "boat" || A.boat) && !A.facedown,
        "Choose a face-up boat.",
      );
      A.facedown = true;
      break;
    case "green-tea":
      requireThat(
        A?.owner === p.id &&
          B &&
          !A.facedown &&
          !B.facedown &&
          types.includes(tileById(A.tile).type) &&
          tileById(A.tile).type === tileById(B.tile).type,
        "Choose your basic tile and another of the same type.",
      );
      s.board[i.a] = { ...B, cell: i.a };
      s.board[i.b] = { ...A, cell: i.b };
      break;
    case "rainy-day":
      requireThat(
        A &&
          !A.facedown &&
          types.includes(tileById(A.tile).type) &&
          tileById(A.tile).strength <= 2,
        "Choose a basic tile of strength 1 or 2.",
      );
      A.facedown = true;
      break;
    case "bicycle":
      requireThat(
        A &&
          cellA.kind === "land" &&
          cellB?.kind === "land" &&
          !B &&
          neighbors(cellA, cellB),
        "Choose a tile on land and empty adjacent land.",
      );
      s.board[i.b] = { ...A, cell: i.b, ...(version>=4&&A.owner===p.id?{placementTurn:s.turnNumber,placementTerrain:"land",adjustmentOrigin:i.a}:{}), ...(A.tile==="copy"&&A.owner===p.id?{placedTurn:s.turnNumber}:{}) };
      delete s.board[i.a];
      break;
    case "dango": {
      const t = tileById(i.a);
      requireThat(
        t && p.hand.includes(i.a) && t.strength <= 2,
        "Choose a held tile of strength 1 or 2.",
      );
      validatePlacement(s, p.id, i.a, i.b);
      requireThat(
        t.type !== "move" && t.type !== "copy",
        "Choose a strength tile.",
      );
      s.board[i.b] = { tile: i.a, cell: i.b, owner: p.id, direction: 0, ...(version>=4?{placementTurn:s.turnNumber,placementTerrain:t.type==="cover"?"cover":"land",...(t.type==="cover"?{covered:B}:{})}:{}) };
      p.hand.splice(p.hand.indexOf(i.a), 1);
      s.placed++;
      if (t.type === "draw" && p.deck.length) p.hand.push(p.deck.shift());
      break;
    }
    default:
      fail("Unknown ability.");
  }
}
export function revealsInformation(before, after, intent) {
  if (intent.type === "start") return "starting hands were dealt";
  if (
    before.players.some((p) => {
      const n = after.players.find((a) => a.id === p.id);
      return n && n.deck.length < p.deck.length;
    })
  )
    return "a new tile was drawn";
  if (after.phase === "finished" && before.phase !== "finished")
    return "captured celebrations were revealed";
  if (
    intent.type === "ability" &&
    abilityById(currentPlayer(before)?.ability)?.type === "takoyaki"
  )
    return "a captured token was revealed";
  return null;
}
export function replay(events) {
  let active = [],
    history = [],
    request = null,
    revision = 0,
    s = initial(),
    ids = new Set();
  for (const e of events) {
    requireThat(
      typeof e.id === "string" &&
        e.id.length > 0 &&
        !ids.has(e.id) &&
        typeof e.actor === "string" &&
        e.intent &&
        typeof e.intent.type === "string",
      "Invalid or duplicate event.",
    );
    ids.add(e.id);
    requireThat(
      [1, 2, 3, VERSION].includes(e.version) && e.sequence === revision + 1,
      "Unsupported or unordered event history.",
    );
    revision++;
    const i = e.intent;
    if (i.type === "undo" || i.type === "undo-request") {
      requireThat(!request, "An undo request is already pending.");
      const index = active.findIndex((a) => a.id === i.target);
      requireThat(index >= 0, "This undo target is no longer active.");
      const target = active[index],
        suffix = active.slice(index);
      requireThat(
        target.actor === e.actor &&
          ["place", "move", "reposition", "rotate-copy", "ability", "end"].includes(target.intent.type),
        "Undo your own gameplay choice.",
      );
      const barrier = suffix.find(
        (a) =>
          a.reveal ||
          a.actor !== e.actor ||
          a.intent.playerId !== target.intent.playerId,
      );
      if (!barrier) {
        requireThat(i.type === "undo", "This move can be undone directly.");
        active = active.slice(0, index);
        s = project(active);
      } else {
        requireThat(
          i.type === "undo-request",
          "Ask the other players before undoing revealed information.",
        );
        request = {
          id: e.id,
          target: i.target,
          actor: e.actor,
          playerId: target.intent.playerId || e.actor,
          required: s.players
            .map((p) => p.id)
            .filter((id) => id !== (target.intent.playerId || e.actor)),
          approved: [],
          reason: barrier.reveal || "another player acted",
        };
      }
      history.push({
        ...e,
        label: `${seatFor(s, e.actor, target.intent.playerId)?.name || "Player"} ${request ? "asked to undo" : "undid a choice"}`,
      });
    } else if (i.type === "undo-vote") {
      requireThat(
        request && request.id === i.request,
        "This undo request has expired.",
      );
      const voter = seatFor(s, e.actor, i.playerId);
      requireThat(
        voter &&
          request.required.includes(voter.id) &&
          !request.approved.includes(voter.id),
        "This player cannot vote again.",
      );
      if (!i.approve) request = null;
      else {
        request.approved.push(voter.id);
        if (request.required.every((id) => request.approved.includes(id))) {
          active = active.slice(
            0,
            active.findIndex((a) => a.id === request.target),
          );
          s = project(active);
          request = null;
        }
      }
      history.push({
        ...e,
        label: `${voter.name} ${i.approve ? "agreed to undo" : "declined undo"}`,
      });
    } else {
      requireThat(!request, "Wait for the undo decision.");
      const after = structuredClone(s);
      basic(after, e.actor, i, e.version);
      const reveal = revealsInformation(s, after, i);
      active.push({ ...e, reveal });
      const claims = i.type === "end" ? after.players.flatMap(p => {
        const previous = new Set(s.players.find(before => before.id === p.id).captured.map(t => t.id));
        const tokens = p.captured.filter(t => !previous.has(t.id)).map(({id, type}) => ({id, type}));
        return tokens.length ? [{playerId:p.id, tokens}] : [];
      }) : undefined;
      history.push({ ...e, reveal, label: describe(s, e), ...(claims ? {claims} : {}) });
      s = after;
    }
  }
  const state = s;
  state.revision = revision;
  state.history = history.map((e) => ({
    ...e,
    active: active.some((a) => a.id === e.id),
  }));
  state.undoRequest = request;
  state.activeEvents = active;
  return state;
}
function project(active) {
  const s = initial();
  for (const e of active) basic(s, e.actor, e.intent, e.version);
  return s;
}
export function validate(events, event) {
  return replay([...events, event]);
}
export function undoTarget(s, actor, playerId) {
  const id = playerId || actor;
  const target = [...(s.activeEvents || [])]
    .reverse()
    .find(
      (e) =>
        e.actor === actor &&
        (e.intent.playerId || actor) === id &&
        ["place", "move", "reposition", "rotate-copy", "ability", "end"].includes(e.intent.type),
    );
  if (!target) return null;
  const suffix = s.activeEvents.slice(s.activeEvents.indexOf(target));
  return {
    id: target.id,
    consent: suffix.some(
      (e) =>
        e.reveal || e.actor !== actor || (e.intent.playerId || e.actor) !== id,
    ),
    label: s.history.find((e) => e.id === target.id)?.label,
  };
}
export function describe(s, e) {
  const i = e.intent,
    name = seatFor(s, e.actor, i.playerId)?.name || i.name || "Host";
  switch (i.type) {
    case "create":
      return `${i.name} opened the table`;
    case "join":
      return `${i.name} took a seat`;
    case "add-computer":
      return "Host invited a computer opponent";
    case "computer-level":
      return `${name} computer level set to ${i.difficulty}`;
    case "configure":
      return "changed the table setup";
    case "start":
      return "dealt the opening hands";
    case "choose-ability":
      return `${name} chose an ability`;
    case "place":
      return `${name} placed ${tileById(i.tile)?.name}${tileById(i.tile)?.strength ? " " + tileById(i.tile).strength : ""}`;
    case "move":
      return `${name} moved a tile`;
    case "reposition":
      return `${name} adjusted ${tileById(s.board[i.source]?.tile)?.name} from ${i.source} to ${i.destination}`;
    case "rotate-copy":
      return `${name} pointed Copy ${["north","north-east","south-east","south","south-west","north-west"][i.direction]}`;
    case "ability":
      return `${name} used ${abilityById(currentPlayer(s)?.ability)?.name}`;
    case "end":
      return `${name} finished their turn`;
    default:
      return i.type;
  }
}

/** Pure single-choice projection, also used to isolate rules in unit tests. */
export function applyChoice(state, actor, intent) {
  const next = structuredClone(state);
  basic(next, actor, intent);
  return next;
}
