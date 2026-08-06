/**
 * Real transcript, given directly by the user in chat (a checkout-service
 * outage story) to re-verify the ladder-exclusivity fix on unseen input.
 * It surfaced a SECOND real incident: O4_ownership_hiding co-fires and
 * promotes O3_missing_result to Decision Engine priority "root_cause",
 * which gets SELECTED despite the Evidence Graph showing two real,
 * admissible outcome claims — the exact scenario that exposed
 * resolveLadderConflictsForRendering()'s first version silently hiding the
 * flag explaining the actual coaching focus. Registered as a known case so
 * this scenario stays covered by regression, not just a one-off script.
 *
 * Fixture-mode Listen Engine proposals below are this assistant's own
 * independent reading of the transcript (same authorship convention as
 * every other fixture in this project), reconstructed to match the shape
 * of the real live Listen Engine response captured when this case first
 * ran (8 Class A claims, contrast_marker + 2x temporal_sequence +
 * enumeration, one non-admissible causal hypothesis) — not a byte-for-byte
 * copy of that live JSON, which was never persisted verbatim.
 */
import { ListenEngineRawOutput } from "../../evidence-runtime/src/modelOutput";

export const TRANSCRIPT =
  "We had a recurring outage on our checkout service during peak traffic. " +
  "At first everyone assumed it was a database connection pool issue, but after adding distributed tracing I found requests were piling up waiting on a third-party fraud-check API that would occasionally hang. " +
  "I added a hard timeout around that call and a circuit breaker so we'd fail open instead of queuing forever. " +
  "After that change, checkout stayed responsive during the next few peak periods and we stopped getting paged for it.";

export const LISTEN_ENGINE_FIXTURE: ListenEngineRawOutput = {
  class_a_proposals: [
    { proposal_id: "a1_problem", claim_type: "problem", quote: "We had a recurring outage on our checkout service during peak traffic" },
    { proposal_id: "a2_prior_belief", claim_type: "prior_belief", quote: "everyone assumed it was a database connection pool issue" },
    { proposal_id: "a3_action_tracing", claim_type: "action", quote: "after adding distributed tracing" },
    { proposal_id: "a4_diagnosis", claim_type: "self_reported_diagnosis", quote: "I found requests were piling up waiting on a third-party fraud-check API that would occasionally hang" },
    { proposal_id: "a5_action_fix", claim_type: "action", quote: "I added a hard timeout around that call and a circuit breaker" },
    { proposal_id: "a6_decision", claim_type: "decision", quote: "so we'd fail open instead of queuing forever" },
    { proposal_id: "a7_outcome_responsive", claim_type: "outcome", quote: "checkout stayed responsive during the next few peak periods" },
    { proposal_id: "a8_outcome_paging", claim_type: "outcome", quote: "we stopped getting paged for it" },
  ],
  class_b_proposals: [
    { proposal_id: "b1_contrast", relationship_type: "contrast_marker", marker_text: "but", components: ["a2_prior_belief", "a4_diagnosis"] },
    { proposal_id: "b2_temporal_tracing", relationship_type: "temporal_sequence", marker_text: "after", components: ["a3_action_tracing", "a4_diagnosis"] },
    { proposal_id: "b4_temporal_change", relationship_type: "temporal_sequence", marker_text: "", components: ["a6_decision", "a7_outcome_responsive"] },
    { proposal_id: "b5_enumeration_outcomes", relationship_type: "enumeration", marker_text: "", components: ["a7_outcome_responsive", "a8_outcome_paging"] },
  ],
  class_c_proposals: [
    {
      proposal_id: "c_fraud_api_root_cause",
      hypothesis: "The occasional hangs in the third-party fraud-check API were the direct root cause of the recurring checkout outage described at the start of the transcript.",
      supporting_claim_ids: ["a4_diagnosis", "a1_problem"],
      reasoning: "the temporal/causal narrative (tracing found the hanging API, then a timeout and circuit breaker were added, then outages stopped) suggests but does not confirm this was the sole cause; the transcript is silent on whether other concurrent changes existed.",
      clarification_question: "Was the fraud-check API hang the only contributor to the outage, or were there other changes around the same time?",
    },
  ],
};
