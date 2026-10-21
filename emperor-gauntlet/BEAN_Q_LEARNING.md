# BEAN versus Emperor Gauntlet: reward-driven learning lab

Experimental opt-in game agent, not an unrelated toy MDP. BEAN's Q-learning policy calls the actual Emperor Gauntlet HTML physics engine through a small environment adapter. No agent changes apply to ordinary human play unless the page is opened with \`?bean=1\`.

## Launch

From a checkout of this branch at the repository root:

\`\`\`sh
python -m http.server 8000
\`\`\`

Open \`http://localhost:8000/emperor-gauntlet/play.html?bean=1\`.

Use **TRAIN 100**, **TRAIN 1,000**, **HELD-OUT TEST**, and **EXPORT ALL LEDGER**. The corner panel shows kills, observed Q-states and applied value updates. The agent controls movement, aim, attack, weapon selection and grenades in the actual arena.

## What learns

A tabular Q-learner maintains one learned action-value vector per encoded situation. The state encoder observes a target direction and range, temperature, health, stamina, available weapons and ammunition, nearby pickups, local enemy crowd, camp proximity and day/night. The action space includes approach, retreat, orbit, camping, weapon use, grenade, sprint and pickup. These are decisions, not fixed scripts.

For each decision: \`Q(s,a) = Q(s,a) + alpha * (r + gamma * max_legal Q(s',a') - Q(s,a))\`. Terminal transitions have no bootstrap term. Epsilon-greedy exploration decays during training. Actions that are not possible given owned gear/ammunition are masked.

Reward is measured from the game's **own** kill counter, wave progression, health and temperature, plus modest credit for gear acquisition and tactical movement. Yeti-eaten penguins are not counted; player-caused weapon and credited ice kills are. No fake kills are injected.

**Learning scope:** Q-table optimization is real parameter learning in this game-specific agent. It is *not* an update to BEAN's foundation-model weights, general reasoning intelligence, or autonomous coding skill. Further integration with BEAN's broader memory and bridge would be a separate tested step.

## Ledgers and repeatability

- Per-episode traces use a dictionary of encoded states plus compact transition tuples: state ID, action index, reward in thousandths, next state ID, done, game kills, HP and temperature. Every decision is retained, including unsuccessful ones.
- Browser training writes each episode into IndexedDB, and keeps a Q snapshot in localStorage. **EXPORT ALL LEDGER** exports the complete IndexedDB episode log plus current policy as JSON. Browser storage is not a GitHub backup; preserve exported data separately.
- Command-line benchmark: \`node emperor-gauntlet/bean-bench.cjs\`. It uses the original HTML script with fake DOM/rendering, so the physics, weapons, weather and scoring logic are identical to the browser game.
- CI retains the benchmark summary, complete JSONL episode decision traces, and Q-table snapshot as GitHub Actions artifacts. The exact game source commit is identified in each CI episode receipt.
- Training seeds and held-out seeds are disjoint. Held-out games are matched against random action selection on identical game seeds. No Q-value updates occur during held-out games.

## Proof standard

Success in CI establishes deterministic simulation, ledger capture, policy updates, and reproducible benchmarks. A higher mean kill count over a small held-out sample is **preliminary**, not proof of broadly superior play. Assess more seeds and compare confidence intervals; failures stay in the ledger.

The first 40-episode experiment (before subsequent reward changes) recorded:
- Best training run: 15 kills
- 12-seed holdout: Q-policy mean 6.50 versus random 5.83 kills
- 754 Q updates, 371 encountered state encodings

Initial benchmark run: https://github.com/danieloculus0-bot/FUN/actions/runs/39542797807

This document intentionally does not claim the 37-kill historical record has been beaten.
