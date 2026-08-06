/**
 * CoachProvider — the extracted provider seam (Phase 2, item 1).
 *
 * This is the SMALLEST seam justified by the real duplication between
 * `runNarratorLive` (this package, src/narrator.ts) and `runListenEngineLive`
 * (evidence-runtime/src/listenEngine.ts). Both functions make ONE Anthropic
 * Messages call with byte-identical headers, URL, and
 * {model, max_tokens, system, messages} body shape. They differ on exactly
 * five axes, and this seam flexes on exactly those five, nothing more:
 *
 *   1. model id          — an explicit config parameter (item 2), never
 *                          hardcoded or silently defaulted AT THE SEAM.
 *   2. max_tokens        — config parameter (Narrator 300, Listen 4096).
 *   3. system prompt     — passed in by the caller.
 *   4. user message      — passed in by the caller (each builds its own).
 *   5. response parsing  — NOT done here. The seam returns the raw first
 *                          text block; the caller parses it (Narrator: plain
 *                          text; Listen: a JSON object). Keeping parsing out
 *                          is what lets one seam serve both shapes.
 *
 * Deliberately absent, because neither existing function exercises them
 * (out of scope, Phase 2): streaming, tool use, retry, multi-turn, and any
 * cost/token routing. They are not designed-for here; they get added if and
 * when a real caller needs them.
 *
 * Reuses evidence-runtime's key-gating (hasLiveApiKey / NoApiKeyError) exactly
 * as narrator.ts already did — importing it also triggers evidence-runtime's
 * ./loadEnv side effect, so evidence-runtime/.env's key is available here too.
 */
import { hasLiveApiKey, NoApiKeyError } from "../../evidence-runtime/src/listenEngine";

export { hasLiveApiKey, NoApiKeyError };

export interface ProviderCompletionConfig {
  /** Explicit model id — item 2. Required: the seam never defaults it. */
  model: string;
  max_tokens: number;
  /** Overrides ANTHROPIC_BASE_URL / the Anthropic default when set. */
  base_url?: string;
}

export interface ProviderCallMeta {
  provider: string;
  model: string;
  base_url: string;
  request_bytes: number;
  response_bytes: number;
}

export interface ProviderCompletion {
  /** The first text content block, verbatim. The caller trims/parses it. */
  text: string;
  meta: ProviderCallMeta;
}

/**
 * One completion = one model call. No loops, no self-correction — the same
 * single-call discipline the Narrator and Listen Engine already hold.
 */
export interface CoachProvider {
  readonly name: string;
  complete(system: string, userMessage: string, config: ProviderCompletionConfig): Promise<ProviderCompletion>;
}

const ANTHROPIC_DEFAULT_BASE_URL = "https://api.anthropic.com";

/**
 * The one provider this extraction requires (out of scope: additional
 * providers). Its body is the shared code lifted verbatim from the two
 * original live functions.
 */
export class AnthropicCoachProvider implements CoachProvider {
  readonly name = "anthropic";

  async complete(system: string, userMessage: string, config: ProviderCompletionConfig): Promise<ProviderCompletion> {
    if (!hasLiveApiKey()) throw new NoApiKeyError();
    const apiKey = process.env.ANTHROPIC_API_KEY!;
    const base_url = config.base_url ?? process.env.ANTHROPIC_BASE_URL ?? ANTHROPIC_DEFAULT_BASE_URL;

    const requestBody = {
      model: config.model,
      max_tokens: config.max_tokens,
      system,
      messages: [{ role: "user", content: userMessage }],
    };

    const res = await fetch(`${base_url}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(requestBody),
    });

    const bodyText = await res.text();
    if (!res.ok) throw new Error(`Anthropic provider call failed: HTTP ${res.status} — ${bodyText.slice(0, 500)}`);

    const parsed = JSON.parse(bodyText) as { content?: { type: string; text?: string }[] };
    const text = parsed.content?.find((b) => b.type === "text")?.text ?? "";

    return {
      text,
      meta: {
        provider: this.name,
        model: config.model,
        base_url,
        request_bytes: JSON.stringify(requestBody).length,
        response_bytes: bodyText.length,
      },
    };
  }
}
