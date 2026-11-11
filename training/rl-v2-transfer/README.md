# Successor policy trained against the first RL model

This run creates a separate, 93-feature policy, initializes its first 49 weights from the frozen first RL model, and resets the optimizer. The opponent stays frozen at SHA256 `857a1cd6600c43046ad3219280bee200d1d6a7d00f9a1184657c01feba271899`. This is transfer learning, following three less successful runs from zero weights; it is not a claim that a scratch model surpassed its teacher.

Training ran for 8,192 real games using terminal-reward REINFORCE, Adam at .01, temperature .1 and top-four action sampling. The model selected at 6,144 training games achieved 147/256 selection wins (57.42%). The selected checkpoint was frozen while the independent training run completed; later training did not alter the evaluated model. Its canonical SHA256 is `35a66ad8cee2ec0ced1e31dfff5fa452c279cf9a4662f8ac052d87b63c875c96`.

The first fresh confirmation produced 4,270 wins, 3,392 losses, 208 draws and 322 unfinished games out of 8,192. Raw wins were 52.12%; the conservative paired-seed lower bound was 49.81%, so the planned win-majority confidence gate failed. That report and all event records remain as `confirmation-1.*`. The selected policy is unchanged.

A second, fresh comparison is testing the direct head-to-head advantage `(wins - losses - unfinished) / games`. A draw contributes zero advantage and remains a non-win in the raw win rate. An unfinished game is penalized as a loss. The pre-recorded second plan requires a strictly positive conservative advantage bound and at least 50% observed wins. This tests whether the model beats Medium more often than it loses, which is the relevant strength comparison; it does not claim a 60% win rate. The original, failed win-majority gate has not been reclassified as a pass.

The comparison balances Nihon/Tokyo, basic/special rules and both seats. Each seed is played twice with the learner swapping seats. Confidence uses seed pairs as independent units. The first scratch confirmation spent alpha .025; this transfer run has a total alpha budget .025 across all its confirmation attempts (`.025 / (attempt*(attempt+1))`). Thus the family of accepted strength tests has total false-acceptance budget at most .05. All failed attempts are retained.

The model scores each production-legal candidate action from the original 49 race/action/ability features, 31 interaction terms and 13 hand-resource features. The fixed influence prior is shared with the earlier model. No hidden opponent hand, bag order, opponent captured-token array or seed enters inference. Opponent capture counts are inferred from public supply and remaining pieces. Both ability identities and used flags reach the observation; only the learner's available ability is explicitly represented in the learned features. This is a small feature-based policy, not a neural network or a full opponent-power planner.

`selected-checkpoint.json` preserves the exact selection state, optimizer and frozen opponent. `environment.mjs` is the byte-identical environment used during training, archived before adding an optional exploration experiment. It imports the shared production policy and rules modules. The engine hash refers to the pre-difficulty-metadata engine; the added level field preserves the behavior of all recorded choices without a level. The audit command replays the events through the current engine.

From the repository root, audit the current report:

```sh
npm run audit:rl -- training/rl-v2-transfer/evaluation.json
```

For a new transfer run on current sources:

```sh
npm run train:rl -- --enhanced --initialize training/rl-v1/candidate.json --learning-rate .01 --temperature .1 --top-k 4 --episodes 8192 --out training/new-transfer --seed new-transfer --opponent training/rl-v1/candidate.json
npm run evaluate:rl -- --out training/new-transfer --best --metric advantage --target 0 --minimum-win-rate .5 --games 8192
```
