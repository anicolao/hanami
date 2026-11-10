# Browser walkthrough contract

Run from the pinned Nix development shell:

```sh
nix develop --command npm ci
nix develop --command npx playwright install chromium
nix develop --command npm run check
nix develop --command npm run test:unit
nix develop --command npm run test:rules
nix develop --command npm run test:e2e
```

Auth and Firestore use demo-hanami on dedicated ports 9291 and 8191. These scripts never touch production or stop other projects' emulators. The game uses its real Firebase repository, not a local substitute. Each scenario opens independent browser contexts, joins through the product UI or the supported Gameroom invitation URL, then manipulates held pieces and board targets. No test inserts a game state, computed capture, outcome, winner or event. The fixed table codes are real launch inputs and give the same production seed derivation on every replay.

`TestStepHelper` waits for acknowledged subscriptions, fonts, every painting and paint readiness after each user action. It validates the accessible DOM, takes both actor and observer screenshots, attaches DOM evidence, and generates a `README.md` for each walkthrough, paired images, a step manifest and a [visual step viewer](../tests/e2e/index.html). The PR preview publishes the viewer at `/review/`. Even a tile selection is documented as its own step. Tests verify revision convergence and public board counts across clients while each client exposes only its own held tiles.

Celebration artwork uses square layout frames with contained images. Its native image dimensions never determine a park's flex layout, including when three different token images decode in a different order.

Before comparing a step, the helper requires three consecutive screenshots with identical decoded RGBA bytes. This is a bounded paint-readiness check, independent of the expected image. It never retries a baseline comparison: the settled frame is compared once, and any difference fails the test. Images use synchronous paint decoding and Chromium disables asynchronous checker imaging.

Raster URLs distinguish display-size families: parks with one, two or three tokens, private captures, public captures, victory markers, held tiles, placed tiles and draw bags. Board tokens use original image bytes. Tiny captured tokens use the existing 256px alpha-aware area reductions, with separate public/private cache identities; this avoids decode-cache-dependent sampling of multi-megapixel artwork. This prevents Chromium from reusing a resized decode from a different display size, which otherwise made cold and warm loads differ despite identical DOM geometry. A live two-client probe reproduced that difference, then recorded twelve identical captures across clients and reloads for both opening and placed-tile states after separating the cache entries.

Reference creation is explicit:

```sh
nix develop --command npm run test:e2e:update
```

Review the generated PNGs and `.dom.txt` files, then run the ordinary verification command separately. A normal run never changes references. It decodes PNGs and compares every RGBA byte, as well as the complete accessible DOM. `threshold: 0`, `maxDiffPixels: 0`, no content masking and no retries. Baselines are platform-specific; local Darwin evidence does not substitute for canonical Linux verification.

CI uses `mcr.microsoft.com/playwright:v1.65.0-noble` on Ubuntu 24.04. The explicitly applied `generate-baselines` PR label creates Linux review artifacts. Download and inspect those artifacts, commit the references, and remove the label before claiming verification. The next ordinary CI run compares references; generation is not verification.

Chromium uses sRGB and disables Skia's runtime CPU optimizations and partial rasterization. The container pins browser and OS libraries, while these switches keep image resampling on the same baseline code path across different CI runner CPUs. This changes rendering inputs, not the comparison: every output byte must still match.

The web story plays an actual-size game from join through victory, including both undo paths and a full reload at the finish. The shared-table story uses native touch, oriented local seats and a real private phone; unanimous consent is collected separately from every other seat. The invitation story verifies early guests, duplicate display names and reload idempotency.

The special-tile story uses the ordinary table-code input `M01565` for reproducible production deals. It joins through corner/color controls, enables specials, chooses actual dealt abilities and plays Draw, Move through its holding spot, Cover, boat flip and directional Copy. No deck, hand, event or board is inserted by the test. The tabletop story also resizes the display and verifies that hand pieces use spare height up to board-piece size, while revealing/folding screens preserves board geometry.

Every settled step also checks that celebration artwork has at least as many native source pixels as its displayed dimensions at the browser’s device-pixel ratio. Board celebration cutouts use their full-resolution originals; tiny captured tokens use fixed 256px area-filtered derivatives. Both use `object-fit: scale-down` and density-aware maximum sizes, with a dark alpha-following edge shadow. Flight layers start at the larger endpoint size and only scale down.

The practice story enters through the real Practice controls, plays a complete human/computer game, reloads during a computer turn, exercises direct and consented undo, and reloads the final result. The computer is the production policy, writing ordinary validated events. An independent Auth client observes the same board. Only the entrance's four-byte random invitation-code generation is stabilized for reproducible screenshots; no game state, deck, choice or result is injected. The second practice story adds a computer to a normal Tokyo gathering and has both players choose their actual dealt special abilities.

Shared mask URLs also include their actual layout dimensions and device-pixel ratio. A ResizeObserver updates these identities when tabletop hand sizes change; mutation tracking attaches the same behavior to game, lab and gallery components and excludes animated clones. This prevents a mask resize cached at one hand size from changing the rim sampling at another size.
