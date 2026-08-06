import { describe, it, expect } from "vitest";
import { runBenchmark } from "../src/runner";
import { diffReports } from "../src/diff";

describe("Report diff — fixture mode only (this suite never makes a live call)", () => {
  it("diffing a report against itself produces zero deltas everywhere", async () => {
    const report = await runBenchmark({ mode: "fixture", caseIds: ["001", "009"] });
    const d = diffReports(report, report);
    for (const cd of d.case_deltas) {
      expect(cd.class_a_recall_rate_delta).toBe(0);
      expect(cd.claim_type_agreement_rate_delta).toBe(0);
      expect(cd.class_b_recall_rate_delta).toBe(0);
      expect(cd.additions_count_delta).toBe(0);
      expect(cd.class_c_hard_fail_changed).toBe(false);
      expect(cd.rejection_tally_delta).toEqual({});
    }
    expect(d.aggregate.class_a_recall_avg_delta).toBe(0);
    expect(d.aggregate.hard_fail_status_changed).toBe(false);
  });

  it("case present only in one report shows up correctly, not silently dropped", async () => {
    const reportA = await runBenchmark({ mode: "fixture", caseIds: ["001"] });
    const reportB = await runBenchmark({ mode: "fixture", caseIds: ["001", "009"] });
    const d = diffReports(reportA, reportB);
    const case009 = d.case_deltas.find((c) => c.case_id === "009")!;
    expect(case009.present_in_a).toBe(false);
    expect(case009.present_in_b).toBe(true);
    expect(case009.class_a_recall_rate_delta).toBeNull();
  });

  it("case_deltas cover the union of both reports' case_ids, sorted", async () => {
    const reportA = await runBenchmark({ mode: "fixture", caseIds: ["002"] });
    const reportB = await runBenchmark({ mode: "fixture", caseIds: ["001"] });
    const d = diffReports(reportA, reportB);
    expect(d.case_deltas.map((c) => c.case_id)).toEqual(["001", "002"]);
  });
});
