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

Draw and Cover are fast tiles, alongside Move. Draw has 1 wild influence; Copy specifies one of six directions. Fast placements do not consume the normal placement and may be played before or after it. Move relocates only non-fast tiles. End a turn by touching the draw bag. Undo before a new draw is immediate; undo after new information requires every other player's consent. These actions remain in the immutable player-choice history.

Event protocol 2 corrects Draw/Cover fast status. Protocol 1 choices retain their historical placement and Move validation during replay; new choices use the corrected rules. Existing immutable game histories remain readable.

Copy may choose a new direction when relocated by Move. While it is held, use Rotate (or R during a drag). After placing or relocating your Copy, tap it to adjust its direction until you finish that turn. Rotation does not consume another tile or placement. An older Copy cannot be turned without first relocating it. These orientation adjustments are recorded as choices and can be undone.

Event protocol 3 adds Copy orientation adjustments. Protocols 1 and 2 remain readable, with their original Move directions preserved.

Cover remains stacked above the tile it covered. Tap a covered hex to inspect its tiles from top to bottom. The top tile supplies the influence; inspecting does not make a game choice or change the turn.

Until finishing the turn, a player can pick up a tile they placed or relocated this turn and correct its position on a legal hex. This consumes no extra tile or placement and repeats no Draw or ability effect. Cover must remain over an owned tile; moving it restores its previous underlying stack. Bicycle corrections stay adjacent to the original space. Move’s replacement marker stays anchored; the relocated tile can be corrected. Older, covered, opponent and face-down tiles cannot be freely adjusted. Corrections are immutable, undoable protocol-4 choices; protocols 1–3 retain their original replay behaviour.
