/**
 * New, non-manufacturing validation-corpus case (Founder Directive,
 * Milestone 1, Step 4) — healthcare domain. Real text used in tonight's
 * live shadow-mode batch run; fixture authored afterward. This assistant's
 * own independent reading (not Atlas ground truth).
 */
import { ListenEngineRawOutput } from "../../evidence-runtime/src/modelOutput";

export const TRANSCRIPT =
  "A patient on my unit started showing signs of confusion and elevated heart rate that didn't match her chart. " +
  "The night before her vitals had been stable, so this was a real change. " +
  "I flagged it to the attending right away instead of waiting for the scheduled check, and we caught early signs of sepsis before it progressed further. " +
  "She was moved to a higher level of care and pulled through without any lasting complications.";

export const LISTEN_ENGINE_FIXTURE: ListenEngineRawOutput = {
  class_a_proposals: [
    { proposal_id: "a_problem", claim_type: "problem", quote: "A patient on my unit started showing signs of confusion and elevated heart rate that didn't match her chart" },
    { proposal_id: "a_context", claim_type: "context_fact", quote: "The night before her vitals had been stable" },
    { proposal_id: "a_action", claim_type: "action", quote: "I flagged it to the attending right away instead of waiting for the scheduled check" },
    { proposal_id: "a_diagnosis", claim_type: "self_reported_diagnosis", quote: "we caught early signs of sepsis before it progressed further" },
    { proposal_id: "a_outcome1", claim_type: "outcome", quote: "She was moved to a higher level of care" },
    { proposal_id: "a_outcome2", claim_type: "outcome", quote: "pulled through without any lasting complications" },
  ],
  class_b_proposals: [
    { proposal_id: "b_temporal", relationship_type: "temporal_sequence", marker_text: "", components: ["a_action", "a_diagnosis"] },
    { proposal_id: "b_enum_outcomes", relationship_type: "enumeration", marker_text: "", components: ["a_outcome1", "a_outcome2"] },
  ],
  class_c_proposals: [
    {
      proposal_id: "c_early_flag_caused_catch",
      hypothesis: "flagging the change to the attending immediately, rather than waiting for the scheduled check, was what allowed the sepsis to be caught early",
      supporting_claim_ids: ["a_action", "a_diagnosis"],
      reasoning: "the stated temporal sequence (flagged immediately, then caught early) suggests but does not confirm the earlier flagging specifically was the deciding factor versus other monitoring already in place.",
      clarification_question: "Do you think flagging it immediately was what made the difference, or would the scheduled check likely have caught it too?",
    },
  ],
};
