/**
 * Regression guard, not a runtime dependency: confirms the hardcoded
 * constants in server/referenceScenario.ts still match what the frozen,
 * already-validated pipeline actually produces. This test file is the
 * ONLY place in product-alpha that imports evidence-shadow-compare /
 * evidence-runtime / coaching-runtime — the shipped server never does.
 * If this test ever fails, it means the captured data drifted from the
 * real backend, not that the backend was changed by this package (this
 * package has no ability to change it).
 */
import { describe, it, expect } from "vitest";
import { runShadowCompare } from "../../evidence-shadow-compare/src/pipeline";
import * as case001 from "../../evidence-runtime/fixtures/case001";
import * as founderCase from "../../coaching-runtime/src/founderCase";
import { FIRST_TAKE, RETRY } from "../server/referenceScenario";

describe("Product Alpha reference scenario — provenance check", () => {
  it("FIRST_TAKE.transcript is byte-identical to case001.ts's TRANSCRIPT", () => {
    expect(FIRST_TAKE.transcript).toBe(case001.TRANSCRIPT);
  });

  it("RETRY.transcript is byte-identical to founderCase.ts's TRANSCRIPT", () => {
    expect(RETRY.transcript).toBe(founderCase.TRANSCRIPT);
  });

  it("FIRST_TAKE's coachesNotes/todaysFocus match the frozen pipeline's real, corrected output for case001", async () => {
    const r = await runShadowCompare({
      transcript: case001.TRANSCRIPT,
      mode: "fixture",
      fixture: case001.LISTEN_ENGINE_FIXTURE,
      context: { question_type: "behavioral" },
    });
    expect(r.right.quick_scan).toEqual(FIRST_TAKE.coachesNotes);
    expect(r.right.decision.decision_type).toBe("coach_one");
    expect(r.right.decision.selected!.opportunity.opportunity_id).toBe("O3_unquantified_result");
    expect(r.right.candidate_suppressions.map((s) => s.opportunity_id)).toEqual(["O5_vagueness"]);
  });

  it("RETRY's coachesNotes match the frozen pipeline's real, corrected output for founderCase (Milestone 3's flagship capture)", async () => {
    const r = await runShadowCompare({
      transcript: founderCase.TRANSCRIPT,
      mode: "fixture",
      fixture: founderCase.LISTEN_ENGINE_FIXTURE,
      context: { question_type: "behavioral" },
    });
    expect(r.right.quick_scan).toEqual(RETRY.coachesNotes);
    expect(r.right.decision.decision_type).toBe("coach_one");
    expect(r.right.decision.selected!.opportunity.opportunity_id).toBe("O3_unquantified_result");
    expect(r.right.candidate_suppressions.map((s) => s.opportunity_id)).toEqual(["O5_vagueness"]);
  });

  it("the lock-in acknowledgment's claim (retry adds 'Clearly states the task or role') is real: present in RETRY's STORY, absent from FIRST_TAKE's STORY", () => {
    const firstTakeLabels = FIRST_TAKE.coachesNotes.STORY.map((i) => i.label);
    const retryLabels = RETRY.coachesNotes.STORY.map((i) => i.label);
    expect(firstTakeLabels).not.toContain("Clearly states the task or role");
    expect(retryLabels).toContain("Clearly states the task or role");
  });
});
