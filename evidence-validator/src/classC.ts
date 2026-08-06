/**
 * Class C validation — Specification Section 4, "Validating Class C".
 * Confirms only that the proposal is properly formed. Never scores or
 * validates the logical soundness of the reasoning (Section 4 rule 3,
 * Section 7 Failure Mode 8) — that is a permanent boundary, not a v1
 * limitation to work around, and this file makes no attempt at it.
 */
import { CLASS_C_ALLOWED_USES, ClassCNonAdmissible, ClassCProposal, Rejected } from "./types";

export type ClassCResult =
  | { outcome: "validated"; claim: ClassCNonAdmissible }
  | { outcome: "rejected"; rejection: Rejected };

export function validateClassCProposal(
  proposal: ClassCProposal,
  validatedClassAIds: Set<string>,
): ClassCResult {
  const reject = (explanation: string): ClassCResult => ({
    outcome: "rejected",
    rejection: { proposal_id: proposal.proposal_id, reason_code: "CLASS_C_MALFORMED", explanation },
  });

  if (proposal.hypothesis.trim().length === 0) return reject("hypothesis is empty.");
  if (proposal.reasoning.trim().length === 0) return reject("reasoning is empty.");
  if (proposal.clarification_question.trim().length === 0) return reject("clarification_question is empty.");
  if (proposal.supporting_claim_ids.length === 0) {
    return reject("no supporting_claim_ids were provided; a Class C hypothesis must be grounded in at least one Class A claim.");
  }
  const hasValidatedSupport = proposal.supporting_claim_ids.some((id) => validatedClassAIds.has(id));
  if (!hasValidatedSupport) {
    return reject("none of the supporting_claim_ids resolve to an already-validated Class A claim.");
  }

  return {
    outcome: "validated",
    claim: {
      evidence_class: "C",
      proposal_id: proposal.proposal_id,
      hypothesis: proposal.hypothesis,
      supporting_claim_ids: proposal.supporting_claim_ids,
      reasoning: proposal.reasoning,
      clarification_question: proposal.clarification_question,
      admissible: false,
      allowed_uses: CLASS_C_ALLOWED_USES,
      admitted_by: "class_c_structural_check: hypothesis/reasoning/clarification_question non-empty; " +
        "at least one supporting_claim_id resolves to an already-validated Class A claim (reasoning soundness not scored)",
    },
  };
}
