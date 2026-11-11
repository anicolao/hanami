import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initial,
  replay,
  VERSION,
  cells,
  currentPlayer,
  availablePlacement,
  undoTarget,
  strength,
  scoreGame,
} from "../../src/game/engine.js";
import { boardCells } from "../../src/game/maps.js";
function table(specials = false, map = "nihon", count = 2) {
  const events = [];
  const add = (actor, intent) => {
    const e = {
      version: VERSION,
      sequence: events.length + 1,
      id: `choice-${events.length + 1}`,
      actor,
      intent,
    };
    replay([...events, e]);
    events.push(e);
    return replay(events);
  };
  add("a", { type: "create", name: "A", capacity: count, map, specials });
  for (let n = 1; n < count; n++)
    add(String.fromCharCode(97 + n), {
      type: "join",
      name: String.fromCharCode(65 + n),
    });
  add("a", { type: "start", seed: "BLOOMS" });
  return {
    events,
    add,
    get state() {
      return replay(events);
    },
  };
}
test("both production maps conserve exactly 7, 10 and 13 tokens per celebration", () => {
  for (const map of ["nihon", "tokyo"])
    for (const count of [2, 3, 4]) {
      const t = table(false, map, count),
        s = t.state;
      assert.equal(Object.values(s.tokens).flat().length, (count * 3 + 1) * 3);
      for (const type of ["sakura", "chochin", "onigiri"])
        assert.equal(
          Object.values(s.tokens)
            .flat()
            .filter((t) => t.type === type).length,
          count * 3 + 1,
        );
      assert.ok(boardCells(map, count).length > 40);
      for (const park of Object.values(s.tokens))
        assert.equal(new Set(park.map((t) => t.type)).size, park.length);
    }
});
test("seeded hands replay without persisting outcomes and reject turns, duplicate IDs and terrain violations", () => {
  const t = table(),
    s = t.state;
  assert.deepEqual(replay(t.events), s);
  assert.equal(s.players[0].hand.length, 5);
  assert.equal(s.players[0].deck.length, 14);
  assert.throws(() => t.add("b", { type: "end" }));
  assert.throws(() =>
    t.add("a", {
      type: "place",
      tile: s.players[0].hand[0],
      cell: cells(s).find((c) => c.kind === "park").id,
    }),
  );
  assert.throws(() => replay([{ ...t.events[0], version: 99 }]));
  assert.throws(() => replay([t.events[0], t.events[0]]));
  assert.ok(!JSON.stringify(t.events).includes("captured"));
});
test("complete actual-size games terminate, conserve every tile and produce replayable winners", () => {
  for (const map of ["nihon", "tokyo"])
    for (const count of [2, 3, 4]) {
      const t = table(false, map, count);
      let turns = 0;
      while (t.state.phase === "playing" && turns < 150) {
        let s = t.state,
          p = currentPlayer(s),
          choice = p.hand
            .flatMap((tile) =>
              cells(s)
                .filter((c) => availablePlacement(s, p.id, tile, c.id))
                .map((c) => ({ tile, cell: c.id })),
            )
            .find((i) => i.tile !== "move");
        if (choice) t.add(p.controller, { type: "place", ...choice });
        else if (p.hand.includes("move")) {
          const source = Object.values(s.board).find(
            (v) =>
              v.owner === p.id &&
              ![
                "boat-1",
                "boat-2",
                "boat-3",
                "cat-0",
                "cat-1",
                "move",
              ].includes(v.tile),
          );
          const destination = cells(s).find(
            (c) => c.kind === "land" && !s.board[c.id],
          );
          if (source && destination)
            t.add(p.controller, {
              type: "move",
              source: source.cell,
              destination: destination.id,
            });
          else break;
        } else if (p.hand.length) break;
        t.add(p.controller, { type: "end" });
        turns++;
      }
      const s = t.state;
      assert.equal(s.phase, "finished", `${map}/${count} ended after ${turns}`);
      assert.ok(s.winners.length);
      for (const player of s.players) {
        const claims=s.history.flatMap(e=>(e.claims||[]).filter(c=>c.playerId===player.id).flatMap(c=>c.tokens));
        assert.deepEqual(claims.map(t=>t.id).sort(),player.captured.map(t=>t.id).sort());
        assert.ok(claims.every(t=>["sakura","chochin","onigiri"].includes(t.type)));
      }
      assert.ok(s.history.filter(e=>e.intent.type==="end").every(e=>Array.isArray(e.claims)));
      for (const p of s.players)
        assert.equal(
          p.hand.length +
            p.deck.length +
            Object.values(s.board).filter((v) => v.owner === p.id).length,
          19,
        );
      assert.equal(
        Object.values(s.tokens).flat().length +
          s.players.reduce((n, p) => n + p.captured.length, 0) +
          s.ties.length,
        (count * 3 + 1) * 3,
      );
    }
});
test("direct undo before draw; unanimous consent after draw; immutable event history and stable repeat draws", () => {
  const t = table();
  let s = t.state,
    p = currentPlayer(s);
  const tile = p.hand.find(
    (tile) =>
      tile !== "move" &&
      cells(s).some((c) => availablePlacement(s, p.id, tile, c.id)),
  );
  const cell = cells(s).find((c) => availablePlacement(s, p.id, tile, c.id)).id;
  t.add("a", { type: "place", tile, cell });
  const target = undoTarget(t.state, "a");
  assert.equal(target.consent, false);
  t.add("a", { type: "undo", target: target.id });
  assert.equal(t.state.board[cell], undefined);
  t.add("a", { type: "place", tile, cell });
  t.add("a", { type: "end" });
  const afterDraw = t.state.players[0].hand;
  const originalEnd=t.state.history.at(-1);
  const undo = undoTarget(t.state, "a");
  assert.equal(undo.consent, true);
  assert.throws(() => t.add("a", { type: "undo", target: undo.id }));
  t.add("a", { type: "undo-request", target: undo.id });
  assert.throws(() => t.add("b", { type: "end" }));
  assert.throws(() =>
    t.add("a", {
      type: "undo-vote",
      request: t.state.undoRequest.id,
      approve: true,
    }),
  );
  t.add("b", {
    type: "undo-vote",
    request: t.state.undoRequest.id,
    approve: true,
  });
  assert.equal(t.state.turn, 0);
  const undone=t.state.history.find(e=>e.id===originalEnd.id);
  assert.equal(undone.active,false);
  assert.deepEqual(undone.claims,originalEnd.claims);
  t.add("a", { type: "end" });
  assert.deepEqual(t.state.history.at(-1).claims,originalEnd.claims);
  assert.deepEqual(t.state.players[0].hand, afterDraw);
  assert.ok(t.state.history.length > t.state.activeEvents.length);
});
test("a declined undo keeps the drawn state; stale and duplicate votes fail", () => {
  const t = table(),
    s = t.state,
    p = currentPlayer(s),
    tile = p.hand.find((t) => t !== "move"),
    cell = cells(s).find((c) => availablePlacement(s, p.id, tile, c.id)).id;
  t.add("a", { type: "place", tile, cell });
  t.add("a", { type: "end" });
  t.add("a", { type: "undo-request", target: undoTarget(t.state, "a").id });
  const id = t.state.undoRequest.id;
  t.add("b", { type: "undo-vote", request: id, approve: false });
  assert.equal(t.state.turn, 1);
  assert.equal(t.state.undoRequest, null);
  assert.throws(() =>
    t.add("b", { type: "undo-vote", request: id, approve: true }),
  );
});
test("wild strength, inactive tiles and majority/tie scoring", () => {
  const s = initial();
  assert.equal(strength(s, { tile: "draw", cell: "x" }, "sakura"), 1);
  assert.equal(strength(s, { tile: "cover", cell: "x" }, "chochin"), 3);
  assert.equal(strength(s, { tile: "sakura-4", cell: "x" }, "onigiri"), 0);
  assert.equal(
    strength(s, { tile: "sakura-4", cell: "x", facedown: true }, "sakura"),
    0,
  );
  s.players = [
    {
      id: "a",
      captured: [{ type: "sakura" }, { type: "sakura" }, { type: "onigiri" }],
    },
    {
      id: "b",
      captured: [
        { type: "chochin" },
        { type: "chochin" },
        { type: "onigiri" },
        { type: "onigiri" },
      ],
    },
  ];
  scoreGame(s);
  assert.deepEqual(s.winners, ["b"]);
  assert.equal(s.awards.sakura, "a");
});
test("tabletop controllers author choices for their seats, but cannot impersonate phone seats", () => {
  let events = [];
  const add = (actor, intent) => {
    events.push({
      version: 1,
      sequence: events.length + 1,
      id: `e${events.length}`,
      actor,
      intent,
    });
    return replay(events);
  };
  add("table", { type: "create", mode: "tabletop", name: "South" });
  add("table", { type: "join", name: "North", edge: "north" });
  add("phone", { type: "join", name: "Friend", edge: "west" });
  let s = add("table", { type: "start", seed: "table" });
  assert.equal(s.players[0].id, "table:south");
  assert.throws(() => add("table", { type: "end", playerId: "phone" }));
});
