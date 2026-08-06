/**
 * The shape the Prototype Listen Engine actually produces (live or fixture),
 * BEFORE it becomes a real evidence-validator ValidatorInput.
 *
 * Deliberately missing `source_span` on Class A proposals. The Specification
 * (Section 3) requires source_span on every Class A entry, but does not say
 * WHO computes it — and asking an LLM to count exact character offsets by
 * hand is unreliable by construction (models are bad at literal character
 * arithmetic, and a single off-by-one collapses Rule 2, SOURCE_SPAN_MISMATCH,
 * for an otherwise-correct quote). This prototype's design decision: the
 * Listen Engine proposes WHAT was said; `materializeSourceSpans` below —
 * ordinary code, not the model — locates each proposed quote in the
 * transcript via verbatim string search, the same mechanical approach
 * evidence-validator's own test/helpers.ts `span()` helper uses to build
 * fixtures. This is a design decision, not a Specification violation: Section
 * 4 Rule 1 only requires the span to resolve correctly, never who computes
 * it. See README.md's "Design decisions" section.
 */
import { ClassAProposal, ClassBProposal, ClassCProposal, ValidatorInput } from "../../evidence-validator/src/types";

export interface ModelClassAProposal {
  proposal_id: string;
  claim_type: string;
  quote: string;
}

export interface ListenEngineRawOutput {
  class_a_proposals: ModelClassAProposal[];
  class_b_proposals: ClassBProposal[];
  class_c_proposals: ClassCProposal[];
}

/**
 * Locates the first verbatim occurrence of `quote` in `transcript` and
 * returns its span. Returns a sentinel {start:0,end:0} when the quote is not
 * found verbatim — deliberately NOT thrown here, because the Validator's own
 * Class A Rule 1 (`transcript.includes(quote)`) already rejects a not-found
 * quote with QUOTE_NOT_FOUND regardless of span contents; letting an
 * unfindable quote flow through as a proposal (rather than silently
 * dropping it) preserves the Validator as the single source of truth for
 * rejection, exactly as Deliverable 8/README documents.
 */
function locateSpan(transcript: string, quote: string): { start: number; end: number } {
  const trimmed = quote.trim();
  const start = transcript.indexOf(trimmed);
  if (start === -1) return { start: 0, end: 0 };
  return { start, end: start + trimmed.length };
}

export function materializeSourceSpans(transcript: string, raw: ListenEngineRawOutput): ValidatorInput {
  const class_a_proposals: ClassAProposal[] = raw.class_a_proposals.map((p) => ({
    proposal_id: p.proposal_id,
    claim_type: p.claim_type,
    quote: p.quote,
    source_span: locateSpan(transcript, p.quote),
  }));
  return {
    transcript,
    class_a_proposals,
    class_b_proposals: raw.class_b_proposals,
    class_c_proposals: raw.class_c_proposals,
  };
}
