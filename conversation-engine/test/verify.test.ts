import { describe, it, expect } from "vitest";
import { generateCoachingMove } from "../src/engine";
import { templateGenerator } from "../src/generator";
import { ConversationInput, CopyGenerator } from "../src/types";

// ---------- fixture: a decision + observations pair ----------
const TRANSCRIPT =
  "We had a scrap problem on the second op. As a result we got it under control and things improved for the team.";

const baseInput = (): ConversationInput => ({
  transcript: TRANSCRIPT,
  coaching_state: "flowing",
  mission: null,
  observation_set: {
    sentences: [
      { index: 0, text: "We had a scrap problem on the second op.", char_start: 0, char_end: 40, word_count: 8 },
      { index: 1, text: "As a result we got it under control and things improved for the team.", char_start: 41, char_end: TRANSCRIPT.length, word_count: 14 },
    ],
    observations: [
      { observation_type: "structure_result_marker", value: 1, confidence: 0.5, confidence_basis: "fixture",
        evidence: [{ sentence_index: 1, char_start: 41, char_end: 52, span_text: "As a result" }] },
    ],
    metrics: {},
  },
  decision: {
    decision_type: "coach_one",
    selected: {
      opportunity: {
        opportunity_id: "O3_unquantified_result",
        related_habits: ["H5"],
        evidence: { spans: [{ sentence_index: 1, char_start: 41, char_end: 52, span_text: "As a result" }],
          observation_types_cited: ["structure_result_marker"], metrics_cited: [], absent_signals: ["quantified_span"] },
        confidence: 0.7,
        mission_alignment: "no_mission",
      },
      intervention_type: "I1_direct_instruction",
      priority_class: "root_cause",
    },
    reasoning: {
      mission_handling: "no_mission",
      rejected: [
        { opportunity_id: "O7_weak_close", rejected_by_rule: "root_cause_override", reason: "symptom" },
        { opportunity_id: "O10_filler_density", rejected_by_rule: "state_gate", reason: "gated" },
      ],
    },
  },
});

/** wraps the honest generator, then corrupts one thing */
const corrupt = (mutate: (c: ReturnType<CopyGenerator>) => void): CopyGenerator => (ctx) => {
  const copy = templateGenerator(ctx);
  mutate(copy);
  return copy;
};

const expectDegradedSafe = (input: ConversationInput, gen: CopyGenerator, failedCheck: string, poison: string) => {
  const move = generateCoachingMove(input, gen);
  expect(move.verification.degraded).toBe(true);
  expect(move.verification.passed).toBe(true); // the FALLBACK passes; the corruption did not ship
  expect(move.verification.attempts).toBe(3);
  const copy = JSON.stringify([move.mission_line, move.recognition.copy, move.insight?.copy,
    move.why_it_matters?.copy, move.retry_instruction?.copy, move.advance_copy]);
  expect(copy.toLowerCase()).not.toContain(poison.toLowerCase());
  // degraded card still carries the correct retry for the SELECTED opportunity
  expect(move.retry_instruction?.pattern_key).toBe("end_on_a_number");
  void failedCheck;
};

describe("VERIFIER: hallucinated quotes never ship", () => {
  it("fake quote → degraded fallback without the fake quote", () => {
    expectDegradedSafe(baseInput(), corrupt((c) => {
      c.insight!.copy += ' You said "we cut scrap by half in a month" and that was strong.';
    }), "quote_grounding", "cut scrap by half");
  });
  it("tampered span offsets → degraded", () => {
    expectDegradedSafe(baseInput(), corrupt((c) => {
      c.insight!.quoted_spans = [{ sentence_index: 0, char_start: 0, char_end: 11, span_text: "As a result" }];
    }), "span_integrity", "IMPOSSIBLE_MARKER");
  });
});

describe("VERIFIER: invented facts never ship", () => {
  it("a number absent from the transcript → degraded", () => {
    expectDegradedSafe(baseInput(), corrupt((c) => {
      c.insight!.copy += " That probably saved 73% of the rework.";
    }), "numeric_facts", "73%");
  });
});

describe("VERIFIER: exactly one coaching point", () => {
  it("second-point connector language → degraded", () => {
    expectDegradedSafe(baseInput(), corrupt((c) => {
      c.insight!.copy += " Also, watch the fillers at the start.";
    }), "single_point_language", "watch the fillers");
  });
  it("rejected-opportunity coaching leaking in → degraded", () => {
    expectDegradedSafe(baseInput(), corrupt((c) => {
      c.insight!.copy += " And give me a new last sentence while you are at it."; // O7 signature
    }), "rejected_topics_absent", "new last sentence");
  });
});

describe("VERIFIER: retry integrity and style", () => {
  it("retry swapped to a different opportunity → degraded (with correct retry restored)", () => {
    expectDegradedSafe(baseInput(), corrupt((c) => {
      c.retry_instruction = { copy: "Same story, facts only. What happened and what you did, no verdicts on people.", pattern_key: "facts_not_verdicts" };
    }), "retry_pattern_match", "no verdicts on people");
  });
  it("em dash in learner-facing copy → degraded (founder style rule, mechanically enforced)", () => {
    expectDegradedSafe(baseInput(), corrupt((c) => {
      c.recognition.copy = "Nice work \u2014 really.";
    }), "style_no_em_dash", "\u2014");
  });
  it("generator that throws twice → degraded fallback still delivers a safe card", () => {
    const crashing: CopyGenerator = () => { throw new Error("model timeout"); };
    const move = generateCoachingMove(baseInput(), crashing);
    expect(move.verification.degraded).toBe(true);
    expect(move.verification.passed).toBe(true);
    expect(move.insight).not.toBeNull();
    expect(move.retry_instruction?.pattern_key).toBe("end_on_a_number");
  });
});
