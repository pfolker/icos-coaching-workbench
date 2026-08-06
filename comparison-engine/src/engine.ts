/**
 * Verifier + default reinforcement generator + engine assembly.
 */
import {
  BankedFlaw, Comparison, ComparisonInput, ReinforcementContext, ReinforcementGenerator,
  SourcedSpan, VerificationCheck, Verdict,
} from "./types";
import {
  ComparisonConfig, DEFAULT_COMPARISON_CONFIG, DEGRADED_COPY, GENERIC_VERDICT_COPY,
  OPP_META, SECOND_POINT_BANLIST, VERDICT_COPY,
} from "./registry";
import { bankNewFlaws, judge } from "./predicates";

// ------------------------------- verifier -------------------------------

export interface VerifyCtx {
  original_transcript: string;
  retry_transcript: string;
  selected_opportunity_id: string;
  rejected_ids: string[];
  banked: BankedFlaw[];
}

export function verifyReinforcement(
  r: { copy: string; quoted_spans: SourcedSpan[] },
  ctx: VerifyCtx
): VerificationCheck[] {
  const checks: VerificationCheck[] = [];
  const copy = r.copy;
  const lower = copy.toLowerCase();

  const quoted = [...copy.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
  const retryUngrounded = quoted.filter((q) => !ctx.retry_transcript.includes(q) && !ctx.original_transcript.includes(q));
  checks.push({
    check: "quote_grounding_retry", passed: retryUngrounded.length === 0,
    detail: retryUngrounded.length ? `ungrounded quotes: ${retryUngrounded.join(" | ")}` : `${quoted.length} quote(s) grounded`,
  });
  const badOriginalTag = r.quoted_spans.filter((s) => s.source === "original"
    && ctx.original_transcript.slice(s.char_start, s.char_end) !== s.span_text);
  checks.push({
    check: "quote_grounding_original", passed: badOriginalTag.length === 0,
    detail: badOriginalTag.length ? `${badOriginalTag.length} original-tagged span(s) unmatched` : "original-tagged spans grounded",
  });

  const badSpans = r.quoted_spans.filter((s) => {
    const t = s.source === "retry" ? ctx.retry_transcript : ctx.original_transcript;
    return t.slice(s.char_start, s.char_end) !== s.span_text;
  });
  checks.push({
    check: "span_integrity", passed: badSpans.length === 0,
    detail: badSpans.length ? `${badSpans.length} span(s) fail slice check` : `${r.quoted_spans.length} span(s) verified`,
  });

  const numbers = [...copy.matchAll(/\$?\d[\d,]*(?:\.\d+)?%?/g)].map((m) => m[0]);
  const invented = numbers.filter((n) => !ctx.retry_transcript.includes(n) && !ctx.original_transcript.includes(n));
  checks.push({
    check: "numeric_facts", passed: invented.length === 0,
    detail: invented.length ? `invented numbers: ${invented.join(", ")}` : `${numbers.length} numeric token(s) grounded`,
  });

  const hits = SECOND_POINT_BANLIST.filter((b) => b.test(copy));
  checks.push({
    check: "single_point_language", passed: hits.length === 0,
    detail: hits.length ? `second-point language: ${hits.map((h) => h.source).join(", ")}` : "clean",
  });

  const sig = OPP_META[ctx.selected_opportunity_id]?.signature;
  checks.push({
    check: "selected_topic_present", passed: !!sig && lower.includes(sig.toLowerCase()),
    detail: sig ? `signature "${sig}" ${lower.includes(sig.toLowerCase()) ? "present" : "MISSING"}` : "unknown opportunity",
  });

  const leaks = ctx.rejected_ids
    .map((id) => OPP_META[id]?.signature).filter((s): s is string => !!s)
    .filter((s) => lower.includes(s.toLowerCase()));
  checks.push({
    check: "rejected_topics_absent", passed: leaks.length === 0,
    detail: leaks.length ? `rejected coaching leaked: ${leaks.join(" | ")}` : "clean",
  });

  const bankedLeaks = ctx.banked
    .map((b) => OPP_META[b.opportunity_id]?.signature).filter((s): s is string => !!s)
    .filter((s) => lower.includes(s.toLowerCase()));
  checks.push({
    check: "banked_flaws_not_in_copy", passed: bankedLeaks.length === 0,
    detail: bankedLeaks.length ? `banked flaw surfaced in copy: ${bankedLeaks.join(" | ")}` : "banked flaws silent (JA-05)",
  });

  const dashes = copy.includes("\u2014") || copy.includes("\u2013");
  checks.push({
    check: "style_no_em_dash", passed: !dashes,
    detail: dashes ? "em/en dash in learner-facing copy" : "clean",
  });

  return checks;
}

export const allPassed = (c: VerificationCheck[]) => c.every((x) => x.passed);

// --------------------- default reinforcement generator ---------------------

export const templateReinforcement: ReinforcementGenerator = (ctx: ReinforcementContext) => {
  const table = VERDICT_COPY[ctx.selected_opportunity_id];
  const sig = OPP_META[ctx.selected_opportunity_id]?.signature;
  let copy = table ? table[ctx.verdict] : GENERIC_VERDICT_COPY[ctx.verdict];
  const quoted_spans: SourcedSpan[] = [];
  if (copy.includes("{R}")) {
    if (ctx.retry_quote) {
      copy = copy.replace("{R}", ctx.retry_quote.span_text);
      quoted_spans.push(ctx.retry_quote);
    } else {
      // quote-shaped template without a quotable span: use the generic verdict
      // line plus the signature so topic checks hold, and quote nothing
      copy = `${GENERIC_VERDICT_COPY[ctx.verdict]}${sig ? ` The focus stays the same: ${sig}.` : ""}`;
    }
  }
  return { copy, quoted_spans };
};

// ------------------------------- engine -------------------------------

function validate(input: ComparisonInput): void {
  const bad = (m: string) => Object.assign(new Error(m),
    { code: "INPUT_INVALID", module: "comparison-engine", retryable: false });
  if (!input?.original_transcript || !input?.retry_transcript) throw bad("both transcripts required");
  if (!input.original_observation_set?.metrics || !input.retry_observation_set?.metrics) throw bad("both observation sets required");
  if (input.decision?.decision_type !== "coach_one" || !input.decision.selected) throw bad("comparison requires a coach_one decision with a selection");
}

export function compareRetry(
  input: ComparisonInput,
  generator: ReinforcementGenerator = templateReinforcement,
  config: ComparisonConfig = DEFAULT_COMPARISON_CONFIG
): Comparison {
  validate(input);
  const selectedId = input.decision.selected!.opportunity.opportunity_id;
  const habit = OPP_META[selectedId]?.habit_id
    ?? input.decision.selected!.opportunity.related_habits[0] ?? "unknown";

  const result = judge(selectedId, input.original_observation_set, input.retry_observation_set, config);
  const banked = bankNewFlaws(selectedId, input.original_observation_set, input.retry_observation_set, config);

  const rctx: ReinforcementContext = {
    verdict: result.verdict,
    selected_opportunity_id: selectedId,
    coached_habit: habit,
    original_transcript: input.original_transcript,
    retry_transcript: input.retry_transcript,
    retry_quote: result.retry_quote,
    original_quote: null,
  };
  const vctx: VerifyCtx = {
    original_transcript: input.original_transcript,
    retry_transcript: input.retry_transcript,
    selected_opportunity_id: selectedId,
    rejected_ids: input.decision.reasoning.rejected.map((r) => r.opportunity_id),
    banked,
  };

  const finish = (
    reinforcement: { copy: string; quoted_spans: SourcedSpan[] },
    checks: VerificationCheck[], attempts: number, degraded: boolean
  ): Comparison => ({
    schema_version: "1.0",
    verdict: result.verdict,
    coached_habit: habit,
    selected_opportunity_id: selectedId,
    evidence_from_original: result.original_evidence,
    evidence_from_retry: result.retry_evidence,
    improvement_summary: result.summary,
    reinforcement,
    banked_flaws: banked,
    verification: { passed: allPassed(checks), checks, attempts, degraded },
  });

  for (let attempt = 1; attempt <= 2; attempt++) {
    let r: { copy: string; quoted_spans: SourcedSpan[] };
    try { r = generator(rctx); } catch { continue; }
    const checks = verifyReinforcement(r, vctx);
    if (allPassed(checks)) return finish(r, checks, attempt, false);
  }

  // degraded fallback: verdict stands (deterministic); copy is safe by
  // construction but must still carry the selected signature for topic checks
  const sig = OPP_META[selectedId]?.signature;
  const fallback = {
    copy: `${DEGRADED_COPY[result.verdict]}${sig ? ` The focus stays the same: ${sig}.` : ""}`,
    quoted_spans: [] as SourcedSpan[],
  };
  const checks = verifyReinforcement(fallback, vctx);
  return finish(fallback, checks, 3, true);
}
