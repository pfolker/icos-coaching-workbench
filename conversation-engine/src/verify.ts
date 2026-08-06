/**
 * The Grounding Verifier — the most important file in this package.
 * Mechanical, generator-agnostic: it gates the deterministic templates today
 * and any future LLM generator tomorrow, unchanged.
 */
import { CoachingMove, VerificationCheck } from "./types";
import { OPPORTUNITY_COPY, SECOND_POINT_BANLIST } from "./registry";

export interface VerifyContext {
  transcript: string;
  selected_opportunity_id: string | null;
  rejected_opportunity_ids: string[];
  /** numbers legitimately printable that are not in the transcript (e.g. metric-derived) */
  allowed_numeric_facts?: string[];
}

type MoveCopy = Pick<CoachingMove,
  "mission_line" | "recognition" | "insight" | "why_it_matters" | "retry_instruction" | "advance_copy">;

function allCopy(m: MoveCopy): string {
  return [
    m.mission_line ?? "",
    m.recognition.copy,
    m.insight?.copy ?? "",
    m.why_it_matters?.copy ?? "",
    m.retry_instruction?.copy ?? "",
    m.advance_copy ?? "",
  ].join("\n");
}

export function verifyMove(move: MoveCopy, ctx: VerifyContext): VerificationCheck[] {
  const checks: VerificationCheck[] = [];
  const copy = allCopy(move);
  const lower = copy.toLowerCase();

  // 1. quote_grounding: every "..." segment is a verbatim substring of the transcript
  const quoted = [...copy.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
  const ungrounded = quoted.filter((q) => !ctx.transcript.includes(q));
  checks.push({
    check: "quote_grounding", passed: ungrounded.length === 0,
    detail: ungrounded.length ? `ungrounded quotes: ${ungrounded.map((q) => JSON.stringify(q)).join(", ")}` : `${quoted.length} quote(s), all verbatim`,
  });

  // 2. span_integrity: every declared span matches transcript.slice exactly
  const spans = [...move.recognition.quoted_spans, ...(move.insight?.quoted_spans ?? [])];
  const badSpans = spans.filter((s) => ctx.transcript.slice(s.char_start, s.char_end) !== s.span_text);
  checks.push({
    check: "span_integrity", passed: badSpans.length === 0,
    detail: badSpans.length ? `${badSpans.length} span(s) do not match transcript offsets` : `${spans.length} span(s) verified`,
  });

  // 3. numeric_facts: every number in copy exists in transcript or the allowed list
  const allowed = ctx.allowed_numeric_facts ?? [];
  const numbers = [...copy.matchAll(/\$?\d[\d,]*(?:\.\d+)?%?/g)].map((m) => m[0]);
  const invented = numbers.filter((n) => !ctx.transcript.includes(n) && !allowed.includes(n));
  checks.push({
    check: "numeric_facts", passed: invented.length === 0,
    detail: invented.length ? `invented numeric facts: ${invented.join(", ")}` : `${numbers.length} numeric token(s), all grounded`,
  });

  // 4. single_point_language: no second-coaching-point connectors
  const hits = SECOND_POINT_BANLIST.filter((b) => b.test(copy));
  checks.push({
    check: "single_point_language", passed: hits.length === 0,
    detail: hits.length ? `second-point language: ${hits.map((h) => h.source).join(", ")}` : "no second-point language",
  });

  // 5 & 6. topic signatures: selected present, rejected absent
  if (ctx.selected_opportunity_id) {
    const sig = OPPORTUNITY_COPY[ctx.selected_opportunity_id]?.signature;
    checks.push({
      check: "selected_topic_present",
      passed: !!sig && lower.includes(sig.toLowerCase()),
      detail: sig ? `signature "${sig}" ${lower.includes(sig.toLowerCase()) ? "present" : "MISSING"}` : "unknown opportunity id",
    });
  } else {
    checks.push({ check: "selected_topic_present", passed: true, detail: "reinforce_only: no topic required" });
  }
  const leaks = ctx.rejected_opportunity_ids
    .map((id) => ({ id, sig: OPPORTUNITY_COPY[id]?.signature }))
    .filter((x) => x.sig && lower.includes(x.sig.toLowerCase()));
  checks.push({
    check: "rejected_topics_absent", passed: leaks.length === 0,
    detail: leaks.length ? `rejected-opportunity coaching leaked: ${leaks.map((l) => l.id).join(", ")}` : "no rejected-opportunity language",
  });

  // 7. retry_pattern_match: retry belongs to the selected opportunity
  if (ctx.selected_opportunity_id) {
    const expected = OPPORTUNITY_COPY[ctx.selected_opportunity_id]?.retry_pattern_key;
    const got = move.retry_instruction?.pattern_key;
    checks.push({
      check: "retry_pattern_match", passed: !!expected && got === expected,
      detail: `expected ${expected ?? "?"}, got ${got ?? "none"}`,
    });
  } else {
    checks.push({
      check: "retry_pattern_match", passed: move.retry_instruction === null,
      detail: "reinforce_only: no retry expected",
    });
  }

  // 8. style_no_em_dash: founder style rule, learner-facing copy never uses em/en dashes
  const dashes = copy.includes("\u2014") || copy.includes("\u2013");
  checks.push({
    check: "style_no_em_dash", passed: !dashes,
    detail: dashes ? "em/en dash found in learner-facing copy" : "clean",
  });

  return checks;
}

export const allPassed = (checks: VerificationCheck[]) => checks.every((c) => c.passed);
