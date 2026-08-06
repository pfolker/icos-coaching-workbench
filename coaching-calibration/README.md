# Founder Calibration Workbench (Phase 3)

A two-column workbench that renders the **deterministic coach** (the five
frozen engines) alongside the **structured coach** (the LLM narrator behind
the Phase 2 provider seam) for the same real case — with a four-field
observation logger. **Not a release decision, not a score.** It exists to
calibrate the founder's understanding of how the structured coach actually
behaves before any external tester sees it.

**No numeric rubric. No aggregation. No recommendation.** Patterns get read
off the raw observations *after*, by the founder — never imposed before.

## Run it

```
cd coaching-calibration && npm install
npm start          # → http://localhost:4325   (structured coach makes a live Narrator call per case)
npm test
```

For each case: click **Run both coaches**, read the two outputs, then log:

```
Preferred:        Structured / Deterministic
Why:              one sentence — the mechanism, not an impression
Constitution:     PASS / FLAG (+ the violation if flagged)
Retry Motivation: YES / NO   (did it make you want to try again?)
Surprised?:       YES / NO    (did the coach do something your prior model didn't predict? + what, if yes)
Notes:            anything else worth remembering
```

Observations append to `logs/observations.jsonl` (raw, one line each).

**Surprised?** is the leading-indicator field: the other four evaluate against
what you already believe, so only surprise can fire when reality disagrees
with your prior model of the coach.

**Go until saturation, not a case count.** The corpus is frozen at 15; you are
building a felt sense of the coach's behavior, which saturates well before you
exhaust the examples. Stop when observations stop telling you something new —
then decide separately whether domain gaps warrant more live transcripts.

## What it is / isn't

- **Deterministic coach** (`src/deterministicCoach.ts`) — the exact single-turn
  composition the Alpha Workbench orchestrator runs: `observe →
  generateOpportunities → decide → generateCoachingMove`, frozen engines
  unmodified. Its learner-facing message is the assembled move copy.
- **Structured coach** — Phase 2 `runStructuredCoach`; evidence graph built
  deterministically from each case's Listen fixture, so only the Narrator is a
  live call.
- **Corpus** (`src/corpus.ts`) — 15 real, fixture-backed transcripts across
  manufacturing, sales, healthcare, software, customer support, and a
  deliberately thin answer. No new transcripts, no recruiting.

## Reaching 20–30 cases

The corpus is capped at what already has Listen fixtures (15). To extend
toward 20–30 without inventing transcripts, add real transcripts that lack a
fixture (the HF dimensional cases, adversarial cases) by giving them a **live
Listen call** to build the evidence graph — a small addition to `corpus.ts` /
`runComparison.ts`, deliberately left out here to bound live-call cost.

## Out of scope (unchanged from the work order)

No numeric scoring/rubric automation. No recruiting. No changes to the coach,
the provider seam, or grounding. No production integration. Reuses the
`evidence-shadow-compare` two-column `debugUI` pattern; that package is
untouched.
