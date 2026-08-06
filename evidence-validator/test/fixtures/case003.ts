import { ClassAProposal, ClassBProposal, ValidatorInput } from "../../src/types";
import { span } from "../helpers";

export const TRANSCRIPT =
  "Our CNC line was scrapping about one in five parts on a new fixture. " +
  "I checked the location pins and found one had worn oversized, so parts weren't seating flush. " +
  "I swapped in a hardened pin and added a witness mark so operators could catch wear before it caused scrap again. " +
  "Scrap rate on that fixture dropped back to normal within a day.";

const PROBLEM = "scrapping about one in five parts on a new fixture";
const CHECKED = "I checked the location pins";
const DIAGNOSIS = "found one had worn oversized, so parts weren't seating flush";
const SWAPPED = "I swapped in a hardened pin";
const WITNESS_MARK = "added a witness mark so operators could catch wear before it caused scrap again";
const OUTCOME = "Scrap rate on that fixture dropped back to normal within a day";

export const class_a_proposals: ClassAProposal[] = [
  { proposal_id: "problem", claim_type: "problem", quote: PROBLEM, source_span: span(TRANSCRIPT, PROBLEM) },
  { proposal_id: "checked", claim_type: "action", quote: CHECKED, source_span: span(TRANSCRIPT, CHECKED) },
  { proposal_id: "diagnosis", claim_type: "self_reported_diagnosis", quote: DIAGNOSIS, source_span: span(TRANSCRIPT, DIAGNOSIS) },
  { proposal_id: "swapped", claim_type: "action", quote: SWAPPED, source_span: span(TRANSCRIPT, SWAPPED) },
  { proposal_id: "witness_mark", claim_type: "action", quote: WITNESS_MARK, source_span: span(TRANSCRIPT, WITNESS_MARK) },
  { proposal_id: "outcome", claim_type: "outcome", quote: OUTCOME, source_span: span(TRANSCRIPT, OUTCOME) },
];

export const class_b_proposals: ClassBProposal[] = [
  { proposal_id: "B_diag_so", relationship_type: "explicit_connective", marker_text: "so", components: ["diagnosis"] },
  { proposal_id: "B_witness_so", relationship_type: "explicit_connective", marker_text: "so", components: ["witness_mark"] },
];

export const input: ValidatorInput = {
  transcript: TRANSCRIPT,
  class_a_proposals,
  class_b_proposals,
  class_c_proposals: [],
};
