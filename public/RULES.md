# Hanami — rule summary

Reiner Knizia / Keymaster Games. 2–4 players. Reference: [June 2026 rulebook listing](https://boardgamegeek.com/filepage/324134/hanami-rulebook-v1), [searchable rules](https://www.rulespal.com/hanami/rulebook).

## Components and setup

Two board faces: Nihon and Tokyo. Four screens; 88 tiles (22 per player); 39 celebration tokens (13 each: Sakura, Chochin, Onigiri); 12 abilities (four standard, eight special); three victory markers.

Use 7/10/13 tokens per type for 2/3/4 players; open middle / middle-and-left / all islands. Parks hold 1–3 tokens; multiple tokens must differ. Hide five tiles and captured tokens behind your screen. Keep the draw pile visible. Beginners omit three special tiles and use Torii.

## Turn

Optionally activate your once-per-game ability first. Place one tile and any fast tiles. Land takes non-boats; water takes boats; parks take tokens. Refill to five.

When a park's land neighbors fill, compare adjacent matching strength plus wild strength for each token. Highest wins; ties enter the four-slot ties area. Water needn't fill.

## Finish

End after a turn empties one token type or fills four tie slots. Unique majorities earn victory markers. Most markers wins. Break ties using other-category tokens, then total tokens; remaining ties share victory. If nobody earns a marker, compare totals.

## Implementation and artwork

The playable client and gallery share their watercolor components. Logical hex coordinates and park capacities come from the supplied board references. Token-supply tests check 21/30/39 total tokens and distinct types within multi-token parks. Ability effects are transcribed from the supplied card photographs.

Draw has 1 wild influence; Move is fast; Copy specifies one of six directions. End a turn by touching the draw bag. Undo before a new draw is immediate; undo after new information requires every other player's consent. These actions remain in the immutable player-choice history.
