import { describe, it, expect } from "vitest";
import { runGroundingReliability, CURATED_VS_LIVE_LESSON } from "../src/groundingReliability";

/**
 * HF-006 reliability metric (item 5). We assert the two robust, documented
 * facts and REPORT the false-positive rate rather than forcing it to zero —
 * the residual false-positive tendency is the finding, not a bug to hide.
 */
describe("grounding-system reliability (HF-006)", () => {
  const report = runGroundingReliability();

  it("still catches the REQUIRED fabricated named tools (P3 indicator, P4 laser micrometer must not regress)", () => {
    expect(report.required_fabrication_detection_rate).toBe(1);
    expect(report.results.find((r) => r.id === "P3")!.passed).toBe(false);
    expect(report.results.find((r) => r.id === "P4")!.passed).toBe(false);
  });

  it("passes the corrected Case 001 message (documented as grounded after the fix)", () => {
    const p1 = report.results.find((r) => r.id === "P1")!;
    expect(p1.passed).toBe(true);
  });

  it("records the concrete-entity approach's OWN new failure class honestly (unlisted tool 'theodolite' is missed, not tuned away)", () => {
    const p7 = report.results.find((r) => r.id === "P7")!;
    expect(p7.passed).toBe(true);            // missed — a false negative
    expect(p7.demonstrates_limitation).toBe(true);
    expect(report.known_limitation_misses.map((r) => r.id)).toContain("P7");
  });

  it("computes a false-positive rate over legitimate paraphrases (reported, not asserted to be zero)", () => {
    expect(report.false_positive_rate).toBeGreaterThanOrEqual(0);
    expect(report.false_positive_rate).toBeLessThanOrEqual(1);
    // surfaced for the founder report; not gated here
  });

  it("after the narrow tuning fix, the real Phase 2 live HF-001 messages (P5/P6) pass grounding", () => {
    const p5 = report.results.find((r) => r.id === "P5")!;
    const p6 = report.results.find((r) => r.id === "P6")!;
    // If either FLAGs, its ungrounded_terms show which NEW word — a real signal, not to be tuned away here.
    expect(p5.passed, `P5 flagged: ${p5.ungrounded_terms.join(", ")}`).toBe(true);
    expect(p6.passed, `P6 flagged: ${p6.ungrounded_terms.join(", ")}`).toBe(true);
  });

  it("keeps the curated-vs-live discrepancy on record as a permanent lesson", () => {
    expect(CURATED_VS_LIVE_LESSON).toMatch(/curated/i);
    expect(CURATED_VS_LIVE_LESSON).toMatch(/live/i);
  });
});
