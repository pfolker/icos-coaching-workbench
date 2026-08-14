# Class B Live-Admission Investigation

> **Read-only investigation.** The only runtime activity was the pre-registered
> set of fresh Listen calls (Section 8). Nothing was fixed, tuned, or changed:
> no Listen prompt, no Validator rule, no marker vocabulary, no schema, no
> temperature, no thresholds. Where an obvious fix became apparent it is
> documented and left unimplemented.
>
> **This report is uncommitted pending founder review**, per the report-handling
> rule.

**Primary recommendation: CLASS B UPSTREAM ISSUE REQUIRES RESOLUTION BEFORE SOD v0.2.**
The issue is *not* semantic. Listen perceived every target relationship in every
measurable run. The blocker is a mechanical output-budget defect in the shipped
Listen Engine that produced **no usable graph at all in 7 of 20 runs (35%)**,
including **5 of 5 on Case 002**.

---

## 1. Repository starting state

| | |
|---|---|
| Branch | `main` |
| At Step 0 | `4aaea67` — SOD v0.1 experiment; `SOD-DECOMPOSITION-INVESTIGATION.md` untracked |
| Action | committed as `1c585c0`, substance unmodified, and pushed |
| After Step 0 | `main` = `1c585c0`, synced with `origin/main`, clean tree |

---

## 2. Historical-artifact existence assessment

Artifacts located: `evidence-benchmark/reports/` — one fixture report, one live
report (`claude-sonnet-5`, 2026-07-19), one fixture-vs-live diff.

**Preserved:** Class A recall with unmatched ground-truth ids; quote fidelity;
claim_type agreement with per-disagreement detail; additions (id, type, quote);
Class B recall with unmatched ground-truth ids; Class C hard-fail; and a
**rejection tally by code only**.

**Not preserved:** the Listen Class B proposals themselves — no endpoints, no
relationship types, no marker text, no per-rejection linkage, no raw model
output, no `stop_reason`.

> **Historical aggregate Class B scores are not fully forensically
> reconstructable.** We know *that* 001 had 2 `MARKER_NOT_FOUND`, 002 had 2, and
> 009 had 1, and which ground-truth edges went unmatched. We cannot recover what
> Listen actually proposed. Detailed failure ownership for the 2026-07-19 live
> run is **UNFORENSICABLE FROM PRESERVED ARTIFACTS**, and no attempt was made to
> reconstruct it from aggregates, final graphs, later runs, or fixtures.

One inference is safe because it is arithmetic, not reconstruction: Case 001 had
3 unmatched Class B edges but only 2 rejections, so **at least one edge was never
proposed at all** in that run.

**A correction to the historical reading.** Case 001's Atlas ground truth `B1` is
the `contrast_marker` "but" edge — the exact prerequisite for the
assumption-reversal gate — and the live run's unmatched set was `[B2, B3, B4]`.
**B1 matched.** The −0.892 aggregate obscured the fact that on Case 001 the one
gate-relevant edge survived live. The decomposition report's use of the aggregate
to imply gate-relevant loss was too coarse.

---

## 3. Fixture transcript-ground-truth comparison (Phase A)

All three transcripts were read for the three components of a reversal: a prior
belief, a later contradictory finding, and a stated relationship between them.

**Case 001:** *"At first everyone thought it was a programming issue, **but**
after watching the machine run I realized the robot was actually applying force
in a way that allowed the casting to move."* — all three present.

**Case 002:** *"At first everyone thought it was a program issue, **but** after
checking the part straightness with an indicator before and after the deburring
process, I was able to see the part had been moving."* — all three present.

**`founder`:** identical to 002 in this passage — all three present.

> **The relationship is genuinely present in all three transcripts.** Question A
> resolves to YES in every case. None is a CORRECT ABSENCE.

**This corrects the decomposition report's Finding 3.** That report observed that
002 and `founder` carry a `prior_belief` claim with no contrast edge and called it
"an in-repo reproduction of the upstream false-negative channel". The observation
is factually correct but the attribution was wrong:

- `evidence-runtime/fixtures/case002.ts` reproduces *the Atlas's own Case 002
  wording*, and `coaching-runtime/src/founderCase.ts` states its proposals are
  *"adapted from evidence-runtime/fixtures/case002.ts's own reading"*. These
  fixtures are **hand-authored readings, not recorded Listen output.**
- `evidence-benchmark/src/groundTruth.ts` lists Case 002's Class B as only `B5`
  (`"pointed to"`) and `B6` (`"since"`) — **no contrast edge**, despite `A2b`
  recording the prior belief. Its own note says the Atlas section lists only the
  five new claims and the rest were added for completeness.

So the missing 002 contrast edge was a **ground-truth / fixture authoring gap**,
never a measured Listen failure. It was also never counted as a benchmark miss:
002's live Class B recall of 0.00 refers to `B5` and `B6` only.

**The contract was not the obstacle either.** In 002 the gap between the
prior-belief span and the finding span is `", but after checking the part
straightness…"`, which contains `"but"` — a two-component `contrast_marker` edge
there is admissible under the current rules. Phase C confirmed this empirically.

---

## 4. Denominators

| Relationship | Fixture / Atlas denominator | Transcript-validated denominator |
|---|---|---|
| Reversal contrast (001, 002, `founder`) | **1** — only Case 001's `B1` | **3** — all three transcripts communicate it |
| Case 009 causal attribution | 1 (`B1`, self-contained on `A4`) | 1 |

**Two of three transcript-true reversal relationships were never in the expected
set at all.** Had the benchmark been read naively, 002's and `founder`'s reversals
would have been invisible rather than "missed" — the opposite of fixture
over-specification, and equally distorting.

---

## 5. Transcript-truth questions requiring founder adjudication — ADJUDICATED

**One item. It does not affect the denominators above.**

> Passage (Case 001): *"At first everyone thought it was a programming issue, but
> after watching the machine run I realized the robot was actually applying force
> in a way that allowed the casting to move."*
> Case 002 / `founder`: *"At first everyone thought it was a program issue, but
> after checking the part straightness with an indicator…"*

**Relationship in question:** whether the reversal is *the speaker's own*
assumption being overturned, or the speaker correcting a belief held by others.

**Provisional reading:** the words say **"everyone thought"**. They establish a
contrast between a prevailing belief and the speaker's finding. They do **not**
state that the speaker shared that belief. The Evidence Atlas independently
reached the same boundary and filed it as the Case 001 Class C non-admissible
hypothesis: *"the speaker was personally among those who initially believed it
was a programming issue, rather than skeptical from the start."*

**Status: ADJUDICATED — 2026-08-13.** The two readings are recorded separately
below, as the work order requires. Neither is substituted for the other.

### Founder intent (authoritative for this retelling)

Patrick shared the initial programming/software assumption. The reason for
watching the machine run was to determine **what in the program needed
changing** — the observation was undertaken *from inside* the software
hypothesis. What was observed during that process led away from the software
explanation and toward the mechanical cause.

So the reversal was **both personal and room-wide**, and it was reached **through
the diagnostic process itself** rather than by standing outside the prevailing
view from the start.

### Transcript-only reading (unchanged, preserved)

The words say **"everyone thought"**. They establish a contrast between a
prevailing belief and the speaker's finding. They do **not** state that the
speaker shared that belief. A listener with only this transcript cannot recover
the personal half of the reversal. The Evidence Atlas reached the same boundary
independently and filed it as the Case 001 Class C non-admissible hypothesis:
*"the speaker was personally among those who initially believed it was a
programming issue, rather than skeptical from the start."*

### What the gap means

The Class C hypothesis was **correct** — and it remains correctly
non-admissible, because the transcript does not establish it. This is a clean
illustration of the architecture working as designed: the system inferred the
right thing and refused to treat the inference as evidence.

It also means the *coachable* strength here is partly invisible in the words. A
listener cannot tell that the speaker overturned their **own** assumption, which
is the more persuasive version of the story.

### Note for future tag design (recorded, not authorized)

`assumption_reversal` should accommodate **both forms**:

1. **Personal-belief reversal** — the speaker held the belief and overturned it.
2. **Prevailing-assumption reversal** — the speaker overturned a belief held
   around them.

Case 001 is *in fact* both, while its transcript supports only form 2. A tag
definition admitting only form 1 would miss this case on its own words; one
admitting only form 2 would misrepresent what actually happened. Carried forward
to SOD v0.2 design consideration; **not implemented, not authorized here.**

This adjudication does not change whether the contrast relationship exists — it
plainly does, and the gate depends only on that. No denominator, rate, or
viability verdict in this report changes.

---

## 6. Phase C — fresh live runs

Pre-registered: 5 independent live Listen calls per anchor, same provider, model
and configuration the evidence benchmark uses (`runListenEngineLive`,
`claude-sonnet-5`, `max_tokens: 4096`). No tuning between runs. `founder` was
included because Phase A confirmed the target relationship is genuinely present.

### 6.1 A new failure class: output-budget truncation

**7 of 20 runs (35%) produced no parseable output at all**: 001 ×1, 002 ×5,
009 ×1, `founder` ×1.

Direct diagnosis (two additional calls, capturing the raw envelope) confirmed the
mechanism:

| Case | `stop_reason` | output tokens | of which thinking | text block |
|---|---|---|---|---|
| 002 | `max_tokens` | 4096 | 2,971 | truncated mid-string |
| 001 | `max_tokens` | 4096 | 3,528 | truncated mid-string |

The model spends 2,971–3,528 of its 4,096-token budget reasoning, leaving too
little to emit the JSON, which is cut mid-token. This is **not** perception,
representation, or validation. It is a delivery failure, and it is the same
mechanical class as the void runs found in SOD v0.1 — this time in the **shipped
Listen Engine at its configured budget**.

**Documented, not implemented** (Section 19): the apparent fix is Listen's
`max_tokens` in `evidence-runtime/src/listenEngine.ts:72`.

**The truncated runs were still forensically usable.** `parseModelJson` persists
the full raw response on failure to
`evidence-runtime/logs/listen-engine-parse-failures.log` — an existing diagnostic
that turned out to be the most valuable artifact in this investigation. The Class
B proposals were recovered verbatim from the truncated text.

### 6.2 Verbatim proposals recovered from truncated Case 002 runs

All five show the contrast edge Listen was in the middle of emitting:

```
run 1  {"proposal_id": "b_contrast_belief_vs_finding", "relationship_type": "contrast_marker", "components …   [cut]
run 2  { "proposal_id": "b1_contrast_belief", "relationship_type": "contrast_marker",
         "components": ["p2_prior_belief", "p4_outcome_moving"], "marker_text": "but" }
run 3  { "proposal_id": "b1_contrast_belief_check", "relationship_type": "contrast_marker",
         "components": ["a2_prior_belief", "a3_action_check"], "marker_text": "but" }
run 4  { "proposal_id": "b1", "relationship_type": "contrast_marker",
         "components": ["a2", "a3"], "marker_text": "but" }
run 5  { "proposal_id": "b_contrast_program_vs_gripper", "relationship_type": "contrast_marker",
         "components": ["prior_belief_program_issue", "self_reported_diagnosis_part_moving"],
         "marker_text": "but" }
```

> **Case 002 semantic perception of the reversal: 5/5.** Its live Class B
> availability of 0/5 is caused entirely by truncation, not by failure to see
> the relationship.

### 6.3 Rate table

Denominator is 5 attempted runs per anchor; "usable" excludes truncated runs.

| Measure | 001 | 002 | 009 | `founder` |
|---|---|---|---|---|
| Runs usable | 4/5 | **0/5** | 4/5 | 4/5 |
| Transcript-truth positive | yes | yes | yes | yes |
| **Semantic perception** of target | 4/4 usable (run 4 truncated before Class B) | **5/5** (from failure logs) | 5/5 | 5/5 |
| **Contract-valid representation** | 3/4 usable | unmeasurable | 3/4 usable | 4/4 usable |
| Target relationship **admitted** | 3/5 | 0/5 | 3/5 | 4/5 |
| Validator rejections of semantically correct proposals | 1 | — | 1 | 5 |
| Representation-mismatch rate | 1/4 usable | unmeasurable | 1/4 usable | 5 rejections across 4 runs |
| False-positive relationships | none observed | — | none observed | none observed |
| **Strict gate availability (as proposed)** | **3/5** | **0/5** | **0/5** | **4/5** |

No admitted relationship in any run asserted a link the transcript does not
support. (Assessed by reading every admitted edge, not by a mechanical measure.)

---

## 7. `MARKER_NOT_FOUND` analysis

Nine of the ten rejections across 20 runs were `MARKER_NOT_FOUND`; the tenth was
`ENUMERATION_INVALID`. Verbatim reasons, three distinct sub-causes:

**(a) Connective swallowed into the component quote — 2 instances.**

```
001 run 5   proposal: {"relationship_type":"contrast_marker",
                       "components":["prior_belief_programming","diagnosis_robot_force"],
                       "marker_text":"but"}
            prior_belief_programming : "At first everyone thought it was a programming issue"
            diagnosis_robot_force    : "but after watching the machine run I realized the robot
                                        was actually applying force in a way that allowed the
                                        casting to move."
            REJECTED [MARKER_NOT_FOUND] "but" does not appear in the transcript between the two
                                        referenced components.
```

The relationship is correct. Listen began the second quote **with** the marker,
so the gap between the spans is `", "` and contains no `"but"`. The Validator is
right.

**(b) Marker outside the fixed vocabulary — 2 instances.**

```
founder run 1 / run 3
   REJECTED [MARKER_NOT_FOUND] marker_text "This pointed to" is not one of the fixed
                               explicit_connective phrases.
```

`"pointed to"` is in the list; `"This pointed to"` is not. The relationship is
correct and the marker is genuinely present in the transcript; only the
demonstrative makes the string fail an exact-membership test. **This is the one
place the contract looks narrower than legitimate learner language** — not
because the vocabulary is too small, but because matching is exact rather than
normalized. Documented, not fixed.

**(c) Components chosen too far apart — 5 instances** (`"since"`, `"because"`,
`"pointed to"` on `founder`; `"because"` on 009 run 5). The marker exists in the
transcript but not in the gap between the two chosen spans.

> **In all nine, the relationship was semantically present, the proposal was
> contract-invalid, and the Validator behaved correctly under its contract.**
> Zero validation failures. `MARKER_NOT_FOUND` in this corpus does not mean "the
> model hallucinated a relationship" and does not mean "the Validator is buggy" —
> it means **the model expressed a real relationship in a shape the contract
> cannot admit.**

---

## 8. Case 009 — gate viability

**Transcript support:** explicit. *"I think the complaints dropped **because**
agents were less stressed after we also added two more support reps that same
month."*

**Perception:** 5/5 runs proposed a causal `explicit_connective` with marker
`"because"`.

**Representation — and the decisive discovery:** live Listen consistently
proposes the causal link as a **two-component bridge**, not as the
self-contained edge the Atlas fixture uses:

| Run | Proposal | Validator |
|---|---|---|
| 1 | `because` [`a2_outcome_complaints_dropped`, `a5_diagnosis_less_stressed`] | **ADMITTED** |
| 3 | `because` [`a2_complaints_dropped`, `a4_agents_less_stressed`] | **ADMITTED** |
| 4 | `because` [`a3_outcome_subquote`, `a4_diagnosis_less_stressed`] | **ADMITTED** |
| 5 | `because` [`a2_complaints_dropped`, `a3_diagnosis`] | REJECTED `MARKER_NOT_FOUND` (marker sits inside `a3`'s own quote) |
| 2 | — | truncated |

> **The causal relationship is admitted into the graph in 3 of 5 runs.**
> The strict gate proposed in the decomposition report nonetheless scores **0/5** —
> because it requires **every** component to have `speaker_assertion == true`, and
> live Listen always pairs the speaker-asserted explanation with a
> **non**-speaker-asserted outcome claim.

The gate predicate was written against the *fixture's* self-contained shape. Live
Listen decomposes. The prerequisite is available; the predicate does not
recognise it.

A relaxed predicate — *a causal `explicit_connective` at least one of whose
components is a `speaker_assertion=true` `self_reported_diagnosis`* — is satisfied
in **3 of 5** runs. Recommended for consideration; **not implemented here.**

**Pre-registered interpretation (Section 11 of the work order), applied without
adjustment:**

| Predicate | Availability | Verdict |
|---|---|---|
| Strict `b_because` gate as proposed | **0/5** | **STRICT GATE NOT CURRENTLY VIABLE** |
| Relaxed causal predicate | 3/5 | **AMBIGUOUS / UNRESOLVED** — the failure mechanism *is* understood and relaxation has architectural support, so this resolves to *"Shape C viable but gate relaxation should be considered"* |

**Failure owner:** representation/contract mismatch (Class C) in run 5;
**predicate mis-specification** — a design fault in the proposed gate, not in
Listen or the Validator — in runs 1, 3 and 4.

---

## 9. Assumption reversal — gate viability

Gate: a `prior_belief` claim plus an admitted `contrast_marker` edge touching it.

| Anchor | Perception | Admitted | Pre-registered verdict |
|---|---|---|---|
| Case 001 | 4/4 usable | **3/5** | **AMBIGUOUS / UNRESOLVED** |
| `founder` | 5/5 | **4/5** | **VIABLE SIGNAL for higher-n v0.2 testing** |
| Case 002 | **5/5** | **0/5** | 0/5 → *not viable* **by the letter** |

**Case 002's 0/5 must not be read as a gate result.** Every one of its five runs
was lost to output truncation before the graph existed; the recovered proposals
show the contrast edge being emitted in all five. Applying the 0–1/5 label
without naming the mechanism would attribute a Listen-wide mechanical defect to
the reversal gate. The pre-registered mapping assumed runs produce output; that
assumption failed, and the honest reading is **unmeasurable**, with the raw
number reported above unaltered.

Aggregating the three anchors' usable runs: the prerequisite was admitted in
**7 of 12 usable runs**, and every miss traces to representation (marker inside
the quote) rather than perception.

**Is `prior_belief + admitted contrast` viable in production today?** Not at the
strict level, and not measurable at all until truncation is fixed. The evidence
does support investigating the relaxed form the work order names — *`prior_belief`
establishes eligibility, and the semantic detector judges whether a genuine
reversal occurred* — which would have been eligible in **12/12 usable runs**,
since a `prior_belief` claim was admitted in every one. **Recommended for SOD v0.2
design consideration only; not authorized or implemented here.**

---

## 10. Chain-of-ownership tables

**Case 009 — causal attribution**

| Field | Answer |
|---|---|
| Relationship present in transcript? | Yes |
| Founder adjudication required? | No |
| Ground-truth basis | *"I think the complaints dropped because agents were less stressed…"* |
| Listen perceived? | Yes — 5/5 |
| Exact proposal | `explicit_connective`, `"because"`, 2-component bridge (Section 8) |
| Semantically correct? | Yes |
| Contract-valid? | Yes in runs 1/3/4; **No** in run 5 |
| Validator result | Admit ×3, Reject ×1, n/a ×1 |
| Validator reason | `MARKER_NOT_FOUND` — *"because does not appear in the transcript between the two referenced components."* |
| Validator correct? | **Yes** |
| Immediate rejection owner | Listen representation (run 5); **gate predicate** (runs 1/3/4) |
| Cross-layer mismatch? | Yes — fixture-shaped predicate vs live-shaped proposal |
| Primary outcome class | **C** (run 5); the strict-gate misses are a design fault, not A–E |
| Downstream consequence | Strict `unresolved_alternative_cause` eligibility unavailable, despite the relationship being in the graph |

**Cases 001 / 002 / `founder` — reversal contrast**

| Field | 001 | 002 | `founder` |
|---|---|---|---|
| Present in transcript? | Yes | Yes | Yes |
| Founder adjudication? | Yes — *whose* belief (Section 5) | same | same |
| Listen perceived? | Yes 4/4 usable | **Yes 5/5** | Yes 5/5 |
| Semantically correct? | Yes | Yes | Yes |
| Contract-valid? | 3/4 usable | unmeasurable | 4/4 usable |
| Validator result | Admit ×3, Reject ×1 | none reached | Admit ×4 |
| Validator reason | `MARKER_NOT_FOUND` — *"but does not appear… between the two referenced components."* | — | — |
| Validator correct? | Yes | — | Yes |
| Immediate rejection owner | Listen representation | **N/A — truncation** | N/A |
| Primary outcome class | **C** | **new class — delivery truncation** | — |
| Downstream consequence | gate unavailable in 2/5 runs | gate unavailable in 5/5 | gate available 4/5 |

---

## 11. Failure-owner distribution

Across 20 runs, 10 rejections and 4 target-relationship misses:

| Owner | Count |
|---|---|
| **A. Correct absence** | 0 |
| **B. Capability / perception failure** | **0** |
| **C. Representation / contract mismatch** | **10** (9 `MARKER_NOT_FOUND`, 1 `ENUMERATION_INVALID`) |
| **D. Validation / admission failure** | **0** |
| **E. Genuinely ambiguous** | 0 (one *semantic* ambiguity escalated, Section 5) |
| **New — delivery truncation** | **7 runs (35%)** |
| **New — gate predicate mis-specification** | 3 runs (009) |

---

## 12. Architectural diagnosis

**Not primarily model-capability limited.** Listen perceived the target
relationship in every measurable run of every anchor — 100%. Nothing here
supports "the model cannot see these relationships".

**Primarily representation limited.** The model reliably possesses the semantic
capability and loses it at the interface: connectives swallowed into component
quotes, demonstratives prepended to markers, endpoints chosen too far apart,
self-contained relations emitted as two-component bridges.

**Not Validator-contract limited in the strict sense** — zero incorrect
rejections. One narrowness worth noting: exact rather than normalized marker
matching (`"This pointed to"`).

**Plus a mechanical delivery defect that dominates everything else in
practice** — 35% of runs produced nothing at all.

**Verdict: mixed / cross-layer, with representation the dominant semantic owner
and truncation the dominant practical owner.**

### Which failures stronger models would plausibly improve
Representation discipline — quote boundaries that exclude the connective, marker
strings matching the fixed list, endpoint selection adjacent to the marker. These
are instruction-following behaviours.

### Which would not improve from a stronger model
- **Truncation.** A budget configuration, and stronger reasoning models plausibly
  make it *worse* by thinking longer.
- **Gate predicate mis-specification.** A design fault in the gate.
- **Exact marker matching.** A contract property.
- **Ground-truth gaps** like Case 002's absent contrast edge.

---

## 13. SOD Shape C viability decision

> ### B. SHAPE C VIABLE, BUT GATES REQUIRE RELAXATION

The architecture is sound and the evidence strengthens its rationale: Class B
relationships genuinely exist in the graph and are admitted at a usable rate once
the truncation defect is set aside. What fails is the **strictness of the two
proposed predicates**, both of which were written against fixture shapes rather
than live Listen output.

Gates requiring reconsideration (**not redesigned here**):

1. **`unresolved_alternative_cause`** — drop the "all components speaker-asserted"
   requirement; live Listen always pairs a speaker-asserted explanation with a
   non-speaker-asserted outcome. 0/5 → 3/5 on the same runs.
2. **`assumption_reversal`** — the `contrast_marker` edge requirement costs 5/12
   usable runs to representation faults; `prior_belief` alone was admitted 12/12.

---

## 14. New failure classes discovered

1. **Output-budget truncation in the shipped Listen Engine.** 35% of runs, 5/5 on
   Case 002, `stop_reason: max_tokens` with 73–86% of the budget spent thinking.
   Not perception, representation, or validation — a fourth channel the A–E
   taxonomy does not cover.
2. **Fixture-shaped predicates against live-shaped proposals.** A gate can be
   satisfied 100% on fixtures and 0% live while the underlying relationship is
   admitted in most runs. Any gate must be validated against live output before
   its availability number means anything.
3. **Ground-truth omission masquerading as availability.** Case 002's transcript
   contains a contrast relationship that neither the Atlas ground truth nor the
   runtime fixture records, so it could never be scored as missing. Benchmark
   recall cannot see relationships it was never told to expect.
4. **Class B recall is not the same measure as gate availability.** Recall matches
   the Atlas's exact component set; a gate asks whether a relationship of the
   right kind exists. Case 009 scores 0.00 recall in runs where the causal edge is
   admitted.

---

## 15. Answers to the eighteen questions

1. **Were 002's and `founder`'s suspected missing relationships present?** Yes, in both transcripts, explicitly marked with "but".
2. **Which transcript-truth calls need adjudication?** One: whether "everyone thought" includes the speaker. **Adjudicated 2026-08-13** — it does; the reversal was both personal and room-wide, reached through the diagnostic process itself. The transcript-only reading is preserved separately (Section 5).
3. **How many fixture "misses" were correct absences?** Zero. The opposite problem appeared — two transcript-true relationships were never in the expected set.
4. **Did the historical benchmark preserve enough for forensics?** No.
5. **What is unrecoverable?** Every historical Class B proposal: endpoints, relationship types, marker text, and which proposal each `MARKER_NOT_FOUND` belonged to.
6. **Recorded-live miss classification?** Not classifiable from preserved artifacts; evidentiary weight moved to Phase C as pre-registered.
7. **What does `MARKER_NOT_FOUND` mean here?** A real relationship expressed in an inadmissible shape — three sub-causes (Section 7). Never a hallucination; never a Validator bug.
8. **How often is perception right but expression inadmissible?** 10 of 10 rejections; ~1 in 4 usable runs per anchor, higher on `founder`.
9. **How often does the Validator reject a semantically correct *and* contract-valid relationship?** **Zero times.**
10. **Is the Validator behaving correctly?** Yes, in all 20 runs.
11. **Is the contract too narrow?** Only in one respect: exact rather than normalized marker matching (`"This pointed to"`).
12. **Measured final graph availability for gate-required relationships?** 009 causal edge 3/5; reversal contrast 3/5 (001), 4/5 (`founder`), 0/5 (002, truncation).
13. **Strict `b_because` viable for 009?** **No — 0/5, STRICT GATE NOT CURRENTLY VIABLE.** The relationship is nonetheless admitted 3/5; the strict predicate does not recognise the live shape.
14. **`prior_belief + contrast` viable?** 001 ambiguous (3/5), `founder` viable signal (4/5), 002 unmeasurable. Not viable at the strict level today.
15. **What stronger models would improve:** representation discipline.
16. **What they would not:** truncation, predicate mis-specification, exact marker matching, ground-truth gaps.
17. **Does Shape C remain viable?** Yes — with relaxed gates.
18. **Strict, relaxed, or wait?** Relax, **after** the truncation defect is resolved.

---

## 16. Final recommendation

> # CLASS B UPSTREAM ISSUE REQUIRES RESOLUTION BEFORE SOD v0.2

### What the evidence proved

- Listen **perceives** every target relationship reliably — 100% of measurable
  runs across four anchors. Class B degradation is not a perception problem.
- The Validator is **correct in every observed case**: zero incorrect rejections
  in 20 runs.
- All 10 rejections are **representation/contract mismatches**, with three
  precisely identified sub-causes.
- A **mechanical output-budget defect** in the shipped Listen Engine destroys 35%
  of runs and 100% of Case 002, at `evidence-runtime/src/listenEngine.ts:72`.
- The **strict gates proposed in the decomposition report are not viable as
  written** — 0/5 for the causal gate — while the underlying causal relationship
  is admitted in 3/5 runs. The gates were written against fixture shape.
- Case 002's "missing" contrast edge was a **ground-truth authoring gap**, not a
  Listen failure — correcting the decomposition report's Finding 3.
- Case 001's gate-relevant edge (`B1`) **survived the historical live run**; the
  −0.892 aggregate obscured that.

### What the evidence did not prove

- Nothing about the 2026-07-19 live run's failure ownership — those artifacts are
  unforensicable.
- Nothing about Case 002's live admission rate — 0 of 5 runs were measurable.
- Nothing about production reliability at any anchor: n=5 was pre-registered to
  separate *catastrophic* from *plausible*, not to estimate a rate.
- Nothing about whether truncation caused the historical Class B degradation;
  `stop_reason` was never recorded.
- Nothing about whether the relaxed predicates work — they were computed against
  these runs, not tested as a design.

### Immediate next decision for founder review

1. ~~Adjudicate the "everyone thought" reading.~~ **Done 2026-08-13** (Section 5).
   Carries one forward item: `assumption_reversal` must accommodate both the
   personal-belief and prevailing-assumption forms.
2. **Decide** whether to authorize a separate, minimal work order for the Listen
   truncation defect. Until it is resolved, no eligibility number — in v0.2 or
   anywhere — can be trusted, because 35% of runs yield no graph at all.
3. **Decide** whether SOD v0.2 pre-registers the relaxed predicates identified in
   Sections 8 and 9, re-measured live after the truncation fix.

**Not authorized by this report.** Nothing above is an instruction to implement.
