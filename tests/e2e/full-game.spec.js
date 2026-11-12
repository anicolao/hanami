import { test, expect } from "@playwright/test";
import { TestStepHelper } from "./step-helper.js";
import {touchDrag} from "./physical-drag.js";
const main = (page) => page.locator("main");
const revision = async (page) =>
  Number(await main(page).getAttribute("data-revision"));
async function converged(a, b, after) {
  await expect.poll(() => revision(a)).toBeGreaterThan(after);
  await expect.poll(() => revision(b)).toBeGreaterThan(after);
  expect(await revision(a)).toBe(await revision(b));
  expect(
    await a.locator('[data-board-tile]:not([data-board-tile=""])').count(),
  ).toBe(
    await b.locator('[data-board-tile]:not([data-board-tile=""])').count(),
  );
}
test("Two friends join and play a complete event-driven Hanami game", async ({
  browser,
}, info) => {
  const ca = await browser.newContext({viewport:{width:844,height:390},hasTouch:true}),
    cb = await browser.newContext(),
    a = await ca.newPage(),
    b = await cb.newPage(),
    pages = { Alex: a, Bea: b };
  const story = new TestStepHelper(
    info,
    pages,
    "Two friends beneath the blossoms — complete game",
  );
  await b.goto("/?table=BLOOMS&name=Bea");
  await a.goto("/?launch=create&table=BLOOMS&name=Alex");
  await expect(a.locator("[data-phase]")).toHaveAttribute(
    "data-phase",
    "gathering",
  );
  await expect(b.locator("[data-phase]")).toHaveAttribute(
    "data-phase",
    "gathering",
  );
  await story.step(
    "Open an invitation from Gameroom",
    "Alex",
    async () => {},
    async () => {
      await expect(a.locator(".gathered li")).toHaveCount(1);
      await expect(
        b.getByRole("button", { name: "Take your seat", exact: true }),
      ).toBeVisible();
    },
  );
  let old = await revision(a);
  await story.step(
    "Take a seat in the gathering",
    "Bea",
    () =>
      b.getByRole("button", { name: "Take your seat", exact: true }).click(),
    async () => {
      await converged(a, b, old);
      await expect(a.locator(".gathered li")).toHaveCount(2);
    },
  );
  old = await revision(a);
  await story.step(
    "Unfold the board and deal real opening hands",
    "Alex",
    () =>
      a.getByRole("button", { name: "Unfold the board", exact: true }).click(),
    async () => {
      await converged(a, b, old);
      for (const [name, p] of Object.entries(pages)) {
        await expect(p.locator(".hand-tile")).toHaveCount(5);
        await expect(p.locator(".player-area")).toHaveAttribute(
          "aria-label",
          `${name}’s blanket`,
        );
        await expect(p.locator(".player-area")).toHaveCount(1);
        await expect(p.locator(".park-pieces .celebration-piece")).toHaveCount(
          21,
        );
      }
    },
  );
  await story.step('Open player information and the game log from the phone menu','Alex',()=>a.getByRole('button',{name:'Players and game log',exact:true}).tap(),async()=>{
    const drawer=a.getByRole('dialog',{name:'Players and game log',exact:true});await expect(drawer).toBeVisible();await expect(drawer.locator('.player-summary')).toHaveCount(2);await expect(drawer.locator('.event-history li').last()).toBeInViewport();
  });
  await story.step('Close the drawer to return to the board and vertical hand','Alex',()=>a.getByRole('dialog',{name:'Players and game log',exact:true}).getByRole('button',{name:'Close players and game log',exact:true}).tap(),async()=>{
    await expect(a.locator('#play-information')).toHaveAttribute('aria-hidden','true');const hand=await a.locator('.hand-tile .printed-tile').first().boundingBox(),hex=await a.locator('.board-cell').first().boundingBox();expect(hand.width/hex.width).toBeCloseTo(.9,2);
  });
  old = await revision(a);
  await story.step(
    "Activate the Torii card before placing a tile",
    "Alex",
    () =>
      a
        .getByRole("button", { name: "Use Torii · Indigo", exact: true })
        .click(),
    async () => {
      await expect(a.locator(".personal-ability")).toHaveClass(/selected/);
    },
  );
  const tokens = await a
    .locator(".park-pieces.count-1 [data-token]")
    .evaluateAll((nodes) => nodes.slice(0, 2).map((n) => n.dataset.token));
  await story.step(
    "Choose the first celebration to exchange",
    "Alex",
    () => a.locator(`[data-token="${tokens[0]}"]`).click(),
    async () => {
      await expect(a.locator(".action-hint")).toContainText("second target");
    },
  );
  await story.step(
    "Exchange it with a second park’s celebration",
    "Alex",
    () => a.locator(`[data-token="${tokens[1]}"]`).click(),
    async () => {
      await converged(a, b, old);
      await expect(a.locator(".personal-ability")).toContainText("used");
    },
  );
  let didDirectUndo = false,
    didConsent = false,
    turns = 0;
  while ((await main(a).getAttribute("data-phase")) === "playing") {
    expect(turns++).toBeLessThan(90);
    const name = await main(a).getAttribute("data-turn"),
      actor = pages[name];
    let chosen = false,
      chosenId;
    const held = await actor
      .locator(".hand-tile")
      .evaluateAll((nodes) =>
        nodes.map((n) => ({
          id: n.dataset.tile,
          label: n.getAttribute("aria-label"),
        })),
      );
    for (const tile of held) {
      await story.step(
        `Choose ${tile.label}`,
        name,
        () => actor.locator(`[data-tile="${tile.id}"]`).click(),
        async () => {
          await expect(
            actor.locator(`[data-tile="${tile.id}"]`),
          ).toHaveAttribute("aria-pressed", "true");
        },
      );
      if (await actor.locator("[data-cell][data-legal=true]").count()) {
        chosen = true;
        chosenId = tile.id;
        if (tile.id === "move") {
          const source = await actor
            .locator("[data-cell][data-legal=true]")
            .first()
            .getAttribute("data-cell");
          await story.step(
            "Pick up a non-fast tile to relocate",
            name,
            () => actor.locator(`[data-cell="${source}"]`).click(),
            async () => {
              await expect(actor.locator(".action-hint")).toContainText(
                "empty land",
              );
            },
          );
        }
        const target = await actor
          .locator("[data-cell][data-legal=true]")
          .first()
          .getAttribute("data-cell");
        old = await revision(actor);
        await story.step(
          `Place ${tile.label} at ${target}`,
          name,
          () => name==='Alex'&&!didDirectUndo?touchDrag(actor,actor.locator(`[data-tile="${tile.id}"]`),actor.locator(`[data-cell="${target}"]`)):actor.locator(`[data-cell="${target}"]`).click(),
          async () => {
            await converged(a, b, old);
            await expect(actor.locator(".hand")).not.toContainText("undefined");
          },
        );
        if(name==='Alex'&&!didDirectUndo){
          const handCount=await actor.locator('.hand-tile').count();let adjusted;
          old=await revision(actor);
          await story.step('Pick up the dropped tile and correct its destination','Alex',async()=>{
            adjusted=await touchDrag(actor,actor.locator(`[data-cell="${target}"]`),actor.locator('[data-cell][data-legal=true]').first());
          },async()=>{
            await converged(a,b,old);await expect(actor.locator(`[data-cell="${target}"]`)).toHaveAttribute('data-board-tile','');
            for(const page of [a,b])await expect(page.locator(`[data-cell="${adjusted}"]`)).toHaveAttribute('data-board-tile',tile.id);
            await expect(actor.locator('.hand-tile')).toHaveCount(handCount);expect(JSON.parse(await actor.locator('#app').getAttribute('data-motion-plan'))).toContainEqual(expect.objectContaining({source:'drag',duration:160,arc:0}));
          });
          old=await revision(actor);
          await story.step('Undo only the destination correction','Alex',()=>actor.getByRole('button',{name:'Undo last choice',exact:true}).tap(),async()=>{
            await converged(a,b,old);for(const page of [a,b])await expect(page.locator(`[data-cell="${target}"]`)).toHaveAttribute('data-board-tile',tile.id);await expect(actor.locator('.hand-tile')).toHaveCount(handCount);
          });
        }
        break;
      }
    }
    expect(chosen, "A real held tile has a legal component target").toBe(true);
    if (!didDirectUndo) {
      old = await revision(a);
      await story.step(
        "Undo the placement before any new information",
        "Alex",
        () =>
          a
            .getByRole("button", { name: "Undo last choice", exact: true })
            .click(),
        async () => {
          await converged(a, b, old);
          await expect(a.locator(".hand-tile")).toHaveCount(5);
          await expect(a.locator(".undo-consent")).toHaveCount(0);
        },
      );
      didDirectUndo = true;
      continue;
    }
    old = await revision(a);
    await story.step(
      "Draw from the bag and pass the turn",
      name,
      () =>
        actor
          .getByRole("button", {
            name: "Draw tiles and finish turn",
            exact: true,
          })
          .click(),
      async () => {
        await converged(a, b, old);
        await expect(actor.locator(".event-history li").last()).toContainText(
          "finished their turn",
        );
      },
    );
    if (
      !didConsent &&
      (await main(a).getAttribute("data-phase")) === "playing"
    ) {
      old = await revision(a);
      await story.step(
        "Ask to undo after seeing a new tile",
        name,
        () =>
          actor
            .getByRole("button", { name: "Request undo", exact: true })
            .click(),
        async () => {
          await converged(a, b, old);
          await expect(
            b.getByRole("region", { name: "Undo consent request" }),
          ).toBeVisible();
        },
      );
      const other = name === "Alex" ? "Bea" : "Alex";
      old = await revision(a);
      await story.step(
        "Agree to the information-revealing undo",
        other,
        () =>
          pages[other]
            .getByRole("button", {
              name: `${other} agrees to undo`,
              exact: true,
            })
            .click(),
        async () => {
          await converged(a, b, old);
          await expect(a.locator(".undo-consent")).toHaveCount(0);
          await expect(main(a)).toHaveAttribute("data-turn", name);
        },
      );
      old = await revision(a);
      await story.step(
        "Draw the same tile again and pass",
        name,
        () =>
          actor
            .getByRole("button", {
              name: "Draw tiles and finish turn",
              exact: true,
            })
            .click(),
        () => converged(a, b, old),
      );
      didConsent = true;
    }
  }
  await story.step(
    "Reveal the captured celebrations and celebrate the winner",
    "Both",
    async () => {},
    async () => {
      await expect(
        a.getByRole("region", { name: "Game result" }),
      ).toBeVisible();
      await expect(
        b.getByRole("region", { name: "Game result" }),
      ).toBeVisible();
      expect(await a.locator(".victory h1").innerText()).toBe(
        await b.locator(".victory h1").innerText(),
      );
      expect(await revision(a)).toBeGreaterThan(10);
      await expect(a.locator(".captured-reveal")).toHaveCount(2);
      const remaining = await a
        .locator(".park-pieces [data-token-type]")
        .evaluateAll((nodes) => nodes.map((n) => n.dataset.tokenType));
      expect(
        ["sakura", "chochin", "onigiri"].some(
          (type) => !remaining.includes(type),
        ) || (await a.locator(".tie-tray [data-token]").count()) >= 4,
      ).toBe(true);
    },
  );
  old = await revision(a);
  await story.step(
    "Reload and reconstruct the same victory from events",
    "Alex",
    () => a.reload(),
    async () => {
      await expect(main(a)).toHaveAttribute("data-phase", "finished");
      expect(await revision(a)).toBe(old);
      expect(await a.locator(".victory h1").innerText()).toBe(
        await b.locator(".victory h1").innerText(),
      );
    },
  );
  story.finish();
  await ca.close();
  await cb.close();
});
