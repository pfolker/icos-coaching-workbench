# Evidence Shadow Compare — Track A Prototype

The first real, interactive piece of Track A: a standalone comparison tool
that runs one submitted transcript through **two independent candidate-
producing paths** and renders both, side by side, through the **identical**
real rendering code. Sibling to `evidence-runtime` and `coaching-runtime`.

**This is NOT the coaching-runtime build.** No Narrator, no free-generated
text anywhere in this package. Every piece of learner-facing copy comes
from the existing, already-shipped, already-tested rendering in
`alpha-workbench` (`categoryMap.ts`, `proof.ts`) — imported read-only,
never modified.

**Hard boundaries respected:** no changes to the Observation Engine,
Opportunity Engine, Decision Engine, `alpha-workbench`, `evidence-runtime`,
or `evidence-validator` — every one of them is imported and called exactly
as-is. Nothing here is wired into the live Workbench; this is a tool a
person runs deliberately, on port 4324, never in a real learner's request
path.

---

## Section 1 — Step 1: the honest mapping investigation

Read first, before writing any adapter code: `opportunity-engine/src/types.ts`
and `detectors.ts` (the real nine `OpportunityId` values and exactly what
each detector checks), `decision-engine/src/types.ts` (the real
`CandidateOpportunity` / `DecisionInput` contract), and
`evidence-runtime/src/evidenceGraph.ts` (the real `EvidenceGraph` shape:
`GraphNode { claim_type, quote, speaker_assertion, admitted_by }`,
`GraphEdge { relationship_type, component_ids, marker_text }` — no
`source_span`, no confidence, no pronoun/register field of any kind).

**Verdict: 2 of 9 opportunity ids map cleanly. 7 do not, and forcing them
would mean inventing dimensions the Evidence Specification simply does not
model.**

### Mapped (2): O3's two-state ladder

`O3_missing_result` and `O3_unquantified_result` both pivot on exactly ONE
claim_type (`outcome`) and exactly ONE relationship_type
(`quantity_binding`) — both already defined in the Specification for
precisely this purpose. This mirrors the real detectors' own mutual
exclusivity (`detectMissingResult`/`detectUnquantifiedResult` in
`opportunity-engine/src/detectors.ts`) exactly:

- no `outcome` claim admitted anywhere in the graph &rarr; `O3_missing_result`
- `outcome` claim(s) admitted, none referenced by a `quantity_binding` edge
  &rarr; `O3_unquantified_result`
- at least one `outcome` claim IS quantity-bound &rarr; neither fires

### Not mapped (7), each for a distinct, real reason

| id | why it doesn't map |
|---|---|
| `O2_structureless_ramble` | Absence-based over an OPEN-ENDED space ("fewer than 2 of 4 structure marker types"). The graph only asserts what IS present; there's no `claim_type` for "task" distinct from "action" either — a partial proxy would invent a dimension the schema doesn't have. |
| `O4_ownership_hiding` | Needs pronoun/grammatical-subject register (I vs. we, agency-verb-to-I attribution). Not modeled anywhere in `CLAIM_TYPE_ENUM`; recovering it would mean re-deriving the same pronoun heuristic from quote text, not using graph structure. |
| `O5_vagueness` | Absence-based over an open-ended space (any number, any named tool/action/constraint, anywhere). See the throughline finding below — the graph shows the OPPOSITE reliably, but can't assert a positive "vague" candidate, because evidence only ever records presence. |
| `O7_weak_close` | Discourse-final hedging ("I guess", trailing off) is a delivery signal, not an evidentiary claim. Nothing in `CLAIM_TYPE_ENUM` represents how a sentence closes. |
| `O8_buried_lede` | Needs WHERE in the transcript a claim sits (opening vs. buried). `ValidatedClassA` carries a `source_span`, but `buildEvidenceGraph()` deliberately does not carry it onto `GraphNode` — position is lost at exactly the layer this adapter reads from. **A confirmed, concrete schema gap, not a judgment call.** |
| `O10_filler_density` | Disfluency/acoustic density (`filler_per_minute`, duration) is entirely outside the Evidence Specification's scope. |
| `O11_employer_negativity` | Requires sentiment/tone classification of quote content. The Validator checks grounding and claim_type fit, never emotional valence. |

Full text of each reason lives as data in `src/adapter.ts`'s
`UNMAPPED_OPPORTUNITY_IDS` (not just this table), and the Debug UI renders
it plainly next to every comparison run — it is never silently omitted.

### The throughline question, answered directly

**Does the Evidence Graph reliably distinguish "genuinely vague" from
"specific but unquantified"? Yes.** Real, concrete `action`/`constraint`
claims with quoted content (Case 001/founder: "machining two locating
divots", "redesigned the gripper pads with a conical profile") are a
reliable signal of genuine specificity — exactly what the founder's real
Case 001 incident (Phase 3.1/coaching-runtime's grounding-check work)
already demonstrated: the regex fired `O5_vagueness` on zero literal
digits despite rich, quotable, specific content.

**But this distinction cannot be expressed as a new `O5_vagueness`
candidate.** The `CandidateOpportunity` contract has no field for "this
opportunity is disputed" or "not vague" — Decision Engine candidates only
ever assert that something IS present. So the honest resolution is: the
tool surfaces this contrast by displaying the **raw Evidence Graph panel**
(real claims, real quotes) directly next to the Decision Engine's flags,
not by manufacturing a fake candidate to represent an absence. Confirmed
empirically below (Section 4, founder case): the Evidence Graph shows 12
rich, admissible claims and a genuine causal Class C hypothesis, while
`O5_vagueness` still fires on both LEFT and RIGHT — the contrast is real
and visible, but it lives in the Evidence Graph panel, not in a flipped
Decision Engine pick.

---

## Section 2 — Step 2: the adapter (`src/adapter.ts`)

`EvidenceGraphOpportunityAdapter(graph, ctx?)` produces 0 or 1
`CandidateOpportunity`, scoped to exactly the two mapped ids:

```
outcomeNodes = graph.nodes.filter(claim_type === "outcome")
if outcomeNodes.length === 0:            -> O3_missing_result
else if NONE of them is quantity-bound:  -> O3_unquantified_result
else (at least one IS quantity-bound):   -> [] (neither fires)
```

Reused, read-only, from `opportunity-engine`: `REGISTRY` (for
`related_habits`/`growth_potential`/`allowed_states` — catalog metadata,
not detection logic) and `HABIT_DAG` (for `habit_prerequisites`, via a
tiny generic DAG-walk helper — not a reimplementation of any KB
judgment).

**Honestly documented limitations, not silently absorbed:**
- **Confidence is a fixed 0.8 constant**, not derived per-claim. Reasoning:
  validated Class A admission is a strict, mechanical, all-or-nothing
  check — stronger than the regex engine's own probabilistic heuristics
  (which cap around 0.5–0.7 for absence-based detections) — but not
  unconditional either (claim_type fit itself can be genuinely ambiguous;
  see the Phase 3.1 freeze audit's Case 009 finding). 0.8 reflects "high
  but not certain," not a derived number. **Section 6 below reports a real
  consequence of this being a flat constant.**
- `OpportunityEvidence.spans` needs `{sentence_index, char_start,
  char_end}`, which `GraphNode` doesn't carry (same gap as `O8` above) —
  filled with sentinel `-1`s, never a fabricated `0`, so it's visibly
  "unknown position."
- `observation_types_cited` uses a distinct, prefixed vocabulary
  (`"evidence_graph:outcome"`) since these aren't real
  `observation-engine` types — never silently passed off as one.
- `dependencies.upstream_candidates_cofired` is always `[]` for adapter
  candidates. Co-firing detection is sensitive to the FULL candidate set
  at computation time; the regex candidates' own values were computed
  knowing only the regex pool. Recomputing it across the merged pool would
  mean externally re-deriving `opportunity-engine`'s private co-firing
  logic — not attempted; reported as a known limitation instead.

---

## Section 3 — Step 3: the comparison harness (`src/pipeline.ts`, port 4324)

`runShadowCompare({ transcript, mode })`:

- **LEFT** = `observe()` -&gt; `generateOpportunities()` -&gt; `decide()` -&gt;
  `quickScan()`. Exactly what the live Workbench produces today.
  Unmodified.
- **RIGHT** = the SAME `observe()` output (quickScan's `GOOD_NOTES`
  positives are keyed off `observation_type`, never evidence, so both
  columns need it) + evidence-runtime's Listen LLM -&gt; Validator -&gt;
  Evidence Graph -&gt; `EvidenceGraphOpportunityAdapter` -&gt; `decide()` on
  `[...regex candidates, ...adapter candidates]` (additional pool, never a
  replacement) -&gt; `quickScan()`.

Both columns call the **identical** `quickScan()`/`categoryMap.ts` — there
is no second copy of any rendering logic anywhere in this package (see
`test/pipeline.test.ts`'s explicit same-label/same-explanation assertion).

**A real wrinkle, found empirically, not anticipated:** the founder case
has regex AND the adapter *independently* agree on `O3_unquantified_result`
— feeding `decide()` the same `opportunity_id` twice isn't "two different
opinions" the way an `O5` disagreement is, it's redundant noise, and
`quickScan`'s uncapped flag rendering would otherwise show the identical
flag label twice. Resolved by dropping the adapter's entry on an exact
`opportunity_id` collision (regex wins — this pool is "additional", never
"replacement"), with the dropped id reported honestly in
`right.adapter_candidates_deduped`, never silently absorbed.

**Fixture mode only works for a known, registered transcript** (a
hand-authored `ListenEngineRawOutput` has to exist for it) — the same
"CASES array" convention `evidence-runtime`/`coaching-runtime`'s Debug UIs
already use. An arbitrary pasted/typed transcript can only run in live
mode. This is a real, reported limitation of "paste or type a transcript",
not hidden: the UI's textarea accepts free text, but fixture mode will
return a clear `NO_FIXTURE` error rather than fabricating one.

Three known cases are registered (`src/knownCases.ts`): `founder` (from
`coaching-runtime/src/founderCase.ts`), `cnc` (from
`evidence-benchmark/src/case003Fixture.ts` — Atlas Case 003), and `thin`
(new: `src/thinCase.ts`, the real text from tonight's own
`checkThinObs.mjs` scratchpad probe — "We had an issue with parts on the
line and eventually got it sorted out. Things went back to normal after
that.").

---

## Section 4 — Step 4: real side-by-side output, all three required cases

Run twice: fixture mode first (`shadowCompareDebug.mjs`), then **live
mode** (`shadowCompareLive.mjs`, real Listen Engine calls, model
`claude-sonnet-5`) — both produced the same structural result in every
case, a good cross-check on the fixture authoring.

### Founder's real retry (deburring / indicator / divots / conical profile)

**LEFT candidates:** `O3_unquantified_result(0.7)`, `O5_vagueness(0.55)`
**LEFT decision: `O5_vagueness` via `I1_direct_instruction` (root_cause)**

**RIGHT Evidence Graph (live):** 13 admissible claims — problem, prior
belief, action ("checking the part straightness with an indicator"),
2 self-reported diagnoses, constraint, 2 more actions (machining the
divots, redesigning the gripper pads), outcome, business_value,
reflection — plus a genuine **Class C non-admissible hypothesis** ("The
combination of the machined locating divots and the conical gripper pad
redesign together were the mechanism that resolved the gripper holding
issue") correctly kept OUT of the admissible graph.

**RIGHT adapter candidates:** `O3_unquantified_result(0.8)` — **deduped**
against LEFT's own `O3_unquantified_result` (both independently agree).
**RIGHT merged candidates:** `O3_unquantified_result`, `O5_vagueness`.
**RIGHT decision: `O5_vagueness` via `I1_direct_instruction` (root_cause)**
— **unchanged from LEFT.**

This is the throughline case, live: the Evidence Graph shows real, rich,
specific content (13 claims, a contrast_marker edge, a temporal_sequence
edge), and `O5_vagueness` STILL fires identically on both sides, because
the adapter has no way to contradict it — only to add. The real contrast
here lives in the Evidence Graph panel sitting right next to an unchanged
"No specifics" flag, exactly as Section 1 predicted.

### CNC stress test (Atlas Case 003 — Strong Concise Answer)

**LEFT candidates:** `O3_missing_result(0.5)`, `O5_vagueness(0.55)`
**LEFT decision: `O5_vagueness` via `I1_direct_instruction` (standard)**

**RIGHT Evidence Graph (live):** problem, action (checked pins),
2 diagnoses, 2 more actions (swapped pin, added witness mark), reflection,
**outcome** ("Scrap rate on that fixture dropped back to normal within a
day") — plus 2 Class C hypotheses about causation, correctly kept
non-admissible.

**RIGHT adapter candidates:** `O3_unquantified_result(0.8)` (no
collision this time).
**RIGHT merged candidates:** `O3_missing_result`, `O5_vagueness`,
`O3_unquantified_result`.
**RIGHT decision: `O3_unquantified_result` via `I1_direct_instruction`
(standard) — FLIPPED from LEFT's `O5_vagueness`.**

A real, concrete demonstration of "the contrast itself is the
deliverable": regex's `structure_result_marker` keyword scan never
recognizes "Scrap rate...dropped back to normal" as a result (no
keyword phrase like "as a result" or "which resulted in"), so LEFT
even fires `O3_missing_result` (arguably a wrong read — a result WAS
stated). The Evidence Graph, reading semantically, correctly identifies
the outcome claim, and once it's fed into the SAME Decision Engine
(confidence 0.8 beats `O5_vagueness`'s 0.55 in tiebreak), the actual
coaching moment changes from "you're vague" to "your result needs a
number" — a more accurate read of this specific, concise, already-clear
answer. quickScan on RIGHT shows all three signals side by side
(STORY: "No result stated"; CREDIBILITY: "No specifics"; IMPACT:
"Outcome could be easier to measure.") — nothing suppressed.

### Genuinely thin answer

**LEFT candidates:** `O3_missing_result(0.5)`, `O5_vagueness(0.5)`
**LEFT decision: `O3_missing_result` via `I1_direct_instruction`
(standard)** (tiebreak on equal confidence falls to REGISTRY order)

**RIGHT Evidence Graph (live):** problem ("We had an issue with parts on
the line"), **action** ("eventually got it sorted out" — the live model
classified this as an action, not an outcome, a real and interesting
divergence from this assistant's own fixture-mode authoring, which had
called it an outcome; noted honestly, not smoothed over), outcome
("Things went back to normal after that") — plus 2 Class C hypotheses,
correctly non-admissible.

**RIGHT adapter candidates:** `O3_unquantified_result(0.8)`.
**RIGHT merged candidates:** `O3_missing_result`, `O5_vagueness`,
`O3_unquantified_result`.
**RIGHT decision: `O3_unquantified_result` via `I1_direct_instruction`
(standard) — FLIPPED from LEFT's `O3_missing_result`.**

This flip is reported as a **real limitation, not a win** — see Section 6.

---

## Section 5 — full test suite, zero regressions

`evidence-shadow-compare`: **17/17** (11 adapter, 6 pipeline), `tsc
--noEmit` clean.

Full cross-package regression, all 11 packages:

| package | tests |
|---|---|
| observation-engine | 33 |
| opportunity-engine | 39 + 1 skipped |
| decision-engine | 15 |
| conversation-engine | 36 |
| comparison-engine | 21 |
| alpha-workbench | 22 |
| evidence-validator | 65 |
| evidence-runtime | 16 |
| evidence-benchmark | 75 |
| coaching-runtime | 42 |
| evidence-shadow-compare | 17 |

**382 total (381 passed + 1 pre-existing skip), zero regressions.** No
frozen engine, no other package, was modified to build this one.

---

## Section 6 — what changes about "Track A is basically done"

Two real findings from Step 1 and live testing, not anticipated going in:

1. **Only 2 of 9 opportunity ids map onto the Evidence Graph at all**, and
   the two that don't map for the MOST important reason (`O2`, `O5` — the
   open-ended absence detectors) are exactly the ones the founder's real
   incidents have centered on all night. The Evidence Graph's real value
   for those two is not "produce a competing candidate" — it's "show the
   raw claims next to the flag so a human can see the disagreement," which
   this tool now does, but that's a materially smaller claim than "Track A
   replaces or augments the Decision Engine's opinion on vagueness." It
   augments the Decision Engine's opinion on ONE thing (unquantified
   results) and provides supporting evidence, visually, for everything
   else.

2. **The adapter's flat 0.8 confidence is too blunt, confirmed by the thin
   case.** `O3_unquantified_result`'s fixed confidence outranks
   `O5_vagueness` in tiebreak regardless of whether the outcome claim
   itself is rich (CNC, founder — where "add a number" really is the
   missing piece) or nearly vacuous (the thin case's "Things went back to
   normal after that" — where the real, deeper problem is that almost
   NOTHING is concrete, which is exactly what `O5_vagueness` is designed to
   flag, and it's still in the pool, just outranked). The adapter has no
   way to express "this outcome claim is itself nearly all the content
   there is" — it treats every unquantified outcome identically regardless
   of how much real substance surrounds it. **This is a genuine gap
   surfaced by real testing, not by inspection or guesswork**, and it means
   "Track A is basically done" cannot mean "the adapter's output is
   trustworthy for all decision outcomes" — only "the adapter correctly
   distinguishes outcome-present from outcome-absent from
   outcome-unquantified, on a per-claim basis." Whether its FIXED
   confidence should vary by surrounding evidence density is an open
   question for Stage 3 (RFC), not resolved or even attempted here — named
   plainly, not patched, matching this project's standing discipline.

No fix is proposed for either finding in this task. They are named, the
way every other structural finding tonight has been named before being
acted on separately.

---

## Section 7 — Incident report: contradictory Coach's Notes on the CNC case

**The finding:** running the CNC case through RIGHT rendered both "No
result stated" (`O3_missing_result`) and "Outcome could be easier to
measure." (`O3_unquantified_result`) in Coach's Notes at once — a direct
contradiction (one asserts no result exists, the other asserts a result
exists but isn't quantified).

**Step 1 — mechanism, confirmed by quoting the real code.**
`quickScan()` (`alpha-workbench/server/proof.ts`) maps every id in
`firedOpportunityIds` straight to a flag, no exclusivity check anywhere:

```ts
for (const id of firedOpportunityIds) {
  if (id === "O10_filler_density") continue;
  const n = FLAG_NOTES[id];
  if (n) push(n);
}
```

**Step 2 — confirmed structurally impossible before tonight.**
`opportunity-engine/src/detectors.ts`'s two O3 detectors read the exact
same boolean on the exact same regex `ObservationSet`:

```ts
detectMissingResult:      if (marker || finalR) return null;
detectUnquantifiedResult: if (!marker) return null;
```

Direct logical negations of the same lookup, evaluated once. A single
`generateOpportunities()` call can never produce both — this contradiction
was structurally impossible in the live Workbench today. It only became
possible because this package merges two INDEPENDENT judgments (regex's
keyword scan vs. the Evidence Graph's admitted `outcome` claim) of whether
a result marker exists, and those two sources are free to disagree.

**Step 3 — resolution reasoning.** Not an unconditional "evidence always
wins" — Atlas Case 007 already established a real failure mode where that
would be wrong (an LLM Listen Engine could mis-tag intent/aspiration
language, e.g. "so we'd catch drift going forward," as claim_type
`outcome`, when the Atlas's own reading says it must NOT be admitted as
one; the Validator checks grounding and enum fit, not "is this genuinely
completed vs. aspirational"). But between the two specific claims in
conflict — an ABSENCE claim (regex: "no keyword phrase appeared") and a
PRESENCE claim (an admissibly-grounded, verbatim-quoted `outcome` node) —
presence is structurally stronger: an absence heuristic can only prove a
phrase pattern didn't appear, never that the concept doesn't exist. Same
reasoning already used to set the adapter's 0.8 confidence above regex's
absence-detection cap, applied consistently: presence beats absence when
they contradict for RENDERING. The misclassification risk is named, not
hidden (see `src/ladderExclusivity.ts`'s doc comment).

**Step 4 — the fix (`src/ladderExclusivity.ts`, NOT proof.ts).** A small,
explicit, documented `LADDER_EXCLUSIVITY_RULES` table (one entry today:
`O3_missing_result` / `O3_unquantified_result`), applied via
`resolveLadderConflictsForRendering()` to the id list handed to
`quickScan()` — never to the `candidates` array handed to `decide()`,
which already resolves the same conflict correctly via its own confidence
tiebreak (that was never the bug). Confirmed byte-identical for any
single-source id list by a dedicated regression test
(`test/ladderExclusivity.test.ts`) that runs `quickScan()` before and after
the resolution function on every plausible regex-only id combination and
asserts identical output. **This table is an explicit rehearsal for a real
requirement any future production merge (RFC Stage 2/3) will also need —
documented as such in the module's own doc comment — not a one-off lab
hack**: once more than one candidate-producing source can disagree about
the same underlying fact, something has to reconcile them before shared
rendering code sees the result, and that reconciliation logic belongs at
the merge point, never inside the shared renderer itself.

**Step 5 — same risk elsewhere?** Inspected the real `OpportunityId`
enum directly:

```ts
export type OpportunityId =
  | "O2_structureless_ramble" | "O3_missing_result" | "O3_unquantified_result"
  | "O4_ownership_hiding" | "O5_vagueness" | "O7_weak_close" | "O8_buried_lede"
  | "O10_filler_density" | "O11_employer_negativity";
```

`O3` is the only id with a two-state ladder sibling anywhere in this
enum. None of the other 7 (all of them, including all 7 currently unmapped
ones) has an opposing/sibling id representing the negation of its
condition — `O2`, `O4`, `O5`, `O7`, `O8`, `O10`, `O11` are each a single,
standalone flag. **No other opportunity id risks this specific
contradiction shape today, confirmed by inspecting the real enum, not by
speculating about future adapter coverage.** If a future adapter ever
introduces a genuinely NEW id that logically negates an existing one, this
table is exactly where that new rule would be added — but no such id
exists in the real codebase right now.

**Step 6 — re-verification.** Fixture mode, live in-browser (screenshot
capture itself was flaky this session; `get_page_text` verbatim output was
used instead, and confirmed no console errors): CNC case's RIGHT Coach's
Notes now shows only CREDIBILITY ("No specifics") and IMPACT ("Outcome
could be easier to measure.") — STORY's contradictory "No result stated"
is gone, with a visible transparency note: *"ladder-exclusivity fix:
dropped O3_missing_result from RENDERING only... decide() above still
received the full pool."* The thin case (which independently turned out to
have the identical ladder conflict, not previously noticed) is fixed the
same way. The founder case is confirmed byte-identical to before — no
`O3_missing_result` ever appears in its candidate pool, so
`ladder_conflicts_resolved` is `[]` and nothing changed. Live mode
(`shadowCompareLive.mjs`, real Listen Engine calls) confirms the same
three outcomes; the Debug UI server's live-mode `fetch failed` remains the
same previously-named environment quirk (identical fetch succeeds
standalone, fails inside the long-running preview process) — not
re-investigated here, worked around the same way as before.

**Test suite:** `evidence-shadow-compare` 22/22 (was 17; +5: 1 dedicated
`ladderExclusivity` module test file with 5 tests, 2 existing pipeline
tests updated to assert the fix). Full cross-package regression, all 11
packages: **387 total (386 passed + 1 pre-existing skip), zero
regressions.**

---

## Section 8 — Second incident: suppressing the selected focus itself

Found on a fresh, real, user-supplied transcript (a checkout-service
outage story) run through the exact standalone-script workaround used
throughout Section 7 — not hypothesized.

**The finding:** `O4_ownership_hiding` co-fired on this transcript and
cited `O3_missing_result` as its upstream cause, promoting
`O3_missing_result` to Decision Engine priority `root_cause` — a
classification that outranks everything by fixed hierarchy (`blocking >
root_cause > mission_aligned > standard...`), regardless of confidence.
`O3_missing_result` was SELECTED as Today's Focus. But Section 7's fix
unconditionally drops the absence_id from rendering whenever the
presence_id also fired — so it dropped "No result stated" here too, even
though it was the literal explanation for what had just been selected as
the coaching focus. **Coach's Notes ended up with no flag at all
corresponding to Today's Focus.**

**Root cause, confirmed by reading the code, not inferred:** in the
FROZEN, single-source system, `quickScan`'s `firedOpportunityIds` is
always exactly `candidates.map(id)`, and `decide()`'s `pick` is always a
reference into that same input `candidates` array (confirmed in
`decision-engine/src/engine.ts` — it never invents an id). So whatever
`decide()` selects is STRUCTURALLY GUARANTEED to appear as a rendered
flag — an invariant the original system always held, silently, without
anyone having to enforce it. Section 7's `resolveLadderConflictsForRendering`
was the first code in this whole session to filter the render-id list
independent of what `decide()` actually selected, and this is where that
independence became a real bug rather than a harmless simplification.

**Resolution:** `resolveLadderConflictsForRendering()` now takes an
optional `selectedOpportunityId` and never drops a rule's `absence_id`
when it equals the turn's actual selection — even if that means
re-showing the contradictory pair. This is a deliberate trade-off, not
an oversight: hiding the explanation for a literal coaching action is a
strictly worse failure mode than a visible, already-documented
contradiction. It does NOT touch `decide()`'s candidate pool or
selection logic — whether `O3_missing_result` should be ABLE to win
`root_cause` priority when an evidence source directly contradicts its
own premise is a real, open Decision-Engine-level design question, out
of scope here (Stage 2/3 RFC territory, same class of finding as
Section 6's flat-confidence gap) — named, not silently fixed.

**Verified no regression:** CNC and thin still resolve correctly (their
selected focus is the PRESENCE id, so the exemption never engages there —
confirmed by a dedicated test asserting the drop still happens in that
shape). The checkout-outage transcript is now a registered known case
(`src/checkoutOutageCase.ts`) so this scenario stays covered going
forward, not just a one-off script. Re-verified live, in-browser (fixture
mode) and via the standalone-script workaround (live mode, same `fetch
failed` server-process quirk as before): both confirm `ladder_conflicts_
resolved: []` and Coach's Notes now shows "No result stated" alongside
"Outcome could be easier to measure." — Today's Focus is explainable
again.

**Test suite:** `evidence-shadow-compare` 26/26 (+4 from Section 7's 22:
1 new pipeline test for the checkout-outage case, 3 new
`ladderExclusivity` unit tests for the `selectedOpportunityId` parameter).
Full cross-package regression, all 11 packages: **391 total (390 passed +
1 pre-existing skip), zero regressions.**

---

## Stop condition

Per instruction: stop after this report. Not wired into the live
Workbench. No Narrator or free-generated text exists anywhere in this
package.
