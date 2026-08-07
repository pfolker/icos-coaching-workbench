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

/**
 * The FOCUS + STATUS directives (v0.2) — derived DETERMINISTICALLY from the
 * Teaching Move, not chosen by the Narrator. Status (advance vs. retry) is a
 * policy decision that belongs to the deterministic layer; the Narrator only
 * renders it. FOCUS enforces coach-not-reviewer (one thing, never a summary).
 */
export interface CoachDirectives { focus: string; status: string; }

export function directivesFor(type: CoachingAct["type"]): CoachDirectives {
  switch (type) {
    case "highlight_strength":
      return {
        focus: "Name the SINGLE strongest moment in the evidence — the one thing most worth keeping. Do NOT restate or summarize the rest of the answer.",
        status: "ADVANCE — end by telling the learner this answer is ready to lock in and move on.",
      };
    case "request_number":
      return {
        focus: "Point at the single place a concrete number/result is missing. Do NOT restate the rest of the answer.",
        status: "RETRY — end by telling the learner to take one more pass changing exactly one thing: add a specific number or measured result.",
      };
    case "request_constraint":
      return {
        focus: "Point at the single place a constraint/limit is missing. Do NOT restate the rest of the answer.",
        status: "RETRY — end by telling the learner to take one more pass changing exactly one thing: name a specific constraint or limit they worked within.",
      };
    case "request_tool":
      return {
        focus: "Point at the single place a named tool/method is missing. Do NOT restate the rest of the answer.",
        status: "RETRY — end by telling the learner to take one more pass changing exactly one thing: name the specific tool or method they used.",
      };
    case "contrast_attempts":
      return {
        focus: "Name the ONE thing that changed between the two attempts. Do NOT restate the rest.",
        status: "STATUS — end by saying whether that one change makes the answer ready to lock in, or still needs one more pass.",
      };
  }
}

export function buildUserMessage(act: CoachingAct, evidence: NarratorInputEvidence[]): string {
  const quotes = evidence.map((e) => `- "${e.quote}"`).join("\n");
  const d = directivesFor(act.type);
  return `TEACHING MOVE: ${act.type}\nFOCUS: ${d.focus}\nSTATUS: ${d.status}\n\nEVIDENCE (verbatim quotes, the only facts you may use):\n${quotes || "(none — nothing to cite)"}`;
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
