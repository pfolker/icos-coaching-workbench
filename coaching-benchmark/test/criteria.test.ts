import { describe, it, expect } from "vitest";
import { CRITERIA, CRITERIA_BY_ID, HARD_FAIL_CRITERIA, STABILITY_BANDS, SCORE_ANCHORS } from "../src/criteria";

describe("Tier 2 rubric — the 12 coaching-quality criteria", () => {
  it("defines exactly the 12 criteria from the Phase 1 plan", () => {
    expect(CRITERIA.map((c) => c.id)).toEqual([
      "answer_comprehension",
      "evidence_recognition",
      "fact_grounding",
      "attribution_relationship_fidelity",
      "scope_fidelity",
      "focus_quality",
      "good_enough_judgment",
      "actionability",
      "brevity",
      "voice_preservation",
      "run_to_run_stability",
      "retry_effect",
    ]);
  });

  it("gives every criterion a description and a concrete scoring question", () => {
    for (const c of CRITERIA) {
      expect(c.description.length, `${c.id} description`).toBeGreaterThan(0);
      expect(c.scoring_question.length, `${c.id} scoring_question`).toBeGreaterThan(0);
    }
  });

  it("marks fact_grounding and attribution_relationship_fidelity as the two hard-fail criteria", () => {
    expect([...HARD_FAIL_CRITERIA].sort()).toEqual(["attribution_relationship_fidelity", "fact_grounding"]);
  });

  it("wires each hard-fail criterion to the real fabrication category it guards", () => {
    expect(CRITERIA_BY_ID.get("fact_grounding")?.guards_failure_categories).toContain("fact_fabrication");
    expect(CRITERIA_BY_ID.get("attribution_relationship_fidelity")?.guards_failure_categories).toContain("relationship_fabrication");
  });

  it("has a full 0..3 anchor scale", () => {
    expect(Object.keys(SCORE_ANCHORS).sort()).toEqual(["0", "1", "2", "3"]);
  });
});

describe("run-to-run stability is defined as two explicit bands, not one number", () => {
  it("separates acceptable from unacceptable variation", () => {
    expect(STABILITY_BANDS.acceptable_variation.length).toBeGreaterThan(0);
    expect(STABILITY_BANDS.unacceptable_variation.length).toBeGreaterThan(0);
  });

  it("puts 'different-but-valid focus' in acceptable and 'grounding disagreement' in unacceptable", () => {
    expect(STABILITY_BANDS.acceptable_variation.join(" ").toLowerCase()).toContain("valid");
    expect(STABILITY_BANDS.unacceptable_variation.join(" ").toLowerCase()).toContain("grounded");
  });
});
