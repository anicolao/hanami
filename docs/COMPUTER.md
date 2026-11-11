# Computer levels

Choose **Practice → Computer level** before creating a table:

- **Easy** uses the original deterministic influence heuristic.
- **Medium** uses the first RL policy, trained against Easy.
- **Hard** uses a fresh policy trained against the frozen Medium model.

The chosen level is recorded in the create event, displayed beside the computer, and restored on reload. Old games without a level continue to use Easy. Normal invitations still add the original Easy computer. Medium and Hard are available in two-player practice; the engine rejects expanding those tables beyond two seats. Both boards and the special tiles/abilities are supported.

Every level acts through the same authenticated event queue and animation components as a person. All use the same redacted observations, without access to the opponent's hand, bag order, captured-token arrays or shuffle seed. Undo consent is shared across levels and is not learned behavior. Both players' ability identities and used flags are present in the observation; the current learned feature vectors explicitly encode the learner's own available ability, rather than the opponent's unused ability. Own bag contents and counts are also omitted by the current observation boundary.

## Models and training

[Hard's results and reproducible evidence](../training/rl-v2-transfer/README.md): 4,235 wins versus Medium's 3,407 in 8,192 fresh games, with 234 draws and 316 unfinished games. Its conservative advantage bound stays positive even when every unfinished game is assigned as a loss. The improvement is modest and is measured across both boards, both rulesets and both seats; it is not a guarantee for each stratum.

The inference models live in `src/game/models/medium.json` and `hard.json`. Their reports, frozen opponents, optimizer checkpoints and replayable evaluation events are under `training/`. `npm run export:rl` verifies confirmation success and model hashes before copying models into the app.

To start a fresh policy against Medium:

```sh
npm run train:rl -- --enhanced --episodes 8192 --out training/new-policy --seed new-policy --opponent training/rl-v1/candidate.json --temperature .15 --top-k 4
npm run evaluate:rl -- --out training/new-policy --best --metric advantage --target 0 --minimum-win-rate .5 --games 8192
npm run audit:rl -- training/new-policy/evaluation.json
```

Scratch experiments start from zero learned weights. The transfer experiment instead creates a new model from Medium's weights, adds initially zero weights for interaction and hand-resource features, and resets the optimizer. In both cases Medium stays frozen. The policies share handcrafted features and a fixed influence prior. The opponent is frozen, rather than updated during the run. Training and checkpoint selection games never contribute to confirmation. The stronger-than-Medium criterion is a conservative lower bound above zero for head-to-head advantage `(wins - losses - unfinished) / games`, plus at least 50% observed wins. Draws contribute zero advantage and remain non-wins in the raw win rate; unfinished games are treated as losses. This demonstrates an advantage against this opponent in two-player play; it is not a claim about optimal play or every individual matchup.

For transfer learning, add `--initialize training/rl-v1/candidate.json --learning-rate .01`.

To resume, use `--resume training/new-policy/checkpoint.json` with a higher total `--episodes` and the same `--out`. The checkpoint restores the frozen opponent, seed, optimizer and exploration settings. Replacing the opponent or seed during resumption is rejected.
