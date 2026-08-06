import { ListenEngineRawOutput } from "../src/modelOutput";

export const TRANSCRIPT =
  "We noticed the reports were going out late every week, so we looked into the process and found the data pull was happening " +
  "manually and someone had to remember to kick it off every Friday. We automated it with a scheduled script and now it runs on its own.";

/**
 * Deliberate omission, not an oversight (see root README.md, Deliverable 8
 * / Lessons Learned): the transcript uses "we" throughout with zero
 * first-person-singular language. There is no verbatim text asserting
 * personal ownership of the automation work — not even enough to ground a
 * Class C hypothesis, which still requires a real supporting quote. The
 * system prompt's under-claiming instruction means the correct behavior
 * here is to propose NOTHING about individual ownership at all, neither
 * Class A nor Class C. This mirrors the exact blind spot Atlas Case 005
 * itself calls out in the deterministic `O4_ownership_hiding` detector, and
 * demonstrates the Evidence layer handling it correctly by omission,
 * exactly as the Atlas describes.
 */
export const LISTEN_ENGINE_FIXTURE: ListenEngineRawOutput = {
  class_a_proposals: [
    { proposal_id: "a_problem", claim_type: "problem", quote: "the reports were going out late every week" },
    { proposal_id: "a_looked_into", claim_type: "action", quote: "we looked into the process" },
    { proposal_id: "a_finding", claim_type: "self_reported_diagnosis", quote: "the data pull was happening manually and someone had to remember to kick it off every Friday" },
    { proposal_id: "a_automated", claim_type: "action", quote: "We automated it with a scheduled script" },
    { proposal_id: "a_outcome", claim_type: "outcome", quote: "now it runs on its own" },
  ],
  class_b_proposals: [
    { proposal_id: "b_so", relationship_type: "explicit_connective", marker_text: "so", components: ["a_problem", "a_looked_into"] },
  ],
  class_c_proposals: [],
};
