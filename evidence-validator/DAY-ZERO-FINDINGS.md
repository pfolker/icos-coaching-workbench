# Day-Zero Findings

**Status:** these findings were incorporated into Evidence Specification
v1.0 and Evidence Atlas v0.1 during the initial drafting cycle — they are
NOT discoveries made against an already-frozen specification. Formal
Evidence Precedent numbering (EP-001, etc.) is reserved for genuine future
revisions discovered after v1.0/v0.1 shipped. Nothing in this file is a
precedent; it is a record of what shaped the founding documents themselves.

---

## 1. Multiple same-type candidates (Atlas Case 007)

A transcript can propose two or more Class A claims of the same
`claim_type` that are not both true representations of "the" instance of
that type — e.g., two candidate "problem" statements where the speaker
explicitly marks one as background. The Specification does not pick a
winner; this Validator does not either (see Section 8, unresolved question
2, and the task's explicit instruction not to implement an inferred-
precedence rule without a formal revision). v1 behavior: validate every
candidate independently, preserve all of them, attach discourse-marker
metadata when the transcript names the intended subject, and surface
`selection_required` rather than silently discarding alternatives.

## 2. Split ownership (Atlas Case 006)

Ownership within a single answer can be genuinely split — some actions
owned personally, some by a team, some jointly — and this is not a
classification failure to resolve. Each claim validates independently;
nothing is collapsed into one ownership label. This surfaced a real gap
one layer downstream, not in this Specification: the existing Observation
Engine's `agency_verb_i` is a single count per answer with no way to
represent "owns some parts, shares others." Flagged for a future
Observation Contract layer, not fixed here.

## 3. Leading-clarification risk (Specification Section 6/8)

A Class C clarification question that states a hypothesis plainly and
asks for confirmation is, by construction, a leading question. A learner's
quick "yes" produces a technically-valid Class A quote that may not
represent independent verification — the same self-report risk this
specification exists to guard against, resurfacing one level downstream in
the clarification loop itself. Named explicitly as unresolved (Section 8,
question 5) rather than quietly assumed safe. This Validator does not
attempt to fix it; it only confirms a Class C proposal is well-formed, per
its permanent boundary (Section 4, Section 7 Failure Mode 8).

## 4. Absence-of-alternatives as a risk signal, not a safety signal (Atlas Case 010)

A transcript with no competing cause visible for a Class C hypothesis is
*more* dangerous than one with two visible competing causes (Case 008),
not less — a single clean cause-and-effect narrative is the shape most
likely to be trusted without scrutiny, precisely because the absence of
a stated alternative reads as certainty rather than as missing
information. Section 7 treats this as a scrutiny-increasing condition, the
opposite of how it would naturally read to a human skimming for red flags.

## 5. Belief-fact collapse (Atlas Case 009)

A correctly-classified Class A extraction of a speaker's *stated belief*
("I think X caused Y") is not the same claim as an asserted fact ("Root
cause: Y"). The evidence classification can be entirely correct while the
danger is entirely in how correctly-classified evidence gets used
afterward — especially when the same transcript contains an unaddressed
alternative explanation the speaker never rules out. This is the
Specification's own added Constitution principle ("A stated belief is not
the same as an established fact") and Failure Mode 9. This Validator
enforces the boundary mechanically: `speaker_assertion: true` is present
on every validated belief/diagnosis claim, there is no `established_cause`
(or `verified_diagnosis` / `objective_fact` / `confirmed_cause` /
`root_cause`) field anywhere in this package's output types, and any
proposal attempting to introduce one — as the claim_type itself, or as a
smuggled field alongside a valid claim_type — is rejected with
`BELIEF_FACT_COLLAPSE_ATTEMPT`, proven by adversarial regression tests
(see `test/atlas/case009.test.ts`), not merely never exercised.

---

None of these five required abandoning or rewriting the core Class A/B/C
taxonomy. Each sharpened it before v1.0 shipped. That is what Day Zero
findings are for.
