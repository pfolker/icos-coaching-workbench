/**
 * New, non-manufacturing validation-corpus case (Founder Directive,
 * Milestone 1, Step 4) — deliberately a NEGATIVE CONTROL for the O3
 * ladder: this outcome IS quantified ("15 percent higher... for another
 * two years"), so the adapter should find a quantity_binding edge on the
 * outcome claim and NOT fire either O3 state. Real text used in tonight's
 * live shadow-mode batch run; fixture authored afterward. This assistant's
 * own independent reading (not Atlas ground truth).
 */
import { ListenEngineRawOutput } from "../../evidence-runtime/src/modelOutput";

export const TRANSCRIPT =
  "One of our long-time accounts was about to churn because a competitor undercut our pricing. " +
  "I put together a custom retention proposal that bundled two of our add-on services at a discount instead of just cutting the base price. " +
  "I walked the client through the long-term cost savings compared to switching providers. " +
  "They renewed for another two years at a 15 percent higher total contract value than before.";

export const LISTEN_ENGINE_FIXTURE: ListenEngineRawOutput = {
  class_a_proposals: [
    { proposal_id: "a_problem", claim_type: "problem", quote: "One of our long-time accounts was about to churn because a competitor undercut our pricing" },
    { proposal_id: "a_proposal", claim_type: "action", quote: "I put together a custom retention proposal that bundled two of our add-on services at a discount instead of just cutting the base price" },
    { proposal_id: "a_walked", claim_type: "action", quote: "I walked the client through the long-term cost savings compared to switching providers" },
    { proposal_id: "a_outcome", claim_type: "outcome", quote: "They renewed for another two years at a 15 percent higher total contract value than before" },
  ],
  class_b_proposals: [
    // the outcome quote itself contains the literal number+unit ("15
    // percent", "two years") — quantity_binding applies directly to it,
    // matching the Specification's own definition of the relationship.
    { proposal_id: "b_quantity", relationship_type: "quantity_binding", marker_text: "", components: ["a_outcome"] },
  ],
  class_c_proposals: [
    {
      proposal_id: "c_proposal_caused_renewal",
      hypothesis: "the bundled discount proposal, rather than the cost-savings walkthrough, was the deciding factor in the renewal",
      supporting_claim_ids: ["a_proposal", "a_walked", "a_outcome"],
      reasoning: "both the proposal and the walkthrough happened before the renewal, but the transcript does not state which one the client found more persuasive, or whether both were needed together.",
      clarification_question: "Do you think the bundled discount itself was what won the renewal, or did the cost-savings walkthrough matter just as much?",
    },
  ],
};
