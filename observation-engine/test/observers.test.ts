import { describe, it, expect } from "vitest";
import { observe } from "../src/engine";
import { Observation, ObservationType } from "../src/types";

const find = (set: { observations: Observation[] }, type: ObservationType) =>
  set.observations.find((o) => o.observation_type === type);

describe("fillers", () => {
  it("detects core fillers with high confidence", () => {
    const set = observe({ transcript: "Um, so I, uh, rebuilt the fixture. You know, it worked." });
    const core = find(set, "filler_core")!;
    expect(core.value).toBe(3);
    expect(core.confidence).toBeGreaterThanOrEqual(0.9);
    expect(core.evidence.map((e) => e.span_text.toLowerCase())).toEqual(["um", "uh", "you know"]);
  });
  it("classifies 'like' as soft (ambiguous) filler, lower confidence", () => {
    const set = observe({ transcript: "It was like a big deal and I like the work." });
    const soft = find(set, "filler_soft")!;
    expect(soft.confidence).toBeLessThan(0.9);
    expect(soft.confidence_basis).toMatch(/upper bound/);
  });
  it("no filler observations on clean speech", () => {
    const set = observe({ transcript: "I rebuilt the fixture. Scrap fell to two percent." });
    expect(find(set, "filler_core")).toBeUndefined();
  });
});

describe("hedges & closings", () => {
  it("detects a closing hedge on the final sentence", () => {
    const set = observe({ transcript: "I fixed it. We saved money. So yeah" });
    const c = find(set, "closing_hedge")!;
    expect(c.value).toBe(true);
    expect(c.evidence[0]!.sentence_index).toBe(set.sentences.length - 1);
  });
  it("detects trailing off (short final fragment, no punctuation)", () => {
    const set = observe({ transcript: "I redesigned the whole clamping system for the second op. and that was" });
    expect(find(set, "trailing_off")).toBeDefined();
  });
  it("does not flag a strong close", () => {
    const set = observe({ transcript: "I redesigned the clamping. As a result, scrap dropped from 8% to 2%." });
    expect(find(set, "closing_hedge")).toBeUndefined();
    expect(find(set, "trailing_off")).toBeUndefined();
  });
  it("counts mid-answer hedge markers", () => {
    const set = observe({ transcript: "I think it was maybe the fixture. Probably the supports." });
    expect(find(set, "hedge_marker")!.value).toBe(3);
  });
});

describe("agency language", () => {
  it("counts I vs we and attributes agency verbs", () => {
    const set = observe({
      transcript: "We had a scrap problem. I redesigned the fixture and I proposed a new sequence. We ran the batch.",
    });
    expect(find(set, "first_person_singular")!.value).toBe(2);
    expect(find(set, "first_person_plural")!.value).toBe(2);
    const agency = find(set, "agency_verb_i")!;
    expect(agency.value).toBe(2);
    expect(agency.evidence.map((e) => e.span_text)).toEqual([
      "I redesigned", "I proposed",
    ]);
  });
  it("distinguishes presence verbs", () => {
    const set = observe({ transcript: "I helped with the setup and I was involved in the testing." });
    expect(find(set, "presence_verb_i")!.value).toBe(2);
    expect(find(set, "agency_verb_i")).toBeUndefined();
  });
});

describe("quantification", () => {
  it("detects percents, currency, ranges, and unit quantities", () => {
    const set = observe({
      transcript: "Scrap went from 8% to 2%, which saved $40,000 a year and about 3 hours per shift.",
    });
    const q = find(set, "quantified_span")!;
    expect(q.value as number).toBeGreaterThanOrEqual(3);
    expect(q.confidence).toBeGreaterThanOrEqual(0.9);
  });
  it("excludes year-like bare numbers, keeps genuine bare numbers at low confidence", () => {
    const set = observe({ transcript: "Back in 2019 we ran 50 without a failure." });
    const bare = find(set, "numeric_span")!;
    expect(bare.evidence.map((e) => e.span_text)).toEqual(["50"]);
    expect(bare.confidence).toBeLessThanOrEqual(0.5);
  });
  it("no quantification observations when none exist", () => {
    const set = observe({ transcript: "The project was a success and everyone was happy." });
    expect(find(set, "quantified_span")).toBeUndefined();
    expect(find(set, "numeric_span")).toBeUndefined();
  });
  it("recognizes digit-form 'thou' as a unit (Work Order: Close Remaining Dimensional-Language Gaps)", () => {
    const set = observe({ transcript: "I reduced runout from 8 thou to 2 thou." });
    const q = find(set, "quantified_span")!;
    expect(q).toBeDefined();
    expect(q.evidence.map((e) => e.span_text)).toEqual(["8 thou", "2 thou"]);
  });
});

describe("hypotheticals", () => {
  it("detects hypothetical/habitual markers", () => {
    const set = observe({ transcript: "Typically I would start by checking the tooling. Usually that fixes it." });
    expect(find(set, "hypothetical_marker")!.value).toBe(3);
  });
  it("notes that interpretation is downstream, not judged here", () => {
    const set = observe({ transcript: "I would check the offsets." });
    expect(find(set, "hypothetical_marker")!.confidence_basis).toMatch(/downstream/);
  });
});

describe("employer negativity", () => {
  it("flags negative terms co-occurring with employer terms in a sentence", () => {
    const set = observe({ transcript: "My old manager was completely incompetent. The fixture was fine." });
    const n = find(set, "employer_negativity")!;
    expect(n.evidence[0]!.span_text.toLowerCase()).toBe("incompetent");
  });
  it("does not flag negative terms about non-employer subjects", () => {
    const set = observe({ transcript: "The old fixture design was awful. I replaced it." });
    expect(find(set, "employer_negativity")).toBeUndefined();
  });
});

describe("structural signals (low-confidence heuristics by design)", () => {
  it("detects STAR markers and caps confidence at 0.5", () => {
    const set = observe({
      transcript:
        "At the time, we had a scrap problem. My job was to fix the second op. " +
        "So I redesigned the clamping. As a result, scrap dropped to 2%.",
    });
    for (const t of [
      "structure_situation_marker", "structure_task_marker",
      "structure_action_marker", "structure_result_marker",
    ] as const) {
      const o = find(set, t)!;
      expect(o).toBeDefined();
      expect(o.confidence).toBeLessThanOrEqual(0.5);
      expect(o.confidence_basis).toMatch(/LLM Listen/);
    }
    expect(find(set, "result_in_final_sentence")!.value).toBe(true);
  });
  it("recognizes 'dropped' as a result marker (Work Order: Close Remaining Dimensional-Language Gaps)", () => {
    const set = observe({
      transcript:
        "I corrected the mounting angle from 2 degrees off to within 0.1 degrees, " +
        "and the rework rate dropped right away.",
    });
    const o = find(set, "structure_result_marker")!;
    expect(o).toBeDefined();
    expect(o.evidence.map((e) => e.span_text.toLowerCase())).toContain("dropped");
  });
});
