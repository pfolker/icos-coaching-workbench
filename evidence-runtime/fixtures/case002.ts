import { ListenEngineRawOutput } from "../src/modelOutput";

export const TRANSCRIPT =
  "One problem that stands out happened on one of our automated manufacturing lines. " +
  "We started seeing parts getting pushed away during the deburring process instead of being deburred correctly. " +
  "At first everyone thought it was a program issue, but after checking the part straightness with an indicator before and after the deburring process, I was able to see the part had been moving.\n\n" +
  "This pointed to a gripper issue. The grippers were not doing an adequate job holding the part and I needed to come up with a way of locking it in and prevent it from moving.\n\n" +
  "I modified the part being machined slightly by machining two locating divots into the casting, since we were engraving the part anyway I didn't need customer approval for that. I then redesigned the gripper pads with a conical profile so they locked into those divots every cycle.\n\n" +
  "After the change, the part stayed rigid during deburring, the brushing process became consistent, and we eliminated the issue completely. It also improved overall throughput because operators no longer had to stop and inspect parts that had been pushed out of position.\n\n" +
  "That project reminded me that sometimes the best automation solution isn't changing the robot program-it's changing the mechanical design so the process becomes repeatable.";

export const LISTEN_ENGINE_FIXTURE: ListenEngineRawOutput = {
  class_a_proposals: [
    { proposal_id: "a_problem", claim_type: "problem", quote: "parts getting pushed away during the deburring process instead of being deburred correctly" },
    { proposal_id: "a_prior_belief", claim_type: "prior_belief", quote: "everyone thought it was a program issue" },
    { proposal_id: "a_checked", claim_type: "action", quote: "checking the part straightness with an indicator before and after the deburring process" },
    { proposal_id: "a_saw_moving", claim_type: "self_reported_diagnosis", quote: "I was able to see the part had been moving" },
    { proposal_id: "a_pointed_to", claim_type: "self_reported_diagnosis", quote: "This pointed to a gripper issue" },
    { proposal_id: "a_gripper_problem", claim_type: "problem", quote: "The grippers were not doing an adequate job holding the part" },
    { proposal_id: "a_need", claim_type: "action", quote: "I needed to come up with a way of locking it in and prevent it from moving" },
    { proposal_id: "a_modified", claim_type: "action", quote: "I modified the part being machined slightly by machining two locating divots into the casting" },
    { proposal_id: "a_constraint", claim_type: "constraint", quote: "since we were engraving the part anyway I didn't need customer approval for that" },
    { proposal_id: "a_redesigned", claim_type: "action", quote: "I then redesigned the gripper pads with a conical profile so they locked into those divots every cycle" },
    { proposal_id: "a_out_rigid", claim_type: "outcome", quote: "the part stayed rigid during deburring" },
    { proposal_id: "a_out_consistent", claim_type: "outcome", quote: "the brushing process became consistent" },
    { proposal_id: "a_out_eliminated", claim_type: "outcome", quote: "we eliminated the issue completely" },
    { proposal_id: "a_business_value", claim_type: "business_value", quote: "It also improved overall throughput because operators no longer had to stop and inspect parts" },
    { proposal_id: "a_reflection", claim_type: "reflection", quote: "the best automation solution isn't changing the robot program-it's changing the mechanical design so the process becomes repeatable" },
  ],
  class_b_proposals: [
    { proposal_id: "b_pointed_to", relationship_type: "explicit_connective", marker_text: "pointed to", components: ["a_pointed_to"] },
    { proposal_id: "b_since", relationship_type: "explicit_connective", marker_text: "since", components: ["a_constraint"] },
  ],
  class_c_proposals: [],
};
