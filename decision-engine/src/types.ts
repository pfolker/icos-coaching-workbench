/**
 * Coaching Decision Engine — Types
 *
 * Contract:
 *  - Selects EXACTLY ONE candidate opportunity (or an explicit reinforce-only
 *    decision when nothing coachable exists).
 *  - Chooses the intervention TYPE via the knowledge-check fork (JA-02/03) and
 *    Pattern-C escalation (JA-04). Type selection is decision, not generation:
 *    there are NO fields for coaching copy anywhere in the output.
 *  - The reasoning trace is MANDATORY and COMPLETE: every candidate that fired
 *    but was not selected appears in `rejected` with the rule that rejected it.
 *    "Why did the coach do that?" must be answerable from this one artifact.
 */

// ---- Inputs (structurally mirror @icos/opportunity-engine output) ----

export type CoachingStateName = "flowing" | "struggling" | "disengaging";
export type MissionAlignment = "aligned" | "unaligned" | "no_mission";
export type GrowthPotential = "high" | "medium" | "low";

export interface CandidateOpportunity {
  opportunity_id: string;
  related_habits: string[];
  evidence: unknown; // passed through untouched; the Decision Engine never edits evidence
  confidence: number;
  growth_potential: GrowthPotential;
  mission_alignment: MissionAlignment;
  dependencies: {
    habit_prerequisites: string[];
    upstream_candidates_cofired: string[];
  };
  readiness: { allowed_states: CoachingStateName[] };
}

export interface LearnerHabitRecord {
  demonstrated: boolean;
  coached_count: number;
  /** comparison verdicts history for this habit, most recent last */
  verdicts: ("achieved" | "partial" | "not_yet")[];
  /** Pattern-C signal: instruction produced compliant retries but cross-session reversion */
  pattern_c_flag?: boolean;
}

export interface LearnerModel {
  habits: Record<string, LearnerHabitRecord>;
}

export interface Mission {
  habit_id: string;
}

export interface DecisionInput {
  candidates: CandidateOpportunity[];
  learner_model?: LearnerModel | null; // absent → conservative supply branch (JA-02)
  mission?: Mission | null;
  coaching_state: CoachingStateName;
}

// ---- Output ----

/** Intervention TYPES from the Intervention Library (selection keys, not copy). */
export type InterventionType =
  | "I1_direct_instruction"
  | "I2_modeling"
  | "I3_elicitation"
  | "I7_reframe"
  | "I10_confidence_structuring";

export type PriorityClass =
  | "blocking"
  | "root_cause"
  | "mission_aligned"
  | "standard"
  | "quick_win"
  | "protect";

export interface RejectedCandidate {
  opportunity_id: string;
  rejected_by_rule: string; // machine-readable rule id
  reason: string;           // human-readable, about the DECISION (never coaching copy)
}

export interface SelectedOpportunity {
  /** full candidate passthrough — evidence untouched */
  opportunity: CandidateOpportunity;
  intervention_type: InterventionType;
  priority_class: PriorityClass;
}

export interface KnowledgeCheck {
  performed: boolean;
  habit_id: string | null;
  demonstrated: boolean | null;
  pattern_c_applied: boolean;
  branch: "elicit" | "supply" | "reframe" | "n/a";
  basis: string;
}

export interface DecisionReasoning {
  priority_class_applied: PriorityClass | "none";
  state_gate: "none" | "struggling_soften" | "disengaging_protect";
  mission_handling: "aligned_selected" | "mission_fallback" | "no_mission" | "n/a";
  knowledge_check: KnowledgeCheck;
  judgment_case_refs: string[]; // JA-xx ids that governed this decision
  rejected: RejectedCandidate[];
  explanation: string[]; // ordered narrative of the decision, step by step
}

export interface CoachingDecision {
  schema_version: "1.0";
  decision_type: "coach_one" | "reinforce_only";
  selected: SelectedOpportunity | null; // null iff reinforce_only
  reasoning: DecisionReasoning;
}
