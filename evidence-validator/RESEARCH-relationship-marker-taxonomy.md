# Research: Relationship-Marker Taxonomy — Live Model vs. Specification

**Status: research only. Nothing in this document has been adopted.** No
change was made to the Specification, the Validator, or any prompt while
producing it. If a concrete proposal eventually comes out of this line of
research and is adopted, it should be logged as **EP-006** — EP-005 is
already assigned (Phase 3.1's `supporting_claim_ids` rename).

---

## Step 0 — Data availability (gates everything below)

Checked before any categorization work, per the mission's explicit
instruction.

**Recoverable: Case 009, from 2 independent real live calls tonight.**
- `liveTest.out.txt` (scratchpad, call started 2026-07-19T15:27:13Z) —
  Phase 3A/3.1's pre-rename verification run.
- `liveTest2.out.txt` (scratchpad, call started 2026-07-19T15:54:28Z) —
  Phase 3.1's post-rename verification run.

Both files contain the full raw Listen Engine output (`class_a_proposals`,
`class_b_proposals`, `class_c_proposals`) and the full `validator_output`
(`rejected` with `reason_code` + `explanation`), not just pass/fail. This
is real, specific, recoverable data.

**NOT recoverable: Cases 001 and 002, from tonight's evidence-benchmark
live run** (`report_evidence_v1.1_live_2026-07-19T16-24-40-245Z.json`,
scoped exactly to 001/002/009). Confirmed by direct inspection:
- The persisted Report JSON contains zero occurrences of `marker_text` or
  any raw proposal field — only rolled-up metrics (`rejection_tally:
  {"MARKER_NOT_FOUND": 2}` for each case, with no detail on which marker or
  components). This is the exact gap the benchmark's own README already
  flagged (Deliverable 7, finding #1) — confirmed again here by grep,
  not assumed.
- `bin/run.ts`'s console output for that run printed only the aggregate
  summary line (case count, average metrics) — no per-case or per-rejection
  detail was ever displayed or saved.
- No other file on disk contains raw Class B proposal text for those two
  cases' live run.

**Conclusion: this report's Objectives 1-4 are answered using ONLY the
real, recovered Case 009 data (2 independent calls). Cases 001/002 are
explicitly out of scope for phrase-level analysis below — nothing is
reconstructed from memory of the earlier summary.**

**Cost of a fresh, scoped re-run to close this gap, if wanted:** 2 live
calls — Case 001 and Case 002, reusing the exact existing `TRANSCRIPT`
constants already in `evidence-runtime/fixtures/case001.ts` and
`case002.ts` (no new fixture authoring). Based on tonight's timings, each
call takes roughly 15-25 seconds. The only change needed versus tonight's
benchmark run would be capturing full raw output to a file (as
`liveTest.mjs` already does), not just the rolled-up Report. **Not run as
part of this task. Awaiting confirmation before spending anything
further.**

---

## Objective 1 — Every real MARKER_NOT_FOUND rejection, reviewed

Both recovered calls reduce to **one rejected proposal shape, occurring
twice, for the same marker:**

| Call | proposal_id | relationship_type | marker_text | components (by claim_type) | rejection |
|---|---|---|---|---|---|
| 15:27 (pre-rename) | `rel_because_stress` | explicit_connective | "because" | `outcome` → `self_reported_diagnosis` (full sentence) | `MARKER_NOT_FOUND`: "\"because\" does not appear in the transcript between the two referenced components." |
| 15:54 (post-rename) | `rel_because_dropped_stressed` | explicit_connective | "because" | `outcome` → `self_reported_diagnosis` (shorter sub-quote) | Identical `MARKER_NOT_FOUND`, identical explanation text |

In both calls, the model proposed **"because" as a bridging (2-component)
relationship** between the outcome claim and the diagnosis claim. In the
actual transcript, "because" sits *inside* the diagnosis claim's own quote
("I think the complaints dropped **because** agents were less stressed...")
— it is self-contained, not a connector spanning the transcript gap between
two independently-quoted claims. `classB.ts`'s bridging rule looks for the
marker in the gap between two components' spans; it isn't there, because
there is no gap — the whole causal statement is one sentence the model
chose to also quote separately as its own Class A claim.

**This is not a missing-marker problem.** "because" has been in
`EXPLICIT_CONNECTIVES` since v1.0. The real, recovered failure is a
**structural/shape mismatch**: the model's own Class A segmentation choice
(splitting one causal sentence into two components) made its own Class B
proposal invalid under a marker that was already correctly admitted. Two
independent live calls producing the identical failure shape for the same
word is a real, if narrow, signal — not a one-off fluke.

---

## Objective 2 — Semantic pattern groups

**Honesty check before grouping:** the recovered data supports exactly
**one** distinct marker ("because," seen twice). It cannot populate a
genuine multi-category taxonomy of *new* relationship expressions — there
is only one data point. Forcing it into "starter categories" would
manufacture the appearance of breadth the evidence doesn't have. What
follows is the one real category the data actually supports, plus a
second, structural category the same data surfaces that isn't about
vocabulary at all:

- **Causal/explanatory** (real data: "because," 2/2 occurrences) — already
  fully covered by the existing marker list. No gap in vocabulary found.
- **Segmentation-sensitivity** (not a semantic category — a structural one,
  surfaced by the same 2 occurrences): whether an *already-admitted* marker
  validates at all depends on how the model chose to draw its Class A quote
  boundaries, independent of which word was used. A marker could fail this
  way regardless of which semantic family it belongs to (causal, contrast,
  temporal, etc.) — this is a property of the self-contained/bridging rule
  itself, not of "because" specifically.

Every other starter category the mission offered (contrast, corrective,
diagnostic, temporal, implied transitions) has **zero real occurrences** in
the recovered data. Populating them would mean inventing examples — exactly
what Step 0 was designed to prevent.

---

## Objective 3 — Per-phrase disposition

Only one real rejected phrase exists to classify:

- **"because" (as proposed, bridging shape):** not a new relationship
  expression, not a case for exclusion — it is the *existing*, admitted
  `explicit_connective` marker, proposed in a shape the current rule
  doesn't accept for this text. Disposition: **no marker-vocabulary change
  applies here.** If anything is "wrong," it's downstream of vocabulary —
  in how the Listen Engine segments Class A claims relative to how a
  connective naturally sits inside a sentence, which Design/Spec boundary
  this document does not propose touching (out of scope: "do not modify
  the Specification or Validator").

No other real phrase was recovered to classify.

---

## Objective 4 — Taxonomy of relationship expressions actually used

Given Objective 1-3's findings, the honest taxonomy this data supports is
**one row, not a table**: "because," used exactly as the Specification
already expects lexically, in a component-shape the Validator's bridging
rule doesn't accept for a single-sentence causal statement split across two
Class A proposals. **No taxonomy of novel relationship expressions can be
built from 2 occurrences of 1 already-known word.** Building one anyway
would misrepresent how much real evidence exists — the opposite of what
this research task asked for.

---

## Objective 5 — Comparison against the current Specification

Read fresh from `evidence-specification-v1.1.md` (current, on disk, this
session) for this comparison, not from memory of writing it earlier.

The recovered finding is **not new** — it's a concrete instance of an
**already-documented, already-open gap**: Section 8, Unresolved Question 7
("Class B minimum component counts per relationship type... not specified
numerically by any version of this document"), and
`evidence-validator/README.md`'s own limitation #2 ("this build's per-type
minimums remain implementation choices, not ratified specification").
Tonight's 2 live occurrences are real, additional evidence *for* that
already-known gap, not a newly discovered one. Nothing in Section 4's
`explicit_connective` rule anticipates a marker that is lexically valid but
structurally ambiguous depending on how the proposing system chose to
segment Class A claims around it — this is a real, specific edge of the
existing open question, worth citing concretely (this document) the next
time Section 8 item 7 is actually addressed, but it does not, on its own,
justify a new precedent or a Specification change now.

---

## Additional risk-analysis angle — EP-003 self-audit (specifically requested)

Honest answer, not a rhetorical one, to: *does "pointed to" (and siblings)
actually satisfy Class B's "no causal, motivational, or evaluative
interpretation required," or was it admitted too readily?*

**On the Validator's own mechanical terms: these three were fine, and
Class B was designed for exactly this tension from v1.0.** "No
interpretation required" is about *identifying* the marker — a literal
phrase match, identical rigor to "because" or "but." Section 2's own v1.0
example already accepts a semantically loaded connective ("Everyone thought
X, but I realized Y" — "but" is admitted despite carrying real
argumentative weight) specifically *because* Class B never certifies the
relationship is *true*, only that the speaker *stated* it. "Pointed to,"
"led to," and "resulted in" are not doing anything qualitatively different
from "because"/"so" by that standard — natural-language connectives are
never semantically neutral; Class B's discipline (assert-connection-
stated, never assert-connection-true) is precisely what makes an
inherently causal-flavored phrase safe to admit. Read this way, "were these
three admitted too readily" has an honest answer of **no, not on
semantic-scope grounds.**

**The real, honest finding is procedural, not semantic, and it's
specific:** of the three EP-003 additions, **only "instead of" and
"pointed to" trace to an actual Atlas worked example** (Case 001's B2,
Case 002's B5). **"Led to" and "resulted in" do not appear in any Atlas
case, any `evidence-validator` fixture, or any test in this codebase** —
confirmed by direct search, not assumed. They were added, per their own
CHANGELOG entry, "proactively as structurally identical siblings rather
than waiting for each to individually break a future case." That reasoning
is defensible as an engineering shortcut, but it means two of the three
EP-003 markers are running in production-equivalent code today with **zero
empirical exercise** — unlike every other marker in every other list,
which all trace to at least one concrete case. If either word ever behaves
unexpectedly (e.g., "led to" appearing in a genuinely non-causal
construction some future transcript contains), there is no existing test
that would have caught it before a real user hit it.

**Recommendation on the self-audit specifically:** not "these are wrong,"
but "two of these three are undertested, specifically and narrowly." A
minimal, low-cost fix within existing scope (a synthetic unit test in
`evidence-validator/test/reason-codes.test.ts`, exercising "led to" and
"resulted in" the same way "because"/"pointed to" already are) would close
this gap without touching the Specification, the Validator's logic, or any
prompt — but implementing that is out of this research task's scope, so it
is named here, not done.

---

## Coverage analysis

Given Objectives 1-4's thin real-data yield, coverage can only honestly be
assessed structurally, not lexically:

- **Vocabulary coverage:** no evidence of a missing marker word was found.
  The one real rejection involved an already-admitted word.
- **Shape coverage:** the self-contained (1 component) vs. bridging (2
  component) rule is the one place this session's real data — both
  tonight's recovered Case 009 rejections and, separately, the already-
  documented EP-003 fixture limitation (Case 002's B5 only capturing a
  1-component self-contained slice of a 3-antecedent relationship the
  Atlas's prose describes) — repeatedly surfaces the same underlying
  tension: the Validator's component-count rule is stricter and more
  rigid than how connectives actually distribute across a live model's own
  Class A segmentation choices. This is the same open question (Section 8
  item 7) from two independent angles now.

## Candidate additions

**None**, from the real recovered data. Zero new marker words were found
in the two real rejections available. Proposing additions here would mean
inventing evidence Step 0 confirmed doesn't exist.

## Candidate exclusions

**None** proposed. The one real rejected proposal ("because," bridging
shape) is correctly excluded by the current rule given the actual
transcript structure — the marker itself remains correctly admitted for
every case where it's used self-contained or genuinely bridging with the
marker in the gap (as it already is, e.g., Atlas Case 004/009's
self-contained "because" uses, which validate correctly).

## Risks of expanding markers (including the EP-003 self-audit)

1. **Procedural risk, not semantic risk, is where EP-003 is actually thin**
   — see the self-audit above. Two of three additions are untested.
2. **Any future marker addition inherits the same untested-sibling
   pattern unless deliberately avoided** — "add proactively by analogy"
   is efficient but, as EP-003 shows, silently accumulates undertested
   surface area. A norm of "one worked case per added marker, no
   exceptions" would prevent recurrence, at some cost to development speed.
3. **The real gap found tonight (component-shape vs. marker vocabulary) is
   orthogonal to WHICH markers exist.** Adding more marker words does
   nothing to address it; it is about how rigidly the bridging/self-
   contained rule tracks a live model's own, uncontrolled Class A
   segmentation choices. Expanding vocabulary without addressing this would
   not have prevented either of tonight's two real rejections.

## Recommendation

**No Specification or Validator change is justified by tonight's real
data.** The evidentiary base is one repeated structural observation (2
occurrences, 1 word) plus a confirmed, narrow procedural gap in EP-003's
own testing — neither rises to a new precedent. If this line of research
continues, the highest-value next steps, in order, would be: (a) the
scoped 2-call re-run named in Step 0, to see whether Cases 001/002 show the
same structural pattern or something genuinely new; (b) closing EP-003's
untested-sibling gap with two synthetic unit tests, independent of any
Specification change; (c) only after (a) produces enough real, repeated
structural evidence across multiple distinct transcripts, revisiting
Section 8 item 7 (component-count minimums) as a real specification
question — at which point, if adopted, it is logged as **EP-006**, not
EP-005.
