import { ClassAProposal, ClassBProposal, ValidatorInput } from "../../src/types";
import { span } from "../helpers";

export const TRANSCRIPT =
  "We noticed the reports were going out late every week, so we looked into the process and found the data pull was happening " +
  "manually and someone had to remember to kick it off every Friday. We automated it with a scheduled script and now it runs on its own.";

const PROBLEM = "the reports were going out late every week";
const LOOKED_INTO = "we looked into the process";
const FINDING = "the data pull was happening manually and someone had to remember to kick it off every Friday";
const AUTOMATED = "We automated it with a scheduled script";
const OUTCOME = "now it runs on its own";

export const class_a_proposals: ClassAProposal[] = [
  { proposal_id: "problem", claim_type: "problem", quote: PROBLEM, source_span: span(TRANSCRIPT, PROBLEM) },
  { proposal_id: "looked_into", claim_type: "action", quote: LOOKED_INTO, source_span: span(TRANSCRIPT, LOOKED_INTO) },
  { proposal_id: "finding", claim_type: "self_reported_diagnosis", quote: FINDING, source_span: span(TRANSCRIPT, FINDING) },
  { proposal_id: "automated", claim_type: "action", quote: AUTOMATED, source_span: span(TRANSCRIPT, AUTOMATED) },
  { proposal_id: "outcome", claim_type: "outcome", quote: OUTCOME, source_span: span(TRANSCRIPT, OUTCOME) },
];

export const class_b_proposals: ClassBProposal[] = [
  { proposal_id: "B_so", relationship_type: "explicit_connective", marker_text: "so", components: ["problem", "looked_into"] },
];

/**
 * "The speaker personally wrote the automation script" — the Atlas's own
 * rejected claim, and its own stated reason ("Not supported by any quote").
 * The transcript uses "we" throughout with zero first-person-singular
 * language, so there genuinely is no verbatim quote asserting personal
 * authorship to propose here — this proposal's quote does not exist in the
 * transcript, which is exactly what should reject it.
 */
export const rejected_personal_authorship_proposal: ClassAProposal = {
  proposal_id: "personal_authorship",
  claim_type: "action",
  quote: "I personally wrote the automation script",
  source_span: { start: 0, end: 0 }, // irrelevant; quote itself is not in the transcript
};

export const input: ValidatorInput = {
  transcript: TRANSCRIPT,
  class_a_proposals: [...class_a_proposals, rejected_personal_authorship_proposal],
  class_b_proposals,
  class_c_proposals: [],
};
