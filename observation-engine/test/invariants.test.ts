import { describe, it, expect } from "vitest";
import { observe } from "../src/engine";

const FIXTURES = [
  "Um, so at the time we had, like, a huge scrap problem on the second op and the castings kept warping so I redesigned the clamping setup because the old supports were stressing the thin wall and then we ran fifty parts clean.",
  "I helped the team. We shipped it. So yeah",
  "My job was to cut cycle time. I reprogrammed the roughing passes and cycle time went from 14 minutes to 9. As a result we freed up a full shift per week, roughly $40,000 a year.",
  "That's a great question. Typically I would start with the tooling, usually the offsets, maybe the workholding. I guess",
  "My old boss was a nightmare and the whole company was toxic. Anyway. I fixed the process myself.",
];

describe("INVARIANT: evidence span integrity", () => {
  it("every evidence span_text equals transcript.slice(start, end); every index valid", () => {
    for (const transcript of FIXTURES) {
      const set = observe({ transcript });
      for (const obs of set.observations) {
        expect(obs.evidence.length).toBeGreaterThan(0); // no evidence-free detections
        for (const ev of obs.evidence) {
          expect(transcript.slice(ev.char_start, ev.char_end)).toBe(ev.span_text);
          expect(ev.sentence_index).toBeGreaterThanOrEqual(0);
          expect(ev.sentence_index).toBeLessThan(set.sentences.length);
        }
      }
      for (const s of set.sentences) {
        expect(transcript.slice(s.char_start, s.char_end)).toBe(s.text);
      }
    }
  });
});

describe("INVARIANT: confidence contract", () => {
  it("every observation has confidence in (0,1] and a stated basis", () => {
    for (const transcript of FIXTURES) {
      for (const obs of observe({ transcript }).observations) {
        expect(obs.confidence).toBeGreaterThan(0);
        expect(obs.confidence).toBeLessThanOrEqual(1);
        expect(obs.confidence_basis.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("INVARIANT: determinism", () => {
  it("same input produces deep-equal output", () => {
    for (const transcript of FIXTURES) {
      expect(observe({ transcript })).toEqual(observe({ transcript }));
    }
  });
});

describe("BOUNDARY CONTRACT: observes only — never coaches, prioritizes, or generates opportunities", () => {
  it("output contains only the declared schema keys (no copy/priority/opportunity fields)", () => {
    const set = observe({ transcript: FIXTURES[0]! });
    expect(Object.keys(set).sort()).toEqual(
      ["metrics", "observations", "producer", "schema_version", "sentences", "transcript_sha256"].sort()
    );
    for (const obs of set.observations) {
      expect(Object.keys(obs).sort()).toEqual(
        ["confidence", "confidence_basis", "evidence", "observation_type", "value"].sort()
      );
    }
  });
  it("emits no prescriptive/judgmental language anywhere in the payload", () => {
    const json = JSON.stringify(observe({ transcript: FIXTURES[0]! })).toLowerCase();
    for (const banned of [
      "you should", "try to", "improve", "weakness", "priority", "opportunity",
      "recommend", "coach", "mission", "severity", "needs ",
    ]) {
      expect(json).not.toContain(banned);
    }
  });
  it("reports measurements, not threshold judgments (no long/short/too-many verdicts)", () => {
    const longAnswer = ("we did the thing and then the other thing so it worked because reasons ").repeat(40);
    const json = JSON.stringify(observe({ transcript: longAnswer })).toLowerCase();
    for (const banned of ["too long", "too short", "rambl", "excessive"]) {
      expect(json).not.toContain(banned);
    }
  });
});

describe("input validation & metrics", () => {
  it("rejects empty/invalid input with the shared error taxonomy", () => {
    for (const bad of ["", "   "]) {
      try {
        observe({ transcript: bad });
        expect.unreachable("should have thrown");
      } catch (e: any) {
        expect(e.code).toBe("INPUT_INVALID");
        expect(e.retryable).toBe(false);
      }
    }
    expect(() => observe({ transcript: "ok words here", duration_seconds: -3 })).toThrow();
  });

  it("uses provided duration; estimates (and flags) when absent", () => {
    const t = "I rebuilt the fixture and scrap dropped to two percent for the whole run.";
    const provided = observe({ transcript: t, duration_seconds: 30 });
    expect(provided.metrics.duration_seconds).toBe(30);
    expect(provided.metrics.duration_is_estimated).toBe(false);

    const estimated = observe({ transcript: t });
    expect(estimated.metrics.duration_is_estimated).toBe(true);
    expect(estimated.metrics.duration_seconds).toBeGreaterThan(0);
  });

  it("aggregates counts consistently with observations", () => {
    const set = observe({
      transcript: "Um, we tried it. Uh, I redesigned the fixture. We saved $40,000.",
      duration_seconds: 60,
    });
    expect(set.metrics.filler_core_count).toBe(2);
    expect(set.metrics.filler_per_minute).toBe(2);
    expect(set.metrics.i_count).toBe(1);
    expect(set.metrics.we_count).toBe(2);
    expect(set.metrics.quantified_span_count).toBe(1);
    expect(set.metrics.word_count).toBeGreaterThan(0);
    expect(set.metrics.sentence_count).toBe(set.sentences.length);
  });

  it("stamps producer, schema version, and transcript hash", () => {
    const set = observe({ transcript: "I fixed it." });
    expect(set.schema_version).toBe("1.0");
    expect(set.producer.module).toBe("observation-engine");
    expect(set.transcript_sha256).toMatch(/^[a-f0-9]{64}$/);
  });
});
