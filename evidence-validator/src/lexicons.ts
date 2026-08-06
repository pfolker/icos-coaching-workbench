/**
 * Small, narrowly-scoped word lists used ONLY for:
 *  (a) detecting OBVIOUS claim_type mismatches (never confirming positive
 *      fit — see classA.ts's header comment for why),
 *  (b) the fixed connective/contrast marker lists Specification Section 4
 *      names explicitly for Class B relationship types.
 * Data, not logic — mirrors the frozen engines' own convention of keeping
 * word lists separate from the code that uses them.
 */

/**
 * Cognition/belief-reporting verbs and diagnostic-conclusion phrases.
 * Characteristic of prior_belief / self_reported_diagnosis. Used only to
 * flag an OBVIOUS mismatch when a quote is entirely built from these with
 * zero action-verb presence, or the reverse — never to positively confirm
 * a belief/diagnosis claim (the absence of these words does not mean a
 * quote ISN'T a valid diagnosis: Atlas A15 "This pointed to a gripper
 * issue" and A14 "I was able to see the part had been moving" show
 * diagnosis language that doesn't hit every phrase in this list, which is
 * exactly why this list gates mismatch-rejection only, never validation).
 */
export const COGNITION_MARKERS =
  /\b(i think|i thought|i believe(?:d)?|i realiz(?:ed|e)|i felt|i assumed|i figured|i suspected|everyone thought|it seemed|pointed to|traced (?:it )?to|turned out)\b/i;

/**
 * First-person / team physical-or-decision action verbs, past tense.
 * Used only to flag an obvious mismatch (a strong action verb, zero
 * cognition marker, tagged as a belief/diagnosis type) — never to confirm
 * that a quote IS a valid action claim. Many genuine action claims in the
 * Atlas (e.g. "I spent time watching the process, talking with the
 * operators...") use none of these verbs and validate fine regardless.
 */
export const ACTION_VERBS =
  /\b(i|we) (built|fixed|modified|redesigned|replaced|swapped|changed|added|removed|automated|checked|pulled|flagged|shortened|decided|designed|installed|repaired)\b/i;

/**
 * Explicit connective phrases — Specification v1.1 Section 4,
 * explicit_connective. "pointed to", "led to", "resulted in" added in
 * EP-003 (Atlas Case 002's B5 used "pointed to" as a connective in prose,
 * but it wasn't in the v1.0 fixed list; "led to"/"resulted in" added
 * proactively as structurally identical siblings rather than waiting for
 * each to individually break a future case).
 */
export const EXPLICIT_CONNECTIVES = [
  "because", "so that", "so", "in order to", "since", "as a result",
  "pointed to", "led to", "resulted in",
] as const;

/**
 * Contrast marker phrases — Specification v1.1 Section 4, contrast_marker.
 * "instead of" added in EP-003 (Atlas Case 001's B2 described "Instead of"
 * as explicit_connective in prose, but that word never existed in v1.0's
 * explicit_connective list; corrected on revision to contrast_marker —
 * a rejected-alternative construction, same family as "instead"/"rather
 * than", not a neutral connective).
 */
export const CONTRAST_MARKERS = ["but", "however", "instead", "rather than", "instead of"] as const;

/**
 * Subordinating temporal connectors — Specification v1.1 Section 4,
 * EP-004. Closed, fixed list; may grow only through a future specification
 * revision, same governance as every other fixed list in this document.
 * Each has a FIXED logical meaning that determines temporal_sequence order
 * when present, overriding raw transcript position:
 *   "once X, Y" / "Y once X"     -> X precedes Y
 *   "after X, Y" / "Y after X"   -> X precedes Y
 *   "before X, Y" / "Y before X" -> Y precedes X (reversed!)
 * See classB.ts's temporal_sequence handling for the mechanical rule.
 */
export const TEMPORAL_CONNECTORS = ["once", "after", "before"] as const;
export type TemporalConnector = (typeof TEMPORAL_CONNECTORS)[number];

/** Bare numeral or common written-out small number word, for quantity_binding. */
export const NUMBER_TOKEN = /\b(\d[\d,]*(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\b/i;

/**
 * Unit-ish words a bound quantity co-occurs with, for quantity_binding.
 *
 * Dimensional/angular coverage (Work Order: Dimensional Unit Coverage,
 * 2026-08-01) added below the original list. Two real live transcripts (one
 * inch-based, one millimeter-based) showed the Listen LLM correctly
 * proposing a quantity_binding relationship that the Validator then
 * rejected solely because no dimensional or angular unit existed in this
 * list at all.
 *
 * quantity_binding's admission check (classB.ts) tests NUMBER_TOKEN and
 * UNIT_TOKEN independently over the WHOLE component quote, with NO
 * positional-adjacency requirement between the number and the unit. That
 * pre-existing architecture (unchanged here -- altering it would be a
 * quantity-binding semantics change, out of this work order's scope) makes
 * any common-English-word addition a real false-positive risk: any quote
 * containing an unrelated number AND that word ANYWHERE would incorrectly
 * satisfy this check. Checked directly, three candidates confirmed unsafe
 * and deliberately excluded (same "leave it out and report why" standard
 * the work order set for "mil"):
 *  - bare "in" (inch abbreviation): collides with the ordinary preposition
 *    "in" (confirmed: "I reduced errors by 4 in the first pass" falsely
 *    binds). "inch"/"inches" (unambiguous full words) and the bare inch
 *    mark (") are included instead.
 *  - "mil": confirmed real collision with business/interview slang for
 *    "million" (e.g. "we did 3 mil last quarter" means $3,000,000, not
 *    0.003 inch) -- the exact ambiguity the work order's own conditional
 *    anticipated for this token.
 *  - "um": confirmed real collision as a spoken-transcript filler/
 *    disfluency (observation-engine's own FILLER_CORE lexicon already
 *    classifies "u+m+" this way). \b protects "album"/"vacuum" from
 *    matching, but not standalone filler "um" co-occurring with an
 *    unrelated number in the same quote (confirmed: "I checked it, um, 3
 *    times before shipping" falsely binds) -- the same underlying failure
 *    mode as the "in" exclusion above, word-boundary cannot fix it.
 *
 * The inch mark ("), micro sign/Greek mu (µm/μm), and degree symbol (°)
 * are NOT ordinary \b-bounded word tokens -- none of them are JS \w
 * characters, so a plain \b cannot anchor on both sides the way it does
 * for "percent" or "hours". Confirmed directly: a naive \b("|µm|μm|°)\b
 * fails on the realistic ".0005\" " (space/end-of-string after the mark)
 * and "10 µm" (space before the mark) shapes -- it only matches in
 * unrealistic flush-against-a-word-character configurations. Given their
 * own non-\b handling below instead of being forced into the word list.
 * The inch mark specifically requires a digit immediately before it
 * (lookbehind) -- confirmed necessary because an unanchored bare `"` would
 * otherwise match any ordinary quotation mark around reported speech
 * elsewhere in a transcript, unrelated to any quantity. µm/μm/° need no
 * such guard: none of them have any ordinary-English/meaning collision.
 *
 * Also confirmed (unrelated pre-existing behavior, NOT touched here since
 * it's outside this work order's dimensional/angular scope): the original
 * "%" and "$" alternatives have this exact same \b-anchoring problem today
 * ("we improved yield by 15%" does not match) -- a real, separate defect
 * that predates this change and is left exactly as-is.
 */
const WORD_UNITS =
  "percent|%|dollars?|\\$|hours?|days?|weeks?|months?|years?|minutes?|shifts?|reps?|technicians?|" +
  "steps?|parts?|pieces?|people|operators?|machines?|pins?|out of|" +
  "inch(?:es)?|ft|foot|feet|mm|millimeters?|cm|centimeters?|m|meters?|" +
  "microns?|thou|thousandths?|degrees?|deg";

export const UNIT_TOKEN = new RegExp(
  String.raw`\b(?:${WORD_UNITS})\b` +
  String.raw`|(?<=\d)"` +
  String.raw`|µm|μm` +
  String.raw`|°`,
  "i"
);
