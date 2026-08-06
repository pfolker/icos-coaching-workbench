/**
 * Evidence Atlas v0.1 ground truth, extracted once into structured data.
 *
 * Source of truth for every quote/claim_type/relationship below is
 * `evidence-atlas-v0.1.md` (InterviewAce root), cross-checked against the
 * independently hand-authored `evidence-validator/test/fixtures/caseNNN.ts`
 * files (built in earlier sessions, before this extraction existed) — any
 * disagreement found between the two independent transcriptions is called
 * out in a comment at the case where it happened; see README.md for the
 * full list.
 *
 * Cases 001/002 have the Atlas's own explicit A#/B# tables — extracted
 * directly, 1:1. Cases 004-010 have only prose paraphrases in the Atlas
 * ("problem (scrapping ~1 in 5 parts)"); the verbatim quotes below for
 * those cases are the same ones already hand-extracted and validator-tested
 * in evidence-validator's fixtures (reused here, not re-derived, since that
 * extraction was already checked against the real Validator). Case 003 has
 * no existing fixture anywhere in this codebase — its quotes were extracted
 * fresh for this file, directly from the transcript, matching the Atlas's
 * prose paraphrase.
 *
 * KNOWN DUPLICATION (flagged per task instructions, not fixed here): the
 * quotes for cases 001/002/004-010 now exist in THREE places — the Atlas's
 * own prose, evidence-validator's test fixtures, and this file. This file
 * is intended to become the one place ground truth lives; a future pass
 * should refactor evidence-validator's fixtures to import from here instead
 * of re-declaring their own TRANSCRIPT/quote constants. Not done in this
 * task, per explicit scope.
 */

export interface GroundTruthClassA {
  id: string;
  claim_type: string;
  quote: string;
}

export interface GroundTruthClassB {
  id: string;
  relationship_type: string;
  /** Ground-truth Class A ids (this file's own ids, not any pipeline's) this relationship connects. */
  component_ids: string[];
  marker_text: string;
}

export interface GroundTruthCase {
  case_id: string;
  label: string;
  transcript: string;
  class_a: GroundTruthClassA[];
  class_b: GroundTruthClassB[];
  /** Informational only — not scored, since Class C is a hypothesis about the transcript, not a claim within it. */
  class_c_hypotheses: string[];
  notes?: string;
}

export const GROUND_TRUTH: GroundTruthCase[] = [
  // ---------------------------------------------------------------- 001
  {
    case_id: "001",
    label: "Founder's Original Answer",
    transcript:
      "One problem that stands out happened on one of our automated manufacturing lines. " +
      "We started seeing parts getting pushed away during the deburring process instead of being cleaned correctly. " +
      "At first everyone thought it was a programming issue, but after watching the machine run I realized the robot was actually applying force in a way that allowed the casting to move.\n\n" +
      "I spent time watching the process, talking with the operators, and looking at how the fixture contacted the part. " +
      "I realized we were grabbing onto a rough casting surface that wasn't locating the part consistently. " +
      "Instead of trying to solve it in software, I modified the fixture by machining two locating divots into the face of the part and redesigned the gripper pads with a conical profile so they locked into those divots every cycle.\n\n" +
      "After the change, the part stayed rigid during deburring, the brushing process became consistent, and we eliminated the issue completely. " +
      "It also improved overall throughput because operators no longer had to stop and inspect parts that had been pushed out of position.\n\n" +
      "That project reminded me that sometimes the best automation solution isn't changing the robot program—it's changing the mechanical design so the process becomes repeatable.",
    class_a: [
      { id: "A1", claim_type: "problem", quote: "parts getting pushed away during the deburring process instead of being cleaned correctly" },
      { id: "A2", claim_type: "prior_belief", quote: "everyone thought it was a programming issue" },
      { id: "A3", claim_type: "self_reported_diagnosis", quote: "I realized the robot was actually applying force in a way that allowed the casting to move" },
      { id: "A4", claim_type: "action", quote: "I spent time watching the process, talking with the operators, and looking at how the fixture contacted the part" },
      { id: "A5", claim_type: "self_reported_diagnosis", quote: "I realized we were grabbing onto a rough casting surface that wasn't locating the part consistently" },
      // Extended to include the leading "Instead of..." clause so B2 (below) can be
      // represented as a self-contained contrast_marker relationship, matching
      // evidence-validator's tested Case 001 fixture (Specification EP-003). The
      // Atlas's own table lists A6 without this prefix; extending it is the same
      // deliberate fixture choice evidence-validator made, reused here for
      // consistency rather than re-deriving a different boundary.
      { id: "A6", claim_type: "action", quote: "Instead of trying to solve it in software, I modified the fixture by machining two locating divots into the face of the part" },
      { id: "A7", claim_type: "action", quote: "redesigned the gripper pads with a conical profile so they locked into those divots every cycle" },
      { id: "A8", claim_type: "outcome", quote: "the part stayed rigid during deburring" },
      { id: "A9", claim_type: "outcome", quote: "the brushing process became consistent" },
      { id: "A10", claim_type: "outcome", quote: "we eliminated the issue completely" },
      // Atlas's own table lowercases the leading "It" ("it also improved..."); the
      // transcript is sentence-initial and capitalized ("It also improved..."). This is
      // the exact discrepancy test/helpers.ts's span() caught during the original
      // evidence-validator build (Phase 8) — the Atlas table has a real, minor
      // transcription slip. Reproduced here with the CORRECT (capitalized) casing,
      // matching the transcript, not the Atlas table verbatim. Flagged per task
      // instructions, not silently "fixed without a note."
      { id: "A11", claim_type: "business_value", quote: "It also improved overall throughput because operators no longer had to stop and inspect parts" },
      { id: "A12", claim_type: "reflection", quote: "the best automation solution isn't changing the robot program—it's changing the mechanical design so the process becomes repeatable" },
    ],
    class_b: [
      { id: "B1", relationship_type: "contrast_marker", component_ids: ["A2", "A3"], marker_text: "but" },
      // B2 in the Atlas prose: "explicit_connective ('Instead of'): frames A6/A7 as chosen
      // over a software approach." EP-003/Phase-3.1 corrected this to contrast_marker
      // (see Specification EP-003 and evidence-validator's Case 001 fixture comment) —
      // "instead of" is a rejected-alternative construction, not a neutral connective.
      // Recorded here with the CORRECTED relationship_type, not the Atlas's original
      // (superseded) label, since the Atlas's own prose predates that correction and
      // was never updated in this line. Flagged, not silently normalized.
      { id: "B2", relationship_type: "contrast_marker", component_ids: ["A6"], marker_text: "instead of" },
      { id: "B3", relationship_type: "enumeration", component_ids: ["A6", "A7"], marker_text: "" },
      { id: "B4", relationship_type: "explicit_connective", component_ids: ["A11"], marker_text: "because" },
    ],
    class_c_hypotheses: [
      "the speaker was personally among those who initially believed it was a programming issue, rather than skeptical from the start",
    ],
    notes: "A11 casing, B2 relationship_type, and A6 quote boundary (extended to make B2 self-contained) all corrected/extended vs. the Atlas's literal table text; see inline comments.",
  },

  // ---------------------------------------------------------------- 002
  {
    case_id: "002",
    label: "Founder's Retry",
    transcript:
      "One problem that stands out happened on one of our automated manufacturing lines. " +
      "We started seeing parts getting pushed away during the deburring process instead of being deburred correctly. " +
      "At first everyone thought it was a program issue, but after checking the part straightness with an indicator before and after the deburring process, I was able to see the part had been moving.\n\n" +
      "This pointed to a gripper issue. The grippers were not doing an adequate job holding the part and I needed to come up with a way of locking it in and prevent it from moving.\n\n" +
      "I modified the part being machined slightly by machining two locating divots into the casting, since we were engraving the part anyway I didn't need customer approval for that. I then redesigned the gripper pads with a conical profile so they locked into those divots every cycle.\n\n" +
      "After the change, the part stayed rigid during deburring, the brushing process became consistent, and we eliminated the issue completely. It also improved overall throughput because operators no longer had to stop and inspect parts that had been pushed out of position.\n\n" +
      "That project reminded me that sometimes the best automation solution isn't changing the robot program-it's changing the mechanical design so the process becomes repeatable.",
    class_a: [
      { id: "A2b", claim_type: "prior_belief", quote: "everyone thought it was a program issue" },
      { id: "A13", claim_type: "action", quote: "checking the part straightness with an indicator before and after the deburring process" },
      { id: "A14", claim_type: "self_reported_diagnosis", quote: "I was able to see the part had been moving" },
      { id: "A15", claim_type: "self_reported_diagnosis", quote: "This pointed to a gripper issue" },
      { id: "A16", claim_type: "problem", quote: "The grippers were not doing an adequate job holding the part" },
      { id: "A17", claim_type: "constraint", quote: "since we were engraving the part anyway I didn't need customer approval for that" },
      // Carried over from Case 001's shape (same underlying claims restated in the
      // retry) — Atlas's Case 002 section only lists the FIVE new claims explicitly,
      // but the transcript still contains the analogous problem/action/outcome content;
      // included here since a real scorer needs the full ground truth for the case, not
      // just its delta from Case 001. Quotes adjusted only where the retry's wording
      // differs (e.g. "deburred correctly" not "cleaned correctly").
      { id: "A1b", claim_type: "problem", quote: "parts getting pushed away during the deburring process instead of being deburred correctly" },
      { id: "A6b", claim_type: "action", quote: "I modified the part being machined slightly by machining two locating divots into the casting" },
      { id: "A7b", claim_type: "action", quote: "I then redesigned the gripper pads with a conical profile so they locked into those divots every cycle" },
      { id: "A8b", claim_type: "outcome", quote: "the part stayed rigid during deburring" },
      { id: "A9b", claim_type: "outcome", quote: "the brushing process became consistent" },
      { id: "A10b", claim_type: "outcome", quote: "we eliminated the issue completely" },
      { id: "A11b", claim_type: "business_value", quote: "It also improved overall throughput because operators no longer had to stop and inspect parts" },
      { id: "A12b", claim_type: "reflection", quote: "the best automation solution isn't changing the robot program-it's changing the mechanical design so the process becomes repeatable" },
    ],
    class_b: [
      { id: "B5", relationship_type: "explicit_connective", component_ids: ["A15"], marker_text: "pointed to" },
      { id: "B6", relationship_type: "explicit_connective", component_ids: ["A17"], marker_text: "since" },
    ],
    class_c_hypotheses: [],
    notes: "Atlas's Case 002 section lists only the 5 NEW claims vs. Case 001; the *b-suffixed entries above (carried-over Case 001 shape, reworded for this transcript's actual text) were added here so this file has complete ground truth per case, not a diff. Flagged as an extension beyond the Atlas's literal table, not a discrepancy within it.",
  },

  // ---------------------------------------------------------------- 003
  {
    case_id: "003",
    label: "Strong Concise Answer",
    transcript:
      "Our CNC line was scrapping about one in five parts on a new fixture. I checked the location pins and found one had worn oversized, so parts weren't seating flush. I swapped in a hardened pin and added a witness mark so operators could catch wear before it caused scrap again. Scrap rate on that fixture dropped back to normal within a day.",
    // No existing fixture anywhere in this codebase (not part of any prior phase's
    // "required cases" list) — quotes extracted fresh here, directly from the
    // transcript, matching the Atlas's prose paraphrase claim-by-claim.
    class_a: [
      { id: "A1", claim_type: "problem", quote: "Our CNC line was scrapping about one in five parts on a new fixture" },
      { id: "A2", claim_type: "action", quote: "I checked the location pins" },
      { id: "A3", claim_type: "self_reported_diagnosis", quote: "found one had worn oversized, so parts weren't seating flush" },
      { id: "A4", claim_type: "action", quote: "I swapped in a hardened pin" },
      { id: "A5", claim_type: "action", quote: "added a witness mark so operators could catch wear before it caused scrap again" },
      { id: "A6", claim_type: "outcome", quote: "Scrap rate on that fixture dropped back to normal within a day" },
    ],
    class_b: [
      // Both markers are self-contained (component + purpose/consequence within
      // the SAME quote) — same pattern as Case 004's "because" and Case 009's
      // "because", per the Atlas's own two-line description: '"so": worn pin →
      // not seating flush' and '"so": witness mark → purpose of catching wear early'.
      { id: "B1", relationship_type: "explicit_connective", component_ids: ["A3"], marker_text: "so" },
      { id: "B2", relationship_type: "explicit_connective", component_ids: ["A5"], marker_text: "so" },
    ],
    class_c_hypotheses: [],
    notes: "Atlas's own text: 'Class C: none needed. Fully explicit despite being short.' No Class C ground truth for this case, by design.",
  },

  // ---------------------------------------------------------------- 004
  {
    case_id: "004",
    label: "Rambling but Substantive",
    transcript:
      "So, this is kind of a long story, but, um, basically we had this recurring issue on, I think it was the third shift mostly, " +
      "where, like, the packaging line kept jamming, and it wasn't every day, but it was often enough that people started, " +
      "you know, just kind of working around it instead of actually looking into it, which I guess I understand because everyone's busy, " +
      "but eventually I got kind of annoyed by it honestly, so I pulled the maintenance logs for like the last month, " +
      "and it turned out almost all the jams were happening on the same conveyor section, which nobody had really noticed before " +
      "because the operators log different things, so I flagged it to maintenance and we found out a roller bearing was starting to " +
      "seize intermittently, and once we replaced that the jams basically stopped.",
    class_a: [
      { id: "A1", claim_type: "problem", quote: "the packaging line kept jamming" },
      { id: "A2", claim_type: "action", quote: "I pulled the maintenance logs for like the last month" },
      // Atlas prose says "finding" (informal, pre-EP-002 term) — formally retired,
      // was never a claim_type; the real claim_type is self_reported_diagnosis
      // (Specification v1.1, EP-002). See evidence-validator/test/fixtures/case004.ts.
      { id: "A3", claim_type: "self_reported_diagnosis", quote: "it turned out almost all the jams were happening on the same conveyor section" },
      { id: "A4", claim_type: "context_fact", quote: "nobody had really noticed before because the operators log different things" },
      { id: "A5", claim_type: "action", quote: "I flagged it to maintenance" },
      { id: "A6", claim_type: "self_reported_diagnosis", quote: "we found out a roller bearing was starting to seize intermittently" },
      { id: "A7", claim_type: "action", quote: "we replaced that" },
      { id: "A8", claim_type: "outcome", quote: "the jams basically stopped" },
    ],
    class_b: [
      { id: "B1", relationship_type: "explicit_connective", component_ids: ["A4"], marker_text: "because" },
    ],
    class_c_hypotheses: [],
  },

  // ---------------------------------------------------------------- 005
  {
    case_id: "005",
    label: "Ambiguous Ownership",
    transcript:
      "We noticed the reports were going out late every week, so we looked into the process and found the data pull was happening " +
      "manually and someone had to remember to kick it off every Friday. We automated it with a scheduled script and now it runs on its own.",
    class_a: [
      { id: "A1", claim_type: "problem", quote: "the reports were going out late every week" },
      { id: "A2", claim_type: "action", quote: "we looked into the process" },
      { id: "A3", claim_type: "self_reported_diagnosis", quote: "the data pull was happening manually and someone had to remember to kick it off every Friday" },
      { id: "A4", claim_type: "action", quote: "We automated it with a scheduled script" },
      { id: "A5", claim_type: "outcome", quote: "now it runs on its own" },
    ],
    class_b: [
      { id: "B1", relationship_type: "explicit_connective", component_ids: ["A1", "A2"], marker_text: "so" },
    ],
    class_c_hypotheses: [],
    notes: "Atlas's rejected claim ('the speaker personally wrote the automation script') is intentionally NOT ground truth here — it must never be produced, matched, or credited; see evidence-validator/test/fixtures/case005.ts's rejected_personal_authorship_proposal for the adversarial regression test that already covers this.",
  },

  // ---------------------------------------------------------------- 006
  {
    case_id: "006",
    label: "Contradictory Ownership",
    transcript:
      "I decided we needed a better testing process before releasing updates, so I built out a staging environment that mirrored production. " +
      "The team put together the test suite and we all agreed on the rollout schedule together.",
    class_a: [
      // Atlas prose predates EP-002 and calls all four "action"; Specification
      // v1.1 EP-002 formally retypes "decided"/"agreed" as claim_type "decision",
      // distinct from "action" — ground truth here uses the CURRENT (v1.1) typing,
      // matching evidence-validator's Case 006 fixture, not the Atlas's original
      // (superseded) prose label. Flagged, not silently normalized.
      { id: "A1", claim_type: "decision", quote: "I decided we needed a better testing process before releasing updates" },
      { id: "A2", claim_type: "action", quote: "I built out a staging environment that mirrored production" },
      { id: "A3", claim_type: "action", quote: "The team put together the test suite" },
      { id: "A4", claim_type: "decision", quote: "we all agreed on the rollout schedule together" },
    ],
    class_b: [
      // Atlas prose says "enumeration: four sequential claims" (pre-EP-002). Under
      // the current enum, only A2/A3 share a claim_type with nothing of a different
      // type between them; A1/A4 no longer qualify (Specification Section 4's
      // enumeration rule). Ground truth reflects the CURRENT, correct 2-component
      // enumeration — see Specification v1.1 CHANGELOG, EP-002 fixture consequence.
      { id: "B1", relationship_type: "enumeration", component_ids: ["A2", "A3"], marker_text: "" },
    ],
    class_c_hypotheses: [],
    notes: "Class A claim_types (A1/A4 -> decision) and Class B enumeration scope corrected vs. the Atlas's literal (pre-EP-002) prose; see inline comments and Specification CHANGELOG EP-002.",
  },

  // ---------------------------------------------------------------- 007
  {
    case_id: "007",
    label: "Red-Herring Quote",
    transcript:
      "Our biggest challenge that quarter was actually staffing, we lost two technicians right before a major product launch. " +
      "But the specific problem I want to talk about is a calibration drift issue on our vision inspection system that started causing false rejects. " +
      "I traced it to a light source that had degraded over time and was throwing off the contrast readings. " +
      "I replaced the light and added a calibration check to the startup routine so we'd catch drift going forward.",
    class_a: [
      { id: "A1", claim_type: "context_fact", quote: "we lost two technicians right before a major product launch" },
      { id: "A2", claim_type: "problem", quote: "a calibration drift issue on our vision inspection system that started causing false rejects" },
      { id: "A3", claim_type: "self_reported_diagnosis", quote: "I traced it to a light source that had degraded over time and was throwing off the contrast readings" },
      { id: "A4", claim_type: "action", quote: "I replaced the light" },
      { id: "A5", claim_type: "action", quote: "added a calibration check to the startup routine" },
    ],
    class_b: [],
    class_c_hypotheses: [],
    notes: "Atlas explicitly REJECTS 'staffing shortage' as the Problem claim (discourse-marker precedence) and explicitly states no Outcome claim exists ('so we'd catch drift going forward' is intent, not a confirmed result) — both are intentional absences from ground truth, not omissions.",
  },

  // ---------------------------------------------------------------- 008
  {
    case_id: "008",
    label: "Two Plausible Causes",
    transcript:
      "We had a batch of parts fail a pressure test. Right before that batch ran, we'd both switched to a new sealant supplier " +
      "and the technician running that shift was new and still training. The failures stopped once we went back to the old sealant.",
    class_a: [
      { id: "A1", claim_type: "problem", quote: "a batch of parts fail a pressure test" },
      { id: "A2", claim_type: "context_fact", quote: "we'd both switched to a new sealant supplier" },
      { id: "A3", claim_type: "context_fact", quote: "the technician running that shift was new and still training" },
      { id: "A4", claim_type: "context_fact", quote: "The failures stopped" },
      { id: "A5", claim_type: "context_fact", quote: "we went back to the old sealant" },
    ],
    class_b: [
      // Ground truth records the SEMANTIC order (A5 reverted -> A4 stopped), which
      // is the order EP-004's connector-governed ordering exists to validate (raw
      // transcript position alone disagrees) — see Specification EP-004.
      { id: "B1", relationship_type: "temporal_sequence", component_ids: ["A5", "A4"], marker_text: "once" },
    ],
    class_c_hypotheses: [
      "the sealant change caused the failures",
      "the new technician's inexperience contributed to the failures",
    ],
    notes: "A4/A5 (context_fact, not action) is deliberate per the Phase 3.1 annotation now in evidence-atlas-v0.1.md — avoids the Class A layer crediting either candidate cause.",
  },

  // ---------------------------------------------------------------- 009
  {
    case_id: "009",
    label: "Genuine Quotes, Invalid Reasoning",
    transcript:
      "We changed our return policy to be more lenient at the start of the quarter. " +
      "Customer complaints about our support process dropped by the end of the quarter. " +
      "I think the complaints dropped because agents were less stressed after we also added two more support reps that same month.",
    class_a: [
      { id: "A1", claim_type: "context_fact", quote: "We changed our return policy to be more lenient at the start of the quarter" },
      { id: "A2", claim_type: "context_fact", quote: "we also added two more support reps that same month" },
      { id: "A3", claim_type: "outcome", quote: "Customer complaints about our support process dropped by the end of the quarter" },
      { id: "A4", claim_type: "self_reported_diagnosis", quote: "I think the complaints dropped because agents were less stressed after we also added two more support reps that same month" },
    ],
    class_b: [
      { id: "B1", relationship_type: "explicit_connective", component_ids: ["A4"], marker_text: "because" },
    ],
    class_c_hypotheses: [],
    notes: "The single most important case for the Class C hard-fail check (Failure Mode 9 / belief-fact collapse) — A4 must NEVER be scored as if it were a confirmed cause; see scorer.ts's classCHardFail.",
  },

  // ---------------------------------------------------------------- 010
  {
    case_id: "010",
    label: "Missing Context Makes Inference Tempting but Unsafe",
    transcript:
      "I noticed our onboarding completion rate had dropped. I shortened the onboarding flow from nine steps to five. " +
      "Completion rates went back up within two weeks.",
    class_a: [
      { id: "A1", claim_type: "problem", quote: "our onboarding completion rate had dropped" },
      { id: "A2", claim_type: "action", quote: "I shortened the onboarding flow from nine steps to five" },
      { id: "A3", claim_type: "outcome", quote: "Completion rates went back up within two weeks" },
    ],
    class_b: [
      { id: "B1", relationship_type: "temporal_sequence", component_ids: ["A2", "A3"], marker_text: "" },
    ],
    class_c_hypotheses: ["shortening the onboarding flow caused the completion rate increase"],
    notes: "The 'no competing cause visible' case — Atlas explicitly warns this makes the hypothesis MORE dangerous, not less. Class C hard-fail must catch a violation here just as readily as in Case 008/009.",
  },
];

export const GROUND_TRUTH_BY_ID: ReadonlyMap<string, GroundTruthCase> =
  new Map(GROUND_TRUTH.map((c) => [c.case_id, c]));
