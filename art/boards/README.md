# Organic board artwork

The active boards are imagegen edits of the original generated paintings in `previous/`. The edit removes only the painted hex grid while preserving the organic coastlines, islands, gardens, decorations and composition. Generated results are kept in `clean/`; production images are `public/assets/boards/nihon-organic.png` and `tokyo-organic.png`.

`src/board-painting.js` displays each painting directly. There is no terrain mask, coastline clipping, geometric land fill, or built-in grid in that component. The animation lab can draw its adjustable grid independently, or hide it entirely. Its Artwork selector compares the clean painting with the original printed-grid version. Both retain their registration controls and calibration presets.

Run `node scripts/prepare-board-art.mjs` to normalize export dimensions without changing the coastline shapes. The active imagegen prompts are in `prompts.json`.

The land/water plate and terrain-mask experiment in `plates/` and `guides/` was rejected because it made the coastlines too rigid. Those studies are retained as provenance but are not served by the active board renderer.
