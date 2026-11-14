# Local animation lab

## Real-route layout workbench

Open http://127.0.0.1:5191/dev/animations/. Its default view loads the real `/` personal-game or `/tabletop/` route into an iframe. The child document runs `src/main.js` → `src/game/app.js` with the production CSS and components. The workbench contains no game-layout markup, and its control styles cannot enter the child document. Change layout rules in the production game renderer/styles; the same changes appear in this preview.

Presets cover iPad Air landscape (1180 × 820 CSS px), classic iPad landscape (1024 × 768), phone landscape (844 × 390), compact phone landscape (667 × 375) and desktop (1440 × 900). Width and height can also be entered directly. **Pieces → Tile scale (%)** exposes the shared per-board size override; **Reviewed size · 90%** restores the approved tile fit while preserving other calibration and timing settings. Both labs start from game settings on every load. Adjustments are in memory only: no local storage, session storage or generated URL settings. Legacy visual overrides in URLs are ignored. Scene/map/viewport links still select the requested review context. `npm run lab:check-reset` verifies reload behaviour against both labs and real game routes. **Fit preview** scales the outer frame for convenience while preserving the child's actual viewport and media queries; **100%** shows native CSS pixels. **Focus route** hides the surrounding controls and places the frame at the screen origin; press Escape or use the button below the frame to return. **Open this real route** opens the same room outside the workbench.

Personal play compares the usable board rectangles in both arrangements, using the active map’s aspect and piece size. It prefers a bottom hand; a right-hand mat is used only if it makes the board larger and leaves no more than one hex plus the ordinary gap unused vertically. Compact phones (667×375 and 568×320) and normal laptop/desktop landscapes use the bottom hand. Wide phones such as 844×390 and ultrawide displays retain a right-hand mat. Short bottom layouts reserve a compact 88px mat and fit the hand tiles into its available height. Hand pieces in the side layout use the same scale as the actual board hexes. The hamburger opens a sliding drawer containing the existing player-status and log elements; there is no second information renderer. Escape, the close control and the backdrop close it. Compact bottom layouts share that drawer when there is insufficient width for the status and log columns; wider bottom layouts keep them in the dock. Resizing to a spacious bottom layout closes the drawer. `npm run lab:check-layout` verifies these layouts, equal piece sizes, viewport fit and drawer behaviour against real local games.

Run the local Auth/Firestore emulators (9291/8191) and start Vite with `VITE_USE_FIREBASE_EMULATORS=true npm run dev:lab`. Sample-game preparation is disabled unless both development mode and the emulator flag are active. The controller uses the real repository and reducer to append create/join/start/place/end events; it never replaces rendered state. Opening and three-round positions leave Indigo on turn. Personal games have ordinary Easy computer opponents; tabletop games have local human seats, with their production privacy screens. Use the real controls inside the frame to reveal a screen, place pieces, draw, or play a turn.

`npm run lab:capture` captures iPad/phone landscape for both routes and desktop personal play. It also opens each room as a standalone production route at the same viewport, compares decoded RGBA pixels and accessible DOM with the iframe at 100%, and exports the viewport images and a README to `art/layout-baselines/`. These are current-layout review captures, not replacement full-game E2E references. Emulators are reused without clearing existing rooms.

## Isolated component-motion fixtures

Open http://127.0.0.1:5191/dev/animations/?view=components&scenario=place. This bench runs without Firebase. It shares the production raster components, board-cell renderer, map data, player-area renderer and `GameMotion` controller. Its fixture canvas is for inspecting components and motion, not for judging production page layouts. Existing links with `scenario=` continue to open this bench.

## Board review

Choose Nihon/Tokyo, player count, fixture canvas and acting edge. **Artwork** switches between the original organic paintings with their grid erased and the original printed-grid versions. Calibration can be adjusted independently for each map and artwork version during the current page visit; reloading restores game settings.

**Board fit → Grid registration** provides horizontal/vertical scale and X/Y offsets, with sliders and numeric entry. Commit numbers with Enter or by leaving the field. Scale is anchored at the board center; offsets use original artwork pixels. Grid changes move hex centers, hit areas, pieces and the diagnostic overlay together. Printed tiles retain their regular hex proportion. **Use artwork grid** restores the reviewed center-fit calibration; the organic artwork is displayed directly and can still require local registration adjustment. **Reset grid registration** uses 100%/100%/0/0 without changing piece fit. The spacing readout reports column and row distances in artwork pixels.

**Grid rendering** enables an overlay traced from the actual rendered hit areas. **Cyan diagnostic** uses 0.4px hairlines without a halo. **Gameplay borders** exposes border and halo colors, widths, opacity and optional center crosses. Halo width is measured per side. **Hide tiles & celebrations** clears the board pieces for inspection; **Show cell coordinates** adds logical IDs. These drawing layers do not intercept clicks or drags.

The clean paintings are imagegen edits that erase only the printed grid from the original art. Their organic coasts are retained and are not clipped to a hex terrain mask. The lab overlay is independent and can be disabled. The rejected rigid-coast experiment is archived outside the active renderer; see `art/boards/README.md`.

**Hex & piece fit** controls cell width, piece scale and offsets, and celebration size. The reviewed piece fit is 90% pieces, 90% celebrations and −1% vertical offset. These tile offsets remain local to each hex; they do not reposition the grid. Fit, grid styling, travel time, speed and arc use the shared component settings in `src/components/visual-settings.js`. Changes are temporary and propagate live to already-open game tabs on the same origin. Reloading a lab or game route starts again from game settings. Scene, zoom and diagnostic visibility remain temporary lab controls. No controls write preferences or append settings to the URL. **Copy preset** and **Save preset** export the full settings and scene.

## Motion review

Select a tile and tap a highlighted hex, or drag it. Preview, pause, scrub, +100ms, speed, duration and arc controls inspect the motion. Replay restores and repeats the previous action; Undo motion reverses it.

Dragging uses the shared pointer handler: the complete tile shrinks to the actual board-piece size as it enters the board and rises north of the finger. Its visible centre selects the target hex. A valid drop settles from that release pose in 160ms with no arc; only tap-to-place flies from the hand. Tiles placed or relocated this turn can be picked up again on the board and corrected before finishing the turn. These corrections are replayed choices, preserving tile counts, drawn information and special-tile effects. Hidden opponents use the shared board-piece dimensions for placement, holding and refill animations, with a board-edge origin while their info drawer is closed. `npm run lab:check-computer-size` observes real computer turns on both maps at phone and iPad sizes and checks the complete placement flight, landing and hidden refill targets. The release pose stays local to the gesture, while other clients continue their ordinary event animations. `npm run lab:check-drag` verifies mouse, real touch input and tabletop drops, event replication, undo and unchanged tap placement against the local emulator dev server.

Scenes cover placement, Move, Cover, directional Copy, capture, refill and boat flips. Move lands on the occupied hex first, then the displaced tile flies to the holding spot beside the hand. It waits for the player to select or drag to a destination. Preview advances one decision at a time. The fixture canvas can pan the board or change the acting edge. For actual device layouts use the real-route workbench above.

All tiles use the same flat-top shape in the hand, holding spot and map. The lab and event-driven game both use `src/components/game-motion.js` to decide what moves and when, `player-area.js` for hands/holding/bags, and the shared timeline and pointer handler. The lab only retains the production timeline so its playback controls can pause, seek and reverse it. Flights use translation, uniform scale and whole-object rotation, including seat orientation. No hex morphing or independently upright art remains. Refill turns the complete object in perspective.

## Tile construction

The gallery's **Tile layers** section separates the actual component into backgrounds, illustration, colorable frame and printed ink. The frame owns the filled strength bump and gold dividers, and uses the player color. The plain CSS background is masked to the frame’s actual silhouette. New watercolor illustrations are transparent cutouts; the original opaque scene art is also available in the gallery. Each layer can be hidden independently in the assembly. See `art/printed-tiles/README.md`.

## Presentation parity tests

`presentation-parity.spec.js` opens a real two-client game and the lab side by side. It compares the actual placement/refill plans, checks the shared hand/bag dimensions, changes travel time once in the lab, and confirms the next real game animation uses that same plan. The full-game and special-tile stories continue to use authenticated events and real component interactions. TestStepHelper generates README walkthroughs, screenshots, DOM references and the published step viewer.

### Ability cards

The gallery, power selection, player mats and used-card reverse all render
`abilityCardArt` from `src/components/ability-card.js`. Its square print layout,
art window and type sizes scale together; host layouts only choose the card size.
The gallery inspector shows that same card at a larger size.

Choose **Power selection** in the real-route lab to create a local game with
special powers enabled. This uses ordinary emulator events and the production
route, including tabletop seats. Phone portrait stacks the two square cards.
Phone presets open at 100% scale; use the surrounding lab's scroll area when the
viewport is larger than the space available. The walkthrough viewer likewise
shows phone screenshots at 1:1 and scrolls their panel instead of enlarging or
shrinking the screenshot.

Run `HANAMI_LAB_URL=http://127.0.0.1:5195 npm run lab:check-cards` against the
emulator dev server. It checks shared card faces on four production viewports,
eight tabletop choices, a real Torii action and its used reverse, and 1:1 phone
screenshots in the viewer.

Player mats use `layoutPlayerAreas` from `src/components/player-area-layout.js`
on both real routes and the component lab, before animation destinations are
measured. It preserves the hand's existing tile size and full five-tile capacity,
then fits the largest square ability card beside it. The draw pile matches the
face-up tiles where space allows; its high-contrast count stays at least 16px.
The checkmark confirms/ends the turn (the isolated refill scene uses a draw arrow).
Run `HANAMI_LAB_URL=http://127.0.0.1:5195 npm run lab:check-mat` to check seven
real-route sizes, all four tabletop seats, unchanged hand dimensions, control
separation, viewport fit, and actual Torii, placement, refill and capture events.

The route workbench disables its own Firestore network after authoring the scene,
before opening the production iframe. This releases the emulator HTTP channels;
unsubscribing alone can leave enough channels open to stall other lab tabs.
Connection and event-write waits time out with enabled retry controls. Run
`HANAMI_LAB_URL=http://127.0.0.1:5195 npm run lab:check-preparation` to keep eight
workbenches and their real game frames open, replicate placement and undo to a
ninth production client, close the original tab, regenerate scenes, and verify a
blocked write produces a bounded error followed by a successful retry.

Emulator clients use Firebase’s persistent multi-tab cache so tabs and iframes
share a listener connection instead of each occupying a long-lived HTTP/1
connection. The cache stores game events, not lab settings. This applies only to
emulator connections; the production transport is unchanged.
