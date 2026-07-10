# The Brain (§3) — prediction engine

**Status: BUILT & verified.** `@usual/brain` — pure TypeScript, zero UI imports,
fully deterministic and replay-testable. This is moat #1: the per-user habit
model that turns "log your food" into "the usual? — one tap."

Run the walk-through: `npm run brain:demo`
```
▸ Habitual lunch, on the menu
  🔔 NUDGE (confident)  "The usual? chicken & rice (220g)"   score 0.83 · high
▸ Brand-new user, day 0
  🔔 NUDGE (menu)  "Your menu says porridge — did you have it?"   score 0.15 · low
▸ Declined dinner twice → Brain backs off
  🔕 no nudge — top candidate below nudge threshold
```

## Design principles

- **Deterministic.** Every time-dependent function takes an explicit `now`
  (epoch ms) — the engine never calls `Date.now()`. Same event fixture ⇒ same
  predictions, always. That is what makes it replay-testable.
- **Interpretable.** Every prediction carries a per-term `breakdown` (freq,
  recency, dow, tod, menuPrior, seq, declinePenalty, dataFactor) — no black box.
- **Config-with-defaults.** All weights/thresholds live in `config.ts` (§3.3
  says these are server-tunable via remote config); nothing hardcoded inline.
- **On-device, zero cloud.** Operates on the local event log array; no network,
  no server inference.

## Modules

| File | Role |
|---|---|
| `events.ts` | Append-only event log (§3.2), soft-delete handling, query helpers |
| `time.ts` | Deterministic local-time / day-of-week / median helpers |
| `menu.ts` | This-week's-menu model + lookups (menuPrior, portion seed) |
| `scoring.ts` | The §3.3 formula: `0.30·freq + 0.20·recency + 0.15·dow + 0.10·tod + 0.15·menuPrior + 0.10·seq − 0.25·declinePenalty`, with cold-start scaling |
| `confidence.ts` | §3.4 ladder: ≥0.75 nudge · 0.40–0.74 tiles · <0.40 silent |
| `portion.ts` | §3.5 learned portion (median of last 5), menu/default seed, ±25% chips |
| `nudge.ts` | §3.6 budget state machine: 1/slot/day, 3/day, 2-declines→slot quiet 48h, 3-declines→food suppressed 14d |
| `predict.ts` | Top-level API: `rankSlot`, `topPrediction`, `nextNudge` (confident vs cold-start menu framing), `inferSlot` |

## Verified behaviours (21 tests)

- A 20-day, menu-aligned lunch habit → **confident "the usual?" nudge** (score 0.83).
- A habit **without** menu backing tops out in the tiles band (~0.70), not a
  proactive nudge — high-confidence needs habit **and** menu alignment (the menu
  reflects the user's habits, so in practice they align).
- **Cold start (day 0):** a menu item is offered as a "did you have it?"
  confirmation even below the ladder (§3.8), with portion seeded from the menu.
- **Decline penalty** lowers a food's score; **two consecutive declines** make a
  slot go quiet; **three declines** suppress that food; a later acceptance
  reopens the slot.
- **Nudge budget** blocks even a high-confidence prediction once spent.
- **Cold-start scaling**: data-driven terms scale by `days_active / 7`.

## Design notes / follow-ups

- **`seq` (workout boost) is a v1 stub** — it reads an optional caller-supplied
  `workoutAffinity` map + `isWorkoutDay`; wiring it to HealthKit workout history
  is a later step (§3.3 says "v1: workout-logged-today").
- **Nudge accounting** counts recorded `nudge_accept`/`nudge_decline` events as
  "nudges fired". A shown-but-ignored nudge should be recorded as a decline via
  the OS notification callback (§3.6) so it counts.
- **Persistence is a client concern.** The Brain operates on an in-memory
  `BrainEvent[]`; the SQLite event log + encrypted sync (§3.2, §8.2) live in the
  client/server layers, added when the stack is locked.
- **Scheduling** (fire at median-log-time − 10 min, local notification
  reschedule, §3.7) is a client responsibility; the Brain provides the
  eligibility decision (`nextNudge`) that the scheduler acts on.
