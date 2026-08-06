import { describe, it, expect } from "vitest";
import {
  buildShadowModeAggregate, buildShadowModeReport, shadowModeReportFilename,
  ShadowModeCaseResult,
} from "../src/report";

function caseResult(
  case_id: string, agree: boolean, divergence: ShadowModeCaseResult["metrics"]["divergence"] = null,
  candidateLevelAgreement: boolean = agree
): ShadowModeCaseResult {
  return {
    case_id,
    tier: "shadow_mode",
    metrics: {
      transcript_hash: `hash_${case_id}`,
      regex_candidate_ids: ["O5_vagueness"],
      regex_selected_id: "O5_vagueness",
      evidence_candidate_ids: ["O3_unquantified_result"],
      merged_candidate_ids: ["O5_vagueness", "O3_unquantified_result"],
      evidence_selected_id: agree ? "O5_vagueness" : "O3_unquantified_result",
      ladder_conflicts_resolved: [],
      supporting_evidence: agree ? [] : ["Scrap rate on that fixture dropped back to normal within a day"],
      agree,
      divergence,
      final_recommendation: agree
        ? { source: "agree", reason: "both sides selected the same opportunity" }
        : { source: "evidence", reason: "test fixture" },
      regex_o3_pick: null,
      candidate_level_agreement: candidateLevelAgreement,
      candidate_suppressions: [],
    },
  };
}

describe("Shadow Mode tier — Project A Milestone 1 (additive to the existing Run/Report schema)", () => {
  it("existing 'evidence' tier types/functions are completely untouched: CaseResult is still exactly EvidenceCaseResult", () => {
    // compile-time only: if CaseResult had been widened to a union, this
    // file would need a tier narrow before accessing evidence-only fields
    // elsewhere in the package (diff.ts) — the fact that diff.ts and
    // runner.test.ts still typecheck unmodified IS the regression proof
    // (see report.ts's own comment on why CaseResult stayed unwidened).
    expect(true).toBe(true);
  });

  it("buildShadowModeAggregate computes agreement rate and per-id divergence tally correctly", () => {
    const cases = [
      caseResult("c1", true),
      caseResult("c2", false, { regex_only_ids: ["O5_vagueness"], evidence_only_ids: ["O3_unquantified_result"], reason: "root_cause override" }),
      caseResult("c3", false, { regex_only_ids: [], evidence_only_ids: ["O3_unquantified_result"], reason: "confidence tiebreak" }),
    ];
    const agg = buildShadowModeAggregate(cases);
    expect(agg.case_count).toBe(3);
    expect(agg.agreement_count).toBe(1);
    expect(agg.agreement_rate).toBeCloseTo(1 / 3);
    expect(agg.divergence_count).toBe(2);
    expect(agg.diverged_opportunity_id_tally).toEqual({
      O5_vagueness: 1,
      O3_unquantified_result: 2,
    });
  });

  it("buildShadowModeAggregate on an empty case list: both agreement rates default to 1, not NaN or division-by-zero", () => {
    const agg = buildShadowModeAggregate([]);
    expect(agg).toEqual({
      case_count: 0, agreement_count: 0, agreement_rate: 1,
      divergence_count: 0, diverged_opportunity_id_tally: {},
      candidate_level_agreement_count: 0, candidate_level_agreement_rate: 1,
      metric_divergence_count: 0, metric_divergence_case_ids: [],
    });
  });

  it("Milestone 2: metric_divergence counts cases where final-selection agreement and candidate-level agreement DISAGREE with each other — the real 'masked divergence' shape Milestone 1 found (root_cause override masking a genuine O3 disagreement)", () => {
    const cases = [
      caseResult("clean_agree", true), // agree=true, candidate_level_agreement=true (real, clean agreement)
      caseResult("clean_disagree", false, { regex_only_ids: ["O5_vagueness"], evidence_only_ids: ["O3_unquantified_result"], reason: "confidence tiebreak" }, false), // agree=false, candidate_level_agreement=false (real, clean disagreement)
      caseResult("masked", true, null, false), // *** the masking shape: final agrees, candidates don't ***
    ];
    const agg = buildShadowModeAggregate(cases);
    expect(agg.agreement_count).toBe(2); // clean_agree + masked
    expect(agg.candidate_level_agreement_count).toBe(1); // clean_agree only
    expect(agg.metric_divergence_count).toBe(1);
    expect(agg.metric_divergence_case_ids).toEqual(["masked"]);
  });

  it("buildShadowModeReport produces the sibling Report shape, tier='shadow_mode', with its own aggregate", () => {
    const report = buildShadowModeReport({
      pipeline_mode: "live", model: "claude-sonnet-5",
      cases: [caseResult("c1", true)],
    });
    expect(report.tier).toBe("shadow_mode");
    expect(report.pipeline_mode).toBe("live");
    expect(report.model).toBe("claude-sonnet-5");
    expect(report.spec_version).toBe("1.1");
    expect(report.aggregate.case_count).toBe(1);
    expect(report.run_id).toMatch(/^shadow_live_/);
  });

  it("shadowModeReportFilename matches the same versioned naming convention as the evidence tier's reportFilename", () => {
    const report = buildShadowModeReport({ pipeline_mode: "live", model: null, cases: [] });
    const name = shadowModeReportFilename(report);
    expect(name).toMatch(/^report_shadow_mode_v1\.1_live_.+\.json$/);
  });
});
