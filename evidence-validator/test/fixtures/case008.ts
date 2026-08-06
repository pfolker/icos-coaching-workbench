import { ClassAProposal, ClassBProposal, ClassCProposal, ValidatorInput } from "../../src/types";
import { span } from "../helpers";

export const TRANSCRIPT =
  "We had a batch of parts fail a pressure test. Right before that batch ran, we'd both switched to a new sealant supplier " +
  "and the technician running that shift was new and still training. The failures stopped once we went back to the old sealant.";

const PROBLEM = "a batch of parts fail a pressure test";
const SWITCHED_SEALANT = "we'd both switched to a new sealant supplier";
const NEW_TECHNICIAN = "the technician running that shift was new and still training";
const FAILURES_STOPPED = "The failures stopped";
const REVERTED = "we went back to the old sealant";

export const class_a_proposals: ClassAProposal[] = [
  { proposal_id: "problem", claim_type: "problem", quote: PROBLEM, source_span: span(TRANSCRIPT, PROBLEM) },
  { proposal_id: "switched_sealant", claim_type: "context_fact", quote: SWITCHED_SEALANT, source_span: span(TRANSCRIPT, SWITCHED_SEALANT) },
  { proposal_id: "new_technician", claim_type: "context_fact", quote: NEW_TECHNICIAN, source_span: span(TRANSCRIPT, NEW_TECHNICIAN) },
  { proposal_id: "failures_stopped", claim_type: "context_fact", quote: FAILURES_STOPPED, source_span: span(TRANSCRIPT, FAILURES_STOPPED) },
  { proposal_id: "reverted", claim_type: "context_fact", quote: REVERTED, source_span: span(TRANSCRIPT, REVERTED) },
];

/**
 * v1.1 / EP-004: this used to be the case that exposed the raw-position-
 * only rule's divergence from the Atlas's own semantic narration
 * ("sealant reversion -> failures stopping") — see CHANGELOG.md. Raw
 * position alone still has "The failures stopped" at an earlier offset
 * than "we went back to the old sealant," so the components below are
 * proposed in the ATLAS'S semantic order [reverted, failures_stopped],
 * which now VALIDATES via the "once" connector rule ("once X, Y" -> X
 * precedes Y; here X = reverted, immediately introduced by "once", Y =
 * failures_stopped) rather than raw position. This is the resolution EP-004
 * was written for.
 */
export const class_b_proposals: ClassBProposal[] = [
  {
    proposal_id: "B_temporal",
    relationship_type: "temporal_sequence",
    marker_text: "",
    components: ["reverted", "failures_stopped"],
  },
];

export const class_c_proposals: ClassCProposal[] = [
  {
    proposal_id: "C_sealant",
    hypothesis: "the sealant change caused the failures",
    supporting_claim_ids: ["switched_sealant", "reverted", "failures_stopped"],
    reasoning: "supported by the stated temporal correlation (failures stopped once the sealant was reverted), but this requires inferring causation from correlation; the speaker never states this directly.",
    clarification_question: "It sounds like reverting the sealant fixed the failures — do you think the sealant itself was the issue, or could the new technician's process have played a role too?",
  },
  {
    proposal_id: "C_technician",
    hypothesis: "the new technician's inexperience contributed to the failures",
    supporting_claim_ids: ["new_technician"],
    reasoning: "the new technician was training during the same shift the failures occurred, but this is equally plausible and equally unconfirmed relative to the sealant hypothesis.",
    clarification_question: "Do you think the new technician's inexperience could have contributed to the failures?",
  },
];

export const input: ValidatorInput = {
  transcript: TRANSCRIPT,
  class_a_proposals,
  class_b_proposals,
  class_c_proposals,
};
