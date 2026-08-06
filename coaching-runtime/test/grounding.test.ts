import { describe, it, expect } from "vitest";
import { validateEvidence } from "../../evidence-validator/src/index";
import { materializeSourceSpans } from "../../evidence-runtime/src/modelOutput";
import { buildEvidenceGraph } from "../../evidence-runtime/src/evidenceGraph";
import * as case001 from "../../evidence-runtime/fixtures/case001";
import { groundingCheck } from "../src/grounding";
import { COACHING_ATLAS } from "../src/coachingAtlas";

function graphFor(transcript: string, fixture: any) {
  return buildEvidenceGraph(validateEvidence(materializeSourceSpans(transcript, fixture)));
}

describe("Grounding check — the real Case 001 incident", () => {
  const graph = graphFor(case001.TRANSCRIPT, case001.LISTEN_ENGINE_FIXTURE);
  const evidenceQuotes = graph.nodes.map((n) => n.quote);

  it("FAILS the actual buggy message that shipped tonight (asserts 'an indicator check' — content from Case 002, not Case 001)", () => {
    const buggy = "You named the tools and the fix: an indicator check, a conical gripper profile, and two locating divots machined into the part.";
    const result = groundingCheck(buggy, evidenceQuotes);
    expect(result.checked).toBe(true);
    expect(result.passed).toBe(false);
    expect(result.ungrounded_terms).toContain("indicator");
  });

  it("PASSES the corrected Case 001 message (every distinctive claim traces to Case 001's own evidence)", () => {
    const corrected = "You named the fix: two locating divots machined into the part and a conical gripper profile, after realizing the robot was applying force that let the casting move on a rough casting surface.";
    const result = groundingCheck(corrected, evidenceQuotes);
    expect(result.passed).toBe(true);
    expect(result.ungrounded_terms).toEqual([]);
  });

  it("PASSES the real live Narrator message generated for Case 001 tonight", () => {
    const live = `You described moving past the initial assumption that it was "a programming issue" by "watching the process, talking with the operators, and looking at how the fixture contacted the part," which led you to identify that the casting surface wasn't locating the part consistently.`;
    const result = groundingCheck(live, evidenceQuotes);
    expect(result.passed).toBe(true);
  });

  it("is a no-op (passed, not-checked) when no evidence is supplied — nothing to ground against", () => {
    const result = groundingCheck("anything at all", []);
    expect(result.checked).toBe(false);
    expect(result.passed).toBe(true);
  });
});

describe("Grounding check vs. all 12 real Coaching Atlas cases", () => {
  // The Atlas's own cases have no paired evidence_refs (they're tone/
  // admissibility examples, not evidence-grounded coaching acts) — so the
  // meaningful regression property is that grounding never itself
  // overrides or conflicts with the guardrail's classification when no
  // evidence exists to check against. It must always be a safe no-op here,
  // not a source of new false failures.
  for (const c of COACHING_ATLAS) {
    it(`${c.id}: grounding is a no-op with no evidence supplied (defers entirely to the guardrail)`, () => {
      const result = groundingCheck(c.text, []);
      expect(result.checked).toBe(false);
      expect(result.passed).toBe(true);
    });
  }
});
