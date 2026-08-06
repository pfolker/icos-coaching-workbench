/**
 * Tier 2 (Coaching Quality) scoresheet + report format — Phase 1, Step 5.
 *
 * Provider-neutral by construction: a report is judged against a free-form
 * `subject` string (e.g. "coaching-runtime narrator @ claude-sonnet-5" or a
 * future provider name). Nothing here imports a coach, a provider, or a
 * model client — the report holds MANUAL scores a human assigned, and stays
 * a stable shape so scores are comparable across runs, providers, prompt
 * revisions, and model upgrades as the corpus grows.
 *
 * Field names deliberately mirror evidence-benchmark's Report (run_id,
 * timestamp, tier, versions, cases, aggregate) so Tier 1 and Tier 2 reports
 * read the same way — this is the "coaching_quality" sibling of that Tier's
 * "evidence" report, the extension point evidence-benchmark/src/report.ts
 * already anticipated.
 */
import { CRITERIA, Criterion, HARD_FAIL_CRITERIA, ScoreValue } from "./criteria";

export const EVAL_DESIGN_VERSION = "0.1";
export const CORPUS_VERSION = "0.1";
export const TIER = "coaching_quality" as const;

export interface CriterionScore {
  criterion_id: string;
  score: ScoreValue;
  /** short justification a human writes — especially required to explain a 0 or an "n/a" */
  note?: string;
}

export interface CaseScoreSheet {
  case_id: string;
  scores: CriterionScore[];
}

/** A finalized case: derived fields computed from the manual scores. */
export interface CaseResult {
  case_id: string;
  scores: CriterionScore[];
  /** true if any hard-fail criterion scored 0 (fabrication) — fails the case outright */
  hard_fail: boolean;
  /** ids of hard-fail criteria that scored 0 */
  hard_fail_criteria: string[];
  /** true if any criterion is still "pending" (unscored) */
  incomplete: boolean;
  /** mean of numeric (0..3) graded scores, excluding n/a and pending; null while incomplete or if hard_fail */
  graded_mean: number | null;
}

export interface CoachingAggregate {
  case_count: number;
  scored_case_count: number;
  incomplete_case_count: number;
  hard_fail_case_count: number;
  hard_fail_case_ids: string[];
  /** per-criterion mean over cases where that criterion has a numeric score */
  per_criterion_mean: Record<string, number | null>;
  /** overall mean of graded_mean across fully-scored, non-hard-fail cases; null if none */
  overall_graded_mean: number | null;
}

export interface CoachingQualityReport {
  run_id: string;
  timestamp: string;
  tier: typeof TIER;
  eval_design_version: string;
  corpus_version: string;
  /** what produced the coaching output being judged — provider-neutral, free-form */
  subject: string;
  /** provider id that produced the scored output (item 2) — null for a blank/manual sheet */
  provider: string | null;
  /** model id that produced the scored output (item 2) — recorded so comparisons stay honest as this diverges from production's model */
  model: string | null;
  cases: CaseResult[];
  aggregate: CoachingAggregate;
}

function isNumeric(s: ScoreValue): s is 0 | 1 | 2 | 3 {
  return s === 0 || s === 1 || s === 2 || s === 3;
}

/**
 * Build a blank scoresheet for every case id given — one row per case, one
 * cell per criterion, all "pending". This is what a human fills in. Criteria
 * come from the canonical list so a scoresheet can never silently omit one.
 */
export function buildBlankScoreSheet(caseIds: string[], criteria: Criterion[] = CRITERIA): CaseScoreSheet[] {
  return caseIds.map((case_id) => ({
    case_id,
    scores: criteria.map((c) => ({ criterion_id: c.id, score: "pending" as ScoreValue })),
  }));
}

/** Finalize one manually-scored case into a CaseResult (derives hard_fail / incomplete / graded_mean). */
export function finalizeCase(sheet: CaseScoreSheet): CaseResult {
  const scoreById = new Map(sheet.scores.map((s) => [s.criterion_id, s.score]));

  const hard_fail_criteria = HARD_FAIL_CRITERIA.filter((id) => scoreById.get(id) === 0);
  const hard_fail = hard_fail_criteria.length > 0;
  const incomplete = sheet.scores.some((s) => s.score === "pending");

  const numeric = sheet.scores.map((s) => s.score).filter(isNumeric);
  const graded_mean =
    hard_fail || incomplete || numeric.length === 0
      ? null
      : numeric.reduce<number>((a, b) => a + b, 0) / numeric.length;

  return { case_id: sheet.case_id, scores: sheet.scores, hard_fail, hard_fail_criteria, incomplete, graded_mean };
}

export function buildAggregate(cases: CaseResult[]): CoachingAggregate {
  const per_criterion_mean: Record<string, number | null> = {};
  for (const c of CRITERIA) {
    const vals: number[] = [];
    for (const cr of cases) {
      const s = cr.scores.find((x) => x.criterion_id === c.id)?.score;
      if (s !== undefined && isNumeric(s)) vals.push(s);
    }
    per_criterion_mean[c.id] = vals.length === 0 ? null : vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  const hard_fail_case_ids = cases.filter((c) => c.hard_fail).map((c) => c.case_id);
  const fullyScored = cases.filter((c) => !c.incomplete && !c.hard_fail && c.graded_mean !== null);
  const overall_graded_mean =
    fullyScored.length === 0 ? null : fullyScored.reduce((a, c) => a + (c.graded_mean as number), 0) / fullyScored.length;

  return {
    case_count: cases.length,
    scored_case_count: cases.filter((c) => !c.incomplete).length,
    incomplete_case_count: cases.filter((c) => c.incomplete).length,
    hard_fail_case_count: hard_fail_case_ids.length,
    hard_fail_case_ids,
    per_criterion_mean,
    overall_graded_mean,
  };
}

export function buildReport(opts: {
  subject: string;
  sheets: CaseScoreSheet[];
  /** provider + model that produced the scored output (item 2); omit for a blank/manual sheet */
  provider?: string;
  model?: string;
}): CoachingQualityReport {
  const cases = opts.sheets.map(finalizeCase);
  return {
    run_id: `coaching_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    tier: TIER,
    eval_design_version: EVAL_DESIGN_VERSION,
    corpus_version: CORPUS_VERSION,
    subject: opts.subject,
    provider: opts.provider ?? null,
    model: opts.model ?? null,
    cases,
    aggregate: buildAggregate(cases),
  };
}

export function reportFilename(report: CoachingQualityReport): string {
  const ts = report.timestamp.replace(/[:.]/g, "-");
  const subj = report.subject.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "subject";
  return `report_${report.tier}_v${report.eval_design_version}_${subj}_${ts}.json`;
}
