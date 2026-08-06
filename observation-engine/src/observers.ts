/**
 * Observers — one pure function per observable behavior class.
 * Each returns Observation[] with verbatim evidence spans and a confidence
 * whose basis is stated. No observer ranks, judges, or recommends.
 */
import { Evidence, Observation, Sentence } from "./types";
import { sentenceIndexAt } from "./segment";
import * as LEX from "./lexicons";

function matchesToEvidence(
  transcript: string,
  sentences: Sentence[],
  re: RegExp,
  scope?: { start: number; end: number }
): Evidence[] {
  const start = scope?.start ?? 0;
  const end = scope?.end ?? transcript.length;
  const text = transcript.slice(start, end);
  const out: Evidence[] = [];
  const rx = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  let m: RegExpExecArray | null;
  while ((m = rx.exec(text)) !== null) {
    const abs = start + m.index;
    out.push({
      sentence_index: sentenceIndexAt(sentences, abs),
      char_start: abs,
      char_end: abs + m[0].length,
      span_text: transcript.slice(abs, abs + m[0].length),
    });
    if (m[0].length === 0) rx.lastIndex++; // safety
  }
  return out;
}

const one = (
  observation_type: Observation["observation_type"],
  value: Observation["value"],
  evidence: Evidence[],
  confidence: number,
  confidence_basis: string
): Observation => ({ observation_type, value, evidence, confidence, confidence_basis });

// ---------------------------------------------------------------- delivery

export function observeFillers(t: string, s: Sentence[]): Observation[] {
  const out: Observation[] = [];
  const core = matchesToEvidence(t, s, LEX.FILLER_CORE);
  if (core.length)
    out.push(one("filler_core", core.length, core, 0.95, "unambiguous filler lexicon regex"));
  const soft = matchesToEvidence(t, s, LEX.FILLER_SOFT);
  if (soft.length)
    out.push(
      one("filler_soft", soft.length, soft, 0.6,
        "ambiguous lexicon ('like' may be verb/preposition); count is an upper bound")
    );
  return out;
}

export function observeHedges(t: string, s: Sentence[]): Observation[] {
  const out: Observation[] = [];
  const mid = matchesToEvidence(t, s, LEX.HEDGE_MARKERS);
  if (mid.length)
    out.push(one("hedge_marker", mid.length, mid, 0.85, "hedge lexicon regex"));

  const last = s[s.length - 1];
  if (last) {
    const m = last.text.match(LEX.CLOSING_HEDGES);
    if (m && m.index !== undefined) {
      const abs = last.char_start + m.index;
      out.push(
        one("closing_hedge", true,
          [{ sentence_index: last.index, char_start: abs, char_end: abs + m[0].length,
             span_text: t.slice(abs, abs + m[0].length) }],
          0.85, "closing-hedge lexicon anchored to final sentence end")
      );
    } else if (last.word_count < 5 && !/[.!?]$/.test(last.text)) {
      out.push(
        one("trailing_off", true,
          [{ sentence_index: last.index, char_start: last.char_start,
             char_end: last.char_end, span_text: last.text }],
          0.8, "final fragment: <5 words, no terminal punctuation")
      );
    }
  }
  return out;
}

// ------------------------------------------------------- language of agency

export function observePronouns(t: string, s: Sentence[]): Observation[] {
  const out: Observation[] = [];
  const iEv = matchesToEvidence(t, s, /\b(?:I|my|me)\b/g);
  if (iEv.length)
    out.push(one("first_person_singular", iEv.length, iEv, 0.95, "pronoun regex"));
  const weEv = matchesToEvidence(t, s, /\b(?:we|our|us)\b/gi);
  if (weEv.length)
    out.push(one("first_person_plural", weEv.length, weEv, 0.95, "pronoun regex"));

  const agency = matchesToEvidence(
    t, s, new RegExp(`\\bI\\s+(?:\\w+ly\\s+)?(?:${LEX.AGENCY_VERBS})\\b`, "g"));
  if (agency.length)
    out.push(
      one("agency_verb_i", agency.length, agency, 0.7,
        "'I + agency verb' lexicon; lexicon coverage is partial (undercount possible)")
    );
  const presence = matchesToEvidence(
    t, s, new RegExp(`\\bI\\s+(?:\\w+ly\\s+)?(?:${LEX.PRESENCE_VERBS})\\b`, "gi"));
  if (presence.length)
    out.push(
      one("presence_verb_i", presence.length, presence, 0.7,
        "'I + presence verb' lexicon; lexicon coverage is partial")
    );
  return out;
}

// ------------------------------------------------------------ content signals

export function observeQuantification(t: string, s: Sentence[]): Observation[] {
  const out: Observation[] = [];
  const seen = new Set<string>();
  const quantEv: Evidence[] = [];
  for (const re of LEX.QUANT_PATTERNS) {
    for (const ev of matchesToEvidence(t, s, re)) {
      const key = `${ev.char_start}:${ev.char_end}`;
      if (!seen.has(key)) { seen.add(key); quantEv.push(ev); }
    }
  }
  if (quantEv.length)
    out.push(one("quantified_span", quantEv.length, quantEv, 0.9,
      "unit/percent/currency/range patterns"));

  // bare numbers not already inside a quantified span, excluding year-likes
  const covered = (a: number, b: number) =>
    quantEv.some((e) => a >= e.char_start && b <= e.char_end);
  const bare = matchesToEvidence(t, s, LEX.BARE_NUMBER).filter(
    (e) => !covered(e.char_start, e.char_end) && !LEX.YEAR_LIKE.test(e.span_text)
  );
  if (bare.length)
    out.push(one("numeric_span", bare.length, bare, 0.5,
      "bare numeral; unit/metric status ambiguous, years excluded"));
  return out;
}

export function observeHypotheticals(t: string, s: Sentence[]): Observation[] {
  const ev = matchesToEvidence(t, s, LEX.HYPOTHETICAL_MARKERS);
  return ev.length
    ? [one("hypothetical_marker", ev.length, ev, 0.75,
        "hypothetical/habitual lexicon; interpretation depends on question type (downstream)")]
    : [];
}

export function observeNegativity(t: string, s: Sentence[]): Observation[] {
  const ev: Evidence[] = [];
  for (const sent of s) {
    if (!LEX.EMPLOYER_TERMS.test(sent.text)) continue;
    ev.push(...matchesToEvidence(t, s, LEX.NEGATIVE_TERMS,
      { start: sent.char_start, end: sent.char_end }));
  }
  return ev.length
    ? [one("employer_negativity", ev.length, ev, 0.6,
        "negative lexicon co-occurring with employer term in same sentence; no target disambiguation")]
    : [];
}

// ---------------------------------------------------------- structural signals

export function observeStructure(t: string, s: Sentence[]): Observation[] {
  const out: Observation[] = [];
  const map: [keyof typeof LEX.STRUCTURE_MARKERS, Observation["observation_type"]][] = [
    ["situation", "structure_situation_marker"],
    ["task", "structure_task_marker"],
    ["action", "structure_action_marker"],
    ["result", "structure_result_marker"],
  ];
  for (const [k, type] of map) {
    const ev = matchesToEvidence(t, s, LEX.STRUCTURE_MARKERS[k]);
    if (ev.length)
      out.push(one(type, ev.length, ev, 0.5,
        "keyword heuristic only; authoritative STAR mapping is the LLM Listen stage"));
  }
  const last = s[s.length - 1];
  if (last) {
    const ev = matchesToEvidence(t, s, LEX.STRUCTURE_MARKERS.result,
      { start: last.char_start, end: last.char_end });
    if (ev.length)
      out.push(one("result_in_final_sentence", true, ev, 0.5, "result keyword in final sentence"));
  }
  return out;
}
