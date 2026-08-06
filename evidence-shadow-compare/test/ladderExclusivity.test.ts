import { describe, it, expect } from "vitest";
import { resolveLadderConflictsForRendering, LADDER_EXCLUSIVITY_RULES } from "../src/ladderExclusivity";
import { quickScan } from "../../alpha-workbench/server/proof";
import { observe } from "../../observation-engine/src/index";

describe("ladder-exclusivity resolution — real incident: CNC case rendered both ends of the O3 ladder at once", () => {
  it("declares exactly one rule today: O3_missing_result / O3_unquantified_result", () => {
    expect(LADDER_EXCLUSIVITY_RULES).toHaveLength(1);
    expect(LADDER_EXCLUSIVITY_RULES[0]!.absence_id).toBe("O3_missing_result");
    expect(LADDER_EXCLUSIVITY_RULES[0]!.presence_id).toBe("O3_unquantified_result");
  });

  it("drops the absence id when both ends of a ladder are present", () => {
    const out = resolveLadderConflictsForRendering(["O5_vagueness", "O3_missing_result", "O3_unquantified_result"]);
    expect(out).toEqual(["O5_vagueness", "O3_unquantified_result"]);
  });

  it("is a no-op when only one end of the ladder is present (either end)", () => {
    expect(resolveLadderConflictsForRendering(["O3_missing_result", "O5_vagueness"]))
      .toEqual(["O3_missing_result", "O5_vagueness"]);
    expect(resolveLadderConflictsForRendering(["O3_unquantified_result", "O5_vagueness"]))
      .toEqual(["O3_unquantified_result", "O5_vagueness"]);
  });

  it("is a no-op on an empty list and on ids unrelated to any rule", () => {
    expect(resolveLadderConflictsForRendering([])).toEqual([]);
    expect(resolveLadderConflictsForRendering(["O4_ownership_hiding", "O7_weak_close"]))
      .toEqual(["O4_ownership_hiding", "O7_weak_close"]);
  });

  it("SECOND real incident (checkout-outage transcript): never drops the absence_id when it IS the selected focus — even though both ends of the ladder are present", () => {
    const ids = ["O4_ownership_hiding", "O5_vagueness", "O3_missing_result", "O3_unquantified_result"];
    // without protection, the old behavior:
    expect(resolveLadderConflictsForRendering(ids)).not.toContain("O3_missing_result");
    // with the selected id passed in, it must survive:
    expect(resolveLadderConflictsForRendering(ids, "O3_missing_result")).toEqual(ids);
  });

  it("still drops the absence_id normally when the PRESENCE id is what got selected (CNC/thin shape) — protection is narrowly scoped to the actual selection, not a blanket exemption", () => {
    const ids = ["O3_missing_result", "O5_vagueness", "O3_unquantified_result"];
    expect(resolveLadderConflictsForRendering(ids, "O3_unquantified_result"))
      .toEqual(["O5_vagueness", "O3_unquantified_result"]);
  });

  it("is a no-op when selectedOpportunityId is omitted, null, or unrelated to any rule", () => {
    const ids = ["O3_missing_result", "O3_unquantified_result"];
    expect(resolveLadderConflictsForRendering(ids)).toEqual(["O3_unquantified_result"]);
    expect(resolveLadderConflictsForRendering(ids, null)).toEqual(["O3_unquantified_result"]);
    expect(resolveLadderConflictsForRendering(ids, "O5_vagueness")).toEqual(["O3_unquantified_result"]);
  });

  it("REGRESSION: byte-identical quickScan() behavior for ANY single-source (regex-only) id list — Step 2 confirmed a single regex pass can never produce both ends of the O3 ladder, so this function must never change a regex-only render", () => {
    const observations = observe({
      transcript: "We had an issue with parts on the line and eventually got it sorted out. Things went back to normal after that.",
    });
    // simulate every combination a single regex source could plausibly emit,
    // confirming resolveLadderConflictsForRendering() never alters any of them
    const plausibleRegexOnlyIdSets = [
      [],
      ["O3_missing_result"],
      ["O3_unquantified_result"],
      ["O5_vagueness"],
      ["O3_missing_result", "O5_vagueness"],
      ["O3_unquantified_result", "O5_vagueness"],
      ["O2_structureless_ramble", "O4_ownership_hiding", "O11_employer_negativity"],
    ];
    for (const ids of plausibleRegexOnlyIdSets) {
      for (const selectedId of [undefined, ids[0]]) {
        const before = quickScan(observations, ids);
        const resolved = resolveLadderConflictsForRendering(ids, selectedId);
        const after = quickScan(observations, resolved);
        expect(resolved).toEqual(ids); // the function itself did nothing
        expect(after).toEqual(before); // and quickScan's output is byte-identical
      }
    }
  });
});
