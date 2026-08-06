/**
 * Registry — static Knowledge Base metadata (KB v1.0 Parts 1–2), data not logic.
 * Registry ORDER is the output order. It is a catalog order, not a ranking.
 */
import { CoachingStateName, GrowthPotential, OpportunityId } from "./types";

/** Habit dependency DAG (KB Part 1). */
export const HABIT_DAG: Record<string, string[]> = {
  H1: [],
  H2: ["H1"],
  H3: ["H2"],
  H4: ["H2"],
  H5: ["H2", "H4"],
  H6: ["H5"],
  H7: ["H2"],
  H8: ["H1"],
  H9: ["H2", "H8"],
  H10: ["H2", "H7"],
  H11: ["H4", "H6"],
  H12: ["H2", "H3"],
};

export interface RegistryEntry {
  opportunity_id: OpportunityId;
  related_habits: string[];
  growth_potential: GrowthPotential;
  allowed_states: CoachingStateName[];
}

export const REGISTRY: RegistryEntry[] = [
  { opportunity_id: "O2_structureless_ramble", related_habits: ["H2"],
    growth_potential: "high", allowed_states: ["flowing", "struggling", "disengaging"] },
  { opportunity_id: "O3_missing_result", related_habits: ["H2", "H5"],
    growth_potential: "high", allowed_states: ["flowing", "struggling", "disengaging"] },
  { opportunity_id: "O3_unquantified_result", related_habits: ["H5"],
    growth_potential: "high", allowed_states: ["flowing", "struggling", "disengaging"] },
  { opportunity_id: "O4_ownership_hiding", related_habits: ["H3"],
    growth_potential: "high", allowed_states: ["flowing", "struggling"] },
  { opportunity_id: "O5_vagueness", related_habits: ["H4"],
    growth_potential: "high", allowed_states: ["flowing", "struggling", "disengaging"] },
  { opportunity_id: "O7_weak_close", related_habits: ["H9"],
    growth_potential: "low", allowed_states: ["flowing", "struggling", "disengaging"] },
  { opportunity_id: "O8_buried_lede", related_habits: ["H8"],
    growth_potential: "medium", allowed_states: ["flowing", "struggling"] },
  { opportunity_id: "O10_filler_density", related_habits: ["H10"],
    growth_potential: "low", allowed_states: ["flowing"] },
  { opportunity_id: "O11_employer_negativity", related_habits: ["H12"],
    growth_potential: "high", allowed_states: ["flowing", "struggling"] },
];

/**
 * Detector thresholds — [FH] tunable values (Blueprint §0.2). Injectable;
 * defaults mirror KB guidance. Thresholds are detection references, not
 * judgments: they decide whether a candidate EXISTS, never its rank.
 */
export interface DetectorConfig {
  ramble_min_words: number;            // ~1.7 min of speech
  ramble_max_structure_marker_types: number; // fire when fewer types observed
  ownership_min_we: number;
  ownership_max_i_to_we_ratio: number;
  ownership_zero_agency_min_words: number;
  vagueness_min_words: number;
  vagueness_min_hypotheticals_boost: number;
  vagueness_zero_specificity_min_words: number;
  lede_min_words: number;
  filler_per_minute_threshold: number;
  estimated_duration_confidence_penalty: number; // multiplier when duration estimated
}

export const DEFAULT_CONFIG: DetectorConfig = {
  ramble_min_words: 260,
  ramble_max_structure_marker_types: 2,
  ownership_min_we: 3,
  ownership_max_i_to_we_ratio: 0.5,
  // V3.5: floor for the zero-agency O4 path (i_count===0 && we_count===0).
  // Below this there isn't enough content to judge "no agency language
  // anywhere" as meaningful rather than a fluke of brevity. ~20 words is
  // roughly two short clauses — enough room for the minimal situation+result
  // arc a real behavioral answer needs, in which agency language could have
  // appeared and didn't. The confirmed regression fixture (29 words) clears
  // this with margin; a one-line fragment (~8-10 words) does not.
  ownership_zero_agency_min_words: 20,
  vagueness_min_words: 60,
  vagueness_min_hypotheticals_boost: 2,
  // V3.5: floor for the zero-specificity O5 path (below the 60-word floor
  // above). Below this there isn't enough content to judge "zero concrete
  // specificity" as meaningful either. ~15 words is roughly one complete
  // sentence — enough room to have named a tool, action, metric, or
  // timeframe if the answer had one. Deliberately lower than
  // ownership_zero_agency_min_words: a specificity signal (a number, a named
  // action verb) can appear inside a single short clause, so less runway is
  // needed to judge its absence than to judge a full situation+result arc's
  // absence of agency language.
  vagueness_zero_specificity_min_words: 15,
  lede_min_words: 80,
  filler_per_minute_threshold: 6,
  estimated_duration_confidence_penalty: 0.75,
};
