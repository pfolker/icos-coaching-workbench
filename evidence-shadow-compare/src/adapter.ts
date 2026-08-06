/**
 * EvidenceGraphOpportunityAdapter — Track A, Step 2.
 *
 * Maps a validated Evidence Graph (evidence-runtime's Stage 4 output) onto
 * opportunity-engine's CandidateOpportunity contract, so real Evidence-Graph
 * findings can be fed into the SAME, real, unmodified Decision Engine
 * alongside the regex pipeline's own candidates — never replacing them.
 *
 * ONLY TWO of the nine real opportunity ids are mapped here:
 *   O3_missing_result, O3_unquantified_result
 *
 * The other seven (O2_structureless_ramble, O4_ownership_hiding,
 * O5_vagueness, O7_weak_close, O8_buried_lede, O10_filler_density,
 * O11_employer_negativity) are NOT mapped. This is Step 1's finding, not an
 * oversight — see README.md Section 1 for the full reasoning per id. In
 * summary, each falls into one of two structural gaps:
 *  (a) the detector is fundamentally an ABSENCE-across-an-open-ended-space
 *      check (any structure, any specificity, any diversity of markers) —
 *      the Evidence Graph only ever asserts what IS present, so it cannot
 *      manufacture a positive candidate for "nothing of this unbounded kind
 *      exists" without inventing a proxy the schema doesn't define; or
 *  (b) the detector measures a dimension the Evidence Specification does
 *      not model at all (pronoun/grammatical-subject register for O4,
 *      discourse-final hedging for O7, transcript position/ordering for O8
 *      — GraphNode carries no source_span, unlike ValidatedClassA — filler
 *      disfluency for O10, sentiment/tone for O11).
 *
 * O3's two ids are the one clean exception: both pivot on a SINGLE,
 * well-defined claim_type ("outcome") and a SINGLE, well-defined
 * relationship_type ("quantity_binding") that the Specification already
 * defines for exactly this purpose — a closed, two-state ladder mirrors the
 * real detectors' own mutual exclusivity precisely:
 *   no outcome claim admitted anywhere       -> O3_missing_result
 *   outcome claim(s) admitted, none quantity-bound -> O3_unquantified_result
 */
import { EvidenceGraph, GraphNode } from "../../evidence-runtime/src/evidenceGraph";
import { CandidateOpportunity, OpportunityContext } from "../../opportunity-engine/src/types";
import { HABIT_DAG, REGISTRY } from "../../opportunity-engine/src/registry";

export const MAPPED_OPPORTUNITY_IDS = ["O3_missing_result", "O3_unquantified_result"] as const;

export interface UnmappedReason {
  opportunity_id: string;
  reason: string;
}

/** Step 1's finding, carried as data so the comparison UI can display it
 *  honestly instead of silently omitting the other seven ids. */
export const UNMAPPED_OPPORTUNITY_IDS: UnmappedReason[] = [
  { opportunity_id: "O2_structureless_ramble",
    reason: "Absence-based over an open-ended space (\"fewer than 2 of 4 structure marker TYPES\"). The Evidence Graph only asserts claims that ARE present; it has no claim_type for \"task\" distinct from \"action\" either, so even a partial proxy would be inventing a dimension the schema doesn't have." },
  { opportunity_id: "O4_ownership_hiding",
    reason: "Requires pronoun / grammatical-subject register (I vs. we, agency-verb-to-I attribution) — a dimension the Evidence Specification does not model. An \"action\" claim's quote doesn't carry a structured owner field; recovering this would mean re-deriving the same pronoun heuristic from quote text, not using the graph's own structure." },
  { opportunity_id: "O5_vagueness",
    reason: "Absence-based over an open-ended space (any number, any named tool/action/constraint, anywhere). The Evidence Graph reliably shows the OPPOSITE — real, concrete action/constraint/decision claims when they exist (see README.md's throughline finding) — but there is no way to assert a positive \"O5_vagueness\" candidate from evidence, since evidence only ever records presence. This is the founder's real Case 001 incident: the regex fired on zero digits despite genuine, quotable specificity." },
  { opportunity_id: "O7_weak_close",
    reason: "Discourse-final hedging (\"I guess\", trailing off) is a delivery/discourse-marker signal, not an evidentiary claim. Nothing in the CLAIM_TYPE_ENUM represents how confidently or how completely a sentence closes." },
  { opportunity_id: "O8_buried_lede",
    reason: "Requires knowing WHERE in the transcript a claim occurs (opening vs. buried). ValidatedClassA carries a source_span, but evidence-runtime's own buildEvidenceGraph() deliberately does not carry source_span onto GraphNode (see evidence-runtime/src/evidenceGraph.ts) — position information is lost at exactly the layer this adapter reads from. A real, confirmed schema gap, not a judgment call." },
  { opportunity_id: "O10_filler_density",
    reason: "Disfluency / acoustic density (filler_per_minute, duration) is entirely outside the Evidence Specification's scope, which validates grounded CONTENT claims, never speech mechanics." },
  { opportunity_id: "O11_employer_negativity",
    reason: "Requires sentiment/tone classification of a quote's content. The Evidence Validator checks grounding and claim_type fit, never emotional valence — a \"problem\" claim about a past employer is validated identically whether it's neutral or scathing." },
];

const outcomeNodes = (graph: EvidenceGraph): GraphNode[] =>
  graph.nodes.filter((n) => n.claim_type === "outcome");

const quantityBoundIds = (graph: EvidenceGraph): Set<string> =>
  new Set(
    graph.edges
      .filter((e) => e.relationship_type === "quantity_binding")
      .flatMap((e) => e.component_ids)
  );

/** Same trivial DAG-walk opportunity-engine's own (unexported) prerequisitesOf
 *  performs, operating only on the publicly exported HABIT_DAG data — not a
 *  reimplementation of any detection judgment, just generic graph traversal. */
function prerequisitesOf(habits: string[]): string[] {
  const out = new Set<string>();
  const walk = (h: string) => {
    for (const dep of HABIT_DAG[h] ?? []) {
      if (!out.has(dep)) { out.add(dep); walk(dep); }
    }
  };
  habits.forEach(walk);
  habits.forEach((h) => out.delete(h));
  return [...out].sort();
}

/**
 * Validated Class A admission is a strict, mechanical, all-or-nothing check
 * (quote must appear verbatim + pass claim_type verifiability) — a
 * different KIND of certainty than the regex engine's own probabilistic
 * keyword heuristics, but not an unconditional one either: claim_type FIT
 * itself can still be genuinely ambiguous (see the Phase 3.1 freeze audit's
 * Case 009 action-vs-context_fact finding). 0.8 reflects that: higher than
 * the regex engine's absence-based candidates (which cap around 0.5-0.7),
 * but deliberately short of "certain".
 */
const ADAPTER_CONFIDENCE = 0.8;

function assemble(
  opportunity_id: "O3_missing_result" | "O3_unquantified_result",
  spanQuotes: string[],
  absent_signals: string[],
  ctx?: OpportunityContext
): CandidateOpportunity {
  const entry = REGISTRY.find((r) => r.opportunity_id === opportunity_id)!;
  const habit_prerequisites = prerequisitesOf(entry.related_habits);
  return {
    opportunity_id,
    related_habits: [...entry.related_habits],
    evidence: {
      // Position fields are honestly unavailable at this layer (see
      // O8_buried_lede's UNMAPPED reason above — GraphNode carries no
      // source_span) — sentinel -1 rather than a fabricated 0, so this is
      // visibly "unknown position", never confused with a real offset.
      spans: spanQuotes.map((span_text) => ({
        sentence_index: -1, char_start: -1, char_end: -1, span_text,
      })),
      // Not real observation-engine observation_types (different vocabulary
      // entirely) — prefixed so this is never mistaken for one downstream.
      observation_types_cited: spanQuotes.length > 0 ? ["evidence_graph:outcome"] : [],
      metrics_cited: [], // the Evidence Graph has no InMetrics equivalent
      absent_signals,
    },
    confidence: ADAPTER_CONFIDENCE,
    growth_potential: entry.growth_potential,
    mission_alignment: !ctx?.mission_habit_id
      ? "no_mission"
      : entry.related_habits.includes(ctx.mission_habit_id) ? "aligned" : "unaligned",
    dependencies: {
      habit_prerequisites,
      // NOT recomputed across the merged pool — a known, reported limitation
      // (README.md Section 6), not silently glossed over. Co-firing
      // detection is sensitive to the full candidate set at computation
      // time; the regex candidates' own upstream_candidates_cofired values
      // were computed knowing only the regex pool, and adapter candidates
      // don't attempt to re-derive opportunity-engine's private co-firing
      // logic externally.
      upstream_candidates_cofired: [],
    },
    readiness: { allowed_states: [...entry.allowed_states] },
  };
}

/**
 * Produces 0 or 1 candidate (O3's two states are mutually exclusive, exactly
 * mirroring detectMissingResult/detectUnquantifiedResult's own mutual
 * exclusivity in opportunity-engine/src/detectors.ts).
 */
export function EvidenceGraphOpportunityAdapter(
  graph: EvidenceGraph,
  ctx?: OpportunityContext
): CandidateOpportunity[] {
  const outcomes = outcomeNodes(graph);

  if (outcomes.length === 0) {
    return [assemble("O3_missing_result", [], ["evidence_graph_claim:outcome"], ctx)];
  }

  const bound = quantityBoundIds(graph);
  const allUnquantified = outcomes.every((n) => !bound.has(n.id));
  if (allUnquantified) {
    return [assemble(
      "O3_unquantified_result",
      outcomes.map((n) => n.quote),
      ["quantity_binding"],
      ctx
    )];
  }

  // at least one outcome claim IS quantity-bound: the story communicated at
  // least one measurable result — O3's ladder does not fire either state.
  return [];
}
