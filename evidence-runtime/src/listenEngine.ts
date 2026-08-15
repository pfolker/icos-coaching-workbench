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
  /**
   * Why the model stopped. `"max_tokens"` means the response was CUT OFF, which
   * is not the same thing as the model having nothing to say — see
   * ListenTruncatedError. Null when the provider did not report one.
   */
  stop_reason: string | null;
  output_tokens: number | null;
  /**
   * Of `output_tokens`, how many went to the model's thinking pass. This is the
   * volatile term: the Class B investigation measured complete thinking passes
   * of 2,971 and 3,528 tokens against a 4,096 budget, which is what starved the
   * text block and truncated the JSON.
   */
  thinking_tokens: number | null;
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

/**
 * The response was CUT OFF before the model finished writing it — the output
 * budget ran out, or no text block was produced at all.
 *
 * This exists because the failure was previously indistinguishable from the
 * model emitting malformed JSON: truncation surfaced as a generic
 * `SyntaxError: Unterminated string in JSON`, and a caller counting parse
 * failures could not tell "the pipeline was cut off" from "the model answered
 * badly" from "there was nothing to find". Those are three different failures
 * with three different owners, and the Class B Live-Admission Investigation
 * found the first one being silently read as the third across 35% of its runs.
 *
 * Carries the diagnostic metadata so a caller never has to infer the cause.
 * Same intent as sod-experiment's `no_text_block` flag.
 */
export class ListenTruncatedError extends Error {
  readonly truncated = true;
  constructor(
    readonly meta: LiveCallMeta,
    readonly reason: "max_tokens" | "no_text_block",
  ) {
    super(
      reason === "max_tokens"
        ? `Live Listen Engine response was truncated: the model stopped at stop_reason="max_tokens" ` +
          `after ${meta.output_tokens ?? "?"} output tokens (${meta.thinking_tokens ?? "?"} of them thinking). ` +
          `The response is incomplete — it must NOT be read as "no evidence found".`
        : `Live Listen Engine returned no text block (stop_reason=${JSON.stringify(meta.stop_reason)}). ` +
          `The response is empty — it must NOT be read as "no evidence found".`,
    );
    this.name = "ListenTruncatedError";
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
 * Output budget — PRE-REGISTERED at 8192 before any run, per the Listen
 * Truncation Fix work order, and derived from measured evidence rather than
 * chosen by trying values:
 *
 *   - thinking, measured complete: 2,971 and 3,528 tokens (both diagnoses show
 *     the thinking pass FINISHING and the text block being cut, so these are
 *     complete passes, not truncated ones). Worst observed: 3,528.
 *   - a full proposal document for the largest anchors (~15-16 Class A, ~5-6
 *     Class B, plus Class C) is ~1,200-1,500 tokens. Case 002 was cut at ~750
 *     tokens of text with roughly two-thirds of Class A emitted.
 *   - worst-case requirement therefore ~3,528 + ~1,500 = ~5,030.
 *   - 8192 leaves ~4,600 tokens for thinking AFTER a full-size document is paid
 *     for — a ~1.3x margin over the worst observed thinking pass — and is the
 *     smallest power-of-two doubling of the old 4096 that clears it.
 *
 * "Raise until it passes" is explicitly not authorized. If a run still
 * truncates at 8192 that is a REPORTABLE FAILURE, not a trigger to raise again:
 * a second truncation at double the budget would mean the problem is not budget
 * sizing.
 */
const MAX_TOKENS = 8192;

/**
 * Live mode: exactly one LLM call. Throws NoApiKeyError (never fabricates a
 * fallback) when ANTHROPIC_API_KEY isn't set. Uses fetch directly against
 * the Anthropic Messages API rather than pulling in an SDK dependency, so
 * exactly what is sent and received is visible in this one file.
 *
 * Throws ListenTruncatedError when the response was cut off or carried no text
 * block. That check runs BEFORE parsing, because after parsing the two are
 * indistinguishable: a truncated document fails as a generic JSON syntax error
 * that looks exactly like a model writing malformed JSON. No retry — a
 * truncated call fails visibly rather than being silently re-attempted.
 */
export async function runListenEngineLive(transcript: string): Promise<ListenEngineResult> {
  if (!hasLiveApiKey()) throw new NoApiKeyError();
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const baseUrl = process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com";
  const model = process.env.EVIDENCE_RUNTIME_MODEL ?? DEFAULT_MODEL;

  const userMessage = `TRANSCRIPT:\n"""\n${transcript}\n"""`;
  const requestBody = {
    model,
    max_tokens: MAX_TOKENS,
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

  const parsed = JSON.parse(bodyText) as {
    content?: { type: string; text?: string }[];
    stop_reason?: string;
    usage?: { output_tokens?: number; output_tokens_details?: { thinking_tokens?: number } };
  };
  const textBlock = parsed.content?.find((b) => b.type === "text")?.text ?? "";

  const meta: LiveCallMeta = {
    model,
    base_url: baseUrl,
    request_bytes: JSON.stringify(requestBody).length,
    response_bytes: bodyText.length,
    stop_reason: parsed.stop_reason ?? null,
    output_tokens: parsed.usage?.output_tokens ?? null,
    thinking_tokens: parsed.usage?.output_tokens_details?.thinking_tokens ?? null,
  };

  // Truncation is detected BEFORE parsing, on purpose. Once parseModelJson has
  // run, a cut-off document and a malformed one are the same SyntaxError.
  //
  // The raw response is still persisted on this path. That capture is what made
  // the truncated runs forensically recoverable in the Class B investigation —
  // Case 002's contrast_marker proposals were read straight out of the log — so
  // detecting truncation earlier must not cost us the artifact.
  const truncation =
    meta.stop_reason === "max_tokens" ? "max_tokens" as const
    : textBlock.trim().length === 0 ? "no_text_block" as const
    : null;
  if (truncation) {
    const err = new ListenTruncatedError(meta, truncation);
    logParseFailure({
      transcript,
      systemPrompt: LISTEN_ENGINE_SYSTEM_PROMPT,
      rawResponseText: textBlock,
      parseError: err,
    });
    throw err;
  }

  const raw = parseModelJson(textBlock, { transcript, systemPrompt: LISTEN_ENGINE_SYSTEM_PROMPT });

  return { mode: "live", raw, meta };
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
