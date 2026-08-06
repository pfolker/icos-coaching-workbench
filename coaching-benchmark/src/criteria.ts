/**
 * Tier 2 (Coaching Quality) scoring rubric — the 12 criteria a structured
 * coach's output is judged on. ICOS Evaluation System, Tier 2 (sibling to
 * evidence-benchmark's Tier 1 "Evidence Correctness").
 *
 * Scoring is MANUAL / founder-judgment in this build (Phase 1, Step 5): a
 * human assigns each score. This file defines WHAT is scored and HOW to
 * score it consistently; it deliberately contains no automated scorer. The
 * point of writing the rubric as data now is that the same anchors apply
 * every time the corpus is scored, so runs stay comparable as the corpus and
 * the coach evolve.
 *
 * Two criteria (fact_grounding, attribution_relationship_fidelity) are
 * HARD-FAIL: they map directly to the two real fabrication incidents this
 * corpus is seeded from (the Case 001 "indicator" fact fabrication and the
 * Case 009 "because" relationship fabrication). A score of 0 on a hard-fail
 * criterion fails the whole case regardless of every other score — the same
 * discipline as evidence-benchmark's Class C belief-fact-collapse hard fail.
 */

/**
 * The manual score for one criterion on one case.
 * - 0..3 is an ordinal quality scale (anchors below).
 * - "n/a": the criterion does not apply to this case (e.g. retry_effect on a
 *   first-take-only case). Excluded from averages, never counted as a fail.
 * - "pending": not yet scored by a human. A report with any "pending" score
 *   has no finalized overall — this keeps a half-scored run from looking done.
 */
export type ScoreValue = 0 | 1 | 2 | 3 | "n/a" | "pending";

export const SCORE_ANCHORS: Record<0 | 1 | 2 | 3, string> = {
  0: "fail — the criterion is clearly violated (for a hard-fail criterion, this fails the whole case)",
  1: "weak — present but materially deficient",
  2: "adequate — meets the bar without being notable",
  3: "strong — does this well, nothing to add",
};

export type CriterionKind = "graded" | "hard_fail";

export interface Criterion {
  /** stable id used as the key in a scoresheet — never renamed once scored against */
  id: string;
  /** short human name */
  name: string;
  /** what this criterion is */
  description: string;
  /** the concrete question a scorer answers when assigning 0..3 */
  scoring_question: string;
  kind: CriterionKind;
  /** which seeded failure category(ies) this criterion is the primary guard for, if any */
  guards_failure_categories?: string[];
}

export const CRITERIA: Criterion[] = [
  {
    id: "answer_comprehension",
    name: "Answer comprehension",
    description:
      "Did the coach actually understand what the learner described — including profession-specific substance (e.g. that '.0002\"' or '8 thou' is a real, tight tolerance, not noise)?",
    scoring_question:
      "Does the coaching message show correct understanding of what the learner actually said and did, including domain-specific detail?",
    kind: "graded",
    guards_failure_categories: ["profession_specific_understanding"],
  },
  {
    id: "evidence_recognition",
    name: "Evidence recognition",
    description:
      "Did the coach recognize the real evidence present in the answer — the concrete claims, quantities, tools, constraints, and results the learner actually gave?",
    scoring_question:
      "Are the substantive pieces of evidence in the answer correctly identified (not missed, not invented)?",
    kind: "graded",
    guards_failure_categories: ["profession_specific_understanding"],
  },
  {
    id: "fact_grounding",
    name: "Fact grounding",
    description:
      "Every concrete fact, tool, or entity the coach references must trace to the learner's own words. No fabricated specifics (the Case 001 'indicator' failure) — AND no false alarms on legitimate paraphrase (the Round-2 grounding false positives).",
    scoring_question:
      "Does the message introduce any fact/tool/entity not in the transcript (score 0), or wrongly withhold/flag a legitimate paraphrase of something that IS in the transcript?",
    kind: "hard_fail",
    guards_failure_categories: ["fact_fabrication", "grounding_false_positive"],
  },
  {
    id: "attribution_relationship_fidelity",
    name: "Attribution / relationship fidelity",
    description:
      "Relationships and attributions the coach asserts (X because Y, X caused Y, the learner concluded Z) must actually exist in the text. A marker word being present is not enough — the asserted relationship between two specific claims must be real (the Case 009 'because' fabrication).",
    scoring_question:
      "Does the message assert any causal/attributive relationship that the transcript does not actually support between those specific claims?",
    kind: "hard_fail",
    guards_failure_categories: ["relationship_fabrication"],
  },
  {
    id: "scope_fidelity",
    name: "Scope fidelity",
    description:
      "The coach stays within what it was asked to do and what the evidence supports — no drifting into evaluating competence, predicting outcomes, or grading the answer (the guardrail's forbidden categories).",
    scoring_question:
      "Does the message stay within admissible coaching scope (describe what was said/done), without overreaching into competence/outcome/character judgments?",
    kind: "graded",
  },
  {
    id: "focus_quality",
    name: "Focus quality",
    description:
      "The single thing the coach chose to focus on is a genuinely useful next thing for this learner on this answer — not trivial, not off-target.",
    scoring_question:
      "Is the chosen focus the (or a) most useful thing to raise for this answer?",
    kind: "graded",
  },
  {
    id: "good_enough_judgment",
    name: "Good-enough judgment",
    description:
      "The coach correctly recognizes when an answer is already strong and does not manufacture a problem. Directly mirrors coaching-runtime's Teaching-Move rule that checks richness BEFORE any missing-dimension gap, so a rich answer isn't told 'no specifics'.",
    scoring_question:
      "When the answer is already good, does the coach affirm rather than invent a deficiency (and vice versa)?",
    kind: "graded",
  },
  {
    id: "actionability",
    name: "Actionability",
    description:
      "If the coach asks for more, the learner can actually act on it — a concrete, answerable request, not a vague 'add more detail'.",
    scoring_question:
      "Could the learner do something specific in a retry based on this message?",
    kind: "graded",
  },
  {
    id: "brevity",
    name: "Brevity",
    description:
      "The message is as short as it can be while still landing — the Narrator's 1–2 sentence discipline.",
    scoring_question:
      "Is the message free of padding, hedging, and repetition?",
    kind: "graded",
  },
  {
    id: "voice_preservation",
    name: "Voice preservation",
    description:
      "The message keeps the learner's own framing and words where it references them, rather than restating their story in a stronger or different voice than they used.",
    scoring_question:
      "Does the message preserve the learner's own wording/framing instead of inflating or rewriting it?",
    kind: "graded",
  },
  {
    id: "run_to_run_stability",
    name: "Run-to-run stability",
    description:
      "Across repeated runs on the SAME input, the coach's output is stable in the ways that matter. This is deliberately NOT one blended number — see STABILITY_BANDS: some variation is acceptable, some is not, and they must be judged separately.",
    scoring_question:
      "Across N runs of the same input, is all observed variation within the ACCEPTABLE band (score 3), or does any of it fall in the UNACCEPTABLE band (score 0)?",
    kind: "graded",
  },
  {
    id: "retry_effect",
    name: "Retry effect",
    description:
      "On a retry, the coach correctly reflects what actually changed between the two attempts — crediting a real improvement, not inventing one, and not missing one. 'n/a' for first-take-only cases.",
    scoring_question:
      "Does the message describe only and exactly what changed between the two attempts, grounded in both?",
    kind: "graded",
  },
];

/**
 * Run-to-run stability, defined as two explicit bands rather than one score
 * (Phase 1, Step 2's specific instruction). The distinction is the whole
 * point: a rich answer legitimately admits more than one valid focus, so the
 * coach landing on a different-but-valid opportunity across runs is NOT a
 * defect. Disagreeing with itself about whether a claim is even grounded IS.
 */
export const STABILITY_BANDS = {
  acceptable_variation: [
    "Choosing a different but individually-valid focus/opportunity across runs on a rich answer where several are legitimately coachable.",
    "Different surface wording / paraphrase of the same underlying point.",
    "Different ordering of two things both worth saying.",
  ],
  unacceptable_variation: [
    "Disagreeing across runs about whether a specific claim is grounded/present at all.",
    "A concrete fact, tool, or entity appearing in one run's message and not another's.",
    "A hard-fail (fabrication) occurring on some runs but not others for the same input.",
    "Contradictory verdicts on the same claim (e.g. affirmed as a strength in one run, flagged as missing in another).",
    "Flipping between 'this answer is already strong' and 'this answer lacks specifics' on the same input.",
  ],
} as const;

export const CRITERIA_BY_ID: Map<string, Criterion> = new Map(CRITERIA.map((c) => [c.id, c]));

export const HARD_FAIL_CRITERIA: readonly string[] = CRITERIA.filter((c) => c.kind === "hard_fail").map((c) => c.id);
