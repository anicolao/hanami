# Training against the frozen first RL model

All experiments preserve the first model as the opponent. Model selection uses balanced, separate 256-game banks. Selection rates are not held-out strength claims.

| Run | Initialization / training | Retained games | Best selection wins | Disposition |
| --- | --- | ---: | ---: | --- |
| `rl-v2` | Zero weights, original 49 features, temperature .6/top 24 | 8,192 | 51.95% | Not selected |
| `rl-v2-low-exploration` | Zero weights, 49 features, .15/top 4 | 8,192 | 56.64% | Frozen checkpoint won 50.05% on fresh 4,096 games; confidence gate failed |
| `rl-v2-enhanced` | Zero weights, 93 features, .15/top 4 | 4,608 | 49.22% | Stopped; no confirmation |
| `rl-v2-rollout` | Teacher weights + zero interaction/resource weights, .15/top 8, paired single-choice exploration | 1,536 | 42.97% | Stopped; no confirmation |
| `rl-v2-transfer` | Teacher weights + zero interaction/resource weights, .1/top 4, fresh optimizer at .01 | 8,192 | 57.42% | Selected model at 6,144; see its report |

Stopped runs retain their last completed checkpoint. Some in-flight games after that checkpoint may have finished before interruption; they are not claimed in the retained count. Single-choice exploration counts both the exploratory match and its real, greedy counterfactual baseline match as training games. Other experiments count one actual match per episode. History rows report the most recent training batch, not aggregate metrics over every training game.

The scratch and transfer experiments share a fixed handcrafted influence prior; “zero weights” refers to the learned residual, not absence of game knowledge. Transfer copies learned weights into a separate policy and preserves the original opponent unchanged. No model-selection or confirmation game supplies a gradient. Draws and unfinished games remain in every raw win-rate denominator. All reported victories come from real rule-engine choices; no board, hand or result is injected.
