# Changelog

## v1.1 (current)

Implements Evidence Specification v1.1, which formally incorporates five
Evidence Precedents (EP-001–EP-005) — the first precedents in this
project's history discovered by testing the frozen v1.0/v1.1 specification
against real code, real Atlas transcripts, and (EP-005) a real live model
call, rather than folded in during initial drafting (contrast
`DAY-ZERO-FINDINGS.md`).

### EP-001 — `context_fact` added to the claim_type enum

v1.0 treated `context_fact` as a Validator-side gap: accepted, but flagged
in a `specification_gaps` output entry every time it was used (Atlas Cases
007–010). v1.1 formally adds it to Section 3's enum. The Validator no
longer emits a `specification_gaps` entry for it — see `validator.ts`.

### EP-002 — `decision` added; `finding` formally retired

`decision` is new: a stated agreement, determination, or choice, distinct
from `action` (doing) and `self_reported_diagnosis` (concluding what's
true). Added specifically to represent Atlas Case 006's ownership split
("I decided" and "we all agreed" are now `decision`; "I built" and "the
team put together" stay `action`) — a distinction v1.0's enum genuinely
could not make. `finding` (informal Atlas prose in Cases 004/005) was
never a claim_type and is retired, not added — it named the same concept
as `self_reported_diagnosis`.

**Fixture consequence:** Case 006's four claims no longer share one
claim_type, so they no longer form a single enumeration. `built`/
`team_built` (both `action`, textually adjacent) still enumerate;
`decided`/`agreed` (both `decision`, but with two `action` claims sitting
between them) correctly no longer qualify — Specification Section 4's
enumeration rule requires no intervening different-type claim, and this is
the rule working as designed, not a fixture compromise.

### EP-003 — Class B marker lists widened

`explicit_connective` gained "pointed to" (Atlas Case 002's B5), plus
"led to" and "resulted in" added proactively as structurally identical
siblings. `contrast_marker` gained "instead of" (Atlas Case 001's B2),
corrected from its v1.0 mislabel as `explicit_connective` — "instead of"
is a rejected-alternative construction, same family as "instead"/"rather
than", not a neutral connective.

**Fixture consequence:** both relationships, previously omitted from their
fixtures because neither marker existed in v1.0's lists, are now
represented — see Case 001's B2 and Case 002's B5. Both are self-contained
(single-component) relationships; neither captures the fuller multi-
antecedent semantic the Atlas's prose describes (B5's "A13/A14 jointly
led to A15"), since this Validator's `explicit_connective`/`contrast_marker`
rule only supports one (self-contained) or two (bridging) components — see
README.md.

### EP-004 — `temporal_sequence` gains connector-governed ordering

v1.0's `temporal_sequence` was pure raw-position comparison. Atlas Case
008's own semantic narration ("sealant reversion → failures stopping")
contradicted raw position in the literal sentence ("The failures stopped
once we went back to the old sealant" — "stopped" sits at an earlier
offset than the reversion clause). v1.1 adds a second ordering basis: a
closed, fixed set of subordinating temporal connectors ("once", "after",
"before"), each with a fixed logical meaning that determines order when
raw position alone would reject the proposed order. Every validated
`temporal_sequence` relationship now records which basis produced its
ordering (`ordering_basis: "raw_position" | "connector:once" |
"connector:after" | "connector:before"`) — auditable, never just asserted.

**Fixture consequence:** Case 008's `temporal_sequence` is now proposed in
the Atlas's own semantic order (`["reverted", "failures_stopped"]`) and
validates via `ordering_basis: "connector:once"`, resolving the exact
divergence EP-004 was written for.

### EP-005 — Class C's `supporting_quotes` renamed `supporting_claim_ids`

Phase 3.1 freeze audit, prompted by the Evidence Runtime Prototype's one
real live model call (Phase 3A): the field always held `proposal_id`
references into `class_a_proposals`, never literal quote text, but the name
`supporting_quotes` invited the opposite reading. The live model acted on
that reading — it populated `supporting_quotes` with literal transcript
text instead of a `proposal_id` — and lost two otherwise well-formed,
correctly under-claimed Class C hypotheses to `CLASS_C_MALFORMED` as a
result. Renamed to `supporting_claim_ids` in `types.ts`, `classC.ts`, every
fixture, and the Specification's Class C schema (which — separately from
this rename — was also missing its own schema block in `evidence-
specification-v1.1.md`'s Section 3; restored in the same pass). No change
to what is validated, how, or what `admissible: false` means — purely a
name change plus a documentation restoration.

### Phase 3.1 freeze audit — action vs. context_fact (Atlas Case 009)

Same live call also typed "We changed our return policy..." and "we also
added two more support reps..." as `action`, where Atlas Case 009 types
both `context_fact`. Audited against the Specification's actual text
(Sections 1-8), which never defines either term in prose — both are enum
entries plus worked Atlas examples only, and Section 4 already acknowledges
claim_type fit "is not fully mechanical." **Conclusion: genuine
Specification ambiguity, not an Atlas error — the Atlas is unchanged.**
Case 009's classification is consistent with Case 008's own precedent
(which types even the confirmed corrective action, "went back to the old
sealant," as `context_fact` rather than `action`, deliberately, to avoid
smuggling causal credit into the Class A/B layer — see the annotation added
to `evidence-atlas-v0.1.md`, Case 008). A candidate prose definition for
`action` vs. `context_fact` is offered in `evidence-specification-v1.1.md`
as a draft for v1.2; it is not adopted as binding v1.1 text. See
`evidence-runtime/README.md`'s Phase 3.1 section for the full audit,
including the sweep of all 10 Atlas cases for the same pattern (Task 3):
no other case needed a classification change.

## v1.0 (superseded)

Original build. See `DAY-ZERO-FINDINGS.md` for the five findings
incorporated during that initial drafting cycle (distinct from the
precedents above, which were found by testing the already-frozen v1.0
specification).
