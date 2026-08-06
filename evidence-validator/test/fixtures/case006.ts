import { ClassAProposal, ClassBProposal, ValidatorInput } from "../../src/types";
import { span } from "../helpers";

export const TRANSCRIPT =
  "I decided we needed a better testing process before releasing updates, so I built out a staging environment that mirrored production. " +
  "The team put together the test suite and we all agreed on the rollout schedule together.";

const DECIDED = "I decided we needed a better testing process before releasing updates";
const BUILT = "I built out a staging environment that mirrored production";
const TEAM_BUILT = "The team put together the test suite";
/**
 * v1.1 / EP-002: "decision" is now a formal claim_type, distinct from
 * "action" — added specifically to represent this case's shared/group
 * agreement apart from individually-owned action. Under v1.0, before this
 * enum existed, this and DECIDED below were both mapped to "action" as the
 * closest available fit.
 */
const AGREED = "we all agreed on the rollout schedule together";

export const class_a_proposals: ClassAProposal[] = [
  { proposal_id: "decided", claim_type: "decision", quote: DECIDED, source_span: span(TRANSCRIPT, DECIDED) },
  { proposal_id: "built", claim_type: "action", quote: BUILT, source_span: span(TRANSCRIPT, BUILT) },
  { proposal_id: "team_built", claim_type: "action", quote: TEAM_BUILT, source_span: span(TRANSCRIPT, TEAM_BUILT) },
  { proposal_id: "agreed", claim_type: "decision", quote: AGREED, source_span: span(TRANSCRIPT, AGREED) },
];

/**
 * v1.1 note: with "decided"/"agreed" now correctly typed "decision"
 * (distinct from "built"/"team_built"'s "action"), the four claims no
 * longer form ONE same-type run — enumeration requires same-claim_type AND
 * no intervening different-type claim. "built" and "team_built" ARE
 * adjacent with nothing of a different type between them, so they still
 * enumerate. "decided" and "agreed" are NOT adjacent (both action claims
 * sit textually between them), so they correctly do NOT qualify as an
 * enumeration under Specification Section 4's literal definition — this is
 * the rule behaving correctly, not a fixture compromise. Case 006's real
 * point (distinct ownership shapes, no collapsing) is carried entirely by
 * Class A now visibly using two different claim_types, which is a MORE
 * precise representation than v1.0's four same-typed "action" entries.
 */
export const class_b_proposals: ClassBProposal[] = [
  {
    proposal_id: "B_enum",
    relationship_type: "enumeration",
    marker_text: "",
    components: ["built", "team_built"],
  },
];

export const input: ValidatorInput = {
  transcript: TRANSCRIPT,
  class_a_proposals,
  class_b_proposals,
  class_c_proposals: [],
};
