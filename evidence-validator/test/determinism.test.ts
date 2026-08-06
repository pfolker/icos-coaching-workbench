/**
 * Determinism proof (required, not optional): every Atlas fixture run
 * through the Validator twice, independently, must produce byte-identical
 * output — same field order, same array order, everything.
 */
import { describe, it, expect } from "vitest";
import { validateEvidence } from "../src/validator";
import { input as case001 } from "./fixtures/case001";
import { input as case002 } from "./fixtures/case002";
import { input as case003 } from "./fixtures/case003";
import { input as case004 } from "./fixtures/case004";
import { input as case005 } from "./fixtures/case005";
import { input as case006 } from "./fixtures/case006";
import { input as case007, multiCandidateInput as case007b } from "./fixtures/case007";
import { input as case008 } from "./fixtures/case008";
import { input as case009 } from "./fixtures/case009";
import { input as case010 } from "./fixtures/case010";

const ALL_FIXTURES: [string, typeof case001][] = [
  ["case001", case001], ["case002", case002], ["case003", case003], ["case004", case004],
  ["case005", case005], ["case006", case006], ["case007", case007], ["case007-multi-candidate", case007b],
  ["case008", case008], ["case009", case009], ["case010", case010],
];

describe("Determinism proof: byte-identical output across independent runs", () => {
  for (const [name, fixture] of ALL_FIXTURES) {
    it(`${name}: two independent runs produce byte-identical JSON`, () => {
      const run1 = JSON.stringify(validateEvidence(fixture));
      const run2 = JSON.stringify(validateEvidence(fixture));
      expect(run1).toBe(run2);
    });
  }

  it("all fixtures together, three interleaved passes, still byte-identical per fixture", () => {
    // guards against any hidden shared mutable state across calls
    const passes = [1, 2, 3].map(() =>
      ALL_FIXTURES.map(([, fixture]) => JSON.stringify(validateEvidence(fixture)))
    );
    for (let i = 0; i < ALL_FIXTURES.length; i++) {
      expect(passes[1]![i]).toBe(passes[0]![i]);
      expect(passes[2]![i]).toBe(passes[0]![i]);
    }
  });
});
