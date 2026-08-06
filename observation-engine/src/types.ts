/**
 * Observation Engine — Types
 *
 * Contract (Blueprint v1.0 / ICOS):
 *  - Observations are MEASUREMENTS and DETECTIONS of observable behavior.
 *  - There are deliberately NO fields for: coaching copy, priority, ranking,
 *    opportunity ids, severity, or recommendations. If you need one of those,
 *    you are in the wrong module (Opportunity Engine / Decision Engine).
 *  - Every observation carries evidence (verbatim spans) and confidence.
 */

export interface Sentence {
  index: number;
  text: string;        // trimmed; MUST equal transcript.slice(char_start, char_end)
  char_start: number;  // offset of trimmed text in original transcript
  char_end: number;
  word_count: number;
}

export interface Evidence {
  sentence_index: number;
  char_start: number;  // absolute offsets into the ORIGINAL transcript
  char_end: number;
  span_text: string;   // MUST equal transcript.slice(char_start, char_end)
}

export type ObservationType =
  // delivery
  | "filler_core"            // um, uh, erm, you know, i mean
  | "filler_soft"            // like, kind of, sort of (ambiguous class)
  | "hedge_marker"           // mid-answer hedging (i guess, maybe, probably...)
  | "closing_hedge"          // final sentence ends on a hedge/permission-seek
  | "trailing_off"           // final fragment, no terminal punctuation, short
  // language of agency
  | "first_person_singular"  // I / my / me
  | "first_person_plural"    // we / our / us
  | "agency_verb_i"          // "I decided/built/led..."
  | "presence_verb_i"        // "I helped/was involved..."
  // content signals
  | "quantified_span"        // %, $, units, from-X-to-Y
  | "numeric_span"           // bare numbers (lower confidence; years excluded)
  | "hypothetical_marker"    // "I would typically..." on a behavioral answer
  | "employer_negativity"    // negative lexicon co-occurring with employer terms
  // structural signals (keyword heuristics — LOW confidence by design;
  // the LLM Listen stage owns authoritative STAR mapping)
  | "structure_situation_marker"
  | "structure_task_marker"
  | "structure_action_marker"
  | "structure_result_marker"
  | "result_in_final_sentence";

export interface Observation {
  observation_type: ObservationType;
  /** raw measured value where meaningful (count for aggregates handled in metrics) */
  value: string | number | boolean;
  evidence: Evidence[];        // non-empty for every detection
  confidence: number;          // (0, 1]
  confidence_basis: string;    // how the number was derived (auditable)
}

/** Aggregate measurements. Raw numbers only — thresholds live downstream. */
export interface ObservationMetrics {
  word_count: number;
  sentence_count: number;
  duration_seconds: number;         // provided, or estimated
  duration_is_estimated: boolean;   // true => estimated at DEFAULT_WPM
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

export interface ObservationInput {
  transcript: string;
  /** measured answer duration if the client has it; otherwise estimated */
  duration_seconds?: number;
}

export interface ObservationSet {
  schema_version: "1.0";
  producer: { module: "observation-engine"; version: string };
  transcript_sha256: string;
  sentences: Sentence[];
  observations: Observation[];
  metrics: ObservationMetrics;
}

export const ENGINE_VERSION = "1.0.0";
export const DEFAULT_WPM = 150; // spoken-word estimate when duration not provided
