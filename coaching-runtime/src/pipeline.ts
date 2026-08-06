/**
 * Coaching Runtime Prototype — full pipeline for one Evidence Graph (or a
 * pair, for contrast_attempts): Teaching Move -> Coaching Act -> Narrator
 * (the one LLM call) -> Guardrail -> final learner-facing text.
 *
 * FALLBACK DESIGN DECISION (Step 5): when the Narrator's message fails the
 * guardrail, this pipeline does NOT show nothing, and does NOT show the
 * failing text. It substitutes a templated message that quotes the
 * referenced evidence directly ("You mentioned: '...'"). Reasoning:
 *  - Silent rejection wastes a Teaching Move and evidence selection that
 *    were both computed correctly — only the Narrator's prose failed. The
 *    learner gets nothing even though real, valid, grounded evidence was
 *    already in hand.
 *  - "Silence is preferable to an unearned claim" (this project's own
 *    repeated principle) is about not fabricating evaluation, not about
 *    denying output whenever something upstream succeeded. A direct quote
 *    template asserts nothing beyond "you said this" — it is mechanically
 *    incapable of violating any of the 7 categories, since it contains no
 *    generated judgment at all.
 *  - This is exactly the shape of CA-002 ("You mentioned...— ALLOWED,
 *    Highlight Evidence"), the safest coaching act in the whole Atlas.
 *
 * GROUNDING CHECK (8th check, added after a real incident): the 7
 * guardrail categories check tone; none of them check whether the message
 * is actually TRUE relative to its own cited evidence. A real fixture bug
 * (Case 001 asserting "an indicator check" that exists nowhere in Case
 * 001's evidence) slipped straight through all 7 categories, since nothing
 * about that sentence is evaluative. The grounding check runs alongside
 * the guardrail; either one failing routes to the same evidence-quoting
 * fallback, for the same reason — see grounding.ts.
 */
import { EvidenceGraph } from "../../evidence-runtime/src/evidenceGraph";
import { selectTeachingMove, TeachingMoveResult } from "./teachingMove";
import { assembleCoachingAct, CoachingAct } from "./coachingAct";
import { runNarratorFixture, runNarratorLive, NarratorInputEvidence, NarratorResult } from "./narrator";
import { guardrailCheck, GuardrailResult } from "./guardrail";
import { groundingCheck, GroundingResult } from "./grounding";

export interface CoachingRuntimeResult {
  case_id: string;
  evidence_graph: EvidenceGraph;
  retry_evidence_graph: EvidenceGraph | null;
  teaching_move: TeachingMoveResult;
  coaching_act: CoachingAct;
  narrator_result: NarratorResult;
  guardrail: GuardrailResult;
  grounding: GroundingResult;
  final_text: string;
  fallback_used: boolean;
}

export interface RunCoachingRuntimeOptions {
  case_id: string;
  graph: EvidenceGraph;
  retryGraph?: EvidenceGraph;
  mode: "fixture" | "live";
  /** Required when mode === "fixture" — the hand-authored Narrator message to use. */
  fixtureMessage?: string;
}

export function evidenceFor(ids: string[], graph: EvidenceGraph, retryGraph?: EvidenceGraph): NarratorInputEvidence[] {
  const pool = retryGraph ? [...graph.nodes, ...retryGraph.nodes] : graph.nodes;
  return ids
    .map((id) => pool.find((n) => n.id === id))
    .filter((n): n is NonNullable<typeof n> => !!n)
    .map((n) => ({ claim_id: n.id, quote: n.quote }));
}

export function buildFallbackText(evidence: NarratorInputEvidence[]): string {
  if (evidence.length === 0) return "Let's look at this answer again — nothing specific enough to quote yet.";
  const quotes = evidence.slice(0, 2).map((e) => `"${e.quote}"`).join(" and ");
  return `You mentioned: ${quotes}.`;
}

export async function runCoachingRuntime(opts: RunCoachingRuntimeOptions): Promise<CoachingRuntimeResult> {
  const move = selectTeachingMove(opts.graph, opts.retryGraph);
  const act = assembleCoachingAct(move);
  const evidence = evidenceFor(act.evidence_refs, opts.graph, opts.retryGraph);

  const narrator_result = opts.mode === "fixture"
    ? runNarratorFixture(opts.fixtureMessage ?? "")
    : await runNarratorLive(act, evidence);

  const guardrail = guardrailCheck(narrator_result.message);
  const grounding = groundingCheck(narrator_result.message, evidence.map((e) => e.quote));
  const passed = guardrail.passed && grounding.passed;
  const fallback_used = !passed;
  const final_text = passed ? narrator_result.message : buildFallbackText(evidence);

  act.message = narrator_result.message;

  return {
    case_id: opts.case_id,
    evidence_graph: opts.graph,
    retry_evidence_graph: opts.retryGraph ?? null,
    teaching_move: move,
    coaching_act: act,
    narrator_result,
    guardrail,
    grounding,
    final_text,
    fallback_used,
  };
}
