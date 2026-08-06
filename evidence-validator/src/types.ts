/**
 * ICOS Evidence Validator — Types
 * Implements Evidence Specification v1.1, Section 3 (schemas) and Section 4
 * (validator contract). Standalone: no import from any other ICOS package.
 *
 * The proposing system (a future Listen Engine; in this build, test
 * fixtures) never assigns its own trusted class. Every input type below is
 * a PROPOSAL — unvalidated, untrusted — distinct from the validated output
 * shapes further down. The Validator computes class and admissibility; it
 * is never told them.
 */

// ---------------------------------------------------------------- inputs

/**
 * Specification v1.1, Section 3. Ten claim_type values, closed enum.
 * `context_fact` and `decision` are new in v1.1 (EP-001, EP-002) — v1.0's
 * enum had only eight values and treated `context_fact` as a Validator-side
 * gap (see CHANGELOG.md and DAY-ZERO-FINDINGS.md for the v1.0 history).
 * `finding` was never a claim_type; it was informal Atlas prose shorthand
 * for `self_reported_diagnosis` (Cases 004, 005) and was formally retired,
 * not added, by EP-002.
 */
export const CLAIM_TYPE_ENUM = [
  "problem", "prior_belief", "self_reported_diagnosis", "action", "decision",
  "outcome", "constraint", "business_value", "context_fact", "reflection",
] as const;
export type ClaimType = (typeof CLAIM_TYPE_ENUM)[number];

/**
 * Belief-fact protection: these are claim_type VALUES that would collapse a
 * stated belief into an asserted fact if accepted (Specification Section 1,
 * "A stated belief is not the same as an established fact"; Section 7,
 * Failure Mode 9). They are not a v1 claim_type under any name and any
 * proposal using one of these as claim_type — or attempting to attach one
 * as a promotion flag on an otherwise-valid proposal — is rejected outright
 * with BELIEF_FACT_COLLAPSE_ATTEMPT, checked BEFORE ordinary enum
 * validation so the rejection reason names the real problem.
 */
export const PROMOTION_LABELS = [
  "established_cause", "verified_diagnosis", "objective_fact",
  "confirmed_cause", "root_cause",
] as const;

export const RELATIONSHIP_TYPE_ENUM = [
  "temporal_sequence", "explicit_connective", "contrast_marker",
  "quantity_binding", "enumeration",
] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPE_ENUM)[number];

export interface SourceSpan {
  start: number;
  end: number;
}

/** A Class A proposal, as submitted by the (untrusted) proposing system. */
export interface ClassAProposal {
  proposal_id: string;
  claim_type: string; // unvalidated; may be outside CLAIM_TYPE_ENUM, or a promotion-label attack
  quote: string;
  source_span: SourceSpan;
  /**
   * Deliberately NOT part of the legitimate schema. Its presence on an
   * input object (any truthy value, any key in PROMOTION_LABELS) is itself
   * a belief-fact collapse attempt distinct from claim_type misuse — see
   * belief-fact protection above. Declared here only so TypeScript allows
   * constructing adversarial test fixtures without `as any`.
   */
  established_cause?: unknown;
  verified_diagnosis?: unknown;
  objective_fact?: unknown;
  confirmed_cause?: unknown;
  root_cause?: unknown;
}

/** A Class B proposal. `components` reference Class A proposal_ids. */
export interface ClassBProposal {
  proposal_id: string;
  relationship_type: string; // unvalidated
  components: string[]; // Class A proposal_id references, in the stated order
  marker_text: string;
}

/**
 * A Class C proposal. Non-admissible by construction in v1.
 *
 * `supporting_claim_ids` — Specification v1.1, EP-005: renamed from
 * `supporting_quotes`. This field holds proposal_id references into
 * class_a_proposals, never literal quote text — the old name invited the
 * opposite reading, and a real Listen Engine call did exactly that (see
 * CHANGELOG.md).
 */
export interface ClassCProposal {
  proposal_id: string;
  hypothesis: string;
  supporting_claim_ids: string[]; // Class A proposal_id references
  reasoning: string;
  clarification_question: string;
}

export interface ValidatorInput {
  transcript: string;
  class_a_proposals: ClassAProposal[];
  class_b_proposals: ClassBProposal[];
  class_c_proposals: ClassCProposal[];
}

// --------------------------------------------------------------- outputs

export interface ValidatedClassA {
  evidence_class: "A";
  proposal_id: string;
  claim_type: ClaimType;
  quote: string;
  source_span: SourceSpan;
  /**
   * Belief-fact protection, made explicit in the output shape itself
   * (Belief-Fact Protection section): true for the two claim_types that
   * represent a speaker's stated belief/diagnosis rather than a directly
   * observed fact. This is a description of what was validated, never a
   * promotion — there is no established_cause field anywhere in this
   * package's output types.
   */
  speaker_assertion: boolean;
  /**
   * Additive-transparency field (Evidence Runtime Prototype, Debug UI
   * requirement "which rule admitted this claim"). Human-readable record of
   * which specific mechanical Class A rule(s) this claim satisfied. Purely
   * descriptive of validation that already happened in classA.ts — adding
   * this field changes no admission criteria.
   */
  admitted_by: string;
}

/** temporal_sequence's two mechanical ordering bases (Specification v1.1, EP-004). */
export const ORDERING_BASIS_ENUM = [
  "raw_position", "connector:once", "connector:after", "connector:before",
] as const;
export type OrderingBasis = (typeof ORDERING_BASIS_ENUM)[number];

export interface ValidatedClassB {
  evidence_class: "B";
  proposal_id: string;
  relationship_type: RelationshipType;
  components: string[]; // validated Class A proposal_ids
  marker_text: string;
  /**
   * Present ONLY for relationship_type "temporal_sequence" (Specification
   * v1.1, EP-004). Records which mechanical rule produced the ordering —
   * raw transcript position (default), or a closed, fixed subordinating
   * connector ("once"/"after"/"before") whose logical meaning determined
   * order instead. Always auditable, never just the conclusion.
   */
  ordering_basis?: OrderingBasis;
  /**
   * Additive-transparency field (Evidence Runtime Prototype, Debug UI
   * requirement "which rule admitted this claim"). Human-readable record of
   * which specific relationship_type sub-rule matched (which marker, which
   * ordering_basis, self-contained vs. bridging, etc.) — descriptive only,
   * computed from a decision classB.ts already made.
   */
  admitted_by: string;
}

/**
 * Class C is structurally non-admissible: `admissible` is always `false`
 * and `allowed_uses` is always exactly this fixed tuple. There is no
 * coaching graph in this package, but the restriction is enforced in the
 * type and value shape itself (never variable, never settable by a
 * caller), not just documented in prose.
 */
export const CLASS_C_ALLOWED_USES = [
  "experimental_logging", "atlas_evaluation", "clarification_candidate",
] as const;

export interface ClassCNonAdmissible {
  evidence_class: "C";
  proposal_id: string;
  hypothesis: string;
  supporting_claim_ids: string[];
  reasoning: string;
  clarification_question: string;
  admissible: false;
  allowed_uses: typeof CLASS_C_ALLOWED_USES;
  /**
   * Additive-transparency field, same rationale as ValidatedClassA/B's
   * `admitted_by`. Class C is never admitted into the coaching graph, but
   * the Debug UI still needs to show which structural check this proposal
   * passed to be logged as well-formed non-admissible evidence at all.
   */
  admitted_by: string;
}

export const REASON_CODES = [
  "QUOTE_NOT_FOUND",
  "SOURCE_SPAN_MISMATCH",
  "CLAIM_TYPE_UNKNOWN",
  "CLAIM_TYPE_MISMATCH",
  "CLAIM_TYPE_UNVERIFIABLE",
  "COMPONENT_NOT_VALIDATED",
  "RELATIONSHIP_TYPE_UNKNOWN",
  "MARKER_NOT_FOUND",
  "ORDER_INVALID",
  "QUANTITY_BINDING_INVALID",
  "ENUMERATION_INVALID", // ADDED beyond the seed list — see README.md / report deliverable 4
  "CLASS_C_MALFORMED",
  "BELIEF_FACT_COLLAPSE_ATTEMPT",
  /**
   * From the seed list, kept for schema completeness, but NOT currently
   * emitted as a `rejected` reason_code by any code path in this build.
   * Case 007's multiple-candidate scenario is represented via the
   * dedicated `selection_required` output category instead — nothing
   * about competing candidates is rejected; per the task's explicit
   * instruction, all valid candidates are preserved and flagged for
   * selection, never discarded. Reserved here in case a future revision
   * introduces a rejection-flavored variant of multi-candidate handling.
   */
  "MULTIPLE_CANDIDATES_UNRESOLVED",
  /**
   * From the seed list, kept for schema completeness, but NOT currently
   * emitted as a `rejected` reason_code by any path. Under v1.0 this
   * covered the (now-resolved, see EP-001) context_fact enum gap via the
   * dedicated `specification_gaps` output array rather than a rejection.
   * Reserved for a future case where a proposal must be rejected
   * specifically because the Specification doesn't yet resolve how to
   * handle it (distinct from CLAIM_TYPE_UNVERIFIABLE, which is about
   * claim_type fit specifically). As of v1.1, four such frictions were
   * resolved as formal Evidence Precedents (EP-001–EP-004) instead of
   * staying open gaps — see CHANGELOG.md.
   */
  "SPECIFICATION_GAP",
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

export interface Rejected {
  proposal_id: string;
  reason_code: ReasonCode;
  explanation: string;
}

/**
 * Emitted when a quote is valid Class A grounding (rules 1-2 pass and no
 * obvious mismatch is detected) but claim_type fit genuinely cannot be
 * established mechanically either way. Distinct from Rejected: this claim
 * is NOT thrown out, it needs a human look. Distinct from
 * CLAIM_TYPE_MISMATCH: that is for the narrower "obviously wrong" case.
 */
export interface RequiresReview {
  proposal_id: string;
  reason_code: ReasonCode; // always CLAIM_TYPE_UNVERIFIABLE in v1
  explanation: string;
  quote: string;
  claim_type: string;
  source_span: SourceSpan;
}

/**
 * Multiple-candidate handling (Atlas Case 007). Emitted when two or more
 * Class A proposals of the SAME claim_type compete to represent the same
 * slot in the story and neither the Specification nor this Validator picks
 * a winner. All competing candidates remain in validated_class_a; nothing
 * is silently discarded.
 */
export interface SelectionRequired {
  claim_type: ClaimType;
  candidate_proposal_ids: string[];
  /**
   * Present only when the transcript explicitly names the intended
   * subject (e.g. "the specific problem I want to talk about is..."). This
   * is METADATA ONLY — attached, never used to auto-select a winner. Per
   * the task's explicit instruction, an inferred-precedence rule is not
   * implemented absent a formal Specification revision.
   */
  discourse_marker?: { marker_text: string; marked_proposal_id: string };
  explanation: string;
}

export interface SpecificationGap {
  gap_id: string;
  description: string;
}

export interface ValidatorOutput {
  validated_class_a: ValidatedClassA[];
  validated_class_b: ValidatedClassB[];
  class_c_non_admissible: ClassCNonAdmissible[];
  rejected: Rejected[];
  requires_review: RequiresReview[];
  selection_required: SelectionRequired[];
  specification_gaps: SpecificationGap[];
}
