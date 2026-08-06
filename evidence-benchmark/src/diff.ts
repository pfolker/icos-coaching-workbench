/**
 * Report diff — ICOS Evaluation System Design v0.1, Section 4/6. Takes two
 * persisted Report objects and produces a structured, per-case metric diff.
 * This comparison, not any single report, is the actual point of the
 * Run/Report model (Design Section 4's closing line).
 */
import { CaseMetrics } from "./scorer";
import { Report } from "./report";

export interface CaseMetricDelta {
  case_id: string;
  present_in_a: boolean;
  present_in_b: boolean;
  class_a_recall_rate_a: number | null;
  class_a_recall_rate_b: number | null;
  class_a_recall_rate_delta: number | null;
  claim_type_agreement_rate_a: number | null;
  claim_type_agreement_rate_b: number | null;
  claim_type_agreement_rate_delta: number | null;
  class_b_recall_rate_a: number | null;
  class_b_recall_rate_b: number | null;
  class_b_recall_rate_delta: number | null;
  quote_fidelity_a: { exact: number; paraphrased: number; total_proposed: number } | null;
  quote_fidelity_b: { exact: number; paraphrased: number; total_proposed: number } | null;
  additions_count_a: number | null;
  additions_count_b: number | null;
  additions_count_delta: number | null;
  class_c_hard_fail_a: boolean | null;
  class_c_hard_fail_b: boolean | null;
  class_c_hard_fail_changed: boolean;
  rejection_tally_delta: Record<string, number>;
  claim_type_disagreements_a: CaseMetrics["claim_type_agreement"]["disagreements"];
  claim_type_disagreements_b: CaseMetrics["claim_type_agreement"]["disagreements"];
}

export interface ReportDiff {
  report_a: { run_id: string; timestamp: string; pipeline_mode: string; model: string | null };
  report_b: { run_id: string; timestamp: string; pipeline_mode: string; model: string | null };
  case_deltas: CaseMetricDelta[];
  aggregate: {
    class_a_recall_avg_delta: number;
    claim_type_agreement_avg_delta: number;
    class_b_recall_avg_delta: number;
    total_additions_delta: number;
    hard_fail_status_changed: boolean;
  };
}

function tallyDelta(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const codes = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: Record<string, number> = {};
  for (const code of codes) {
    const delta = (b[code] ?? 0) - (a[code] ?? 0);
    if (delta !== 0) out[code] = delta;
  }
  return out;
}

export function diffReports(a: Report, b: Report): ReportDiff {
  const casesA = new Map(a.cases.map((c) => [c.case_id, c]));
  const casesB = new Map(b.cases.map((c) => [c.case_id, c]));
  const allCaseIds = [...new Set([...casesA.keys(), ...casesB.keys()])].sort();

  const case_deltas: CaseMetricDelta[] = allCaseIds.map((case_id) => {
    const ca = casesA.get(case_id);
    const cb = casesB.get(case_id);
    const ma = ca?.metrics;
    const mb = cb?.metrics;
    return {
      case_id,
      present_in_a: !!ca,
      present_in_b: !!cb,
      class_a_recall_rate_a: ma?.class_a_recall.rate ?? null,
      class_a_recall_rate_b: mb?.class_a_recall.rate ?? null,
      class_a_recall_rate_delta: ma && mb ? mb.class_a_recall.rate - ma.class_a_recall.rate : null,
      claim_type_agreement_rate_a: ma?.claim_type_agreement.rate ?? null,
      claim_type_agreement_rate_b: mb?.claim_type_agreement.rate ?? null,
      claim_type_agreement_rate_delta: ma && mb ? mb.claim_type_agreement.rate - ma.claim_type_agreement.rate : null,
      class_b_recall_rate_a: ma?.class_b_recall.rate ?? null,
      class_b_recall_rate_b: mb?.class_b_recall.rate ?? null,
      class_b_recall_rate_delta: ma && mb ? mb.class_b_recall.rate - ma.class_b_recall.rate : null,
      quote_fidelity_a: ma
        ? { exact: ma.quote_fidelity.exact, paraphrased: ma.quote_fidelity.paraphrased, total_proposed: ma.quote_fidelity.total_proposed }
        : null,
      quote_fidelity_b: mb
        ? { exact: mb.quote_fidelity.exact, paraphrased: mb.quote_fidelity.paraphrased, total_proposed: mb.quote_fidelity.total_proposed }
        : null,
      additions_count_a: ma?.additions.count ?? null,
      additions_count_b: mb?.additions.count ?? null,
      additions_count_delta: ma && mb ? mb.additions.count - ma.additions.count : null,
      class_c_hard_fail_a: ma?.class_c_hard_fail.passed ?? null,
      class_c_hard_fail_b: mb?.class_c_hard_fail.passed ?? null,
      class_c_hard_fail_changed: !!ma && !!mb && ma.class_c_hard_fail.passed !== mb.class_c_hard_fail.passed,
      rejection_tally_delta: tallyDelta(ma?.rejection_tally ?? {}, mb?.rejection_tally ?? {}),
      claim_type_disagreements_a: ma?.claim_type_agreement.disagreements ?? [],
      claim_type_disagreements_b: mb?.claim_type_agreement.disagreements ?? [],
    };
  });

  const reportMeta = (r: Report) => ({ run_id: r.run_id, timestamp: r.timestamp, pipeline_mode: r.pipeline_mode, model: r.model });

  return {
    report_a: reportMeta(a),
    report_b: reportMeta(b),
    case_deltas,
    aggregate: {
      class_a_recall_avg_delta: b.aggregate.class_a_recall_avg - a.aggregate.class_a_recall_avg,
      claim_type_agreement_avg_delta: b.aggregate.claim_type_agreement_avg - a.aggregate.claim_type_agreement_avg,
      class_b_recall_avg_delta: b.aggregate.class_b_recall_avg - a.aggregate.class_b_recall_avg,
      total_additions_delta: b.aggregate.total_additions - a.aggregate.total_additions,
      hard_fail_status_changed: a.aggregate.class_c_hard_fail_all_passed !== b.aggregate.class_c_hard_fail_all_passed,
    },
  };
}
