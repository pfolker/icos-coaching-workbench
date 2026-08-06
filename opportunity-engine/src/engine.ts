/**
 * Opportunity Engine — assembly.
 * observations in → candidate opportunities out. Registry order. No ranking.
 */
import {
  CandidateOpportunity, OpportunityEngineInput, OpportunityId,
} from "./types";
import { DEFAULT_CONFIG, DetectorConfig, HABIT_DAG, REGISTRY } from "./registry";
import {
  Detection, detectBuriedLede, detectEmployerNegativity, detectFillerDensity,
  detectMissingResult, detectOwnershipHiding, detectRamble, detectUnquantifiedResult,
  detectVagueness, detectWeakClose,
} from "./detectors";

function prerequisitesOf(habits: string[]): string[] {
  const out = new Set<string>();
  const walk = (h: string) => {
    for (const dep of HABIT_DAG[h] ?? []) {
      if (!out.has(dep)) { out.add(dep); walk(dep); }
    }
  };
  habits.forEach(walk);
  habits.forEach((h) => out.delete(h)); // own habits are not their own prerequisites
  return [...out].sort();
}

export function generateOpportunities(
  input: OpportunityEngineInput,
  config: DetectorConfig = DEFAULT_CONFIG
): CandidateOpportunity[] {
  const set = input?.observation_set;
  if (!set || !Array.isArray(set.observations) || !set.metrics || !Array.isArray(set.sentences)) {
    throw Object.assign(new Error("observation_set with observations, metrics, sentences is required"), {
      code: "INPUT_INVALID", module: "opportunity-engine", retryable: false,
    });
  }
  const ctx = input.context;

  // Run every detector; keyed by id. Detector execution order is irrelevant —
  // output order comes from the REGISTRY (catalog order, not a ranking).
  const detections = new Map<OpportunityId, Detection>();
  const add = (d: Detection | null) => { if (d) detections.set(d.opportunity_id, d); };
  add(detectRamble(set, config));
  add(detectMissingResult(set));
  add(detectUnquantifiedResult(set));
  add(detectOwnershipHiding(set, config, ctx));
  add(detectVagueness(set, config, ctx));
  add(detectWeakClose(set));
  add(detectBuriedLede(set, config, ctx));
  add(detectFillerDensity(set, config));
  add(detectEmployerNegativity(set));

  // habit → fired candidate ids (for upstream co-firing computation)
  const firedByHabit = new Map<string, OpportunityId[]>();
  for (const entry of REGISTRY) {
    if (!detections.has(entry.opportunity_id)) continue;
    for (const h of entry.related_habits) {
      firedByHabit.set(h, [...(firedByHabit.get(h) ?? []), entry.opportunity_id]);
    }
  }

  const out: CandidateOpportunity[] = [];
  for (const entry of REGISTRY) {
    const d = detections.get(entry.opportunity_id);
    if (!d) continue;

    const habit_prerequisites = prerequisitesOf(entry.related_habits);
    const upstream = new Set<OpportunityId>();
    for (const prereq of habit_prerequisites) {
      for (const id of firedByHabit.get(prereq) ?? []) {
        if (id === entry.opportunity_id) continue;
        // ANTISYMMETRY GUARD: "upstream" means STRICTLY upstream. If the
        // relationship is mutual (each candidate's habits sit in the other's
        // prerequisite closure — possible when a candidate spans DAG levels,
        // e.g. O3_missing_result relating H2+H5), neither is upstream of the
        // other and the edge cancels. Prevents mutual-demotion deadlocks in
        // downstream root-cause classification.
        const other = REGISTRY.find((r) => r.opportunity_id === id)!;
        const otherPrereqs = prerequisitesOf(other.related_habits);
        const mutual = entry.related_habits.some((h) => otherPrereqs.includes(h));
        if (!mutual) upstream.add(id);
      }
    }

    out.push({
      opportunity_id: entry.opportunity_id,
      related_habits: [...entry.related_habits],
      evidence: d.evidence,
      confidence: d.confidence,
      growth_potential: entry.growth_potential,
      mission_alignment: !ctx?.mission_habit_id
        ? "no_mission"
        : entry.related_habits.includes(ctx.mission_habit_id) ? "aligned" : "unaligned",
      dependencies: {
        habit_prerequisites,
        upstream_candidates_cofired: [...upstream].sort(),
      },
      readiness: { allowed_states: [...entry.allowed_states] },
    });
  }
  return out;
}
