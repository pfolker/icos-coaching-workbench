import { describe, it, expect } from "vitest";
import { AnthropicCoachProvider, CoachProvider, ProviderCompletion, NoApiKeyError } from "../src/coachProvider";

/**
 * Seam contract tests. These do NOT make a network call. The live Anthropic
 * path is exercised by the benchmark's coach run (bin/run-coach), not here.
 */

class MockProvider implements CoachProvider {
  readonly name = "mock";
  public lastSystem = "";
  public lastUser = "";
  public lastModel = "";
  constructor(private reply: string) {}
  async complete(system: string, userMessage: string, config: { model: string; max_tokens: number }): Promise<ProviderCompletion> {
    this.lastSystem = system;
    this.lastUser = userMessage;
    this.lastModel = config.model;
    return {
      text: this.reply,
      meta: { provider: this.name, model: config.model, base_url: "mock://", request_bytes: userMessage.length, response_bytes: this.reply.length },
    };
  }
}

describe("CoachProvider seam", () => {
  it("passes system, user message, and the explicit model through to the provider", async () => {
    const p = new MockProvider("hello");
    const out = await p.complete("SYS", "USER", { model: "some-model-id", max_tokens: 42 });
    expect(p.lastSystem).toBe("SYS");
    expect(p.lastUser).toBe("USER");
    expect(p.lastModel).toBe("some-model-id");
    expect(out.text).toBe("hello");
    expect(out.meta.model).toBe("some-model-id");
    expect(out.meta.provider).toBe("mock");
  });

  it("AnthropicCoachProvider throws NoApiKeyError when no key is configured (no network call)", async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      await expect(new AnthropicCoachProvider().complete("s", "u", { model: "m", max_tokens: 10 })).rejects.toBeInstanceOf(NoApiKeyError);
    } finally {
      if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
    }
  });
});
