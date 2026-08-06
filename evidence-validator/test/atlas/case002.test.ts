import { describe, it, expect } from "vitest";
import { validateEvidence } from "../../src/validator";
import { input as case001Input } from "../fixtures/case001";
import { input as case002Input } from "../fixtures/case002";

describe("Atlas Case 002 — Founder's Retry", () => {
  it("the five new Class A claims (A13-A17) validate", () => {
    const out = validateEvidence(case002Input);
    expect(out.rejected).toEqual([]);
    const ids = out.validated_class_a.map((c) => c.proposal_id);
    for (const id of ["A13", "A14", "A15", "A16", "A17"]) expect(ids).toContain(id);
  });

  it("the retry produces strictly more validated Class A entries than the original", () => {
    const original = validateEvidence(case001Input);
    const retry = validateEvidence(case002Input);
    expect(retry.validated_class_a.length).toBeGreaterThan(original.validated_class_a.length);
  });

  it("no confidence scores appear anywhere in the output", () => {
    const out = validateEvidence(case002Input);
    expect(JSON.stringify(out).toLowerCase()).not.toContain("confidence");
  });

  it("the self-contained 'since' connective (A17) validates", () => {
    const out = validateEvidence(case002Input);
    const b6 = out.validated_class_b.find((b) => b.proposal_id === "B6");
    expect(b6).toBeDefined();
    expect(b6!.relationship_type).toBe("explicit_connective");
  });

  it("v1.1 / EP-003: 'pointed to' now validates as explicit_connective (B5)", () => {
    const out = validateEvidence(case002Input);
    const b5 = out.validated_class_b.find((b) => b.proposal_id === "B5");
    expect(b5).toBeDefined();
    expect(b5!.relationship_type).toBe("explicit_connective");
    expect(b5!.marker_text).toBe("pointed to");
  });
});
