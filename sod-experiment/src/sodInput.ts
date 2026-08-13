/**
 * The SOD INPUT CONTRACT — resolved before coding, per Work Order Section 3.
 *
 * DECISION: SOD receives the ADMITTED Evidence Graph and nothing else.
 * No raw transcript. No Class C. No source spans.
 *
 * ---------------------------------------------------------------------------
 * Q1. Can SOD perform the four required semantic tests using admitted evidence
 *     quotes plus their provenance?  YES — verified case by case against the
 *     real validator output before this file was written:
 *
 *   ownership_dilution / Case 006 — the individual-vs-team mixture is entirely
 *     inside the admitted quotes: "I decided we needed a better testing
 *     process...", "I built out a staging environment...", "The team put
 *     together the test suite", "we all agreed on the rollout schedule
 *     together". Nothing about the ambiguity lives outside admitted evidence.
 *
 *   result_needs_substance / Case 005 — the outcome claim is admitted:
 *     "now it runs on its own" (claim_type outcome). Judging its substance is
 *     a judgment ABOUT that quote, not about text around it.
 *
 *   assumption_reversal / Case 001 — both halves are admitted AND the relation
 *     between them is admitted: a_prior_belief ("everyone thought it was a
 *     programming issue") and a_diagnosis1 ("I realized the robot was actually
 *     applying force...") are joined by validated Class B edge
 *     b_contrast_belief [contrast_marker, marker "but"]. This matters for the
 *     fabrication rule: SOD does not have to INVENT the relationship, because
 *     the Validator already admitted it.
 *
 *   unresolved_alternative_cause / Case 009 — all four relevant claims are
 *     admitted: the policy change, the added reps, the drop in complaints, and
 *     the speaker's causal belief (claim_type self_reported_diagnosis,
 *     speaker_assertion true). The competing explanation is present as its own
 *     admitted claim.
 *
 * Q2. Does SOD need information lost when the graph is built?
 *     What is lost: `source_span`. GraphNode
 *     (evidence-runtime/src/evidenceGraph.ts:13) drops the span that
 *     ValidatedClassA carries, and node ARRAY order is not transcript order
 *     (Case 009 proves it: a_reps at index 1 has span 229-280 while a_outcome
 *     at index 2 has span 77-156). So transcript order is NOT recoverable from
 *     the graph.
 *     For these four tags it is NOT required: `prior_belief` as a claim_type
 *     already encodes "believed first", the Class B contrast edge already
 *     encodes the reversal relation, and the 009 quotes carry their own time
 *     words ("at the start of the quarter", "by the end of the quarter",
 *     "that same month"). Order would be required for positional principles
 *     (H8 buried lede, H9 weak close) — out of scope for v0.1, and recorded
 *     as a known limit rather than pre-emptively fixed.
 *
 * Q3. Minimum additional information required: NONE. The experiment adds no
 *     input beyond what the graph already admits. If assumption_reversal fails
 *     the stability criterion, missing order is the first hypothesis to test —
 *     that reading is pre-registered here, not invented afterwards.
 *
 * Q4. Does this weaken the Evidence Validator's authority? No, in three ways:
 *     - SOD sees only what the Validator ADMITTED. Rejected proposals and raw
 *       transcript text are unreachable to it.
 *     - Class C (non-admissible hypotheses) is deliberately EXCLUDED. Case 001's
 *       Class C entry is "the speaker was personally among those who initially
 *       believed it was a programming issue" — feeding that in would hand SOD
 *       the assumption_reversal answer through a non-admissible route and make
 *       the test dishonest. Class C is speculation the architecture already
 *       ruled inadmissible; it must not seed perception.
 *     - Every SOD proposal must cite ids that were supplied. An observation
 *       that cannot be traced to supplied evidence is rejected downstream
 *       (see validateObservations in detector.ts).
 *
 * Raw transcript access was considered and REJECTED: it is not needed (Q1),
 * and it would let SOD reason over text the Validator never admitted — the one
 * boundary the structured path exists to hold.
 * ---------------------------------------------------------------------------
 */
import { EvidenceGraph } from "../../evidence-runtime/src/evidenceGraph";

export interface SodInputNode {
  id: string;
  claim_type: string;
  quote: string;
  /** true when the Validator marked the claim as the speaker's own assertion (a belief), not a reported fact. */
  speaker_assertion: boolean;
}

export interface SodInputEdge {
  id: string;
  relationship_type: string;
  component_ids: string[];
  marker_text: string;
}

export interface SodInput {
  nodes: SodInputNode[];
  edges: SodInputEdge[];
}

/**
 * Pure reshaping of the admitted graph into the SOD input. Drops:
 *   - `admitted_by`   — provenance bookkeeping, carries no semantic signal
 *   - `non_admissible` — Class C, excluded on purpose (see Q4 above)
 * Adds nothing.
 */
export function buildSodInput(graph: EvidenceGraph): SodInput {
  return {
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      claim_type: n.claim_type,
      quote: n.quote,
      speaker_assertion: n.speaker_assertion,
    })),
    edges: graph.edges.map((e) => ({
      id: e.id,
      relationship_type: e.relationship_type,
      component_ids: e.component_ids,
      marker_text: e.marker_text,
    })),
  };
}

/** Every id SOD is allowed to cite. Anything outside this set is untraceable and must be rejected. */
export function suppliedIds(input: SodInput): Set<string> {
  return new Set([...input.nodes.map((n) => n.id), ...input.edges.map((e) => e.id)]);
}

/** The evidence block as the model sees it. Stable ordering: nodes as given, then edges. */
export function renderSodInput(input: SodInput): string {
  const nodes = input.nodes
    .map((n) => `  ${n.id} | claim_type=${n.claim_type} | speaker_assertion=${n.speaker_assertion} | "${n.quote}"`)
    .join("\n");
  const edges = input.edges.length
    ? input.edges
        .map((e) => `  ${e.id} | relationship=${e.relationship_type} | connects=[${e.component_ids.join(", ")}] | marker="${e.marker_text}"`)
        .join("\n")
    : "  (none)";
  return `ADMITTED CLAIMS:\n${nodes || "  (none)"}\n\nADMITTED RELATIONSHIPS:\n${edges}`;
}
