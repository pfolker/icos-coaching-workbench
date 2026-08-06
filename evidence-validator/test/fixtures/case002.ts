import { ClassAProposal, ClassBProposal, ValidatorInput } from "../../src/types";
import { span } from "../helpers";

export const TRANSCRIPT =
  "One problem that stands out happened on one of our automated manufacturing lines. " +
  "We started seeing parts getting pushed away during the deburring process instead of being deburred correctly. " +
  "At first everyone thought it was a program issue, but after checking the part straightness with an indicator before and after the deburring process, I was able to see the part had been moving.\n\n" +
  "This pointed to a gripper issue. The grippers were not doing an adequate job holding the part and I needed to come up with a way of locking it in and prevent it from moving.\n\n" +
  "I modified the part being machined slightly by machining two locating divots into the casting, since we were engraving the part anyway I didn't need customer approval for that. I then redesigned the gripper pads with a conical profile so they locked into those divots every cycle.\n\n" +
  "After the change, the part stayed rigid during deburring, the brushing process became consistent, and we eliminated the issue completely. It also improved overall throughput because operators no longer had to stop and inspect parts that had been pushed out of position.\n\n" +
  "That project reminded me that sometimes the best automation solution isn't changing the robot program-it's changing the mechanical design so the process becomes repeatable.";

const PROBLEM = "parts getting pushed away during the deburring process instead of being deburred correctly";
const PRIOR_BELIEF = "everyone thought it was a program issue";
const A13 = "checking the part straightness with an indicator before and after the deburring process";
const A14 = "I was able to see the part had been moving";
const A15 = "This pointed to a gripper issue";
const A16 = "The grippers were not doing an adequate job holding the part";
const NEED_TO = "I needed to come up with a way of locking it in and prevent it from moving";
const MODIFIED = "I modified the part being machined slightly by machining two locating divots into the casting";
const A17 = "since we were engraving the part anyway I didn't need customer approval for that";
const REDESIGNED = "I then redesigned the gripper pads with a conical profile so they locked into those divots every cycle";
const OUT1 = "the part stayed rigid during deburring";
const OUT2 = "the brushing process became consistent";
const OUT3 = "we eliminated the issue completely";
const BIZ = "It also improved overall throughput because operators no longer had to stop and inspect parts";
const REFLECTION = "the best automation solution isn't changing the robot program-it's changing the mechanical design so the process becomes repeatable";

export const class_a_proposals: ClassAProposal[] = [
  { proposal_id: "R_problem", claim_type: "problem", quote: PROBLEM, source_span: span(TRANSCRIPT, PROBLEM) },
  { proposal_id: "R_belief", claim_type: "prior_belief", quote: PRIOR_BELIEF, source_span: span(TRANSCRIPT, PRIOR_BELIEF) },
  { proposal_id: "A13", claim_type: "action", quote: A13, source_span: span(TRANSCRIPT, A13) },
  { proposal_id: "A14", claim_type: "self_reported_diagnosis", quote: A14, source_span: span(TRANSCRIPT, A14) },
  { proposal_id: "A15", claim_type: "self_reported_diagnosis", quote: A15, source_span: span(TRANSCRIPT, A15) },
  { proposal_id: "A16", claim_type: "problem", quote: A16, source_span: span(TRANSCRIPT, A16) },
  { proposal_id: "R_needto", claim_type: "action", quote: NEED_TO, source_span: span(TRANSCRIPT, NEED_TO) },
  { proposal_id: "R_modified", claim_type: "action", quote: MODIFIED, source_span: span(TRANSCRIPT, MODIFIED) },
  { proposal_id: "A17", claim_type: "constraint", quote: A17, source_span: span(TRANSCRIPT, A17) },
  { proposal_id: "R_redesigned", claim_type: "action", quote: REDESIGNED, source_span: span(TRANSCRIPT, REDESIGNED) },
  { proposal_id: "R_out1", claim_type: "outcome", quote: OUT1, source_span: span(TRANSCRIPT, OUT1) },
  { proposal_id: "R_out2", claim_type: "outcome", quote: OUT2, source_span: span(TRANSCRIPT, OUT2) },
  { proposal_id: "R_out3", claim_type: "outcome", quote: OUT3, source_span: span(TRANSCRIPT, OUT3) },
  { proposal_id: "R_biz", claim_type: "business_value", quote: BIZ, source_span: span(TRANSCRIPT, BIZ) },
  { proposal_id: "R_reflection", claim_type: "reflection", quote: REFLECTION, source_span: span(TRANSCRIPT, REFLECTION) },
];

/**
 * B5, previously omitted (v1.0's explicit_connective list didn't include
 * "pointed to" — see CHANGELOG.md, EP-003), is now represented as a
 * self-contained explicit_connective on A15's own quote ("This pointed to
 * a gripper issue" already contains the marker internally). This captures
 * the marker's mechanical presence; it does not represent the fuller
 * "A13/A14 jointly led to A15" semantic the Atlas's prose describes, which
 * would need a 3-component bridging form this Validator does not implement
 * (see README.md).
 */
export const class_b_proposals: ClassBProposal[] = [
  { proposal_id: "B5", relationship_type: "explicit_connective", marker_text: "pointed to", components: ["A15"] },
  { proposal_id: "B6", relationship_type: "explicit_connective", marker_text: "since", components: ["A17"] },
];

export const input: ValidatorInput = {
  transcript: TRANSCRIPT,
  class_a_proposals,
  class_b_proposals,
  class_c_proposals: [],
};

export const ORIGINAL_CLASS_A_COUNT = 12; // Case 001's validated count, for the "strictly more" comparison
