import { describe, it, expect } from "vitest";
import { validateEvidence } from "../../evidence-validator/src/index";
import type { ValidatorOutput } from "../../evidence-validator/src/index";
import { materializeSourceSpans } from "../../evidence-runtime/src/modelOutput";
import { runListenEngineFixture } from "../../evidence-runtime/src/listenEngine";
import * as case009 from "../../evidence-runtime/fixtures/case009";
import * as case001 from "../../evidence-runtime/fixtures/case001";
import {
  scoreClassCHardFail, scoreClassARecall, scoreQuoteFidelity, scoreClaimTypeAgreement,
  scoreAdditions, scoreClassBRecall, scoreRejectionTally, scoreCase,
} from "../src/scorer";
import { GROUND_TRUTH_BY_ID } from "../src/groundTruth";

function runReal(transcript: string, raw: ReturnType<typeof runListenEngineFixture>["raw"]): ValidatorOutput {
  return validateEvidence(materializeSourceSpans(transcript, raw));
}

describe("Class C hard-fail check — the most important piece of this package", () => {
  it("PASSES against the real, legitimate Case 009 pipeline output (no false positive)", () => {
    const output = runReal(case009.TRANSCRIPT, runListenEngineFixture(case009.LISTEN_ENGINE_FIXTURE).raw);
    const result = scoreClassCHardFail(output);
    expect(result.violations).toEqual([]);
    expect(result.passed).toBe(true);
  });

  it("PASSES against the real, ADVERSARIAL Case 009 fixture run through the real pipeline — the Validator's own upstream defense already blocks it, so nothing leaks through to check", () => {
    const output = runReal(case009.TRANSCRIPT, runListenEngineFixture(case009.LISTEN_ENGINE_FIXTURE_ADVERSARIAL).raw);
    // The promotion attempt is rejected by evidence-validator itself (BELIEF_FACT_COLLAPSE_ATTEMPT)
    // before it ever reaches validated_class_a — confirming the primary defense still works.
    expect(output.rejected.some((r) => r.reason_code === "BELIEF_FACT_COLLAPSE_ATTEMPT")).toBe(true);
    expect(scoreClassCHardFail(output).passed).toBe(true);
  });

  it("FAILS LOUD against a hand-constructed ValidatorOutput simulating a promotion-label leak (defense-in-depth: proves the benchmark would catch this even if evidence-validator's own upstream check ever regressed)", () => {
    const adversarial: Pick<ValidatorOutput, "validated_class_a" | "class_c_non_admissible"> = {
      validated_class_a: [
        {
          evidence_class: "A", proposal_id: "leaked_promotion", claim_type: "established_cause" as any,
          quote: "agents were less stressed after we added two more support reps", source_span: { start: 0, end: 10 },
          speaker_assertion: false, admitted_by: "SIMULATED BUG: this should never validate",
        },
      ],
      class_c_non_admissible: [],
    };
    const result = scoreClassCHardFail(adversarial);
    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0]).toMatch(/promotion label/);
  });

  it("FAILS LOUD against a hand-constructed ValidatorOutput simulating a Class C hypothesis leaking into an admitted Class A claim — reuses Case 009's shape, per task instruction", () => {
    const leakedText =
      "the complaints dropped because agents were less stressed after we also added two more support reps that same month, which was the root cause";
    const adversarial: Pick<ValidatorOutput, "validated_class_a" | "class_c_non_admissible"> = {
      validated_class_a: [
        {
          evidence_class: "A", proposal_id: "smuggled_via_class_a", claim_type: "self_reported_diagnosis",
          quote: leakedText, source_span: { start: 0, end: leakedText.length },
          speaker_assertion: true, admitted_by: "SIMULATED BUG: this text should have stayed Class C-only",
        },
      ],
      class_c_non_admissible: [
        {
          evidence_class: "C", proposal_id: "hyp_stress", hypothesis: leakedText,
          reasoning: "correlation stated, causation not confirmed", supporting_claim_ids: [],
          clarification_question: "is this the cause?", admissible: false,
          allowed_uses: ["experimental_logging", "atlas_evaluation", "clarification_candidate"],
          admitted_by: "class_c_structural_check passed",
        },
      ],
    };
    const result = scoreClassCHardFail(adversarial);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes("hypothesis/reasoning"))).toBe(true);
  });

  it("does not false-positive on short, coincidentally-overlapping text (length threshold)", () => {
    const adversarial: Pick<ValidatorOutput, "validated_class_a" | "class_c_non_admissible"> = {
      validated_class_a: [
        { evidence_class: "A", proposal_id: "short", claim_type: "action", quote: "we changed it",
          source_span: { start: 0, end: 13 }, speaker_assertion: false, admitted_by: "test" },
      ],
      class_c_non_admissible: [
        { evidence_class: "C", proposal_id: "hyp", hypothesis: "we changed it and that changed everything",
          reasoning: "short overlap should not trigger a hard fail on its own", supporting_claim_ids: [],
          clarification_question: "q?", admissible: false,
          allowed_uses: ["experimental_logging", "atlas_evaluation", "clarification_candidate"], admitted_by: "test" },
      ],
    };
    expect(scoreClassCHardFail(adversarial).passed).toBe(true);
  });
});

describe("Other Tier 1 metrics, against real pipeline output", () => {
  const gt009 = GROUND_TRUTH_BY_ID.get("009")!;
  const output009 = runReal(case009.TRANSCRIPT, runListenEngineFixture(case009.LISTEN_ENGINE_FIXTURE).raw);

  it("Class A recall matches all 4 ground-truth claims for Case 009's well-formed fixture", () => {
    const recall = scoreClassARecall(gt009, output009.validated_class_a);
    expect(recall.total_ground_truth).toBe(4);
    expect(recall.matched).toBe(4);
    expect(recall.rate).toBe(1);
  });

  it("quote fidelity is 100% exact for a hand-authored fixture (no paraphrase attempts)", () => {
    const fidelity = scoreQuoteFidelity(case009.TRANSCRIPT, runListenEngineFixture(case009.LISTEN_ENGINE_FIXTURE).raw.class_a_proposals);
    expect(fidelity.paraphrased).toBe(0);
    expect(fidelity.exact).toBe(fidelity.total_proposed);
  });

  it("claim_type agreement is 100% for Case 009's well-formed fixture", () => {
    const agreement = scoreClaimTypeAgreement(gt009, output009.validated_class_a);
    expect(agreement.disagreements).toEqual([]);
    expect(agreement.rate).toBe(1);
  });

  it("additions is empty when the fixture proposes exactly the ground-truth claims", () => {
    expect(scoreAdditions(gt009, output009.validated_class_a).count).toBe(0);
  });

  it("Class B recall matches Case 009's single self-contained 'because' relationship", () => {
    const recall = scoreClassBRecall(gt009, output009.validated_class_a, output009.validated_class_b);
    expect(recall.total_ground_truth).toBe(1);
    expect(recall.matched).toBe(1);
  });

  it("rejection tally is empty for a clean run", () => {
    expect(scoreRejectionTally(output009.rejected)).toEqual({});
  });

  it("scoreCase composes all metrics for one case", () => {
    const metrics = scoreCase(gt009, case009.TRANSCRIPT, runListenEngineFixture(case009.LISTEN_ENGINE_FIXTURE).raw.class_a_proposals, output009);
    expect(metrics.case_id).toBe("009");
    expect(metrics.class_c_hard_fail.passed).toBe(true);
  });

  it("Case 001's fixture (12 Class A, 3 Class B) scores full recall against ground truth", () => {
    const gt001 = GROUND_TRUTH_BY_ID.get("001")!;
    const output001 = runReal(case001.TRANSCRIPT, runListenEngineFixture(case001.LISTEN_ENGINE_FIXTURE).raw);
    const recallA = scoreClassARecall(gt001, output001.validated_class_a);
    const recallB = scoreClassBRecall(gt001, output001.validated_class_a, output001.validated_class_b);
    expect(recallA.rate).toBe(1);
    expect(recallB.matched).toBeGreaterThanOrEqual(2); // B1 (contrast "but") and B3-equivalent (enumeration) at minimum; B2/B4 depend on quote-boundary choices already documented as a finding
  });
});
