import { describe, it, expect } from "vitest";
import { validateEvidence } from "../../src/validator";
import { input } from "../fixtures/case001";

describe("Atlas Case 001 — Founder's Original Answer", () => {
  it("direct problem/action/outcome/business-value claims validate", () => {
    const out = validateEvidence(input);
    expect(out.rejected).toEqual([]);
    expect(out.requires_review).toEqual([]);
    const types = out.validated_class_a.map((c) => c.claim_type);
    expect(types).toContain("problem");
    expect(types).toContain("action");
    expect(types).toContain("outcome");
    expect(types).toContain("business_value");
    expect(out.validated_class_a.length).toBe(12);
  });

  it("explicit contrast and 'because' relationships validate", () => {
    const out = validateEvidence(input);
    const contrast = out.validated_class_b.find((b) => b.proposal_id === "B1");
    expect(contrast).toBeDefined();
    expect(contrast!.relationship_type).toBe("contrast_marker");
    const because = out.validated_class_b.find((b) => b.proposal_id === "B4");
    expect(because).toBeDefined();
    expect(because!.relationship_type).toBe("explicit_connective");
    const enumeration = out.validated_class_b.find((b) => b.proposal_id === "B3");
    expect(enumeration).toBeDefined();
    expect(out.validated_class_b.length).toBe(4);
  });

  it("v1.1 / EP-003: 'Instead of' now validates as contrast_marker (B2)", () => {
    const out = validateEvidence(input);
    const b2 = out.validated_class_b.find((b) => b.proposal_id === "B2");
    expect(b2).toBeDefined();
    expect(b2!.relationship_type).toBe("contrast_marker");
    expect(b2!.marker_text).toBe("instead of");
  });

  it("Class C candidate is logged, non-admissible, never validated as A or B", () => {
    const out = validateEvidence(input);
    expect(out.class_c_non_admissible.length).toBe(1);
    expect(out.class_c_non_admissible[0]!.admissible).toBe(false);
    expect(out.class_c_non_admissible[0]!.allowed_uses).toEqual([
      "experimental_logging", "atlas_evaluation", "clarification_candidate",
    ]);
  });
});
