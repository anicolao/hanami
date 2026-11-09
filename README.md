# Hanami component atelier

Local art and component review before implementing game logic.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5191 (also available at `/gallery/`).

- `npm run check` checks JavaScript syntax.
- `npm run build` creates the production bundle.
- `RULES.md` contains the rule summary and source links.
- `src/catalog.js` holds the review inventory, `src/art.js` the reusable raster piece renderers, and `src/board.js` the two provisional map studies.

Review player finishes, tile fronts/backs, celebration tokens and victory markers, folding screens, abilities, and watercolor maps. Click components for inspection; press Escape or click outside to close.

All component graphics are generated watercolor PNG assets, saved in `public/assets/watercolor/`. The supplied Nihon and Tokyo PNGs are retained unchanged in the project root as development inputs. Tile influence dots and small identity/status symbols are live overlays. Google Fonts have system serif/sans fallbacks. No game engine or copied commercial art is included. Source gaps are disclosed in the interface and rules; verified map coordinates, tile collation are still needed before gameplay implementation.

Ability effects are transcribed from the supplied `specials.webp` and `torii cards.webp` photos. Card art is independently generated. See `public/assets/watercolor/prompts.json` for the generation brief and subjects.
