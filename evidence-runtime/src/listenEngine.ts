/**
 * Prototype Listen Engine — dual-mode.
 *
 * Single responsibility: read a transcript, produce evidence claim
 * proposals. It does NOT score, coach, prioritize, judge, evaluate,
 * summarize, or explain quality, and it does NOT self-assign evidence_class
 * or admissibility — that is exclusively evidence-validator's job. This file
 * contains no validation logic of any kind.
 *
 * Two modes, deliberately kept behind one interface so any discrepancy found
 * downstream can be attributed to Listen Engine vs. Validator vs.
 * Specification vs. Atlas, not left ambiguous:
 *  - "live": one real LLM call, using LISTEN_ENGINE_SYSTEM_PROMPT verbatim.
 *  - "fixture": hand-authored proposals for a known test transcript — the
 *    AUTHOR'S OWN reading of the transcript, explicitly not Atlas ground
 *    truth (the Atlas contains classifications, not pre-formatted
 *    proposals — see fixtures/README notes).
 */
import "./loadEnv";
import { LISTEN_ENGINE_SYSTEM_PROMPT } from "./systemPrompt";
import { ListenEngineRawOutput } from "./modelOutput";
import { logParseFailure } from "./listenEngineParseFailureLog";

export interface LiveCallMeta {
  model: string;
  base_url: string;
  request_bytes: number;
  response_bytes: number;
}

export type ListenEngineResult =
  | { mode: "fixture"; raw: ListenEngineRawOutput }
  | { mode: "live"; raw: ListenEngineRawOutput; meta: LiveCallMeta };

export class NoApiKeyError extends Error {
  constructor() {
    super(
      "Live mode unavailable: no ANTHROPIC_API_KEY is configured in this environment. " +
      "Reporting this plainly rather than silently falling back to fixture output or " +
      "fabricating a response."
    );
    this.name = "NoApiKeyError";
  }
}

export function hasLiveApiKey(): boolean {
  return typeof process.env.ANTHROPIC_API_KEY === "string" && process.env.ANTHROPIC_API_KEY.length > 0;
}

/** Fixture mode: wraps a hand-authored proposal set in the common result shape. */
export function runListenEngineFixture(raw: ListenEngineRawOutput): ListenEngineResult {
  return { mode: "fixture", raw };
}

const DEFAULT_MODEL = "claude-sonnet-5";

/**
 * Live mode: exactly one LLM call. Throws NoApiKeyError (never fabricates a
 * fallback) when ANTHROPIC_API_KEY isn't set. Uses fetch directly against
 * the Anthropic Messages API rather than pulling in an SDK dependency, so
 * exactly what is sent and received is visible in this one file.
 */
export async function runListenEngineLive(transcript: string): Promise<ListenEngineResult> {
  if (!hasLiveApiKey()) throw new NoApiKeyError();
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const baseUrl = process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com";
  const model = process.env.EVIDENCE_RUNTIME_MODEL ?? DEFAULT_MODEL;

  const userMessage = `TRANSCRIPT:\n"""\n${transcript}\n"""`;
  const requestBody = {
    model,
    max_tokens: 4096,
    system: LISTEN_ENGINE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  };

  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(requestBody),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`Live Listen Engine call failed: HTTP ${res.status} — ${bodyText.slice(0, 500)}`);
  }

  const parsed = JSON.parse(bodyText) as { content?: { type: string; text?: string }[] };
  const textBlock = parsed.content?.find((b) => b.type === "text")?.text ?? "";
  const raw = parseModelJson(textBlock, { transcript, systemPrompt: LISTEN_ENGINE_SYSTEM_PROMPT });

  return {
    mode: "live",
    raw,
    meta: {
      model,
      base_url: baseUrl,
      request_bytes: JSON.stringify(requestBody).length,
      response_bytes: bodyText.length,
    },
  };
}

/**
 * Extracts the single JSON object the system prompt requires as the
 * entire response. On a parse failure, persists the full raw response
 * (untruncated) plus the exact transcript/system prompt that produced it
 * to listenEngineParseFailureLog.ts, then re-throws the SAME error
 * unchanged — diagnostic capture only, zero change to control flow or
 * the success path.
 */
function parseModelJson(text: string, context: { transcript: string; systemPrompt: string }): ListenEngineRawOutput {
  const trimmed = text.trim();
  const jsonText = trimmed.startsWith("{") ? trimmed : (trimmed.match(/\{[\s\S]*\}/)?.[0] ?? trimmed);
  let parsed: Partial<ListenEngineRawOutput>;
  try {
    parsed = JSON.parse(jsonText) as Partial<ListenEngineRawOutput>;
  } catch (e) {
    logParseFailure({
      transcript: context.transcript,
      systemPrompt: context.systemPrompt,
      rawResponseText: text,
      parseError: e instanceof Error ? e : new Error(String(e)),
    });
    throw e;
  }
  return {
    class_a_proposals: parsed.class_a_proposals ?? [],
    class_b_proposals: parsed.class_b_proposals ?? [],
    class_c_proposals: parsed.class_c_proposals ?? [],
  };
}
