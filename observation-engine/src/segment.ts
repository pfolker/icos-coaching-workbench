/**
 * Sentence segmentation for spoken, disfluent transcripts.
 *
 * Strategy:
 *  1. Primary split on terminal punctuation runs (. ! ?), keeping offsets.
 *  2. Secondary split of overlong segments (spoken run-ons rarely carry
 *     punctuation) at discourse markers ("so", "but", "because", "and then"),
 *     only where both resulting pieces keep a minimum word count.
 *
 * Invariant (tested): for every sentence,
 *   transcript.slice(char_start, char_end) === text
 */
import { Sentence } from "./types";

const MAX_WORDS_BEFORE_SECONDARY_SPLIT = 35;
const MIN_WORDS_PER_PIECE = 8;
const DISCOURSE_MARKER = /\b(?:so|but|because|and then)\b/gi;

function countWords(s: string): number {
  const m = s.match(/\S+/g);
  return m ? m.length : 0;
}

interface RawSeg { start: number; end: number } // absolute, untrimmed

function primarySegments(transcript: string): RawSeg[] {
  const segs: RawSeg[] = [];
  // Confirmed real bug (Test Build v1, session a2f82b6d): a period
  // immediately followed by a digit is a decimal point, not a sentence
  // terminator -- e.g. machinist shorthand ".0005"" (leading decimal, no
  // leading zero) was shattering one real sentence into three fragments,
  // corrupting downstream sentence_index lookups (proof.ts's
  // resolveUnquantifiedResultQuote()). Checking only what FOLLOWS the
  // period (not what precedes it) is deliberate: the confirmed failure
  // case has a space before the period (".0005", not "0.0005"), so a
  // digit-before-and-after rule would have missed it. "!" and "?" are
  // unaffected; a "." followed by anything other than a digit -- including
  // another "." for an ellipsis -- still terminates exactly as before.
  // Deliberately narrow: only this one confirmed shape, nothing else in
  // sentence segmentation changes (times, abbreviations, ellipses are
  // untouched -- see the Step 4 finding in the deliverables report).
  const re = /(?:[^.!?]|\.(?=\d))+(?:!|\?|\.(?!\d))*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(transcript)) !== null) {
    if (m[0].trim().length > 0) segs.push({ start: m.index, end: m.index + m[0].length });
  }
  return segs;
}

/** Split an overlong raw segment at discourse markers, greedily left-to-right. */
function secondarySplit(transcript: string, seg: RawSeg): RawSeg[] {
  const text = transcript.slice(seg.start, seg.end);
  if (countWords(text) <= MAX_WORDS_BEFORE_SECONDARY_SPLIT) return [seg];

  const pieces: RawSeg[] = [];
  let pieceStart = seg.start;
  DISCOURSE_MARKER.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = DISCOURSE_MARKER.exec(text)) !== null) {
    const abs = seg.start + m.index; // split BEFORE the marker
    const left = transcript.slice(pieceStart, abs);
    const right = transcript.slice(abs, seg.end);
    if (countWords(left) >= MIN_WORDS_PER_PIECE && countWords(right) >= MIN_WORDS_PER_PIECE) {
      pieces.push({ start: pieceStart, end: abs });
      pieceStart = abs;
    }
  }
  pieces.push({ start: pieceStart, end: seg.end });
  return pieces;
}

/** Trim a raw segment's whitespace while keeping absolute offsets honest. */
function toSentence(transcript: string, seg: RawSeg, index: number): Sentence | null {
  let { start, end } = seg;
  while (start < end && /\s/.test(transcript.charAt(start))) start++;
  while (end > start && /\s/.test(transcript.charAt(end - 1))) end--;
  if (end <= start) return null;
  const text = transcript.slice(start, end);
  return { index, text, char_start: start, char_end: end, word_count: countWords(text) };
}

export function segment(transcript: string): Sentence[] {
  const out: Sentence[] = [];
  for (const raw of primarySegments(transcript)) {
    for (const piece of secondarySplit(transcript, raw)) {
      const s = toSentence(transcript, piece, out.length);
      if (s) out.push(s);
    }
  }
  return out;
}

/** Locate which sentence an absolute char offset falls inside (or nearest). */
export function sentenceIndexAt(sentences: Sentence[], charOffset: number): number {
  for (const s of sentences) {
    if (charOffset >= s.char_start && charOffset < s.char_end) return s.index;
  }
  // between sentences (whitespace/punct gap): attribute to the previous one
  let best = 0;
  for (const s of sentences) if (s.char_start <= charOffset) best = s.index;
  return best;
}
