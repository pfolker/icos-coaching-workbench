import { ClassAProposal, ValidatorInput } from "../../src/types";
import { span } from "../helpers";

export const TRANSCRIPT =
  "Our biggest challenge that quarter was actually staffing, we lost two technicians right before a major product launch. " +
  "But the specific problem I want to talk about is a calibration drift issue on our vision inspection system that started causing false rejects. " +
  "I traced it to a light source that had degraded over time and was throwing off the contrast readings. " +
  "I replaced the light and added a calibration check to the startup routine so we'd catch drift going forward.";

const STAFFING = "we lost two technicians right before a major product launch";
const CALIBRATION_PROBLEM = "a calibration drift issue on our vision inspection system that started causing false rejects";
const DIAGNOSIS = "I traced it to a light source that had degraded over time and was throwing off the contrast readings";
const REPLACED = "I replaced the light";
const ADDED_CHECK = "added a calibration check to the startup routine";

/**
 * Primary fixture: matches the Atlas's own literal resolution exactly —
 * staffing as context_fact, calibration drift as the problem, no
 * fabricated Outcome (the transcript only states intent — "so we'd catch
 * drift going forward" — never a confirmed result).
 */
export const class_a_proposals: ClassAProposal[] = [
  { proposal_id: "staffing_context", claim_type: "context_fact", quote: STAFFING, source_span: span(TRANSCRIPT, STAFFING) },
  { proposal_id: "calibration_problem", claim_type: "problem", quote: CALIBRATION_PROBLEM, source_span: span(TRANSCRIPT, CALIBRATION_PROBLEM) },
  { proposal_id: "diagnosis", claim_type: "self_reported_diagnosis", quote: DIAGNOSIS, source_span: span(TRANSCRIPT, DIAGNOSIS) },
  { proposal_id: "replaced", claim_type: "action", quote: REPLACED, source_span: span(TRANSCRIPT, REPLACED) },
  { proposal_id: "added_check", claim_type: "action", quote: ADDED_CHECK, source_span: span(TRANSCRIPT, ADDED_CHECK) },
];

export const input: ValidatorInput = {
  transcript: TRANSCRIPT,
  class_a_proposals,
  class_b_proposals: [],
  class_c_proposals: [],
};

/**
 * Secondary fixture: exercises the Multiple-Candidate Handling mechanism
 * itself (Specification Section 8 Q2's spirit, task's explicit
 * requirement), using this same transcript because it's the one with the
 * explicit discourse marker. Here the staffing sentence is ALSO proposed
 * as claim_type "problem" — what a less careful Listen Engine might
 * propose — alongside the calibration-drift "problem" claim, to prove the
 * conservative v1 behavior: both are preserved, neither auto-discarded,
 * selection_required fires, and the discourse marker is attached as
 * metadata only, never used to auto-resolve. This deliberately diverges
 * from the Atlas write-up's own proposed resolution (which retyped
 * staffing to context_fact and effectively picked a winner) per the task's
 * explicit instruction not to implement an inferred-precedence rule
 * without a formal Specification revision.
 */
export const competingProblemProposal: ClassAProposal = {
  proposal_id: "staffing_as_problem",
  claim_type: "problem",
  quote: STAFFING,
  source_span: span(TRANSCRIPT, STAFFING),
};

export const multiCandidateInput: ValidatorInput = {
  transcript: TRANSCRIPT,
  class_a_proposals: [
    competingProblemProposal,
    { proposal_id: "calibration_problem", claim_type: "problem", quote: CALIBRATION_PROBLEM, source_span: span(TRANSCRIPT, CALIBRATION_PROBLEM) },
  ],
  class_b_proposals: [],
  class_c_proposals: [],
};
