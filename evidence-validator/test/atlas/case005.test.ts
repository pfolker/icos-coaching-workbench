import { describe, it, expect } from "vitest";
import { validateEvidence } from "../../src/validator";
import { input } from "../fixtures/case005";

describe("Atlas Case 005 — Ambiguous Ownership", () => {
  it("team-owned actions validate as team-owned", () => {
    const out = validateEvidence(input);
    const looked = out.validated_class_a.find((c) => c.proposal_id === "looked_into");
    const automated = out.validated_class_a.find((c) => c.proposal_id === "automated");
    expect(looked).toBeDefined();
    expect(automated).toBeDefined();
    expect(out.validated_class_b.length).toBe(1);
  });

  it("'personal authorship of the script' is rejected as unsupported (no supporting quote)", () => {
    const out = validateEvidence(input);
    const rejection = out.rejected.find((r) => r.proposal_id === "personal_authorship");
    expect(rejection).toBeDefined();
    expect(rejection!.reason_code).toBe("QUOTE_NOT_FOUND");
    // not silently resolved into a guess in either direction
    expect(out.validated_class_a.some((c) => c.proposal_id === "personal_authorship")).toBe(false);
  });
});
