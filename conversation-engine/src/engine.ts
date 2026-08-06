/**
 * Conversation Engine — assembly with the degradation ladder:
 *   generate → verify → (retry generation once) → degraded fallback.
 * The degraded card is safe BY CONSTRUCTION (no quotes, no numbers, copy only
 * from the selected opportunity's registry entry) and is itself re-verified.
 */
import {
  CoachingMove, ConversationInput, CopyGenerator, GenerationContext,
  OpportunityEvidenceIn,
} from "./types";
import { templateGenerator } from "./generator";
import { allPassed, verifyMove, VerifyContext } from "./verify";
import { DOWNGRADED_RECOGNITION, OPPORTUNITY_COPY, WHY_IT_MATTERS, ADVANCE_COPY } from "./registry";

function guardEvidence(e: unknown): OpportunityEvidenceIn {
  const x = e as Partial<OpportunityEvidenceIn> | null | undefined;
  return {
    spans: Array.isArray(x?.spans) ? x!.spans! : [],
    observation_types_cited: Array.isArray(x?.observation_types_cited) ? x!.observation_types_cited! : [],
    metrics_cited: Array.isArray(x?.metrics_cited) ? x!.metrics_cited! : [],
    absent_signals: Array.isArray(x?.absent_signals) ? x!.absent_signals! : [],
  };
}

function validate(input: ConversationInput): void {
  const bad = (msg: string) =>
    Object.assign(new Error(msg), { code: "INPUT_INVALID", module: "conversation-engine", retryable: false });
  if (!input || typeof input.transcript !== "string" || input.transcript.length === 0) throw bad("transcript required");
  if (!input.decision || !["coach_one", "reinforce_only"].includes(input.decision.decision_type)) throw bad("decision required");
  if (input.decision.decision_type === "coach_one" && !input.decision.selected) throw bad("coach_one requires selected");
  if (!input.observation_set?.sentences || !input.observation_set?.observations) throw bad("observation_set required");
}

function degradedFallback(ctx: GenerationContext): ReturnType<CopyGenerator> {
  // Only registry copy (signature + retry intact for topic checks), zero quotes,
  // zero numbers, honest recognition. Passes every verifier check by construction.
  if (ctx.decision_type === "reinforce_only" || !ctx.selected) {
    return {
      mission_line: null,
      recognition: { copy: DOWNGRADED_RECOGNITION, quoted_spans: [], downgraded: true },
      insight: null, why_it_matters: null, retry_instruction: null,
      advance_copy: ADVANCE_COPY,
    };
  }
  const entry = OPPORTUNITY_COPY[ctx.selected.opportunity.opportunity_id];
  return {
    mission_line: null,
    recognition: { copy: DOWNGRADED_RECOGNITION, quoted_spans: [], downgraded: true },
    insight: entry
      ? { copy: "Let us work on one thing in that answer.", quoted_spans: [] }
      : { copy: "Let us work on one thing in that answer.", quoted_spans: [] },
    why_it_matters: entry ? { copy: WHY_IT_MATTERS[entry.habit_id] ?? "" } : null,
    retry_instruction: entry
      ? { copy: entry.retry_copy, pattern_key: entry.retry_pattern_key }
      : { copy: "Take one more pass at it.", pattern_key: "unknown" },
    advance_copy: null,
  };
}

export function generateCoachingMove(
  input: ConversationInput,
  generator: CopyGenerator = templateGenerator
): CoachingMove {
  validate(input);
  const { decision, observation_set, transcript } = input;

  const ctx: GenerationContext = {
    transcript,
    sentences: observation_set.sentences,
    observations: observation_set.observations,
    selected: decision.selected,
    evidence: guardEvidence(decision.selected?.opportunity.evidence),
    decision_type: decision.decision_type,
    mission_handling: decision.reasoning.mission_handling,
    mission_habit_id: input.mission?.habit_id ?? null,
    coaching_state: input.coaching_state,
  };

  const vctx: VerifyContext = {
    transcript,
    selected_opportunity_id: decision.selected?.opportunity.opportunity_id ?? null,
    rejected_opportunity_ids: decision.reasoning.rejected.map((r) => r.opportunity_id),
  };

  const finish = (
    copy: ReturnType<CopyGenerator>, attempts: number, degraded: boolean
  ): CoachingMove => ({
    schema_version: "1.0",
    move_type: ctx.decision_type,
    ...copy,
    refs: {
      opportunity_id: ctx.selected?.opportunity.opportunity_id ?? null,
      intervention_type: ctx.selected?.intervention_type ?? null,
      habit_id: ctx.selected ? OPPORTUNITY_COPY[ctx.selected.opportunity.opportunity_id]?.habit_id ?? null : null,
    },
    verification: {
      passed: true, // set below
      checks: [],
      attempts,
      degraded,
    },
  });

  // attempt 1, then attempt 2, then degraded fallback
  for (let attempt = 1; attempt <= 2; attempt++) {
    let copy: ReturnType<CopyGenerator>;
    try {
      copy = generator(ctx);
    } catch {
      continue; // generator crash counts as a failed attempt
    }
    const checks = verifyMove(copy, vctx);
    if (allPassed(checks)) {
      const move = finish(copy, attempt, false);
      move.verification.checks = checks;
      move.verification.passed = true;
      return move;
    }
  }

  const fallback = degradedFallback(ctx);
  const checks = verifyMove(fallback, vctx);
  const move = finish(fallback, 3, true);
  move.verification.checks = checks;
  move.verification.passed = allPassed(checks); // true by construction; asserted in tests
  return move;
}
