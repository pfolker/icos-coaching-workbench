/**
 * Class A validation — Specification Section 4, "Validating Class A".
 *
 * Rules 1-3 (quote verbatim, span matches, claim_type in the closed enum)
 * are fully mechanical and implemented directly. Rule 4 ("the claim adds
 * no content beyond the quote") is explicitly acknowledged by the
 * Specification itself as carrying residual judgment ("deciding which
 * claim_type label best fits... is not fully mechanical"). This file does
 * NOT attempt full semantic classification — that would be exactly the
 * "semantic scoring pretending to be deterministic" the task boundaries
 * forbid. It implements only:
 *   - a narrow, symmetric mismatch check between the two claim_type
 *     families with genuinely disjoint, reliable lexical signal
 *     (cognition/belief-reporting vs. first-person physical/decision
 *     action) — catching only OBVIOUS mismatches, never used to positively
 *     confirm any claim_type,
 *   - a narrow "mixed signal" check for the same family pair, returned as
 *     requires_review rather than guessed either direction.
 * Every other claim_type (problem, outcome, constraint, business_value,
 * reflection, context_fact) is not fitted against any positive or negative
 * lexicon in this build: Section 4's own text treats claim_type fit as a
 * "smaller, checkable risk" precisely because the quote ships alongside
 * the label for human verification, not because this Validator resolves
 * it. Attempting a problem/outcome polarity lexicon, for instance, would
 * be unreliable by construction (the same words — "dropped," "improved" —
 * indicate a problem or an outcome depending on what changed, not the word
 * itself) and is deliberately not implemented.
 */
import {
  CLAIM_TYPE_ENUM, ClaimType, ClassAProposal, PROMOTION_LABELS,
  Rejected, RequiresReview, ValidatedClassA,
} from "./types";
import { ACTION_VERBS, COGNITION_MARKERS } from "./lexicons";

const BELIEF_TYPES = new Set(["prior_belief", "self_reported_diagnosis"]);
const PROMOTION_FIELD_KEYS = [
  "established_cause", "verified_diagnosis", "objective_fact", "confirmed_cause", "root_cause",
] as const;

export type ClassAResult =
  | { outcome: "validated"; claim: ValidatedClassA }
  | { outcome: "rejected"; rejection: Rejected }
  | { outcome: "requires_review"; review: RequiresReview };

export function validateClassAProposal(proposal: ClassAProposal, transcript: string): ClassAResult {
  const typeLower = proposal.claim_type.trim().toLowerCase();

  // ---- Belief-Fact Protection: checked FIRST, before any other rule, so
  // the rejection reason names the real problem instead of falling through
  // to a generic "unknown type." Two attack shapes: (a) claim_type itself
  // is a promotion label, (b) claim_type is otherwise valid but a
  // promotion field is smuggled onto the proposal alongside it. ----
  if ((PROMOTION_LABELS as readonly string[]).includes(typeLower)) {
    return {
      outcome: "rejected",
      rejection: {
        proposal_id: proposal.proposal_id,
        reason_code: "BELIEF_FACT_COLLAPSE_ATTEMPT",
        explanation:
          `claim_type "${proposal.claim_type}" is a promotion label, not a v1 claim_type. ` +
          `A stated belief or diagnosis may validate as Class A evidence that the speaker said ` +
          `it; it may never be labeled as an established/verified/objective/confirmed/root cause ` +
          `directly by the proposing system. This requires a separate, explicit promotion step ` +
          `that does not exist in this Validator.`,
      },
    };
  }
  const smuggledField = PROMOTION_FIELD_KEYS.find((k) => (proposal as unknown as Record<string, unknown>)[k]);
  if (smuggledField) {
    return {
      outcome: "rejected",
      rejection: {
        proposal_id: proposal.proposal_id,
        reason_code: "BELIEF_FACT_COLLAPSE_ATTEMPT",
        explanation:
          `proposal carries a "${smuggledField}" field attempting to assert a promotion ` +
          `alongside claim_type "${proposal.claim_type}". Belief-fact collapse is rejected ` +
          `regardless of which field the promotion is attempted through.`,
      },
    };
  }

  // ---- Rule 1: quote exists verbatim (whitespace trimming only). ----
  const quote = proposal.quote.trim();
  if (quote.length === 0 || !transcript.includes(quote)) {
    return {
      outcome: "rejected",
      rejection: {
        proposal_id: proposal.proposal_id,
        reason_code: "QUOTE_NOT_FOUND",
        explanation: quote.length === 0
          ? "quote is empty after whitespace trimming; nothing to ground."
          : `quote "${proposal.quote}" does not exist verbatim in the transcript.`,
      },
    };
  }

  // ---- Rule 2: source span exactly matches the quote. ----
  const { start, end } = proposal.source_span;
  const inBounds = Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end <= transcript.length && start < end;
  const spanText = inBounds ? transcript.slice(start, end).trim() : "";
  if (!inBounds || spanText !== quote) {
    return {
      outcome: "rejected",
      rejection: {
        proposal_id: proposal.proposal_id,
        reason_code: "SOURCE_SPAN_MISMATCH",
        explanation: inBounds
          ? `source_span [${start}, ${end}) resolves to "${spanText}", which does not match quote "${quote}".`
          : `source_span [${start}, ${end}) is out of bounds or invalid for a transcript of length ${transcript.length}.`,
      },
    };
  }

  // ---- Rule 3: claim_type is one of the closed enum values. ----
  if (!(CLAIM_TYPE_ENUM as readonly string[]).includes(typeLower)) {
    return {
      outcome: "rejected",
      rejection: {
        proposal_id: proposal.proposal_id,
        reason_code: "CLAIM_TYPE_UNKNOWN",
        explanation: `claim_type "${proposal.claim_type}" is not in the v1 enum. ` +
          `Specification Section 8, Question 2 leaves "reject vs. route to Class C" formally ` +
          `unresolved; this Validator rejects outright as the conservative default.`,
      },
    };
  }
  const claimType = typeLower as ClaimType;

  // ---- Rule 4 (bounded): narrow, symmetric mismatch/uncertainty check. ----
  const cognitionHit = COGNITION_MARKERS.test(quote);
  const actionHit = ACTION_VERBS.test(quote);

  if (claimType === "action" && cognitionHit && !actionHit) {
    return {
      outcome: "rejected",
      rejection: {
        proposal_id: proposal.proposal_id,
        reason_code: "CLAIM_TYPE_MISMATCH",
        explanation: `quote "${quote}" is built entirely from cognition/diagnosis language ` +
          `("thought"/"realized"/"pointed to"/etc.) with no first-person action verb present; ` +
          `labeling it "action" asserts more than the quote supports.`,
      },
    };
  }
  if (BELIEF_TYPES.has(claimType) && actionHit && !cognitionHit) {
    return {
      outcome: "rejected",
      rejection: {
        proposal_id: proposal.proposal_id,
        reason_code: "CLAIM_TYPE_MISMATCH",
        explanation: `quote "${quote}" is a bare first-person/team action clause with no ` +
          `cognition or diagnostic-conclusion language present; labeling it "${claimType}" ` +
          `asserts a belief/diagnosis the quote doesn't show.`,
      },
    };
  }
  if ((claimType === "action" || BELIEF_TYPES.has(claimType)) && cognitionHit && actionHit) {
    return {
      outcome: "requires_review",
      review: {
        proposal_id: proposal.proposal_id,
        reason_code: "CLAIM_TYPE_UNVERIFIABLE",
        explanation: `quote "${quote}" contains both cognition/diagnosis language and a ` +
          `first-person action verb; whether "${claimType}" is the better-fitting label ` +
          `cannot be established mechanically either way.`,
        quote,
        claim_type: proposal.claim_type,
        source_span: proposal.source_span,
      },
    };
  }

  const mismatchCheckApplies = claimType === "action" || BELIEF_TYPES.has(claimType);
  const admitted_by = mismatchCheckApplies
    ? `rules 1-3 (verbatim quote in transcript; source_span resolves to quote; claim_type "${claimType}" in closed enum) + rule 4 lexical mismatch check (cognition-marker vs. action-verb scan) found no mismatch`
    : `rules 1-3 (verbatim quote in transcript; source_span resolves to quote; claim_type "${claimType}" in closed enum); rule 4 lexical mismatch check does not apply to claim_type "${claimType}"`;

  return {
    outcome: "validated",
    claim: {
      evidence_class: "A",
      proposal_id: proposal.proposal_id,
      claim_type: claimType,
      quote,
      source_span: proposal.source_span,
      speaker_assertion: BELIEF_TYPES.has(claimType),
      admitted_by,
    },
  };
}
