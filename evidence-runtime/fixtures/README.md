# Fixture-mode Listen Engine proposals

Each `caseNNN.ts` file here contains:

- `TRANSCRIPT` — copied verbatim from the corresponding
  `evidence-validator/test/fixtures/caseNNN.ts`, so fixture-mode runs are
  checked against the exact same transcript text the Validator's own Atlas
  regression tests use.
- `LISTEN_ENGINE_FIXTURE` — a hand-authored `ListenEngineRawOutput` (no
  `source_span`; those are computed downstream by `materializeSourceSpans`,
  same as a live model's output would be).

**These are the assistant's own independent reading of each transcript,
written without looking at the Atlas's own classification tables while
drafting them, and deliberately NOT a copy of `evidence-atlas-v0.1.md`'s
own claim tables.** The Atlas contains classifications (what a human
manually decided the right answer is), not pre-formatted Listen Engine
proposals — there is no such thing as "the Atlas's proposals" to copy. This
distinction is what makes dual-mode testing useful at all: if fixture-mode
output disagrees with the Atlas's classification, that disagreement can be
attributed to this fixture's authoring choices, the Validator's rules, or
the Specification itself — never confused with "the Listen Engine failed
to reproduce ground truth," because no ground-truth proposals exist to
reproduce.

Several fixtures deliberately preserve a genuine boundary-condition finding
rather than smoothing it over — see the per-file comments, and
`README.md` (Deliverable 8) at the package root for the write-up.
