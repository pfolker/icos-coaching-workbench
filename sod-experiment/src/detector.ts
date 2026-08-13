/**
 * SOD v0.1 — one provider call per answer, then deterministic validation.
 *
 * Reuses the existing CoachProvider seam (coaching-runtime/src/coachProvider.ts)
 * read-only. It does not modify that package, and nothing in the repository
 * imports this one — the structured coach's behavior is unchanged by
 * construction, not by promise.
 *
 * Single-call discipline, same as the Narrator and the Listen Engine: one call,
 * no loops, no self-correction pass.
 */
import { EvidenceGraph } from "../../evidence-runtime/src/evidenceGraph";
import { AnthropicCoachProvider, CoachProvider, ProviderCallMeta } from "../../coaching-runtime/src/coachProvider";
import { SEMANTIC_TAGS, SemanticTag } from "./vocabulary";
import { SOD_SYSTEM_PROMPT } from "./sodPrompt";
import { buildSodInput, renderSodInput, suppliedIds, SodInput } from "./sodInput";

/**
 * MECHANICAL FIX, run 0 → run 1 (Work Order Section 15: a purely mechanical
 * defect that prevented the experiment from executing as specified). The first
 * live pass used 1024, and 7 of 24 runs came back with `stop_reason:
 * max_tokens`, all 1024 output tokens spent inside a `thinking` block and no
 * text block emitted at all — the model reasons before answering, and the
 * budget ran out first. Those runs were void, not negative: SOD never got to
 * answer. The prompt is unchanged by this fix, so the one authorized prompt
 * revision is not spent here.
 */
const SOD_MAX_TOKENS = 4096;

export const SOD_DEFAULT_MODEL = "claude-sonnet-5";

export interface SemanticObservation {
  tag: SemanticTag;
  /** ids of supplied claims/relationships supporting the observation — never empty once accepted */
  evidence_refs: string[];
  confidence: number;
  /** engineer-facing audit note. NEVER learner-facing; carries no coaching language. */
  basis: string;
}

/** An observation the model returned that did NOT survive validation, kept for honest reporting. */
export interface RejectedObservation {
  raw: unknown;
  reason:
    | "tag_outside_vocabulary"
    | "no_evidence_refs"
    | "untraceable_evidence_ref"
    | "malformed";
  detail: string;
}

export interface SodResult {
  case_id: string;
  /** observations that passed validation — the experiment's unit of measurement */
  observations: SemanticObservation[];
  /** everything the model proposed that was thrown away, and why */
  rejected: RejectedObservation[];
  /** the provider's untouched text, so nothing about a run is unrecoverable */
  raw_response: string;
  parse_failed: boolean;
  /**
   * true when the provider returned no text block at all (e.g. the output
   * budget was exhausted before the answer began). Such a run is VOID — SOD
   * never answered — and must not be counted as "detected nothing".
   */
  no_text_block: boolean;
  input: SodInput;
  provider: string;
  model: string;
  meta: ProviderCallMeta;
}

/** Tolerates a fenced code block, since a stray fence is a formatting slip and not a semantic failure. */
export function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenced?.[1]) return fenced[1].trim();
  return trimmed;
}

/**
 * The traceability gate required by Work Order Section 5: an observation that
 * cannot be traced to evidence supplied to SOD must not be accepted. This runs
 * deterministically over the model's output — the model is not trusted to
 * police itself.
 */
export function validateObservations(
  raw: unknown,
  ids: Set<string>,
): { observations: SemanticObservation[]; rejected: RejectedObservation[] } {
  const observations: SemanticObservation[] = [];
  const rejected: RejectedObservation[] = [];

  if (!Array.isArray(raw)) return { observations, rejected };

  for (const item of raw) {
    if (typeof item !== "object" || item === null) {
      rejected.push({ raw: item, reason: "malformed", detail: "observation is not an object" });
      continue;
    }
    const o = item as Record<string, unknown>;
    const tag = o["tag"];
    if (typeof tag !== "string" || !(SEMANTIC_TAGS as readonly string[]).includes(tag)) {
      rejected.push({ raw: item, reason: "tag_outside_vocabulary", detail: `tag=${JSON.stringify(tag)}` });
      continue;
    }
    const refs = o["evidence_refs"];
    if (!Array.isArray(refs) || refs.length === 0) {
      rejected.push({ raw: item, reason: "no_evidence_refs", detail: `evidence_refs=${JSON.stringify(refs)}` });
      continue;
    }
    const untraceable = refs.filter((r) => typeof r !== "string" || !ids.has(r));
    if (untraceable.length > 0) {
      rejected.push({
        raw: item,
        reason: "untraceable_evidence_ref",
        detail: `not supplied to SOD: ${JSON.stringify(untraceable)}`,
      });
      continue;
    }
    const confidence = typeof o["confidence"] === "number" ? o["confidence"] : NaN;
    observations.push({
      tag: tag as SemanticTag,
      evidence_refs: refs as string[],
      confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : NaN,
      basis: typeof o["basis"] === "string" ? o["basis"] : "",
    });
  }
  return { observations, rejected };
}

export interface RunSodOptions {
  case_id: string;
  graph: EvidenceGraph;
  provider?: CoachProvider;
  model?: string;
}

/**
 * Run SOD on one answer. Throws whatever the provider throws (e.g.
 * NoApiKeyError) — never fabricates observations to keep a run alive.
 */
export async function runSod(opts: RunSodOptions): Promise<SodResult> {
  const provider = opts.provider ?? new AnthropicCoachProvider();
  const model = opts.model ?? SOD_DEFAULT_MODEL;

  const input = buildSodInput(opts.graph);
  const userMessage = renderSodInput(input);

  const completion = await provider.complete(SOD_SYSTEM_PROMPT, userMessage, { model, max_tokens: SOD_MAX_TOKENS });
  const raw_response = completion.text.trim();
  const no_text_block = raw_response.length === 0;

  let parsed: unknown;
  let parse_failed = false;
  try {
    parsed = JSON.parse(extractJson(raw_response));
  } catch {
    parse_failed = true;
    parsed = null;
  }

  const list =
    parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>)["observations"])
      ? (parsed as Record<string, unknown>)["observations"]
      : [];

  const { observations, rejected } = validateObservations(list, suppliedIds(input));

  return {
    case_id: opts.case_id,
    observations,
    rejected,
    raw_response,
    parse_failed,
    no_text_block,
    input,
    provider: completion.meta.provider,
    model: completion.meta.model,
    meta: completion.meta,
  };
}
