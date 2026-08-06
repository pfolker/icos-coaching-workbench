/**
 * Shadow-mode comparison pipeline. Runs ONE submitted transcript through two
 * independent candidate-producing paths, then feeds BOTH into the same real
 * Decision Engine and renders both through the same real quickScan()
 * (alpha-workbench's proof.ts + categoryMap.ts) — no suppression, no
 * winner picked here.
 *
 * LEFT  = observe() -> generateOpportunities() -> decide() -> quickScan()
 *         Exactly what the live Workbench produces today. Unmodified.
 * RIGHT = the SAME observe() output (for quickScan's positive/GOOD_NOTES
 *         reading, which is keyed off observation_type, not evidence) +
 *         evidence-runtime's Listen LLM -> Validator -> Evidence Graph ->
 *         EvidenceGraphOpportunityAdapter -> decide() on
 *         [regex candidates, ...adapter candidates] (additional pool, never
 *         a replacement) -> quickScan().
 *
 * No engine imported here is modified. No Narrator, no free-generated text.
 */
import { observe } from "../../observation-engine/src/index";
import { generateOpportunities } from "../../opportunity-engine/src/index";
import { decide } from "../../decision-engine/src/index";
import { quickScan, QuickScan } from "../../alpha-workbench/server/proof";
import { validateEvidence } from "../../evidence-validator/src/index";
import { materializeSourceSpans, ListenEngineRawOutput } from "../../evidence-runtime/src/modelOutput";
import { buildEvidenceGraph, EvidenceGraph } from "../../evidence-runtime/src/evidenceGraph";
import {
  runListenEngineFixture, runListenEngineLive, hasLiveApiKey, NoApiKeyError, LiveCallMeta,
} from "../../evidence-runtime/src/listenEngine";
import { EvidenceGraphOpportunityAdapter, UNMAPPED_OPPORTUNITY_IDS, UnmappedReason } from "./adapter";
import { resolveLadderConflictsForRendering, suppressUnsupportedCandidates } from "./opportunitySuppression";
import { CandidateOpportunity, OpportunityContext } from "../../opportunity-engine/src/types";
import { CoachingDecision } from "../../decision-engine/src/types";

export { NoApiKeyError, hasLiveApiKey };

export type Mode = "live" | "fixture";

export interface ShadowCompareInput {
  transcript: string;
  mode: Mode;
  /** required for fixture mode: a known transcript's hand-authored proposals */
  fixture?: ListenEngineRawOutput;
  context?: OpportunityContext;
}

export interface LeftResult {
  candidates: CandidateOpportunity[];
  decision: CoachingDecision;
  /** always [] on LEFT — a single regex pass can never trigger a ladder
   *  conflict (Step 2). Exposed anyway so the byte-identical, no-op claim
   *  is visible in the API, not just asserted in a comment. */
  ladder_conflicts_resolved: string[];
  quick_scan: QuickScan;
}

export interface RightResult {
  listen_meta?: LiveCallMeta;
  evidence_graph: EvidenceGraph;
  /** the adapter's full, real output — before any collision dedup below */
  adapter_candidates: CandidateOpportunity[];
  /** opportunity_ids the adapter also produced that regex had already fired
   *  this turn (real, observed case: the founder transcript) — dropped from
   *  merged_candidates as redundant, not silently: reported here. */
  adapter_candidates_deduped: string[];
  /** regex candidates + new (non-duplicate) adapter candidates — BEFORE
   *  Milestone 3's pre-decide() suppression below. Kept as its own field,
   *  meaning unchanged from Milestones 1-2, for transparency: this is what
   *  the pool looked like before any candidate was removed. */
  merged_candidates: CandidateOpportunity[];
  /** Milestone 3: candidates suppressed from `merged_candidates` BEFORE
   *  decide() ran, and why — never silent. See opportunitySuppression.ts. */
  candidate_suppressions: { opportunity_id: string; rule_name: string; reasoning: string }[];
  /** merged_candidates MINUS candidate_suppressions — what was ACTUALLY fed
   *  to decide() and to quickScan()'s rendering. */
  final_candidates: CandidateOpportunity[];
  decision: CoachingDecision;
  /** opportunity_ids dropped from quick_scan's RENDERING only (never from
   *  merged_candidates/decision) by ladderExclusivity.ts's contradiction
   *  resolution — real, observed case: the CNC case's O3_missing_result
   *  dropped in favor of O3_unquantified_result. Reported, not silent. */
  ladder_conflicts_resolved: string[];
  quick_scan: QuickScan;
}

export interface ShadowCompareResult {
  transcript: string;
  mode: Mode;
  left: LeftResult;
  right: RightResult;
  unmapped_opportunity_ids: UnmappedReason[];
}

const DEFAULT_CONTEXT: OpportunityContext = { question_type: "behavioral" };

export async function runShadowCompare(input: ShadowCompareInput): Promise<ShadowCompareResult> {
  const { transcript, mode } = input;
  const ctx = input.context ?? DEFAULT_CONTEXT;

  // ---- shared: the real, unmodified regex Observation Engine (used by BOTH
  // columns — LEFT for its own candidates, RIGHT for quickScan's GOOD_NOTES
  // positives, which are keyed off observation_type, never off evidence) ----
  const observations = observe({ transcript });

  // ---- LEFT: exactly today's live Workbench path ----
  const leftCandidates = generateOpportunities({ observation_set: observations, context: ctx });
  const leftDecision = decide({
    candidates: leftCandidates, coaching_state: "flowing", mission: null, learner_model: null,
  });
  const leftSelectedId = leftDecision.decision_type === "coach_one"
    ? leftDecision.selected!.opportunity.opportunity_id : undefined;
  const leftIdsForRender = leftCandidates.map((c) => c.opportunity_id);
  const leftResolvedIds = resolveLadderConflictsForRendering(leftIdsForRender, leftSelectedId);
  const leftLadderConflictsResolved = leftIdsForRender.filter((id) => !leftResolvedIds.includes(id));
  const leftQuickScan = quickScan(observations, leftResolvedIds, leftCandidates);

  // ---- RIGHT: Listen LLM -> Validator -> Evidence Graph -> adapter ----
  let listenRaw: ListenEngineRawOutput;
  let listen_meta: LiveCallMeta | undefined;
  if (mode === "fixture") {
    if (!input.fixture) {
      throw new Error("fixture mode requires a known case's hand-authored ListenEngineRawOutput");
    }
    listenRaw = runListenEngineFixture(input.fixture).raw;
  } else {
    const live = await runListenEngineLive(transcript);
    listenRaw = live.raw;
    if (live.mode === "live") listen_meta = live.meta;
  }

  const validatorOutput = validateEvidence(materializeSourceSpans(transcript, listenRaw));
  const evidenceGraph = buildEvidenceGraph(validatorOutput);
  const adapterCandidates = EvidenceGraphOpportunityAdapter(evidenceGraph, ctx);

  // additional pool, never a replacement: regex candidates are carried over
  // unchanged into the merged array. EXCEPT for an exact opportunity_id
  // collision (confirmed real: the founder case has regex AND the adapter
  // independently agreeing on O3_unquantified_result) — feeding decide() the
  // same opportunity_id twice isn't "two different opinions" the way O5's
  // disagreement is, it's redundant noise from two detectors agreeing, and
  // quickScan's uncapped flag rendering would otherwise show the identical
  // flag label twice. The regex-originated entry wins the collision (this
  // pool is explicitly "additional", not "replacement" — the adapter only
  // ever ADDS an opportunity_id the regex pool doesn't already have).
  const leftIds = new Set(leftCandidates.map((c) => c.opportunity_id));
  const newAdapterCandidates = adapterCandidates.filter((c) => !leftIds.has(c.opportunity_id));
  const dedupedIds = adapterCandidates
    .filter((c) => leftIds.has(c.opportunity_id))
    .map((c) => c.opportunity_id);
  const mergedCandidates = [...leftCandidates, ...newAdapterCandidates];

  // Milestone 3: PRE-decide() candidate suppression (O5 specificity rule).
  // Unlike ladder-exclusivity (below), this runs BEFORE decide() — confirmed
  // necessary, not a style choice: the flagship founder_retry case shows
  // O5_vagueness winning root_cause priority (HABIT_DAG: O3_unquantified_
  // result's habit H5 sits inside O5_vagueness's own habit H4's downstream
  // closure), which outranks confidence entirely. Merely ADDING a competing
  // candidate (Milestones 1-2's mechanism) can never change a root_cause
  // outcome — only removing the candidate whose own premise is evidentially
  // false does. See opportunitySuppression.ts's top comment for the full
  // investigation.
  const { candidates: finalCandidates, suppressed: candidateSuppressions } =
    suppressUnsupportedCandidates(mergedCandidates, evidenceGraph);

  const rightDecision = decide({
    candidates: finalCandidates, coaching_state: "flowing", mission: null, learner_model: null,
  });
  // Ladder-exclusivity resolution applies ONLY here — to the id list handed
  // to quickScan for rendering — never to the candidates array itself.
  // decide() above already received the full (post-Milestone-3-suppression)
  // pool; ladder-exclusivity was never about WHICH candidates exist, only
  // about what quickScan's uncapped flag loop renders when a regex source
  // and an evidence source disagree about the SAME O3 ladder. Passing
  // rightSelectedId protects the actual selection from suppression — see
  // ladderExclusivity.ts's doc comment for the full reasoning.
  const rightSelectedId = rightDecision.decision_type === "coach_one"
    ? rightDecision.selected!.opportunity.opportunity_id : undefined;
  const rightIdsForRender = finalCandidates.map((c) => c.opportunity_id);
  const rightResolvedIds = resolveLadderConflictsForRendering(rightIdsForRender, rightSelectedId);
  const rightLadderConflictsResolved = rightIdsForRender.filter((id) => !rightResolvedIds.includes(id));
  const rightQuickScan = quickScan(observations, rightResolvedIds, finalCandidates);

  return {
    transcript,
    mode,
    left: {
      candidates: leftCandidates, decision: leftDecision,
      ladder_conflicts_resolved: leftLadderConflictsResolved, quick_scan: leftQuickScan,
    },
    right: {
      listen_meta, evidence_graph: evidenceGraph, adapter_candidates: adapterCandidates,
      adapter_candidates_deduped: dedupedIds,
      merged_candidates: mergedCandidates,
      candidate_suppressions: candidateSuppressions,
      final_candidates: finalCandidates,
      ladder_conflicts_resolved: rightLadderConflictsResolved,
      decision: rightDecision, quick_scan: rightQuickScan,
    },
    unmapped_opportunity_ids: UNMAPPED_OPPORTUNITY_IDS,
  };
}
