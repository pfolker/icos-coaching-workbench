/**
 * THE FULL COACHING LOOP — five packages, zero adapters:
 *   V1 transcript → observe → opportunities → decide → coaching move
 *   V2 transcript → observe → compareRetry (mission-anchored verdict)
 * This is ADR-001's "the retry is the product" running end to end.
 */
import { describe, it, expect } from "vitest";
import { observe } from "../../observation-engine/src/index";
import { generateOpportunities } from "../../opportunity-engine/src/index";
import { decide } from "../../decision-engine/src/index";
import { generateCoachingMove } from "../../conversation-engine/src/index";
import { compareRetry } from "../src/engine";
import { OPP_META } from "../src/registry";

// V3.5 note: adjusted from the original all-"we", zero-"I" wording — that
// version also now fires O5_vagueness (V3.5's zero-specificity path, since
// it has no quantified/numeric span, no structure_action_marker, no
// agency_verb_i and is 37 words, within the new path's range), and O5's
// habit (H4) is upstream of O3_unquantified_result's habit (H5) in the
// habit DAG, so it gets promoted to root_cause and outranks O3 for
// selection. This test is about the mission-anchored retry/comparison loop
// for O3/H5 specifically, which V3.5 does not touch, so the fixture adds a
// short first-person clause ("So I fixed it") to keep exercising exactly
// that path instead of re-deriving this test around a different selection.
const V1 =
  "We had a scrap problem on the second op and the castings kept warping on us. " +
  "So I fixed it, and as a result things eventually got under control and everyone was glad. So yeah";

const V2 =
  "We had a scrap problem on the second op and the castings kept warping on us. " +
  "I redesigned the clamping, and as a result scrap went from 8% to 2% for the rest of the run.";

describe("FULL LOOP: answer → coaching → retry → comparison", () => {
  it("runs the complete loop and produces a verified, mission-anchored comparison", () => {
    const mission = { habit_id: "H5" };
    const learner = { habits: { H5: { demonstrated: true, coached_count: 1, verdicts: ["achieved" as const] } } };

    // ---- turn 1: answer → coaching ----
    const obs1 = observe({ transcript: V1, duration_seconds: 45 });
    const candidates = generateOpportunities({
      observation_set: obs1,
      context: { question_type: "behavioral", mission_habit_id: mission.habit_id },
    });
    const decision = decide({ candidates, coaching_state: "flowing", mission, learner_model: learner });
    const move = generateCoachingMove({
      decision, observation_set: obs1, transcript: V1, coaching_state: "flowing", mission,
    });
    expect(decision.selected!.opportunity.opportunity_id).toBe("O3_unquantified_result");
    expect(move.verification.passed).toBe(true);

    // ---- turn 2: retry → comparison ----
    const obs2 = observe({ transcript: V2, duration_seconds: 30 });
    const comparison = compareRetry({
      original_transcript: V1,
      retry_transcript: V2,
      original_observation_set: obs1,
      retry_observation_set: obs2,
      decision,
      coaching_move: move,
      mission,
    });

    // mission-anchored verdict on the coached dimension only
    expect(comparison.verdict).toBe("achieved");
    expect(comparison.coached_habit).toBe("H5");
    expect(comparison.selected_opportunity_id).toBe("O3_unquantified_result");
    expect(comparison.reinforcement.copy).toContain("8% to 2%");
    expect(comparison.verification.passed).toBe(true);
    expect(comparison.verification.degraded).toBe(false);

    // quotes grounded in the RETRY transcript, end to end
    for (const s of comparison.reinforcement.quoted_spans) {
      const t = s.source === "retry" ? V2 : V1;
      expect(t.slice(s.char_start, s.char_end)).toBe(s.span_text);
    }

    // the retry ALSO fixed the weak close organically; and it introduced no
    // banked O3 regression. Whatever was banked, none of it reached the copy:
    const copy = comparison.reinforcement.copy.toLowerCase();
    for (const b of comparison.banked_flaws) {
      const sig = OPP_META[b.opportunity_id]?.signature;
      if (sig) expect(copy).not.toContain(sig.toLowerCase());
    }
    // and no rejected opportunity's coaching appears either
    for (const r of decision.reasoning.rejected) {
      const sig = OPP_META[r.opportunity_id]?.signature;
      if (sig) expect(copy).not.toContain(sig.toLowerCase());
    }
  });

  it("the loop is deterministic end to end", () => {
    const run = () => {
      const obs1 = observe({ transcript: V1, duration_seconds: 45 });
      const candidates = generateOpportunities({
        observation_set: obs1, context: { question_type: "behavioral" },
      });
      const decision = decide({ candidates, coaching_state: "flowing" });
      const move = generateCoachingMove({
        decision, observation_set: obs1, transcript: V1, coaching_state: "flowing",
      });
      const obs2 = observe({ transcript: V2, duration_seconds: 30 });
      return compareRetry({
        original_transcript: V1, retry_transcript: V2,
        original_observation_set: obs1, retry_observation_set: obs2,
        decision, coaching_move: move,
      });
    };
    expect(run()).toEqual(run());
  });
});
