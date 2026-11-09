import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
async function stableFrame(page) {
  let previous, identical = 0;
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.decode()));
    });
    const frame = await page.screenshot({
      animations: "disabled", caret: "hide", scale: "css", fullPage: true,
    });
    const decoded = PNG.sync.read(frame);
    if (previous && decoded.width === previous.width && decoded.height === previous.height && decoded.data.equals(previous.data)) identical++;
    else identical = 0;
    if (identical === 2) return frame;
    previous = decoded;
    await page.waitForTimeout(150);
  }
  throw new Error("The rendered page did not settle to three identical frames.");
}
export class TestStepHelper {
  constructor(info, pages, title) {
    this.info = info;
    this.pages = pages;
    this.title = title;
    this.index = 0;
    this.steps = [];
  }
  async step(description, actor, action, check) {
    await test.step(description, async () => {
      await action();
      await check();
      const groups = new Map();
      for (const page of Object.values(this.pages)) {
        const label = page.locator(".table-label b");
        if (await label.count()) {
          const code = await label.innerText();
          groups.set(code, [...(groups.get(code) || []), page]);
        }
      }
      for (const sameTable of groups.values()) {
        await expect
          .poll(
            async () =>
              new Set(
                await Promise.all(
                  sameTable.map((page) =>
                    page.locator("main").getAttribute("data-revision"),
                  ),
                ),
              ).size,
          )
          .toBe(1);
      }
      const number = String(this.index++).padStart(3, "0"),
        entries = [];
      for (const [name, page] of Object.entries(this.pages)) {
        await expect(page.locator("[role=status]")).toHaveAttribute(
          "data-status",
          "synced",
        );
        await page.mouse.move(0, 0);
        await page.evaluate(async () => {
          await document.fonts.ready;
          const images = [...document.images];
          await Promise.all(images.map((i) => i.decode()));
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          );
        });
        const mapObscured = await page.evaluate(() => {
          const history = document.querySelector(".tabletop .history-rail");
          const board = document.querySelector(".tabletop .board-surface");
          if (!history || !board) return false;
          const a = history.getBoundingClientRect(),
            b = board.getBoundingClientRect();
          return (
            a.left < b.right &&
            a.right > b.left &&
            a.top < b.bottom &&
            a.bottom > b.top
          );
        });
        expect(
          mapObscured,
          "The activity log must stay outside the shared playing field",
        ).toBe(false);
        const dom = await page.locator("main").ariaSnapshot();
        expect(dom.length).toBeGreaterThan(100);
        await expect(page.locator("[role=status]")).not.toContainText(
          "Couldn’t",
        );
        const slug = `${number}-${name.toLowerCase()}`,
          file = `${slug}.png`,
          path = this.info.snapshotPath(file),
          actual = await stableFrame(page);
        if (this.info.config.updateSnapshots === "all") {
          mkdirSync(dirname(path), { recursive: true });
          writeFileSync(path, actual);
          writeFileSync(path.replace(".png", ".dom.txt"), dom + "\n");
        } else {
          expect(existsSync(path), `Missing reviewed screenshot ${path}`).toBe(
            true,
          );
          const a = PNG.sync.read(actual),
            b = PNG.sync.read(readFileSync(path));
          if (
            a.width !== b.width ||
            a.height !== b.height ||
            !a.data.equals(b.data)
          ) {
            await this.info.attach(`${slug}-actual`, {
              body: actual,
              contentType: "image/png",
            });
            expect(actual).toMatchSnapshot(file, {
              maxDiffPixels: 0,
              threshold: 0,
            });
            expect(
              a.data.equals(b.data),
              "Every decoded RGBA byte must match",
            ).toBe(true);
          }
          expect(dom + "\n").toBe(
            readFileSync(path.replace(".png", ".dom.txt"), "utf8"),
          );
        }
        await this.info.attach(`${slug}-dom`, {
          body: dom,
          contentType: "text/plain",
        });
        entries.push(
          `![${name}: ${description}](./screenshots/${this.info.titlePath.slice(-1)[0] === "unused" ? "" : this.info.file.split("/").at(-1) + "/"}${slug}-${process.platform}.png)\n\n[DOM evidence](./screenshots/${this.info.file.split("/").at(-1)}/${slug}-${process.platform}.dom.txt)`,
        );
      }
      this.steps.push(
        `## ${number}. ${actor}: ${description}\n\nDOM assertions passed; actor and all observers captured.\n\n${entries.join("\n\n")}`,
      );
    });
  }
  finish() {
    const path = join(
      dirname(this.info.file),
      `${this.info.title.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}-${process.platform}.md`,
    );
    const content = `# ${this.title}\n\nReal UI → authenticated Firestore transaction → immutable event → deterministic replay → every observer. Zero pixel tolerance; every decoded RGBA byte and the complete accessible DOM are compared. No game state injection or outcome fixtures.\n\n${this.steps.join("\n\n")}\n`;
    if (this.info.config.updateSnapshots === "all")
      writeFileSync(path, content);
  }
}
