/** Finds the (nth) verbatim occurrence of `quote` in `transcript` and returns its span. */
export function span(transcript: string, quote: string, occurrence = 0): { start: number; end: number } {
  let idx = -1;
  let from = 0;
  for (let i = 0; i <= occurrence; i++) {
    idx = transcript.indexOf(quote, from);
    if (idx === -1) throw new Error(`fixture error: quote not found (occurrence ${i}): "${quote}"`);
    from = idx + 1;
  }
  return { start: idx, end: idx + quote.length };
}
