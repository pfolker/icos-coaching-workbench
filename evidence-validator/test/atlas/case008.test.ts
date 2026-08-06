import { describe, it, expect } from "vitest";
import { validateEvidence } from "../../src/validator";
import { input } from "../fixtures/case008";

describe("Atlas Case 008 — Two Plausible Causes", () => {
  it("both candidate causes remain Class C and non-admissible", () => {
    const out = validateEvidence(input);
    expect(out.class_c_non_admissible.length).toBe(2);
    for (const c of out.class_c_non_admissible) {
      expect(c.admissible).toBe(false);
      expect(c.allowed_uses).toEqual(["experimental_logging", "atlas_evaluation", "clarification_candidate"]);
    }
  });

  it("neither appears in validated_class_a or validated_class_b under any framing", () => {
    const out = validateEvidence(input);
    const aText = JSON.stringify(out.validated_class_a).toLowerCase();
    const bText = JSON.stringify(out.validated_class_b).toLowerCase();
    expect(aText).not.toContain("caused the failures");
    expect(aText).not.toContain("inexperience contributed");
    expect(bText).not.toContain("caused the failures");
    expect(bText).not.toContain("inexperience contributed");
  });

  it("v1.1 / EP-004: temporal_sequence validates in the Atlas's own semantic order via the 'once' connector", () => {
    const out = validateEvidence(input);
    const temporal = out.validated_class_b.find((b) => b.proposal_id === "B_temporal");
    expect(temporal).toBeDefined();
    expect(temporal!.relationship_type).toBe("temporal_sequence");
    expect(temporal!.components).toEqual(["reverted", "failures_stopped"]);
    expect(temporal!.ordering_basis).toBe("connector:once");
  });
});
