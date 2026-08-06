/**
 * Fixture-mode Listen Engine proposals for Atlas Case 003 — "Strong Concise
 * Answer". evidence-runtime's own fixture set (Phase 3A) only covers the 9
 * cases that build explicitly required (001,002,004-010); Case 003 was
 * never added there. Rather than touching evidence-runtime to add a 10th
 * fixture (out of bounds for this task — "no changes to Runtime's actual
 * behavior", and a new fixture file, while not logic, is still Runtime
 * territory), Case 003's fixture lives here, local to the benchmark that
 * actually needs it for "all 10 Atlas cases" in fixture mode.
 *
 * Same authorship convention as evidence-runtime/fixtures/*.ts: this is the
 * assistant's own independent reading of the transcript, not copied from
 * the Atlas's classification table (which doesn't give verbatim quotes for
 * this case anyway — only prose paraphrases; see groundTruth.ts's Case 003
 * comment for the same extraction).
 */
import { ListenEngineRawOutput } from "../../evidence-runtime/src/modelOutput";

export const TRANSCRIPT =
  "Our CNC line was scrapping about one in five parts on a new fixture. I checked the location pins and found one had worn oversized, so parts weren't seating flush. I swapped in a hardened pin and added a witness mark so operators could catch wear before it caused scrap again. Scrap rate on that fixture dropped back to normal within a day.";

export const LISTEN_ENGINE_FIXTURE: ListenEngineRawOutput = {
  class_a_proposals: [
    { proposal_id: "a_problem", claim_type: "problem", quote: "Our CNC line was scrapping about one in five parts on a new fixture" },
    { proposal_id: "a_checked", claim_type: "action", quote: "I checked the location pins" },
    { proposal_id: "a_diagnosis", claim_type: "self_reported_diagnosis", quote: "found one had worn oversized, so parts weren't seating flush" },
    { proposal_id: "a_swapped", claim_type: "action", quote: "I swapped in a hardened pin" },
    { proposal_id: "a_witness_mark", claim_type: "action", quote: "added a witness mark so operators could catch wear before it caused scrap again" },
    { proposal_id: "a_outcome", claim_type: "outcome", quote: "Scrap rate on that fixture dropped back to normal within a day" },
  ],
  class_b_proposals: [
    { proposal_id: "b_so_diagnosis", relationship_type: "explicit_connective", marker_text: "so", components: ["a_diagnosis"] },
    { proposal_id: "b_so_witness", relationship_type: "explicit_connective", marker_text: "so", components: ["a_witness_mark"] },
  ],
  class_c_proposals: [],
};
