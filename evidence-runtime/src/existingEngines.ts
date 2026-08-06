/**
 * Stages 5-8: the EXISTING, UNTOUCHED ICOS engines, run on the SAME raw
 * transcript as Stages 1-4, computed entirely independently, for side-by-
 * side comparison only.
 *
 * This is explicitly NOT an adapter. Nothing here reads the Validated
 * Evidence Graph (Stage 4's output); these four calls would run identically
 * if Stages 1-4 did not exist at all. Every import below is the real,
 * unmodified package used by the Alpha Workbench today — same imports
 * alpha-workbench/server/orchestrator.ts uses, same call shapes.
 */
import { observe } from "../../observation-engine/src/index";
import { generateOpportunities } from "../../opportunity-engine/src/index";
import { decide } from "../../decision-engine/src/index";
import { generateCoachingMove } from "../../conversation-engine/src/index";
import type { ObservationSet } from "../../observation-engine/src/index";
import type { CandidateOpportunity } from "../../opportunity-engine/src/index";
import type { CoachingDecision } from "../../decision-engine/src/index";
import type { CoachingMove } from "../../conversation-engine/src/index";

export interface ExistingEnginesOutput {
  observation_set: ObservationSet;
  candidates: CandidateOpportunity[];
  decision: CoachingDecision;
  move: CoachingMove;
}

/**
 * Fresh-state run: no mission, no learner history, "flowing" coaching state,
 * question_type "behavioral" (every required Atlas case is a behavioral
 * interview answer). This mirrors how alpha-workbench's orchestrator calls
 * these same four engines on a first answer with no prior context.
 */
export function runExistingEngines(transcript: string): ExistingEnginesOutput {
  const observation_set = observe({ transcript });
  const candidates = generateOpportunities({
    observation_set,
    context: { question_type: "behavioral" },
  });
  const decision = decide({
    candidates,
    coaching_state: "flowing",
    mission: null,
    learner_model: { habits: {} },
  });
  const move = generateCoachingMove({
    decision,
    observation_set,
    transcript,
    coaching_state: "flowing",
    mission: null,
  });
  return { observation_set, candidates, decision, move };
}
