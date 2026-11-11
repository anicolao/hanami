import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initial,
  replay,
  applyChoice,
  canRotateCopy,
  cells,
  strength,
} from "../../src/game/engine.js";
import { neighbors } from "../../src/game/maps.js";
import { canonicalJson, sameCommand } from "../../src/game/canonical.js";
function fixture(ability) {
  let s = initial();
  s = applyChoice(s, "a", {
    type: "create",
    name: "Alex",
    capacity: 2,
    specials: true,
  });
  s = applyChoice(s, "b", { type: "join", name: "Bea" });
  s = applyChoice(s, "a", { type: "start", seed: "ability-tests" });
  s.phase = "playing";
  s.players[0].ability = ability;
  s.players[1].ability = "torii-1";
  s.players[0].deck = [];
  s.players[0].hand = ["draw", "cover", "copy", "sakura-3", "move"];
  return s;
}
function placed(s, cell, tile = "sakura-2", owner = "a") {
  s.board[cell.id] = { cell: cell.id, tile, owner, direction: 0 };
}
test("all eight specials and Torii execute their source-card effects", () => {
  for (const ability of ["torii-0", "fruit-sandwich"]) {
    let s = fixture(ability),
      parks = Object.entries(s.tokens).filter(([, t]) => t.length === 1),
      a = parks[0][1][0],
      b = parks[1][1][0];
    const n = applyChoice(s, "a", { type: "ability", a: a.id, b: b.id });
    assert.equal(n.tokens[parks[0][0]][0].id, b.id);
    assert.equal(n.players[0].usedAbility, true);
    assert.throws(() =>
      applyChoice(n, "a", { type: "ability", a: b.id, b: a.id }),
    );
  }
  {
    let s = fixture("takoyaki");
    s.players[0].captured = [{ id: "mine", type: "sakura" }];
    s.ties = [{ id: "tied", type: "chochin" }];
    let n = applyChoice(s, "a", { type: "ability", a: "mine", b: "tied" });
    assert.equal(n.players[0].captured[0].id, "tied");
    assert.equal(n.ties[0].id, "mine");
  }
  {
    let s = fixture("taiyaki"),
      water = cells(s).find((c) => c.kind === "water");
    let n = applyChoice(s, "a", {
      type: "ability",
      a: "sakura-3",
      b: water.id,
    });
    assert.equal(n.board[water.id].boat, true);
    assert.equal(strength(n, n.board[water.id], "onigiri"), 3);
    assert.equal(n.normalUsed, false);
  }
  {
    let s = fixture("akkorokamui"),
      water = cells(s).find((c) => c.kind === "water");
    placed(s, water, "boat-2", "b");
    let n = applyChoice(s, "a", { type: "ability", a: water.id });
    assert.equal(n.board[water.id].facedown, true);
    assert.equal(strength(n, n.board[water.id], "chochin"), 0);
  }
  {
    let s = fixture("green-tea"),
      land = cells(s).filter((c) => c.kind === "land");
    placed(s, land[0]);
    placed(s, land[1], "sakura-4", "b");
    let n = applyChoice(s, "a", {
      type: "ability",
      a: land[0].id,
      b: land[1].id,
    });
    assert.equal(n.board[land[0].id].owner, "b");
    assert.equal(n.board[land[1].id].owner, "a");
  }
  {
    let s = fixture("rainy-day"),
      land = cells(s).find((c) => c.kind === "land");
    placed(s, land);
    let n = applyChoice(s, "a", { type: "ability", a: land.id });
    assert.equal(n.board[land.id].facedown, true);
  }
  {
    let s = fixture("bicycle"),
      land = cells(s).filter((c) => c.kind === "land"),
      a = land.find((c) => land.some((n) => neighbors(c, n))),
      b = land.find((n) => neighbors(a, n));
    placed(s, a, "sakura-3", "b");
    let n = applyChoice(s, "a", { type: "ability", a: a.id, b: b.id });
    assert.equal(n.board[a.id], undefined);
    assert.equal(n.board[b.id].owner, "b");
  }
  {
    let s = fixture("dango"),
      land = cells(s).find((c) => c.kind === "land");
    s.players[0].hand = ["sakura-2"];
    let n = applyChoice(s, "a", { type: "ability", a: "sakura-2", b: land.id });
    assert.equal(n.normalUsed, false);
    assert.equal(n.board[land.id].tile, "sakura-2");
  }
});
test("Draw is one wild influence and reveals its draw; Cover preserves the buried tile; Move is fast", () => {
  let s = fixture("torii-0"),
    land = cells(s).filter((c) => c.kind === "land");
  s.players[0].deck = ["cat-4"];
  let n = applyChoice(s, "a", {
    type: "place",
    tile: "draw",
    cell: land[0].id,
  });
  assert.ok(n.players[0].hand.includes("cat-4"));
  assert.equal(strength(n, n.board[land[0].id], "onigiri"), 1);
  s = fixture("torii-0");
  placed(s, land[0], "sakura-4");
  n = applyChoice(s, "a", { type: "place", tile: "cover", cell: land[0].id });
  assert.equal(n.board[land[0].id].covered.tile, "sakura-4");
  assert.equal(strength(n, n.board[land[0].id], "chochin"), 3);
  s = fixture("torii-0");
  placed(s, land[0]);
  s.normalUsed = true;
  n = applyChoice(s, "a", {
    type: "move",
    source: land[0].id,
    destination: land[1].id,
  });
  assert.equal(n.board[land[0].id].tile, "move");
  assert.equal(n.board[land[1].id].tile, "sakura-2");
  assert.equal(n.normalUsed, true);
});
test("Copy direction uses the pointed-at adjacent tile and copy cycles never recurse forever", () => {
  let s = fixture("torii-0"),
    land = cells(s).filter((c) => c.kind === "land"),
    a = land.find((c) => land.some((n) => n.q === c.q && n.r === c.r - 1)),
    b = land.find((n) => n.q === a.q && n.r === a.r - 1);
  placed(s, a, "copy");
  placed(s, b, "sakura-4", "b");
  assert.equal(strength(s, s.board[a.id], "sakura"), 4);
  assert.equal(strength(s, s.board[a.id], "chochin"), 0);
  s.board[b.id] = { tile: "copy", cell: b.id, owner: "b", direction: 3 };
  assert.equal(strength(s, s.board[a.id], "sakura"), 0);
});
test("special abilities are selected from two deterministic dealt choices", () => {
  let s = initial();
  s = applyChoice(s, "a", { type: "create", name: "A", specials: true });
  s = applyChoice(s, "b", { type: "join", name: "B" });
  s = applyChoice(s, "a", { type: "start", seed: "choice" });
  assert.equal(s.phase, "choosing");
  assert.equal(s.players[0].abilityOptions.length, 2);
  assert.throws(() =>
    applyChoice(s, "a", { type: "choose-ability", ability: "torii-0" }),
  );
  s = applyChoice(s, "a", {
    type: "choose-ability",
    ability: s.players[0].abilityOptions[0],
  });
  assert.equal(s.phase, "choosing");
  s = applyChoice(s, "b", {
    type: "choose-ability",
    ability: s.players[1].abilityOptions[0],
  });
  assert.equal(s.phase, "playing");
});
test("idempotency compares intent meaning rather than Firestore map ordering", () => {
  const saved={actor:'a',version:1,intent:{type:'place',tile:'draw',cell:'1:2'}};
  const pending={intent:{cell:'1:2',tile:'draw',type:'place'}};
  assert.equal(sameCommand(saved,'a',pending),true);
  assert.equal(sameCommand(saved,'a',{...pending,version:2}),false);
  assert.equal(sameCommand({...saved,version:2},'a',{...pending,version:2}),true);
  assert.equal(sameCommand(saved,'b',pending),false);
  assert.equal(sameCommand(saved,'a',{intent:{type:'end'}}),false);
  assert.equal(
    canonicalJson({ type: "place", tile: "draw", cell: "1:2" }),
    canonicalJson({ cell: "1:2", tile: "draw", type: "place" }),
  );
  assert.notEqual(
    canonicalJson({ type: "end" }),
    canonicalJson({ type: "start" }),
  );
  assert.throws(() =>
    replay([
      {
        version: 1,
        sequence: 1,
        id: "x",
        actor: "a",
        intent: { type: "create", name: "A" },
      },
      {
        version: 1,
        sequence: 2,
        id: "x",
        actor: "b",
        intent: { type: "join", name: "B" },
      },
    ]),
  );
});

test("a phone receives the free edge even when tabletop seats joined out of order", () => {
  let s = applyChoice(initial(), "table", {
    type: "create",
    mode: "tabletop",
    name: "South",
  });
  s = applyChoice(s, "table", { type: "join", name: "North", edge: "north" });
  s = applyChoice(s, "table", { type: "join", name: "East", edge: "east" });
  s = applyChoice(s, "phone", { type: "join", name: "West" });
  assert.deepEqual(
    s.players.map((p) => p.edge),
    ["south", "north", "east", "west"],
  );
  assert.equal(new Set(s.players.map((p) => p.id)).size, 4);
});

test('Draw and Cover are fast before or after a normal placement and cannot be moved', () => {
  for (const tile of ['draw','cover']) for (const normalFirst of [false,true]) {
    let s=fixture('torii-0');
    const land=cells(s).filter(c=>c.kind==='land');
    placed(s,land[0],'sakura-2');
    s.players[0].deck=['chochin-2'];
    s.players[0].hand.push('onigiri-4');
    if(normalFirst)s=applyChoice(s,'a',{type:'place',tile:'sakura-3',cell:land[1].id});
    const target=tile==='cover'?land[0].id:land[2].id;
    s=applyChoice(s,'a',{type:'place',tile,cell:target});
    assert.equal(s.normalUsed,normalFirst,`${tile} must preserve the normal-placement allowance`);
    if(tile==='draw')assert.ok(s.players[0].hand.includes('chochin-2'));
    if(tile==='cover')assert.equal(s.board[target].covered.tile,'sakura-2');
    assert.equal(strength(s,s.board[target],'onigiri'),tile==='draw'?1:3);
    if(!normalFirst)s=applyChoice(s,'a',{type:'place',tile:'sakura-3',cell:land[1].id});
    assert.throws(()=>applyChoice(s,'a',{type:'place',tile:'onigiri-4',cell:land[3].id}),/normal tile/);
    assert.throws(()=>applyChoice(s,'a',{type:'move',source:target,destination:land[4].id}),/non-fast/);
  }
});

test('version 1 Draw/Move histories replay faithfully while new choices use fast Draw rules',()=>{
  const events=[];
  const add=(actor,intent,version=1)=>{
    const event={actor,intent,version,id:`legacy-${events.length}`,sequence:events.length+1};
    const state=replay([...events,event]);events.push(event);return state;
  };
  add('a',{type:'create',name:'Alex',specials:true,capacity:2});
  add('b',{type:'join',name:'Bea'});
  let s=add('a',{type:'start',seed:'M01565:v1:3'});
  for(const p of s.players)s=add(p.controller,{type:'choose-ability',ability:p.abilityOptions[0]});
  assert.ok(s.players[0].hand.includes('draw')&&s.players[0].hand.includes('move'));
  const land=cells(s).filter(c=>c.kind==='land');
  s=add('a',{type:'place',tile:'draw',cell:land[0].id});
  assert.equal(s.normalUsed,true,'historical Draw consumed the normal placement');
  const prefix=[...events];
  s=add('a',{type:'move',source:land[0].id,destination:land[1].id});
  assert.equal(s.board[land[1].id].tile,'draw');
  const undone=replay([...events,{actor:'a',intent:{type:'undo',target:events.at(-1).id},version:2,id:'undo-legacy-move',sequence:events.length+1}]);
  assert.equal(undone.board[land[0].id].tile,'draw');
  assert.equal(undone.normalUsed,true,'undo reprojects historical Draw with its original rules');
  assert.throws(()=>replay([...prefix,{...events.at(-1),version:2}]),/non-fast/);
  const corrected=[...prefix.slice(0,-1),{...prefix.at(-1),version:2}];
  assert.equal(replay(corrected).normalUsed,false,'new Draw choices preserve the normal placement');
});

test('newly placed Copy can turn without spending another placement; older and covered tiles cannot',()=>{
 let s=fixture('torii-0');const land=cells(s).filter(c=>c.kind==='land');
 const cell=land[0].id;
 s=applyChoice(s,'a',{type:'place',tile:'copy',cell,direction:0});
 assert.equal(canRotateCopy(s,'a',cell),true);
 const hand=[...s.players[0].hand],placed=s.placed;
 for(let direction=1;direction<6;direction++){
  s=applyChoice(s,'a',{type:'rotate-copy',cell,direction});
  assert.equal(s.board[cell].direction,direction);assert.equal(s.placed,placed);assert.equal(s.normalUsed,true);assert.deepEqual(s.players[0].hand,hand);
 }
 for(const direction of [-1,6,1.5,'2'])assert.throws(()=>applyChoice(s,'a',{type:'rotate-copy',cell,direction}),/direction/);
 assert.throws(()=>applyChoice(s,'b',{type:'rotate-copy',cell,direction:0}),/turn/);
 const covered=applyChoice(s,'a',{type:'place',tile:'cover',cell});
 assert.equal(canRotateCopy(covered,'a',cell),false);
 s=applyChoice(s,'a',{type:'end'});assert.equal(canRotateCopy(s,'a',cell),false);
 s.turn=0;s.turnNumber++;assert.throws(()=>applyChoice(s,'a',{type:'rotate-copy',cell,direction:0}),/this turn/);
});
test('Move may give an old Copy a new direction, which remains adjustable this turn',()=>{
 let s=fixture('torii-0');const land=cells(s).filter(c=>c.kind==='land'),source=land[0].id,destination=land[1].id;
 s.players[0].hand=['move','sakura-3'];s.board[source]={tile:'copy',owner:'a',cell:source,direction:5,placedTurn:0};
 assert.equal(canRotateCopy(s,'a',source),false);
 const unchanged=applyChoice(s,'a',{type:'move',source,destination});assert.equal(unchanged.board[destination].direction,5);
 s=applyChoice(s,'a',{type:'move',source,destination,direction:2});
 assert.equal(s.board[destination].direction,2);assert.equal(s.board[source].tile,'move');assert.equal(s.normalUsed,false);assert.equal(canRotateCopy(s,'a',destination),true);
 s=applyChoice(s,'a',{type:'rotate-copy',cell:destination,direction:3});assert.equal(s.board[destination].direction,3);
 s=applyChoice(s,'a',{type:'place',tile:'sakura-3',cell:land[2].id});assert.equal(canRotateCopy(s,'a',destination),true);
});
test('own Copy relocated by Bicycle or placed with Taiyaki is adjustable until turn end',()=>{
 for(const ability of ['bicycle','taiyaki']){
  let s=fixture(ability);const land=cells(s).filter(c=>c.kind==='land');
  let destination;
  if(ability==='bicycle'){
   const a=land.find(a=>land.some(b=>neighbors(a,b))),b=land.find(b=>neighbors(a,b));
   s.board[a.id]={tile:'copy',owner:'a',cell:a.id,direction:2};destination=b.id;
   s=applyChoice(s,'a',{type:'ability',a:a.id,b:b.id});
  }else{destination=cells(s).find(c=>c.kind==='water').id;s=applyChoice(s,'a',{type:'ability',a:'copy',b:destination});}
  assert.equal(canRotateCopy(s,'a',destination),true);
  s=applyChoice(s,'a',{type:'rotate-copy',cell:destination,direction:4});assert.equal(s.board[destination].direction,4);
 }
});
