# SOD v0.1 — Experiment Report

> **Contained experiment. Nothing here is integrated.** No package imports
> `sod-experiment`. The structured coach, the frozen engines, the Narrator,
> readiness, grounding and the guardrail are byte-for-byte unchanged, and
> Section 16 below verifies that empirically rather than asserting it.
>
> Experimental question: **can an LLM reliably perceive coaching-relevant
> semantic signals in a learner's answer that the current deterministic
> representation cannot perceive?**

**Recommendation: STOP — HYPOTHESIS NOT SUPPORTED at the pre-registered bar.**
The reasoning is in Section 17, and it is narrower than that verdict sounds:
every one of the four target signals was detected 3/3 in at least one
condition, but **no single tested configuration satisfies all nine
pre-registered criteria at once**, and the one authorized prompt revision is
spent.

---

## 1. Final input contract, and why that boundary

**SOD receives the admitted Evidence Graph and nothing else.** No raw
transcript, no Class C, no source spans. Implemented in `src/sodInput.ts`.

```ts
SodInput = {
  nodes: { id, claim_type, quote, speaker_assertion }[],
  edges: { id, relationship_type, component_ids, marker_text }[],
}
```

**Q1 — can the four semantic tests run on admitted evidence plus provenance?**
Yes. Verified case by case against real validator output *before* the detector
was written:

| Test | Where the signal lives |
|---|---|
| `ownership_dilution` / 006 | entirely inside the admitted quotes: *"I built out a staging environment"*, *"The team put together the test suite"*, *"we all agreed on the rollout schedule together"* |
| `result_needs_substance` / 005 | the admitted outcome claim *"now it runs on its own"*; judging its substance is a judgment about that quote |
| `assumption_reversal` / 001 | both halves admitted **and the relation admitted**: `a_prior_belief` and `a_diagnosis1` joined by validated Class B edge `b_contrast_belief` (`contrast_marker`, marker `"but"`) |
| `unresolved_alternative_cause` / 009 | all four claims admitted, including the speaker's causal belief (`self_reported_diagnosis`, `speaker_assertion=true`) |

The 001 case matters most: SOD does not have to *invent* the reversal
relationship, because the Validator already admitted it.

**Q2 — is anything lost when the graph is built?** Yes: `source_span`.
`GraphNode` drops the span `ValidatedClassA` carries, and **node array order is
not transcript order** — Case 009 proves it (`a_reps` sits at index 1 with span
229–280 while `a_outcome` sits at index 2 with span 77–156). Transcript order
is therefore unrecoverable from the graph.

For these four tags it is not required: `prior_belief` as a claim_type already
encodes "believed first", the Class B contrast edge already encodes the
reversal, and the 009 quotes carry their own time words. It *would* be required
for positional principles (H8 buried lede, H9 weak close) — recorded as a known
limit, not pre-emptively fixed.

**Q3 — minimum additional information required: none.** The experiment added no
input beyond what the graph already admits. The reading "if `assumption_reversal`
fails, missing order is the first hypothesis" was pre-registered in
`src/sodInput.ts` before the runs; it was not needed.

**Q4 — does this weaken the Validator's authority?** No, in three ways.
SOD sees only what the Validator **admitted** — rejected proposals and raw
transcript text are unreachable. **Class C is deliberately excluded**: Case
001's Class C entry is *"the speaker was personally among those who initially
believed it was a programming issue"*, and feeding that in would hand SOD the
`assumption_reversal` answer through a non-admissible route. And every proposal
must cite supplied ids, enforced deterministically downstream.

Raw transcript access was considered and **rejected**: not needed (Q1), and it
would let SOD reason over text the Validator never admitted — the one boundary
the structured path exists to hold.

---

## 2. Output contract

```ts
type SemanticObservation = {
  tag: SemanticTag;        // closed 4-value vocabulary
  evidence_refs: string[]; // ids supplied to SOD; never empty once accepted
  confidence: number;      // 0..1
  basis: string;           // engineer-facing audit note, NEVER learner-facing
};
```

No `habit_id`, no principle text, no Teaching Move, no ADVANCE/RETRY, no
coaching message, no ranking. `[]` is valid and expected.

`basis` was added beyond the sketch in the work order because the deliverable
requires grounding and relationship-fabrication findings, which cannot be
audited if SOD never says *why*. It is an audit field: it names cited evidence
and carries no advice, encouragement, or learner address.

**The traceability gate is deterministic, not modelled.** `validateObservations`
rejects any observation whose tag is outside the vocabulary, whose
`evidence_refs` is empty, or which cites an id never supplied. Rejected
observations are recorded, not silently dropped.

---

## 3. Semantic vocabulary actually tested

Four tags, closed set: `ownership_dilution`, `result_needs_substance`,
`assumption_reversal` (a **strength**, not a deficiency),
`unresolved_alternative_cause`.

**No optional tags were added.** `specificity_gap` and
`strong_root_cause_reasoning` were considered and excluded, recorded in
`EXCLUDED_TAGS` with reasons — for `specificity_gap`, the frozen path's
`O5_vagueness` fires on 9 of 15 calibration cases *including Case 001*, which
the founder's own capstone establishes as rich, so the deterministic label
cannot serve as ground truth and no independent founder judgment exists to
replace it.

---

## 4. Corpus evidence supporting every tag

| Tag | Ground truth | Authority |
|---|---|---|
| `assumption_reversal` | Case 001 / HF-001 | founder-supported |
| `result_needs_substance` | Case 005 | founder-supported |
| `ownership_dilution` | Case 006 | founder-supported |
| `unresolved_alternative_cause` | Case 009 | Evidence Atlas — the speaker's causal belief must not be promoted while another plausible same-period cause is unaddressed |

---

## 5. Exact prompt

Full verbatim text of both revisions is stored in the `system_prompt` field of
the corresponding report JSON, and generated from `src/sodPrompt.ts` +
`src/vocabulary.ts`. Structure: role ("you notice, you do not decide"), the four
tag definitions rendered from the vocabulary type so prompt and type cannot
drift, five hard rules (ground everything / do not invent relationships / do not
promote beliefs into facts / do not resolve uncertainty / stay inside the
vocabulary), an explicit list of decisions SOD must never output, and the JSON
output format.

**No case-specific hints.** A test asserts the prompt contains none of
"deburring", "staging", "return policy", "onboarding", "sepsis", "churn".

User message = the rendered admitted evidence, nothing else.

---

## 6. Model, provider, configuration

| | |
|---|---|
| Provider | `anthropic`, via the existing `CoachProvider` seam (read-only import; `coaching-runtime` unmodified) |
| Model | `claude-sonnet-5` — the same model the structured coach uses; no second provider, no migration |
| max_tokens | 4096 (see the mechanical defect below) |
| Sampling | provider default — the seam exposes no temperature parameter, so the three runs measure real sampling variance |
| Runs | 3 independent runs per case, recorded separately, never averaged across cases |

### Mechanical defect found and corrected before any result was scored

The first live pass used `max_tokens: 1024`. **7 of 24 runs returned no text
block at all** — `stop_reason: max_tokens`, with all 1024 output tokens spent
inside a `thinking` block (confirmed by direct API inspection:
`usage.output_tokens_details.thinking_tokens = 1024`, `content` block types
`['thinking']`). Affected: 001 ×3, 006 ×2, nursing ×2.

Those runs were **void, not negative** — SOD never got to answer. Scoring them
as "detected nothing" would have produced a false 0/3 on two primary cases.
Under Work Order Section 15 this is a purely mechanical defect preventing the
experiment from executing as specified; the budget was raised and the whole
matrix re-run. **The prompt was not touched, so the authorized prompt revision
was not spent here.** The detector now reports `no_text_block` explicitly so
this failure can never again be silently read as an empty result.

---

## 7 & 8. Primary-case results and stability

Every run is stored verbatim in `reports/`:

| File | What it is |
|---|---|
| `sod_v0.1_revision-0_..._02-00-49-162Z.json` | the **voided** first pass (`max_tokens: 1024`); kept as an honest record, **not scored** |
| `sod_v0.1_revision-0_..._02-06-34-479Z.json` | **revision 0**, scored |
| `sod_v0.1_revision-1_..._02-13-51-028Z.json` | **revision 1**, scored |

Detection counts for the **target** tag:

| Case | Target tag | Revision 0 | Revision 1 |
|---|---|---|---|
| 001 / HF-001 | `assumption_reversal` | **3/3 stable success** | **3/3 stable success** |
| 005 | `result_needs_substance` | **3/3 stable success** | **3/3 stable success** |
| 006 | `ownership_dilution` | **3/3 stable success** | **2/3 — capability observed, stability criterion FAILED** |
| 009 | `unresolved_alternative_cause` | **3/3 stable success** | **3/3 stable success** |

Non-target tags also proposed on primary cases (Section 10 of the work order:
multiple valid proposals are not automatically a failure):

| Case | Extra tag | Rev 0 | Rev 1 | Assessment |
|---|---|---|---|---|
| 005 | `ownership_dilution` | 3/3 | 3/3 | **Supported, not a false positive.** The corpus labels 005 "Ambiguous ownership", and the frozen path generates `O4_ownership_hiding` as a candidate on it. See Section 15. |
| 009 | `result_needs_substance` | 2/3 | 0/3 | defensible ("complaints dropped" carries no magnitude) but unstable |
| 001 | `unresolved_alternative_cause` | 3/3 | 1/3 | **over-fire** — see Section 11 |
| 009 | `ownership_dilution` | 0/3 | 1/3 | unstable stray |

Case-level results are reported separately and are **not** averaged into a
single score.

---

## 9. Control results

| Control | Why chosen | Rev 0 | Rev 1 |
|---|---|---|---|
| `sales` | clear quantified result + clear individual ownership + no causal attribution; all four tags must be absent | **clean, 0/3 on all four** | **clean** |
| `nursing` | the strong answer, and the discriminating control: one incidental *"we caught early signs"* inside an answer whose decisive act is *"I flagged it"*; a record mismatch with no stated prior belief | **`unresolved_alternative_cause` 2/3 — FALSE POSITIVE**; other tags clean | **clean, 0/3 on all four** |
| `thin` | the thin/weak answer; problem unrelated to three of four tags | clean on the three scored tags | clean |
| `010` | precision control for `unresolved_alternative_cause` — speaker asserts only *sequence*; the causal reading exists solely as a Class C hypothesis SOD is never shown | **clean, 0/3** | **clean, 0/3** |

Two tags were **pre-registered as not scored**, before any run, so that a case
the corpus genuinely exhibits could not be counted as a false positive:
`result_needs_substance` on `thin` (the canonical thin result — detection there
is a true positive; observed 3/3 in both conditions), and
`result_needs_substance` on `010` (genuinely ambiguous; the founder has not
ruled).

---

## 10. False-positive findings

**Revision 0 — one control false positive.** `unresolved_alternative_cause` on
`nursing`, 2 of 3 runs. SOD wrote: *"The speaker attributes the good outcome to
catching sepsis early... while the answer also states the patient was moved to a
higher level of care, a plausible alternative contributor."*

Two distinct defects in one observation:

1. **The attribution does not exist.** The nursing speaker asserts no cause.
   The only admitted relationships are `temporal_sequence` and `enumeration` —
   no causal connective anywhere. SOD supplied the attribution itself.
2. **The "alternative cause" is an outcome.** *"She was moved to a higher level
   of care"* is a `claim_type: outcome`, a later step in the same sequence, not
   a competing explanation.

**Revision 1 — zero control false positives.** All four controls clean on all
scored tags.

---

## 11. False-negative findings

**Revision 0: none.** All four targets 3/3.

**Revision 1: one.** `ownership_dilution` on Case 006 dropped to 2/3 — run 1
returned `{"observations": []}`. This is the experiment's most consequential
result, because **the revision did not touch that tag**. The only change was to
the "does not apply when" clause of `unresolved_alternative_cause`. Tightening
one tag's exclusion criteria destabilised an unrelated tag on its own ground-truth
case: evidence that the tags are **not independently controllable** through a
shared prompt.

**The over-fire the revision was aimed at was reduced, not eliminated:** Case
001's `unresolved_alternative_cause` fell 3/3 → 1/3, and `nursing` fell 2/3 → 0/3.

The 001 over-fire is the same failure class as `nursing`. SOD read
`a_diagnosis1` (*robot force allowed the casting to move*) and `a_diagnosis2`
(*grabbing a rough casting surface was not locating the part consistently*) as
**competing explanations**. They are a causal chain — the rough locating surface
is *why* the force moved the part — and the answer resolves both with one fix.
No admitted relationship connects them as alternatives; SOD inferred the
competition from co-presence.

---

## 12. Grounding and provenance findings

Across all 48 scored runs (24 revision 0 + 24 revision 1):

| Metric | Result |
|---|---|
| Observations proposed | 44 |
| Rejected as untraceable to supplied evidence | **0** |
| Observations citing an id never supplied | **0** |
| Tags outside the fixed vocabulary | **0** |
| Observations with no evidence refs | **0** |
| Parse failures | **0** |
| Void runs (post-fix) | **0** |

Every observation cited real ids. Evidence *reference* discipline was perfect.

**Belief promotion (Case 009, the Atlas requirement): clean in all 6 runs.**
SOD consistently phrased it as attribution — *"The speaker attributes the drop
in complaints to reduced agent stress from added reps... while the concurrent
policy change is an equally plausible cause left unaddressed"* — and in no run
did it declare the policy change causal, declare staffing causal, decide which
explanation was correct, or promote the belief into fact. Criterion 4 is met.

---

## 13. Relationship-fabrication findings

**This is the experiment's most important negative result, and reference
integrity hides it.** The `nursing` and `001` false positives cite only real
ids, so every automated traceability check passes — yet the *claim built on
those ids* is fabricated. SOD asserted "the speaker attributes X to Y" where the
speaker attributed nothing.

This is precisely the prior Class B provenance lesson recurring one level up:
**two real facts do not establish a relationship between them.** The prompt
states that rule explicitly (Hard Rule 2) and SOD violated it anyway, in 5 of 6
runs in revision 0 (`001` ×3, `nursing` ×2).

The revision-1 clause — requiring the attribution to be evidenced by a
`speaker_assertion` claim or an admitted relationship, and requiring the
competing explanation to be a cause rather than another outcome — reduced this
to 1 of 6 runs. It did not eliminate it.

**A concrete discriminator exists in the data.** The one case where the tag is
correct (009) has an admitted `explicit_connective` edge, `b_because`, on the
belief claim, and SOD cited it in all 6 correct firings. The two over-fire cases
have no causal edge at all. That is a structural signal, available in the graph
today, that a future design could require rather than request.

---

## 14. Side-by-side against the existing mechanisms

| Case | Det. candidates | Det. selected → habit | Structured move | Readiness | SOD (rev 0, 3 runs) | Target |
|---|---|---|---|---|---|---|
| **001** | O3_unquantified, O5_vagueness | `O5_vagueness` → **H4** | `highlight_strength` | ready=true | `assumption_reversal` ×3, `unresolved_alternative_cause` ×3 | `assumption_reversal` |
| **005** | O3_missing, **O4_ownership**, O5_vagueness | `O3_missing_result` → **H2** | `highlight_strength` | ready=false | `ownership_dilution` ×3, `result_needs_substance` ×3 | `result_needs_substance` |
| **006** | O3_missing | `O3_missing_result` → **H2** | `request_number` | ready=false | `ownership_dilution` ×3 | `ownership_dilution` |
| **009** | O3_unquantified, **O4_ownership**, O5_vagueness | `O5_vagueness` → **H4** | `request_number` | ready=false | `unresolved_alternative_cause` ×3, `result_needs_substance` ×2 | `unresolved_alternative_cause` |

**What SOD adds.** On all four cases the deterministic mechanisms name
something other than the founder/Atlas target. On 006 the entire ownership
signal is invisible to both existing paths — the frozen path does not even
generate `O4_ownership_hiding` as a candidate, and the structured path asks for
a number on an answer whose problem is not numbers. Criterion 7 is met on the
evidence: SOD produced information the deterministic representation does not
contain.

**What SOD converges with.** On 005 SOD perceives the ownership signal that the
frozen path *does* detect (`O4_ownership_hiding` is a candidate with the pool's
highest confidence, 0.75) but then **suppresses** via the JA-01 root-cause rule
— the mechanism documented as Finding 3 of the Principle Selection Seam
investigation. Two independent paths agreeing on a signal the ranking layer
buries is a meaningful cross-check.

**What SOD misses or invents.** It invents causal attributions (Section 13), and
under revision 1 it loses its own ground-truth target on 006 one run in three.

---

## 15. Newly discovered failure class

**Reference-grounded, claim-fabricated.** An observation can cite exclusively
real, admitted evidence ids and still assert a relationship the learner never
established. Every mechanical traceability check — the deterministic validator
in `detector.ts`, id-set membership, vocabulary membership — passes it.

This class is invisible to reference checking by construction, and it is
*specific to semantic perception*: the earlier grounding work checks whether
words in learner-facing output appear in the evidence, which would also pass
here. The only thing that catches it is comparing the observation's asserted
relation against the admitted relation set — a check that does not exist
anywhere in the repository today.

**Second, smaller class:** cross-tag coupling through a shared prompt (Section
11). Tag definitions in one prompt are not independently tunable; a revision
aimed at one tag moved another tag's stability on a case it never mentioned.

---

## 16. Regression and hard-gate results

| Gate | Result |
|---|---|
| Full suite, 17 packages | **519 passed, 0 failed** — 505 pre-existing (the established baseline) + 14 new SOD tests |
| HF-001 hard gate (`fact_grounding`) live | **PASS** — `move=highlight_strength`, fallback=false, guardrail=true, grounding=true |
| HF-002 hard gate (`attribution_relationship_fidelity`) live | **PASS** — no causal relationship asserted as fact |
| HF-006 grounding reliability | unchanged — required-fabrication detection 2/2, false-positive rate 0/4, known P7 limitation still on record |
| Guardrail | unchanged (`coaching-runtime` 51/51) |
| Existing mechanisms on all 8 experiment cases | **byte-identical** to their pre-SOD values: deterministic opportunity, habit, Teaching Move, readiness all unchanged |

Learner-facing structured-coach behavior is unchanged. This is guaranteed by
construction — nothing in the repository imports `sod-experiment` — and
confirmed by measurement.

---

## 17. Recommendation

### STOP — HYPOTHESIS NOT SUPPORTED at the pre-registered bar

| # | Criterion | Rev 0 | Rev 1 |
|---|---|---|---|
| 1 | Case 001 `assumption_reversal` 3/3 | ✅ | ✅ |
| 2 | Case 005 `result_needs_substance` 3/3 | ✅ | ✅ |
| 3 | Case 006 `ownership_dilution` 3/3 | ✅ | ❌ 2/3 |
| 4 | Case 009 3/3 without promoting either cause | ✅ | ✅ |
| 5 | Proposals attributable to supplied evidence | ✅ | ✅ |
| 6 | No meaningful pattern of unsupported tags on controls | ❌ | ✅ |
| 7 | Adds information the deterministic representation lacks | ✅ | ✅ |
| 8 | Learner-facing behavior unchanged | ✅ | ✅ |
| 9 | Hard gates and regression suite green | ✅ | ✅ |

**Exactly one criterion fails in each condition, and they are different ones.**
The authorized prompt revision is spent, and the criteria may not be redefined
after the fact — so no configuration tested satisfies the pre-registered bar,
and the verdict follows from the rules set before the runs.

**What the evidence does show**, stated plainly so the verdict is not read as
more than it is:

- All four target signals were detected 3/3 in at least one condition, on
  founder- and Atlas-supported ground truth, with zero traceability violations
  across 48 runs.
- Criterion 7 is met decisively. On Case 006 both existing paths are blind to
  ownership; SOD perceived it. On Case 005 SOD independently reproduced a signal
  the frozen path detects and then suppresses.
- The Atlas requirement — noticing causal uncertainty without resolving it —
  was met in all six runs on Case 009.

**What blocks it:**

- A real fabrication class that reference checking cannot see (Section 13/15).
  SOD asserted attributions the speaker never made, in 5 of 6 runs before the
  revision and 1 of 6 after. Since the entire architectural claim is *SOD
  notices, InterviewAce decides*, an SOD that invents what the learner asserted
  corrupts the input to every decision downstream.
- Cross-tag coupling: the tags are not independently controllable through one
  shared prompt, so "fix one tag" is not currently an available move.

**What this argues for — founder's call, not authorized here:** the failure is
specific and has a structural handle. The correct firings on 009 all cite an
admitted causal edge (`b_because`); both over-fire cases have no causal edge at
all. A design that *requires* an admitted relationship rather than asking for
one — and that gives each tag its own call rather than one shared prompt —
addresses both blockers directly. That is a different experiment with a
different pre-registration, not a continuation of this one under a third
revision.

**Do not integrate SOD.** Stopping for founder review.
