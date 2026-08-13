/**
 * The PRE-REGISTERED experiment definition — cases, targets, and controls.
 *
 * Everything in this file was fixed BEFORE any live run. Success criteria come
 * from the work order and are not restated in adjustable form here: the runner
 * reports counts, it does not grade.
 */
import { SemanticTag } from "./vocabulary";

export interface PrimaryCase {
  case_id: string;
  /** the one tag this case is the ground truth for */
  target: SemanticTag;
  authority: string;
  expected_observation: string;
}

/** Work Order Section 6 — existing corpus only, no synthetic primaries. */
export const PRIMARY_CASES: PrimaryCase[] = [
  {
    case_id: "001",
    target: "assumption_reversal",
    authority: "Founder-supported (Case 001 = HF-001)",
    expected_observation:
      "The memorable strength is that an expected software explanation was overturned by the speaker's mechanical diagnosis.",
  },
  {
    case_id: "005",
    target: "result_needs_substance",
    authority: "Founder-supported",
    expected_observation:
      "Result-shaped language exists ('now it runs on its own'), but meaningful impact remains weak or incomplete.",
  },
  {
    case_id: "006",
    target: "ownership_dilution",
    authority: "Founder-supported",
    expected_observation:
      "Individual contribution becomes unclear because 'I', 'the team' and 'we' ownership are mixed.",
  },
  {
    case_id: "009",
    target: "unresolved_alternative_cause",
    authority: "Evidence Atlas",
    expected_observation:
      "The speaker states a causal belief while another plausible same-period explanation remains unaddressed.",
  },
];

export interface ControlCase {
  case_id: string;
  /** tags that MUST NOT appear — any appearance is a reportable false positive */
  expect_absent: SemanticTag[];
  /**
   * tags deliberately NOT scored on this control, with the reason. Declaring
   * these in advance is what keeps the control set honest: a case the corpus
   * genuinely exhibits must not be counted as a false positive just because it
   * is serving as a control for other tags.
   */
  not_scored: { tag: SemanticTag; why: string }[];
  why_chosen: string;
}

/** Work Order Section 7 — existing corpus only. */
export const CONTROL_CASES: ControlCase[] = [
  {
    case_id: "sales",
    expect_absent: [
      "ownership_dilution",
      "result_needs_substance",
      "assumption_reversal",
      "unresolved_alternative_cause",
    ],
    not_scored: [],
    why_chosen:
      "Satisfies three of the required control shapes at once. CLEAR RESULT: 'They renewed for another two years at a 15 percent higher total contract value'. CLEAR INDIVIDUAL OWNERSHIP: every action claim is first-person singular ('I put together...', 'I walked the client through...'). NO UNRESOLVED CAUSAL ATTRIBUTION: the speaker asserts no cause at all, and only one explanation is offered. No prior_belief claim exists, so assumption_reversal is unsupported too. All four tags must be absent.",
  },
  {
    case_id: "nursing",
    expect_absent: [
      "ownership_dilution",
      "result_needs_substance",
      "assumption_reversal",
      "unresolved_alternative_cause",
    ],
    not_scored: [],
    why_chosen:
      "The required STRONG ANSWER, and the sharpest discriminating control in the set. It contains one incidental plural ('we caught early signs of sepsis') inside an answer whose decisive action is unambiguously the speaker's ('I flagged it to the attending right away'), which tests whether ownership_dilution fires on any 'we' or only on genuine dilution. It also contains a mismatch against a record ('signs ... that didn't match her chart') without a stated prior belief, testing whether assumption_reversal fires on mere surprise. Two substantive outcomes, and no causal claim by the speaker.",
  },
  {
    case_id: "thin",
    expect_absent: ["ownership_dilution", "assumption_reversal", "unresolved_alternative_cause"],
    not_scored: [
      {
        tag: "result_needs_substance",
        why:
          "This is the corpus's deliberately evidence-poor answer; 'eventually got it sorted out' and 'Things went back to normal' ARE the canonical thin result. Detection here would be a true positive, not a false one, so scoring it either way would be dishonest. It is excluded from this control's tally for that one tag only.",
      },
    ],
    why_chosen:
      "The required THIN/WEAK ANSWER whose problem is unrelated to three of the four tags: no prior belief, no causal claim, and no individual-versus-team ambiguity to resolve.",
  },
  {
    case_id: "010",
    expect_absent: ["ownership_dilution", "assumption_reversal", "unresolved_alternative_cause"],
    not_scored: [
      {
        tag: "result_needs_substance",
        why:
          "Genuinely ambiguous: 'Completion rates went back up within two weeks' is concrete and consequential, but carries no magnitude. The founder has not ruled on it. Pre-registered as unscored rather than resolved by Claude after seeing the result.",
      },
    ],
    why_chosen:
      "The precision control for unresolved_alternative_cause, and the tightest available contrast with Case 009. Both answers imply a causal story, but here the speaker asserts only SEQUENCE ('I shortened the flow... Completion rates went back up'), and the causal reading exists solely as a Class C non-admissible hypothesis generated by the system, which SOD is never shown. Case 009's speaker, by contrast, asserts the cause outright. If SOD fires here it is inventing a relationship the speaker did not state — precisely the failure mode the Atlas warns about. Ownership is also unambiguous first-person singular.",
  },
];

/** Work Order Section 8 — three independent runs per case, recorded separately, never averaged across cases. */
export const RUNS_PER_CASE = 3;
