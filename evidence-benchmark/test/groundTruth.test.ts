import { describe, it, expect } from "vitest";
import { GROUND_TRUTH } from "../src/groundTruth";

describe("Ground truth internal consistency", () => {
  for (const c of GROUND_TRUTH) {
    describe(`Case ${c.case_id}`, () => {
      it("every Class A quote is an exact verbatim substring of the transcript", () => {
        for (const a of c.class_a) {
          expect(c.transcript.includes(a.quote), `${a.id} quote not found verbatim: "${a.quote}"`).toBe(true);
        }
      });

      it("every Class A id is unique within the case", () => {
        const ids = c.class_a.map((a) => a.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it("every Class B component_id references a real Class A id in this case", () => {
        const aIds = new Set(c.class_a.map((a) => a.id));
        for (const b of c.class_b) {
          for (const compId of b.component_ids) {
            expect(aIds.has(compId), `${b.id} references unknown component "${compId}"`).toBe(true);
          }
        }
      });

      it("self-contained Class B markers (1 component) actually appear within that component's own quote", () => {
        for (const b of c.class_b) {
          if (b.component_ids.length !== 1 || !b.marker_text) continue;
          const comp = c.class_a.find((a) => a.id === b.component_ids[0])!;
          expect(
            comp.quote.toLowerCase().includes(b.marker_text.toLowerCase()),
            `${b.id}'s marker "${b.marker_text}" not found inside self-contained component ${comp.id}'s quote`
          ).toBe(true);
        }
      });

      it("bridging Class B markers (2 components) appear in the transcript gap between them", () => {
        for (const b of c.class_b) {
          if (b.component_ids.length !== 2 || !b.marker_text) continue;
          const [c1, c2] = b.component_ids.map((id) => c.class_a.find((a) => a.id === id)!);
          const i1 = c.transcript.indexOf(c1!.quote);
          const i2 = c.transcript.indexOf(c2!.quote);
          const [start, end] = i1 <= i2 ? [i1 + c1!.quote.length, i2] : [i2 + c2!.quote.length, i1];
          const gap = c.transcript.slice(start, end).toLowerCase();
          expect(gap.includes(b.marker_text.toLowerCase()), `${b.id}'s marker "${b.marker_text}" not found between its two components`).toBe(true);
        }
      });
    });
  }

  it("every case_id 001-010 is present exactly once", () => {
    const ids = GROUND_TRUTH.map((c) => c.case_id).sort();
    expect(ids).toEqual(["001", "002", "003", "004", "005", "006", "007", "008", "009", "010"]);
  });
});
