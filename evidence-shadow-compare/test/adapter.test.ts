import { describe, it, expect } from "vitest";
import { validateEvidence } from "../../evidence-validator/src/index";
import { materializeSourceSpans } from "../../evidence-runtime/src/modelOutput";
import { buildEvidenceGraph } from "../../evidence-runtime/src/evidenceGraph";
import * as case001 from "../../evidence-runtime/fixtures/case001";
import * as case009 from "../../evidence-runtime/fixtures/case009";
import * as case010 from "../../evidence-runtime/fixtures/case010";
import * as cncCase from "../../evidence-benchmark/src/case003Fixture";
import * as thinCase from "../src/thinCase";
import { EvidenceGraphOpportunityAdapter, MAPPED_OPPORTUNITY_IDS, UNMAPPED_OPPORTUNITY_IDS } from "../src/adapter";

function graphFor(transcript: string, fixture: any) {
  return buildEvidenceGraph(validateEvidence(materializeSourceSpans(transcript, fixture)));
}

describe("EvidenceGraphOpportunityAdapter — Step 2, scoped to what actually maps", () => {
  it("declares exactly the two O3 ids as mapped", () => {
    expect(MAPPED_OPPORTUNITY_IDS).toEqual(["O3_missing_result", "O3_unquantified_result"]);
  });

  it("declares the other seven ids as unmapped, each with a real reason", () => {
    const ids = UNMAPPED_OPPORTUNITY_IDS.map((u) => u.opportunity_id).sort();
    expect(ids).toEqual([
      "O10_filler_density", "O11_employer_negativity", "O2_structureless_ramble",
      "O4_ownership_hiding", "O5_vagueness", "O7_weak_close", "O8_buried_lede",
    ].sort());
    for (const u of UNMAPPED_OPPORTUNITY_IDS) expect(u.reason.length).toBeGreaterThan(20);
  });

  it("Case 007-style transcript with no outcome claim at all -> O3_missing_result", () => {
    // Constructed directly (not from a fixture file): a transcript with a
    // problem and an action but no outcome claim anywhere admitted.
    const transcript = "We had a vendor issue. I escalated it to the account manager.";
    const graph = graphFor(transcript, {
      class_a_proposals: [
        { proposal_id: "a_problem", claim_type: "problem", quote: "We had a vendor issue" },
        { proposal_id: "a_action", claim_type: "action", quote: "I escalated it to the account manager" },
      ],
      class_b_proposals: [],
      class_c_proposals: [],
    });
    const out = EvidenceGraphOpportunityAdapter(graph);
    expect(out).toHaveLength(1);
    expect(out[0]!.opportunity_id).toBe("O3_missing_result");
    expect(out[0]!.evidence.spans).toEqual([]);
  });

  it("real Case 001 (founder's original answer): outcome claims exist, none quantity-bound -> O3_unquantified_result", () => {
    const graph = graphFor(case001.TRANSCRIPT, case001.LISTEN_ENGINE_FIXTURE);
    const out = EvidenceGraphOpportunityAdapter(graph);
    expect(out).toHaveLength(1);
    expect(out[0]!.opportunity_id).toBe("O3_unquantified_result");
    expect(out[0]!.evidence.spans.map((s) => s.span_text)).toContain("we eliminated the issue completely");
  });

  it("real Case 009: outcome claim exists (complaints dropped), no quantity_binding anywhere -> O3_unquantified_result", () => {
    const graph = graphFor(case009.TRANSCRIPT, case009.LISTEN_ENGINE_FIXTURE);
    const out = EvidenceGraphOpportunityAdapter(graph);
    expect(out).toHaveLength(1);
    expect(out[0]!.opportunity_id).toBe("O3_unquantified_result");
  });

  it("real Case 010: quantity_binding exists in the graph but binds the ACTION, not the outcome -> still O3_unquantified_result (edge fidelity, not just presence)", () => {
    const graph = graphFor(case010.TRANSCRIPT, case010.LISTEN_ENGINE_FIXTURE);
    // confirm the premise directly: quantity_binding really is bound to the action
    const qb = graph.edges.find((e) => e.relationship_type === "quantity_binding")!;
    expect(qb.component_ids).toEqual(["a_action"]);
    const out = EvidenceGraphOpportunityAdapter(graph);
    expect(out).toHaveLength(1);
    expect(out[0]!.opportunity_id).toBe("O3_unquantified_result");
  });

  it("real CNC stress-test case (Atlas Case 003): outcome exists, no quantity_binding on it -> O3_unquantified_result", () => {
    const graph = graphFor(cncCase.TRANSCRIPT, cncCase.LISTEN_ENGINE_FIXTURE);
    const out = EvidenceGraphOpportunityAdapter(graph);
    expect(out).toHaveLength(1);
    expect(out[0]!.opportunity_id).toBe("O3_unquantified_result");
  });

  it("thin fixture answer: two outcome claims, no quantity_binding -> O3_unquantified_result (not missing_result, since outcome claims DO exist)", () => {
    const graph = graphFor(thinCase.TRANSCRIPT, thinCase.LISTEN_ENGINE_FIXTURE);
    const out = EvidenceGraphOpportunityAdapter(graph);
    expect(out).toHaveLength(1);
    expect(out[0]!.opportunity_id).toBe("O3_unquantified_result");
  });

  it("constructed: outcome claim IS quantity-bound -> no O3 candidate fires either way", () => {
    const transcript = "We shipped the fix. Support tickets dropped by 40 percent that month.";
    const graph = graphFor(transcript, {
      class_a_proposals: [
        { proposal_id: "a_action", claim_type: "action", quote: "We shipped the fix" },
        { proposal_id: "a_outcome", claim_type: "outcome", quote: "Support tickets dropped by 40 percent that month" },
      ],
      class_b_proposals: [
        { proposal_id: "b_quantity", relationship_type: "quantity_binding", marker_text: "", components: ["a_outcome"] },
      ],
      class_c_proposals: [],
    });
    const qb = graph.edges.find((e) => e.relationship_type === "quantity_binding")!;
    expect(qb.component_ids).toContain("a_outcome");
    const out = EvidenceGraphOpportunityAdapter(graph);
    expect(out).toHaveLength(0);
  });

  it("assembled candidate satisfies the real CandidateOpportunity contract (confidence in (0,1], readiness/growth_potential pulled from the real REGISTRY)", () => {
    const graph = graphFor(case001.TRANSCRIPT, case001.LISTEN_ENGINE_FIXTURE);
    const [candidate] = EvidenceGraphOpportunityAdapter(graph);
    expect(candidate!.confidence).toBeGreaterThan(0);
    expect(candidate!.confidence).toBeLessThanOrEqual(1);
    expect(candidate!.growth_potential).toBe("high"); // REGISTRY's real O3_unquantified_result entry
    expect(candidate!.readiness.allowed_states).toEqual(["flowing", "struggling", "disengaging"]);
    expect(candidate!.dependencies.upstream_candidates_cofired).toEqual([]);
  });

  it("mission_alignment reflects ctx.mission_habit_id the same way opportunity-engine's own assembly does", () => {
    const graph = graphFor(case001.TRANSCRIPT, case001.LISTEN_ENGINE_FIXTURE);
    const [aligned] = EvidenceGraphOpportunityAdapter(graph, { mission_habit_id: "H5" }); // O3_unquantified_result's real related_habit
    expect(aligned!.mission_alignment).toBe("aligned");
    const [unaligned] = EvidenceGraphOpportunityAdapter(graph, { mission_habit_id: "H1" });
    expect(unaligned!.mission_alignment).toBe("unaligned");
    const [noMission] = EvidenceGraphOpportunityAdapter(graph);
    expect(noMission!.mission_alignment).toBe("no_mission");
  });
});
