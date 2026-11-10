# Printed tile layers

The active assembly is:

1. A plain CSS background, masked to the **mathematically regular hexagon shared with the frame** and inset beneath its soft edge. No independently drawn hex can protrude beyond the frame.
2. The new watercolor illustration as a **true transparent cutout**, generated from the assembled reference. Complete subjects are scaled to fit the illustration well rather than clipped scenic pictures. The gallery also offers the original scene artwork for comparison.
3. One player-colored structural frame containing the outer border, **filled strength bump**, and fixed gold inlay/dividers. There is no separate rim or strength-background layer.
4. Separate raster ink masks for strength/direction, player identity and action information.

All parts rotate and move as a single physical object. The player color applies to the frame and its strength bump; Ochre uses dark main ink for contrast.

`source/assembled-sakura-3.png` is the original imagegen design reference. `source/frame.png` provides the structural stencil. `cutouts/*.png` are imagegen background-extraction edits of the new art, with transparent empty space and opaque subjects. `cutout-prompts.json` records the exact edits.

Run `node scripts/prepare-printed-tiles.cjs` to prepare the frame and ink masks plus cutout display sizes. `separate-tile-frame.cjs` fills the existing strength aperture as part of the frame, replaces the irregular generated outer rim with a regular hexagon, and uses that same geometry for the background silhouette. `prepare-tile-cutouts.cjs` registers whole transparent subjects within the illustration aperture. Neither draws replacement illustration artwork.

The gallery's Tile layers view uses the actual component renderer, shows the isolated layers on checkerboards, and allows independent visibility, player, background color, illustration source, reverse and Copy-direction controls.
