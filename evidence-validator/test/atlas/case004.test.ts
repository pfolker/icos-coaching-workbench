import { describe, it, expect } from "vitest";
import { validateEvidence } from "../../src/validator";
import { input as case003Input } from "../fixtures/case003";
import { input as case004Input } from "../fixtures/case004";

describe("Atlas Case 004 — Rambling but Substantive", () => {
  it("filler-heavy delivery does not block valid extraction", () => {
    const out = validateEvidence(case004Input);
    expect(out.rejected).toEqual([]);
    expect(out.requires_review).toEqual([]);
    expect(out.validated_class_a.length).toBe(8);
    const because = out.validated_class_b.find((b) => b.proposal_id === "B_because");
    expect(because).toBeDefined();
  });

  it("Class A count is not suppressed relative to Case 003's concise answer", () => {
    const concise = validateEvidence(case003Input);
    const rambling = validateEvidence(case004Input);
    // filler and vagueness are not the same thing (Atlas finding) — the
    // rambling answer's real content is at least as extractable
    expect(rambling.validated_class_a.length).toBeGreaterThanOrEqual(concise.validated_class_a.length);
  });
});
