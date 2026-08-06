# ICOS Evidence Benchmark (Tier 1)

Standalone measurement package implementing Tier 1 (Evidence Correctness)
of the ICOS Evaluation System, Design v0.1. Reads `evidence-validator`'s and
`evidence-runtime`'s output; **does not modify either package's actual
behavior.** No Tier 2, no UI, no CI integration, no new Atlas cases.

---

## 1. Package structure

```
evidence-benchmark/
├── src/
│   ├── groundTruth.ts      Step 1 — Atlas v0.1 ground truth, all 10 cases, structured
│   ├── case003Fixture.ts    local fixture-mode proposals for Case 003 (see Section 2)
│   ├── scorer.ts            Step 2 — Tier 1 metrics + the Class C hard-fail check
│   ├── report.ts            Step 3 — Run/Report schema (Design Section 4)
│   ├── runner.ts             Step 3 — orchestrates pipeline run -> score -> Report
│   ├── diff.ts               Step 4 — structured per-case diff between two Reports
│   └── index.ts
├── bin/
│   ├── run.ts                CLI: fixture (default) or --live (guarded to 001/002/009)
│   └── diff.ts                CLI: two report paths -> structured diff JSON
├── reports/                  persisted Report JSON, versioned filenames
├── test/                     75 tests — ground truth, scorer, runner, diff
└── README.md (this file)
```

Depends on `../evidence-validator` (`validateEvidence`, `PROMOTION_LABELS`,
types) and `../evidence-runtime` (`materializeSourceSpans`,
`runListenEngineFixture`/`runListenEngineLive`, `FIXTURE_CASES`) via the
same relative-import convention every package in this workspace already
uses. Nothing in either package was edited to build this.

---

## 2. Ground truth extraction (Step 1)

All 10 Atlas cases extracted into `groundTruth.ts` as structured
`{ case_id, transcript, class_a[], class_b[], class_c_hypotheses[] }` data.

**Cases 001/002** have the Atlas's own explicit A#/B# tables — extracted
directly. **Cases 004-010** have only prose paraphrases in the Atlas
("problem (scrapping ~1 in 5 parts)"); ground truth reuses the verbatim
quotes already hand-extracted and Validator-tested in
`evidence-validator/test/fixtures/*.ts`, rather than re-deriving them.
**Case 003** has no existing fixture anywhere in this codebase (it wasn't
in any prior phase's "required cases" list) — its quotes were extracted
fresh, directly from the transcript, and its fixture-mode Listen Engine
proposals live locally in `src/case003Fixture.ts` rather than being added
to `evidence-runtime` (out of bounds for this task).

**Discrepancies found and flagged (not silently normalized):**
- Case 001's A11 quote: the Atlas's own table lowercases the sentence-
  initial "it" ("it also improved..."); the transcript is capitalized. This
  is the exact slip `evidence-validator`'s `test/helpers.ts` `span()` helper
  caught during the original build (Phase 8) — reproduced here with the
  correct (capitalized) casing.
- Case 001's B2: the Atlas's table still labels it `explicit_connective`
  ("Instead of"); Specification EP-003 corrected this to `contrast_marker`.
  Ground truth uses the corrected type.
- Case 001's A6: extended to include the leading "Instead of..." clause so
  B2 can validate as self-contained — an internal-consistency bug this
  package's own `groundTruth.test.ts` caught and fixed during this build
  (Section 6).
- Case 006's A1/A4 (`decided`/`agreed`): Atlas's prose predates EP-002 and
  calls all four claims `action`; ground truth uses the current, correct
  `decision` typing and the correspondingly narrower 2-component
  enumeration.

**Known duplication, flagged per task instructions, not fixed:** quotes for
9 of 10 cases now exist in three places — the Atlas's own prose,
`evidence-validator`'s test fixtures, and this file. A future pass should
refactor the `evidence-validator` fixtures to import from `groundTruth.ts`
instead of re-declaring their own constants. Not done here — out of scope.

---

## 3. Scorer + Class C hard-fail proof (Step 2)

All 7 Design Section 5 metrics implemented in `scorer.ts`: Class A recall,
quote fidelity (measured on RAW proposals, since a paraphrase never reaches
`validated_class_a` — Validator Rule 1 already blocks it), claim_type
agreement (among quote-matched claims only), additions (counted, never
auto-failed), Class B relationship recall, the Class C hard-fail, and
rejection reason code tally.

**Class C hard-fail** (`scoreClassCHardFail`) — built and tested first, per
instruction. Two independent sub-checks:
1. No `validated_class_a` claim_type is a `PROMOTION_LABEL` (imported
   read-only from `evidence-validator`) — defense-in-depth mirror of a
   protection that already exists upstream.
2. No `validated_class_a` quote textually overlaps a
   `class_c_non_admissible` hypothesis/reasoning (min. 20-char threshold to
   avoid trivial false positives).

**Proof it fails loud, not silently passes** (`test/scorer.test.ts`):
- PASSES against the real, legitimate Case 009 pipeline output.
- PASSES against the real, ADVERSARIAL Case 009 fixture run through the
  actual `evidence-validator` — because the Validator's own upstream
  defense (`BELIEF_FACT_COLLAPSE_ATTEMPT`) already blocks it; nothing
  reaches `validated_class_a` to leak.
- **FAILS**, with a specific violation message, against a hand-constructed
  `ValidatorOutput` simulating a promotion-label leak.
- **FAILS**, with a specific violation message, against a hand-constructed
  `ValidatorOutput` (reusing Case 009's shape, per instruction) simulating
  a Class C hypothesis leaking into an admitted Class A claim.
- Does NOT false-positive on short, coincidentally-overlapping text.

This is the only place in this package that intentionally bypasses the real
pipeline to construct output directly — necessary because the real
Validator, by design, should never actually produce a violation; testing
the check's own discriminating power requires simulating the bug it exists
to catch.

**A real quote-matching bug was found and fixed while building this**
(`findBestQuoteMatch` in `scorer.ts`): naive first-match substring search
mismatched Case 009's claim_type agreement, because ground truth's longer
`self_reported_diagnosis` quote (A4) textually contains its shorter,
unrelated `context_fact` quote (A2) as a literal substring. Fixed by
preferring an exact match first, falling back to substring only when no
exact match exists — caught by this package's own test suite before it
ever reached a real report.

---

## 4. Report schema, runner, both modes (Step 3)

`report.ts` implements the exact Run/Report shape from Design Section 4,
including `tier` and a tier-specific `cases`/`aggregate` payload — only
`"evidence"` is populated; `CaseResult` is documented as the extension
point for a future Tier 2/3 logger, not stubbed with fake fields.

`runner.ts`'s `runBenchmark({ mode, caseIds })`:
- **Fixture mode** defaults to all 10 Atlas cases — deterministic, free,
  proven by `test/runner.test.ts`'s determinism check (two runs, identical
  metrics byte-for-byte).
- **Live mode** is hard-guarded to `LIVE_ALLOWED_CASE_IDS = ["001","002","009"]`
  — `runBenchmark` throws before making any network call if asked to run
  live against any other case, tested explicitly (`test/runner.test.ts`).
  `bin/run.ts` additionally refuses to start if `--live` is passed without
  `ANTHROPIC_API_KEY` configured, reporting that plainly rather than
  silently falling back to fixture output.

Both modes work: see Section 5 below for real output from both.

---

## 5. The actual fixture-vs-live diff — Cases 001, 002, 009 (Step 5, main result)

Two real runs, persisted to `reports/`:
- `report_evidence_v1.1_fixture_2026-07-19T16-23-29-063Z.json` — fixture mode, all 10 cases.
- `report_evidence_v1.1_live_2026-07-19T16-24-40-245Z.json` — live mode, `claude-sonnet-5`, 3 real API calls (001, 002, 009).

Diffed with `bin/diff.ts`; full output in `reports/diff_fixture_vs_live.json`.

### Headline: the Class C hard-fail held in both modes, unchanged

`hard_fail_status_changed: false`, and every one of the 3 overlapping
cases individually shows `class_c_hard_fail_changed: false` — both fixture
and live output passed. This is the single most important result: the
real model, under no special scrutiny beyond its ordinary system prompt,
never produced a belief-fact collapse, and the benchmark's independent
hard-fail check confirms it rather than just trusting the Validator.

### Real, meaningful differences found

| Case | Class A recall | claim_type agreement | Class B recall | Notes |
|---|---|---|---|---|
| 001 | 1.00 → 0.92 (−0.08) | 1.00 → 1.00 (0) | 0.75 → 0.25 (−0.50) | +1 addition (`context_line_setup`, `context_fact`); +2 `MARKER_NOT_FOUND` rejections |
| 002 | 1.00 → 1.00 (0) | 1.00 → 0.93 (−0.07) | 1.00 → 0.00 (−1.00) | +2 `MARKER_NOT_FOUND` rejections; 1 claim_type disagreement (below) |
| 009 | 1.00 → 1.00 (0) | 1.00 → 0.50 (−0.50) | 1.00 → 0.00 (−1.00) | +1 `MARKER_NOT_FOUND` rejection; 2 claim_type disagreements (below) |

**Aggregate deltas (fixture → live, these 3 cases):** Class A recall avg
−0.028, claim_type agreement avg −0.190, Class B recall avg **−0.892**,
additions +1.

**1. Class B relationship recall dropped sharply and consistently.** This
is the largest real signal in the whole run. All three cases show it, all
driven by `MARKER_NOT_FOUND` rejections. The persisted Report does not
retain enough detail to say precisely which marker/component pairing
failed for 001/002 (Section 7's first gap) — but Case 009's earlier,
separately-logged live runs this same evening (see
`evidence-runtime/README.md`) showed the identical pattern with a visible
cause: the model proposing a connective as a 2-component *bridging*
relationship when the marker only actually appears self-contained within a
single component's own quote. Given the consistency of the pattern
(`MARKER_NOT_FOUND` specifically, not `COMPONENT_NOT_VALIDATED` or
anything else, in all 3 cases), the same self-contained-vs-bridging
confusion is the most likely explanation here too, not a new failure mode
— but this run's evidence alone cannot prove that without re-running with
raw-output capture (a real Design gap, see Section 7).

**2. Two new, genuine claim_type disagreements, both defensible:**
- Case 002, A14 ("I was able to see the part had been moving"): ground
  truth `self_reported_diagnosis`, live model said `outcome`. Plausible
  either way — it is both the result of the diagnostic check and the
  speaker's own perceptual conclusion.
- Case 009, A1/A2 (the policy-change/added-reps statements): ground truth
  `context_fact`, live model said `action` — **the exact same disagreement
  already found, audited, and documented earlier tonight** (Phase 3.1,
  Specification's "Phase 3.1 Freeze Audit" section). The benchmark's diff
  independently rediscovered the identical finding from raw pipeline
  output, which is a meaningful validation that the scorer surfaces real
  signal rather than noise — it did not need to be told this was already
  known to find it again.

**3. Additions differ in content, not just count, between modes.** Case
001 fixture proposed 0 additions; live proposed 1
(`context_line_setup`, typed `context_fact`, quoting the transcript's
scene-setting first sentence — reasonable, not in ground truth since it
carries no evidentiary content). Case 002's addition count was unchanged
(1 in both modes) but the actual claim differs: fixture's `a_need` typed
it `action`; live's `decision_lock_part` (same underlying sentence) typed
it `decision` — itself a small, plausible claim_type judgment difference.

**4. Quote fidelity was 100% exact in every case, both modes.** The live
model never proposed a single paraphrased quote across all 3 cases in this
run — a clean result, though a sample of 3 cases is not enough to call this
a stable property of the model/prompt combination (Design Section 5 itself
frames this metric as a trend signal, not a one-run verdict).

This is the proof Design Section 6 asks for: two genuinely different
inputs (hand-authored baseline vs. real model output) produced structured,
comparable, per-case metrics through the exact same scoring and Report
pipeline, and diffing them surfaced real, specific, actionable differences
— not just a pass/fail summary.

---

## 6. Benchmark's own test results

**75/75 passing**, 4 test files, fixture mode only (no test in this suite
ever makes a live call):

| File | Tests | What it proves |
|---|---|---|
| `groundTruth.test.ts` | 51 | Every quote is verbatim in its transcript; every Class B marker actually appears where claimed (self-contained or bridging); caught and enabled the fix for the A6/B2 internal-consistency bug (Section 2) |
| `scorer.test.ts` | 13 | All 7 metrics against real pipeline output; the Class C hard-fail proven both ways (Section 3); caught and enabled the fix for the quote-matching ambiguity bug (Section 3) |
| `runner.test.ts` | 8 | Fixture mode defaults to all 10 cases; Report shape matches Design Section 4; live mode is refused outside the allowed 3-case subset (2 separate tests, no network call made); determinism across repeated fixture runs |
| `diff.test.ts` | 3 | Self-diff is all-zero; a case present in only one report is reported as such, not silently dropped; case coverage is the union of both reports |

Typecheck clean throughout (`tsc --noEmit`, strict mode, matching every
other package in this workspace).

---

## 7. What Design v0.1 got wrong or underspecified (Deliverable 7)

1. **The Report schema (Section 4) has no room for raw proposal/rejection
   detail, only rolled-up metrics.** This bit in practice: Section 5's
   findings above show `MARKER_NOT_FOUND` rejection counts rose in live
   mode, but the persisted Report cannot say which marker or components
   caused it — that detail exists only transiently during the run, in the
   `ValidatorOutput` the scorer consumes, and is discarded once metrics are
   computed. A future revision should let `CaseResult` optionally retain
   the raw `rejected`/`class_c_non_admissible` arrays (not full
   `PipelineResult`, which would bloat every report with the transcript and
   observation-engine output — just enough to debug a metric regression
   without re-running).
2. **Section 5's Class A recall definition ("matched on quote + claim_type")
   is ambiguous about whether claim_type is REQUIRED for a match to count,
   or a separate metric layered on top.** Resolved in the more sensible
   direction (quote-only recall; claim_type agreement is its own metric,
   as Section 5's very next bullet independently defines) since the
   alternative would double-penalize a legitimate claim_type disagreement
   (like Case 009's) in TWO metrics instead of one.
3. **Class B recall has no guidance on relationship ORDER for
   `temporal_sequence`.** This build matches on relationship_type + the SET
   of components, ignoring order — a real simplification, documented in
   `scorer.ts`. A model could propose a `temporal_sequence` with the wrong
   order and still score full Class B recall here. Not fixed, since
   verifying order correctly requires re-deriving the same connector logic
   `evidence-validator`'s own `classB.ts` already implements (EP-004),
   which this package should read the result of, not reimplement.
4. **No guidance on what counts as "the same relationship" across two
   different proposal_id namespaces when a ground-truth component matches
   MULTIPLE plausible pipeline claims** (the exact ambiguity that caused
   the quote-matching bug in Section 3). Section 5 assumes ground truth and
   pipeline output are trivially comparable; in practice, translating
   between two independent ID namespaces via quote text is real, nontrivial
   work this design doc doesn't acknowledge at all.
5. **"Additions... flagged for periodic human review" has no persisted
   review-status field.** Right now an addition is either in the report or
   it isn't; there's no way to mark "reviewed, legitimate" vs. "reviewed,
   should be suppressed" across runs, so the same addition will resurface
   as new-looking noise in every future report until this is designed.
6. **Section 6 says "a meaningful, real difference... is the smallest true
   proof this architecture does its job" but never specifies HOW different
   is meaningful vs. noise.** This run found an −0.89 Class B recall swing
   from a sample of 3 cases with no historical baseline to compare against
   — is that alarming or ordinary live-model variance? Nothing in Design
   v0.1 says how many runs are needed before a delta is trustworthy signal
   rather than one unlucky sample. This benchmark can produce the number;
   deciding what the number MEANS still requires a human, same as Tier 2.

---

## Stop condition

Per the task's instruction: this report is the end of this build. No Tier
2, no UI, no CI integration, no new Atlas cases, no changes to
`evidence-validator`'s or `evidence-runtime`'s actual logic were made.
