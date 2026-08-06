import { describe, it, expect } from "vitest";
import { validateEvidence } from "../../src/validator";
import { input, multiCandidateInput } from "../fixtures/case007";

describe("Atlas Case 007 — Red-Herring Quote (primary: literal Atlas resolution)", () => {
  it("staffing statement validates as context_fact; calibration drift validates as the stated problem", () => {
    const out = validateEvidence(input);
    expect(out.rejected).toEqual([]);
    const staffing = out.validated_class_a.find((c) => c.proposal_id === "staffing_context");
    const problem = out.validated_class_a.find((c) => c.proposal_id === "calibration_problem");
    expect(staffing).toBeDefined();
    expect(staffing!.claim_type).toBe("context_fact");
    expect(problem).toBeDefined();
    expect(problem!.claim_type).toBe("problem");
  });

  it("the staffing claim is NOT discarded — both remain available", () => {
    const out = validateEvidence(input);
    expect(out.validated_class_a.length).toBe(5);
    expect(out.validated_class_a.some((c) => c.proposal_id === "staffing_context")).toBe(true);
  });

  it("no Outcome claim is fabricated where none exists in the source text", () => {
    const out = validateEvidence(input);
    expect(out.validated_class_a.some((c) => c.claim_type === "outcome")).toBe(false);
  });

  it("no selection_required fires here — only one 'problem' candidate exists in this fixture", () => {
    const out = validateEvidence(input);
    expect(out.selection_required).toEqual([]);
  });
});

describe("Atlas Case 007 — Multiple-Candidate Handling mechanism (Section 8 Q2 / task-mandated conservative behavior)", () => {
  it("both same-type 'problem' candidates validate and are preserved; neither is auto-discarded", () => {
    const out = validateEvidence(multiCandidateInput);
    expect(out.rejected).toEqual([]);
    const ids = out.validated_class_a.map((c) => c.proposal_id);
    expect(ids).toContain("staffing_as_problem");
    expect(ids).toContain("calibration_problem");
    expect(out.validated_class_a.length).toBe(2);
  });

  it("returns selection_required rather than silently choosing a canonical claim", () => {
    const out = validateEvidence(multiCandidateInput);
    expect(out.selection_required.length).toBe(1);
    const sr = out.selection_required[0]!;
    expect(sr.claim_type).toBe("problem");
    expect(sr.candidate_proposal_ids.sort()).toEqual(["calibration_problem", "staffing_as_problem"]);
  });

  it("attaches discourse-marker metadata identifying the marked subject, without using it to auto-select", () => {
    const out = validateEvidence(multiCandidateInput);
    const sr = out.selection_required[0]!;
    expect(sr.discourse_marker).toBeDefined();
    expect(sr.discourse_marker!.marked_proposal_id).toBe("calibration_problem");
    expect(sr.discourse_marker!.marker_text.toLowerCase()).toContain("problem i want to talk about is");
    // metadata only: the "unmarked" candidate is still fully present, not rejected or demoted
    expect(out.validated_class_a.find((c) => c.proposal_id === "staffing_as_problem")).toBeDefined();
  });
});
