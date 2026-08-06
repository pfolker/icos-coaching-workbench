import { describe, it, expect } from "vitest";
import { validateEvidence } from "../../evidence-validator/src/index";
import { materializeSourceSpans } from "../../evidence-runtime/src/modelOutput";
import { runListenEngineFixture } from "../../evidence-runtime/src/listenEngine";
import { buildEvidenceGraph } from "../../evidence-runtime/src/evidenceGraph";
import * as case001 from "../../evidence-runtime/fixtures/case001";
import * as case009 from "../../evidence-runtime/fixtures/case009";
import { selectTeachingMove } from "../src/teachingMove";

function graphFor(transcript: string, fixture: ReturnType<typeof runListenEngineFixture>["raw"]) {
  const output = validateEvidence(materializeSourceSpans(transcript, fixture));
  return buildEvidenceGraph(output);
}

describe("Teaching Move selection — deterministic rules over real Evidence Graphs", () => {
  it("Case 001 (12 claims, 3 relationships, no quantity_binding at all) -> highlight_strength, not request_number", () => {
    const graph = graphFor(case001.TRANSCRIPT, case001.LISTEN_ENGINE_FIXTURE);
    expect(graph.edges.some((e) => e.relationship_type === "quantity_binding")).toBe(false);
    const move = selectTeachingMove(graph);
    // This is the whole point: richness must win over "missing one dimension."
    expect(move.type).toBe("highlight_strength");
  });

  it("Case 009 (4 claims, 1 relationship, below the richness threshold, no quantity_binding) -> request_number", () => {
    const graph = graphFor(case009.TRANSCRIPT, case009.LISTEN_ENGINE_FIXTURE);
    const move = selectTeachingMove(graph);
    expect(move.type).toBe("request_number");
  });

  it("contrast_attempts fires whenever a retry graph is supplied, regardless of single-answer richness", () => {
    const original = graphFor(case009.TRANSCRIPT, case009.LISTEN_ENGINE_FIXTURE);
    const retry = graphFor(case001.TRANSCRIPT, case001.LISTEN_ENGINE_FIXTURE);
    const move = selectTeachingMove(original, retry);
    expect(move.type).toBe("contrast_attempts");
    expect(move.anchor_claim_ids.length).toBeGreaterThan(0);
  });

  it("rule table is deterministic: same graph, same result, run twice", () => {
    const graph = graphFor(case001.TRANSCRIPT, case001.LISTEN_ENGINE_FIXTURE);
    expect(selectTeachingMove(graph)).toEqual(selectTeachingMove(graph));
  });

  it("request_number anchors to outcome claims when present", () => {
    const graph = graphFor(case009.TRANSCRIPT, case009.LISTEN_ENGINE_FIXTURE);
    const move = selectTeachingMove(graph);
    const outcomeIds = graph.nodes.filter((n) => n.claim_type === "outcome").map((n) => n.id);
    expect(move.anchor_claim_ids).toEqual(outcomeIds);
  });
});
