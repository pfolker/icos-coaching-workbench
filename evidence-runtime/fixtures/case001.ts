import { ListenEngineRawOutput } from "../src/modelOutput";

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

/**
 * Finding worth preserving, not smoothing over (see root README.md,
 * Deliverable 8): this fixture proposes the fixture-modification action
 * with its NATURAL, shorter boundary ("I modified the fixture by machining
 * two locating divots...") rather than extending it to include the leading
 * "Instead of trying to solve it in software" clause the way
 * evidence-validator's own hand-tuned test fixture does. A model
 * instructed only to quote naturally has no strong reason to reach backward
 * across a comma to capture a rejected-alternative clause as part of the
 * SAME quote. Consequence: this fixture never proposes a contrast_marker
 * relationship for "Instead of" at all — there is no single Class A
 * component whose own quote contains the marker, and the two sides of the
 * contrast ("solve it in software" vs. the fixture change) aren't cleanly
 * two separate Class A claims either (the software side is a rejected
 * hypothetical, never itself asserted as having happened). EP-003 widened
 * the marker list, but whether it ever actually gets EXERCISED depends on
 * where the Listen Engine happens to draw its quote boundary — the
 * Specification does not guide quote-boundary decisions at all.
 */
export const LISTEN_ENGINE_FIXTURE: ListenEngineRawOutput = {
  class_a_proposals: [
    { proposal_id: "a_problem", claim_type: "problem", quote: "parts getting pushed away during the deburring process instead of being cleaned correctly" },
    { proposal_id: "a_prior_belief", claim_type: "prior_belief", quote: "everyone thought it was a programming issue" },
    { proposal_id: "a_diagnosis1", claim_type: "self_reported_diagnosis", quote: "I realized the robot was actually applying force in a way that allowed the casting to move" },
    { proposal_id: "a_investigated", claim_type: "action", quote: "I spent time watching the process, talking with the operators, and looking at how the fixture contacted the part" },
    { proposal_id: "a_diagnosis2", claim_type: "self_reported_diagnosis", quote: "I realized we were grabbing onto a rough casting surface that wasn't locating the part consistently" },
    { proposal_id: "a_fixture_mod", claim_type: "action", quote: "I modified the fixture by machining two locating divots into the face of the part" },
    { proposal_id: "a_gripper_redesign", claim_type: "action", quote: "redesigned the gripper pads with a conical profile so they locked into those divots every cycle" },
    { proposal_id: "a_out_rigid", claim_type: "outcome", quote: "the part stayed rigid during deburring" },
    { proposal_id: "a_out_consistent", claim_type: "outcome", quote: "the brushing process became consistent" },
    { proposal_id: "a_out_eliminated", claim_type: "outcome", quote: "we eliminated the issue completely" },
    { proposal_id: "a_business_value", claim_type: "business_value", quote: "It also improved overall throughput because operators no longer had to stop and inspect parts" },
    { proposal_id: "a_reflection", claim_type: "reflection", quote: "the best automation solution isn't changing the robot program—it's changing the mechanical design so the process becomes repeatable" },
  ],
  class_b_proposals: [
    { proposal_id: "b_contrast_belief", relationship_type: "contrast_marker", marker_text: "but", components: ["a_prior_belief", "a_diagnosis1"] },
    { proposal_id: "b_enum_actions", relationship_type: "enumeration", marker_text: "", components: ["a_fixture_mod", "a_gripper_redesign"] },
    { proposal_id: "b_because_value", relationship_type: "explicit_connective", marker_text: "because", components: ["a_business_value"] },
  ],
  class_c_proposals: [
    {
      proposal_id: "c_self_included",
      hypothesis: "the speaker was personally among those who initially believed it was a programming issue, rather than skeptical from the start",
      supporting_claim_ids: ["a_prior_belief"],
      reasoning: "\"everyone thought\" does not say whether the speaker is included in that group; deciding this requires inference beyond the literal text.",
      clarification_question: "Were you also among those who initially thought it was a programming issue, or were you skeptical of that explanation from the start?",
    },
  ],
};
