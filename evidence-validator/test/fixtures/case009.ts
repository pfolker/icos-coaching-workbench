import { ClassAProposal, ValidatorInput } from "../../src/types";
import { span } from "../helpers";

export const TRANSCRIPT =
  "We changed our return policy to be more lenient at the start of the quarter. " +
  "Customer complaints about our support process dropped by the end of the quarter. " +
  "I think the complaints dropped because agents were less stressed after we also added two more support reps that same month.";

const POLICY_CHANGE = "We changed our return policy to be more lenient at the start of the quarter";
const ADDED_REPS = "we also added two more support reps that same month";
const OUTCOME = "Customer complaints about our support process dropped by the end of the quarter";
const BELIEF = "I think the complaints dropped because agents were less stressed after we also added two more support reps that same month";

export const class_a_proposals: ClassAProposal[] = [
  { proposal_id: "policy_change", claim_type: "context_fact", quote: POLICY_CHANGE, source_span: span(TRANSCRIPT, POLICY_CHANGE) },
  { proposal_id: "added_reps", claim_type: "context_fact", quote: ADDED_REPS, source_span: span(TRANSCRIPT, ADDED_REPS) },
  { proposal_id: "outcome", claim_type: "outcome", quote: OUTCOME, source_span: span(TRANSCRIPT, OUTCOME) },
  { proposal_id: "belief", claim_type: "self_reported_diagnosis", quote: BELIEF, source_span: span(TRANSCRIPT, BELIEF) },
];

export const input: ValidatorInput = {
  transcript: TRANSCRIPT,
  class_a_proposals,
  class_b_proposals: [],
  class_c_proposals: [],
};

/** Attack shape (a): claim_type IS the promotion label directly. */
export const promotionAttemptViaClaimType: ClassAProposal = {
  proposal_id: "belief_promoted_a",
  claim_type: "established_cause",
  quote: BELIEF,
  source_span: span(TRANSCRIPT, BELIEF),
};

/** Attack shape (b): claim_type stays valid, but a promotion field is smuggled in. */
export const promotionAttemptViaSmuggledField: ClassAProposal = {
  proposal_id: "belief_promoted_b",
  claim_type: "self_reported_diagnosis",
  quote: BELIEF,
  source_span: span(TRANSCRIPT, BELIEF),
  established_cause: true,
};
