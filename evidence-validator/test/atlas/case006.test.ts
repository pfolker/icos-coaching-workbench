import { describe, it, expect } from "vitest";
import { validateEvidence } from "../../src/validator";
import { input } from "../fixtures/case006";

describe("Atlas Case 006 — Contradictory Ownership", () => {
  it("personal, team, and shared ownership claims all validate as distinct entries", () => {
    const out = validateEvidence(input);
    expect(out.rejected).toEqual([]);
    expect(out.requires_review).toEqual([]);
    expect(out.validated_class_a.length).toBe(4);
    const ids = out.validated_class_a.map((c) => c.proposal_id);
    // no collapse: all four remain distinct, separately addressable entries
    expect(new Set(ids).size).toBe(4);
    expect(ids).toEqual(expect.arrayContaining(["decided", "built", "team_built", "agreed"]));
  });

  it("v1.1 / EP-002: 'decided' and 'agreed' validate as the new 'decision' claim_type, distinct from 'action'", () => {
    const out = validateEvidence(input);
    const decided = out.validated_class_a.find((c) => c.proposal_id === "decided");
    const agreed = out.validated_class_a.find((c) => c.proposal_id === "agreed");
    const built = out.validated_class_a.find((c) => c.proposal_id === "built");
    const teamBuilt = out.validated_class_a.find((c) => c.proposal_id === "team_built");
    expect(decided!.claim_type).toBe("decision");
    expect(agreed!.claim_type).toBe("decision");
    expect(built!.claim_type).toBe("action");
    expect(teamBuilt!.claim_type).toBe("action");
  });

  it("'built'/'team_built' still enumerate as adjacent same-type action claims", () => {
    const out = validateEvidence(input);
    const enumeration = out.validated_class_b.find((b) => b.proposal_id === "B_enum");
    expect(enumeration).toBeDefined();
    expect(enumeration!.components).toEqual(["built", "team_built"]);
  });
});
