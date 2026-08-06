/**
 * Default deterministic CopyGenerator (v1).
 * A future LLM generator replaces THIS file only; the verifier stays.
 * Rules honored here (and re-verified mechanically afterwards):
 *  - one insight, from the selected opportunity only
 *  - quotes are verbatim learner sentences resolved from evidence spans
 *  - recognition comes only from observations that actually fired (JA-08 gate)
 */
import {
  CopyGenerator, GenerationContext, SpanRef,
} from "./types";
import {
  ADVANCE_COPY, DOWNGRADED_RECOGNITION, MISSION_FOCUS, OPPORTUNITY_COPY,
  PROTECT_PREFIX, REFRAMES, WHY_IT_MATTERS,
} from "./registry";

/** Resolve a span to its full sentence (better copy, still verbatim). */
function sentenceOf(ctx: GenerationContext, span: SpanRef): SpanRef {
  const s = ctx.sentences[span.sentence_index];
  if (!s) return span;
  // trim trailing terminal punctuation so quotes sit cleanly inside template
  // sentences; the shorter span remains a verbatim transcript substring
  let end = s.char_end;
  let text = s.text;
  while (text.length > 1 && /[.!?]$/.test(text)) { text = text.slice(0, -1); end--; }
  return { sentence_index: s.index, char_start: s.char_start, char_end: end, span_text: text };
}

/** Evidence-based recognition, priority-ordered, JA-08 downgrade when nothing earns it. */
function buildRecognition(ctx: GenerationContext) {
  const pick = (type: string) => ctx.observations.find((o) => o.observation_type === type);
  const quant = pick("quantified_span");
  if (quant && quant.evidence[0]) {
    const q = sentenceOf(ctx, quant.evidence[0]);
    return { copy: `You put a real number on it: "${q.span_text}". That is exactly what interviewers write down.`,
      quoted_spans: [q], downgraded: false };
  }
  const agency = pick("agency_verb_i");
  if (agency && agency.evidence[0]) {
    const q = sentenceOf(ctx, agency.evidence[0]);
    return { copy: `That's ownership. "${q.span_text}" tells them exactly what you would do when you are in the room.`,
      quoted_spans: [q], downgraded: false };
  }
  const result = pick("structure_result_marker");
  if (result && result.evidence[0]) {
    const q = sentenceOf(ctx, result.evidence[0]);
    return { copy: `You closed the loop: "${q.span_text}". Plenty of answers never get there.`,
      quoted_spans: [q], downgraded: false };
  }
  return { copy: DOWNGRADED_RECOGNITION, quoted_spans: [], downgraded: true };
}

/** The one insight, per opportunity, supply-branch wording. */
function supplyInsight(ctx: GenerationContext, id: string): { copy: string; quoted_spans: SpanRef[] } {
  const first = ctx.evidence.spans[0];
  const q = first ? sentenceOf(ctx, first) : null;
  switch (id) {
    case "O2_structureless_ramble":
      return { copy:
        "Here is the one thing to fix: this answer never settles into a story shape. It runs as one long stretch, and a listener cannot take notes on it.",
        quoted_spans: [] };
    case "O3_missing_result":
      return { copy:
        "The story stops before the result. It describes the work, but never says what came of it.",
        quoted_spans: [] };
    case "O3_unquantified_result":
      return q ? { copy:
        `The story reaches a result: "${q.span_text}". There is just no size on it yet. A result without a number is a claim. With a number it becomes evidence.`,
        quoted_spans: [q] }
        : { copy: "The story reaches a result, but there is no size on it yet. A result without a number is a claim. With a number it becomes evidence.", quoted_spans: [] };
    case "O4_ownership_hiding":
      return q ? { copy:
        `In that sentence, "${q.span_text}", every action belongs to the whole team, so the interviewer still can't tell what you did.`,
        quoted_spans: [q] }
        : { copy: "Every action in this answer belongs to the whole team, so the interviewer cannot tell what you did.", quoted_spans: [] };
    case "O5_vagueness":
      return { copy:
        "Focus: add one concrete detail. Name a tool, constraint, decision, or moment that makes this story easier to picture.",
        quoted_spans: [] };
    case "O7_weak_close":
      return q ? { copy:
        `Your final words were "${q.span_text}". That is the line the interviewer remembers, and it undersells everything before it.`,
        quoted_spans: [q] }
        : { copy: "The answer fades out instead of ending. The last line is the one the interviewer remembers, and this one undersells the rest.", quoted_spans: [] };
    case "O8_buried_lede":
      return { copy:
        "The real answer arrives at the end. Interviewers write down your first sentence, not the wind up before it.",
        quoted_spans: [] };
    case "O10_filler_density":
      return { copy:
        "The fillers cluster where you are still composing. Each one is a spot where a quiet pause would read as confidence instead.",
        quoted_spans: [] };
    case "O11_employer_negativity":
      return q ? { copy:
        `One line in there is about a person instead of the problem: "${q.span_text}". An interviewer hears that as a preview of how you might one day describe them.`,
        quoted_spans: [q] }
        : { copy: "Part of this answer is about a person instead of the problem. Interviewers hear that as a preview of how you might one day describe them.", quoted_spans: [] };
    default:
      return { copy: "Let us work on one thing in that answer.", quoted_spans: [] };
  }
}

export const templateGenerator: CopyGenerator = (ctx: GenerationContext) => {
  const recognition = buildRecognition(ctx);

  if (ctx.decision_type === "reinforce_only" || !ctx.selected) {
    return {
      mission_line: null,
      recognition,
      insight: null,
      why_it_matters: null,
      retry_instruction: null,
      advance_copy: ADVANCE_COPY,
    };
  }

  const id = ctx.selected.opportunity.opportunity_id;
  const entry = OPPORTUNITY_COPY[id];
  if (!entry) {
    // unknown opportunity id: minimal safe copy (verifier will still gate it)
    return {
      mission_line: null, recognition,
      insight: { copy: "Let us work on one thing in that answer.", quoted_spans: [] },
      why_it_matters: null,
      retry_instruction: { copy: "Take one more pass at it.", pattern_key: "unknown" },
      advance_copy: null,
    };
  }

  const base = supplyInsight(ctx, id);
  const intervention = ctx.selected.intervention_type;
  let insightCopy = base.copy;

  if (intervention === "I3_elicitation") {
    insightCopy = `${entry.elicit_question} ${base.copy}`;
  } else if (intervention === "I7_reframe" && REFRAMES[entry.habit_id]) {
    insightCopy = `${REFRAMES[entry.habit_id]} ${base.copy}`;
  } else if (intervention === "I10_confidence_structuring") {
    insightCopy = `${PROTECT_PREFIX}${base.copy}`;
  }

  const mission_line =
    ctx.mission_handling === "aligned_selected" && ctx.mission_habit_id && MISSION_FOCUS[ctx.mission_habit_id]
      ? `Today's focus: ${MISSION_FOCUS[ctx.mission_habit_id]}. This one is right on it.`
      : null;

  return {
    mission_line,
    recognition,
    insight: { copy: insightCopy, quoted_spans: base.quoted_spans },
    why_it_matters: { copy: WHY_IT_MATTERS[entry.habit_id] ?? "" },
    retry_instruction: { copy: entry.retry_copy, pattern_key: entry.retry_pattern_key },
    advance_copy: null,
  };
};
