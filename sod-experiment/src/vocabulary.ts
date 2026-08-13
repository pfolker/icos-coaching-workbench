/**
 * The FIXED experimental semantic vocabulary — v0.1, four tags, closed set.
 *
 * Deliberately NOT a taxonomy. Every tag below names a semantic signal that
 * (a) an existing corpus case demonstrably contains, and (b) the Evidence
 * Graph representation provably cannot carry (see
 * PRINCIPLE-SELECTION-SEAM-FINDINGS.md, Findings 2 and 7). No tag was added to
 * make the vocabulary look complete; optional tags such as `specificity_gap`
 * and `strong_root_cause_reasoning` were CONSIDERED AND EXCLUDED because no
 * founder-reviewed corpus case establishes their ground truth (see
 * EXCLUDED_TAGS below).
 *
 * A tag is a PERCEPTION, never a decision. Nothing here names a habit, a
 * teaching principle, a Teaching Move, or a readiness status.
 */

export const SEMANTIC_TAGS = [
  "ownership_dilution",
  "result_needs_substance",
  "assumption_reversal",
  "unresolved_alternative_cause",
] as const;

export type SemanticTag = (typeof SEMANTIC_TAGS)[number];

export interface TagDefinition {
  tag: SemanticTag;
  /** The definition given to the model verbatim. */
  meaning: string;
  /** Explicit non-triggers — what this tag is NOT, to bound false positives. */
  not: string;
  /** The corpus case whose ground truth supports the tag, and the authority for it. */
  ground_truth: string;
  /** Positive or negative observation — the vocabulary must be able to see strengths. */
  polarity: "strength" | "gap" | "uncertainty";
}

export const TAG_DEFINITIONS: TagDefinition[] = [
  {
    tag: "ownership_dilution",
    meaning:
      "The answer makes it difficult to distinguish the speaker's individual contribution from the team's contribution.",
    not:
      "A single incidental plural pronoun in an answer whose actions are otherwise clearly the speaker's own is NOT dilution. Dilution requires that a reader could not say which of the described actions the speaker personally performed.",
    ground_truth: "Case 006 (contradictory ownership, staging env) — calibration corpus",
    polarity: "gap",
  },
  {
    tag: "result_needs_substance",
    meaning:
      "The answer contains result-shaped language or an implied outcome, but the stated result does not carry enough substance to show a meaningful effect.",
    not:
      "An answer with NO result at all is not this tag (nothing result-shaped exists to judge). A result that is unquantified but concrete and consequential is not this tag either — the test is substance, not the presence of a number.",
    ground_truth: "Case 005 (ambiguous ownership, reports automation) — calibration corpus",
    polarity: "gap",
  },
  {
    tag: "assumption_reversal",
    meaning:
      "A meaningful strength of the answer is the contrast between what was initially believed and what the speaker subsequently discovered.",
    not:
      "A problem that was merely unexpected, or a fact that did not match a record, is not a reversal. There must be a stated prior belief AND a later finding that overturns it.",
    ground_truth: "Case 001 / HF-001 (founder's original, deburring) — founder-supported target",
    polarity: "strength",
  },
  {
    tag: "unresolved_alternative_cause",
    meaning:
      "The speaker attributes an outcome to one explanation while the same answer contains another plausible explanation that is never addressed.",
    // PROMPT REVISION 1 (the single authorized revision). Revision 0's clause
    // read: "An answer that describes an action followed by an outcome without
    // the speaker asserting a cause is NOT this tag. An answer with only one
    // candidate explanation is not this tag. The tag marks CAUSAL UNCERTAINTY;
    // it never decides which explanation is correct."
    // It produced two grounded-looking but fabricated attributions (control
    // `nursing` 2/3, primary `001` 3/3): in both, SOD asserted that "the
    // speaker attributes" an outcome to a cause when the speaker had asserted
    // no such thing, and in `nursing` it also nominated an OUTCOME claim as the
    // competing cause. The revision states the two preconditions the tag
    // silently assumed. It is a definitional rule applied to every case, not a
    // case-specific exception.
    not:
      "This tag has two preconditions and both must hold. FIRST, the speaker must actually have asserted a cause. Look for it in the evidence: a claim with speaker_assertion=true that states the cause, or an admitted relationship that encodes the attribution. Claims that merely sit next to each other, or that follow one another in time, are NOT an attribution — an action followed by an outcome with no stated cause is NOT this tag, no matter how natural the causal reading feels. SECOND, the competing explanation must be a plausible CAUSE, not another outcome, another result, or a later step in the same sequence. Two findings that could both be parts of one chain are not competing explanations. If either precondition fails, do not use this tag. The tag marks CAUSAL UNCERTAINTY; it never decides which explanation is correct.",
    ground_truth:
      "Case 009 (genuine quotes, invalid reasoning, return policy) — Evidence Atlas: the speaker's causal belief must not be promoted, because another plausible same-period cause is unaddressed",
    polarity: "uncertainty",
  },
];

/**
 * Tags considered and NOT included in v0.1, recorded so the exclusion is a
 * decision rather than an omission. Both were rejected under the same rule:
 * the work order permits an optional tag only if an existing founder-reviewed
 * corpus case establishes its ground truth before implementation.
 */
export const EXCLUDED_TAGS: { tag: string; why_excluded: string }[] = [
  {
    tag: "specificity_gap",
    why_excluded:
      "No founder-reviewed corpus case establishes the ground truth. The frozen path fires O5_vagueness on 9 of 15 calibration cases including Case 001, which the founder's own capstone establishes as rich — so the deterministic label cannot be used as ground truth, and no independent founder judgment exists to replace it.",
  },
  {
    tag: "strong_root_cause_reasoning",
    why_excluded:
      "Overlaps assumption_reversal on its only supporting case (001) and has no distinct corpus case of its own. Adding it would inflate the vocabulary without adding a testable claim.",
  },
];
