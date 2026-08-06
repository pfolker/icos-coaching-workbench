/**
 * Comparison Engine — Types
 *
 * Contract (ADR-001 §4, JA-05):
 *  - Compares ONLY the coached dimension. The verdict answers "did the
 *    specific coached thing improve?", never "how good is V2 overall".
 *  - Verdicts are computed by DETERMINISTIC success predicates over the retry
 *    observations. Copy explains; it never decides.
 *  - Protect-the-win: new flaws in the retry are BANKED (a separate output
 *    field for learner memory) and are structurally and verifiably absent
 *    from learner-facing copy.
 */

// ---- structural inputs (assignable from upstream, no adapters) ----

export interface SpanRef {
  sentence_index: number;
  char_start: number;
  char_end: number;
  span_text: string;
}

export interface ObservationIn {
  observation_type: string;
  value: string | number | boolean;
  evidence: SpanRef[];
  confidence: number;
  confidence_basis: string;
}

export interface MetricsIn {
  word_count: number;
  duration_seconds: number;
  filler_per_minute: number;
  i_count: number;
  we_count: number;
  agency_verb_i_count: number;
  quantified_span_count: number;
  numeric_span_count: number;
}

export interface ObservationSetIn {
  sentences: { index: number; text: string; char_start: number; char_end: number; word_count: number }[];
  observations: ObservationIn[];
  metrics: MetricsIn;
}

export interface SelectedIn {
  opportunity: {
    opportunity_id: string;
    related_habits: string[];
    evidence: unknown;
  };
  intervention_type: string;
  priority_class: string;
}

export interface DecisionIn {
  decision_type: "coach_one" | "reinforce_only";
  selected: SelectedIn | null;
  reasoning: {
    mission_handling: string;
    rejected: { opportunity_id: string; rejected_by_rule: string; reason: string }[];
  };
}

export interface CoachingMoveIn {
  retry_instruction: { copy: string; pattern_key: string } | null;
  refs: { opportunity_id: string | null; intervention_type: string | null; habit_id: string | null };
}

export interface ComparisonInput {
  original_transcript: string;
  retry_transcript: string;
  original_observation_set: ObservationSetIn;
  retry_observation_set: ObservationSetIn;
  decision: DecisionIn;
  coaching_move: CoachingMoveIn;
  mission?: { habit_id: string } | null;
}

// ---- output ----

export type Verdict = "achieved" | "partial" | "not_yet";

export interface SourcedSpan extends SpanRef {
  source: "original" | "retry";
}

export interface DimensionEvidence {
  spans: SourcedSpan[];
  metrics_cited: { metric: string; original: number; retry: number }[];
  absent_signals: string[];
}

export interface BankedFlaw {
  opportunity_id: string;
  habit_id: string;
  evidence: SourcedSpan[];
  confidence: number;
  note: string; // internal, for learner memory; NEVER learner-facing
}

export interface VerificationCheck {
  check:
    | "quote_grounding_retry"
    | "quote_grounding_original"
    | "span_integrity"
    | "numeric_facts"
    | "single_point_language"
    | "selected_topic_present"
    | "rejected_topics_absent"
    | "banked_flaws_not_in_copy"
    | "style_no_em_dash";
  passed: boolean;
  detail: string;
}

export interface VerificationReport {
  passed: boolean;
  checks: VerificationCheck[];
  attempts: number;
  degraded: boolean;
}

export interface Comparison {
  schema_version: "1.0";
  verdict: Verdict;
  coached_habit: string;
  selected_opportunity_id: string;
  evidence_from_original: DimensionEvidence;
  evidence_from_retry: DimensionEvidence;
  /** mechanical, data-flavored description of the diff (not learner-facing) */
  improvement_summary: string;
  /** learner-facing reinforcement: protect-the-win copy */
  reinforcement: { copy: string; quoted_spans: SourcedSpan[] };
  banked_flaws: BankedFlaw[];
  verification: VerificationReport;
}

// ---- pluggable reinforcement generation ----

export interface ReinforcementContext {
  verdict: Verdict;
  selected_opportunity_id: string;
  coached_habit: string;
  original_transcript: string;
  retry_transcript: string;
  /** best retry span supporting the verdict (already sentence-resolved), if any */
  retry_quote: SourcedSpan | null;
  /** the coached original span for contrast, if any */
  original_quote: SourcedSpan | null;
}

export type ReinforcementGenerator = (ctx: ReinforcementContext) =>
  { copy: string; quoted_spans: SourcedSpan[] };
