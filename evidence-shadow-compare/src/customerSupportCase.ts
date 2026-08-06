/**
 * New, non-manufacturing validation-corpus case (Founder Directive,
 * Milestone 1, Step 4). Real text used in tonight's live shadow-mode
 * batch run; fixture authored afterward so the same case can be re-run
 * for free/deterministically. This assistant's own independent reading
 * (same authorship convention as every other fixture in this project —
 * not Atlas ground truth, there is no Atlas case for this text).
 */
import { ListenEngineRawOutput } from "../../evidence-runtime/src/modelOutput";

export const TRANSCRIPT =
  "A customer called in really upset because their order had arrived damaged twice in a row. " +
  "I listened to what happened, apologized, and looked into what went wrong with the packaging on our end. " +
  "I sent out a replacement with extra padding and followed up with them a few days later to make sure it arrived fine. " +
  "They ended up staying a customer and even left us a good review.";

export const LISTEN_ENGINE_FIXTURE: ListenEngineRawOutput = {
  class_a_proposals: [
    { proposal_id: "a_problem", claim_type: "problem", quote: "their order had arrived damaged twice in a row" },
    { proposal_id: "a_listened", claim_type: "action", quote: "I listened to what happened" },
    { proposal_id: "a_apologized", claim_type: "action", quote: "apologized" },
    { proposal_id: "a_investigated", claim_type: "action", quote: "looked into what went wrong with the packaging on our end" },
    { proposal_id: "a_replacement", claim_type: "action", quote: "I sent out a replacement with extra padding" },
    { proposal_id: "a_followup", claim_type: "action", quote: "followed up with them a few days later to make sure it arrived fine" },
    { proposal_id: "a_outcome", claim_type: "outcome", quote: "They ended up staying a customer and even left us a good review" },
  ],
  class_b_proposals: [
    { proposal_id: "b_enum", relationship_type: "enumeration", marker_text: "", components: ["a_replacement", "a_followup"] },
  ],
  class_c_proposals: [
    {
      proposal_id: "c_replacement_caused_retention",
      hypothesis: "sending the replacement and following up were what caused the customer to stay and leave a good review",
      supporting_claim_ids: ["a_replacement", "a_followup", "a_outcome"],
      reasoning: "the temporal sequence (replacement sent, followed up, customer stayed and reviewed well) suggests but does not confirm this caused the retention; the transcript is silent on other factors that could have influenced the customer's decision to stay.",
      clarification_question: "Do you think the replacement and follow-up were what won the customer back, or could something else about the interaction have mattered too?",
    },
  ],
};
