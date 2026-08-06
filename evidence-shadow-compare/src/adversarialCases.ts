/**
 * Milestone 3, Step 4 — adversarial cases constructed SPECIFICALLY to try
 * to break the O5 suppression rule (opportunitySuppression.ts), not just
 * to illustrate it working. This assistant's own independent reading of
 * each transcript (same authorship convention as every other fixture in
 * this project — not Atlas ground truth; there is no Atlas case for these).
 */
import { ListenEngineRawOutput } from "../../evidence-runtime/src/modelOutput";

/**
 * VERBOSE_LOW_EVIDENCE — long, uses professional-sounding vocabulary
 * (workflow, stakeholders, dynamic, considerations), but genuinely
 * contains almost no extractable, concrete content. Tests: does length
 * or vocabulary alone fool the rule? It shouldn't — the rule only counts
 * ADMISSIBLE claim_type membership, and a careful reading of this
 * transcript admits no real action/constraint/decision claims at all.
 */
export const VERBOSE_LOW_EVIDENCE_TRANSCRIPT =
  "So this is kind of a complicated story and there were a lot of moving parts honestly, " +
  "like there was a whole thing with the workflow and we had to think about a bunch of " +
  "different angles and considerations, and honestly it was just a really dynamic situation, " +
  "you know, lots of stakeholders involved, and eventually after a lot of back and forth we " +
  "sort of landed in a good spot and it worked out I think, overall a positive outcome for " +
  "everyone involved.";

export const VERBOSE_LOW_EVIDENCE_FIXTURE: ListenEngineRawOutput = {
  class_a_proposals: [
    { proposal_id: "a_problem", claim_type: "problem", quote: "there were a lot of moving parts" },
    { proposal_id: "a_outcome", claim_type: "outcome", quote: "we sort of landed in a good spot and it worked out" },
  ],
  class_b_proposals: [],
  class_c_proposals: [],
};

/**
 * ISOLATED_SINGLE_MENTION — the key counterexample: ONE real, admissible
 * action claim (a named tool), but hedged, unconnected to anything else,
 * in an otherwise thin answer. Tests the EDGE gate specifically: 1
 * specificity claim, 0 relationship edges. Must NOT be suppressed.
 */
export const ISOLATED_SINGLE_MENTION_TRANSCRIPT =
  "Honestly I don't remember all the details. I think I used a torque wrench at some point " +
  "but I'm not totally sure it mattered. Anyway it got fixed eventually.";

export const ISOLATED_SINGLE_MENTION_FIXTURE: ListenEngineRawOutput = {
  class_a_proposals: [
    { proposal_id: "a_problem", claim_type: "problem", quote: "I don't remember all the details" },
    { proposal_id: "a_action", claim_type: "action", quote: "I used a torque wrench at some point" },
    { proposal_id: "a_outcome", claim_type: "outcome", quote: "it got fixed eventually" },
  ],
  class_b_proposals: [], // deliberately no relationship — nothing connects these three claims
  class_c_proposals: [],
};

/**
 * ISOLATED_MULTIPLE_MENTIONS — stress test on the count dimension: TWO
 * specificity claims (an action AND a constraint), still ZERO connecting
 * edges. Proves the edge gate is load-bearing on its own, not just at
 * count=1 — a higher count alone must not be enough either.
 */
export const ISOLATED_MULTIPLE_MENTIONS_TRANSCRIPT =
  "I don't really recall specifics. I think I maybe adjusted a setting once, and there was " +
  "some kind of constraint about timing I vaguely remember. It kind of resolved itself.";

export const ISOLATED_MULTIPLE_MENTIONS_FIXTURE: ListenEngineRawOutput = {
  class_a_proposals: [
    { proposal_id: "a_action", claim_type: "action", quote: "I maybe adjusted a setting once" },
    { proposal_id: "a_constraint", claim_type: "constraint", quote: "there was some kind of constraint about timing" },
    { proposal_id: "a_outcome", claim_type: "outcome", quote: "It kind of resolved itself" },
  ],
  class_b_proposals: [], // deliberately no relationship — two specificity claims, still disconnected
  class_c_proposals: [],
};
