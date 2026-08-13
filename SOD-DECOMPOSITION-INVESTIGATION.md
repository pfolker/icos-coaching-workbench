# SOD Decomposition Investigation

> **Read-only investigation. Nothing implemented.** No detector, no eligibility
> gate, no relationship validator, no prompt, no experimental call.
>
> This is groundwork for a possible **SOD v0.2** experiment. It is not a third
> revision of v0.1. The v0.1 verdict stands exactly as recorded:
> **STOP — HYPOTHESIS NOT SUPPORTED at the pre-registered bar.**
> A fair one-line summary of v0.1 is *"semantic capability supported;
> monolithic configuration did not meet the pre-registered bar"* — that summary
> does not replace the verdict.

**Final recommendation: v0.2 EXPERIMENT WARRANTED**, with one mandatory
addition the v0.1 design did not contain — see Section 10. The headline reason
is Section 8: **the eligibility gates that look strongest against the fixture
corpus depend on the single least reliable part of the live pipeline**, and
v0.1 never touched live Listen output.

---

## 1. Method

Candidate eligibility predicates were evaluated deterministically over all 15
`coaching-calibration` cases — no model calls. Upstream reliability figures are
the measured live-versus-fixture numbers already recorded in
`evidence-benchmark/README.md`, not estimates.

---

## 2. `unresolved_alternative_cause` (4A)

| | |
|---|---|
| **Anchor** | Case 009 (Atlas) |
| **Controls** | `nursing` (v0.1 false positive), `010` (precision control), Case 001 (v0.1 over-fire) |
| **Structural signals available** | `explicit_connective` edges with a validator-fixed marker vocabulary; `marker_text`; `component_ids`; `speaker_assertion` per claim; `claim_type` |
| **Not available** | which claims are *candidate causes* versus *steps in one chain*; any encoding of "same period" |

**Proposed eligibility predicate** (analysis only):

```
attribution_edge = ∃ edge e :
    e.relationship_type == "explicit_connective"
  ∧ e.marker_text ∈ {because, since, led to, resulted in, as a result, pointed to}
  ∧ ∀ id ∈ e.component_ids : node(id).speaker_assertion == true
eligible = attribution_edge ∧ (∃ node : claim_type ∈ {outcome, business_value})
                            ∧ (∃ node ∉ attribution_edge : claim_type ∈ {action, decision, context_fact})
```

The `speaker_assertion == true` conjunct is what does the real work, and it is
sharper than the `b_because` precedent as stated in the v0.1 report. **Case 001
also has a `because` edge** (`b_because_value`) — but it hangs on
`a_business_value`, whose `speaker_assertion` is `false`. Case 009's `b_because`
is self-contained inside `a_belief`, `speaker_assertion=true`. The distinction
is not "has a causal edge"; it is "the *speaker* asserted the cause".

**Corpus result — eligible on 3 of 15 cases: 002, 009, founder.**

> **Could a deterministic gate have prevented every observed v0.1 causal
> over-fire without preventing the valid Case 009 detection? Yes.**
> Case 009 → eligible. Case 001 → **ineligible** (`attr=0`). `nursing` →
> **ineligible** (no `explicit_connective` edge of any kind; only
> `temporal_sequence` and `enumeration`). Both v0.1 over-fires are blocked
> before an LLM is called, and the true positive survives.

The second half of the v1 prose rule — *the competing explanation must be a
cause, not another outcome* — also becomes structural: `nursing`'s nominated
alternative was `a_outcome1` ("moved to a higher level of care"), which
`claim_type` alone excludes from the candidate set.

**What the predicate proves:** the speaker asserted a cause, an outcome exists,
and at least one other admitted claim is cause-shaped.
**What it does not prove:** that the other claim is *plausible* as a cause of
*this* outcome, that the two are genuinely competing rather than sequential, or
that the uncertainty is worth coaching.

**Residual semantic question:** *"Is the unaddressed cause-shaped claim a
plausible alternative explanation for this specific outcome, or is it part of
the same chain?"* Genuine judgment — this is exactly what SOD got wrong on 001,
where two diagnoses form a chain (the rough locating surface is *why* the force
moved the part).

**False-positive risk:** low after gating; the residual chain-versus-alternative
error remains and is the LLM's to make.
**False-negative risk:** high, and mostly upstream — see Section 8.
**Independent detector:** yes. **Needs an LLM:** yes.

---

## 3. `ownership_dilution` (4B)

| | |
|---|---|
| **Anchor** | Case 006 |
| **Controls** | `nursing` (incidental "we"), `sales`, `010` |
| **Structural signals available** | pronouns *inside the admitted quotes* (verbatim text); `claim_type` (`action` / `decision` identify agency-bearing claims); `enumeration` edges pairing claims |
| **Not available in the graph** | any agency field. The Observation Engine *does* compute `first_person_singular`, `first_person_plural` and `agency_verb_i_count` (`observation-engine/src/observers.ts:94`), but over the **raw transcript**, in a different pipeline from SOD's input. |

The signal is not missing — it is unpromoted. Agency can be classified
deterministically per claim by matching the claim's own admitted quote, with no
transcript access, no Listen change, and no frozen-engine change.

**Proposed eligibility predicate** (analysis only), restricted to agency-bearing
claim types:

```
agency = { n ∈ nodes : n.claim_type ∈ {action, decision} }
mark(n) = team if quote matches (the team|my team|everyone|…)
          I    if quote matches (I|my|me)
          we   if quote matches (we|our|us)
eligible = (∃ I ∧ ∃ (we ∨ team))          // mixed attribution
         ∨ (agency ≠ ∅ ∧ ∄ I ∧ ∃ (we ∨ team))  // no individual agency at all
```

**Corpus result — eligible on 5 of 15: 004, 005, 006, checkout, support.**

Both v0.1 anchors land correctly, by *different* arms: **006 → mixed**
(`[I, I, team, we]`), **005 → plural-only** (`[we, we]`).

The controls are the interesting part:

- **`nursing` → ineligible.** Its agency claims are `[I]` only. The
  *"we caught early signs of sepsis"* that made it a discriminating control is
  a `self_reported_diagnosis`, not an `action`/`decision`, so restricting the
  comparison to agency-bearing claim types excludes it structurally.
- **`sales` → ineligible** (`[I, I]`). **`010` → ineligible** (`[I]`).
- **Case 009 → ineligible** (no `action`/`decision` claims at all), which
  structurally blocks the stray `ownership_dilution` v0.1 emitted there.

The structural condition is deliberately **not** the diagnosis. "Both
individual and shared language are present" is true of `support`
(`[I, -, we, I, -]`), where the "we" is the incidental *"what went wrong with
the packaging on our end"*.

**What the predicate proves:** the answer contains agency-bearing claims whose
attribution is mixed or wholly shared.
**What it does not prove:** that the learner's individual contribution is
*materially* unclear.
**Residual semantic question:** *"Does this mixture actually leave a reader
unable to tell what the learner personally did?"*

**False-positive risk:** moderate — `support` and `004` are eligible and are
probably negatives. **False-negative risk:** agency expressed without pronouns
(passive voice, named roles) is invisible to a pronoun match; and a genuinely
diluted answer whose actions are never admitted as `action`/`decision` claims
never becomes eligible.
**Independent detector:** yes — and the most robust of the four, because it
depends only on Class A claims and their verbatim quotes.
**Needs an LLM:** yes.

---

## 4. `assumption_reversal` (4C)

| | |
|---|---|
| **Anchor** | Case 001 / HF-001 |
| **Controls** | `nursing` (record mismatch, no stated prior belief), `sales` |
| **Structural signals available** | `prior_belief` claim type; `contrast_marker` edges with a validator-fixed marker list; the partner claim's `claim_type` |
| **Not available** | whether the overturned belief was the *learner's own* or someone else's |

**Proposed eligibility predicate:**

```
eligible = (∃ n : n.claim_type == "prior_belief")
         ∧ (∃ e : e.relationship_type == "contrast_marker"
                 ∧ e.component_ids ∩ prior_belief_ids ≠ ∅)
```

**Corpus result — eligible on 2 of 15: 001 and checkout.** In both, the contrast
partner is a `self_reported_diagnosis` — the reversal shape exactly.

> **If the graph has already admitted the prior belief and the contrast
> relationship, what semantic judgment remains?** Very little *detection*. The
> structure comes close to being the tag. Two residual questions survive, and
> neither is about whether a reversal occurred:
>
> 1. **Whose belief was overturned?** Case 001's prior belief is *"everyone
>    thought it was a programming issue"* — the graph cannot say whether the
>    speaker was among "everyone". The Validator noticed exactly this and filed
>    it as the Class C hypothesis *"the speaker was personally among those who
>    initially believed…"*, which is non-admissible and never shown to SOD.
> 2. **Is it a coaching-worthy strength**, or an incidental correction?
>
> **This tag is the strongest candidate in the set for "may not require an LLM
> at all."** A deterministic rule over `prior_belief` + `contrast_marker` +
> partner `claim_type` would have detected Case 001 on every run, with no
> sampling variance and no fabrication surface. The governing principle applies
> even though it removes work from SOD.

**The catch is upstream, and it is severe — see Section 8.** Cases 002 and
`founder` (the founder's actual retry of this same story) have a `prior_belief`
claim and **no contrast edge at all**, so this predicate rules them ineligible.
The same story, told again, loses the structure the gate depends on.

A relaxed variant — `prior_belief` alone, no edge required — is eligible on 4 of
15 (001, 002, founder, checkout) and recovers those cases, at the cost of
handing the LLM the reversal-versus-mere-surprise judgment that the contrast
edge would otherwise have proved.

**Independent detector:** yes. **Needs an LLM:** *possibly not for detection* —
only for materiality, and only if the founder wants materiality judged at all.

---

## 5. `result_needs_substance` (4D)

| | |
|---|---|
| **Anchor** | Case 005 |
| **Counterexample that must not be downgraded** | Case 001 (rich, unquantified) |
| **Structural signals available** | `claim_type ∈ {outcome, business_value}`; `quantity_binding` edges; numerals in quotes |
| **Not available** | any measure of whether a result is consequential |

The five states in the work order map onto structure unevenly:

| State | Structurally decidable? |
|---|---|
| 1. no result at all | **Yes** — no `outcome`/`business_value` claim |
| 2. result-shaped language | **Yes** — such a claim exists |
| 3. concrete but unquantified | **No** — "concrete" is not represented |
| 4. quantified | **Yes** — `quantity_binding`, or a numeral in the quote |
| 5. semantically weak | **No** — this is the whole question |

**Proposed eligibility predicate — deliberately the weakest of the four:**

```
eligible = ∃ n : n.claim_type ∈ {outcome, business_value}
```

**Corpus result — eligible on 12 of 15.** Ineligible: 006, 007, 008 — the three
answers with no result-shaped claim at all.

That narrow exclusion is nonetheless the one genuine structural contribution
here, and it is a distinction the current readiness predicate **conflates**:
`computeResultReadiness` returns `false` both for "no result" and for "thin
result", which are different coaching situations.

**A quantity-based exclusion was tested and is not recommended.** Adding
*"and not all result claims carry a number"* drops eligibility to 10 of 15 by
excluding `sales` and `010` — but that reconstructs `has_quantity → readiness`
under a new name, and the founder's own Case 001 is the standing proof that a
number is not the test. A quantified-but-meaningless result would never be
asked about. **The gate should not look at numbers.**

Case 001 is eligible under the recommended predicate, which is correct:
eligibility is not diagnosis, and across all six v0.1 runs the LLM declined to
tag Case 001 (0/3 in both conditions).

**Residual semantic question:** *"Does the stated result communicate meaningful
effect?"* — essentially the entire tag.
**Independent detector:** yes, but with the least structural support.
**Needs an LLM:** yes, unavoidably.

---

## 6. Relationship-level admission check

Reference validity is insufficient (Finding C). v0.1's validator proves *cited
ids exist*; it cannot distinguish an observation that reports an admitted
relationship from one that invents a relationship between two admitted facts.

**1 & 2 — the additional field.** SOD would return, per observation, a
declared relationship dependency:

```ts
relationship_claim?: {
  asserted: "causal_attribution" | "contrast_reversal" | "co_attribution";
  supporting_edge_ids: string[];   // must be ADMITTED Class B edge ids
}
```

Yes — SOD can and should cite an admitted `edge_id` when an observation depends
on a relationship. The v0.1 data shows it already does so spontaneously when one
exists: all six correct Case 009 firings cited `b_because`, and all three
Case 001 `assumption_reversal` firings cited `b_contrast_belief`.

**3 — can a validator reject relationship-dependent observations with no
supporting admitted edge? Yes**, deterministically, with no model involvement:
if `asserted` is in the relationship-dependent set and `supporting_edge_ids` is
empty or cites edges whose `relationship_type`/`component_ids` do not match the
assertion, reject.

**4 — which tags genuinely require admitted relationship evidence:**

| Tag | Requires an admitted edge? |
|---|---|
| `unresolved_alternative_cause` | **Yes** — the attribution is a relationship |
| `assumption_reversal` | **Yes** for the reversal itself (`contrast_marker`) |
| `ownership_dilution` | **No** — grounded entirely in claims and their quotes |
| `result_needs_substance` | **No** — a judgment about a single claim |

**5 —** the two claim-only tags are exactly the two that do not need this
mechanism, and (Section 8) the two that survive live Listen best.

**6 — would it have rejected the v0.1 `nursing` over-fire? Yes, deterministically.**
`nursing` has no `explicit_connective` edge; SOD cited only claim ids while
asserting *"the speaker attributes the good outcome to catching sepsis early."*
No supporting edge exists, so the observation is rejected without judgment.

**7 — would it have rejected the v0.1 Case 001 over-fire? Yes.** SOD cited
`a_diagnosis1`, `a_diagnosis2` and action/outcome claims — all real — while
asserting a competition between two diagnoses. No admitted edge connects them at
all. Rejected.

**8 — could it over-reject legitimate interpretation? Yes, and this is the
central risk.** If Listen fails to propose a relationship that genuinely exists
in the transcript, a correct semantic observation is rejected as fabrication.
The two failures are indistinguishable at the validator: both look like "no
supporting edge". This is why Section 8's ledger separation is not bookkeeping
pedantry — without it, upstream admission failure is silently recorded as
detector fabrication.

---

## 7. Architecture comparison

Eligibility counts per case (recommended predicates, 15 cases): mean **1.47**
eligible tags per answer, max **3** (checkout), min **0** (007, 008).

| | **A — shared SOD** | **B — per-tag, ungated** | **C — gated per-tag** |
|---|---|---|---|
| Calls / answer | 1 | 4 | **1.47 mean, 0–3 observed** |
| Prompt complexity | 4 definitions + 5 shared rules in one prompt | 1 definition per call | 1 definition per call, plus a precondition already proven |
| Cross-tag interaction risk | present by construction | none | none |
| Tuning isolation | none — one prompt serves all tags | per tag | per tag |
| Auditability | tag + refs | tag + refs | tag + refs + **the gate's structural reason for asking** |
| Fabrication surface | full | full | **reduced before the call** — 001 and `nursing` never reach a causal detector |
| Upstream dependency | uniform | uniform | **concentrated in the gates**, and therefore measurable |
| Run-to-run isolation | shared sampling context | isolated | isolated |

Shape C is not preferred merely because this investigation is framed around
decomposition. It is preferred because of Finding D: the two v0.1 over-fires
are *structurally* excludable, and asking an LLM to remember a precondition in
prose is what failed. Shape C also costs **less than Shape B and only ~1.5× A**
in calls, while doing strictly more filtering.

**Shape C's real cost is honesty about upstream:** it converts a semantic
failure mode into an eligibility failure mode. That is an improvement only if
eligibility failures are measured, which is why they get their own ledger.

---

## 8. Upstream Listen / admission dependency — the decisive finding

Every gate inherits the reliability of the Listen Engine's proposals and the
Validator's admissions. The repository already measures this, and the numbers
are not favourable.

From `evidence-benchmark/README.md` (fixture → **live**, 3 cases):

| Case | Class A recall | claim_type agreement | **Class B recall** |
|---|---|---|---|
| 001 | 1.00 → 0.92 | 1.00 → 1.00 | **0.75 → 0.25** |
| 002 | 1.00 → 1.00 | 1.00 → 0.93 | **1.00 → 0.00** |
| 009 | 1.00 → 1.00 | 1.00 → 0.50 | **1.00 → 0.00** |

Aggregate: Class A recall −0.028, claim_type agreement −0.190,
**Class B recall −0.892**, driven consistently by `MARKER_NOT_FOUND`
rejections — the model proposing bridging two-component connectives the
Validator correctly refuses.

**The consequence is direct and severe.** The SOD v0.1 experiment ran entirely
on **fixtures**. Its `b_because` discriminator — the precedent this whole
investigation is built on — sits on the exact edge whose live recall for
Case 009 was measured at **0.00**. On live Listen output, the causal
eligibility gate would very likely never fire on its own anchor case.

Per-gate exposure:

| Gate | Depends on | Live exposure |
|---|---|---|
| 4A causal | Class B `explicit_connective` + marker + `speaker_assertion` | **Critical** — Class B live recall 0.00 on Case 009 |
| 4C reversal | `prior_belief` claim_type + Class B `contrast_marker` | **High** — Class B, plus an in-repo demonstration below |
| 4B ownership | Class A quotes + `claim_type ∈ {action, decision}` | **Lowest** — Class A recall 0.92–1.00; exposed to claim_type agreement (−0.19) |
| 4D result | `claim_type ∈ {outcome, business_value}` | **Moderate** — claim_type agreement; Case 009's dropped to 0.50 |

**A second, independent demonstration exists inside the fixture corpus itself.**
Cases 002 and `founder` are the founder's retry of Case 001's story. Case 001's
fixture admits `b_contrast_belief`; 002's and `founder`'s admit a `prior_belief`
claim and **no contrast edge**. The reversal gate is therefore eligible on 001
and ineligible on the founder's own capstone retry — not because the reversal
stopped existing, but because the relationship was never proposed. This is the
false-negative channel reproduced without a single live call.

**The required distinction, which must never be collapsed into one accuracy
number:**

| Ledger | Question |
|---|---|
| **Upstream admission** | Was the required claim/relationship admitted, given it exists in the transcript? |
| **Eligibility** | Given what *was* admitted, did the gate fire correctly? |
| **Detector false negative** | Given eligibility, did the detector miss what it was shown? |
| **Detector false positive** | Given eligibility, did it tag an unsupported case? |
| **Relationship fabrication** | Did it assert a relationship with no admitted supporting edge? |

*"The detector failed to perceive something it was shown"* and *"the detector
was never eligible because upstream perception failed"* are different failures
with different owners and different fixes.

---

## 9. Cost and latency

Reference: `claude-sonnet-5` through the existing `CoachProvider` seam,
provider-default sampling, measured from the v0.1 revision-1 report. Shared
system prompt 4,819 chars; request 5,346–7,196 bytes (~1,650–2,220 input
tokens); response 1,727–8,733 bytes, dominated by the model's thinking pass.

| | Shape A | Shape B | Shape C |
|---|---|---|---|
| Calls / answer (typical) | 1 | 4 | **1.47** |
| Calls / answer (worst observed) | 1 | 4 | **3** |
| Calls / answer (best observed) | 1 | 4 | **0** (cases 007, 008) |
| Input size / call | ~5.3–7.2 KB | ~4.4–6.1 KB (one definition instead of four) | same as B |
| Relative input tokens | 1.0× | ~3.2× | **~1.2×** |
| Relative output tokens | 1.0× | ≥4× (a thinking pass per call, and thinking does not shrink proportionally with prompt size) | **~1.5×** |
| Relative latency, serial | 1.0× | ~4× | ~1.5× |
| Relative latency, parallel | 1.0× | ~1× (fan-out) | ~1× (fan-out) |

Shape C is roughly **1.2–1.5× Shape A** and materially cheaper than Shape B,
because gating removes most calls before they happen. No provider shopping, no
model migration, no optimization work is implied.

---

## 10. Recommended v0.2 design

### Architecture to test: **Shape C — deterministic eligibility gates, then independently scoped per-tag detectors, then relationship-level validation.**

### Experimental design: **Option A (decomposed-only) at higher n, plus two additions**

Option B — a full comparative arm against a shared prompt — is **not**
recommended. The cross-tag-coupling hypothesis is real but is **not the
decision-relevant question**: even if coupling were disproven tomorrow, Finding
C and Finding D independently force structural gating, and once gates exist,
per-tag scoping is nearly free (Section 9). Spending budget on a control arm
that cannot change the architecture choice, at the cost of n per condition, is
the wrong trade — **n is precisely what v0.1 lacked.**

Two additions the v0.1 design did not have:

1. **A live-Listen eligibility arm (mandatory).** Run the eligibility gates
   against **live** Listen output for the anchor cases, not only fixtures, and
   record eligibility rate separately from detector performance. Without this,
   v0.2 repeats v0.1's blind spot and would certify gates that do not fire in
   production (Section 8).
2. **A limited shared-prompt reference arm** — the 4 primary anchors only, same
   n, no controls. Cheap, preserves comparability with v0.1, and gives the
   coupling hypothesis *some* evidence without funding a full second condition.

### Run count: **n = 10** per anchor and per control, uniform across tags

Three runs exposed instability but cannot support reliability claims: one
flipped result moves the rate by 33 points, which is why v0.1's 3/3 → 2/3 on
Case 006 cannot be distinguished from sampling noise. n = 10 gives 10-point
resolution, makes 9/10 versus 5/10 a real distinction, and keeps the arithmetic
legible. No statistical machinery beyond counting is warranted — it would not
change any engineering decision. Uniform n across tags: per-tag counts would
buy nothing and would complicate cross-tag comparison.

**Sampling stays at the provider default.** It is what production would use;
tuning it would measure a system that does not ship.

### Thresholds

| Measure | Threshold |
|---|---|
| Detection at anchor | **≥ 9/10** = stable success; 6–8/10 = capability observed, stability failed; ≤ 5/10 = not demonstrated |
| False positives per (control, tag) | **≤ 1/10**; ≥ 2/10 is a reportable pattern |
| Relationship fabrication | **hard fail at any rate** — it is a class, not a rate |
| Eligibility on live Listen | reported per gate; a gate below **8/10** eligibility on its own anchor is not viable regardless of detector accuracy |
| A single miss at 9/10 or 10/10 | **record it, do not tune it** |

### Scoring separation

Five independent ledgers, never merged into one accuracy figure: upstream
admission, eligibility, detector false negative, detector false positive,
relationship fabrication (Section 8's table).

### Success and failure for v0.2

**Success:** each tag's gate fires on its anchor under live Listen at ≥8/10;
each detector reaches ≥9/10 at its anchor and ≤1/10 at its controls; zero
relationship fabrications survive validation; and at least one tag is shown to
be reliably derivable **without** an LLM.

**Failure — all acceptable outcomes:** gates that do not fire on live output;
detectors that remain unstable at n=10 once gated; fabrication surviving
relationship validation; or gates so tight that legitimate cases are
systematically over-rejected.

---

## 11. Answers to the twelve questions

1. **Decomposable into independently gated detectors?** Yes, all four.
2. **Guaranteed structurally per tag?** 4A: speaker-asserted causal attribution + an outcome + a distinct cause-shaped claim. 4B: mixed or wholly-shared agency across `action`/`decision` claims. 4C: a prior belief and an admitted contrast to a later finding. 4D: only that a result-shaped claim exists at all.
3. **May not require an LLM?** **`assumption_reversal`** — with `prior_belief` + `contrast_marker` admitted, structure nearly is the tag; only *whose* belief and *materiality* remain.
4. **Still require genuine semantic judgment?** `result_needs_substance` (almost entirely), `ownership_dilution` (materiality), `unresolved_alternative_cause` (chain versus alternative).
5. **Can relationship fabrication be rejected mechanically?** Yes — both v0.1 over-fires deterministically, via declared `supporting_edge_ids`. Over-rejection risk is real and comes from upstream, not from the rule.
6. **Enough evidence to prefer per-tag, or must coupling be tested?** Enough to prefer **gated per-tag on fabrication-control grounds**, which do not depend on the coupling hypothesis. Coupling itself remains **unproven** and this investigation makes no claim that per-tag calls improve empirical stability. Recommend **Option A** plus a limited reference arm.
7. **Architecture to test:** Shape C.
8. **Minimum run count:** n = 10 per anchor and per control.
9. **Stability threshold:** ≥9/10 detection; ≤1/10 control false positives; fabrication a hard fail.
10. **Separate recording:** five ledgers, Section 8.
11. **Where gates inherit Listen limits:** 4A and 4C depend on Class B, whose live recall was measured at 0.00–0.25; 4D depends on claim_type agreement (−0.19, and 0.50 on Case 009); 4B is the most robust, depending on Class A recall (0.92–1.00) and quote text.
12. **v0.2 success/failure:** Section 10.

---

## 12. New findings, contradictions and limitations

1. **The `b_because` discriminator is sharper than v0.1 reported.** It is not
   "has a causal edge" but "the *speaker* asserted the cause" — Case 001 has a
   `because` edge too, on a claim whose `speaker_assertion` is `false`.
2. **The gates rest on the least reliable upstream signal.** Class B live recall
   −0.892; Case 009's measured at 0.00. The v0.1 experiment's fixture-only basis
   systematically overstates the availability of every relationship-dependent
   gate. **This is the most important finding in this report.**
3. **An in-repo reproduction of the upstream false-negative channel.** Cases 002
   and `founder` retell Case 001's story with a `prior_belief` claim but no
   contrast edge, so the reversal gate is eligible on 001 and ineligible on the
   founder's own retry — no live call needed to demonstrate it.
4. **The ownership signal already exists in the wrong pipeline.**
   `first_person_singular` / `first_person_plural` / `agency_verb_i_count` are
   computed by the Observation Engine over the raw transcript
   (`observers.ts:94`), while SOD reads the graph. The graph carries the same
   information as quote text; it is unpromoted, not absent.
5. **`computeResultReadiness` conflates "no result" with "thin result."** The
   4D gate separates them — 006, 007 and 008 have no result-shaped claim at all,
   which is a different coaching situation from Case 005's thin one. Recorded as
   an observation about existing behavior; **not** authorization to change it.
6. **Relationship validation and upstream failure are indistinguishable at the
   validator.** A missing edge looks identical whether Listen never proposed it
   or the observation was fabricated. Only the separated ledgers tell them
   apart, which makes the ledger separation a correctness requirement rather
   than a reporting preference.
7. **A quantity-based eligibility test for 4D must be rejected**, even though it
   sharpens the gate — it reconstructs `has_quantity → readiness`, which Case
   001 already disproved.

---

**Recommendation: v0.2 EXPERIMENT WARRANTED** — Shape C, Option A at n = 10,
with a mandatory live-Listen eligibility arm and a limited shared-prompt
reference arm.

Stopping for founder review. Nothing implemented.
