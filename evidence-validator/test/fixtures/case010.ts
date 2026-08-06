import { ClassAProposal, ClassBProposal, ClassCProposal, ValidatorInput } from "../../src/types";
import { span } from "../helpers";

export const TRANSCRIPT =
  "I noticed our onboarding completion rate had dropped. I shortened the onboarding flow from nine steps to five. " +
  "Completion rates went back up within two weeks.";

const PROBLEM = "our onboarding completion rate had dropped";
const ACTION = "I shortened the onboarding flow from nine steps to five";
const OUTCOME = "Completion rates went back up within two weeks";

export const class_a_proposals: ClassAProposal[] = [
  { proposal_id: "problem", claim_type: "problem", quote: PROBLEM, source_span: span(TRANSCRIPT, PROBLEM) },
  { proposal_id: "action", claim_type: "action", quote: ACTION, source_span: span(TRANSCRIPT, ACTION) },
  { proposal_id: "outcome", claim_type: "outcome", quote: OUTCOME, source_span: span(TRANSCRIPT, OUTCOME) },
];

export const class_b_proposals: ClassBProposal[] = [
  { proposal_id: "B_temporal", relationship_type: "temporal_sequence", marker_text: "", components: ["action", "outcome"] },
];

export const class_c_proposals: ClassCProposal[] = [
  {
    proposal_id: "C_causal",
    hypothesis: "shortening the onboarding flow caused the completion rate increase",
    supporting_claim_ids: ["action", "outcome"],
    reasoning:
      "the temporal sequence (flow shortened, then completion rose within two weeks) suggests but does not confirm " +
      "causation; the transcript is silent on other factors (seasonality, a concurrent marketing change, anything " +
      "else during the same two weeks) that could equally explain the increase. Absence of a competing cause in the " +
      "transcript is not evidence those factors didn't exist.",
    clarification_question:
      "Do you think shortening the flow was the main reason completion rates recovered, or could something else have changed around the same time?",
  },
];

export const input: ValidatorInput = {
  transcript: TRANSCRIPT,
  class_a_proposals,
  class_b_proposals,
  class_c_proposals,
};
