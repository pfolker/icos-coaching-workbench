import { ListenEngineRawOutput } from "../src/modelOutput";

export const TRANSCRIPT =
  "I decided we needed a better testing process before releasing updates, so I built out a staging environment that mirrored production. " +
  "The team put together the test suite and we all agreed on the rollout schedule together.";

export const LISTEN_ENGINE_FIXTURE: ListenEngineRawOutput = {
  class_a_proposals: [
    { proposal_id: "a_decided", claim_type: "decision", quote: "I decided we needed a better testing process before releasing updates" },
    { proposal_id: "a_built", claim_type: "action", quote: "I built out a staging environment that mirrored production" },
    { proposal_id: "a_team_built", claim_type: "action", quote: "The team put together the test suite" },
    { proposal_id: "a_agreed", claim_type: "decision", quote: "we all agreed on the rollout schedule together" },
  ],
  /**
   * "decided" and "agreed" are both claim_type "decision" but are NOT
   * textually adjacent (two "action" claims sit between them), so
   * enumeration correctly does not apply to them — only "built"/"team_built"
   * qualify. Same rule-application outcome evidence-validator's own Case 006
   * fixture documents; reproduced independently here because it's a genuine
   * property of the transcript and the enumeration rule, not a coincidence
   * of test authoring.
   */
  class_b_proposals: [
    { proposal_id: "b_enum", relationship_type: "enumeration", marker_text: "", components: ["a_built", "a_team_built"] },
  ],
  class_c_proposals: [],
};
