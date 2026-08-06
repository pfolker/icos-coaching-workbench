# @icos/opportunity-engine

Transforms structured observations (from `@icos/observation-engine`) into
**candidate coaching opportunities**. Nothing more.

## Contract (enforced by types AND tests)

- **Transforms only.** Does not prioritize, rank, select, suppress, or coach.
  Each candidate carries **exactly**: `related_habits`, `evidence`, `confidence`,
  `growth_potential`, `mission_alignment`, `dependencies`, `readiness` (+ its id).
  A test asserts this exact key set and scans the payload for banned vocabulary
  ("priority", "rank", "severity", "selected", coaching language).
- **Output order = registry order** (a catalog order). A test constructs a case
  where confidences are demonstrably unsorted and asserts no reordering occurs.
- **All fired candidates are emitted.** Suppression rules (e.g. filler-polish
  while structure is broken) are prioritization and live in the Decision Engine.
  The information it needs is provided, not pre-applied:
  `dependencies.upstream_candidates_cofired` lists co-fired candidates whose
  habits are DAG-prerequisites of this one.
- **Evidence is verbatim + cited.** Spans are copied unchanged from input
  observations; metric citations state value/comparator/reference; absence-based
  detections name their `absent_signals` explicitly.
- **Deterministic, zero runtime deps, no IO.**

## Field semantics

- `confidence` — per-detector formula documented inline. Honesty rules:
  absence-over-low-confidence-heuristics is capped (O3_missing_result ≤ 0.5,
  because keyword STAR signals are themselves 0.5-capped upstream); estimated
  durations penalize O10; context-gated O8 is deliberately low (0.45).
- `mission_alignment` — `no_mission` when no `context.mission_habit_id` given;
  else `aligned`/`unaligned` by habit membership. Alignment is reported, never
  used to reorder.
- `dependencies.habit_prerequisites` — transitive closure over the KB habit DAG.
- `readiness.allowed_states` — KB passthrough of appropriate coaching states
  (e.g. O10 filler polish: `["flowing"]` only). Requirements, not judgments —
  gating happens downstream.

## Detector coverage (deterministic scope)

Implemented: O2 ramble · O3 missing/unquantified result (mutually exclusive
variants) · O4 ownership hiding · O5 vagueness · O7 weak close ·
O8 buried lede (question-type-gated) · O10 filler density · O11 employer negativity.

Deliberately out of scope here (documented, not forgotten):
- **O1 off-target** — needs semantic question↔answer matching (LLM Listen stage).
- **O9 audience miscalibration** — needs interviewer-persona context + jargon
  analysis beyond deterministic observations.
- **O12 belief-blocked recurrence** — cross-session; needs learner-model history.

## Usage

```ts
import { observe } from "@icos/observation-engine";
import { generateOpportunities } from "@icos/opportunity-engine";

const set = observe({ transcript, duration_seconds });
const candidates = generateOpportunities(
  { observation_set: set, context: { mission_habit_id: "H5", question_type: "behavioral" } },
  // optional: DetectorConfig overrides — all thresholds are [FH] tunables
);
```

Thresholds live in `DEFAULT_CONFIG` (`src/registry.ts`) and are injectable —
the future home is `/config/detectors.json` per the Backend Architecture.

## Tests

```
npm test   # 26 tests
```

Per-detector positive/negative suites; contract invariants (exact field
allowlist, anti-prioritization order test, emit-all test, determinism, shared
error taxonomy); and a **live pipeline test** that imports the sibling
`../observation-engine` (auto-skips if absent), runs a real transcript through
`observe()` → `generateOpportunities()`, and property-checks that every cited
span is verbatim from the transcript end-to-end.
