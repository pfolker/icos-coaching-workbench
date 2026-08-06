import { describe, it, expect } from "vitest";
import { validateEvidence } from "../../src/validator";
import { input } from "../fixtures/case003";

describe("Atlas Case 003 — Strong Concise Answer", () => {
  it("concise answer validates fully despite short length", () => {
    const out = validateEvidence(input);
    expect(out.rejected).toEqual([]);
    expect(out.requires_review).toEqual([]);
    expect(out.validated_class_a.length).toBe(6);
    expect(out.validated_class_b.length).toBe(2);
    expect(out.class_c_non_admissible).toEqual([]);
  });
});
