/**
 * Deterministic coach adapter — the FIVE FROZEN ENGINES, one turn.
 *
 * Replicates exactly the single-answer composition the Alpha Workbench
 * orchestrator does (observe → generateOpportunities → decide →
 * generateCoachingMove), minus the session state machine. Calls the frozen
 * engines unmodified; adds no logic of its own. This is the "deterministic
 * coach" the structured coach is calibrated against.
 */
import { observe } from "../../observation-engine/src/index";
import { generateOpportunities } from "../../opportunity-engine/src/index";
import { decide } from "../../decision-engine/src/index";
import { generateCoachingMove } from "../../conversation-engine/src/index";
import { QUESTIONS } from "../../alpha-workbench/server/questions";

/** A neutral, valid question type (calibration runs single answers, not a scripted session). */
const NEUTRAL_QUESTION_TYPE = QUESTIONS[0]!.type;

export interface DeterministicCoachResult {
  /** the learner-facing coaching text, assembled from the move's copy blocks */
  coaching_text: string;
  selected_opportunity: string | null;
  intervention_type: string | null;
  decision_type: "coach_one" | "reinforce_only";
  degraded: boolean;
  observation_count: number;
  candidate_ids: string[];
}

export function runDeterministicCoach(transcript: string): DeterministicCoachResult {
  const observations = observe({ transcript });
  const candidates = generateOpportunities({
    observation_set: observations,
    context: { question_type: NEUTRAL_QUESTION_TYPE },
  });
  const decision = decide({
    candidates,
    coaching_state: "flowing",
    mission: null,
    learner_model: { habits: {} },
  });
  const move = generateCoachingMove({
    decision, observation_set: observations, transcript,
    coaching_state: "flowing", mission: null,
  });

  const parts = [
    move.mission_line,
    move.recognition?.copy,
    move.insight?.copy,
    move.why_it_matters?.copy,
    move.retry_instruction?.copy,
    move.advance_copy,
  ].filter((s): s is string => typeof s === "string" && s.trim().length > 0);

  return {
    coaching_text: parts.join(" "),
    selected_opportunity: move.refs.opportunity_id,
    intervention_type: move.refs.intervention_type,
    decision_type: move.move_type,
    degraded: move.verification.degraded,
    observation_count: observations.observations.length,
    candidate_ids: candidates.map((c) => c.opportunity_id),
  };
}
