/**
 * Diagnostic-only capture for parseModelJson() failures. Persists the
 * full, untruncated raw model response alongside the exact system prompt
 * and transcript that produced it, so a real parse failure can actually
 * be inspected byte-for-byte instead of just logged as "it happened."
 *
 * Purely additive: parseModelJson() calls this, then re-throws the
 * original error unchanged. No control flow, return type, or success-path
 * behavior changes for any caller. Append-only, human-readable, one file
 * — same reasoning as test-build-v1's suppression log: a same-day
 * reviewer wants to read chronologically, not hunt per-incident files.
 * Lives here (in evidence-runtime, not test-build-v1) because this
 * failure path is reachable by ANY consumer of the Listen Engine's live
 * mode, not just Test Build v1.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const LOG_PATH = join(here, "../logs/listen-engine-parse-failures.log");

export interface ParseFailureContext {
  transcript: string;
  systemPrompt: string;
  rawResponseText: string;
  parseError: Error;
}

export function logParseFailure(ctx: ParseFailureContext): void {
  mkdirSync(dirname(LOG_PATH), { recursive: true });
  const lines = [
    "=".repeat(100),
    `LISTEN ENGINE PARSE FAILURE — ${new Date().toISOString()}`,
    "=".repeat(100),
    "",
    "parse_error:",
    `  name: ${ctx.parseError.name}`,
    `  message: ${ctx.parseError.message}`,
    "",
    "transcript (submitted by the learner):",
    ctx.transcript,
    "",
    "system_prompt (exact, verbatim):",
    ctx.systemPrompt,
    "",
    "raw_response_text (exact, verbatim, UNTRUNCATED — the full model output before any parsing was attempted):",
    ctx.rawResponseText,
    "",
    "",
  ];
  appendFileSync(LOG_PATH, lines.join("\n"), "utf8");
}

export { LOG_PATH };
