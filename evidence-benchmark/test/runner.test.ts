import { describe, it, expect } from "vitest";
import { runBenchmark, ALL_CASE_IDS, LIVE_ALLOWED_CASE_IDS } from "../src/runner";

describe("Benchmark runner — fixture mode only (this suite never makes a live call)", () => {
  it("defaults to all 10 Atlas cases in fixture mode", async () => {
    const report = await runBenchmark({ mode: "fixture" });
    expect(report.pipeline_mode).toBe("fixture");
    expect(report.model).toBeNull();
    expect(report.cases.map((c) => c.case_id).sort()).toEqual([...ALL_CASE_IDS].sort());
    expect(report.cases.length).toBe(10);
  });

  it("Report shape matches Design v0.1 Section 4 exactly, tier='evidence'", async () => {
    const report = await runBenchmark({ mode: "fixture", caseIds: ["001"] });
    expect(report.tier).toBe("evidence");
    expect(report.spec_version).toBe("1.1");
    expect(report.atlas_version).toBe("0.1");
    expect(typeof report.run_id).toBe("string");
    expect(typeof report.timestamp).toBe("string");
    expect(report.aggregate).toBeDefined();
    expect(report.cases[0]!.tier).toBe("evidence");
    expect(report.cases[0]!.metrics.class_c_hard_fail).toBeDefined();
  });

  it("Case 009's hard-fail passes and every case's hard-fail passes across all 10 fixtures", async () => {
    const report = await runBenchmark({ mode: "fixture" });
    expect(report.aggregate.class_c_hard_fail_all_passed).toBe(true);
    expect(report.aggregate.class_c_hard_fail_failures).toEqual([]);
  });

  it("aggregate rollup is computed correctly (averages within [0,1], additions/rejections are non-negative counts)", async () => {
    const report = await runBenchmark({ mode: "fixture" });
    expect(report.aggregate.case_count).toBe(10);
    expect(report.aggregate.class_a_recall_avg).toBeGreaterThanOrEqual(0);
    expect(report.aggregate.class_a_recall_avg).toBeLessThanOrEqual(1);
    expect(report.aggregate.total_additions).toBeGreaterThanOrEqual(0);
  });

  it("refuses live mode for a case outside the allowed subset, without making any network call", async () => {
    await expect(runBenchmark({ mode: "live", caseIds: ["004"] })).rejects.toThrow(/scoped to cases/);
  });

  it("refuses a mixed live request that includes even one disallowed case", async () => {
    await expect(runBenchmark({ mode: "live", caseIds: ["001", "004"] })).rejects.toThrow(/004/);
  });

  it("LIVE_ALLOWED_CASE_IDS is exactly the 3-case subset from Design v0.1 Step 3", () => {
    expect([...LIVE_ALLOWED_CASE_IDS].sort()).toEqual(["001", "002", "009"]);
  });

  it("determinism: fixture mode run twice produces byte-identical metrics (excluding run_id/timestamp)", async () => {
    const r1 = await runBenchmark({ mode: "fixture" });
    const r2 = await runBenchmark({ mode: "fixture" });
    const strip = (r: typeof r1) => ({ ...r, run_id: "x", timestamp: "x" });
    expect(JSON.stringify(strip(r1))).toBe(JSON.stringify(strip(r2)));
  });
});
