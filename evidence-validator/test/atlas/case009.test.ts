import { describe, it, expect } from "vitest";
import { validateEvidence } from "../../src/validator";
import {
  input, promotionAttemptViaClaimType, promotionAttemptViaSmuggledField,
} from "../fixtures/case009";

describe("Atlas Case 009 — Genuine Quotes, Invalid Reasoning (belief-fact protection)", () => {
  it("the belief validates as Class A (self_reported_diagnosis), marked speaker_assertion: true", () => {
    const out = validateEvidence(input);
    expect(out.rejected).toEqual([]);
    const belief = out.validated_class_a.find((c) => c.proposal_id === "belief");
    expect(belief).toBeDefined();
    expect(belief!.claim_type).toBe("self_reported_diagnosis");
    expect(belief!.speaker_assertion).toBe(true);
  });

  it("REGRESSION (required, malformed input): promoting via claim_type directly is rejected with BELIEF_FACT_COLLAPSE_ATTEMPT", () => {
    const attackInput = { ...input, class_a_proposals: [...input.class_a_proposals, promotionAttemptViaClaimType] };
    const out = validateEvidence(attackInput);
    const rejection = out.rejected.find((r) => r.proposal_id === "belief_promoted_a");
    expect(rejection).toBeDefined();
    expect(rejection!.reason_code).toBe("BELIEF_FACT_COLLAPSE_ATTEMPT");
    // proves rejection, not mere absence: nothing named "established_cause" reaches validated output
    expect(out.validated_class_a.some((c) => c.proposal_id === "belief_promoted_a")).toBe(false);
    expect(JSON.stringify(out.validated_class_a)).not.toContain("established_cause");
  });

  it("REGRESSION (required, malformed input): promoting via a smuggled field on an otherwise-valid claim_type is also rejected", () => {
    const attackInput = { ...input, class_a_proposals: [...input.class_a_proposals, promotionAttemptViaSmuggledField] };
    const out = validateEvidence(attackInput);
    const rejection = out.rejected.find((r) => r.proposal_id === "belief_promoted_b");
    expect(rejection).toBeDefined();
    expect(rejection!.reason_code).toBe("BELIEF_FACT_COLLAPSE_ATTEMPT");
    expect(out.validated_class_a.some((c) => c.proposal_id === "belief_promoted_b")).toBe(false);
  });

  it("no output field anywhere asserts established_cause/verified_diagnosis/objective_fact from valid input alone", () => {
    const out = validateEvidence(input);
    const json = JSON.stringify(out).toLowerCase();
    expect(json).not.toContain("established_cause");
    expect(json).not.toContain("verified_diagnosis");
    expect(json).not.toContain("objective_fact");
  });
});
