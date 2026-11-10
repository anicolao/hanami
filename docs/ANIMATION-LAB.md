# Local animation lab

Run `npm run dev:lab`, then open http://127.0.0.1:5191/dev/animations/ (`/lab/` is an alias). No Firebase or emulators are needed. The lab uses the shared raster components, board-cell renderer and logical map data, with local visual fixtures instead of multiplayer events. Fixtures are adapted to the production presentation-state shape and passed to the same `GameMotion.transition` method. The lab contains no flight planning, animation keyframes, hand markup or component sizing rules of its own.

## Board review

Choose Nihon/Tokyo, player count, surface and acting edge. **Artwork** switches between the original organic paintings with their grid erased and the original printed-grid versions. Calibration is saved independently for each map and artwork version.

**Board fit → Grid registration** provides horizontal/vertical scale and X/Y offsets, with sliders and numeric entry. Commit numbers with Enter or by leaving the field. Scale is anchored at the board center; offsets use original artwork pixels. Grid changes move hex centers, hit areas, pieces and the diagnostic overlay together. Printed tiles retain their regular hex proportion. **Use artwork grid** restores the reviewed center-fit calibration; the organic artwork is displayed directly and can still require local registration adjustment. **Reset grid registration** uses 100%/100%/0/0 without changing piece fit. The spacing readout reports column and row distances in artwork pixels.

**Grid rendering** enables an overlay traced from the actual rendered hit areas. **Cyan diagnostic** uses 0.4px hairlines without a halo. **Gameplay borders** exposes border and halo colors, widths, opacity and optional center crosses. Halo width is measured per side. **Hide tiles & celebrations** clears the board pieces for inspection; **Show cell coordinates** adds logical IDs. These drawing layers do not intercept clicks or drags.

The clean paintings are imagegen edits that erase only the printed grid from the original art. Their organic coasts are retained and are not clipped to a hex terrain mask. The lab overlay is independent and can be disabled. The rejected rigid-coast experiment is archived outside the active renderer; see `art/boards/README.md`.

**Hex & piece fit** controls cell width, piece scale and offsets, and celebration size. The reviewed piece fit is 90% pieces, 90% celebrations and −1% vertical offset. These tile offsets remain local to each hex; they do not reposition the grid. Fit, grid styling, travel time, speed and arc use the shared component settings in `src/components/visual-settings.js`. Changes persist by map and propagate immediately to other open game tabs on the same origin. Scene, zoom and diagnostic visibility remain lab controls. Preferences also persist in URL parameters. **Copy preset** and **Save preset** export the full settings and scene.

## Motion review

Select a tile and tap a highlighted hex, or drag it. Preview, pause, scrub, +100ms, speed, duration and arc controls inspect the motion. Replay restores and repeats the previous action; Undo motion reverses it.

Scenes cover placement, Move, Cover, directional Copy, capture, refill and boat flips. Move lands on the occupied hex first, then the displaced tile flies to the holding spot beside the hand. It waits for the player to select or drag to a destination. Preview advances one decision at a time. Phone mode pans the board in its frame; shared-table mode positions the hand at the selected physical edge.

All tiles use the same flat-top shape in the hand, holding spot and map. The lab and event-driven game both use `src/components/game-motion.js` to decide what moves and when, `player-area.js` for hands/holding/bags, and the shared timeline and pointer handler. The lab only retains the production timeline so its playback controls can pause, seek and reverse it. Flights use translation, uniform scale and whole-object rotation, including seat orientation. No hex morphing or independently upright art remains. Refill turns the complete object in perspective.

## Tile construction

The gallery's **Tile layers** section separates the actual component into backgrounds, illustration, colorable frame and printed ink. The frame owns the filled strength bump and gold dividers, and uses the player color. The plain CSS background is masked to the frame’s actual silhouette. New watercolor illustrations are transparent cutouts; the original opaque scene art is also available in the gallery. Each layer can be hidden independently in the assembly. See `art/printed-tiles/README.md`.

## Presentation parity tests

`presentation-parity.spec.js` opens a real two-client game and the lab side by side. It compares the actual placement/refill plans, checks the shared hand/bag dimensions, changes travel time once in the lab, and confirms the next real game animation uses that same plan. The full-game and special-tile stories continue to use authenticated events and real component interactions. TestStepHelper generates README walkthroughs, screenshots, DOM references and the published step viewer.
