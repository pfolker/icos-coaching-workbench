# ICOS Coaching Benchmark (Tier 2 — Coaching Quality)

The ground-truth corpus and scoring rubric that a future structured coach is
measured on. Tier 2 of the ICOS Evaluation System (sibling to
`evidence-benchmark`, which is Tier 1 — Evidence Correctness).

**This package contains NO coach implementation.** It is the bar, not the
thing being measured. It modifies no other package (the five frozen engines,
`coaching-runtime`, the evidence line, production InterviewAce/InterviewU are
all untouched). Built for Phase 1 (Evaluation Foundation) of the LLM-centered
coaching pivot.

Guiding principle, carried straight from the pivot: **the corpus is seeded
from REAL historical failures, not invented adversarial cases.** The
benchmark is therefore a direct test of "did we fix what we said we fixed,
and does it stay fixed" — not an abstract quality bar.

---

## Package structure

```
coaching-benchmark/
├── src/
│   ├── criteria.ts    Step 2 — the 12 coaching-quality criteria + the run-to-run stability bands
│   ├── corpus.ts      Step 1 — the seed corpus: real historical failures, verbatim + documented
│   ├── manifest.ts    Step 3 — real-transcript expansion inventory + the coverage still needed
│   ├── report.ts      Step 5 — provider-neutral scoresheet + report format (manual scoring)
│   └── index.ts
├── bin/
│   └── scoresheet.ts  CLI — emit a blank scoresheet for a named subject
├── test/              corpus / criteria / regressions / report / manifest
├── reports/           persisted scoresheets/reports (gitkept)
└── README.md
```

---

## Step 1 — Seed corpus (`corpus.ts`)

`HISTORICAL_FAILURES` — six cases across the four seeded failure categories,
each with the verbatim input, what the system actually produced, the correct
output, the documented root cause, source citations, and the criterion ids it
exercises:

| id | category | incident |
|---|---|---|
| HF-001 | `fact_fabrication` | Case 001 "indicator" — a tool absent from the transcript reached the learner |
| HF-002 | `relationship_fabrication` | Case 009 "because" — a fabricated causal relationship between two claims (marker present, relationship not) |
| HF-003 | `profession_specific_understanding` | inch flatness `.0005" → .0002"` not read as a quantity |
| HF-004 | `profession_specific_understanding` | `25.4 mm` gap rejected — unit absent from the closed list |
| HF-005 | `profession_specific_understanding` | `8 thou → 2 thou` runout not read as a quantity |
| HF-006 | `grounding_false_positive` | legitimate paraphrase ("examining", "timeframe", …) wrongly flagged as fabrication |

Transcripts for the locked regression cases are **embedded verbatim** (not
imported) on purpose: the original Case 001 failure was itself a copy error,
so a regression fixture must not depend on a mutable source elsewhere. A test
(`corpus.test.ts`) re-checks the properties that define each incident (e.g.
"indicator" is absent from HF-001) and that every cited source file still
exists.

## Step 2 — Scoring rubric (`criteria.ts`)

The 12 criteria: answer comprehension, evidence recognition, fact grounding\*,
attribution/relationship fidelity\*, scope fidelity, focus quality,
good-enough judgment, actionability, brevity, voice preservation, run-to-run
stability, retry effect. (\* = **hard-fail**: a 0 fails the case outright —
these two map to the real fabrication incidents.)

Scale: `0 fail · 1 weak · 2 adequate · 3 strong`, plus `n/a` (excluded) and
`pending` (unscored). **Run-to-run stability is defined as two explicit bands,
not one number** (`STABILITY_BANDS`): choosing a different-but-valid focus on a
rich answer is *acceptable*; disagreeing about whether a claim is grounded at
all is *unacceptable*.

## Step 3 — Real-transcript expansion (`manifest.ts`)

`AVAILABLE_TRANSCRIPTS` inventories the real transcripts already in the repo
(by canonical source path — referenced, not re-copied), including the only
cross-domain ones that exist today: **sales, healthcare, customer support,
software/SRE**. `NEEDED_COVERAGE` names the professions still missing
(finance, teaching, legal, non-machining trades, research, …) as an **explicit
request for real data** — deliberately left unfilled rather than fabricated.
`coverageSummary()` reports where coverage actually stands.

> **Open input needed:** reaching the 20–30 target across professions requires
> real transcripts that don't exist in-repo. See `NEEDED_COVERAGE`.

## Step 4 — Permanent regressions (`regressions.test.ts`)

Every seeded historical failure is flagged `permanent_regression: true` and
locked into a registry the tests enforce — the regression set cannot silently
shrink. There is no coach yet, so these lock the cases *in* (present, flagged,
documented); the "a coach passes them and never regresses" assertion is added
on top of this in Phase 3.

## Step 5 — Report format (`report.ts`)

Provider-neutral: a report is judged against a free-form `subject` string, so
the same corpus scores any provider, prompt revision, or model upgrade
comparably. Scoring is **manual/founder-judgment** in this build — the format
holds human-assigned scores; there is no automated scorer. Field names mirror
`evidence-benchmark`'s Report (`run_id`, `timestamp`, `tier`, versions,
`cases`, `aggregate`) so Tier 1 and Tier 2 reports read the same way.

```
npx tsx bin/scoresheet.ts "coaching-runtime narrator @ claude-sonnet-5"
npx tsx bin/scoresheet.ts "<subject>" --historical-only
npm test
npm run typecheck
```

---

## Out of scope (unchanged from the Phase 1 work order)

No `CoachProvider`, `CoachingPlan`, or coach implementation. No automated
scoring yet. No changes to production InterviewAce/InterviewU, the five frozen
engines, or any other package.
