/**
 * "Genuinely thin" fixture answer — real text, already used earlier tonight
 * (scratchpad checkThinObs.mjs) specifically to probe the thin/vague end of
 * the spectrum: no named tool, no number, no specific action, no named
 * mechanism. Deliberately the opposite of Case 001/002/003/founder's rich,
 * technical specificity.
 *
 * Fixture-mode Listen Engine proposals below are this assistant's own
 * independent reading of the transcript (same authorship convention as
 * evidence-runtime/fixtures/*.ts and evidence-benchmark's case003Fixture.ts
 * — not Atlas ground truth, there is no Atlas case for this text).
 */
import { ListenEngineRawOutput } from "../../evidence-runtime/src/modelOutput";

export const TRANSCRIPT =
  "We had an issue with parts on the line and eventually got it sorted out. Things went back to normal after that.";

export const LISTEN_ENGINE_FIXTURE: ListenEngineRawOutput = {
  class_a_proposals: [
    { proposal_id: "a_problem", claim_type: "problem", quote: "We had an issue with parts on the line" },
    { proposal_id: "a_outcome", claim_type: "outcome", quote: "eventually got it sorted out" },
    { proposal_id: "a_outcome2", claim_type: "outcome", quote: "Things went back to normal after that" },
  ],
  class_b_proposals: [],
  class_c_proposals: [],
};
