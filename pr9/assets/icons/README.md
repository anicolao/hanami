# Tile badge atlas

Current design: [`tile-badges-v2.png`](tile-badges-v2.png), documented in [DESIGN-v2.md](DESIGN-v2.md). The circular atlas below is the superseded first attempt.

Generated with the built-in image generation tool. `tile-badges.png` is a 4-column × 3-row transparent raster atlas. Rows contain strength 1–4; fast, direction, special, victory; and the four player marks. The original watercolor illustrations remain unchanged.

The shared renderer uses image badges with accessible labels. Numeric strength replaces tiny pip counting. All badges have an opaque, high-contrast backing; their dimensions scale with the tile.

## Generation prompt

Use case: ui-mockup.
Asset type: ONE production game UI icon sprite atlas, a square PNG with actual transparent background, 4 columns by 3 rows, exactly 12 equally sized square cells. This is one integrated reusable atlas, not a presentation or mockup. No captions, guides, grid lines, watermark, or decorative background.
Primary request: exceptionally sharp, immediately legible high-contrast tile badges for a board game. These will appear only 10–24 pixels wide, so strong silhouettes, large heavy glyphs, very simple shapes, broad strokes, immaculate edges, absolutely no watercolor texture, gradients, gloss, fine details, or shadows.
Composition: each cell contains one centered circular badge of the SAME size occupying 92% of its cell, transparent outside. All circles align on an exact uniform grid. Opaque warm white fill and thick near-black outer ring. Symbols near-black except the player badges specified below. Symbols occupy 75% of circle interior.
ROW 1, left to right: a huge bold sans-serif numeral "1"; numeral "2"; numeral "3"; numeral "4". Each single numeral perfectly clear and heavy.
ROW 2, left to right: one bold angular lightning bolt (FAST); one thick straight arrow pointing UP with a large triangular arrowhead (DIRECTION); one solid four-point sparkle (SPECIAL); one simple solid five-point star (VICTORY).
ROW 3, left to right: dark indigo circle with two bold white parallel wave strokes; dark vermilion circle with one bold white U-shaped cup; dark ochre circle with one bold white ring; dark pine green circle with one bold white four-point star. Player circles have a thick warm-white outer border plus thin near-black outline. Player shapes must remain clearly distinct in monochrome.
No other marks or text. Flat frontal orthographic graphic symbols, precise and optically balanced. Crisp professional wayfinding/signage design. Deliver transparent PNG atlas.
