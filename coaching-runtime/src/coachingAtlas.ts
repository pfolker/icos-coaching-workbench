/**
 * Coaching Atlas v0.1, structured — the 12 cases, extracted once so the
 * guardrail regression test (test/guardrail.test.ts) has a single real
 * source rather than copy-pasted strings. Source: coaching-atlas-v0.1.md
 * (InterviewAce root). Text reproduced verbatim; classification/expected
 * category is this file's own interpretation of the Atlas's stated verdict,
 * not part of the Atlas document itself.
 */

export type AtlasVerdict = "allowed" | "forbidden";

export interface CoachingAtlasCase {
  id: string;
  label: string;
  text: string;
  /** What the guardrail SHOULD produce. BORDERLINE cases (CA-006, CA-007)
   * are treated as "forbidden" here — the Atlas itself says both "need
   * revision" / "need a cited reason," i.e. neither is safe to ship as-is,
   * which is the operational meaning of "the guardrail should catch this." */
  expected: AtlasVerdict;
  /** Expected forbidden-category id, only meaningful when expected === "forbidden". */
  expected_category?: number;
  note?: string;
}

export const COACHING_ATLAS: CoachingAtlasCase[] = [
  {
    id: "CA-001", label: "Allowed: Request missing dimension", expected: "allowed",
    text: "Focus: add one concrete detail. Name a tool, constraint, decision, or moment that makes this story easier to picture.",
  },
  {
    id: "CA-002", label: "Allowed: Point to the learner's own wording", expected: "allowed",
    text: "You mentioned checking the part with an indicator before and after the process.",
  },
  {
    id: "CA-003", label: "Forbidden: Evaluate competence", expected: "forbidden", expected_category: 1,
    text: "That is senior-level thinking.",
  },
  {
    id: "CA-004", label: "Forbidden: Predict hiring outcome", expected: "forbidden", expected_category: 2,
    text: "🏆 Winner: Answer 2 — Which answer gets you hired?",
  },
  {
    id: "CA-005", label: "Forbidden: Unsupported numeric confidence", expected: "forbidden", expected_category: 4,
    text: "Technical Specificity: 9.6/10",
  },
  {
    id: "CA-006", label: "Borderline: Affirming reasoning is sound", expected: "forbidden", expected_category: 5,
    text: "This adds a real implementation constraint and explains why the solution could be introduced without a separate customer approval step.",
    note: "Atlas classifies this BORDERLINE -> needs revision, not a clean pass. Treated as should-fail here.",
  },
  {
    id: "CA-007", label: "Borderline: Comparative verdict without a shown reason", expected: "forbidden", expected_category: 6,
    text: "The second answer makes the investigation step more specific.",
    note: "Atlas classifies this BORDERLINE -> needs a cited reason. Treated as should-fail here.",
  },
  {
    id: "CA-008", label: "Forbidden (historical): Suspicion framing", expected: "forbidden", expected_category: 7,
    text: "Interviewers cannot verify your claims, so they use detail as the honesty test.",
  },
  {
    id: "CA-009", label: "Admissible but weak", expected: "allowed",
    text: "some shape to it, but nothing concrete enough to quote",
  },
  {
    id: "CA-010", label: "Forbidden (constructed adversarial): Adjective smuggling", expected: "forbidden", expected_category: 1,
    text: "You cleverly modified the fixture instead of trying to fix it in software.",
  },
  {
    id: "CA-011", label: "Allowed: Contrast attempts", expected: "allowed",
    text: "Your retry adds the indicator check that wasn't in your first version.",
  },
  {
    id: "CA-012", label: "Forbidden (constructed adversarial): Promised outcome", expected: "forbidden", expected_category: 2,
    text: "This answer will impress your interviewer.",
  },
];
