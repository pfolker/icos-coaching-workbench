/**
 * Rules — the codified judgment. Every rule cites its Judgment Atlas case.
 * Priority function (Blueprint §4 / Judgment §3):
 *   blocking > root_cause > mission_aligned > standard(growth) > quick_win,
 *   all gated by coaching state (overload precedence, JA-06).
 */
import {
  CandidateOpportunity, CoachingStateName, InterventionType, KnowledgeCheck,
  LearnerModel, PriorityClass,
} from "./types";

/** Opportunity ids classified as BLOCKING (KB O1 family — nothing else is
 *  coachable on a wrong answer). None are producible by the deterministic
 *  Opportunity Engine yet; the class exists for the LLM-evidence path. */
export const BLOCKING_IDS = new Set<string>(["O1_off_target_answer"]);

/** Designated quick-win ids (KB: most visible V1→V2 delta). */
export const QUICK_WIN_IDS = new Set<string>(["O7_weak_close"]);

/** Habits whose recurrence signals a belief blocker (KB ⚑ set → I7, JA-04). */
export const BELIEF_BLOCKED_HABITS = new Set<string>(["H3", "H10", "H12"]);

/** Protect-mode preference (JA-06): gentlest, most winnable asks first. */
export const PROTECT_PREFERENCE: string[] = [
  "O7_weak_close", "O5_vagueness", "O3_unquantified_result",
];

const GROWTH_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

/**
 * Runtime priority classification.
 * root_cause is DYNAMIC, computed from co-firing (JA-01): a candidate is a
 * root cause when its own upstream is clear AND at least one other fired
 * candidate lists it upstream. A candidate whose upstream co-fired is a
 * SYMPTOM this turn and is demoted behind its cause.
 */
export function classify(
  c: CandidateOpportunity,
  all: CandidateOpportunity[]
): { cls: PriorityClass; symptom_of: string[] } {
  if (BLOCKING_IDS.has(c.opportunity_id)) return { cls: "blocking", symptom_of: [] };
  const symptom_of = c.dependencies.upstream_candidates_cofired.filter((id) =>
    all.some((x) => x.opportunity_id === id)
  );
  const citedAsUpstream = all.some(
    (x) => x !== c && x.dependencies.upstream_candidates_cofired.includes(c.opportunity_id)
  );
  if (symptom_of.length === 0 && citedAsUpstream) return { cls: "root_cause", symptom_of };
  if (QUICK_WIN_IDS.has(c.opportunity_id)) return { cls: "quick_win", symptom_of };
  return { cls: "standard", symptom_of };
}

/**
 * Deterministic tiebreak chain within a pool (documented order, JA §3):
 *   1. mission-aligned first
 *   2. growth_potential (high > medium > low)
 *   3. quick-win designation (most visible improvement)
 *   4. confidence (desc)
 *   5. input order (registry/catalog order — final stable fallback)
 */
export function tiebreak(pool: CandidateOpportunity[]): CandidateOpportunity {
  return pool.reduce((best, c) => {
    if (c === best) return best;
    const aligned = (x: CandidateOpportunity) => (x.mission_alignment === "aligned" ? 1 : 0);
    if (aligned(c) !== aligned(best)) return aligned(c) > aligned(best) ? c : best;
    const g = (x: CandidateOpportunity) => GROWTH_RANK[x.growth_potential] ?? 0;
    if (g(c) !== g(best)) return g(c) > g(best) ? c : best;
    const q = (x: CandidateOpportunity) => (QUICK_WIN_IDS.has(x.opportunity_id) ? 1 : 0);
    if (q(c) !== q(best)) return q(c) > q(best) ? c : best;
    if (c.confidence !== best.confidence) return c.confidence > best.confidence ? c : best;
    return best; // input order: earlier wins
  }, pool[0]!);
}

/**
 * Knowledge-check fork (JA-02/03) + Pattern-C escalation (JA-04).
 *   pattern_c on a belief-blocked habit → I7 reframe (never a third I1)
 *   demonstrated before → I3 elicit (prompts beat corrections when knowledge exists)
 *   otherwise / no model → I1 supply (conservative default, JA-02)
 */
export function knowledgeCheckFork(
  habit_id: string,
  model: LearnerModel | null | undefined
): { intervention: InterventionType; check: KnowledgeCheck; ja: string[] } {
  const rec = model?.habits?.[habit_id];
  if (rec?.pattern_c_flag && BELIEF_BLOCKED_HABITS.has(habit_id)) {
    return {
      intervention: "I7_reframe",
      ja: ["JA-04"],
      check: {
        performed: true, habit_id, demonstrated: rec.demonstrated,
        pattern_c_applied: true, branch: "reframe",
        basis: `pattern_c_flag on belief-blocked habit ${habit_id}: prior instruction produced compliance without retention; repeating a failed intervention is the canonical error`,
      },
    };
  }
  if (rec?.demonstrated) {
    return {
      intervention: "I3_elicitation",
      ja: ["JA-03"],
      check: {
        performed: true, habit_id, demonstrated: true,
        pattern_c_applied: false, branch: "elicit",
        basis: `learner has demonstrated ${habit_id} before; prompts produce stronger uptake than supplied corrections when the knowledge exists`,
      },
    };
  }
  return {
    intervention: "I1_direct_instruction",
    ja: ["JA-02"],
    check: {
      performed: model?.habits ? true : false,
      habit_id,
      demonstrated: rec ? false : null,
      pattern_c_applied: false, branch: "supply",
      basis: rec
        ? `no demonstrated ${habit_id} in learner history; prompting a true knowledge gap yields frustration — teach and model`
        : "learner model absent or habit unknown; conservative supply-branch default",
    },
  };
}
