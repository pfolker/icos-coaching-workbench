import { ListenEngineRawOutput } from "../src/modelOutput";

export const TRANSCRIPT =
  "Our biggest challenge that quarter was actually staffing, we lost two technicians right before a major product launch. " +
  "But the specific problem I want to talk about is a calibration drift issue on our vision inspection system that started causing false rejects. " +
  "I traced it to a light source that had degraded over time and was throwing off the contrast readings. " +
  "I replaced the light and added a calibration check to the startup routine so we'd catch drift going forward.";

/** Primary fixture: a careful, single reading — one "problem" candidate. */
export const LISTEN_ENGINE_FIXTURE: ListenEngineRawOutput = {
  class_a_proposals: [
    { proposal_id: "a_staffing", claim_type: "context_fact", quote: "we lost two technicians right before a major product launch" },
    { proposal_id: "a_problem", claim_type: "problem", quote: "a calibration drift issue on our vision inspection system that started causing false rejects" },
    { proposal_id: "a_diagnosis", claim_type: "self_reported_diagnosis", quote: "I traced it to a light source that had degraded over time and was throwing off the contrast readings" },
    { proposal_id: "a_replaced", claim_type: "action", quote: "I replaced the light" },
    { proposal_id: "a_added_check", claim_type: "action", quote: "added a calibration check to the startup routine" },
  ],
  class_b_proposals: [
    { proposal_id: "b_enum", relationship_type: "enumeration", marker_text: "", components: ["a_replaced", "a_added_check"] },
  ],
  class_c_proposals: [],
};

/**
 * Secondary fixture: what a LESS careful Listen Engine might plausibly
 * produce — proposing the staffing sentence ALSO as claim_type "problem"
 * (real, quotable content; a naive extraction pass could reasonably tag it
 * this way before noticing the discourse marker). Exercises the Validator's
 * multiple-candidate handling: both survive validation, selection_required
 * fires, and the "the specific problem I want to talk about is..." marker
 * is attached as metadata only — never used to auto-resolve.
 */
export const LISTEN_ENGINE_FIXTURE_MULTI_CANDIDATE: ListenEngineRawOutput = {
  class_a_proposals: [
    { proposal_id: "a_staffing_as_problem", claim_type: "problem", quote: "we lost two technicians right before a major product launch" },
    { proposal_id: "a_problem", claim_type: "problem", quote: "a calibration drift issue on our vision inspection system that started causing false rejects" },
  ],
  class_b_proposals: [],
  class_c_proposals: [],
};
