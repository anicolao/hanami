# Hanami RL practice opponent

The frozen model won **751 / 1,024 held-out games (73.34%)** against the unchanged production `chooseComputerIntent` opponent after **4,096 training games**. There were 225 losses, 20 draws and 28 unfinished games. Draws and unfinished games count as non-wins in every reported win rate. This model is an offline artifact; the app still uses its existing computer opponent.

| Board | Rules | Learner first | Learner second |
| --- | --- | ---: | ---: |
| Nihon | Basic | 96/128 (75.0%) | 96/128 (75.0%) |
| Nihon | Special | 103/128 (80.5%) | 82/128 (64.1%) |
| Tokyo | Basic | 96/128 (75.0%) | 83/128 (64.8%) |
| Tokyo | Special | 104/128 (81.3%) | 91/128 (71.1%) |

All eight strata exceed 60% observed wins. This does not establish a 60% population lower bound for each stratum separately. For the combined benchmark, the conservative one-sided Hoeffding lower bound is **67.34%**, accounting for 512 independent seed pairs. The first confirmation uses alpha .025; subsequent attempts use `.05 / (attempt * (attempt + 1))` to bound total false acceptance probability by .05 across attempts. Only one confirmation was run. The original saved plan used the number of games instead of seed pairs in its bound; after the run, the report was corrected to the stricter paired bound. Both bounds pass. The original plan is retained for transparency. The report's ordinary Wilson interval is descriptive only because games within a seed pair are correlated.

## Training

This is residual linear REINFORCE, a small policy-gradient model with 49 learned weights, a fixed handcrafted influence prior, and greedy evaluation. It is not a neural network or self-play system. Training samples from the top 24 legal action scores at temperature .6, using terminal rewards (+1 sole win, 0 draw, -1 loss or unfinished), a leave-one-out reward baseline, batches of 64, gradient norm clipping at 5, and Adam at learning rate .04. Features describe category races, forecast park influence, public captures, action costs and abilities. These features/prior supply game knowledge; the weights were actually learned from game outcomes.

Each batch balances Nihon/Tokyo, basic/special rules and both seats. A separate fixed 256-game selection bank was evaluated every 512 training games. Untrained selection performance was 124/256 (48.44%); the final checkpoint achieved 191/256 (74.61%). Selection games supply no gradients. Confirmation used fresh UUID-prefixed seeds, generated and recorded after freezing the model. It supplied no gradients or model selection feedback.

Both policies receive only the production `computerObservation` view. No opponent hands, opponent captured-token arrays, deck contents/order, seed or event history enter the policy. In two-player games, opponent category counts can be deduced from the seven-token supply per category, public remaining tokens and ties, and the learner's own captures. The learner uses this public deduction. Candidate actions are validated by production `applyChoice`; Draw and Cover use the current fast-tile rules. The opponent is the existing policy without strategy changes; when assigned the first seat, only its observation's `computer` role flag is enabled to pass its controller guard.

All games start through real create/start choices. Special abilities are actually dealt and chosen. Victory comes from production rules. Evaluation replays every event history and verifies board/captures/winners against the simulated state. No state or outcome is injected. A match is unfinished if neither policy returns a choice or after 256 decisions; the 28 unfinished confirmation games were all on Tokyo basic (12 first-seat, 16 second-seat). They are retained, penalized, and never silently discarded.

## Reproduce and audit

From the repository root:

```sh
npm ci
npm run test:unit
npm run audit:rl
# Fresh training, independent of the checked-in result:
npm run train:rl -- --episodes 4096 --out training/reproduction --workers 8
npm run evaluate:rl -- --out training/reproduction --workers 8
# Continue a checkpoint to a higher total training count:
npm run train:rl -- --resume training/reproduction/checkpoint.json --episodes 8192 --out training/reproduction
```

Training is deterministic for a fixed seed and source; fresh confirmation intentionally chooses a new seed. Training and evaluation run in Node worker threads without Firebase or paid services. No deployment is required. The evaluator rejects changes to the frozen opponent, rules, feature code or environment since training.

`model.json` contains the trained weights plus result metadata; `candidate.json` is the exact frozen inference object used for the SHA256 in the plan/report. `checkpoint.json` includes optimizer state for resumption, and `history.json` contains every selection result. `confirmation-1-events.jsonl.gz` contains all 1,024 actual event walks, including draws and unfinished games. `npm run audit:rl` replays them, verifies the outcomes and aggregate metrics, and checks model/opponent hashes.

The original trainer mistakenly prevented confirmation whenever any selection game was unfinished. It completed all 4,096 training games without saving a best model, despite 74.61% selection wins. The standalone evaluator then froze that final checkpoint and performed the only confirmation. The trainer now counts unfinished games as non-wins without blocking checkpoint saving, and delegates independent confirmation to the evaluator. Thus the checkpoint's historical trainer hash differs from the current trainer; gradient updates and the policy/environment used to obtain this model are unchanged. This run started from commit `89924e5b5a735c5656789fedd78b2e054aad6e05`.
