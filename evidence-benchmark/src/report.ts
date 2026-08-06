/**
 * Run/Report schema — ICOS Evaluation System Design v0.1, Section 4.
 * The tier field and tier-specific payload exist now even though only
 * "evidence" is populated in this build — CaseResult is a documented
 * extension point for a future Tier 2/3 logger writing into this same
 * shape, per Design Section 4's own stated rationale.
 */
import { CaseMetrics } from "./scorer";

/**
 * "shadow_mode" added for Project A Milestone 1 (Evidence Runtime
 * Shadow-Mode Integration, evidence-shadow-integration-plan-v0.1.md) —
 * genuinely additive, exactly the extension point this file's own original
 * comment anticipated ("a future Tier 2/3 logger writing into this same
 * shape"), though shadow_mode isn't one of the two tiers that comment
 * named (coaching_quality, business): it's not a Specification-conformance
 * scoring tier like "evidence" — it's a live regex-vs-evidence agreement
 * log from real Alpha Workbench usage. Same sibling-variant pattern
 * applies regardless: its own CaseResult variant, its own Aggregate, its
 * own Report shape below — nothing about the existing "evidence" tier's
 * types or functions changes.
 */
export type TierName = "evidence" | "coaching_quality" | "business" | "shadow_mode";
export type PipelineMode = "fixture" | "live";

export interface EvidenceCaseResult {
  case_id: string;
  tier: "evidence";
  metrics: CaseMetrics;
}

/**
 * Deliberately NOT widened to include ShadowModeCaseResult: `Report.cases`
 * (below) and diff.ts's `diffReports()` both assume every case in a
 * `Report` carries the "evidence" tier's specific metrics unconditionally
 * — that assumption predates this change and stays true, since shadow_mode
 * has its own sibling `ShadowModeReport`/`ShadowModeCaseResult[]` (below),
 * never mixed into `Report.cases`. A future Tier 2 (coaching_quality) or
 * Tier 3 (business) case result would be a genuine sibling variant of
 * THIS union instead, if it's ever meant to share `Report`'s own shape
 * (e.g. `{ case_id, tier: "coaching_quality", metrics: CoachingMetrics }`)
 * — added when that tier is actually built, not stubbed out here with
 * fake fields (Design Section 2 explicitly scopes Tier 2/3 out of this
 * task).
 */
export type CaseResult = EvidenceCaseResult;

export interface EvidenceAggregate {
  case_count: number;
  class_a_recall_avg: number;
  claim_type_agreement_avg: number;
  class_b_recall_avg: number;
  total_additions: number;
  class_c_hard_fail_all_passed: boolean;
  class_c_hard_fail_failures: string[];
  rejection_tally_total: Record<string, number>;
}

export interface Report {
  run_id: string;
  timestamp: string;
  tier: TierName;
  spec_version: string;
  atlas_version: string;
  pipeline_mode: PipelineMode;
  model: string | null;
  cases: CaseResult[];
  aggregate: EvidenceAggregate;
}

export const SPEC_VERSION = "1.1";
export const ATLAS_VERSION = "0.1";

function average(nums: number[]): number {
  return nums.length === 0 ? 1 : nums.reduce((s, x) => s + x, 0) / nums.length;
}

export function buildAggregate(cases: EvidenceCaseResult[]): EvidenceAggregate {
  const failures = cases.filter((c) => !c.metrics.class_c_hard_fail.passed).map((c) => c.case_id);
  const rejection_tally_total: Record<string, number> = {};
  for (const c of cases) {
    for (const [code, count] of Object.entries(c.metrics.rejection_tally)) {
      rejection_tally_total[code] = (rejection_tally_total[code] ?? 0) + count;
    }
  }
  return {
    case_count: cases.length,
    class_a_recall_avg: average(cases.map((c) => c.metrics.class_a_recall.rate)),
    claim_type_agreement_avg: average(cases.map((c) => c.metrics.claim_type_agreement.rate)),
    class_b_recall_avg: average(cases.map((c) => c.metrics.class_b_recall.rate)),
    total_additions: cases.reduce((s, c) => s + c.metrics.additions.count, 0),
    class_c_hard_fail_all_passed: failures.length === 0,
    class_c_hard_fail_failures: failures,
    rejection_tally_total,
  };
}

export function buildReport(opts: {
  tier: TierName;
  pipeline_mode: PipelineMode;
  model: string | null;
  cases: EvidenceCaseResult[];
}): Report {
  return {
    run_id: `${opts.pipeline_mode}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    tier: opts.tier,
    spec_version: SPEC_VERSION,
    atlas_version: ATLAS_VERSION,
    pipeline_mode: opts.pipeline_mode,
    model: opts.model,
    cases: opts.cases,
    aggregate: buildAggregate(opts.cases),
  };
}

function filenameParts(tier: TierName, spec_version: string, pipeline_mode: PipelineMode, timestamp: string): string {
  const ts = timestamp.replace(/[:.]/g, "-");
  return `report_${tier}_v${spec_version}_${pipeline_mode}_${ts}.json`;
}

/** Versioned filename per Design Section 4: spec version, mode, timestamp. */
export function reportFilename(report: Report): string {
  return filenameParts(report.tier, report.spec_version, report.pipeline_mode, report.timestamp);
}

// ==================================================================
// Shadow Mode tier — Project A Milestone 1 (Evidence Runtime
// Shadow-Mode Integration inside the real Alpha Workbench).
//
// One case result per submitted transcript: which opportunity ids the
// real, unmodified regex pipeline fired and selected, vs. which ids the
// evidence-derived pool (adapter, O3 ladder only) contributed and what
// the SAME, unmodified Decision Engine selected once fed the merged pool
// — and, when the two selections disagree, WHY (decide()'s own real
// reasoning.explanation, surfaced verbatim, never re-derived or guessed).
// ==================================================================

/**
 * `null` for regex_selected_id/evidence_selected_id means `decide()`
 * returned decision_type "reinforce_only" (no coachable candidate that
 * turn) — a real, distinct outcome from "some id was selected", not a
 * missing-value placeholder.
 */
export interface ShadowModeDivergence {
  /** opportunity_ids the regex pool fired that the adapter's raw output did not */
  regex_only_ids: string[];
  /** opportunity_ids the adapter's raw output fired that the regex pool did not */
  evidence_only_ids: string[];
  /** decide()'s own reasoning.explanation for the RIGHT/merged decision,
   *  joined verbatim — never a re-derived or guessed explanation */
  reason: string;
}

/**
 * "regex"/"evidence": one side's selection is mechanically preferable
 * given ONLY what's actually knowable at this layer (see reasoning below).
 * "agree": nothing to recommend between, both sides already match.
 * "uncertain": deliberately NOT defaulting to "evidence" — the disagreement
 * traces to Decision Engine PRIORITIZATION (e.g. a root_cause escalation
 * from an unmapped id like O4_ownership_hiding), not to a clean claim
 * about whether an outcome exists/is quantified. Recommending "evidence"
 * unconditionally here would overclaim; this is a genuinely harder
 * judgment call this milestone does not resolve mechanically (see the
 * real checkout-outage case that motivated this distinction).
 */
export type ShadowModeRecommendationSource = "regex" | "evidence" | "agree" | "uncertain";

export interface ShadowModeRecommendation {
  source: ShadowModeRecommendationSource;
  reason: string;
}

export interface ShadowModeMetrics {
  transcript_hash: string;
  regex_candidate_ids: string[];
  regex_selected_id: string | null;
  /** the adapter's raw output (O3 ladder only, before merge/dedup) */
  evidence_candidate_ids: string[];
  /** regex candidates + new (non-duplicate) adapter candidates, exactly
   *  what was fed to the SAME, unmodified Decision Engine */
  merged_candidate_ids: string[];
  evidence_selected_id: string | null;
  /** ids dropped from RENDERING only by resolveLadderConflictsForRendering
   *  — always [] in this tier's use, since shadow mode never renders
   *  anything; kept for parity with evidence-shadow-compare's own schema
   *  and so a future rendering integration can diff against it directly */
  ladder_conflicts_resolved: string[];
  /** the adapter's own supporting quotes for whichever O3-ladder state it
   *  found (outcome claim quote(s) for O3_unquantified_result; empty for
   *  O3_missing_result, since there's nothing to quote — absence IS the
   *  finding). Pulled directly from EvidenceGraphOpportunityAdapter's own
   *  `evidence.spans`, never re-derived. */
  supporting_evidence: string[];
  agree: boolean;
  divergence: ShadowModeDivergence | null;
  /** a MECHANICAL recommendation (not a per-transcript human judgment —
   *  that lives in the Milestone 1 validation corpus report, which can and
   *  sometimes does differ from this field; see README.md). Computed the
   *  same way for every case, so it's meaningfully comparable across the
   *  whole corpus rather than one-off. */
  final_recommendation: ShadowModeRecommendation;
  /**
   * Whichever of O3_missing_result/O3_unquantified_result appears in
   * regex_candidate_ids (null if neither does), for direct comparison
   * against evidence_candidate_ids[0] — independent of what `decide()`
   * ultimately SELECTED. Real, confirmed finding (validation corpus, not
   * hypothesized): `agree` can be misleadingly high. When an unmapped id
   * (e.g. O4_ownership_hiding) wins `root_cause` priority on BOTH sides,
   * the final selection can match even though the underlying O3 pools
   * genuinely disagree — `agree=true` then hides a real divergence
   * `candidate_level_agreement` (below) surfaces instead.
   */
  regex_o3_pick: string | null;
  /** regex_o3_pick === (evidence_candidate_ids[0] ?? null). Can be FALSE
   *  even when `agree` is TRUE (see regex_o3_pick's doc comment) — that
   *  combination is the "masked divergence" shape, a real, named finding. */
  candidate_level_agreement: boolean;
  /**
   * Milestone 3: opportunity_ids removed from the pre-decide() candidates
   * array this turn by evidence-shadow-compare's
   * opportunitySuppression.ts, and which rule did it — e.g. O5_vagueness
   * suppressed by "O5 specificity suppression" on the flagship
   * founder_retry case. Empty when nothing was suppressed. Whether a given
   * suppression was CORRECT (a true vs. false positive) is a human
   * judgment made in the Milestone 3 validation corpus report, not
   * computed here — this field only records WHAT happened, mechanically.
   */
  candidate_suppressions: { opportunity_id: string; rule_name: string }[];
}

export interface ShadowModeCaseResult {
  case_id: string;
  tier: "shadow_mode";
  metrics: ShadowModeMetrics;
}

/**
 * Milestone 2 (evidence-shadow-integration-plan-v0.1.md follow-on): Milestone
 * 1's own corpus found that `agreement_rate` (final SELECTED id) can be
 * misleadingly high — final selection can match even when the underlying
 * O3 candidate pools genuinely disagree, whenever an unmapped id's
 * root_cause priority override wins on both sides regardless (3 of 16
 * real cases). Every future report now carries BOTH rates side by side,
 * plus an explicit, counted THIRD category for where they disagree with
 * each other — a sharper signal than either raw percentage alone, per the
 * founder's explicit instruction.
 */
export interface ShadowModeAggregate {
  case_count: number;
  agreement_count: number;
  agreement_rate: number;
  divergence_count: number;
  /** how many divergent runs each opportunity_id appeared in (on either side) */
  diverged_opportunity_id_tally: Record<string, number>;
  /** agreement at the underlying O3-candidate-pool level (regex_o3_pick vs.
   *  evidence_candidate_ids[0]), independent of what decide() SELECTED. */
  candidate_level_agreement_count: number;
  candidate_level_agreement_rate: number;
  /**
   * Cases where `agree` (final selection) and `candidate_level_agreement`
   * DISAGREE with each other — the "masked divergence" shape: final
   * selection matches while the underlying candidate pools don't (the
   * only direction observed so far, real, in Milestone 1's corpus), or in
   * principle the reverse. Named and counted explicitly, not folded into
   * either raw agreement number.
   */
  metric_divergence_count: number;
  metric_divergence_case_ids: string[];
}

/**
 * Deliberately NOT the same `Report` interface the "evidence" tier uses
 * (`aggregate: EvidenceAggregate`, `cases: EvidenceCaseResult[]`) — widening
 * that interface to a union would force every existing "evidence"-tier
 * caller (runner.ts, its tests) to narrow `report.aggregate`/`report.cases`
 * before use, for a tier they don't produce. A sibling interface, same
 * field names, own tier-specific payload types — additive, zero risk to
 * the existing shape.
 */
export interface ShadowModeReport {
  run_id: string;
  timestamp: string;
  tier: "shadow_mode";
  spec_version: string;
  atlas_version: string;
  pipeline_mode: PipelineMode;
  model: string | null;
  cases: ShadowModeCaseResult[];
  aggregate: ShadowModeAggregate;
}

export function buildShadowModeAggregate(cases: ShadowModeCaseResult[]): ShadowModeAggregate {
  const diverged = cases.filter((c) => !c.metrics.agree);
  const diverged_opportunity_id_tally: Record<string, number> = {};
  for (const c of diverged) {
    const ids = [
      ...(c.metrics.divergence?.regex_only_ids ?? []),
      ...(c.metrics.divergence?.evidence_only_ids ?? []),
    ];
    for (const id of ids) diverged_opportunity_id_tally[id] = (diverged_opportunity_id_tally[id] ?? 0) + 1;
  }

  const candidateLevelAgreed = cases.filter((c) => c.metrics.candidate_level_agreement);
  const metricDivergent = cases.filter((c) => c.metrics.agree !== c.metrics.candidate_level_agreement);

  return {
    case_count: cases.length,
    agreement_count: cases.length - diverged.length,
    agreement_rate: cases.length === 0 ? 1 : (cases.length - diverged.length) / cases.length,
    divergence_count: diverged.length,
    diverged_opportunity_id_tally,
    candidate_level_agreement_count: candidateLevelAgreed.length,
    candidate_level_agreement_rate: cases.length === 0 ? 1 : candidateLevelAgreed.length / cases.length,
    metric_divergence_count: metricDivergent.length,
    metric_divergence_case_ids: metricDivergent.map((c) => c.case_id),
  };
}

export function buildShadowModeReport(opts: {
  pipeline_mode: PipelineMode;
  model: string | null;
  cases: ShadowModeCaseResult[];
}): ShadowModeReport {
  return {
    run_id: `shadow_${opts.pipeline_mode}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    tier: "shadow_mode",
    spec_version: SPEC_VERSION,
    atlas_version: ATLAS_VERSION,
    pipeline_mode: opts.pipeline_mode,
    model: opts.model,
    cases: opts.cases,
    aggregate: buildShadowModeAggregate(opts.cases),
  };
}

export function shadowModeReportFilename(report: ShadowModeReport): string {
  return filenameParts(report.tier, report.spec_version, report.pipeline_mode, report.timestamp);
}
