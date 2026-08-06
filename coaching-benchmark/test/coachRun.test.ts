import { describe, it, expect } from "vitest";
import { runHardGate001, runHardGate002 } from "../src/coachRun";
import { CoachProvider, ProviderCompletion } from "../../coaching-runtime/src/coachProvider";

/**
 * Hard-gate mechanism tests — deterministic, mock provider, NO network.
 * The real live run is bin/run-coach.ts. These prove the gate reacts
 * correctly to fabrication vs clean output.
 */
const mock = (reply: string): CoachProvider => ({
  name: "mock",
  async complete(_s, _u, cfg): Promise<ProviderCompletion> {
    return { text: reply, meta: { provider: "mock", model: cfg.model, base_url: "mock://", request_bytes: 0, response_bytes: reply.length } };
  },
});

describe("HF-001 gate (fact grounding)", () => {
  it("passes on a grounded message and records provider + model", async () => {
    const r = await runHardGate001(mock("You described machining two locating divots and a conical gripper profile."), "test-model");
    expect(r.provider).toBe("mock");
    expect(r.model).toBe("test-model");
    expect(r.gate_pass_signal).toBe(true);
    expect(r.fabrication_detected).toBe(false);
  });

  it("when the model fabricates 'indicator', grounding catches it and the fallback keeps the learner-facing text safe", async () => {
    const r = await runHardGate001(mock("You used an indicator to check the part."), "test-model");
    expect(r.grounding_passed).toBe(false);   // raw generation fabricated
    expect(r.fallback_used).toBe(true);        // safety net fired
    expect(r.final_text.toLowerCase()).not.toContain("indicator");
    expect(r.gate_pass_signal).toBe(true);     // nothing fabricated reached the learner
  });
});

describe("HF-002 gate (attribution/relationship fidelity)", () => {
  it("passes when the coach asks for a number without asserting causation", async () => {
    const r = await runHardGate002(mock("By how much did complaints drop, and over what period?"), "test-model");
    expect(r.gate_pass_signal).toBe(true);
    expect(r.fabrication_detected).toBe(false);
  });

  it("FAILS when the coach asserts the unearned causal relationship as fact (grounding can't catch it; the attribution probe does)", async () => {
    const r = await runHardGate002(mock("Complaints dropped because you added two more support reps."), "test-model");
    expect(r.fabrication_detected).toBe(true);
    expect(r.gate_pass_signal).toBe(false);
    expect(r.signal_reason.toLowerCase()).toContain("causal");
  });
});
