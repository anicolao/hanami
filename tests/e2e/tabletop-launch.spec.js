import { test, expect } from "@playwright/test";
import { TestStepHelper } from "./step-helper.js";
const rev = async (p) =>
  Number(await p.locator("main").getAttribute("data-revision"));
test("Tabletop touch seats, private phone and unanimous undo", async ({
  browser,
}, info) => {
  const tableContext = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      hasTouch: true,
    }),
    phoneContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
  const table = await tableContext.newPage(),
    phone = await phoneContext.newPage(),
    story = new TestStepHelper(
      info,
      { Table: table, Phone: phone },
      "A shared table and a private phone",
    );
  await phone.goto("/?table=PICNIC&name=River");
  await table.goto("/tabletop/?launch=create&table=PICNIC&name=South");
  await expect(table.locator("main")).toHaveAttribute(
    "data-phase",
    "gathering",
  );
  await expect(phone.locator("main")).toHaveAttribute(
    "data-phase",
    "gathering",
  );
  await story.step(
    "Open a shared tabletop from its launch URL",
    "Table",
    async () => {},
    async () => {
      await expect(table.locator(".gathered li")).toHaveCount(1);
    },
  );
  await story.step(
    "Name a player at the north edge",
    "Table",
    () => table.locator("#local-seat input[name=name]").fill("North"),
    async () => {
      await expect(table.locator("#local-seat input")).toHaveValue("North");
    },
  );
  await story.step(
    "Seat the north player by touch",
    "Table",
    () =>
      table.getByRole("button", { name: "Add a player at this edge" }).tap(),
    async () => {
      await expect(table.locator(".gathered li")).toHaveCount(2);
      await expect(phone.locator(".gathered li")).toHaveCount(2);
    },
  );
  await story.step(
    "Join a private phone to the same table",
    "Phone",
    () =>
      phone.getByRole("button", { name: "Take your seat", exact: true }).tap(),
    async () => {
      await expect(table.locator(".gathered li")).toHaveCount(3);
    },
  );
  await story.step(
    "Unfold the board for three real players",
    "Table",
    () => table.getByRole("button", { name: "Unfold the board" }).tap(),
    async () => {
      await expect(table.locator("main")).toHaveAttribute(
        "data-phase",
        "playing",
      );
      await expect(phone.locator(".hand-tile")).toHaveCount(5);
      await expect(table.locator(".hand-tile")).toHaveCount(0);
      await expect(table.locator(".privacy-screen")).toHaveCount(3);
      await expect(
        table.locator(".park-pieces .celebration-piece"),
      ).toHaveCount(30);
    },
  );
  await story.step(
    "Lift the south privacy screen",
    "Table",
    () => table.getByRole("button", { name: "Reveal South’s tiles" }).tap(),
    async () => {
      await expect(table.locator(".hand-tile")).toHaveCount(5);
      await expect(phone.locator(".player-area")).toHaveCount(1);
    },
  );
  const tile = await table
    .locator(".hand-tile:not([data-tile=move])")
    .first()
    .getAttribute("data-tile");
  await story.step(
    "Touch a held watercolor tile",
    "Table",
    () => table.locator(`[data-tile="${tile}"]`).tap(),
    async () => {
      await expect(table.locator(`[data-tile="${tile}"]`)).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    },
  );
  const cell = await table
      .locator("[data-cell][data-legal=true]")
      .first()
      .getAttribute("data-cell"),
    old = await rev(table);
  await story.step(
    "Place it on the shared playing field",
    "Table",
    () => table.locator(`[data-cell="${cell}"]`).tap(),
    async () => {
      await expect.poll(() => rev(table)).toBeGreaterThan(old);
      await expect.poll(() => rev(phone)).toBeGreaterThan(old);
      await expect(phone.locator(`[data-cell="${cell}"]`)).toHaveAttribute(
        "data-owner",
        "South",
      );
    },
  );
  await story.step(
    "Draw and pass to the north edge",
    "Table",
    () =>
      table.getByRole("button", { name: "Draw tiles and finish turn" }).tap(),
    async () => {
      await expect(table.locator("main")).toHaveAttribute("data-turn", "North");
    },
  );
  await story.step(
    "Request undo after the south draw",
    "Table",
    () => table.getByRole("button", { name: "Request undo" }).tap(),
    async () => {
      await expect(
        phone.getByRole("button", { name: "River agrees to undo" }),
      ).toBeVisible();
      await expect(
        table.getByRole("button", { name: "North agrees to undo" }),
      ).toBeVisible();
    },
  );
  await story.step(
    "North agrees independently on the tabletop",
    "Table",
    () => table.getByRole("button", { name: "North agrees to undo" }).tap(),
    async () => {
      await expect(table.locator(".undo-consent")).toContainText(
        "North · agreed",
      );
      await expect(table.locator("main")).toHaveAttribute("data-turn", "North");
    },
  );
  await story.step(
    "The phone player supplies the final consent",
    "Phone",
    () => phone.getByRole("button", { name: "River agrees to undo" }).tap(),
    async () => {
      await expect(table.locator(".undo-consent")).toHaveCount(0);
      await expect(table.locator("main")).toHaveAttribute("data-turn", "South");
    },
  );
  await story.step(
    "Fold the shared hand away again",
    "Table",
    () => table.getByRole("button", { name: "Hide South’s tiles" }).tap(),
    async () => {
      await expect(table.locator(".hand-tile")).toHaveCount(0);
    },
  );
  story.finish();
  await tableContext.close();
  await phoneContext.close();
});
test("Gameroom guests wait for their creator and reload never seats duplicates", async ({
  browser,
}, info) => {
  const ca = await browser.newContext(),
    cb = await browser.newContext(),
    a = await ca.newPage(),
    b = await cb.newPage(),
    story = new TestStepHelper(
      info,
      { Host: a, Guest: b },
      "A guest arriving before the host",
    );
  await a.goto("/");
  await b.goto("/?launch=join&table=EARLYHN&name=Friend");
  await expect(b.locator("[role=status]")).toHaveAttribute(
    "data-status",
    "synced",
  );
  await story.step(
    "Follow a join URL before the creator arrives",
    "Guest",
    async () => {},
    async () => {
      await expect(b.locator("main")).toHaveAttribute("data-phase", "empty");
      await expect(b.locator(".waiting")).toContainText("Waiting for the host");
    },
  );
  await story.step(
    "Open the intended host URL",
    "Host",
    () => a.goto("/?launch=create&table=EARLYHN&name=Friend"),
    async () => {
      await expect(a.locator(".gathered li")).toHaveCount(2);
      await expect(b.locator(".gathered li")).toHaveCount(2);
    },
  );
  const old = await rev(b);
  await story.step(
    "Reload the same invitation without another join",
    "Guest",
    () => b.reload(),
    async () => {
      await expect(b.locator(".gathered li")).toHaveCount(2);
      expect(await rev(b)).toBe(old);
    },
  );
  story.finish();
  await ca.close();
  await cb.close();
});
