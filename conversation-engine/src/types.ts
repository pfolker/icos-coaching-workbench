/**
 * Conversation Engine — Types
 *
 * The FIRST package allowed to produce learner-facing language.
 * Contract:
 *  - Copy is generated ONLY from the selected decision. Structurally there is
 *    exactly one `insight` field: a second coaching point has nowhere to live.
 *  - Never re-ranks, never invents observations, never references rejected
 *    opportunities. All of this is mechanically verified, not promised.
 *  - Generation is PLUGGABLE (CopyGenerator). v1 ships a deterministic
 *    template generator; a future LLM generator slots in behind the SAME
 *    verifier. The verifier is the load-bearing component.
 */

// ---- structural inputs (assignable from upstream packages, no adapters) ----

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

export interface ObservationSetIn {
  sentences: { index: number; text: string; char_start: number; char_end: number; word_count: number }[];
  observations: ObservationIn[];
  /** present upstream; unused here, typed opaquely so any upstream shape assigns */
  metrics?: unknown;
}

export interface OpportunityEvidenceIn {
  spans: SpanRef[];
  observation_types_cited: string[];
  metrics_cited: unknown[];
  absent_signals: string[];
}

export interface SelectedIn {
  opportunity: {
    opportunity_id: string;
    related_habits: string[];
    evidence: unknown; // guarded at runtime; malformed → treated as absence-based
    confidence: number;
    mission_alignment: "aligned" | "unaligned" | "no_mission";
  };
  intervention_type: string; // I1_direct_instruction | I2_modeling | I3_elicitation | I7_reframe | I10_confidence_structuring
  priority_class: string;
}

export interface CoachingDecisionIn {
  decision_type: "coach_one" | "reinforce_only";
  selected: SelectedIn | null;
  reasoning: {
    mission_handling: "aligned_selected" | "mission_fallback" | "no_mission" | "n/a";
    rejected: { opportunity_id: string; rejected_by_rule: string; reason: string }[];
  };
}

export type CoachingStateName = "flowing" | "struggling" | "disengaging";

export interface ConversationInput {
  decision: CoachingDecisionIn;
  observation_set: ObservationSetIn;
  transcript: string;
  coaching_state: CoachingStateName;
  mission?: { habit_id: string } | null;
}

// ---- output: the CoachingMove ----

export interface CopyBlock {
  copy: string;
  quoted_spans: SpanRef[]; // every span here is verifier-checked against transcript
}

export interface VerificationCheck {
  check:
    | "quote_grounding"
    | "span_integrity"
    | "numeric_facts"
    | "single_point_language"
    | "selected_topic_present"
    | "rejected_topics_absent"
    | "retry_pattern_match"
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

export interface CoachingMove {
  schema_version: "1.0";
  move_type: "coach_one" | "reinforce_only";
  mission_line: string | null;              // only when mission_handling === aligned_selected
  recognition: CopyBlock & { downgraded: boolean }; // evidence-based, JA-08 gate applied
  insight: CopyBlock | null;                // THE one coaching point (null on reinforce_only)
  why_it_matters: { copy: string } | null;  // proxy-inference explanation for the habit
  retry_instruction: { copy: string; pattern_key: string } | null;
  advance_copy: string | null;              // reinforce_only path
  refs: { opportunity_id: string | null; intervention_type: string | null; habit_id: string | null };
  verification: VerificationReport;
}

// ---- pluggable generation ----

/** Everything a generator may use. Nothing else exists for it. */
export interface GenerationContext {
  transcript: string;
  sentences: ObservationSetIn["sentences"];
  observations: ObservationIn[];
  selected: SelectedIn | null;
  evidence: OpportunityEvidenceIn;          // guarded/normalized
  decision_type: "coach_one" | "reinforce_only";
  mission_handling: CoachingDecisionIn["reasoning"]["mission_handling"];
  mission_habit_id: string | null;
  coaching_state: CoachingStateName;
}

/** Produces the copy fields of a move. Output is ALWAYS verified afterwards. */
export type CopyGenerator = (ctx: GenerationContext) => Pick<
  CoachingMove,
  "mission_line" | "recognition" | "insight" | "why_it_matters" | "retry_instruction" | "advance_copy"
>;
