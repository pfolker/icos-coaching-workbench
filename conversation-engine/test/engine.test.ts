import { describe, it, expect } from "vitest";
import { generateCoachingMove } from "../src/engine";
import { OPPORTUNITY_COPY } from "../src/registry";
import { ConversationInput } from "../src/types";

const T = "We had a scrap problem. As a result we got it under control for the team.";

const input = (over: {
  opportunity_id?: string;
  intervention?: string;
  mission_handling?: "aligned_selected" | "mission_fallback" | "no_mission";
  mission?: { habit_id: string } | null;
  decision_type?: "coach_one" | "reinforce_only";
  spans?: { sentence_index: number; char_start: number; char_end: number; span_text: string }[];
} = {}): ConversationInput => {
  const id = over.opportunity_id ?? "O3_unquantified_result";
  return {
    transcript: T,
    coaching_state: "flowing",
    mission: over.mission ?? null,
    observation_set: {
      sentences: [
        { index: 0, text: "We had a scrap problem.", char_start: 0, char_end: 23, word_count: 5 },
        { index: 1, text: "As a result we got it under control for the team.", char_start: 24, char_end: T.length, word_count: 11 },
      ],
      observations: [],
      metrics: {},
    },
    decision: over.decision_type === "reinforce_only"
      ? { decision_type: "reinforce_only", selected: null,
          reasoning: { mission_handling: "no_mission", rejected: [] } }
      : {
          decision_type: "coach_one",
          selected: {
            opportunity: {
              opportunity_id: id, related_habits: [OPPORTUNITY_COPY[id]!.habit_id],
              evidence: { spans: over.spans ?? [], observation_types_cited: [], metrics_cited: [], absent_signals: [] },
              confidence: 0.7, mission_alignment: over.mission_handling === "aligned_selected" ? "aligned" : "no_mission",
            },
            intervention_type: over.intervention ?? "I1_direct_instruction",
            priority_class: "standard",
          },
          reasoning: { mission_handling: over.mission_handling ?? "no_mission", rejected: [] },
        },
  };
};

describe("CoachingMove completeness", () => {
  it("contains recognition, insight, why it matters, retry, verification", () => {
    const m = generateCoachingMove(input());
    expect(m.recognition.copy.length).toBeGreaterThan(0);
    expect(m.insight!.copy.length).toBeGreaterThan(0);
    expect(m.why_it_matters!.copy.length).toBeGreaterThan(0);
    expect(m.retry_instruction!.copy.length).toBeGreaterThan(0);
    expect(m.verification.passed).toBe(true);
    expect(m.verification.degraded).toBe(false);
    expect(m.verification.checks.length).toBe(8);
  });
  it("JA-08 gate: with no praiseworthy observation, recognition is honest, not inflated", () => {
    const m = generateCoachingMove(input());
    expect(m.recognition.downgraded).toBe(true);
    expect(m.recognition.quoted_spans).toEqual([]);
  });
  it("recognition quotes a real sentence when a strength observation exists", () => {
    const inp = input();
    inp.observation_set.observations = [{
      observation_type: "structure_result_marker", value: 1, confidence: 0.5, confidence_basis: "t",
      evidence: [{ sentence_index: 1, char_start: 24, char_end: 35, span_text: "As a result" }],
    }];
    const m = generateCoachingMove(inp);
    expect(m.recognition.downgraded).toBe(false);
    expect(m.recognition.copy).toContain("As a result we got it under control for the team");
    expect(T.slice(m.recognition.quoted_spans[0]!.char_start, m.recognition.quoted_spans[0]!.char_end))
      .toBe(m.recognition.quoted_spans[0]!.span_text);
  });
});

describe("intervention branches", () => {
  it("I3 elicitation phrases the insight as a question", () => {
    const m = generateCoachingMove(input({ intervention: "I3_elicitation" }));
    expect(m.insight!.copy).toContain("?");
    expect(m.insight!.copy).toMatch(/^You have shown me numbers before/);
  });
  it("I7 reframe leads with the reframe for the belief-blocked habit", () => {
    const m = generateCoachingMove(input({ opportunity_id: "O4_ownership_hiding", intervention: "I7_reframe" }));
    expect(m.insight!.copy).toMatch(/^First, one reframe: saying I is not bragging/);
  });
  it("I10 protect mode softens the ask", () => {
    const m = generateCoachingMove(input({ intervention: "I10_confidence_structuring" }));
    expect(m.insight!.copy).toMatch(/^One small thing, then we are done strong/);
  });
});

describe("retry instruction matches the selected opportunity, for every opportunity", () => {
  for (const id of Object.keys(OPPORTUNITY_COPY)) {
    it(`${id} → ${OPPORTUNITY_COPY[id]!.retry_pattern_key}`, () => {
      const m = generateCoachingMove(input({ opportunity_id: id }));
      expect(m.retry_instruction!.pattern_key).toBe(OPPORTUNITY_COPY[id]!.retry_pattern_key);
      expect(m.verification.passed).toBe(true);
    });
  }
});

describe("mission line", () => {
  it("appears only when the decision reports aligned_selected", () => {
    const aligned = generateCoachingMove(input({
      mission_handling: "aligned_selected", mission: { habit_id: "H5" } }));
    expect(aligned.mission_line).toContain("making your results measurable");
    const fallback = generateCoachingMove(input({
      mission_handling: "mission_fallback", mission: { habit_id: "H5" } }));
    expect(fallback.mission_line).toBeNull();
  });
});

describe("reinforce_only", () => {
  it("produces recognition + advance copy, no insight, no retry", () => {
    const m = generateCoachingMove(input({ decision_type: "reinforce_only" }));
    expect(m.move_type).toBe("reinforce_only");
    expect(m.insight).toBeNull();
    expect(m.retry_instruction).toBeNull();
    expect(m.advance_copy!.length).toBeGreaterThan(0);
    expect(m.verification.passed).toBe(true);
  });
});

describe("V3.2 copy patch: O5_vagueness insight no longer accusatory", () => {
  const OLD_PHRASE = "Nothing here could only have come from the person who lived it";
  it("uses the replacement 'add one concrete detail' framing", () => {
    const m = generateCoachingMove(input({ opportunity_id: "O5_vagueness" }));
    expect(m.insight!.copy).toContain("add one concrete detail");
    expect(m.insight!.copy).not.toContain(OLD_PHRASE);
    expect(m.verification.passed).toBe(true);
  });
  it("the retired phrase never appears in generated copy, for any opportunity id", () => {
    for (const id of Object.keys(OPPORTUNITY_COPY)) {
      const m = generateCoachingMove(input({ opportunity_id: id }));
      expect(JSON.stringify(m).toLowerCase()).not.toContain(OLD_PHRASE.toLowerCase());
    }
  });
});

describe("determinism & validation", () => {
  it("same input → deep-equal output", () => {
    expect(generateCoachingMove(input())).toEqual(generateCoachingMove(input()));
  });
  it("rejects invalid input with the shared taxonomy", () => {
    try {
      generateCoachingMove({ ...input(), transcript: "" });
      expect.unreachable("should throw");
    } catch (e: unknown) {
      expect((e as { code: string }).code).toBe("INPUT_INVALID");
    }
  });
});
