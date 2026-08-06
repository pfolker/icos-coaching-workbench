/**
 * Lexicons — the observable-behavior vocabularies.
 * Data, not logic: tune here (or lift to /config) without touching observers.
 */

export const FILLER_CORE = /\b(?:u+m+|u+h+|erm+|you know|i mean)\b/gi;
export const FILLER_SOFT = /\b(?:like|kind of|sort of)\b/gi;

export const HEDGE_MARKERS =
  /\b(?:i guess|i suppose|maybe|probably|i think|hopefully|possibly|more or less)\b/gi;

export const CLOSING_HEDGES =
  /(?:so,?\s*yeah|if that makes sense|does that answer(?: your| the)? question|or whatever|something like that|i guess|that's (?:about|pretty much) it)\W*$/i;

// "I <adverb?> <verb>" — agency vs presence attribution
export const AGENCY_VERBS =
  "decided|led|built|created|designed|implemented|proposed|negotiated|fixed|resolved|initiated|owned|drove|rebuilt|programmed|machined|developed|launched|reorganized|redesigned|wrote|automated|streamlined|reduced|cut|eliminated|convinced|presented|delivered";
export const PRESENCE_VERBS =
  "helped|assisted|supported|participated|contributed|was involved|was part of|worked on|took part";

export const HYPOTHETICAL_MARKERS =
  /\b(?:i would|i'd|typically|usually|generally|normally|in general|hypothetically|tend to)\b/gi;

// Confirmed real bug (Test Build v1, tonight's live session): a number
// written with a leading decimal point and no leading zero (".0005", real
// machinist shorthand for a fractional inch) was invisible to the
// from-X-to-Y pattern below, because its number-matching portion (\d[\d,.]*)
// requires the FIRST character to be a digit -- ".0005" starts with ".",
// so the match never even begins. Fixed narrowly, only in the number token
// itself: `(?:\d[\d,.]*|\.\d[\d,]*)` accepts either the original
// digit-first shape OR a period immediately followed by digits, with the
// period included in the match. No `\b` is required before the
// period-first branch -- a "." is never itself a word character, so `\b`
// can't meaningfully anchor there the way it does before a digit; the
// realistic case (a period preceded by whitespace/start-of-text) needs no
// extra guard. Percent and dollar patterns are untouched -- confirmed
// already correct and unrelated (percentages like "90%" never carry a
// leading decimal point in real usage here).
const NUMBER_OPTIONAL_LEADING_DECIMAL = String.raw`(?:\d[\d,.]*|\.\d[\d,]*)`;

// Confirmed real second gap (same session, same transcript): even after the
// leading-decimal fix above, the from-X-to-Y pattern still missed
// `.0005" to .0002"` because it requires mandatory whitespace (`\s+`)
// immediately after the number, and the real transcript has the inch mark
// (`"`) sitting there instead. Narrow fix: allow one optional inch/foot mark
// (`"` or `'`) between the number (and its optional percent suffix) and that
// mandatory whitespace. Deliberately just these two symbols -- the realistic
// unit marks that sit flush against a number with no space -- not a general
// unit-suffix framework.
const OPTIONAL_UNIT_MARK = String.raw`["']?`;

// Confirmed real third gap (Work Order: Close Remaining Dimensional-Language
// Gaps): "thou"/"thousandth(s)" -- real machinist shorthand for a
// thousandth of an inch -- were absent from the number+unit-word pattern
// below, even after evidence-validator's UNIT_TOKEN was given the same word
// forms in a separate work order. Confirmed digit-form cases like "8 thou"
// now match this pattern independently of the from-X-to-Y pattern above
// (which has its own, separate, NOT-in-scope-here limitation: it requires
// the number to be followed immediately by whitespace-then-"to", so a unit
// word like "thou" sitting between the number and "to" still blocks it --
// tracked, not fixed here). observeQuantification() unions matches across
// every QUANT_PATTERNS entry, so a match here alone is sufficient.
export const QUANT_PATTERNS: RegExp[] = [
  // NOTE: no \b after '%' — a word boundary can never sit between two non-word chars
  /\b\d+(?:\.\d+)?\s*(?:%|percent\b)/gi,
  /\$\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:k|m|million|thousand)\b)?/gi,
  new RegExp(
    String.raw`\bfrom\s+${NUMBER_OPTIONAL_LEADING_DECIMAL}\s*(?:%|percent\b)?${OPTIONAL_UNIT_MARK}\s+(?:down\s+)?to\s+${NUMBER_OPTIONAL_LEADING_DECIMAL}\s*(?:%|percent\b)?${OPTIONAL_UNIT_MARK}`,
    "gi"
  ),
  /\b\d[\d,]*(?:\.\d+)?\s*(?:hours?|days?|weeks?|months?|years?|minutes?|shifts?|units?|parts?|pieces?|dollars?|people|operators?|machines?|thou|thousandths?)\b/gi,
];
// bare numbers, excluding 4-digit years and ordinal-ish step refs. Same
// leading-decimal fix as QUANT_PATTERNS above, for consistency -- this was
// independently confirmed dropping the leading period (evidence showed
// "0005" instead of ".0005", since a "." to digit transition is itself a
// \b, letting the original digit-first branch start matching one
// character late).
export const BARE_NUMBER = new RegExp(String.raw`\b\d[\d,]*(?:\.\d+)?\b|\.\d[\d,]*\b`, "g");
export const YEAR_LIKE = /^(?:19|20)\d{2}$/;

export const NEGATIVE_TERMS =
  /\b(?:terrible|awful|toxic|incompetent|hated|stupid|useless|micromanag\w*|nightmare|horrible|clueless|dysfunctional)\b/gi;
export const EMPLOYER_TERMS =
  /\b(?:boss|manager|supervisor|company|employer|management|team|coworkers?|workplace|job)\b/i;

export const STRUCTURE_MARKERS = {
  situation:
    /\b(?:at the time|there was|we had a|the situation was|my (?:company|plant|shop|team) (?:was|had)|last (?:year|month|quarter)|a few (?:years|months) ago|we were)\b/gi,
  task:
    /\b(?:my (?:job|task|role|responsibility) was|i was (?:responsible for|asked to|assigned)|i needed to|my goal was)\b/gi,
  action:
    /\b(?:so i|first,? i|then i|i decided|i started by|i went ahead|next,? i|i began)\b/gi,
  // "dropped" added (Work Order: Close Remaining Dimensional-Language Gaps):
  // confirmed the degree-based transcript's actual result language ("...the
  // rework rate dropped right away") wasn't matched by any existing keyword,
  // causing O3_missing_result to fire on the regex-fallback path even though
  // a real result was stated. Minimal addition -- confirmed "dropped" alone
  // (without also adding "decreased" or restructuring further) is sufficient
  // for the confirmed case. Same semantic category and ambiguity profile as
  // the already-present "reduced"/"cut"/"eliminated" -- a result-indicating
  // verb regardless of whether the result was positive, not a new class of
  // false-positive risk.
  result:
    /\b(?:as a result|in the end|ultimately|which (?:led to|meant|resulted in)|we (?:ended up|went from)|saved|reduced|increased|improved|cut|eliminated|dropped)\b/gi,
} as const;
