import { describe, it, expect } from "vitest";
import { observe } from "../../observation-engine/src/index";
import { compareRetry } from "../src/engine";
import { OPP_META } from "../src/registry";
import { ComparisonInput, ReinforcementGenerator } from "../src/types";
import { templateReinforcement } from "../src/engine";

// ---------------- fixtures ----------------
const V1 =
  "We had a scrap problem on the second op and the castings kept warping. " +
  "As a result we got it under control and the team was happy with it.";

const V2_ACHIEVED =
  "We had a scrap problem on the second op and the castings kept warping. " +
  "As a result, scrap went from 8% to 2% and the team was happy with it.";

const V2_PARTIAL =
  "We had a scrap problem on the second op and the castings kept warping. " +
  "As a result we got it under control and ran 50 clean before the shift ended.";

const V2_NOT_YET =
  "We had a scrap problem on the second op and the castings kept warping. " +
  "As a result we got it under control and everyone felt good about it.";

const V2_WIN_NEW_FLAW =
  "We had a scrap problem on the second op and the castings kept warping. " +
  "As a result, scrap went from 8% to 2% and the team was happy. So yeah";

const buildInput = (retry: string, original = V1): ComparisonInput => ({
  original_transcript: original,
  retry_transcript: retry,
  original_observation_set: observe({ transcript: original, duration_seconds: 30 }),
  retry_observation_set: observe({ transcript: retry, duration_seconds: 30 }),
  decision: {
    decision_type: "coach_one",
    selected: {
      opportunity: {
        opportunity_id: "O3_unquantified_result",
        related_habits: ["H5"],
        evidence: {},
      },
      intervention_type: "I1_direct_instruction",
      priority_class: "root_cause",
    },
    reasoning: {
      mission_handling: "aligned_selected",
      rejected: [
        { opportunity_id: "O7_weak_close", rejected_by_rule: "root_cause_override", reason: "symptom" },
        { opportunity_id: "O2_structureless_ramble", rejected_by_rule: "one_insight_rule", reason: "outranked" },
      ],
    },
  },
  coaching_move: {
    retry_instruction: { copy: "Same ending, but put a number on it. Estimates count.", pattern_key: "end_on_a_number" },
    refs: { opportunity_id: "O3_unquantified_result", intervention_type: "I1_direct_instruction", habit_id: "H5" },
  },
  mission: { habit_id: "H5" },
});

const learnerCopy = (c: ReturnType<typeof compareRetry>) => c.reinforcement.copy.toLowerCase();

// ---------------- TEST 1: achieved ----------------
describe("TEST 1: V2 fixes the selected opportunity → achieved", () => {
  it("returns achieved with retry evidence and a grounded quote", () => {
    const c = compareRetry(buildInput(V2_ACHIEVED));
    expect(c.verdict).toBe("achieved");
    expect(c.coached_habit).toBe("H5");
    expect(c.selected_opportunity_id).toBe("O3_unquantified_result");
    expect(c.evidence_from_retry.spans.length).toBeGreaterThan(0);
    expect(c.evidence_from_original.absent_signals).toContain("quantified_span");
    expect(c.reinforcement.copy).toContain("8% to 2%");
    expect(c.improvement_summary).toMatch(/quantified_span_count 0 -> /);
    expect(c.verification.passed).toBe(true);
    expect(c.verification.degraded).toBe(false);
  });
});

// ---------------- TEST 2: partial ----------------
describe("TEST 2: V2 partially improves → partial", () => {
  it("bare numeral without magnitude framing yields partial", () => {
    const c = compareRetry(buildInput(V2_PARTIAL));
    expect(c.verdict).toBe("partial");
    expect(c.evidence_from_retry.absent_signals).toContain("quantified_span");
    expect(learnerCopy(c)).toContain("put a number on it"); // same ask, no new point
    expect(c.verification.passed).toBe(true);
  });
});

// ---------------- TEST 3: not_yet ----------------
describe("TEST 3: V2 does not improve → not_yet", () => {
  it("stays warm, repeats the same ask, never scolds", () => {
    const c = compareRetry(buildInput(V2_NOT_YET));
    expect(c.verdict).toBe("not_yet");
    expect(learnerCopy(c)).toContain("put a number on it");
    expect(learnerCopy(c)).not.toMatch(/fail|wrong|bad/);
    expect(c.verification.passed).toBe(true);
  });
});

// ---------------- TEST 4: protect the win, bank the flaw ----------------
describe("TEST 4: V2 fixes the issue but creates a new flaw (JA-05)", () => {
  it("verdict stays achieved; flaw banked silently; copy never mentions it", () => {
    const c = compareRetry(buildInput(V2_WIN_NEW_FLAW));
    expect(c.verdict).toBe("achieved");
    const banked = c.banked_flaws.find((b) => b.opportunity_id === "O7_weak_close");
    expect(banked).toBeDefined();
    expect(banked!.habit_id).toBe("H9");
    expect(banked!.note).toContain("closing_hedge");
    // learner-facing copy protects the win:
    const copy = learnerCopy(c);
    expect(copy).not.toContain("new last sentence"); // O7 signature absent
    expect(copy).not.toContain("so yeah");           // the flaw itself never quoted
    expect(copy).toContain("8% to 2%");              // the win IS celebrated
    expect(c.verification.checks.find((x) => x.check === "banked_flaws_not_in_copy")!.passed).toBe(true);
  });
});

// ---------------- TEST 5: rejected opportunities never appear ----------------
describe("TEST 5: rejected opportunities never appear in comparison copy", () => {
  it("no rejected candidate's signature reaches the reinforcement", () => {
    const c = compareRetry(buildInput(V2_ACHIEVED));
    for (const r of ["O7_weak_close", "O2_structureless_ramble"]) {
      expect(learnerCopy(c)).not.toContain(OPP_META[r]!.signature.toLowerCase());
    }
    expect(c.verification.checks.find((x) => x.check === "rejected_topics_absent")!.passed).toBe(true);
  });
});

// ---------------- TEST 6: quote grounding ----------------
describe("TEST 6: quotes are grounded in the retry transcript", () => {
  it("all quoted spans slice-match their source transcript", () => {
    const c = compareRetry(buildInput(V2_ACHIEVED));
    for (const s of c.reinforcement.quoted_spans) {
      const t = s.source === "retry" ? V2_ACHIEVED : V1;
      expect(t.slice(s.char_start, s.char_end)).toBe(s.span_text);
    }
    for (const m of c.reinforcement.copy.matchAll(/"([^"]+)"/g)) {
      expect(V2_ACHIEVED.includes(m[1]!) || V1.includes(m[1]!)).toBe(true);
    }
  });
  it("a generator that fabricates a quote is caught and degraded", () => {
    const lying: ReinforcementGenerator = (ctx) => {
      const r = templateReinforcement(ctx);
      r.copy += ' You even said "we saved forty grand a year" which is huge.';
      return r;
    };
    const c = compareRetry(buildInput(V2_ACHIEVED), lying);
    expect(c.verification.degraded).toBe(true);
    expect(c.verification.passed).toBe(true);
    expect(c.reinforcement.copy).not.toContain("forty grand");
    expect(c.verdict).toBe("achieved"); // verdict is deterministic; copy corruption cannot move it
  });
});

// ---------------- TEST 7: no re-grade ----------------
describe("TEST 7: comparison does not re-grade the entire answer", () => {
  it("a retry with OTHER problems still gets copy about ONLY the coached dimension", () => {
    // number added (coached fix), but the retry is also we-heavy and hedgy:
    const messyWin =
      "We had a scrap problem and we all kept talking about it and we tried things. " +
      "As a result, scrap went from 8% to 2% and we were all pretty happy. So yeah";
    const c = compareRetry(buildInput(messyWin));
    expect(c.verdict).toBe("achieved");
    const copy = learnerCopy(c);
    for (const other of Object.keys(OPP_META).filter((k) => k !== "O3_unquantified_result")) {
      expect(copy).not.toContain(OPP_META[other]!.signature.toLowerCase());
    }
    // the other problems went to the bank, not the learner
    expect(c.banked_flaws.length).toBeGreaterThan(0);
  });
});

// ---------------- TEST 8: degraded fallback ----------------
describe("TEST 8: degraded fallback when verification fails", () => {
  it("a crashing generator still yields a safe, verified card with the true verdict", () => {
    const crashing: ReinforcementGenerator = () => { throw new Error("model timeout"); };
    const c = compareRetry(buildInput(V2_PARTIAL), crashing);
    expect(c.verification.degraded).toBe(true);
    expect(c.verification.attempts).toBe(3);
    expect(c.verification.passed).toBe(true);
    expect(c.verdict).toBe("partial");
    expect(learnerCopy(c)).toContain("put a number on it"); // signature via fallback suffix
  });
  it("an em dash in generated copy triggers the fallback (style rule holds here too)", () => {
    const dashy: ReinforcementGenerator = (ctx) => {
      const r = templateReinforcement(ctx);
      r.copy = "Nice \u2014 that landed.";
      return r;
    };
    const c = compareRetry(buildInput(V2_ACHIEVED), dashy);
    expect(c.verification.degraded).toBe(true);
    expect(c.reinforcement.copy).not.toContain("\u2014");
  });
});

// ---------------- determinism & validation ----------------
describe("determinism & validation", () => {
  it("same input → deep-equal output", () => {
    expect(compareRetry(buildInput(V2_ACHIEVED))).toEqual(compareRetry(buildInput(V2_ACHIEVED)));
  });
  it("rejects reinforce_only decisions with the shared taxonomy", () => {
    const bad = buildInput(V2_ACHIEVED);
    bad.decision = { decision_type: "reinforce_only", selected: null, reasoning: { mission_handling: "n/a", rejected: [] } };
    try {
      compareRetry(bad);
      expect.unreachable("should throw");
    } catch (e: unknown) {
      expect((e as { code: string }).code).toBe("INPUT_INVALID");
    }
  });
});

// ---------------- registry invariant (added after Workbench caught O4/O7/O8) ----------------
describe("REGISTRY INVARIANT: every verdict template carries its signature", () => {
  it("all opportunities × all verdicts contain the opportunity signature", async () => {
    const { VERDICT_COPY, OPP_META } = await import("../src/registry");
    for (const [id, table] of Object.entries(VERDICT_COPY)) {
      const sig = OPP_META[id]!.signature.toLowerCase();
      for (const verdict of ["achieved", "partial", "not_yet"] as const) {
        expect(table[verdict].toLowerCase(), `${id}.${verdict}`).toContain(sig);
      }
    }
  });
});
