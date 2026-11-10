import { test } from "node:test";
import assert from "node:assert/strict";
import { readLaunch, launchChoice } from "../../src/game/launcher.js";
import { initial } from "../../src/game/engine.js";
test("Gameroom URL protocol validates names, codes, modes and return destinations", () => {
  const l = readLaunch(
    "?launch=create&table=BLOOMS&name=Alex&returnTo=https%3A%2F%2Fgameroom.boardgamescafe.org%2F",
  );
  assert.equal(l.name, "Alex");
  assert.ok(l.returnTo.startsWith("https:"));
  assert.equal(launchChoice(l, initial(), "a").type, "create");
  assert.equal(readLaunch("?returnTo=javascript:alert(1)").returnTo, null);
  for (const q of [
    "?launch=no",
    "?launch=create&table=x&name=A",
    "?launch=join&table=BLOOMS",
  ])
    assert.throws(() => readLaunch(q));
});
test("a guest arriving first waits rather than creates; existing controllers do not rejoin", () => {
  const l = readLaunch("?launch=join&table=BLOOMS&name=Bea");
  assert.equal(launchChoice(l, initial(), "b"), null);
  const s = {
    ...initial(),
    phase: "gathering",
    players: [{ controller: "a" }],
  };
  assert.equal(launchChoice(l, s, "b").type, "join");
  assert.equal(launchChoice(l, s, "a"), null);
});
test('tabletop launch URLs keep their table without requiring a player name',()=>{
 const launch=readLaunch('?launch=create&table=CORNER',{tabletop:true});
 assert.equal(launch.table,'CORNER');
 assert.equal(launch.name,'');
 assert.equal(launch.mode,'create');
});
