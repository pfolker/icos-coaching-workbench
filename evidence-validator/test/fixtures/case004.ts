import { ClassAProposal, ClassBProposal, ValidatorInput } from "../../src/types";
import { span } from "../helpers";

export const TRANSCRIPT =
  "So, this is kind of a long story, but, um, basically we had this recurring issue on, I think it was the third shift mostly, " +
  "where, like, the packaging line kept jamming, and it wasn't every day, but it was often enough that people started, " +
  "you know, just kind of working around it instead of actually looking into it, which I guess I understand because everyone's busy, " +
  "but eventually I got kind of annoyed by it honestly, so I pulled the maintenance logs for like the last month, " +
  "and it turned out almost all the jams were happening on the same conveyor section, which nobody had really noticed before " +
  "because the operators log different things, so I flagged it to maintenance and we found out a roller bearing was starting to " +
  "seize intermittently, and once we replaced that the jams basically stopped.";

const PROBLEM = "the packaging line kept jamming";
const PULLED_LOGS = "I pulled the maintenance logs for like the last month";
const FINDING1 = "it turned out almost all the jams were happening on the same conveyor section";
const NOBODY_NOTICED = "nobody had really noticed before because the operators log different things";
const FLAGGED = "I flagged it to maintenance";
const FINDING2 = "we found out a roller bearing was starting to seize intermittently";
const REPLACED = "we replaced that";
const OUTCOME = "the jams basically stopped";

export const class_a_proposals: ClassAProposal[] = [
  { proposal_id: "problem", claim_type: "problem", quote: PROBLEM, source_span: span(TRANSCRIPT, PROBLEM) },
  { proposal_id: "pulled_logs", claim_type: "action", quote: PULLED_LOGS, source_span: span(TRANSCRIPT, PULLED_LOGS) },
  // Atlas prose calls this a "finding" — retired rather than added as its
  // own claim_type (Specification v1.1, EP-002): it named the same concept
  // as self_reported_diagnosis under a different word.
  { proposal_id: "finding1", claim_type: "self_reported_diagnosis", quote: FINDING1, source_span: span(TRANSCRIPT, FINDING1) },
  { proposal_id: "context_nobody_noticed", claim_type: "context_fact", quote: NOBODY_NOTICED, source_span: span(TRANSCRIPT, NOBODY_NOTICED) },
  { proposal_id: "flagged", claim_type: "action", quote: FLAGGED, source_span: span(TRANSCRIPT, FLAGGED) },
  { proposal_id: "finding2", claim_type: "self_reported_diagnosis", quote: FINDING2, source_span: span(TRANSCRIPT, FINDING2) },
  { proposal_id: "replaced", claim_type: "action", quote: REPLACED, source_span: span(TRANSCRIPT, REPLACED) },
  { proposal_id: "outcome", claim_type: "outcome", quote: OUTCOME, source_span: span(TRANSCRIPT, OUTCOME) },
];

/**
 * Atlas's own "Boundary case flagged": is "which nobody had really noticed
 * before" itself Class A or does representing *why* it matters edge toward
 * interpretation? Resolved as Class A (direct quote of what the speaker
 * asserted), with the reason kept as Class B (explicitly marked by
 * "because", not inferred) — exactly reproduced here.
 */
export const class_b_proposals: ClassBProposal[] = [
  { proposal_id: "B_because", relationship_type: "explicit_connective", marker_text: "because", components: ["context_nobody_noticed"] },
];

export const input: ValidatorInput = {
  transcript: TRANSCRIPT,
  class_a_proposals,
  class_b_proposals,
  class_c_proposals: [],
};
