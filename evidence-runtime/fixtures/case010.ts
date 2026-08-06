import { ListenEngineRawOutput } from "../src/modelOutput";

export const TRANSCRIPT =
  "I noticed our onboarding completion rate had dropped. I shortened the onboarding flow from nine steps to five. " +
  "Completion rates went back up within two weeks.";

/**
 * Case 010 — no competing cause anywhere in the text, which the Atlas
 * flags as MORE dangerous than Case 008, not less, because the causal
 * story feels airtight with nothing visibly contested. Correct behavior:
 * the causal claim stays Class C regardless of how clean the narrative
 * reads — silence about other factors (seasonality, a concurrent change)
 * is absence of information, not evidence they didn't exist.
 */
export const LISTEN_ENGINE_FIXTURE: ListenEngineRawOutput = {
  class_a_proposals: [
    { proposal_id: "a_problem", claim_type: "problem", quote: "our onboarding completion rate had dropped" },
    { proposal_id: "a_action", claim_type: "action", quote: "I shortened the onboarding flow from nine steps to five" },
    { proposal_id: "a_outcome", claim_type: "outcome", quote: "Completion rates went back up within two weeks" },
  ],
  class_b_proposals: [
    { proposal_id: "b_temporal", relationship_type: "temporal_sequence", marker_text: "", components: ["a_action", "a_outcome"] },
    { proposal_id: "b_quantity", relationship_type: "quantity_binding", marker_text: "", components: ["a_action"] },
  ],
  class_c_proposals: [
    {
      proposal_id: "c_causal",
      hypothesis: "shortening the onboarding flow caused the completion rate increase",
      supporting_claim_ids: ["a_action", "a_outcome"],
      reasoning: "the temporal sequence (flow shortened, then completion rose within two weeks) suggests but does not confirm causation; the transcript is silent on other factors (seasonality, a concurrent marketing change) that could equally explain the increase. Absence of a competing cause in the transcript is not evidence those factors didn't exist.",
      clarification_question: "Do you think shortening the flow was the main reason completion rates recovered, or could something else have changed around the same time?",
    },
  ],
};
