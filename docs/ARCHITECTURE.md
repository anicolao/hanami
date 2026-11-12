# Hanami implementation contract

The initial main commit is the reviewed watercolor gallery. Play is developed on a PR.

## Neighbor review

- Istanbul: protocol/reducer/repository separation, information-aware append-only undo, a shared board with private phone views, and documented browser steps.
- RoboRally: versioned choices, Firestore subscriptions and public/private selectors; no game server. Its Safari transport workaround avoids buffered fetch streams.
- Cribbage: atomic expected-revision writes, retained command IDs and acknowledgement records, URL launches (`table`, `launch=create|join`, `name`), independent anonymous identities and delayed guests that never silently become hosts.
- Gameroom: games deploy independently; launches are intended participation, not verified results. The room remains open in its own tab. The Applications adapter uses `WebURL` and explicit `GameroomEnabled=integrated`.
- ttlauncher: its `URL` opens the tabletop surface directly; the catalog entry is a targeted additive write, preserving unrelated documents. No launcher code changes are required.

## Protocol

Only versioned player choices are canonical: create, join, configure, start, place, use ability, end turn, request undo, vote and immediate undo. A seeded PRNG derives setup and each player's draw order; boards and component manifests are versioned. Never persist scores, hands, shuffled decks, captures or winners. Deterministic replay derives them. Both surfaces consume exactly the same reducer and artwork.

Event protocol 2 corrects Draw and Cover to fast tiles. Protocol 3 adds Copy direction adjustments; protocol 4 adds this-turn placement corrections. Replay accepts protocols 1–4 and applies each recorded choice under its original rules. New choices use protocol 4; pending commands retain their original version across retries. This keeps historical Draw/Cover moves replayable without rewriting events.

Firestore orders immutable events under `previews/{scope}/tables/{code}/events/{sequence}`. A transaction checks the revision and an idempotency receipt before appending. Metadata contains only revision, owner and authorized controllers. Trusted clients validate game semantics; security rules enforce authenticated attribution and immutable ordered writes, not game rules. No Cloud Functions, server game logic, or alternate local multiplayer path.

An undo restores a suffix without deleting it. A choice revealing no new hidden information can be undone directly by its author. A suffix containing a new draw, deal, or other player's subsequent choice requires unanimous consent from seated opponents. A pending request pauses further play; rejection resumes it. Draw order remains stable after undo, so repeating a draw never rerolls it. Tabletop profiles vote individually on the shared surface.

## Presentation and evidence

Tap a held tile, then a board space; on touch the same controls work. Special effects ask for targets on the board, not a modal. Click the draw pile to finish/refill a turn. Ability cards are direct controls. Player hands and captured counts appear only in that player's view; the shared board never serializes private tile identities in its DOM. A shared tabletop supports private phone seats plus explicit reveal shutters for same-device play, oriented to each edge.

E2E uses real Auth and Firestore emulators, independent contexts, real UI input and production-size maps/decks. Every user step captures the actor and affected observers, checks semantic DOM and replay revision, and writes a walkthrough. No injected game states, synthetic result events or test-only gameplay shortcuts. Baseline generation is explicit; separate verification compares every decoded RGBA byte with zero tolerance, no masks or retries. Local Darwin and canonical Linux references are kept separate.

## Known source fidelity

Watercolor maps are paintings interpreted from the supplied PNGs. Logical hexes and park capacities are explicitly enumerated from those sources; generation is never the rules authority. Original reference pictures remain local development inputs. Gallery stays at `/gallery/`; `/` is web PvP and `/tabletop/` is the shared table.

Personal play uses the production renderer at every lab viewport. Wide aspect ratios place a board-sized vertical hand to the right and move player information/logs into a drawer; taller displays use the bottom dock. The route lab embeds actual invitation routes, without page-layout replacements. Live visual experiments use an in-memory broadcast to open presenters and reset to source-controlled game settings on reload; no lab settings are saved in browser storage or generated URLs.

A protocol-4 `reposition` event corrects a tile placed or relocated this turn without consuming another tile, drawing again or repeating an ability. Its original terrain and Bicycle adjacency constraints remain enforced. Cover restores its old underlying stack and covers an owned destination; Move’s replacement marker stays anchored. The normal undo/consent rules apply to undoing correction events. Drag release poses are local presentation data, not persisted game outcomes: the author sees a short settle while other clients animate the replayed board change.
