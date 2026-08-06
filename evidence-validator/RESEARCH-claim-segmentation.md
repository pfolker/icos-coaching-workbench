# Research: Claim Segmentation vs. Relationship Validation

**Status: research only.** No Specification, Validator, or prompt change
was made producing this. Provisional — would be **EP-006** if adopted
(EP-005 is taken: Phase 3.1's `supporting_claim_ids` rename).

---

## Step 0 — Data availability, and the gate (read first)

Per instruction, this gate is resolved *before* any analysis, and the live
re-run is **not performed** without your explicit confirmation — stated
plainly here, not deferred to the end.

**Real, recoverable data:** Case 009 only, from the two independent live
calls already on disk (`liveTest.out.txt`, `liveTest2.out.txt` — same
artifacts the prior research report used). Both contain full raw
`class_a_proposals`, `class_b_proposals`, and `validator_output.rejected`
detail.

**Not recoverable:** Cases 001 and 002. Reconfirmed, not assumed: the
persisted benchmark report and console output for that run contain no
`marker_text` or raw proposal detail, only aggregate `rejection_tally`
counts — the same gap the prior two reports already documented.

**Cost of the gated re-run, stated exactly, per instruction:**
- **2 live calls** — Case 001, Case 002.
- Reuses existing `TRANSCRIPT` constants (`evidence-runtime/fixtures/case001.ts`,
  `case002.ts`) — no new fixture work.
- ~15–25 seconds per call based on tonight's timings (3 prior calls: 18s,
  26s, 26s).
- Output would need explicit capture to a file this time (a script like
  the existing `liveTest.mjs`, printing raw `class_b_proposals` and
  `validator_output.rejected` in full) — otherwise this task would recreate
  the exact gap it exists to close.

**This re-run has NOT been performed.** Awaiting your confirmation. Per
instruction, this section states the scoping decision plainly: **the
segmentation analysis below is scoped to Case 009 only for this pass.**
Everything about Cases 001/002 in this document is either (a) ground-truth
comparison only (fixture-mode data, already real and on disk from the
benchmark run), explicitly labeled as such, or (b) marked as unknown,
pending the gate above.

---

## 1. Executive Summary

Two independent real live calls (same transcript, same system prompt,
run ~27 minutes apart) both produced a `MARKER_NOT_FOUND` rejection for
the identical marker ("because"), in the identical structural shape
(proposed as a 2-component *bridging* relationship). Comparing the two
runs' Class A segmentation choices directly — which the prior report did
not do side-by-side — shows something that **revises the prior report's
own hypothesis**: in Run 1, the model's segmentation was *identical in
shape* to the Atlas's ground truth (one whole-sentence
`self_reported_diagnosis` claim), and the relationship still failed. This
means **claim segmentation is not, on this evidence, the primary variable**
— the same failure occurs whether or not segmentation matches ground
truth. The more precise, better-supported root cause is a **relationship-
construction habit**: the model treats "because" as connecting two
*separately quoted* claims (the outcome and the diagnosis) based on
*thematic* causal connection, rather than checking whether the literal
marker text spans between those two *specific* quoted spans. This is
closest to category **E (model reasoning error)**, not A (segmentation
mismatch) — a correction the evidence itself supports, not an assumption.

**Evidence base: 2 real data points, both Case 009, both showing the same
pattern.** This is not enough to generalize to a "recurring" cross-case
phenomenon. Cases 001/002 remain unconfirmed pending the gated re-run
above. The EP-003 coverage audit (Section 4) reconfirms a separate,
already-known, purely procedural finding: two of three EP-003 markers
have zero test coverage anywhere.

**Recommendation: A — no change required** to the Specification or
Validator (Section 6 explains why, and what would change this answer).

---

## 2. Segmentation Analysis (Case 009, real data, both runs)

### Ground truth (Atlas / benchmark ground truth, ID: A1-A4, B1)

| id | claim_type | quote |
|---|---|---|
| A1 | context_fact | "We changed our return policy to be more lenient at the start of the quarter" |
| A2 | context_fact | "we also added two more support reps that same month" |
| A3 | outcome | "Customer complaints about our support process dropped by the end of the quarter" |
| A4 | self_reported_diagnosis | "I think the complaints dropped because agents were less stressed after we also added two more support reps that same month" (**one** whole-sentence claim) |

Ground truth B1: `explicit_connective`, marker "because", **self-contained**
on A4 alone (the marker and both linked ideas sit inside this one quote).
This validates cleanly in every fixture-mode run.

### Run 1 (15:27) — segmentation MATCHES ground truth shape

| Model proposal | claim_type | quote | vs. ground truth |
|---|---|---|---|
| action_return_policy | action | full A1 text | same span, different claim_type (already-known finding) |
| outcome_complaints_dropped | outcome | = A3, exact | matches |
| self_reported_diagnosis_stress | self_reported_diagnosis | = A4, **exact, whole sentence** | **segmentation identical to ground truth** |
| action_added_reps | action | = A2 text | same span, different claim_type |

**Relationship proposed:** `rel_because_stress`, explicit_connective,
marker "because", **components: [outcome_complaints_dropped,
self_reported_diagnosis_stress]** — i.e., bridging, 2 components.

**Validator result:** `MARKER_NOT_FOUND` — "\"because\" does not appear in
the transcript between the two referenced components."

**Root cause:** segmentation was not the problem here — the model quoted
the diagnosis exactly as one whole sentence, same as ground truth, which
means "because" sits self-contained within that single quote. The failure
is entirely in *how the model chose to construct the Class B proposal*:
it linked the diagnosis claim to a *different, separately-worded* outcome
claim via "because," even though "because" doesn't literally span between
those two spans — it only appears inside the diagnosis's own sentence,
connecting an embedded restatement ("the complaints dropped") to "agents
were less stressed" *within that one sentence*, not connecting the earlier,
differently-worded outcome sentence to it.

### Run 2 (15:54) — segmentation DIFFERS from ground truth, but the SAME failure recurs

| Model proposal | claim_type | quote | vs. ground truth |
|---|---|---|---|
| action_return_policy | action | full A1 text | same as Run 1 |
| outcome_complaints_dropped | outcome | = A3, exact | matches |
| diagnosis_agents_stressed | self_reported_diagnosis | **shorter fragment**: "I think the complaints dropped because agents were less stressed" (stops before "after we also added...") | **segmentation differs from ground truth — a real, distinct instance of variability** |
| action_added_reps | action | = A2 text | same as Run 1 |
| full_causal_statement | self_reported_diagnosis | **the complete sentence**, = A4 exactly | a **second, overlapping** claim covering the same content as `diagnosis_agents_stressed` plus more |

**This run genuinely segmented differently** — and, new in this run,
proposed **two overlapping Class A claims** for the same underlying causal
statement (a short fragment and, separately, the full sentence). Neither
overlap nor the redundant claim caused a rejection by itself — both
validated fine as independent, verbatim, correctly-typed Class A entries
(the redundancy shows up as an "addition" in benchmark terms, not a
failure).

**Relationship proposed:** `rel_because_dropped_stressed`, explicit_connective,
marker "because", **components: [outcome_complaints_dropped,
diagnosis_agents_stressed]** (the shorter fragment this time) — still
bridging, 2 components.

**Validator result:** identical `MARKER_NOT_FOUND`, identical explanation.

**Root cause:** the same relationship-construction habit as Run 1,
regardless of which exact quote boundary the diagnosis claim happened to
have. Segmentation *did* vary between the two runs (whole sentence vs.
fragment-plus-duplicate) — but the Class B failure shape was identical
either way. This is the direct evidence that segmentation is not the
determining variable: **two different segmentations produced the same
failure**, which is only explainable by something upstream of segmentation
— how the model decides two claims are "connected by because" in the first
place.

---

## 3. Failure Classification Table

Two real disagreements/failures total (both Case 009; no Case 001/002 data
exists to add rows to this table this pass).

| # | Transcript | Expected (Atlas) segmentation | Model segmentation | Relationship proposed | Validator result | Root cause classification |
|---|---|---|---|---|---|---|
| 1 | Case 009 (Run 1) | A4: one whole-sentence `self_reported_diagnosis` claim | **Identical to ground truth** — one whole-sentence claim | "because," bridging outcome → diagnosis | `MARKER_NOT_FOUND` | **E — model reasoning error.** Segmentation matched ground truth exactly; the model still proposed a bridging relationship between two claims the literal marker doesn't span between. Not A (segmentation was correct here), not B (marker is valid vocabulary), not C (Validator behaved exactly as designed — this exact self-contained/bridging distinction is deliberate and tested elsewhere, e.g. Case 004's self-contained "because"), not D (Section 4's rule is unambiguous on this point). |
| 2 | Case 009 (Run 2) | A4: one whole-sentence claim | **Differs** — shorter fragment + a redundant full-sentence duplicate | "because," bridging outcome → (shorter) diagnosis fragment | `MARKER_NOT_FOUND` (identical explanation to #1) | **E, same root cause as #1**, with a genuine, separate **A-flavored observation layered on top** (real segmentation variability run-to-run — the fragment/duplicate split) that did not itself cause this rejection. The redundant claim is worth naming as real evidence of segmentation instability, but it is not the cause of either failure. |

**Objective 3's question, answered directly:** of the 2 real
`MARKER_NOT_FOUND` failures recovered, **0 of 2 originate from claim
boundaries/segmentation as the proximate cause** — both originate from the
same relationship-construction habit (E), present regardless of whether
segmentation matched ground truth (#1) or not (#2). This directly revises
the prior report's framing, which had reasonably hypothesized segmentation
as the likely driver from a single occurrence; a second, closely-compared
occurrence shows a more precise explanation. **This is still only 2 data
points, both one case** — not enough to call this a proven, general
pattern beyond Case 009, only a better-supported explanation of what
actually happened in the two real instances available.

---

## 4. EP-003 Coverage Audit

Confirmed fresh this pass (not re-derived from the prior report's
say-so): re-ran the exact greps and inspected the persisted benchmark
report directly.

| Marker (EP-003) | Atlas coverage | Validator coverage | Benchmark coverage (fixture-mode, confirmed via persisted report) | Live model coverage |
|---|---|---|---|---|
| "instead of" (contrast_marker) | Yes — Case 001 B2 (Atlas prose) | Yes — `CONTRAST_MARKERS` + dedicated test in `test/atlas/case001.test.ts` | **No** — confirmed via `report_evidence_v1.1_fixture_...json`: Case 001's `class_b_recall.unmatched_ground_truth_ids: ["B2"]`. Cause already known/documented: `evidence-runtime`'s own Case 001 fixture deliberately uses the shorter, un-extended A6 quote boundary, so "instead of" never gets proposed as self-contained in that fixture at all (a quote-boundary finding from the Phase 3A report, not new here). | Unconfirmed — not present in Case 009's transcript; unknown for 001/002 pending the gated re-run |
| "pointed to" (explicit_connective) | Yes — Case 002 B5 (Atlas prose) | Yes — `EXPLICIT_CONNECTIVES` + dedicated test in `test/atlas/case002.test.ts` | **Yes** — confirmed via persisted report: Case 002's `class_b_recall: {matched: 2, total_ground_truth: 2}`, full recall, includes B5 | Unconfirmed — not present in Case 009; unknown for 001/002 pending the gate. (Note: a live run for Case 002 *did happen* tonight as part of the benchmark, but its raw output was never captured — see Step 0.) |
| "led to" (explicit_connective) | **No** — zero Atlas cases | Declared in `EXPLICIT_CONNECTIVES` only; zero dedicated tests (reconfirmed by fresh grep, no file under `test/` uses this as `marker_text`) | **No** — zero occurrences in `groundTruth.ts` (reconfirmed by fresh grep) | **No** — not observed in any of the 3 real live calls made tonight across this whole session (Case 009 ×2, Case 007/008/009 fixture-mode — irrelevant transcripts either way) |
| "resulted in" (explicit_connective) | **No** — zero Atlas cases | Same as "led to" — declared only | **No** — same as "led to" | **No** — same as "led to" |

**This reconfirms the prior report's finding exactly, as instructed —
"led to" and "resulted in" have zero coverage anywhere except the bare
Validator list declaration.** Not rediscovered from scratch; independently
re-verified against the actual current files.

---

## 5. Results of additional live runs

**None were run.** Per Step 0, the 001/002 re-run is gated behind your
explicit confirmation, stated above, and this task does not proceed past
that gate on its own. Nothing in Sections 2-4 depends on it — all real
data used above was already on disk before this task began.

---

## 6. Recommendation

**A — No change required**, to either the Specification or the Validator.

**Why not the others:**
- **B (New Evidence Precedent)** — the evidence (2 data points, 1 case)
  is explicitly too thin to justify a precedent. A precedent should follow
  a pattern confirmed across independent transcripts, not two runs of the
  same one.
- **C (Specification clarification)** — Section 4's `explicit_connective`
  rule (self-contained vs. bridging, marker must appear where claimed) is
  not ambiguous here; both failures are the Validator correctly enforcing
  an unambiguous rule against a proposal that didn't satisfy it.
- **D (Validator enhancement)** — the Validator did exactly what it should
  in both cases. Loosening the bridging rule to accommodate a "the marker
  is somewhere in the transcript, thematically" reading would be precisely
  the kind of interpretive judgment Class B exists to avoid — this would
  be a regression, not an enhancement.
- **E (Listen Engine improvement)** — this is the most plausible *future*
  direction if the pattern is confirmed with more data (this document's
  own analysis points here), but recommending it as *needed* now, from 2
  data points in 1 case, and with prompt optimization explicitly out of
  this task's scope, would overclaim. Named here as the most likely
  eventual answer, not adopted as the current recommendation.

**What would change this recommendation:** the gated 001/002 re-run (or
any future live run touching a genuinely different transcript with a
non-self-contained connective) showing the same relationship-construction
habit — thematic linking overriding literal marker-span checking — would
turn this from "insufficient data, no action" into real grounds for E, and
eventually, if it kept recurring across cases, worth a documented EP-006
proposal (Listen Engine guidance, not a Specification or Validator change,
since neither is what's actually misbehaving here).
