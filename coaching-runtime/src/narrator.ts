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

function buildUserMessage(act: CoachingAct, evidence: NarratorInputEvidence[]): string {
  const quotes = evidence.map((e) => `- "${e.quote}"`).join("\n");
  return `TEACHING MOVE: ${act.type}\n\nEVIDENCE (verbatim quotes, the only facts you may use):\n${quotes || "(none — nothing to cite)"}`;
}

/** Fixture mode: a hand-authored message, for deterministic/free testing. */
export function runNarratorFixture(message: string): NarratorResult {
  return { mode: "fixture", message };
}

const DEFAULT_MODEL = "claude-sonnet-5";

export async function runNarratorLive(act: CoachingAct, evidence: NarratorInputEvidence[]): Promise<NarratorResult> {
  if (!hasLiveApiKey()) throw new NoApiKeyError();
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const baseUrl = process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com";
  const model = process.env.COACHING_RUNTIME_MODEL ?? DEFAULT_MODEL;

  const userMessage = buildUserMessage(act, evidence);
  const requestBody = {
    model,
    max_tokens: 300,
    system: NARRATOR_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  };

  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(requestBody),
  });

  const bodyText = await res.text();
  if (!res.ok) throw new Error(`Narrator live call failed: HTTP ${res.status} — ${bodyText.slice(0, 500)}`);

  const parsed = JSON.parse(bodyText) as { content?: { type: string; text?: string }[] };
  const message = (parsed.content?.find((b) => b.type === "text")?.text ?? "").trim();

  return {
    mode: "live",
    message,
    meta: { model, base_url: baseUrl, request_bytes: JSON.stringify(requestBody).length, response_bytes: bodyText.length },
  };
}
