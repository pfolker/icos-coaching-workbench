/**
 * Grounding check — the 8th check, distinct from the 7 tone/evaluative
 * guardrail categories. Those check HOW the Narrator talks about evidence;
 * this checks WHETHER what it says is actually traceable to the evidence
 * it was given. Found necessary by a real incident: a fixture message for
 * Case 001 asserted "an indicator check" — content that exists nowhere in
 * Case 001's transcript or Evidence Graph, only in Case 002's. None of the
 * 7 tone categories would ever have caught this, because nothing about
 * that sentence is evaluative, predictive, or judgmental — it is simply
 * false relative to its own cited evidence.
 *
 * Deliberately coarse, same discipline as the other lexical checks in this
 * project: tokenize the message, drop common framing/function words, and
 * confirm each remaining distinctive word has SOME plausible match (by
 * shared 5-character stem, to tolerate "machining"/"machined"-style
 * inflection) somewhere in the referenced evidence quotes. This is not
 * semantic entailment checking — it cannot catch a fabricated claim built
 * entirely from words that also happen to appear in the evidence, only
 * claims that introduce genuinely new distinctive vocabulary. That is a
 * real, named limitation (see README.md), not a claim of completeness.
 */

/**
 * Tuned empirically against tonight's own real Narrator outputs (fixture
 * and live) for all four required test cases, the same way
 * evidence-validator's lexicons were tuned against real Atlas cases, not
 * guessed once and left alone. This list covers two different reasons a
 * word gets excluded, and both matter for different reasons:
 *  (a) pure function/framing words (about, because, would, ...) — never
 *      carry a factual claim at all.
 *  (b) synthesis/narration vocabulary that legitimately describes or
 *      frames real evidence without literally repeating its wording
 *      (diagnostic, sequence, assumption, identify, cause, moving,
 *      actual, percentage, ...) — this is prose doing its job, not
 *      fabrication. The real risk case (a concrete named tool/object not
 *      in evidence, e.g. "indicator") is a different, narrower thing than
 *      this list, and staying narrow here is what keeps that signal
 *      visible instead of drowned in noise.
 */
const GROUNDING_STOPWORDS = new Set([
  "about", "after", "again", "against", "all", "also", "although", "always",
  "among", "and", "another", "any", "are", "around", "because", "been",
  "before", "being", "between", "both", "cannot", "could", "describe",
  "described", "describes", "during", "each", "either", "every", "first",
  "found", "from", "further", "gave", "give", "given", "have", "having",
  "here", "however", "into", "itself", "many", "might", "more", "most",
  "much", "named", "names", "never", "nothing", "other", "others", "people",
  "point", "pointed", "points", "really", "should", "showed", "shows",
  "since", "some", "something", "specific", "specifics", "stayed", "talked",
  "talking", "tells", "that", "their", "there", "these", "thing", "things",
  "think", "those", "though", "through", "today", "together", "toward",
  "under", "until", "using", "walked", "walking", "which", "while",
  "without", "would", "you're", "your", "yours", "yourself", "fix", "fixes",
  "tools", "tool", "adding", "added", "addressed", "addressing", "reasons",
  "reason", "reasoning",
  // (b) synthesis/narration vocabulary, added after empirical testing
  // against tonight's own real messages:
  "moving", "movement", "initial", "assumption", "assumptions", "assumed",
  "identify", "identified", "identifies", "identifying", "diagnostic",
  "sequence", "cause", "caused", "causes", "actual", "actually",
  "percentage", "percent", "number", "numbers", "haven't", "clear",
  "confirm", "confirmed", "tracing", "traced", "method", "methods",
  "check", "checked", "checking",
  // Second round, found on FRESH live output (not the same messages the
  // first round was tuned against) — confirms this check needs ongoing
  // tuning against real output, not a one-time fix. All are the same kind
  // of thing: connector words or paraphrase/synthesis vocabulary, not
  // fabricated entities.
  "investigation", "examining", "source", "inconsistency", "distinct",
  "paired", "timeframe", "rather", "suspected", "followed", "walked",
  "path", "specific", "mechanical", "addressed",
]);

export interface GroundingResult {
  passed: boolean;
  ungrounded_terms: string[];
  /** false when no evidence quotes were supplied — grounding is not
   * meaningfully checkable against nothing, so this is reported as
   * not-applicable rather than a false pass or false fail. */
  checked: boolean;
}

function stem(word: string): string {
  return word.slice(0, Math.min(5, word.length));
}

function candidateTerms(message: string): string[] {
  const words = message.toLowerCase().match(/[a-z][a-z'-]{4,}/g) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of words) {
    const w = raw.replace(/'s$/, "").replace(/^-+|-+$/g, "");
    if (w.length < 5 || GROUNDING_STOPWORDS.has(w) || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
}

export function groundingCheck(message: string, evidenceQuotes: string[]): GroundingResult {
  if (evidenceQuotes.length === 0) {
    return { passed: true, ungrounded_terms: [], checked: false };
  }
  const evidenceWords = evidenceQuotes.join(" ").toLowerCase().match(/[a-z][a-z'-]*/g) ?? [];
  const evidenceStems = new Set(evidenceWords.map(stem));
  const candidates = candidateTerms(message);
  const ungrounded_terms = candidates.filter((t) => !evidenceStems.has(stem(t)));
  return { passed: ungrounded_terms.length === 0, ungrounded_terms, checked: true };
}
