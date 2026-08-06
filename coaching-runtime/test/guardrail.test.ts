import { describe, it, expect } from "vitest";
import { guardrailCheck } from "../src/guardrail";
import { COACHING_ATLAS } from "../src/coachingAtlas";

describe("Guardrail vs. all 12 real Coaching Atlas cases (run BEFORE any real Narrator output)", () => {
  for (const c of COACHING_ATLAS) {
    it(`${c.id} (${c.label}) -> expected ${c.expected}${c.expected_category ? ` (category ${c.expected_category})` : ""}`, () => {
      const result = guardrailCheck(c.text);
      if (c.expected === "allowed") {
        expect(result.passed, `expected ALLOWED but guardrail flagged: ${JSON.stringify(result.violations)}`).toBe(true);
      } else {
        expect(result.passed, "expected FORBIDDEN but guardrail passed it clean").toBe(false);
        expect(result.violations.some((v) => v.category === c.expected_category),
          `expected category ${c.expected_category} but got categories: ${result.violations.map((v) => v.category).join(",")}`
        ).toBe(true);
      }
    });
  }

  it("catches a real violation found during live Case 009 testing: competence inference via 'shows you're tracking...'", () => {
    // Not from the Atlas — found live, tonight, when the Narrator was
    // deliberately given Case 009's causal-belief claim as evidence (see
    // README.md, Deliverable 6). Regression-locked here so it can never
    // silently regress.
    const msg = "Calling out both factors side by side shows you're tracking multiple variables at once.";
    const result = guardrailCheck(msg);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.category === 1)).toBe(true);
  });

  it("classifies all 12 cases exactly the way the Atlas does, in one pass", () => {
    const outcomes = COACHING_ATLAS.map((c) => ({ id: c.id, passed: guardrailCheck(c.text).passed }));
    const mismatches = outcomes.filter((o, i) => o.passed !== (COACHING_ATLAS[i]!.expected === "allowed"));
    expect(mismatches, `mismatches: ${JSON.stringify(mismatches)}`).toEqual([]);
  });
});
