import { describe, it, expect } from "vitest";
import { generateOpportunities } from "../src/engine";
import { InObservation, ObservationSetInput, OpportunityContext } from "../src/types";

// ---------- fixture builder ----------
const span = (i = 0, s = 0, e = 4, text = "text") =>
  ({ sentence_index: i, char_start: s, char_end: e, span_text: text });

const obs = (type: string, value: number | boolean, conf = 0.8, spans = [span()]): InObservation =>
  ({ observation_type: type, value, evidence: spans, confidence: conf, confidence_basis: "fixture" });

const set = (over: Partial<ObservationSetInput["metrics"]> = {}, observations: InObservation[] = []):
  ObservationSetInput => ({
  schema_version: "1.0",
  sentences: [{ index: 0, text: "x", char_start: 0, char_end: 1, word_count: 1 }],
  observations,
  metrics: {
    word_count: 100, sentence_count: 5, duration_seconds: 60, duration_is_estimated: false,
    filler_core_count: 0, filler_soft_count: 0, filler_per_minute: 0, hedge_marker_count: 0,
    i_count: 3, we_count: 1, agency_verb_i_count: 1, presence_verb_i_count: 0,
    quantified_span_count: 1, numeric_span_count: 0, hypothetical_marker_count: 0,
    ...over,
  },
});

const run = (s: ObservationSetInput, context?: OpportunityContext) =>
  generateOpportunities({ observation_set: s, context });

const ids = (s: ObservationSetInput, context?: OpportunityContext) =>
  run(s, context).map((c) => c.opportunity_id);

// ---------- O2 ----------
describe("O2 structureless ramble", () => {
  it("fires on long answers with <2 structure marker types", () => {
    const s = set({ word_count: 400 }, [obs("trailing_off", true, 0.8)]);
    const c = run(s).find((x) => x.opportunity_id === "O2_structureless_ramble")!;
    expect(c).toBeDefined();
    expect(c.related_habits).toEqual(["H2"]);
    expect(c.evidence.absent_signals.length).toBe(4);
    expect(c.evidence.metrics_cited[0]).toMatchObject({ metric: "word_count", value: 400 });
  });
  it("does not fire on short answers or structured long answers", () => {
    expect(ids(set({ word_count: 120 }))).not.toContain("O2_structureless_ramble");
    const structured = set({ word_count: 400 }, [
      obs("structure_action_marker", 1, 0.5), obs("structure_result_marker", 1, 0.5),
    ]);
    expect(ids(structured)).not.toContain("O2_structureless_ramble");
  });
});

// ---------- O3 variants ----------
describe("O3 result opportunities", () => {
  it("missing_result fires when no result signals exist; capped at 0.5", () => {
    const c = run(set({ quantified_span_count: 0 })).find((x) => x.opportunity_id === "O3_missing_result")!;
    expect(c.confidence).toBeLessThanOrEqual(0.5);
    expect(c.evidence.absent_signals).toContain("structure_result_marker");
    expect(c.related_habits).toEqual(["H2", "H5"]);
  });
  it("unquantified_result fires when result language exists but no metrics", () => {
    const s = set({ quantified_span_count: 0 }, [obs("structure_result_marker", 1, 0.5)]);
    const got = ids(s);
    expect(got).toContain("O3_unquantified_result");
    expect(got).not.toContain("O3_missing_result"); // mutually exclusive variants
  });
  it("neither fires on a quantified result", () => {
    const s = set({ quantified_span_count: 2 }, [obs("structure_result_marker", 1, 0.5)]);
    const got = ids(s);
    expect(got).not.toContain("O3_missing_result");
    expect(got).not.toContain("O3_unquantified_result");
  });
});

// ---------- O4 ----------
describe("O4 ownership hiding", () => {
  const hiding = set({ we_count: 6, i_count: 1, agency_verb_i_count: 0 },
    [obs("first_person_plural", 6, 0.95)]);
  it("fires on we-heavy, agency-free answers with metric evidence", () => {
    const c = run(hiding).find((x) => x.opportunity_id === "O4_ownership_hiding")!;
    expect(c.evidence.metrics_cited.map((m) => m.metric)).toContain("we_count");
    expect(c.evidence.absent_signals).toContain("agency_verb_i");
  });
  it("does not fire when agency verbs exist or I-ratio is healthy", () => {
    expect(ids(set({ we_count: 6, i_count: 1, agency_verb_i_count: 2 })))
      .not.toContain("O4_ownership_hiding");
    expect(ids(set({ we_count: 4, i_count: 5, agency_verb_i_count: 0 })))
      .not.toContain("O4_ownership_hiding");
  });
});

// ---------- O5 ----------
describe("O5 vagueness", () => {
  it("fires on substantial answers with zero quantification; boosted by hypotheticals on behavioral", () => {
    const base = set({ quantified_span_count: 0, numeric_span_count: 0, word_count: 150 });
    const c1 = run(base).find((x) => x.opportunity_id === "O5_vagueness")!;
    const withHyp = set(
      { quantified_span_count: 0, numeric_span_count: 0, word_count: 150, hypothetical_marker_count: 3 },
      [obs("hypothetical_marker", 3, 0.75)]);
    const c2 = run(withHyp, { question_type: "behavioral" })
      .find((x) => x.opportunity_id === "O5_vagueness")!;
    expect(c2.confidence).toBeGreaterThan(c1.confidence);
  });
  it("does not fire on short or quantified answers", () => {
    expect(ids(set({ word_count: 40, quantified_span_count: 0 }))).not.toContain("O5_vagueness");
    expect(ids(set({ quantified_span_count: 2 }))).not.toContain("O5_vagueness");
  });
});

// ---------- O7 ----------
describe("O7 weak close", () => {
  it("fires from closing_hedge with confidence derived from the observation", () => {
    const s = set({}, [obs("closing_hedge", true, 0.85, [span(0, 10, 17, "So yeah")])]);
    const c = run(s).find((x) => x.opportunity_id === "O7_weak_close")!;
    expect(c.confidence).toBeCloseTo(0.81, 2);
    expect(c.evidence.spans[0]!.span_text).toBe("So yeah");
  });
  it("does not fire without closing observations", () => {
    expect(ids(set())).not.toContain("O7_weak_close");
  });
});

// ---------- O8 (gated) ----------
describe("O8 buried lede — context-gated", () => {
  const opener = set({ word_count: 150 },
    [obs("structure_situation_marker", 1, 0.5, [span(0, 0, 11, "at the time")])]);
  it("fires ONLY with opinion/motivation question context", () => {
    expect(ids(opener)).not.toContain("O8_buried_lede");                       // no context
    expect(ids(opener, { question_type: "behavioral" })).not.toContain("O8_buried_lede");
    expect(ids(opener, { question_type: "opinion" })).toContain("O8_buried_lede");
  });
  it("requires the situation marker to be in sentence 0", () => {
    const late = set({ word_count: 150 },
      [obs("structure_situation_marker", 1, 0.5, [span(3, 40, 51, "at the time")])]);
    expect(ids(late, { question_type: "opinion" })).not.toContain("O8_buried_lede");
  });
});

// ---------- O10 ----------
describe("O10 filler density", () => {
  it("fires above threshold; confidence penalized when duration was estimated", () => {
    const measured = set({ filler_per_minute: 9, filler_core_count: 9 }, [obs("filler_core", 9, 0.95)]);
    const estimated = set(
      { filler_per_minute: 9, filler_core_count: 9, duration_is_estimated: true },
      [obs("filler_core", 9, 0.95)]);
    const cM = run(measured).find((x) => x.opportunity_id === "O10_filler_density")!;
    const cE = run(estimated).find((x) => x.opportunity_id === "O10_filler_density")!;
    expect(cM.confidence).toBeGreaterThan(cE.confidence);
    expect(cM.readiness.allowed_states).toEqual(["flowing"]); // KB: delivery polish gated to flowing
  });
  it("does not fire below threshold", () => {
    expect(ids(set({ filler_per_minute: 3 }))).not.toContain("O10_filler_density");
  });
});

// ---------- O11 ----------
describe("O11 employer negativity", () => {
  it("passes through the observation with its confidence and spans", () => {
    const s = set({}, [obs("employer_negativity", 1, 0.6, [span(2, 5, 16, "incompetent")])]);
    const c = run(s).find((x) => x.opportunity_id === "O11_employer_negativity")!;
    expect(c.confidence).toBe(0.6);
    expect(c.related_habits).toEqual(["H12"]);
    expect(c.evidence.spans[0]!.span_text).toBe("incompetent");
  });
});
