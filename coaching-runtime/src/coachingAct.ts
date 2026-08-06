/**
 * Coaching Act — Coaching Admissibility Design Note v0.3, Section 2.
 * { type, evidence_refs, message } — message is null until the Narrator
 * (the one LLM call in this package) fills it in.
 */
import { TeachingMoveResult } from "./teachingMove";

export interface CoachingAct {
  type: TeachingMoveResult["type"];
  evidence_refs: string[];
  message: string | null;
}

export function assembleCoachingAct(move: TeachingMoveResult): CoachingAct {
  return {
    type: move.type,
    evidence_refs: move.anchor_claim_ids,
    message: null,
  };
}
