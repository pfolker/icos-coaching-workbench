/**
 * Test Build v1's core turn-runner. Reuses the real, unmodified pipeline
 * directly — no reimplementation of any detection/validation/suppression
 * logic:
 *
 *   SUCCESS PATH: evidence-shadow-compare's runShadowCompare(), mode
 *   "live" — this already does observe() -> generateOpportunities() (regex)
 *   AND Listen LLM -> Evidence Validator -> Evidence Graph ->
 *   EvidenceGraphOpportunityAdapter -> opportunitySuppression's real O5
 *   rule -> decide() -> quickScan(), for both the regex-only "left" column
 *   and the evidence-informed "right" column. Unlike every prior shadow-
 *   mode build tonight, THIS package renders the RIGHT side to the learner
 *   — O5 suppression applied live, not shadow-logged only.
 *
 *   FALLBACK PATH (Step 4): if the live Listen LLM call fails, times out,
 *   or the API key is unavailable, runShadowCompare's whole promise
 *   rejects before returning anything (the throw happens inside its RIGHT
 *   branch, after LEFT was already computed but not exposed on failure).
 *   Rather than modifying pipeline.ts to expose partial results, this
 *   function recomputes the regex-only path directly by calling the exact
 *   same real, imported functions runShadowCompare's own LEFT column
 *   calls — observe(), generateOpportunities(), decide(), quickScan() —
 *   which is reuse, not reimplementation: it is the identical mechanism
 *   the live Alpha Workbench already runs today, with zero new logic.
 */
import { observe } from "../../observation-engine/src/index";
import { generateOpportunities } from "../../opportunity-engine/src/index";
import { decide } from "../../decision-engine/src/index";
import { quickScan, QuickScan } from "../../alpha-workbench/server/proof";
import { FLAG_NOTES } from "../../alpha-workbench/server/categoryMap";
import { runShadowCompare, ShadowCompareResult } from "../../evidence-shadow-compare/src/pipeline";
import { SPECIFICITY_CLAIM_TYPES } from "../../evidence-shadow-compare/src/opportunitySuppression";

export interface TodaysFocus {
  label: string;
  explanation: string;
}

export interface TurnResult {
  degraded: boolean;
  degradedReason?: string;
  quickScan: QuickScan;
  todaysFocus: TodaysFocus | null;
}

/**
 * Structured error-cause serialization. Node's fetch throws a generic
 * `TypeError: fetch failed` for any low-level connection failure — the
 * useful diagnostic detail (DNS vs. TCP-refused vs. TLS handshake, etc.)
 * lives one level down in `.cause`, which the previous logging never
 * captured (it only read `.message`). This walks the real cause chain and
 * pulls out structured fields (name, message, and Node's own `code`/
 * `errno`/`syscall` for system-level network errors) rather than just
 * stringifying it — so a reviewer can actually distinguish failure kinds
 * without re-running anything.
 */
export interface SerializedCause {
  name: string | null;
  message: string | null;
  code: string | null;
  errno: number | null;
  syscall: string | null;
  cause: SerializedCause | null;
}

function serializeCause(cause: unknown): SerializedCause | null {
  if (cause == null) return null;
  if (cause instanceof Error) {
    const sys = cause as Error & { code?: string; errno?: number; syscall?: string };
    return {
      name: cause.name,
      message: cause.message,
      code: sys.code ?? null,
      errno: sys.errno ?? null,
      syscall: sys.syscall ?? null,
      cause: serializeCause(cause.cause),
    };
  }
  // Non-Error cause (rare) — keep it visible rather than dropping it.
  return { name: null, message: String(cause), code: null, errno: null, syscall: null, cause: null };
}

/** The Step 2 structured-logging schema, at minimum the fields specified. */
export interface PipelineDiagnostics {
  requestedPipeline: "evidence";
  actualPipeline: "evidence" | "regex_fallback";
  fallbackReason: string | null;
  errorName: string | null;
  errorMessage: string | null;
  errorCause: SerializedCause | null;
  elapsedMs: number;
}

/** Everything Step 5's log needs, whether the turn succeeded or degraded. */
export interface TurnLogDetail {
  timestamp: string;
  transcript: string;
  degraded: boolean;
  degradedReason?: string;
  diagnostics: PipelineDiagnostics;
  /** present only on the real (non-degraded) path */
  live?: {
    regex_fired_candidates: string[];
    evidence_derived_candidates: string[];
    o5_in_merged_pool: boolean;
    candidate_suppressions: { opportunity_id: string; rule_name: string; reasoning: string }[];
    /** replay of the suppression rule's own two gates against the real
     *  Evidence Graph, for a human reviewer's benefit — read-only display,
     *  never re-decides anything (SPECIFICITY_CLAIM_TYPES is the rule's own
     *  exported constant, not a re-derived copy). */
    gate_replay: {
      specificity_claims: { claim_type: string; quote: string }[];
      edge_count: number;
      edges: { relationship_type: string; ordering_basis?: string; marker_text: string }[];
    };
    final_candidates: string[];
    selected_opportunity_id: string | null;
  };
  rendered_quick_scan: QuickScan;
  rendered_todays_focus: TodaysFocus | null;
}

const CONTEXT = { question_type: "behavioral" as const };

function todaysFocusFor(selectedId: string | null): TodaysFocus | null {
  if (!selectedId) return null;
  const entry = FLAG_NOTES[selectedId];
  if (!entry) return null;
  // All real FLAG_NOTES entries carry a static label (only the separate,
  // non-FLAG_NOTES filler-count note uses a computed label) — the fallback
  // to the id is defensive only, never expected to trigger in practice.
  const label = entry.label ?? selectedId;
  return { label, explanation: entry.explanation ?? label };
}

/** The exact regex-only computation runShadowCompare's own LEFT column
 *  performs — called directly, not reimplemented, for the fallback path. */
function runRegexOnlyFallback(transcript: string): { quickScan: QuickScan; todaysFocus: TodaysFocus | null } {
  const observations = observe({ transcript });
  const candidates = generateOpportunities({ observation_set: observations, context: CONTEXT });
  const decision = decide({ candidates, coaching_state: "flowing", mission: null, learner_model: null });
  const ids = candidates.map((c) => c.opportunity_id);
  const scan = quickScan(observations, ids, candidates);
  const selectedId = decision.decision_type === "coach_one" ? decision.selected!.opportunity.opportunity_id : null;
  return { quickScan: scan, todaysFocus: todaysFocusFor(selectedId) };
}

export interface RealTurnOutcome {
  result: TurnResult;
  logDetail: TurnLogDetail;
}

/** Thrown only by the forceFailure test hook, so it flows through the
 *  exact same catch block a genuine network failure or timeout would —
 *  one code path, one diagnostics shape, no special-cased log format. */
class ForcedFailureError extends Error {
  constructor() {
    super("forced failure (verification hook)");
    this.name = "ForcedFailureError";
  }
}

export async function runRealTurn(
  transcript: string,
  opts: { forceFailure?: boolean } = {}
): Promise<RealTurnOutcome> {
  const timestamp = new Date().toISOString();
  const startedAt = Date.now();

  // 45s ceiling: a real hang should degrade gracefully (Step 4's "times
  // out"), not leave a tester staring at the waiting screen indefinitely.
  // Wrapping, not modifying, runShadowCompare/runListenEngineLive.
  const TIMEOUT_MS = 45_000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Live call exceeded ${TIMEOUT_MS}ms`)), TIMEOUT_MS);
  });

  try {
    if (opts.forceFailure) {
      // Verification-only hook (Step 7's forced-failure test). Never sent
      // by the built frontend — see public/app.js, which never sets this
      // field. Throws BEFORE any real call.
      throw new ForcedFailureError();
    }

    const shadow = (await Promise.race([
      runShadowCompare({ transcript, mode: "live", context: CONTEXT }),
      timeout,
    ])) as ShadowCompareResult;
    clearTimeout(timer);
    const elapsedMs = Date.now() - startedAt;

    const selectedId = shadow.right.decision.decision_type === "coach_one"
      ? shadow.right.decision.selected!.opportunity.opportunity_id : null;
    const todaysFocus = todaysFocusFor(selectedId);

    const specificityClaims = shadow.right.evidence_graph.nodes
      .filter((n) => SPECIFICITY_CLAIM_TYPES.has(n.claim_type))
      .map((n) => ({ claim_type: n.claim_type, quote: n.quote }));

    const diagnostics: PipelineDiagnostics = {
      requestedPipeline: "evidence",
      actualPipeline: "evidence",
      fallbackReason: null,
      errorName: null,
      errorMessage: null,
      errorCause: null,
      elapsedMs,
    };

    const logDetail: TurnLogDetail = {
      timestamp,
      transcript,
      degraded: false,
      diagnostics,
      live: {
        regex_fired_candidates: shadow.left.candidates.map((c) => c.opportunity_id),
        evidence_derived_candidates: shadow.right.adapter_candidates.map((c) => c.opportunity_id),
        o5_in_merged_pool: shadow.right.merged_candidates.some((c) => c.opportunity_id === "O5_vagueness"),
        candidate_suppressions: shadow.right.candidate_suppressions,
        gate_replay: {
          specificity_claims: specificityClaims,
          edge_count: shadow.right.evidence_graph.edges.length,
          edges: shadow.right.evidence_graph.edges.map((e) => ({
            relationship_type: e.relationship_type,
            ordering_basis: e.ordering_basis,
            marker_text: e.marker_text,
          })),
        },
        final_candidates: shadow.right.final_candidates.map((c) => c.opportunity_id),
        selected_opportunity_id: selectedId,
      },
      rendered_quick_scan: shadow.right.quick_scan,
      rendered_todays_focus: todaysFocus,
    };

    return {
      result: { degraded: false, quickScan: shadow.right.quick_scan, todaysFocus },
      logDetail,
    };
  } catch (e) {
    clearTimeout(timer);
    const elapsedMs = Date.now() - startedAt;
    const errorName = e instanceof Error ? e.name : null;
    const errorMessage = e instanceof Error ? e.message : String(e);
    const errorCause = e instanceof Error ? serializeCause(e.cause) : null;
    return degrade(transcript, timestamp, {
      requestedPipeline: "evidence",
      actualPipeline: "regex_fallback",
      fallbackReason: errorMessage,
      errorName,
      errorMessage,
      errorCause,
      elapsedMs,
    });
  }
}

function degrade(transcript: string, timestamp: string, diagnostics: PipelineDiagnostics): RealTurnOutcome {
  const fallback = runRegexOnlyFallback(transcript);
  const logDetail: TurnLogDetail = {
    timestamp,
    transcript,
    degraded: true,
    degradedReason: diagnostics.fallbackReason ?? undefined,
    diagnostics,
    rendered_quick_scan: fallback.quickScan,
    rendered_todays_focus: fallback.todaysFocus,
  };
  return {
    result: {
      degraded: true,
      degradedReason: diagnostics.fallbackReason ?? undefined,
      quickScan: fallback.quickScan,
      todaysFocus: fallback.todaysFocus,
    },
    logDetail,
  };
}
