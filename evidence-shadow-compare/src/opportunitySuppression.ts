/**
 * Opportunity Suppression — Milestone 3 (O5 Product Correction).
 *
 * This module is the answer to Step 3's required-first question: "check
 * whether the O3 ladder-exclusivity mechanism
 * (resolveLadderConflictsForRendering, ./ladderExclusivity.ts) can be
 * generalized into a shared opportunity-suppression pattern both O3 and O5
 * use, rather than building a second, parallel implementation."
 *
 * INVESTIGATED, NOT ASSUMED: confirmed by running the real founder_retry
 * fixture through the real decide() (see coaching-runtime/founderCase.ts +
 * the Milestone 3 report's Step 1) that O3's and O5's suppression CANNOT
 * share one function, for a precise, evidenced reason:
 *
 *   - O3's problem was ALWAYS a RENDERING problem. decide()'s own
 *     confidence tiebreak already correctly selected the right O3-ladder
 *     candidate in every case that mattered (CNC, thin, etc.) — the bug
 *     was only that quickScan showed BOTH contradictory flags. Suppressing
 *     AFTER decide() runs, on the rendered id list only, was sufficient
 *     and correct — proven across Milestones 1-2's corpus.
 *
 *   - O5's problem is NOT a rendering problem. Reproducing the flagship
 *     founder_retry case shows `O3_unquantified_result` and `O5_vagueness`
 *     co-fire, and O5_vagueness's related habit (H4) sits inside
 *     O3_unquantified_result's OWN habit_prerequisites closure (H5 → H2,
 *     H4 — opportunity-engine/src/registry.ts's HABIT_DAG). This makes
 *     O3_unquantified_result a `root_cause`-classified SYMPTOM of
 *     O5_vagueness (decision-engine/src/rules.ts's classify()), which
 *     OUTRANKS confidence entirely — confirmed directly:
 *     `rejected: [{opportunity_id: "O3_unquantified_result",
 *     rejected_by_rule: "root_cause_override", reason: "symptom this
 *     turn: cause(s) O5_vagueness co-fired"}]`. Merely ADDING the
 *     evidence-derived O3_unquantified_result candidate (Milestone 1's
 *     whole mechanism) can never change this — root_cause classification
 *     happens BEFORE tiebreak ever runs. A rendering-only fix would leave
 *     O5_vagueness as the SELECTED "Today's Focus" even if its Coach's
 *     Note were hidden — the single worst possible outcome (a hidden flag
 *     but an unchanged, wrong coaching decision). O5 suppression MUST
 *     remove the candidate from the array BEFORE decide() runs.
 *
 * What IS genuinely shared, and lives in this one file/module as the
 * answer to "generalize into a shared pattern": both mechanisms are
 * DECLARATIVE RULE TABLES (a suppressed id, a condition, and named
 * reasoning) rather than ad hoc inline logic, and both are documented
 * together so a future engineer finds one conceptual home for "how does
 * this codebase decide a candidate should not survive to X" — not two
 * unrelated mechanisms discovered by accident. `ladderExclusivity.ts`'s
 * exports are re-exported from here unchanged (zero behavior risk to the
 * already-tested O3 mechanism) alongside the new O5 mechanism below.
 */
import { EvidenceGraph } from "../../evidence-runtime/src/evidenceGraph";
import { CandidateOpportunity } from "../../opportunity-engine/src/types";

export { LADDER_EXCLUSIVITY_RULES, resolveLadderConflictsForRendering } from "./ladderExclusivity";
export type { LadderRule } from "./ladderExclusivity";

/**
 * Milestone 2's specificity_indicators history, read before designing this
 * (per the founder's explicit instruction): a proposed open-ended
 * vocabulary field ("named component," "named geometry," "described
 * mechanism"-style terms) was explicitly rejected for coaching-runtime's
 * Teaching Move selection (see coaching-runtime/src/teachingMove.ts's own
 * doc comment: "no `specificity_indicators` or `concrete_entities` fields,
 * per the explicit boundary... those were flagged... as untested and not
 * adopted") — the same failure shape already lived once in the ORIGINAL
 * regex detectors (open-ended keyword/marker lists needing continual
 * tuning; confirmed again this session in coaching-runtime's own
 * GROUNDING_STOPWORDS list, which needed two separate rounds of tuning
 * against fresh live output). This rule does NOT reintroduce that: it
 * counts membership in the EXISTING, CLOSED `claim_type` and
 * `relationship_type` enums (evidence-validator/src/types.ts's
 * CLAIM_TYPE_ENUM / RELATIONSHIP_TYPE_ENUM) — no new field, no new
 * vocabulary, nothing to tune. `action`/`constraint`/`decision` are three
 * of the ten already-ratified claim_type values; "at least one edge"
 * counts admission into the five-member RELATIONSHIP_TYPE_ENUM. Precedent:
 * coaching-runtime/src/teachingMove.ts already uses exactly this shape of
 * signal (`class_a_count`/`class_b_count` thresholds over closed-enum
 * node/edge counts, not an open-ended lexicon) to solve the identical
 * "founder's rich answer must not be called vague" problem one layer
 * downstream — this rule is the same idea, at the Observation layer.
 *
 * THE RULE: suppress O5_vagueness from the pre-decide() candidates array
 * when the Evidence Graph contains BOTH:
 *   (a) >= 1 admissible node with claim_type in {action, constraint,
 *       decision}, AND
 *   (b) >= 1 admissible edge of any relationship_type.
 *
 * WHY THE DUAL GATE (not (a) alone): Milestone 2's feasibility check used
 * (a) alone and found 0 false suppressions across 16 real cases — but that
 * corpus never included an adversarial case designed to break a
 * single-dimension count (an isolated, unconnected, low-content claim that
 * happens to match one closed enum value in an otherwise vacuous answer).
 * Requiring a connecting relationship edge too — evidence the claim is
 * part of a narrated, connected story, not a single throwaway word —
 * closes that gap using the SAME two closed enums the founder authorized,
 * nothing new. Verified (not assumed) against all 16 real Milestone 1/2
 * corpus graphs plus new adversarial constructions — see the Milestone 3
 * report, Step 4.
 *
 * MUST NOT SUPPRESS: any case where either gate fails. Known,
 * unresolved interactions (named, not silently patched):
 *   - context_fact: a claim_type deliberately used (Phase 3.1 Freeze
 *     Audit, Atlas Case 008/009) to keep the Class A/B layer causally
 *     neutral. Real specificity parked there (e.g. atlas_008's sealant
 *     supplier switch) is invisible to this count. This rule does NOT
 *     attempt to fix that — extending the count to include context_fact
 *     would require resolving what fraction of "genuinely tangential
 *     material" vs. "real specificity" that broad claim_type covers,
 *     unfinished design work, out of scope here.
 *   - O3 ladder: independent mechanism, independent pipeline stage
 *     (O3 suppression is post-decide() rendering-only; this is
 *     pre-decide() candidate removal). Both can apply to the same
 *     transcript without conflict — confirmed by construction, since they
 *     touch different candidates (O5_vagueness vs. the O3 pair) at
 *     different times.
 *   - root_cause masking (Milestone 2's finding): unaffected by this rule
 *     in the OTHER direction — if some OTHER unmapped id (e.g.
 *     O4_ownership_hiding) wins root_cause priority after O5 is removed,
 *     that escalation is untouched; this rule only ever removes
 *     O5_vagueness itself, never overrides a different id's priority
 *     classification.
 */
export const SPECIFICITY_CLAIM_TYPES: ReadonlySet<string> = new Set(["action", "constraint", "decision"]);

export interface CandidateSuppressionRule {
  name: string;
  /** the opportunity_id this rule can remove from the pre-decide() array */
  suppresses: string;
  reasoning: string;
  /** true if, given this transcript's Evidence Graph, `suppresses`'s own
   *  underlying claim is evidentially contradicted and should be removed
   *  entirely — not merely hidden from rendering. */
  shouldSuppress: (graph: EvidenceGraph) => boolean;
}

export const CANDIDATE_SUPPRESSION_RULES: CandidateSuppressionRule[] = [
  {
    name: "O5 specificity suppression",
    suppresses: "O5_vagueness",
    reasoning:
      "O5_vagueness asserts NO specificity anywhere in the answer. An " +
      "admissible action/constraint/decision claim, connected to at least " +
      "one other claim by a validated relationship, is direct, closed-enum " +
      "evidence that assertion is false — not merely incomplete the way " +
      "O3_missing_result's absence claim can be contested by presence " +
      "(this is a REMOVAL, not a competing candidate, because O5's own " +
      "root_cause priority can outrank any competing candidate regardless " +
      "of confidence — see this module's own top comment).",
    // KNOWN, CONFIRMED GAP (rating: MEDIUM, not HIGH — see the Milestone 3
    // report's Step 7 UPDATE for full detail): gate (b) below only checks
    // that SOME edge exists, never that the claims it connects carry real
    // content. Live-confirmed exploitable via a raw-position temporal_
    // sequence edge (no marker required) AND a genuine explicit_connective
    // edge ("so", legitimately admitted) — both cleared this gate over
    // claims with zero concrete content ("I tried a few things... it got
    // fixed" / "I changed something... it got better"). contrast_marker is
    // suspected to share this (same admission mechanism), unconfirmed;
    // enumeration requires no marker at all and is suspected most exposed.
    // Closing this needs a real content-specificity check in gate (a) or
    // (b), not membership alone — a dual-gate redesign, not a patch; not
    // scoped or attempted here. Do not promote to live rendering without
    // resolving this or knowingly accepting it as a risk.
    shouldSuppress: (graph) => {
      const specificityClaims = graph.nodes.filter((n) => SPECIFICITY_CLAIM_TYPES.has(n.claim_type));
      return specificityClaims.length >= 1 && graph.edges.length >= 1;
    },
  },
];

export interface SuppressionResult {
  candidates: CandidateOpportunity[];
  /** opportunity_ids actually removed this turn, and why — never silent */
  suppressed: { opportunity_id: string; rule_name: string; reasoning: string }[];
}

/**
 * Applied to the candidates array BEFORE it is handed to decide() —
 * pre-decide(), unlike resolveLadderConflictsForRendering (post-decide(),
 * rendering only). See this module's top comment for why the two
 * mechanisms cannot share one function.
 */
export function suppressUnsupportedCandidates(
  candidates: CandidateOpportunity[],
  graph: EvidenceGraph
): SuppressionResult {
  const suppressedIds = new Set<string>();
  const suppressed: SuppressionResult["suppressed"] = [];
  for (const rule of CANDIDATE_SUPPRESSION_RULES) {
    const present = candidates.some((c) => c.opportunity_id === rule.suppresses);
    if (present && rule.shouldSuppress(graph)) {
      suppressedIds.add(rule.suppresses);
      suppressed.push({ opportunity_id: rule.suppresses, rule_name: rule.name, reasoning: rule.reasoning });
    }
  }
  return {
    candidates: candidates.filter((c) => !suppressedIds.has(c.opportunity_id)),
    suppressed,
  };
}
