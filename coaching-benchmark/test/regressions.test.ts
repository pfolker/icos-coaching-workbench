import { describe, it, expect } from "vitest";
import { HISTORICAL_FAILURES } from "../src/corpus";

/**
 * Phase 1, Step 4: every historical-failure case is a PERMANENT regression.
 * These tests are the enforcement — they make the corpus's regression set
 * something you cannot quietly shrink. If a future change drops or un-flags a
 * seeded incident, one of these fails loudly.
 *
 * Note on scope: there is no coach yet, so these do NOT assert a coach PASSES
 * the cases. They lock the cases IN (present, flagged permanent, documented)
 * so that once a coach passes them in Phase 3, "never silently regress" has a
 * fixture to hang on. The pass/fail-against-a-coach assertion is added in
 * Phase 3, on top of this registry.
 */

/**
 * The permanent regression registry. This literal list is the contract:
 * removing a case from the corpus without also removing it here (or vice
 * versa) fails the sync test below. Adding a new permanent regression is a
 * deliberate two-line change, on purpose.
 */
const EXPECTED_PERMANENT_REGRESSIONS = [
  "HF-001", // fact fabrication (Case 001 "indicator")
  "HF-002", // relationship fabrication (Case 009 "because")
  "HF-003", // profession-specific: inch flatness
  "HF-004", // profession-specific: mm gap
  "HF-005", // profession-specific: thou/micron runout
  "HF-006", // grounding false positive
] as const;

describe("permanent regressions (Step 4)", () => {
  it("every seeded historical failure is flagged permanent_regression: true", () => {
    for (const c of HISTORICAL_FAILURES) {
      expect(c.permanent_regression, `${c.case_id} must be a permanent regression`).toBe(true);
    }
  });

  it("the corpus's permanent-regression set exactly matches the locked registry", () => {
    const inCorpus = HISTORICAL_FAILURES.filter((c) => c.permanent_regression).map((c) => c.case_id).sort();
    expect(inCorpus).toEqual([...EXPECTED_PERMANENT_REGRESSIONS].sort());
  });

  it("the registry cannot silently shrink below the four seeded failure categories", () => {
    // At least one regression per real failure category must survive any edit.
    const cats = new Set(
      HISTORICAL_FAILURES.filter((c) => c.permanent_regression).map((c) => c.failure_category),
    );
    expect([...cats].sort()).toEqual([
      "fact_fabrication",
      "grounding_false_positive",
      "profession_specific_understanding",
      "relationship_fabrication",
    ]);
  });
});
