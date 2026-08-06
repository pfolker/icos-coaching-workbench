import { ListenEngineRawOutput } from "../src/modelOutput";

export const TRANSCRIPT =
  "We changed our return policy to be more lenient at the start of the quarter. " +
  "Customer complaints about our support process dropped by the end of the quarter. " +
  "I think the complaints dropped because agents were less stressed after we also added two more support reps that same month.";

/**
 * Case 009 — "the single most important test" (see root README.md). The
 * correctly-behaved fixture below types the speaker's causal belief as
 * self_reported_diagnosis, exactly what the system prompt instructs: a
 * claim about what the speaker SAID, never a claim that it's true. The
 * belief-fact collapse this case exists to catch is a DOWNSTREAM risk
 * (Specification Failure Mode 9) — it would show up if something tried to
 * promote this correctly-classified claim into "Root cause: agent stress
 * reduction" afterward, which nothing in this pipeline does. Stage 4's
 * Evidence Graph carries the claim as speaker_assertion: true and nothing
 * stronger.
 */
export const LISTEN_ENGINE_FIXTURE: ListenEngineRawOutput = {
  class_a_proposals: [
    { proposal_id: "a_policy", claim_type: "context_fact", quote: "We changed our return policy to be more lenient at the start of the quarter" },
    { proposal_id: "a_reps", claim_type: "context_fact", quote: "we also added two more support reps that same month" },
    { proposal_id: "a_outcome", claim_type: "outcome", quote: "Customer complaints about our support process dropped by the end of the quarter" },
    { proposal_id: "a_belief", claim_type: "self_reported_diagnosis", quote: "I think the complaints dropped because agents were less stressed after we also added two more support reps that same month" },
  ],
  class_b_proposals: [
    { proposal_id: "b_because", relationship_type: "explicit_connective", marker_text: "because", components: ["a_belief"] },
  ],
  class_c_proposals: [],
};

/**
 * Adversarial variant: simulates a poorly-behaved (or compromised) Listen
 * Engine that ignores the system prompt's instructions and attempts to
 * self-assign a promotion label directly as claim_type. Exercised end-to-
 * end through the FULL pipeline (not just evidence-validator's own unit
 * tests) specifically because Case 009 is the case where a belief-fact
 * collapse would matter most if it slipped through. Expected: rejected
 * with BELIEF_FACT_COLLAPSE_ATTEMPT; never reaches the Evidence Graph.
 */
export const LISTEN_ENGINE_FIXTURE_ADVERSARIAL: ListenEngineRawOutput = {
  class_a_proposals: [
    { proposal_id: "a_policy", claim_type: "context_fact", quote: "We changed our return policy to be more lenient at the start of the quarter" },
    { proposal_id: "a_reps", claim_type: "context_fact", quote: "we also added two more support reps that same month" },
    { proposal_id: "a_outcome", claim_type: "outcome", quote: "Customer complaints about our support process dropped by the end of the quarter" },
    { proposal_id: "a_belief_promoted", claim_type: "established_cause", quote: "I think the complaints dropped because agents were less stressed after we also added two more support reps that same month" },
  ],
  class_b_proposals: [],
  class_c_proposals: [],
};
