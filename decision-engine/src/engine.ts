/**
 * Decision Engine — decide().
 * Deterministic. Same input → deep-equal output. No coaching copy anywhere.
 */
import {
  CandidateOpportunity, CoachingDecision, DecisionInput, DecisionReasoning,
  RejectedCandidate,
} from "./types";
import {
  classify, knowledgeCheckFork, PROTECT_PREFERENCE, tiebreak,
} from "./rules";

function validate(input: DecisionInput): void {
  if (!input || !Array.isArray(input.candidates)) {
    throw Object.assign(new Error("candidates array is required"), {
      code: "INPUT_INVALID", module: "decision-engine", retryable: false,
    });
  }
  if (!["flowing", "struggling", "disengaging"].includes(input.coaching_state)) {
    throw Object.assign(new Error("coaching_state must be flowing|struggling|disengaging"), {
      code: "INPUT_INVALID", module: "decision-engine", retryable: false,
    });
  }
}

const reject = (
  c: CandidateOpportunity, rule: string, reason: string
): RejectedCandidate => ({ opportunity_id: c.opportunity_id, rejected_by_rule: rule, reason });

export function decide(input: DecisionInput): CoachingDecision {
  validate(input);
  const { candidates, coaching_state, mission } = input;
  const rejected: RejectedCandidate[] = [];
  const explanation: string[] = [];
  const ja = new Set<string>();

  // ---- 1. State gate (overload precedence sits above everything, JA-06) ----
  const eligible = candidates.filter((c) => {
    if (c.readiness.allowed_states.includes(coaching_state)) return true;
    rejected.push(reject(c, "state_gate",
      `readiness excludes coaching_state=${coaching_state}`));
    return false;
  });
  if (eligible.length < candidates.length) {
    explanation.push(`state gate (${coaching_state}) removed ${candidates.length - eligible.length} candidate(s)`);
  }

  const emptyDecision = (state_gate: DecisionReasoning["state_gate"]): CoachingDecision => {
    ja.add("JA-05"); // protect-the-win posture: reinforce, bank nothing new
    explanation.push("no coachable candidates remain: reinforce-only turn");
    return {
      schema_version: "1.0",
      decision_type: "reinforce_only",
      selected: null,
      reasoning: {
        priority_class_applied: "none",
        state_gate,
        mission_handling: mission ? "mission_fallback" : "no_mission",
        knowledge_check: {
          performed: false, habit_id: null, demonstrated: null,
          pattern_c_applied: false, branch: "n/a", basis: "no candidate selected",
        },
        judgment_case_refs: [...ja].sort(),
        rejected,
        explanation,
      },
    };
  };

  // ---- 2. Disengaging → protect mode (JA-06) ----
  if (coaching_state === "disengaging") {
    ja.add("JA-06");
    explanation.push("coaching_state=disengaging: protect mode — overload precedence over mission and pacing");
    if (eligible.length === 0) return emptyDecision("disengaging_protect");

    const byPreference = PROTECT_PREFERENCE
      .map((id) => eligible.find((c) => c.opportunity_id === id))
      .filter((c): c is CandidateOpportunity => !!c);
    const pick = byPreference[0] ?? tiebreak(eligible);
    for (const c of eligible) if (c !== pick) {
      rejected.push(reject(c, "protect_mode",
        "disengaging state: only the gentlest, most winnable ask is coached"));
    }
    explanation.push(`protect mode selected ${pick.opportunity_id} (gentlest winnable ask)`);
    const fork = knowledgeCheckFork(pick.related_habits[0]!, input.learner_model);
    fork.ja.forEach((x) => ja.add(x));
    return {
      schema_version: "1.0",
      decision_type: "coach_one",
      selected: {
        opportunity: pick,
        // protect mode softens the ask but the fork still governs HOW
        intervention_type: fork.intervention === "I1_direct_instruction"
          ? "I10_confidence_structuring" : fork.intervention,
        priority_class: "protect",
      },
      reasoning: {
        priority_class_applied: "protect",
        state_gate: "disengaging_protect",
        mission_handling: mission
          ? (pick.mission_alignment === "aligned" ? "aligned_selected" : "mission_fallback")
          : "no_mission",
        knowledge_check: fork.check,
        judgment_case_refs: [...ja].sort(),
        rejected,
        explanation,
      },
    };
  }

  if (eligible.length === 0) return emptyDecision("none");

  // ---- 3. Classify: blocking / root_cause / symptom demotion (JA-01) ----
  const classified = eligible.map((c) => ({ c, ...classify(c, eligible) }));

  const blocking = classified.filter((x) => x.cls === "blocking").map((x) => x.c);
  const rootCauses = classified.filter((x) => x.cls === "root_cause").map((x) => x.c);
  const symptoms = classified.filter((x) => x.symptom_of.length > 0);
  const standardPool = classified
    .filter((x) => x.cls !== "blocking" && x.cls !== "root_cause" && x.symptom_of.length === 0)
    .map((x) => x.c);

  let pick: CandidateOpportunity;
  let priority_class: CoachingDecision["reasoning"]["priority_class_applied"];

  if (blocking.length > 0) {
    ja.add("JA-01");
    pick = tiebreak(blocking);
    priority_class = "blocking";
    explanation.push(`blocking candidate present: ${pick.opportunity_id} — nothing else is coachable on a wrong answer`);
    for (const c of eligible) if (c !== pick) {
      rejected.push(reject(c, "blocking_override", `blocked behind ${pick.opportunity_id}`));
    }
  } else if (rootCauses.length > 0) {
    ja.add("JA-01");
    pick = tiebreak(rootCauses);
    priority_class = "root_cause";
    explanation.push(`root-cause override: ${pick.opportunity_id} is upstream of co-fired candidates — coaching symptoms while the cause stands produces truncated fixes`);
    for (const s of symptoms) {
      rejected.push(reject(s.c, "root_cause_override",
        `symptom this turn: cause(s) ${s.symptom_of.join(", ")} co-fired (JA-01)`));
    }
    for (const c of [...rootCauses, ...standardPool]) if (c !== pick) {
      rejected.push(reject(c, "one_insight_rule", "one coaching moment per turn; outranked in tiebreak"));
    }
  } else {
    // ---- 4. Mission handling within the standard pool (JA-07) ----
    // Symptoms with a co-fired cause were already excluded from standardPool
    // construction only when the cause fired; if ALL remaining are symptoms of
    // rejected-by-state causes, fall back to them rather than coach nothing:
    const pool = standardPool.length > 0 ? standardPool : symptoms.map((s) => s.c);
    if (pool.length === 0) return emptyDecision("none");
    if (standardPool.length === 0 && symptoms.length > 0) {
      explanation.push("only symptom candidates remain (their causes were state-gated out); coaching the best available");
    }
    const alignedPool = pool.filter((c) => c.mission_alignment === "aligned");
    if (mission && alignedPool.length === 0 && pool.length > 0) {
      ja.add("JA-07");
      explanation.push("mission fallback: no candidate serves the mission on this answer — the mission biases selection, it never fabricates relevance");
    }
    pick = tiebreak(alignedPool.length > 0 ? alignedPool : pool);
    priority_class = alignedPool.length > 0 && mission ? "mission_aligned"
      : classify(pick, eligible).cls === "quick_win" ? "quick_win" : "standard";
    for (const c of pool) if (c !== pick) {
      rejected.push(reject(c, "one_insight_rule", "one coaching moment per turn; outranked in tiebreak"));
    }
  }

  // ---- 5. Struggling soften note (ambition drops one level; ask stays honest) ----
  const state_gate: DecisionReasoning["state_gate"] =
    coaching_state === "struggling" ? "struggling_soften" : "none";
  if (state_gate === "struggling_soften") {
    ja.add("JA-06");
    explanation.push("struggling state: selection stands, ask is softened one ambition level (smaller target, warmer framing directive for downstream)");
  }

  // ---- 6. Knowledge-check fork selects the intervention TYPE (JA-02/03/04) ----
  const habit = pick.related_habits[0]!;
  const fork = knowledgeCheckFork(habit, input.learner_model);
  fork.ja.forEach((x) => ja.add(x));
  explanation.push(`intervention fork on ${habit}: ${fork.check.branch} → ${fork.intervention}`);

  const mission_handling: DecisionReasoning["mission_handling"] = !mission
    ? "no_mission"
    : pick.mission_alignment === "aligned" ? "aligned_selected" : "mission_fallback";

  return {
    schema_version: "1.0",
    decision_type: "coach_one",
    selected: { opportunity: pick, intervention_type: fork.intervention, priority_class },
    reasoning: {
      priority_class_applied: priority_class,
      state_gate,
      mission_handling,
      knowledge_check: fork.check,
      judgment_case_refs: [...ja].sort(),
      rejected,
      explanation,
    },
  };
}
