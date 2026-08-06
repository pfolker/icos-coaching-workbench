import { describe, it, expect } from "vitest";
import { validateEvidence } from "../../evidence-validator/src/index";
import { materializeSourceSpans } from "../../evidence-runtime/src/modelOutput";
import { buildEvidenceGraph } from "../../evidence-runtime/src/evidenceGraph";
import * as case001 from "../../evidence-runtime/fixtures/case001";
import { runStructuredCoach } from "../src/structuredCoach";
import { CoachProvider, ProviderCompletion } from "../src/coachProvider";

/**
 * Structured Coach v0.1 wiring tests — deterministic, using a mock provider
 * (no network, no key). Proves the coach routes through the seam, records the
 * provider/model, and applies guardrail + grounding to route the fallback.
 */

function case001Graph() {
  return buildEvidenceGraph(validateEvidence(materializeSourceSpans(case001.TRANSCRIPT, case001.LISTEN_ENGINE_FIXTURE)));
}

class CannedProvider implements CoachProvider {
  readonly name = "canned";
  constructor(private reply: string) {}
  async complete(_system: string, _user: string, config: { model: string; max_tokens: number }): Promise<ProviderCompletion> {
    return { text: this.reply, meta: { provider: this.name, model: config.model, base_url: "mock://", request_bytes: 0, response_bytes: this.reply.length } };
  }
}

describe("runStructuredCoach (v0.1)", () => {
  it("returns a grounded message unchanged and records provider + explicit model", async () => {
    // A message built only from Case 001's own evidence — should pass guardrail + grounding.
    const grounded = "You described machining two locating divots and redesigning the gripper pads with a conical profile.";
    const r = await runStructuredCoach({
      graph: case001Graph(),
      provider: new CannedProvider(grounded),
      model: "test-model-9",
    });
    expect(r.provider).toBe("canned");
    expect(r.model).toBe("test-model-9");
    expect(r.fallback_used).toBe(false);
    expect(r.final_text).toBe(grounded);
    expect(r.raw_message).toBe(grounded);
    expect(r.evidence_quotes.length).toBeGreaterThan(0);
  });

  it("routes to the evidence-quoting fallback when the message fabricates a fact (grounding fails)", async () => {
    // "indicator" appears nowhere in Case 001 — the exact HF-001 fabrication class.
    const fabricated = "You used an indicator to check the part before and after.";
    const r = await runStructuredCoach({
      graph: case001Graph(),
      provider: new CannedProvider(fabricated),
      model: "test-model-9",
    });
    expect(r.grounding.passed).toBe(false);
    expect(r.fallback_used).toBe(true);
    expect(r.final_text).not.toContain("indicator");
    expect(r.final_text.startsWith("You mentioned")).toBe(true);
  });

  it("makes exactly one provider call (single-call discipline)", async () => {
    let calls = 0;
    const counting: CoachProvider = {
      name: "counting",
      async complete(_s, _u, cfg) {
        calls++;
        return { text: "You described the fixture change.", meta: { provider: "counting", model: cfg.model, base_url: "mock://", request_bytes: 0, response_bytes: 0 } };
      },
    };
    await runStructuredCoach({ graph: case001Graph(), provider: counting, model: "m" });
    expect(calls).toBe(1);
  });
});
