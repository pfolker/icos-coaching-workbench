/**
 * Coaching Opportunity Engine — Types
 *
 * Contract:
 *  - Transforms structured observations into CANDIDATE opportunities.
 *  - Does NOT prioritize, rank, select, suppress, or coach.
 *  - Each candidate carries EXACTLY: related habit(s), evidence, confidence,
 *    growth potential, mission alignment, dependencies, readiness.
 *    There are deliberately NO fields for priority, rank, severity, selection,
 *    or coaching copy. Output array order is REGISTRY order, never a ranking.
 *  - Suppression rules (e.g. delivery-polish-while-structure-broken) are a form
 *    of prioritization and therefore live downstream in the Decision Engine;
 *    the `dependencies.upstream_candidates_cofired` field carries the
 *    information it needs to apply them.
 */

// ---- Input: structurally mirrors @icos/observation-engine ObservationSet ----
// (structural typing => real ObservationSet values are directly assignable)

export interface InEvidence {
  sentence_index: number;
  char_start: number;
  char_end: number;
  span_text: string;
}

export interface InObservation {
  observation_type: string;
  value: string | number | boolean;
  evidence: InEvidence[];
  confidence: number;
  confidence_basis: string;
}

export interface InMetrics {
  word_count: number;
  sentence_count: number;
  duration_seconds: number;
  duration_is_estimated: boolean;
  filler_core_count: number;
  filler_soft_count: number;
  filler_per_minute: number;
  hedge_marker_count: number;
  i_count: number;
  we_count: number;
  agency_verb_i_count: number;
  presence_verb_i_count: number;
  quantified_span_count: number;
  numeric_span_count: number;
  hypothetical_marker_count: number;
}

export interface ObservationSetInput {
  schema_version: string;
  sentences: { index: number; text: string; char_start: number; char_end: number; word_count: number }[];
  observations: InObservation[];
  metrics: InMetrics;
}

/** Optional turn context. Absence degrades gracefully (gated detectors skip). */
export interface OpportunityContext {
  /** current session mission's habit id, if a mission exists */
  mission_habit_id?: string;
  /** question type tag from the question bank, if known */
  question_type?: "behavioral" | "opinion" | "motivation" | "situational" | "unknown";
}

export interface OpportunityEngineInput {
  observation_set: ObservationSetInput;
  context?: OpportunityContext;
}

// --------------------------- Output ---------------------------

export type OpportunityId =
  | "O2_structureless_ramble"
  | "O3_missing_result"
  | "O3_unquantified_result"
  | "O4_ownership_hiding"
  | "O5_vagueness"
  | "O7_weak_close"
  | "O8_buried_lede"
  | "O10_filler_density"
  | "O11_employer_negativity";

/** Evidence = verbatim spans copied from observations + metric citations. */
export interface OpportunityEvidence {
  spans: InEvidence[]; // copied verbatim from input observations
  observation_types_cited: string[];
  metrics_cited: { metric: keyof InMetrics; value: number | boolean; comparator: string; reference: number }[];
  /** for absence-based detections: which expected signals were absent */
  absent_signals: string[];
}

export type GrowthPotential = "high" | "medium" | "low";
export type MissionAlignment = "aligned" | "unaligned" | "no_mission";
export type CoachingStateName = "flowing" | "struggling" | "disengaging";

export interface OpportunityDependencies {
  /** static habit-DAG prerequisites of this opportunity's habits */
  habit_prerequisites: string[];
  /** other candidates fired THIS turn whose habits are prerequisites of this one */
  upstream_candidates_cofired: OpportunityId[];
}

export interface OpportunityReadiness {
  /** coaching states in which addressing this opportunity is appropriate (KB passthrough) */
  allowed_states: CoachingStateName[];
}

/** EXACTLY the mandated fields (+id). Nothing else. */
export interface CandidateOpportunity {
  opportunity_id: OpportunityId;
  related_habits: string[];
  evidence: OpportunityEvidence;
  confidence: number; // (0,1]
  growth_potential: GrowthPotential;
  mission_alignment: MissionAlignment;
  dependencies: OpportunityDependencies;
  readiness: OpportunityReadiness;
}
