import { describe, it, expect } from "vitest";
import { advance, createSession, debugView, publicView, submitAnswer, submitRetry } from "../server/orchestrator";

// V3.5 note: this fixture is deliberately NOT the zero-agency/zero-specificity
// regression fixture from the coverage audit (same opening sentence, but with
// "So I fixed it" added) — this test exercises the retry/mission-carry/
// knowledge-check-fork mechanics via O3_unquantified_result/H5, which the V3.5
// detector patch does not touch. The original zero-pronoun wording now also
// fires O4_ownership_hiding and O5_vagueness on a behavioral question (see
// opportunity-engine/test/v3.5-detector-patch.test.ts for that fixture and
// its own dedicated coverage); using it here would change which opportunity
// gets selected and require re-deriving this entire test's downstream trace
// for a concern this test was never meant to exercise.
const VAGUE_RESULT =
  "The second op had a scrap problem and the castings kept warping. " +
  "So I fixed it, and as a result things eventually got under control and everyone was glad. So yeah";

const QUANTIFIED_RETRY =
  "We had a scrap problem on the second op and the castings kept warping on us. " +
  "I redesigned the clamping, and as a result scrap went from 8% to 2% for the rest of the run.";

const STRONG_ANSWER =
  "At the time, we had an 8% scrap rate on the second op. My job was to fix the fixturing. " +
  "So I redesigned the clamping and I proposed a new op sequence. " +
  "As a result, scrap went from 8% to 2%, saving about $40,000 a year.";

describe("Alpha Workbench: one complete session, every engine in sequence", () => {
  it("runs answer → coach → retry → compare → advance across all questions to summary", () => {
    const s = createSession();
    expect(s.state).toBe("AWAITING_ANSWER");

    // ---- Q1: vague answer, coached, successful retry ----
    let r = submitAnswer(s.id, VAGUE_RESULT, 45);
    expect(r.session.state).toBe("COACHED");
    expect(r.session.move!.insight).not.toBeNull();
    expect(r.debug.selected!.opportunity.opportunity_id).toBe("O3_unquantified_result");
    expect(r.debug.decision_reasoning!.rejected.length).toBeGreaterThan(0);

    r = submitRetry(s.id, QUANTIFIED_RETRY, 30);
    expect(r.session.state).toBe("COMPARED");
    expect(r.debug.comparison_internal!.verdict).toBe("achieved"); // verdict is debug-only; the learner's pick is the verdict moment
    // learner model fed for the knowledge-check fork:
    expect(r.debug.learner_model.habits.H5!.demonstrated).toBe(true);

    r = advance(s.id);
    expect(r.session.state).toBe("AWAITING_ANSWER");
    expect(r.session.question_number).toBe(2);
    expect(r.session.mission_line).toBeNull(); // achieved → fresh start

    // ---- Q2: strong answer → reinforce_only, advance without retry ----
    r = submitAnswer(s.id, STRONG_ANSWER, 30);
    expect(r.session.state).toBe("COACHED");
    expect(r.session.move!.move_type).toBe("reinforce_only");
    expect(() => submitRetry(s.id, "anything", 10)).toThrowError(/reinforce_only/);

    r = advance(s.id);
    expect(r.session.question_number).toBe(3);

    // ---- Q3: vague again, coached, retry skipped ----
    r = submitAnswer(s.id, VAGUE_RESULT, 45);
    // fork should now ELICIT: H5 was demonstrated in Q1's retry
    expect(r.debug.selected!.intervention_type).toBe("I3_elicitation");

    r = advance(s.id); // skip retry
    expect(r.session.state).toBe("SESSION_SUMMARY");
    expect(r.session.summary!.turns.length).toBe(3);
    expect(r.session.summary!.turns[1]!.coached).toBe("reinforce_only");
    // Q3 coached but unresolved → next mission carries its habit
    expect(r.session.summary!.next_mission).toContain("making your results measurable");
  });

  it("enforces the state machine: illegal transitions are rejected, state untouched", () => {
    const s = createSession();
    expect(() => submitRetry(s.id, "x", 10)).toThrowError(/cannot retry/);
    expect(() => advance(s.id)).toThrowError(/cannot advance/);
    expect(s.state).toBe("AWAITING_ANSWER");
    // a failing pipeline (empty transcript) leaves state untouched (compute-then-commit)
    expect(() => submitAnswer(s.id, "", 10)).toThrow();
    expect(s.state).toBe("AWAITING_ANSWER");
    expect(publicView(s).move).toBeNull();
  });

  it("the learner view never contains engineering internals", () => {
    const s = createSession();
    const CLEAN_CLOSE_V1 =
      "The second op had a scrap problem and the castings kept warping. " +
      "As a result it eventually got under control and things improved for everyone.";
    submitAnswer(s.id, CLEAN_CLOSE_V1, 45);
    submitRetry(s.id, QUANTIFIED_RETRY + " So yeah", 30); // retry introduces a NEW weak close → banked
    const learnerJson = JSON.stringify(publicView(s)).toLowerCase();
    for (const internal of ["banked", "rejected", "reasoning_trace", "judgment_case", "priority_class", "learner_model"]) {
      expect(learnerJson).not.toContain(internal);
    }
    // while the debug view carries all of it
    const dbg = debugView(s);
    expect(dbg.comparison_internal!.banked_flaws.length).toBeGreaterThan(0);
    // (rejected-candidates presence in debug is asserted in the full-session test,
    //  where multiple candidates fire; this single-candidate answer has none)
  });
});
