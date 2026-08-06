/**
 * The benchmark corpus — SEEDED FROM REAL HISTORICAL FAILURES, not invented
 * adversarial cases (Phase 1, Step 1). Every case below is a failure that
 * actually happened in this codebase, was root-caused, and was fixed; the
 * corpus turns each into a permanent test of "did we fix what we said we
 * fixed, and does it stay fixed" (Step 4).
 *
 * Each historical-failure case records: the verbatim input, what the system
 * actually produced, what the correct output should have been, why it failed,
 * and the source citations — so the case is self-contained and auditable
 * without re-deriving it. Transcripts are embedded verbatim (not imported)
 * ON PURPOSE for these locked regression cases: the original Case 001 failure
 * was itself a copy error, so the regression fixture must not depend on a
 * mutable source elsewhere. The verbatim text here was cross-checked against
 * the cited fixture files.
 *
 * NO coach implementation lives here. Expected outputs are the documented
 * correct answers; the coach that must produce them does not exist yet
 * (Phase 2+). Scoring against these cases is manual until then.
 */

export type FailureCategory =
  | "fact_fabrication"
  | "relationship_fabrication"
  | "profession_specific_understanding"
  | "grounding_false_positive";

export interface HistoricalFailureCase {
  /** stable corpus id */
  case_id: string;
  label: string;
  /** best-effort domain tag, for corpus domain-coverage tracking */
  domain: string;
  failure_category: FailureCategory;
  /** the verbatim learner input */
  transcript: string;
  /** what the system actually produced — the failure */
  system_produced: string;
  /** the correct / expected coaching-relevant output */
  expected_output: string;
  /** the documented root cause */
  why_failed: string;
  /** criterion ids this case primarily exercises (see criteria.ts) */
  primary_criteria: string[];
  /** file:line citations for provenance */
  source_refs: string[];
  /** every Step-1 case is a permanent regression (Step 4) — always true here */
  permanent_regression: true;
}

// Verbatim, cross-checked against evidence-runtime/fixtures/case001.ts and
// evidence-benchmark/src/groundTruth.ts (case 001). The word "indicator"
// appears NOWHERE in this transcript — that is the whole point of HF-001.
const CASE_001_TRANSCRIPT =
  "One problem that stands out happened on one of our automated manufacturing lines. " +
  "We started seeing parts getting pushed away during the deburring process instead of being cleaned correctly. " +
  "At first everyone thought it was a programming issue, but after watching the machine run I realized the robot was actually applying force in a way that allowed the casting to move.\n\n" +
  "I spent time watching the process, talking with the operators, and looking at how the fixture contacted the part. " +
  "I realized we were grabbing onto a rough casting surface that wasn't locating the part consistently. " +
  "Instead of trying to solve it in software, I modified the fixture by machining two locating divots into the face of the part and redesigned the gripper pads with a conical profile so they locked into those divots every cycle.\n\n" +
  "After the change, the part stayed rigid during deburring, the brushing process became consistent, and we eliminated the issue completely. " +
  "It also improved overall throughput because operators no longer had to stop and inspect parts that had been pushed out of position.\n\n" +
  "That project reminded me that sometimes the best automation solution isn't changing the robot program—it's changing the mechanical design so the process becomes repeatable.";

// Verbatim, cross-checked against evidence-runtime/fixtures/case009.ts.
const CASE_009_TRANSCRIPT =
  "We changed our return policy to be more lenient at the start of the quarter. " +
  "Customer complaints about our support process dropped by the end of the quarter. " +
  "I think the complaints dropped because agents were less stressed after we also added two more support reps that same month.";

export const HISTORICAL_FAILURES: HistoricalFailureCase[] = [
  {
    case_id: "HF-001",
    label: "Fact fabrication — Case 001 'indicator'",
    domain: "manufacturing",
    failure_category: "fact_fabrication",
    transcript: CASE_001_TRANSCRIPT,
    system_produced:
      "A coaching message referencing \"an indicator check\" — a tool (a dial indicator) that appears nowhere in Case 001's transcript or its 12 evidence claims. The phrase belongs to Case 002 / the founder retry, and reached the learner as if it were their own.",
    expected_output:
      "A message built only from Case 001's own evidence, e.g.: \"You named the fix: two locating divots machined into the part and a conical gripper profile, after realizing the robot was applying force that let the casting move on a rough casting surface.\"",
    why_failed:
      "Root cause: a fixture-authoring copy error (routing was checked and ruled out). The deeper gap: none of the 7 guardrail categories check factual accuracy — they are all tone/overreach checks — so a fabricated tool name passed all 7 clean. This motivated the 8th check, grounding (coaching-runtime/src/grounding.ts).",
    primary_criteria: ["fact_grounding"],
    source_refs: [
      "coaching-runtime/README.md:322-387 (§9 incident report)",
      "coaching-runtime/server/server.ts:28-32 (before/after fix)",
      "evidence-runtime/fixtures/case001.ts:3-12 (transcript)",
    ],
    permanent_regression: true,
  },
  {
    case_id: "HF-002",
    label: "Relationship fabrication — Case 009 'because'",
    domain: "customer_support",
    failure_category: "relationship_fabrication",
    transcript: CASE_009_TRANSCRIPT,
    system_produced:
      "Across two independent live runs, the Listen model proposed \"because\" as a bridging 2-component relationship linking the outcome claim (\"Customer complaints ... dropped by the end of the quarter\") to the separately-quoted diagnosis claim (\"I think the complaints dropped because agents were less stressed ...\").",
    expected_output:
      "The \"because\" relationship is self-contained on the single diagnosis claim (ground-truth B1: explicit_connective, marker \"because\", on the belief claim alone). It is NOT a connector spanning the gap between two independently-quoted claims.",
    why_failed:
      "Validator returned MARKER_NOT_FOUND: \"because\" does not appear in the transcript between the two referenced components — it sits inside the diagnosis claim's own sentence. Not a missing-marker problem (\"because\" has been in EXPLICIT_CONNECTIVES since v1.0); it is a fabricated relationship provenance. Classified as model reasoning error (E). This is the concrete case behind 'presence-grounding ≠ relationship/provenance-grounding'.",
    primary_criteria: ["attribution_relationship_fidelity"],
    source_refs: [
      "evidence-validator/RESEARCH-claim-segmentation.md:60-173",
      "evidence-validator/RESEARCH-relationship-marker-taxonomy.md:66-85",
      "evidence-runtime/fixtures/case009.ts:3-6,28 (transcript + correct B1)",
    ],
    permanent_regression: true,
  },
  {
    case_id: "HF-003",
    label: "Profession-specific units — inch flatness (.0005\" → .0002\")",
    domain: "manufacturing",
    failure_category: "profession_specific_understanding",
    transcript: "I improved flatness from .0005\" to .0002\" consistently.",
    system_produced:
      "The two dimensional values were not recognized as quantified spans at all: the from-X-to-Y number pattern required a leading digit (\".0005\" starts with a dot) and required whitespace after the number (the inch mark \" sat there instead), so a real, tight tolerance read as no quantity.",
    expected_output:
      "Both \".0005\\\"\" and \".0002\\\"\" recognized as quantified dimensional spans; the quantity_binding validates (rejected == []). A coach should understand this describes a real precision improvement, not vague language.",
    why_failed:
      "Closed lexical/number patterns did not cover leading-decimal values or the inch mark as a unit. Fixed by NUMBER_OPTIONAL_LEADING_DECIMAL + OPTIONAL_UNIT_MARK (observation-engine) and dedicated inch-mark handling (evidence-validator).",
    primary_criteria: ["answer_comprehension", "evidence_recognition"],
    source_refs: [
      "observation-engine/src/lexicons.ts:24-50",
      "evidence-validator/src/lexicons.ts:112-124",
      "evidence-validator/test/reason-codes.test.ts:279",
    ],
    permanent_regression: true,
  },
  {
    case_id: "HF-004",
    label: "Profession-specific units — millimeter gap (25.4 mm)",
    domain: "manufacturing",
    failure_category: "profession_specific_understanding",
    transcript: "We reduced the gap to 25.4 mm across the run.",
    system_produced:
      "The model correctly proposed a quantity_binding relationship, but the Validator rejected it with QUANTITY_BINDING_INVALID solely because no dimensional unit (mm/millimeters) existed in the unit list at all.",
    expected_output:
      "\"25.4 mm\" recognized as a valid dimensional quantity; the quantity_binding validates. A coach should read this as a concrete measured result.",
    why_failed:
      "mm/millimeters were absent from the closed WORD_UNITS list. Fixed by adding mm|millimeters?|cm|centimeters?|m|meters? to the unit list — another 'add one more entry to the closed list' instance.",
    primary_criteria: ["answer_comprehension", "evidence_recognition"],
    source_refs: [
      "evidence-validator/src/lexicons.ts:79-84,135",
      "evidence-validator/test/reason-codes.test.ts:284",
    ],
    permanent_regression: true,
  },
  {
    case_id: "HF-005",
    label: "Profession-specific units — thou/micron runout",
    domain: "manufacturing",
    failure_category: "profession_specific_understanding",
    transcript: "I reduced runout from 8 thou to 2 thou.",
    system_produced:
      "\"8 thou\" and \"2 thou\" — real machinist shorthand for thousandths of an inch — were not recognized as quantified spans, because thou/thousandths were absent from the number+unit-word pattern. A related transcript's result verb \"dropped\" matched no result-marker keyword, wrongly firing O3_missing_result.",
    expected_output:
      "Quantified spans [\"8 thou\", \"2 thou\"] recognized (and \"dropped\" recognized as a result marker). A coach should understand this is a precise, credible improvement in machinist terms.",
    why_failed:
      "Closed unit/marker lists did not include domain shorthand. Fixed by appending thou|thousandths? to QUANT_PATTERNS and WORD_UNITS, and 'dropped' to result markers.",
    primary_criteria: ["answer_comprehension", "evidence_recognition"],
    source_refs: [
      "observation-engine/src/lexicons.ts:52-105,71",
      "observation-engine/test/observers.test.ts:91-94",
      "evidence-validator/test/reason-codes.test.ts:294-305",
    ],
    permanent_regression: true,
  },
  {
    case_id: "HF-006",
    label: "Grounding false positive — legitimate paraphrase flagged",
    domain: "manufacturing",
    failure_category: "grounding_false_positive",
    transcript: CASE_001_TRANSCRIPT,
    system_produced:
      "On fresh live output, the coarse lexical grounding check flagged legitimate paraphrase/connector words as if fabricated — e.g. \"examining\", \"source\", \"inconsistency\", \"timeframe\", \"suspected\", \"investigation\" — none of which are fabricated entities.",
    expected_output:
      "These words pass grounding: they are function/connector words and synthesis/paraphrase vocabulary that legitimately restate evidence present in the transcript (e.g. \"examining fixture contact\" paraphrases \"looking at how the fixture contacted the part\"). Grounding should flag only concrete named entities absent from the evidence (like \"indicator\"), not honest paraphrase.",
    why_failed:
      "Grounding works by 5-char stem-matching against (short) evidence quotes; a legitimate paraphrase word with no stem match reads as a false positive. Required two rounds of empirical tuning and a curated stopword list — evidence that a coarse lexical check needs ongoing tuning, not a one-time calibration. ('Grounding is solved' is false.)",
    primary_criteria: ["fact_grounding"],
    source_refs: [
      "coaching-runtime/README.md:370-415 (§9 Round-2 tuning + re-verification)",
      "coaching-runtime/src/grounding.ts:64-71 (Round-2 stopword additions)",
    ],
    permanent_regression: true,
  },
];

export const HISTORICAL_FAILURES_BY_ID: Map<string, HistoricalFailureCase> = new Map(
  HISTORICAL_FAILURES.map((c) => [c.case_id, c]),
);

export const FAILURE_CATEGORIES: readonly FailureCategory[] = [
  "fact_fabrication",
  "relationship_fabrication",
  "profession_specific_understanding",
  "grounding_false_positive",
];
