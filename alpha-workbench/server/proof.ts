/**
 * Proof Experience v3.2 — server-side evidence preparation.
 * All GROUNDED in existing artifacts, no engine changes:
 *   quickScan():   Coach's Notes — ✓/⚠ OBSERVATIONS (not coaching), grouped
 *                  under STORY/CREDIBILITY/IMPACT/DELIVERY via categoryMap.ts.
 *                  Uncapped: every fired signal reaches the learner view.
 *   metricsDelta(): communication metrics that GENUINELY CHANGED, V1 → V2
 *   notebookBullets(): "what would an interviewer remember?" — strictly
 *                      evidence-derived, numbers verbatim only, uncapped.
 */
import {
  CREDIBILITY_NEUTRAL_NOTE, FILLER_COUNT_NOTE, FLAG_NOTES, GOOD_NOTES, NoteCategory, NoteEntry, NotePolarity,
} from "./categoryMap";
import { nonNumericStructureGained } from "../../comparison-engine/src/index";
import { CandidateOpportunity } from "../../opportunity-engine/src/types";

interface ObsIn {
  observation_type: string;
  value: string | number | boolean;
  evidence: { sentence_index: number; char_start: number; char_end: number; span_text: string }[];
}
interface SetIn {
  sentences: { index: number; text: string }[];
  observations: ObsIn[];
  metrics: {
    word_count: number; i_count: number; we_count: number;
    agency_verb_i_count: number; quantified_span_count: number;
    numeric_span_count: number; hypothetical_marker_count: number;
    filler_core_count: number;
  };
}

const obsOf = (s: SetIn, t: string) => s.observations.find((o) => o.observation_type === t);
const STRUCT = ["structure_situation_marker", "structure_task_marker", "structure_action_marker", "structure_result_marker"];
const structParts = (s: SetIn) => STRUCT.filter((t) => obsOf(s, t)).length;

// ---------------- Quick Scan / Coach's Notes: observations, never coaching --

export interface QuickScanEntry {
  polarity: "good" | "flag" | "neutral";
  label: string;
  explanation?: string;
  needs_expand: boolean;
}

/**
 * Grouped under STORY/CREDIBILITY/IMPACT/DELIVERY. A category key is present
 * only when there is something real to show under it:
 *  - STORY / IMPACT: present only if a positive or flag actually fired.
 *  - CREDIBILITY: always present (V3.2 Decision B) — either real flags, or
 *    the neutral "checked, nothing found" note when its three detectors ran
 *    and none fired.
 *  - DELIVERY: present only when real filler evidence exists (V3.2 Decision
 *    A). Never manufactured; an absent key means "hidden," not "empty."
 */
export type QuickScan = Partial<Record<NoteCategory, QuickScanEntry[]>>;

/**
 * O3_unquantified_result copy fix: the flag used to render the identical
 * static paragraph regardless of which outcome sentence triggered it,
 * never telling the learner WHICH part of their answer lacks scale. The
 * quote comes from whichever candidate actually fired: either the regex
 * detector (opportunity-engine's detectUnquantifiedResult(), evidence =
 * a bare structure_result_marker keyword match — "eliminated", by design,
 * per that observer's own confidence_basis) or the Evidence Graph adapter
 * (evidence-shadow-compare's EvidenceGraphOpportunityAdapter(), evidence =
 * the outcome claim's real, full quote). Confirmed live against the
 * founder's actual retry and the CNC case (Atlas Case 003): CNC has no
 * structure_result_marker at all, so only the adapter path can ever
 * supply a quote there; the founder's retry has both, and the regex
 * span alone is a single word.
 *
 * The fix that works for both paths without touching either detector:
 * `set.sentences` is already available here. The regex path's evidence
 * carries a real `sentence_index`; resolving the FULL sentence at that
 * index (rather than the bare keyword span) gives quote quality matching
 * the adapter path's own full-clause quotes. The adapter path's evidence
 * uses the sentinel `sentence_index: -1` (see adapter.ts's own comment:
 * position is honestly unavailable at that layer) — for that case,
 * `span_text` is already the full outcome clause, used directly.
 */
const UNQUANTIFIED_RESULT_QUOTE_MAX_CHARS = 100;

/**
 * Confirmed real bug: the founder's actual retry quote reads "...we
 * eliminated the issue completely." — "eliminated" and "completely" both
 * fall AFTER the 100-char truncation point, so the visible quote cuts off
 * at "...became consistent,…" while the static suffix said "there's no
 * sense of scale yet," directly contradicting language that WAS present in
 * the full (untruncated) quote. Closed list, checked against the FULL
 * quote BEFORE truncation — truncation is a display concern only and must
 * never affect which explanation branch fires.
 */
const MAGNITUDE_WORDS = /\b(completely|entirely|fully|eliminated)\b/i;

function truncateQuote(text: string, max = UNQUANTIFIED_RESULT_QUOTE_MAX_CHARS): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + "…";
}

interface UnquantifiedResultQuote {
  /** untruncated — used ONLY for the magnitude-word check, never rendered */
  full: string;
  /** truncated for display */
  truncated: string;
}

function resolveUnquantifiedResultQuote(set: SetIn, firedCandidates?: CandidateOpportunity[]): UnquantifiedResultQuote | undefined {
  const candidate = firedCandidates?.find((c) => c.opportunity_id === "O3_unquantified_result");
  const span = candidate?.evidence.spans[0];
  if (!span || !span.span_text) return undefined;
  let full = span.span_text;
  if (span.sentence_index >= 0) {
    const sentence = set.sentences.find((s) => s.index === span.sentence_index);
    if (sentence) full = sentence.text;
  }
  return { full, truncated: truncateQuote(full) };
}

function unquantifiedResultExplanation(quote: UnquantifiedResultQuote | undefined): string {
  if (!quote) return FLAG_NOTES.O3_unquantified_result!.explanation!;
  if (MAGNITUDE_WORDS.test(quote.full)) {
    return `You said: '${quote.truncated}' — that already tells the interviewer it fully worked. A number or percentage would make the scale even sharper for someone comparing candidates.`;
  }
  return `You said: '${quote.truncated}' — that's a real result, but there's no sense of scale yet. A number, a percentage, or a before-and-after comparison would help the interviewer picture how much actually changed.`;
}

export function quickScan(set: SetIn, firedOpportunityIds: string[], firedCandidates?: CandidateOpportunity[]): QuickScan {
  const scan: QuickScan = {};
  const push = (
    n: NoteEntry | { category: NoteCategory; polarity: NotePolarity; needsExpand: boolean },
    labelOverride?: string,
    explanationOverride?: string
  ) => {
    const cat = n.category;
    (scan[cat] ??= []).push({
      polarity: n.polarity,
      label: labelOverride ?? (n as NoteEntry).label!,
      explanation: explanationOverride ?? (n as NoteEntry).explanation,
      needs_expand: n.needsExpand,
    });
  };

  // ---- positives (Workbench-only reading of raw observations; see categoryMap.ts) ----
  const q = obsOf(set, "quantified_span");
  if (q && q.evidence.length > 0) {
    push(GOOD_NOTES.quantified_span!,
      `Measurable result (${q.evidence.slice(0, 2).map((e) => e.span_text).join(", ")})`);
  }
  if (set.metrics.agency_verb_i_count > 0) push(GOOD_NOTES.agency_verb_i!);
  // V3.6: the other three quarters of the same STAR arc, surfaced the same
  // unconditional way structure_result_marker already was — presence only,
  // no additional gating (the engine's own 0.5 confidence on these is
  // already the ceiling; quickScan doesn't add judgment on top of it).
  if (obsOf(set, "structure_situation_marker")) push(GOOD_NOTES.structure_situation_marker!);
  if (obsOf(set, "structure_task_marker")) push(GOOD_NOTES.structure_task_marker!);
  if (obsOf(set, "structure_action_marker")) push(GOOD_NOTES.structure_action_marker!);
  if (obsOf(set, "structure_result_marker")) push(GOOD_NOTES.structure_result_marker!);
  if (obsOf(set, "result_in_final_sentence") && !obsOf(set, "closing_hedge") && !obsOf(set, "trailing_off")) {
    push(GOOD_NOTES.result_in_final_sentence!);
  }

  // ---- flags (Opportunity Engine ids, uncapped) ----
  for (const id of firedOpportunityIds) {
    if (id === "O10_filler_density") continue; // superseded by the computed count below
    const n = FLAG_NOTES[id];
    if (!n) continue;
    if (id === "O3_unquantified_result") {
      // Copy fix: quote the specific outcome sentence, never the identical
      // static paragraph Today's Focus also shows. FLAG_NOTES.O3_unquantified_
      // result itself stays byte-unchanged — it's still the general text used
      // for Today's Focus (and as the fallback here when no quote resolves).
      push(n, undefined, unquantifiedResultExplanation(resolveUnquantifiedResultQuote(set, firedCandidates)));
      continue;
    }
    push(n);
  }

  // V3.2 Decision A: DELIVERY's only possible entry is this computed filler
  // count. When it doesn't fire, DELIVERY is simply never assigned above —
  // the category key stays absent and renders nothing, rather than an empty
  // header. See categoryMap.ts's GOOD_NOTES comment for why DELIVERY has no
  // positive counterpart to fall back on.
  if (set.metrics.filler_core_count >= 3) {
    push(
      { category: FILLER_COUNT_NOTE.category, polarity: FILLER_COUNT_NOTE.polarity, needsExpand: FILLER_COUNT_NOTE.needsExpand },
      FILLER_COUNT_NOTE.label(set.metrics.filler_core_count)
    );
  }

  // V3.2 Decision B: CREDIBILITY neutral state. All three CREDIBILITY
  // detectors always run to completion whenever quickScan is reached (see
  // categoryMap.ts's CREDIBILITY_NEUTRAL_NOTE comment for the investigation
  // behind this) — so "nothing pushed above" always means "checked, found
  // nothing," never "skipped," and it's safe to fill it in unconditionally.
  if (!scan.CREDIBILITY || scan.CREDIBILITY.length === 0) {
    push(CREDIBILITY_NEUTRAL_NOTE);
  }

  return scan;
}

// ---------------- metrics that genuinely changed ----------------

export interface MetricDelta { label: string; from: string; to: string }

export function metricsDelta(v1: SetIn, v2: SetIn): MetricDelta[] {
  const out: MetricDelta[] = [];
  const push = (label: string, a: string | number, b: string | number) => {
    if (String(a) !== String(b)) out.push({ label, from: String(a), to: String(b) });
  };
  push("Words", v1.metrics.word_count, v2.metrics.word_count);
  push("Filler words", v1.metrics.filler_core_count, v2.metrics.filler_core_count);
  push("Ownership (I / we)", `${v1.metrics.i_count} / ${v1.metrics.we_count}`, `${v2.metrics.i_count} / ${v2.metrics.we_count}`);
  push("Measurable results", v1.metrics.quantified_span_count, v2.metrics.quantified_span_count);
  push("Story parts (of 4)", structParts(v1), structParts(v2));
  return out;
}

// ---------------- the Interviewer's Notebook: what they'd REMEMBER ----------------

/**
 * @param original the FIRST-TAKE observation set, when `set` is a retry.
 *   Omitted when `set` itself is a first take (nothing to diff against).
 *   V3.9 fix: passing this in makes hasTaskOrAction below a NEWLY-PRESENT-
 *   in-retry check (via the same nonNumericStructureGained() the comparison
 *   verdict uses), instead of a presence-anywhere check — see comment below
 *   for why the distinction is load-bearing, not cosmetic.
 */
export function notebookBullets(set: SetIn, original?: SetIn): string[] {
  const b: string[] = [];
  const m = set.metrics;
  if (obsOf(set, "employer_negativity")) b.push("the complaint about a previous employer");
  const quant = obsOf(set, "quantified_span");
  if (quant && quant.evidence.length > 0) {
    b.push(`the numbers: ${quant.evidence.slice(0, 2).map((e) => e.span_text).join(", ")}`);
  }
  if (m.agency_verb_i_count > 0) b.push("that they did it themselves");
  else if (m.we_count >= 3 && m.i_count <= Math.ceil(m.we_count / 2)) b.push("a team story — their own part unclear");
  // V3.9 fix: this used to be a bare presence check ("does this answer have
  // a task/action marker at all"), which could disagree with the comparison
  // verdict's O5_vagueness partial tier — that check only credits a
  // task/action marker NEWLY present in the retry (absent in the original),
  // via the shared nonNumericStructureGained() (also used by comparison-
  // engine's own verdict, so both surfaces read one computation, not two
  // independently-maintained checks that merely happened to agree). A retry
  // whose task marker was ALSO present in the original (so the verdict does
  // NOT credit it as improvement) would still have suppressed bullets below
  // under the old presence-anywhere check, understating what the Notebook
  // should say versus what the verdict says on the SAME answer. When there's
  // no `original` to diff against (this IS the first take), there is by
  // definition nothing to have "gained" yet, so presence-anywhere is the
  // only meaningful question for that case. Computed once, above the
  // `!quant` block, since the final catch-all below also needs it.
  const hasTaskOrAction = original
    ? nonNumericStructureGained(original, set).gained
    : !!(obsOf(set, "structure_task_marker") || obsOf(set, "structure_action_marker"));
  if (!quant) {
    // V3.8 fix: "that it worked out, somehow" had the exact same false-negative
    // shape the V3.7 fix below already corrected for "nothing specific enough
    // to write down" — it fired on structure_result_marker presence alone,
    // with no check for task/action evidence that's already computed and
    // already used elsewhere (Coach's Notes, metricsDelta's "story parts"
    // count). Confirmed live: a real retry rich in named tools, a diagnostic
    // method, and two explicit engineering decisions — zero literal digits —
    // still produced this bullet as if the answer were genuinely empty.
    // Suppressed under the same gate as V3.7, not replaced: same reasoning
    // as below (Global Rule: silence over an unearned claim).
    if (obsOf(set, "structure_result_marker") && !hasTaskOrAction) b.push("that it worked out, somehow");
    else if (!obsOf(set, "structure_result_marker")) b.push("not how it ended");
    // V3.7 fix: this bullet used to fire on numeric absence alone, ignoring
    // structure_task_marker/structure_action_marker evidence that's already
    // computed and already used elsewhere (Coach's Notes, metricsDelta's
    // "story parts" count). Suppressed here rather than replaced with a new
    // positive bullet: per Step 0, the evidence these markers carry is only
    // the bare trigger phrase itself ("so I", "I needed to") with no
    // captured object, which isn't genuinely illuminating quotable evidence
    // (Global Rule: silence over an unearned claim). A shorter, honest
    // bullet list beats a false negative one.
    if (m.numeric_span_count === 0 && m.word_count > 60 && !hasTaskOrAction) {
      b.push("nothing specific enough to write down");
    }
  }
  if (m.hypothetical_marker_count >= 2) b.push("generalities");
  if (obsOf(set, "closing_hedge") || obsOf(set, "trailing_off")) b.push("it fizzling out at the end");
  if (b.length === 0) {
    if (m.word_count < 30) {
      b.push("honestly, not much — it was brief");
    } else {
      // V3.9 fix: this catch-all used to say "nothing specific stayed"
      // unconditionally whenever nothing more specific fired — including
      // when task/action evidence WAS gained but simply wasn't quotable,
      // which is exactly the case the comparison verdict was, correctly,
      // crediting as "some real detail made it in" on the same answer.
      b.push(hasTaskOrAction ? "some shape to it, but nothing concrete enough to quote" : "nothing specific stayed");
    }
  }
  return b;
}

export interface ProofPayload {
  v1_transcript: string;
  v2_transcript: string;
  metrics_delta: MetricDelta[];
  notebook_a: string[];
  notebook_b: string[];
}

export function buildProof(
  v1_transcript: string, v1: SetIn,
  v2_transcript: string, v2: SetIn
): ProofPayload {
  return {
    v1_transcript,
    v2_transcript,
    metrics_delta: metricsDelta(v1, v2),
    notebook_a: notebookBullets(v1), // first take: no prior turn to diff against
    notebook_b: notebookBullets(v2, v1), // V3.9: retry, diffed against v1 — see notebookBullets' doc comment
  };
}
