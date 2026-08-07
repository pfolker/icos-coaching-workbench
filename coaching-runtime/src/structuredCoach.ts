/**
 * Structured Coach v0.1 (Phase 2, item 3).
 *
 * Extends this package's existing gray-band pipeline — Teaching Move ->
 * Coaching Act -> Narrator -> Guardrail + Grounding -> final learner text —
 * with ONE change: the Narrator step goes through the extracted CoachProvider
 * seam (coachProvider.ts) instead of a direct fetch, and the model id is an
 * explicit parameter (item 2). This is the unit the Tier 2 benchmark scores.
 *
 * Deliberately NOT in scope here (later phases): the Voice / Method /
 * Reasoning-Engine split, any new teaching logic, retry/streaming/tools. This
 * v0.1 is the smallest thing that is a "coach behind the seam" and nothing
 * more — so the benchmark measures the seam + existing pipeline honestly,
 * before richer structure is added on top.
 *
 * Reuses the pipeline's own helpers (selectTeachingMove, assembleCoachingAct,
 * evidenceFor, buildUserMessage, guardrailCheck, groundingCheck,
 * buildFallbackText) rather than reimplementing them — same discipline as the
 * rest of this codebase.
 */
import { EvidenceGraph } from "../../evidence-runtime/src/evidenceGraph";
import { selectTeachingMove, TeachingMoveResult } from "./teachingMove";
import { assembleCoachingAct, CoachingAct } from "./coachingAct";
import { NARRATOR_SYSTEM_PROMPT } from "./narratorPrompt";
import { buildUserMessage, DEFAULT_MODEL } from "./narrator";
import { guardrailCheck, GuardrailResult } from "./guardrail";
import { groundingCheck, GroundingResult } from "./grounding";
import { evidenceFor, buildFallbackText } from "./pipeline";
import { AnthropicCoachProvider, CoachProvider, ProviderCallMeta } from "./coachProvider";

/** The Narrator's existing token budget — kept identical so v0.1 changes only the seam, not the behavior. */
const COACH_MAX_TOKENS = 300;

/**
 * Readiness predicate (readiness-decoupling): does the answer state a
 * MEANINGFUL result? Structural approximation from claim_types the Listen
 * stage already assigned — a business_value claim (a stated impact) OR ≥2
 * outcome claims (more than a single bare "it worked"). Deliberately does NOT
 * use has_quantity: an unquantified-but-real result (Case 001) must still
 * count. KNOWN LIMITATION: this is a structural proxy — it counts result-shaped
 * claims, it does not judge whether the result is substantive. A substantive
 * SINGLE result with no business_value would be under-counted here. See report:
 * flagged as a third Semantic-Opportunity-Detector anchor.
 */
export function computeResultReadiness(graph: EvidenceGraph): boolean {
  const hasBusinessValue = graph.nodes.some((n) => n.claim_type === "business_value");
  const outcomeCount = graph.nodes.filter((n) => n.claim_type === "outcome").length;
  return hasBusinessValue || outcomeCount >= 2;
}

export interface StructuredCoachOptions {
  graph: EvidenceGraph;
  retryGraph?: EvidenceGraph;
  /** the provider seam — defaults to Anthropic, injectable for tests/other providers */
  provider?: CoachProvider;
  /** explicit model id (item 2). Defaults to the Narrator's DEFAULT_MODEL only if omitted. */
  model?: string;
}

export interface StructuredCoachResult {
  teaching_move: TeachingMoveResult;
  coaching_act: CoachingAct;
  /** the provider's raw message, before guardrail/grounding */
  raw_message: string;
  guardrail: GuardrailResult;
  grounding: GroundingResult;
  /** what the learner would actually see (raw message, or the evidence-quoting fallback on any failure) */
  final_text: string;
  fallback_used: boolean;
  /** which evidence quotes the coach was allowed to use (grounding is checked against these) */
  evidence_quotes: string[];
  /** readiness decision, SEPARATE from the move: does the answer state a meaningful result? (drives ADVANCE vs RETRY on highlight_strength) */
  has_meaningful_result: boolean;
  /** provider + model that produced this output — recorded so scoring stays honest (item 2) */
  provider: string;
  model: string;
  meta: ProviderCallMeta;
}

/**
 * Run the structured coach on one Evidence Graph (or a graph pair for a
 * retry). Makes exactly one provider call. Throws whatever the provider
 * throws (e.g. NoApiKeyError) — no silent fallback to a fabricated message.
 */
export async function runStructuredCoach(opts: StructuredCoachOptions): Promise<StructuredCoachResult> {
  const provider = opts.provider ?? new AnthropicCoachProvider();
  const model = opts.model ?? DEFAULT_MODEL;

  const move = selectTeachingMove(opts.graph, opts.retryGraph);
  const act = assembleCoachingAct(move);
  const evidence = evidenceFor(act.evidence_refs, opts.graph, opts.retryGraph);
  const has_meaningful_result = computeResultReadiness(opts.graph);
  const userMessage = buildUserMessage(act, evidence, { hasMeaningfulResult: has_meaningful_result });

  const completion = await provider.complete(NARRATOR_SYSTEM_PROMPT, userMessage, { model, max_tokens: COACH_MAX_TOKENS });
  const raw_message = completion.text.trim();

  const guardrail = guardrailCheck(raw_message);
  const grounding = groundingCheck(raw_message, evidence.map((e) => e.quote));
  const passed = guardrail.passed && grounding.passed;

  act.message = raw_message;

  return {
    teaching_move: move,
    coaching_act: act,
    raw_message,
    guardrail,
    grounding,
    final_text: passed ? raw_message : buildFallbackText(evidence),
    fallback_used: !passed,
    evidence_quotes: evidence.map((e) => e.quote),
    has_meaningful_result,
    provider: completion.meta.provider,
    model: completion.meta.model,
    meta: completion.meta,
  };
}
