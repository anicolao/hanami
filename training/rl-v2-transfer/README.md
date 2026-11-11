# Successor policy trained against the first RL model

This run creates a separate, 93-feature policy, initializes its first 49 weights from the frozen first RL model, and resets the optimizer. The opponent stays frozen at SHA256 `857a1cd6600c43046ad3219280bee200d1d6a7d00f9a1184657c01feba271899`. This is transfer learning, following three less successful runs from zero weights; it is not a claim that a scratch model surpassed its teacher.

Training ran for 8,192 real games using terminal-reward REINFORCE, Adam at .01, temperature .1 and top-four action sampling. The model selected at 6,144 training games achieved 147/256 selection wins (57.42%). The selected checkpoint was frozen while the independent training run completed; later training did not alter the evaluated model. Its canonical SHA256 is `35a66ad8cee2ec0ced1e31dfff5fa452c279cf9a4662f8ac052d87b63c875c96`.

The first fresh confirmation produced 4,270 wins, 3,392 losses, 208 draws and 322 unfinished games out of 8,192. Raw wins were 52.12%; the conservative paired-seed lower bound was 49.81%, so the planned win-majority confidence gate failed. That report and all event records remain as `confirmation-1.*`. The selected policy is unchanged.

The second fresh comparison **passed**: 4,235 wins (51.70%), 3,407 losses (41.59%), 234 draws (2.86%) and 316 unfinished games (3.86%), out of 8,192. It used the same frozen candidate, with no further training or weight selection. With every unfinished game assigned as a loss, the direct advantage `(wins - losses - unfinished) / games` was **6.25 percentage points**, with a conservative lower bound of **1.08 points** at alpha .0041667. The plan was recorded before the fresh comparison and also required at least 50% observed wins. Draws remain non-wins in the raw win rate. This establishes a modest overall advantage against Medium; it does not establish a 60% win rate or superiority in every board/seat stratum. `confirmation-2.json` and its compressed event archive contain the result and all actual choices.

The comparison balances Nihon/Tokyo, basic/special rules and both seats. Each seed is played twice with the learner swapping seats. Confidence uses seed pairs as independent units. The first scratch confirmation spent alpha .025; this transfer run has a total alpha budget .025 across all its confirmation attempts (`.025 / (attempt*(attempt+1))`). Thus the family of accepted strength tests has total false-acceptance budget at most .05. All failed attempts are retained.

The model scores each production-legal candidate action from the original 49 race/action/ability features, 31 interaction terms and 13 hand-resource features. The fixed influence prior is shared with the earlier model. No hidden opponent hand, bag order, opponent captured-token array or seed enters inference. Opponent capture counts are inferred from public supply and remaining pieces. Both ability identities and used flags reach the observation; only the learner's available ability is explicitly represented in the learned features. This is a small feature-based policy, not a neural network or a full opponent-power planner.

`selected-checkpoint.json` records the state when the candidate was frozen: `.best` is the evaluated candidate, while `.model` and optimizer moments belong to the latest training step at that time. The earlier best model's optimizer moments are not preserved separately. Resume the final `checkpoint.json` to continue its current model, or initialize from `candidate.json` with a fresh optimizer to refine the evaluated candidate. The frozen opponent is preserved in both checkpoints. `environment.mjs` is the byte-identical environment used during training, archived before adding an optional exploration experiment. It imports the shared production policy and rules modules. The engine hash refers to the pre-difficulty-metadata engine; the added level field preserves the behavior of all recorded choices without a level. The audit command replays the events through the current engine.

From the repository root, audit the current report:

```sh
npm run audit:rl -- training/rl-v2-transfer/evaluation.json
```

For a new transfer run on current sources:

```sh
npm run train:rl -- --enhanced --initialize training/rl-v1/candidate.json --learning-rate .01 --temperature .1 --top-k 4 --episodes 8192 --out training/new-transfer --seed new-transfer --opponent training/rl-v1/candidate.json
npm run evaluate:rl -- --out training/new-transfer --best --metric advantage --target 0 --minimum-win-rate .5 --games 8192
```

## Fresh comparison by setting

| Board | Rules | Learner first | Learner second |
| --- | --- | ---: | ---: |
| Nihon | Basic | 647/1024 (63.2%) | 481/1024 (47.0%) |
| Nihon | Special | 648/1024 (63.3%) | 492/1024 (48.0%) |
| Tokyo | Basic | 439/1024 (42.9%) | 437/1024 (42.7%) |
| Tokyo | Special | 610/1024 (59.6%) | 481/1024 (47.0%) |

Seat-dependent results include first-player advantage. Tokyo basic accounts for all 316 unfinished games; these remain in the denominator and are penalized as losses. The current policy has not been shown to outperform Medium in every individual stratum. All 8,192 event histories replay successfully through the current production rules.
