/**
 * Shadow-mode Evidence Runtime integration — Project A Milestone 1
 * (evidence-shadow-integration-plan-v0.1.md). Reuses, never reimplements:
 * `runShadowCompare()` from evidence-shadow-compare, which itself reuses
 * `EvidenceGraphOpportunityAdapter` and `resolveLadderConflictsForRendering`
 * (the already-tested O3-ladder adapter and the orphaned-selection fix from
 * tonight's earlier work). If a bug is ever found in the adapter or the
 * ladder-exclusivity logic, fix it in evidence-shadow-compare — never fork
 * a second copy here.
 *
 * HARD BOUNDARIES (enforced by this file's own structure, not just prose):
 *  - This module's exported function returns void and is called
 *    fire-and-forget from orchestrator.ts, AFTER the real session/turn
 *    state has already been committed and the real response object built.
 *    It never receives the mutable `Session`/`Turn` objects — only a
 *    case_id string, the transcript, and a plain context object — so there
 *    is no code path by which it could mutate rendered state even by
 *    accident.
 *  - Scope is the O3 ladder only: this file never imports, constructs, or
 *    references any opportunity_id outside what
 *    EvidenceGraphOpportunityAdapter already produces (O3_missing_result /
 *    O3_unquantified_result). No Narrator exists anywhere in this file.
 *  - Gated behind an explicit env flag (Phase 1 of the rollout plan:
 *    "running only on deliberate internal test submissions" — not
 *    automatic for all traffic, since there is no sampling decision to
 *    make yet for an internal engineering tool).
 *  - Never throws past its own boundary: a live Listen Engine failure, a
 *    missing API key, or a disk-write failure is logged and swallowed,
 *    never surfaced to the real session response.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runShadowCompare, hasLiveApiKey, ShadowCompareResult } from "../../evidence-shadow-compare/src/pipeline";
import {
  buildShadowModeReport, shadowModeReportFilename, ShadowModeCaseResult, ShadowModeDivergence,
  ShadowModeRecommendation,
} from "../../evidence-benchmark/src/report";
import { OpportunityContext } from "../../opportunity-engine/src/types";

/**
 * Mechanical recommendation — NOT a per-transcript human judgment (that's
 * the Milestone 1 validation corpus report, see README.md, which can and
 * sometimes does differ from this rule). Computed identically for every
 * case:
 *  - agree: nothing to recommend between.
 *  - evidence_selected_id is the grounded-outcome finding
 *    (O3_unquantified_result) AND regex's own pick was itself an
 *    absence-based read (O3_missing_result, O5_vagueness, or nothing) ->
 *    recommend evidence. Presence beats an absence heuristic (same
 *    reasoning already established for resolveLadderConflictsForRendering).
 *  - otherwise, the disagreement traces to Decision Engine PRIORITIZATION
 *    (e.g. a root_cause escalation from an id the adapter doesn't map,
 *    like O4_ownership_hiding — the real checkout-outage case that
 *    motivated this distinction) -> "uncertain", not "evidence". Whether
 *    an unmapped id's priority escalation should outrank a real O3 finding
 *    is a genuinely harder, unresolved Decision-Engine-level question this
 *    mechanical rule does not overclaim an answer to.
 */
const ABSENCE_BASED_IDS = new Set(["O3_missing_result", "O5_vagueness"]);

function buildFinalRecommendation(
  agree: boolean, regex_selected_id: string | null, evidence_selected_id: string | null
): ShadowModeRecommendation {
  if (agree) {
    return {
      source: "agree",
      reason: regex_selected_id === null
        ? "both sides returned reinforce_only (no coachable candidate this turn)"
        : `both sides selected ${regex_selected_id}`,
    };
  }
  if (evidence_selected_id === "O3_unquantified_result" &&
      (regex_selected_id === null || ABSENCE_BASED_IDS.has(regex_selected_id))) {
    return {
      source: "evidence",
      reason: "the Evidence Graph found an admissibly-grounded outcome claim that regex's own absence-based detector(s) missed — a real result exists, just unquantified; presence beats an absence heuristic (same reasoning already established in evidence-shadow-compare's ladder-exclusivity fix)",
    };
  }
  return {
    source: "uncertain",
    reason: `regex's selection (${regex_selected_id ?? "reinforce_only"}) reflects Decision Engine prioritization not reducible to outcome quantification (e.g. a priority-class escalation from an id the adapter doesn't map) — whether it should outrank the evidence-side finding (${evidence_selected_id ?? "none"}) is a Decision-Engine-level question this mechanical rule does not resolve`,
  };
}

const here = dirname(fileURLToPath(import.meta.url));
export const SHADOW_LOG_DIR = join(here, "../logs/shadow");

/** Phase 1 gate: deliberate internal test submissions only, per the
 *  Integration Plan's rollout section — never on by default. */
export function isShadowModeEnabled(): boolean {
  return process.env.ALPHA_WORKBENCH_SHADOW_MODE === "true";
}

function transcriptHash(transcript: string): string {
  return createHash("sha256").update(transcript).digest("hex").slice(0, 16);
}

/**
 * Builds the ShadowModeCaseResult from a completed comparison. `agree`
 * compares SELECTED opportunity_id (Today's Focus), including the case
 * where both sides are `null` (both reinforce_only) counting as agreement.
 * When they disagree, `divergence.reason` is decide()'s OWN real
 * `reasoning.explanation` for the RIGHT/merged decision, surfaced
 * verbatim — never a re-derived or guessed explanation of why they
 * differ.
 */
export function buildShadowModeCaseResult(case_id: string, r: ShadowCompareResult): ShadowModeCaseResult {
  const regex_selected_id = r.left.decision.decision_type === "coach_one"
    ? r.left.decision.selected!.opportunity.opportunity_id : null;
  const evidence_selected_id = r.right.decision.decision_type === "coach_one"
    ? r.right.decision.selected!.opportunity.opportunity_id : null;
  const agree = regex_selected_id === evidence_selected_id;

  let divergence: ShadowModeDivergence | null = null;
  if (!agree) {
    const regexIds = new Set<string>(r.left.candidates.map((c) => c.opportunity_id));
    const evidenceIds = new Set<string>(r.right.adapter_candidates.map((c) => c.opportunity_id));
    const regex_only_ids: string[] = [...regexIds].filter((id) => !evidenceIds.has(id));
    const evidence_only_ids: string[] = [...evidenceIds].filter((id) => !regexIds.has(id));
    // decide()'s top-level `explanation` narrative alone is often thin for
    // a simple standard-pool tiebreak (real, observed case: it can be just
    // one line, "intervention fork on H5: ...", saying nothing about WHY
    // one candidate beat another) — the actual tiebreak reason lives in
    // `rejected`, keyed by opportunity_id. Both are decide()'s own real
    // output; neither is re-derived or guessed.
    const relevantRejections = r.right.decision.reasoning.rejected
      .filter((rj) => regex_only_ids.includes(rj.opportunity_id) || evidence_only_ids.includes(rj.opportunity_id))
      .map((rj) => `${rj.opportunity_id} rejected by ${rj.rejected_by_rule} (${rj.reason})`);
    divergence = {
      regex_only_ids,
      evidence_only_ids,
      reason: [...r.right.decision.reasoning.explanation, ...relevantRejections].join("; "),
    };
  }

  // the adapter never produces more than one candidate (Step 2's own
  // mutual-exclusivity guarantee) — its own quoted evidence.spans are the
  // "supporting evidence" for whichever O3-ladder state it found. Empty
  // for O3_missing_result: absence IS the finding, there's nothing to quote.
  const supporting_evidence = r.right.adapter_candidates[0]?.evidence.spans.map((s) => s.span_text) ?? [];

  // Real, confirmed finding from the Milestone 1 validation corpus: `agree`
  // (which SELECTED id won) can hide a genuine O3-ladder disagreement when
  // an unmapped id (e.g. O4_ownership_hiding) wins root_cause priority on
  // both sides regardless of what the O3 candidates say. regex_o3_pick /
  // candidate_level_agreement compare the underlying candidate pools
  // directly, independent of what decide() ultimately selected.
  const O3_LADDER_IDS = new Set(["O3_missing_result", "O3_unquantified_result"]);
  const regex_o3_pick = r.left.candidates.map((c) => c.opportunity_id).find((id) => O3_LADDER_IDS.has(id)) ?? null;
  const evidence_o3_pick = r.right.adapter_candidates[0]?.opportunity_id ?? null;
  const candidate_level_agreement = regex_o3_pick === evidence_o3_pick;

  return {
    case_id,
    tier: "shadow_mode",
    metrics: {
      transcript_hash: transcriptHash(r.transcript),
      regex_candidate_ids: r.left.candidates.map((c) => c.opportunity_id),
      regex_selected_id,
      evidence_candidate_ids: r.right.adapter_candidates.map((c) => c.opportunity_id),
      merged_candidate_ids: r.right.merged_candidates.map((c) => c.opportunity_id),
      evidence_selected_id,
      ladder_conflicts_resolved: r.right.ladder_conflicts_resolved,
      supporting_evidence,
      agree,
      divergence,
      final_recommendation: buildFinalRecommendation(agree, regex_selected_id, evidence_selected_id),
      regex_o3_pick,
      candidate_level_agreement,
      candidate_suppressions: r.right.candidate_suppressions.map((s) => ({
        opportunity_id: s.opportunity_id, rule_name: s.rule_name,
      })),
    },
  };
}

/**
 * One JSON file per run (not a single appendable log). Reasoning: this
 * mirrors evidence-benchmark's own already-established convention
 * (reportFilename() — one file per benchmark run) exactly, rather than
 * inventing a second persistence style; it makes it trivial to correlate
 * one specific real Workbench session/turn back to its own shadow log
 * file by filename/case_id, without needing to parse a shared log to find
 * one run's entry; and cross-run aggregation (buildShadowModeAggregate)
 * already works over an array of parsed case results regardless of
 * whether they came from one file or many, so nothing is lost by not
 * appending to a single file.
 */
function persist(caseResult: ShadowModeCaseResult, model: string | null): string {
  const report = buildShadowModeReport({ pipeline_mode: "live", model, cases: [caseResult] });
  mkdirSync(SHADOW_LOG_DIR, { recursive: true });
  const filename = shadowModeReportFilename(report);
  writeFileSync(join(SHADOW_LOG_DIR, filename), JSON.stringify(report, null, 2));
  return filename;
}

/**
 * Fire-and-forget. Callers MUST NOT `await` this on the path that produces
 * the real response — see orchestrator.ts's submitAnswer() call site,
 * which calls this without awaiting, after the real response object is
 * already built. Never throws: every failure mode (shadow mode disabled,
 * no API key, live Listen Engine call failure, disk write failure) is
 * caught here and only logged to console — it can never propagate back
 * into the real request/response cycle.
 */
export async function runShadowPass(
  case_id: string, transcript: string, context: OpportunityContext
): Promise<void> {
  if (!isShadowModeEnabled()) return;
  if (!hasLiveApiKey()) {
    console.warn(`[shadow-mode] skipped for ${case_id}: no ANTHROPIC_API_KEY configured (fixture mode cannot cover arbitrary real submissions)`);
    return;
  }
  try {
    const result = await runShadowCompare({ transcript, mode: "live", context });
    const caseResult = buildShadowModeCaseResult(case_id, result);
    const model = result.right.listen_meta?.model ?? null;
    const filename = persist(caseResult, model);
    console.log(`[shadow-mode] ${case_id}: agree=${caseResult.metrics.agree} -> logs/shadow/${filename}`);
  } catch (e) {
    console.error(`[shadow-mode] error for ${case_id}:`, (e as Error).message);
  }
}
