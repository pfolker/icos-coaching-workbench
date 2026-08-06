import { describe, it, expect } from "vitest";
import { CRITERIA } from "../src/criteria";
import {
  buildBlankScoreSheet,
  finalizeCase,
  buildReport,
  reportFilename,
  CaseScoreSheet,
} from "../src/report";

function filledSheet(case_id: string, overrides: Record<string, 0 | 1 | 2 | 3 | "n/a">): CaseScoreSheet {
  return {
    case_id,
    scores: CRITERIA.map((c) => ({ criterion_id: c.id, score: overrides[c.id] ?? 2 })),
  };
}

describe("blank scoresheet (Step 5 format)", () => {
  it("has one row per case and one 'pending' cell per criterion", () => {
    const sheets = buildBlankScoreSheet(["HF-001", "HF-002"]);
    expect(sheets).toHaveLength(2);
    for (const s of sheets) {
      expect(s.scores).toHaveLength(CRITERIA.length);
      expect(s.scores.every((x) => x.score === "pending")).toBe(true);
    }
  });
});

describe("finalizeCase — derived fields", () => {
  it("flags hard_fail when a hard-fail criterion scores 0, and nulls the graded mean", () => {
    const r = finalizeCase(filledSheet("c", { fact_grounding: 0 }));
    expect(r.hard_fail).toBe(true);
    expect(r.hard_fail_criteria).toContain("fact_grounding");
    expect(r.graded_mean).toBeNull();
  });

  it("does NOT hard_fail when a graded (non-hard-fail) criterion scores 0", () => {
    const r = finalizeCase(filledSheet("c", { brevity: 0 }));
    expect(r.hard_fail).toBe(false);
    expect(r.graded_mean).not.toBeNull();
  });

  it("stays incomplete (mean null) while any criterion is pending", () => {
    const sheet = buildBlankScoreSheet(["c"])[0]!;
    const r = finalizeCase(sheet);
    expect(r.incomplete).toBe(true);
    expect(r.graded_mean).toBeNull();
  });

  it("excludes n/a from the graded mean without failing the case", () => {
    const r = finalizeCase(filledSheet("c", { retry_effect: "n/a" }));
    expect(r.hard_fail).toBe(false);
    expect(r.incomplete).toBe(false);
    // all others = 2, one n/a excluded → mean is exactly 2
    expect(r.graded_mean).toBe(2);
  });
});

describe("report + aggregate", () => {
  it("aggregates hard-fail cases and an overall graded mean over clean cases", () => {
    const report = buildReport({
      subject: "test-subject @ model-x",
      sheets: [
        filledSheet("good", {}), // all 2s → graded_mean 2
        filledSheet("fabricated", { attribution_relationship_fidelity: 0 }), // hard fail
      ],
    });
    expect(report.tier).toBe("coaching_quality");
    expect(report.aggregate.case_count).toBe(2);
    expect(report.aggregate.hard_fail_case_count).toBe(1);
    expect(report.aggregate.hard_fail_case_ids).toEqual(["fabricated"]);
    expect(report.aggregate.overall_graded_mean).toBe(2); // only "good" counts
  });

  it("produces a provider-neutral, timestamped filename", () => {
    const report = buildReport({ subject: "coaching-runtime @ claude-sonnet-5", sheets: [] });
    expect(reportFilename(report)).toMatch(/^report_coaching_quality_v0\.1_.*\.json$/);
  });
});
