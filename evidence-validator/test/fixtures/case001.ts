import { ClassAProposal, ClassBProposal, ClassCProposal, ValidatorInput } from "../../src/types";
import { span } from "../helpers";

export const TRANSCRIPT =
  "One problem that stands out happened on one of our automated manufacturing lines. " +
  "We started seeing parts getting pushed away during the deburring process instead of being cleaned correctly. " +
  "At first everyone thought it was a programming issue, but after watching the machine run I realized the robot was actually applying force in a way that allowed the casting to move.\n\n" +
  "I spent time watching the process, talking with the operators, and looking at how the fixture contacted the part. " +
  "I realized we were grabbing onto a rough casting surface that wasn't locating the part consistently. " +
  "Instead of trying to solve it in software, I modified the fixture by machining two locating divots into the face of the part and redesigned the gripper pads with a conical profile so they locked into those divots every cycle.\n\n" +
  "After the change, the part stayed rigid during deburring, the brushing process became consistent, and we eliminated the issue completely. " +
  "It also improved overall throughput because operators no longer had to stop and inspect parts that had been pushed out of position.\n\n" +
  "That project reminded me that sometimes the best automation solution isn't changing the robot program—it's changing the mechanical design so the process becomes repeatable.";

const A1 = "parts getting pushed away during the deburring process instead of being cleaned correctly";
const A2 = "everyone thought it was a programming issue";
const A3 = "I realized the robot was actually applying force in a way that allowed the casting to move";
const A4 = "I spent time watching the process, talking with the operators, and looking at how the fixture contacted the part";
const A5 = "I realized we were grabbing onto a rough casting surface that wasn't locating the part consistently";
/**
 * v1.1 / EP-003: extended to include the leading "Instead of..." clause so
 * B2 (below) can be represented as a self-contained contrast_marker
 * relationship, matching the same pattern already used for B4/B6
 * elsewhere. The Atlas's own table lists A6 without this prefix; extending
 * it is a deliberate fixture choice enabled by EP-003's marker-list fix,
 * not a re-reading of the Atlas's original wording.
 */
const A6 = "Instead of trying to solve it in software, I modified the fixture by machining two locating divots into the face of the part";
const A7 = "redesigned the gripper pads with a conical profile so they locked into those divots every cycle";
const A8 = "the part stayed rigid during deburring";
const A9 = "the brushing process became consistent";
const A10 = "we eliminated the issue completely";
const A11 = "It also improved overall throughput because operators no longer had to stop and inspect parts";
const A12 = "the best automation solution isn't changing the robot program—it's changing the mechanical design so the process becomes repeatable";

export const class_a_proposals: ClassAProposal[] = [
  { proposal_id: "A1", claim_type: "problem", quote: A1, source_span: span(TRANSCRIPT, A1) },
  { proposal_id: "A2", claim_type: "prior_belief", quote: A2, source_span: span(TRANSCRIPT, A2) },
  { proposal_id: "A3", claim_type: "self_reported_diagnosis", quote: A3, source_span: span(TRANSCRIPT, A3) },
  { proposal_id: "A4", claim_type: "action", quote: A4, source_span: span(TRANSCRIPT, A4) },
  { proposal_id: "A5", claim_type: "self_reported_diagnosis", quote: A5, source_span: span(TRANSCRIPT, A5) },
  { proposal_id: "A6", claim_type: "action", quote: A6, source_span: span(TRANSCRIPT, A6) },
  { proposal_id: "A7", claim_type: "action", quote: A7, source_span: span(TRANSCRIPT, A7) },
  { proposal_id: "A8", claim_type: "outcome", quote: A8, source_span: span(TRANSCRIPT, A8) },
  { proposal_id: "A9", claim_type: "outcome", quote: A9, source_span: span(TRANSCRIPT, A9) },
  { proposal_id: "A10", claim_type: "outcome", quote: A10, source_span: span(TRANSCRIPT, A10) },
  { proposal_id: "A11", claim_type: "business_value", quote: A11, source_span: span(TRANSCRIPT, A11) },
  { proposal_id: "A12", claim_type: "reflection", quote: A12, source_span: span(TRANSCRIPT, A12) },
];

/**
 * B2, previously omitted (v1.0's contrast_marker list didn't include
 * "instead of" — see CHANGELOG.md, EP-003), is now represented as a
 * self-contained contrast_marker relationship on the extended A6 quote
 * above.
 */
export const class_b_proposals: ClassBProposal[] = [
  { proposal_id: "B1", relationship_type: "contrast_marker", marker_text: "but", components: ["A2", "A3"] },
  { proposal_id: "B2", relationship_type: "contrast_marker", marker_text: "instead of", components: ["A6"] },
  { proposal_id: "B3", relationship_type: "enumeration", marker_text: "", components: ["A6", "A7"] },
  { proposal_id: "B4", relationship_type: "explicit_connective", marker_text: "because", components: ["A11"] },
];

export const class_c_proposals: ClassCProposal[] = [
  {
    proposal_id: "C1",
    hypothesis: "the speaker was personally among those who initially believed it was a programming issue, rather than skeptical from the start",
    supporting_claim_ids: ["A2"],
    reasoning: "\"everyone thought\" does not clarify whether the speaker included themselves in that group; determining this requires inference beyond the literal text.",
    clarification_question: "Were you also among those who initially thought it was a programming issue, or were you skeptical of that explanation from the start?",
  },
];

export const input: ValidatorInput = {
  transcript: TRANSCRIPT,
  class_a_proposals,
  class_b_proposals,
  class_c_proposals,
};
