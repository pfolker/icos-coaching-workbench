/**
 * Narrator — the ONE LLM call in this package. Single call per request, no
 * loops, no self-correction passes. Dual mode (live/fixture), same pattern
 * as evidence-runtime's Prototype Listen Engine.
 *
 * Reuses evidence-runtime's hasLiveApiKey()/NoApiKeyError via import
 * (read-only) rather than duplicating the API-key-gating logic — importing
 * from evidence-runtime/src/listenEngine.ts also triggers its own
 * "./loadEnv" side effect, so evidence-runtime/.env's key (if present) is
 * available here too without a second .env mechanism to maintain.
 */
import { hasLiveApiKey, NoApiKeyError } from "../../evidence-runtime/src/listenEngine";
import { NARRATOR_SYSTEM_PROMPT } from "./narratorPrompt";
import { CoachingAct } from "./coachingAct";
import { AnthropicCoachProvider, CoachProvider } from "./coachProvider";

export { hasLiveApiKey, NoApiKeyError };

export interface NarratorInputEvidence {
  claim_id: string;
  quote: string;
}

export interface NarratorLiveMeta {
  model: string;
  base_url: string;
  request_bytes: number;
  response_bytes: number;
}

export type NarratorResult =
  | { mode: "fixture"; message: string }
  | { mode: "live"; message: string; meta: NarratorLiveMeta };

export function buildUserMessage(act: CoachingAct, evidence: NarratorInputEvidence[]): string {
  const quotes = evidence.map((e) => `- "${e.quote}"`).join("\n");
  return `TEACHING MOVE: ${act.type}\n\nEVIDENCE (verbatim quotes, the only facts you may use):\n${quotes || "(none — nothing to cite)"}`;
}

/** Fixture mode: a hand-authored message, for deterministic/free testing. */
export function runNarratorFixture(message: string): NarratorResult {
  return { mode: "fixture", message };
}

export const DEFAULT_MODEL = "claude-sonnet-5";
const NARRATOR_MAX_TOKENS = 300;

/**
 * Live Narrator call — now routed through the extracted CoachProvider seam
 * (Phase 2) instead of a direct fetch. Behavior and the NarratorResult shape
 * are unchanged: still one call, still throws NoApiKeyError with no key (the
 * provider does), still returns the first text block trimmed. The provider is
 * injectable for testing/other providers; it defaults to Anthropic. The
 * response parsing (plain text) stays here — the seam is parse-agnostic.
 */
export async function runNarratorLive(
  act: CoachingAct,
  evidence: NarratorInputEvidence[],
  provider: CoachProvider = new AnthropicCoachProvider(),
): Promise<NarratorResult> {
  const model = process.env.COACHING_RUNTIME_MODEL ?? DEFAULT_MODEL;
  const userMessage = buildUserMessage(act, evidence);

  const completion = await provider.complete(NARRATOR_SYSTEM_PROMPT, userMessage, { model, max_tokens: NARRATOR_MAX_TOKENS });

  return {
    mode: "live",
    message: completion.text.trim(),
    meta: {
      model: completion.meta.model,
      base_url: completion.meta.base_url,
      request_bytes: completion.meta.request_bytes,
      response_bytes: completion.meta.response_bytes,
    },
  };
}
