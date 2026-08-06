import { describe, it, expect } from "vitest";
import { validateEvidence } from "../../src/validator";
import { input } from "../fixtures/case010";

describe("Atlas Case 010 — Missing Context Makes Inference Tempting but Unsafe", () => {
  it("temporal order validates as Class B", () => {
    const out = validateEvidence(input);
    expect(out.rejected).toEqual([]);
    const temporal = out.validated_class_b.find((b) => b.proposal_id === "B_temporal");
    expect(temporal).toBeDefined();
    expect(temporal!.relationship_type).toBe("temporal_sequence");
  });

  it("the causal claim remains Class C and non-admissible despite no competing alternative in the transcript", () => {
    const out = validateEvidence(input);
    expect(out.class_c_non_admissible.length).toBe(1);
    expect(out.class_c_non_admissible[0]!.admissible).toBe(false);
    const json = JSON.stringify(out.validated_class_a) + JSON.stringify(out.validated_class_b);
    expect(json.toLowerCase()).not.toContain("caused the completion rate increase");
  });
});
