import { describe, it, expect } from "vitest";
import { runListenEngineFixture } from "../src/listenEngine";
import { runPipeline } from "../src/pipeline";
import { runExistingEngines } from "../src/existingEngines";
import { FIXTURE_CASES, case007, case009 } from "../fixtures/index";

describe("Evidence Runtime Prototype — full 8-stage pipeline, fixture mode", () => {
  for (const c of FIXTURE_CASES) {
    it(`Case ${c.case_id} (${c.label}) runs end to end with no crashes and produces a coherent graph`, () => {
      const listenResult = runListenEngineFixture(c.fixture);
      const result = runPipeline(c.case_id, c.transcript, listenResult);

      // Stage 1-4: every validated node/edge/non-admissible entry is well-formed.
      for (const node of result.evidence_graph.nodes) {
        expect(node.evidence_class).toBe("A");
        expect(node.admitted_by.length).toBeGreaterThan(0);
      }
      for (const edge of result.evidence_graph.edges) {
        expect(edge.admitted_by.length).toBeGreaterThan(0);
        for (const compId of edge.component_ids) {
          expect(result.evidence_graph.nodes.some((n) => n.id === compId)).toBe(true);
        }
      }
      for (const c3 of result.evidence_graph.non_admissible) {
        expect(c3.admissible).toBe(false);
        expect(c3.admitted_by.length).toBeGreaterThan(0);
      }

      // Every rejected/requires_review claim carries a reason.
      for (const r of result.validator_output.rejected) {
        expect(r.reason_code.length).toBeGreaterThan(0);
        expect(r.explanation.length).toBeGreaterThan(0);
      }

      // Stage 5-8: existing engines ran and produced their normal shape.
      expect(result.existing_engines.observation_set.observations).toBeDefined();
      expect(Array.isArray(result.existing_engines.candidates)).toBe(true);
      expect(["coach_one", "reinforce_only"]).toContain(result.existing_engines.decision.decision_type);
      expect(result.existing_engines.move.verification).toBeDefined();
    });
  }

  it("Stage 5 (Observation Engine) is NOT influenced by Stage 4 (Evidence Graph) — no adapter exists", () => {
    // Running existing-engines output twice for the same transcript, with and
    // without ever computing Stages 1-4 first, must be byte-identical. There
    // is no code path by which the Evidence Graph could reach the Observation
    // Engine's input even if we wanted it to — this test proves the negative.
    const c = FIXTURE_CASES[0]!;
    const withEvidence = runPipeline(c.case_id, c.transcript, runListenEngineFixture(c.fixture));
    const standalone = runExistingEngines(c.transcript);
    expect(JSON.stringify(withEvidence.existing_engines)).toBe(JSON.stringify(standalone));
  });

  it("Case 007: multiple-candidate 'problem' proposals both survive, selection_required fires, discourse marker attached as metadata only", () => {
    const result = runPipeline("007-multi", case007.TRANSCRIPT, runListenEngineFixture(case007.LISTEN_ENGINE_FIXTURE_MULTI_CANDIDATE));
    expect(result.validator_output.selection_required.length).toBe(1);
    const sr = result.validator_output.selection_required[0]!;
    expect(sr.candidate_proposal_ids.sort()).toEqual(["a_problem", "a_staffing_as_problem"]);
    expect(sr.discourse_marker?.marked_proposal_id).toBe("a_problem");
    // both candidates remain in the graph — neither silently discarded
    expect(result.evidence_graph.nodes.map((n) => n.id).sort()).toEqual(["a_problem", "a_staffing_as_problem"]);
  });

  it("Case 009 (adversarial): a self-assigned promotion label is rejected end to end and never reaches the Evidence Graph — the single most important regression in this build", () => {
    const result = runPipeline("009-adversarial", case009.TRANSCRIPT, runListenEngineFixture(case009.LISTEN_ENGINE_FIXTURE_ADVERSARIAL));
    const rejection = result.validator_output.rejected.find((r) => r.proposal_id === "a_belief_promoted");
    expect(rejection).toBeDefined();
    expect(rejection!.reason_code).toBe("BELIEF_FACT_COLLAPSE_ATTEMPT");
    expect(result.evidence_graph.nodes.some((n) => n.id === "a_belief_promoted")).toBe(false);
  });

  it("Case 009 (well-formed): the causal belief validates as Class A self_reported_diagnosis, never promoted", () => {
    const result = runPipeline("009", case009.TRANSCRIPT, runListenEngineFixture(case009.LISTEN_ENGINE_FIXTURE));
    const node = result.evidence_graph.nodes.find((n) => n.id === "a_belief");
    expect(node).toBeDefined();
    expect(node!.claim_type).toBe("self_reported_diagnosis");
    expect(node!.speaker_assertion).toBe(true);
  });

  it("Case 008: temporal_sequence proposed in semantic order validates via ordering_basis=connector:once", () => {
    const c = FIXTURE_CASES.find((f) => f.case_id === "008")!;
    const result = runPipeline(c.case_id, c.transcript, runListenEngineFixture(c.fixture));
    const edge = result.evidence_graph.edges.find((e) => e.relationship_type === "temporal_sequence");
    expect(edge).toBeDefined();
    expect(edge!.ordering_basis).toBe("connector:once");
    expect(edge!.admitted_by).toMatch(/connector:once/);
  });

  it("Case 010: the clean single-cause narrative stays Class C, never Class A/B causal assertion", () => {
    const c = FIXTURE_CASES.find((f) => f.case_id === "010")!;
    const result = runPipeline(c.case_id, c.transcript, runListenEngineFixture(c.fixture));
    expect(result.evidence_graph.non_admissible.length).toBe(1);
    expect(result.evidence_graph.non_admissible[0]!.hypothesis).toMatch(/caused the completion rate increase/);
    const aText = JSON.stringify(result.evidence_graph.nodes) + JSON.stringify(result.evidence_graph.edges);
    expect(aText.toLowerCase()).not.toContain("caused");
  });

  it("determinism: running the same fixture twice produces byte-identical Stage 1-4 output", () => {
    for (const c of FIXTURE_CASES) {
      const r1 = runPipeline(c.case_id, c.transcript, runListenEngineFixture(c.fixture));
      const r2 = runPipeline(c.case_id, c.transcript, runListenEngineFixture(c.fixture));
      expect(JSON.stringify(r1.validator_output)).toBe(JSON.stringify(r2.validator_output));
      expect(JSON.stringify(r1.evidence_graph)).toBe(JSON.stringify(r2.evidence_graph));
    }
  });
});
