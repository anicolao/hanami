# Hanami

A GPLv3 Japanese watercolor implementation of Hanami for two to four people. Play online with private screens or around a shared touch table. The component gallery is the repository's initial commit and remains at `/gallery/`.

- Web PvP: `/`
- Shared tabletop: `/tabletop/`
- Component and board gallery: `/gallery/`
- [Rules summary](RULES.md)
- [Architecture and neighboring implementation review](docs/ARCHITECTURE.md)
- [Executable browser walkthrough contract](docs/E2E.md)

## Play

Create a table and share its code. Friends take their seats; the host chooses Nihon or Tokyo, capacity, and whether to include special tiles and abilities. Advanced games deal two ability cards to each player, who keeps one.

Tap a held tile, then a highlighted space on the board. Move selects your old tile and its destination; Copy has a rotation control. Cover lands on your own existing tile. Tap the draw bag to resolve surrounded parks, refill your hand, and pass. Tap an ability card before placing tiles, then choose its targets directly among tiles, spaces or celebration pieces.

Your held tiles and gathered celebration identities appear only in your personal view. The shared tabletop keeps screens folded until a local player deliberately lifts one, with hands facing their physical edge. Phones join the same table through the regular web invitation. The final score reveals everyone's captured celebrations.

Undo restores the last choice immediately while no new information has been drawn. Undoing a draw or crossing another player's choice pauses play and asks every other seat for consent. History remains immutable; repeated draws produce the same tiles.

## Local development

```sh
nix develop --command npm ci
nix develop --command npm run dev
```

The ordinary dev server is http://127.0.0.1:5191. Firebase's public web configuration is committed; it is not an administrative credential. Production uses anonymous Auth and Firestore in `hanami-anicolao` and requires no game server.

Authentication providers are declared in `firebase.json`. Deploy them with `nix develop --command npx firebase deploy --only auth --project hanami-anicolao`; no console initialization is needed.

For a local emulator game, start the services and dev client in separate terminals:

```sh
nix develop --command npx firebase emulators:start --project demo-hanami --only auth,firestore
VITE_USE_FIREBASE_EMULATORS=true VITE_PREVIEW_ID=local nix develop --command npm run dev
```

`npm run check`, `npm run test:unit`, `npm run test:rules`, `npm run build` and `npm run test:e2e` provide validation. Run emulator-based commands through Nix so Java 21 is available. Tests use dedicated demo services on ports 8191 and 9291; browser tests start a separate Vite server on 5192.

## Events, hosting and integration

The versioned player-choice stream is the sole source of truth. Client replay derives board state, seeded setup/draws, captures, scores and winners. Firestore transactions append ordered events with expected revisions, immutable command receipts and retry IDs. There are no Cloud Functions or server-side game rules. Clients are trusted; private DOM projection is a UI privacy boundary, not an anti-cheating promise.

GitHub Pages retains PR N at `/hanami/prN/`, with its own Firestore scope. CI checks the core and produces reviewable browser evidence. Exact screenshot generation is explicit and separate from verification; see [E2E.md](docs/E2E.md).

Gameroom accepts `?launch=create|join&table=CODE&name=NAME` and an optional validated `returnTo` URL. Guests arriving first wait for the host. Reopening an invitation never adds a second seat. `/gameroom-launch.json` declares the URL protocol. `scripts/register-catalogue.cjs` adds only `Applications/hanami` to the existing LauncherUI database, with separate tabletop `URL`, integrated `WebURL`, and generated box cover. Until merge, these URLs point to the retained PR preview.

## Artwork and source fidelity

Generated raster artwork lives in `public/assets/watercolor/`, including the launcher box cover and generation briefs in `prompts.json`. Typography, influence dots and small status/direction symbols are markup. Fonts are bundled locally; tests do not fetch remote assets.

Original map/card photos remain ignored development inputs. Logical hex coordinates and park capacities are checked into the versioned map manifest, traced from the supplied board pictures. Each player count has exactly 7, 10 or 13 tokens of each type. Ability effects are transcribed from the supplied card photos. The watercolor paintings are not the authority for topology or rules.

The original game design belongs to Reiner Knizia and its publisher. This independent implementation's source and generated artwork are distributed under [GPL-3.0-only](LICENSE).
