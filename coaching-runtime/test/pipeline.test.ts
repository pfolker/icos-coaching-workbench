import { describe, it, expect } from "vitest";
import { validateEvidence } from "../../evidence-validator/src/index";
import { materializeSourceSpans } from "../../evidence-runtime/src/modelOutput";
import { runListenEngineFixture } from "../../evidence-runtime/src/listenEngine";
import { buildEvidenceGraph } from "../../evidence-runtime/src/evidenceGraph";
import * as case001 from "../../evidence-runtime/fixtures/case001";
import * as case009 from "../../evidence-runtime/fixtures/case009";
import { runCoachingRuntime } from "../src/pipeline";

function graphFor(transcript: string, fixture: ReturnType<typeof runListenEngineFixture>["raw"]) {
  const output = validateEvidence(materializeSourceSpans(transcript, fixture));
  return buildEvidenceGraph(output);
}

describe("Coaching Runtime pipeline — fixture mode (no live calls)", () => {
  it("Case 001: highlight_strength move, well-formed Narrator message passes the guardrail unchanged", async () => {
    const graph = graphFor(case001.TRANSCRIPT, case001.LISTEN_ENGINE_FIXTURE);
    const result = await runCoachingRuntime({
      case_id: "001", graph, mode: "fixture",
      // Corrected: previously said "an indicator check," content that
      // belongs to Case 002, not Case 001 (Case 001 never mentions an
      // indicator). See README.md's grounding-check incident report.
      fixtureMessage: "You named the fix: two locating divots machined into the part and a conical gripper profile, after realizing the robot was applying force that let the casting move on a rough casting surface.",
    });
    expect(result.teaching_move.type).toBe("highlight_strength");
    expect(result.guardrail.passed).toBe(true);
    expect(result.grounding.passed).toBe(true);
    expect(result.fallback_used).toBe(false);
    expect(result.final_text).toBe(result.narrator_result.message);
  });

  it("REGRESSION: the exact real incident — Case 001 fixture message asserting Case 002's 'indicator' content is caught by the grounding check and never reaches the learner", async () => {
    const graph = graphFor(case001.TRANSCRIPT, case001.LISTEN_ENGINE_FIXTURE);
    const result = await runCoachingRuntime({
      case_id: "001-incident-reproduction", graph, mode: "fixture",
      fixtureMessage: "You named the tools and the fix: an indicator check, a conical gripper profile, and two locating divots machined into the part.",
    });
    // This message has no tone/evaluative problem at all — it would pass
    // every one of the 7 guardrail categories clean. Only grounding catches it.
    expect(result.guardrail.passed).toBe(true);
    expect(result.grounding.passed).toBe(false);
    expect(result.grounding.ungrounded_terms).toContain("indicator");
    expect(result.fallback_used).toBe(true);
    expect(result.final_text).not.toMatch(/indicator/i);
    expect(result.final_text).toMatch(/^You mentioned:/);
  });

  it("guardrail failure triggers the templated evidence-quote fallback, never the raw failing text", async () => {
    const graph = graphFor(case001.TRANSCRIPT, case001.LISTEN_ENGINE_FIXTURE);
    const result = await runCoachingRuntime({
      case_id: "001-adversarial", graph, mode: "fixture",
      fixtureMessage: "That is senior-level thinking.", // CA-003 violation, deliberately
    });
    expect(result.guardrail.passed).toBe(false);
    expect(result.guardrail.violations[0]!.category).toBe(1);
    expect(result.fallback_used).toBe(true);
    expect(result.final_text).not.toBe(result.narrator_result.message);
    expect(result.final_text).toMatch(/^You mentioned:/);
    expect(result.final_text).not.toMatch(/senior-level/i);
  });

  it("Case 009, well-formed message: never asserts the causal belief as fact, through the full pipeline", async () => {
    const graph = graphFor(case009.TRANSCRIPT, case009.LISTEN_ENGINE_FIXTURE);
    const result = await runCoachingRuntime({
      case_id: "009", graph, mode: "fixture",
      fixtureMessage: "You haven't put a number on the drop yet — how many complaints, or by what percent?",
    });
    expect(result.teaching_move.type).toBe("request_number");
    expect(result.guardrail.passed).toBe(true);
    expect(result.final_text.toLowerCase()).not.toMatch(/root cause|caused by|confirmed|proven/);
  });

  it("Case 009, ADVERSARIAL message (asserts the belief as established fact): guardrail catches it, fallback never repeats the claim", async () => {
    const graph = graphFor(case009.TRANSCRIPT, case009.LISTEN_ENGINE_FIXTURE);
    const result = await runCoachingRuntime({
      case_id: "009-adversarial", graph, mode: "fixture",
      // Simulates a Narrator that ignores its own system prompt and asserts
      // the self-reported belief as confirmed fact — exactly Failure Mode 9,
      // tested here for the first time past the Evidence layer.
      fixtureMessage: "This confirms that reduced agent stress was the root cause of the drop in complaints.",
    });
    expect(result.guardrail.passed).toBe(false);
    // "confirms that" -> category 5 (affirms reasoning/conclusion as correct)
    expect(result.guardrail.violations.some((v) => v.category === 5)).toBe(true);
    expect(result.fallback_used).toBe(true);
    expect(result.final_text).not.toMatch(/root cause|confirms/i);
  });

  it("contrast_attempts (retry pair) works end to end in fixture mode", async () => {
    const original = graphFor(case009.TRANSCRIPT, case009.LISTEN_ENGINE_FIXTURE);
    const retry = graphFor(case001.TRANSCRIPT, case001.LISTEN_ENGINE_FIXTURE);
    const result = await runCoachingRuntime({
      case_id: "009-to-001-contrast", graph: original, retryGraph: retry, mode: "fixture",
      fixtureMessage: "Your retry adds the fixture redesign and the throughput improvement that weren't in your first version.",
    });
    expect(result.teaching_move.type).toBe("contrast_attempts");
    expect(result.guardrail.passed).toBe(true);
  });

  it("determinism: same fixture inputs produce byte-identical non-Narrator-timing fields across two runs", async () => {
    const graph = graphFor(case001.TRANSCRIPT, case001.LISTEN_ENGINE_FIXTURE);
    const r1 = await runCoachingRuntime({ case_id: "001", graph, mode: "fixture", fixtureMessage: "You named the tools and the fix." });
    const r2 = await runCoachingRuntime({ case_id: "001", graph, mode: "fixture", fixtureMessage: "You named the tools and the fix." });
    expect(r1.teaching_move).toEqual(r2.teaching_move);
    expect(r1.guardrail).toEqual(r2.guardrail);
    expect(r1.final_text).toBe(r2.final_text);
  });
});
