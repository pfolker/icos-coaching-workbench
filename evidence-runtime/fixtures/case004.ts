import { ListenEngineRawOutput } from "../src/modelOutput";

export const TRANSCRIPT =
  "So, this is kind of a long story, but, um, basically we had this recurring issue on, I think it was the third shift mostly, " +
  "where, like, the packaging line kept jamming, and it wasn't every day, but it was often enough that people started, " +
  "you know, just kind of working around it instead of actually looking into it, which I guess I understand because everyone's busy, " +
  "but eventually I got kind of annoyed by it honestly, so I pulled the maintenance logs for like the last month, " +
  "and it turned out almost all the jams were happening on the same conveyor section, which nobody had really noticed before " +
  "because the operators log different things, so I flagged it to maintenance and we found out a roller bearing was starting to " +
  "seize intermittently, and once we replaced that the jams basically stopped.";

export const LISTEN_ENGINE_FIXTURE: ListenEngineRawOutput = {
  class_a_proposals: [
    { proposal_id: "a_problem", claim_type: "problem", quote: "the packaging line kept jamming" },
    { proposal_id: "a_pulled_logs", claim_type: "action", quote: "I pulled the maintenance logs for like the last month" },
    { proposal_id: "a_finding1", claim_type: "self_reported_diagnosis", quote: "it turned out almost all the jams were happening on the same conveyor section" },
    { proposal_id: "a_context_nobody", claim_type: "context_fact", quote: "nobody had really noticed before because the operators log different things" },
    { proposal_id: "a_flagged", claim_type: "action", quote: "I flagged it to maintenance" },
    { proposal_id: "a_finding2", claim_type: "self_reported_diagnosis", quote: "we found out a roller bearing was starting to seize intermittently" },
    { proposal_id: "a_replaced", claim_type: "action", quote: "we replaced that" },
    { proposal_id: "a_outcome", claim_type: "outcome", quote: "the jams basically stopped" },
  ],
  class_b_proposals: [
    { proposal_id: "b_because", relationship_type: "explicit_connective", marker_text: "because", components: ["a_context_nobody"] },
    { proposal_id: "b_temporal", relationship_type: "temporal_sequence", marker_text: "", components: ["a_replaced", "a_outcome"] },
  ],
  class_c_proposals: [],
};
