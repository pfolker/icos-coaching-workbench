import { describe, it, expect } from "vitest";
import { validateEvidence } from "../../evidence-validator/src/index";
import { materializeSourceSpans } from "../../evidence-runtime/src/modelOutput";
import { buildEvidenceGraph } from "../../evidence-runtime/src/evidenceGraph";
import { suppressUnsupportedCandidates, CANDIDATE_SUPPRESSION_RULES } from "../src/opportunitySuppression";
import * as founderCase from "../../coaching-runtime/src/founderCase";
import * as thinCase from "../src/thinCase";
import { CandidateOpportunity } from "../../opportunity-engine/src/types";

function graphFor(transcript: string, fixture: any) {
  return buildEvidenceGraph(validateEvidence(materializeSourceSpans(transcript, fixture)));
}

const fakeCandidate = (opportunity_id: string): CandidateOpportunity => ({
  opportunity_id: opportunity_id as CandidateOpportunity["opportunity_id"],
  related_habits: [],
  evidence: { spans: [], observation_types_cited: [], metrics_cited: [], absent_signals: [] },
  confidence: 0.5,
  growth_potential: "high", mission_alignment: "no_mission",
  dependencies: { habit_prerequisites: [], upstream_candidates_cofired: [] },
  readiness: { allowed_states: ["flowing"] },
});

describe("O5 specificity suppression rule — Milestone 3", () => {
  it("declares exactly one rule today: O5_vagueness, dual-gated on claim_type AND relationship_type", () => {
    expect(CANDIDATE_SUPPRESSION_RULES).toHaveLength(1);
    expect(CANDIDATE_SUPPRESSION_RULES[0]!.suppresses).toBe("O5_vagueness");
  });

  it("THE FLAGSHIP CASE: suppresses O5_vagueness on the real founder_retry Evidence Graph (5 specificity claims, 2 edges)", () => {
    const graph = graphFor(founderCase.TRANSCRIPT, founderCase.LISTEN_ENGINE_FIXTURE);
    const candidates = [fakeCandidate("O3_unquantified_result"), fakeCandidate("O5_vagueness")];
    const result = suppressUnsupportedCandidates(candidates, graph);
    expect(result.candidates.map((c) => c.opportunity_id)).toEqual(["O3_unquantified_result"]);
    expect(result.suppressed).toHaveLength(1);
    expect(result.suppressed[0]!.opportunity_id).toBe("O5_vagueness");
  });

  it("does NOT suppress on the genuinely thin case (0 specificity claims, 0 edges)", () => {
    const graph = graphFor(thinCase.TRANSCRIPT, thinCase.LISTEN_ENGINE_FIXTURE);
    const candidates = [fakeCandidate("O3_unquantified_result"), fakeCandidate("O5_vagueness")];
    const result = suppressUnsupportedCandidates(candidates, graph);
    expect(result.candidates.map((c) => c.opportunity_id)).toEqual(["O3_unquantified_result", "O5_vagueness"]);
    expect(result.suppressed).toEqual([]);
  });

  it("is a no-op when O5_vagueness isn't in the candidates array at all", () => {
    const graph = graphFor(founderCase.TRANSCRIPT, founderCase.LISTEN_ENGINE_FIXTURE);
    const result = suppressUnsupportedCandidates([fakeCandidate("O3_unquantified_result")], graph);
    expect(result.candidates).toHaveLength(1);
    expect(result.suppressed).toEqual([]);
  });

  describe("the dual gate specifically (constructed graphs, isolating each condition)", () => {
    function constructedGraph(nodes: { claim_type: string }[], edgeCount: number) {
      return {
        nodes: nodes.map((n, i) => ({ id: `n${i}`, evidence_class: "A" as const, claim_type: n.claim_type, quote: "x", speaker_assertion: true, admitted_by: "test" })),
        edges: Array.from({ length: edgeCount }, (_, i) => ({ id: `e${i}`, relationship_type: "temporal_sequence", component_ids: ["n0"], marker_text: "", admitted_by: "test" })),
        non_admissible: [],
      };
    }

    it("does NOT suppress: 1 specificity claim but ZERO edges (isolated, unconnected claim — the adversarial shape this gate exists for)", () => {
      const graph = constructedGraph([{ claim_type: "action" }], 0);
      const result = suppressUnsupportedCandidates([fakeCandidate("O5_vagueness")], graph);
      expect(result.suppressed).toEqual([]);
    });

    it("does NOT suppress: edges present but ZERO specificity claim_types (e.g. only problem/context_fact/outcome claims)", () => {
      const graph = constructedGraph([{ claim_type: "problem" }, { claim_type: "outcome" }], 1);
      const result = suppressUnsupportedCandidates([fakeCandidate("O5_vagueness")], graph);
      expect(result.suppressed).toEqual([]);
    });

    it("suppresses: exactly 1 specificity claim AND exactly 1 edge (the minimum satisfying case)", () => {
      const graph = constructedGraph([{ claim_type: "constraint" }, { claim_type: "problem" }], 1);
      const result = suppressUnsupportedCandidates([fakeCandidate("O5_vagueness")], graph);
      expect(result.suppressed).toHaveLength(1);
    });

    it("only counts action/constraint/decision — NOT context_fact, business_value, reflection, prior_belief, problem, outcome, self_reported_diagnosis (known, documented limitation re: Atlas Case 008/009)", () => {
      const graph = constructedGraph(
        [{ claim_type: "context_fact" }, { claim_type: "context_fact" }, { claim_type: "outcome" }, { claim_type: "problem" }],
        3
      );
      const result = suppressUnsupportedCandidates([fakeCandidate("O5_vagueness")], graph);
      expect(result.suppressed).toEqual([]); // real specificity may exist here (Atlas 008 shape) but this rule deliberately does not count it
    });

    it("decision claim_type alone (with an edge) is sufficient — matches the closed enum exactly, not a judgment call on quality", () => {
      const graph = constructedGraph([{ claim_type: "decision" }, { claim_type: "outcome" }], 1);
      const result = suppressUnsupportedCandidates([fakeCandidate("O5_vagueness")], graph);
      expect(result.suppressed).toHaveLength(1);
    });
  });
});
