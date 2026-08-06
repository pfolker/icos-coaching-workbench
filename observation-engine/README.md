# @icos/observation-engine

Deterministic observation layer for ICOS — the deterministic signal source of the Perception stage, and the Listen (LLM extraction) stage's degradation fallback (see icos-contract-reconciliation-v1). Accepts a transcript; returns structured,
evidence-backed **observations of communication behavior** — and nothing else.

## Contract (enforced by types AND tests)

- **Observes only.** No coaching copy, no priorities, no opportunities, no severity,
  no recommendations. The output types have no fields for them, and
  `test/invariants.test.ts` asserts the payload contains no prescriptive language
  and no threshold judgments ("too long" is the Opportunity Engine's call — this
  module reports `word_count` and `duration_seconds`).
- **Every observation carries evidence + confidence.** Evidence spans are verbatim:
  `transcript.slice(char_start, char_end) === span_text` is a tested invariant on
  every span. Confidence ∈ (0,1] with a stated `confidence_basis`.
- **Deterministic.** Same input → deep-equal output (tested). No LLM calls, no IO,
  zero runtime dependencies. Fits `packages/coaching-core` import rules
  (Backend Architecture §1).
- **Structural (STAR) signals are capped at 0.5 confidence by design** — keyword
  heuristics only. The authoritative STAR map is the LLM Listen stage; these
  signals double as its degradation fallback (Blueprint §1).

## Usage

```ts
import { observe } from "@icos/observation-engine";

const set = observe({ transcript, duration_seconds: 45 }); // duration optional
// set.sentences      → indexed, offset-true sentence inventory
// set.observations   → typed detections, each with evidence[] + confidence
// set.metrics        → raw aggregate measurements (counts, rates, duration)
```

Feeds directly into the Opportunity Engine, which applies thresholds
(`detectors.json`), suppression rules, and priority classes downstream.

## Observation types (v1.0)

Delivery: `filler_core`, `filler_soft`, `hedge_marker`, `closing_hedge`, `trailing_off`
Agency: `first_person_singular`, `first_person_plural`, `agency_verb_i`, `presence_verb_i`
Content: `quantified_span`, `numeric_span`, `hypothetical_marker`, `employer_negativity`
Structure (low-confidence heuristics): `structure_{situation,task,action,result}_marker`,
`result_in_final_sentence`

Notes on known measurement properties (documented, not hidden):
- `filler_soft` ("like", "kind of") is an ambiguous class — the count is an upper
  bound and confidence reflects that.
- `quantified_span` evidence may overlap (a range plus its member percents);
  spans are deduped by exact position only. Downstream consumers needing
  disjoint counts should merge by overlap.
- Agency/presence verb lexicons are partial: undercount is possible, false
  positives are rare — the right bias for evidence the Conversation Engine will quote.

## Tests

```
npm test        # 33 tests: segmentation, per-observer pos/neg, invariants
npm run typecheck
```

Invariant suites: span integrity (property-tested over fixtures), confidence
contract, determinism, boundary contract (schema-key allowlist + banned-language
scan), input validation (shared error taxonomy: INPUT_INVALID, non-retryable).

## Tuning

All vocabularies live in `src/lexicons.ts` (data, not logic). Per the Backend
Architecture, these can be lifted to `/config` with a schema when detector
tuning becomes config-driven.
