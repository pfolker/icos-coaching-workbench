import { ListenEngineRawOutput } from "../src/modelOutput";

export const TRANSCRIPT =
  "We had a batch of parts fail a pressure test. Right before that batch ran, we'd both switched to a new sealant supplier " +
  "and the technician running that shift was new and still training. The failures stopped once we went back to the old sealant.";

/**
 * Deliberately proposed in the transcript's own SEMANTIC order
 * (reverted -> stopped), which is the natural way to narrate "once X, Y"
 * causally and NOT the raw left-to-right order "The failures stopped"
 * happens to appear in. This is exactly the shape EP-004's connector-
 * governed ordering was built to rescue — a real model narrating causally
 * has no particular reason to reorder components to match raw transcript
 * position, since it never sees positions, only words.
 */
export const LISTEN_ENGINE_FIXTURE: ListenEngineRawOutput = {
  class_a_proposals: [
    { proposal_id: "a_problem", claim_type: "problem", quote: "a batch of parts fail a pressure test" },
    { proposal_id: "a_sealant", claim_type: "context_fact", quote: "we'd both switched to a new sealant supplier" },
    { proposal_id: "a_technician", claim_type: "context_fact", quote: "the technician running that shift was new and still training" },
    { proposal_id: "a_stopped", claim_type: "context_fact", quote: "The failures stopped" },
    { proposal_id: "a_reverted", claim_type: "context_fact", quote: "we went back to the old sealant" },
  ],
  class_b_proposals: [
    { proposal_id: "b_temporal", relationship_type: "temporal_sequence", marker_text: "", components: ["a_reverted", "a_stopped"] },
  ],
  class_c_proposals: [
    {
      proposal_id: "c_sealant",
      hypothesis: "the sealant change caused the failures",
      supporting_claim_ids: ["a_sealant", "a_reverted", "a_stopped"],
      reasoning: "the stated temporal correlation (failures stopped once the sealant was reverted) suggests but does not confirm causation; the speaker never states this directly.",
      clarification_question: "Do you think the sealant itself was the cause, or could the new technician's process have played a role too?",
    },
    {
      proposal_id: "c_technician",
      hypothesis: "the new technician's inexperience contributed to the failures",
      supporting_claim_ids: ["a_technician"],
      reasoning: "the technician was new and training during the same shift the failures occurred, but this is equally plausible and unconfirmed relative to the sealant hypothesis.",
      clarification_question: "Do you think the new technician's inexperience could have contributed to the failures?",
    },
  ],
};
