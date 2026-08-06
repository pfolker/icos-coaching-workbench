/**
 * V3.5 — pre-evaluation detector patch.
 * Work Item 1: O4_ownership_hiding zero-agency path (i_count===0 && we_count===0).
 * Work Item 2: O5_vagueness zero-specificity path (below the 60-word floor).
 * Both reuse Step 0's existing mechanism (ctx.question_type === "behavioral")
 * and add no new opportunity types, no engine changes, no Decision Engine changes.
 */
import { describe, it, expect } from "vitest";
import { generateOpportunities } from "../src/engine";
import { InObservation, ObservationSetInput, OpportunityContext } from "../src/types";
import { observe } from "../../observation-engine/src/index";
import { decide } from "../../decision-engine/src/index";

// ---------- fixture builder (mirrors detectors.test.ts's pattern) ----------
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

const BEHAVIORAL: OpportunityContext = { question_type: "behavioral" };

// The exact regression fixture from the coverage audit: 29 words, i_count: 0,
// we_count: 0, zero quantified/numeric spans, zero structure_action_marker,
// zero agency_verb_i — the most extreme case of both invisible ownership and
// zero specificity, and too short to trip either the old O4 (we_count>=3) or
// old O5 (word_count>=60) paths.
const REGRESSION_FIXTURE =
  "The second op had a scrap problem and the castings kept warping. " +
  "As a result it eventually got under control and things improved and everyone was glad. So yeah";

describe("V3.5 Work Item 1: O4_ownership_hiding zero-agency path", () => {
  it("[required 1a] the real regression fixture (29 words, i=0, we=0) fires O4 on a behavioral question", () => {
    const observed = observe({ transcript: REGRESSION_FIXTURE });
    expect(observed.metrics.i_count).toBe(0);
    expect(observed.metrics.we_count).toBe(0);
    const cands = generateOpportunities({ observation_set: observed, context: BEHAVIORAL });
    const c = cands.find((x) => x.opportunity_id === "O4_ownership_hiding");
    expect(c).toBeDefined();
    expect(c!.evidence.absent_signals).toEqual(
      expect.arrayContaining(["first_person_singular", "first_person_plural", "agency_verb_i"])
    );
  });

  it("[required 1b] a synthetic agentless behavioral answer above the floor fires O4", () => {
    const s = set({ word_count: 25, i_count: 0, we_count: 0, agency_verb_i_count: 0, quantified_span_count: 0 });
    expect(ids(s, BEHAVIORAL)).toContain("O4_ownership_hiding");
  });

  it("[required 2] clear I-statements never fire the zero-agency path", () => {
    const s = set({ word_count: 25, i_count: 4, we_count: 0, agency_verb_i_count: 1, quantified_span_count: 0 });
    expect(ids(s, BEHAVIORAL)).not.toContain("O4_ownership_hiding");
  });

  it("[required 3] the existing we-heavy path (we_count >= 3) is unchanged", () => {
    const hiding = set({ we_count: 6, i_count: 1, agency_verb_i_count: 0 },
      [obs("first_person_plural", 6, 0.95)]);
    const c = run(hiding).find((x) => x.opportunity_id === "O4_ownership_hiding")!;
    expect(c).toBeDefined();
    expect(c.confidence).toBeCloseTo(0.65, 2); // i_count=1 !== 0, so no +0.1 bump — identical to pre-patch behavior
    expect(c.evidence.metrics_cited.map((m) => m.metric)).toContain("we_count");
    // still correctly suppressed when agency verbs exist or the ratio is healthy (pre-existing behavior, untouched)
    expect(ids(set({ we_count: 6, i_count: 1, agency_verb_i_count: 2 }))).not.toContain("O4_ownership_hiding");
    expect(ids(set({ we_count: 4, i_count: 5, agency_verb_i_count: 0 }))).not.toContain("O4_ownership_hiding");
  });

  it("[required 4] a very short fragment below the documented floor (20 words) does not fire, even agentless", () => {
    const s = set({ word_count: 12, i_count: 0, we_count: 0, agency_verb_i_count: 0, quantified_span_count: 0 });
    expect(ids(s, BEHAVIORAL)).not.toContain("O4_ownership_hiding");
  });

  it("[required 5] a non-behavioral question never fires the zero-agency path, even fully agentless", () => {
    const s = set({ word_count: 25, i_count: 0, we_count: 0, agency_verb_i_count: 0, quantified_span_count: 0 });
    expect(ids(s, { question_type: "opinion" })).not.toContain("O4_ownership_hiding");
    expect(ids(s, { question_type: "motivation" })).not.toContain("O4_ownership_hiding");
    expect(ids(s, { question_type: "situational" })).not.toContain("O4_ownership_hiding");
    expect(ids(s)).not.toContain("O4_ownership_hiding"); // no context at all
  });
});

describe("V3.5 Work Item 2: O5_vagueness zero-specificity path (<60 words)", () => {
  it("[required 1a] the real regression fixture fires O5 on a behavioral question, independent of O4", () => {
    const observed = observe({ transcript: REGRESSION_FIXTURE });
    const cands = generateOpportunities({ observation_set: observed, context: BEHAVIORAL });
    const c = cands.find((x) => x.opportunity_id === "O5_vagueness");
    expect(c).toBeDefined();
    expect(c!.evidence.absent_signals).toEqual(
      expect.arrayContaining(["quantified_span", "numeric_span", "structure_action_marker", "agency_verb_i"])
    );
  });

  it("[required 1b] a short generic story with no specificity signals fires O5", () => {
    const s = set({
      word_count: 20, quantified_span_count: 0, numeric_span_count: 0,
      agency_verb_i_count: 0, i_count: 0, we_count: 2,
    });
    expect(ids(s, BEHAVIORAL)).toContain("O5_vagueness");
  });

  it("[required 2] a short answer with one concrete signal does not fire — one at a time", () => {
    const withAgencyVerb = set(
      { word_count: 20, quantified_span_count: 0, numeric_span_count: 0, agency_verb_i_count: 1 },
      [obs("agency_verb_i", 1, 0.7)]
    );
    expect(ids(withAgencyVerb, BEHAVIORAL)).not.toContain("O5_vagueness");

    const withActionMarker = set(
      { word_count: 20, quantified_span_count: 0, numeric_span_count: 0, agency_verb_i_count: 0 },
      [obs("structure_action_marker", 1, 0.5)]
    );
    expect(ids(withActionMarker, BEHAVIORAL)).not.toContain("O5_vagueness");

    const withNumber = set({ word_count: 20, quantified_span_count: 1, numeric_span_count: 0, agency_verb_i_count: 0 });
    expect(ids(withNumber, BEHAVIORAL)).not.toContain("O5_vagueness");
  });

  it("[required 3] existing >=60-word vagueness behavior is untouched (same case as the pre-existing suite)", () => {
    const base = set({ quantified_span_count: 0, numeric_span_count: 0, word_count: 150 });
    const c1 = run(base).find((x) => x.opportunity_id === "O5_vagueness")!;
    expect(c1).toBeDefined();
    expect(c1.confidence).toBeCloseTo(0.55, 2); // identical to pre-patch: no hypothetical boost, no behavioral boost
    const withHyp = set(
      { quantified_span_count: 0, numeric_span_count: 0, word_count: 150, hypothetical_marker_count: 3 },
      [obs("hypothetical_marker", 3, 0.75)]);
    const c2 = run(withHyp, BEHAVIORAL).find((x) => x.opportunity_id === "O5_vagueness")!;
    expect(c2.confidence).toBeGreaterThan(c1.confidence);
    // pre-existing "does not fire on short (40-word, above new floor but below old) or quantified answers"
    // is superseded in spirit by the new path below 60 words — re-asserted with an explicit floor case instead.
    expect(ids(set({ quantified_span_count: 2 }))).not.toContain("O5_vagueness");
  });

  it("[required 4] a one-sentence fragment below the documented floor (15 words) does not fire", () => {
    const s = set({ word_count: 10, quantified_span_count: 0, numeric_span_count: 0, agency_verb_i_count: 0 });
    expect(ids(s, BEHAVIORAL)).not.toContain("O5_vagueness");
  });

  it("[required 5] a strong, concise, specific answer does not fire, and never fires off-behavioral", () => {
    const strong = set({
      word_count: 18, quantified_span_count: 1, numeric_span_count: 0, agency_verb_i_count: 1,
    }, [obs("agency_verb_i", 1, 0.7)]);
    expect(ids(strong, BEHAVIORAL)).not.toContain("O5_vagueness");

    const genericButNotBehavioral = set({ word_count: 20, quantified_span_count: 0, numeric_span_count: 0, agency_verb_i_count: 0 });
    expect(ids(genericButNotBehavioral, { question_type: "opinion" })).not.toContain("O5_vagueness");
    expect(ids(genericButNotBehavioral)).not.toContain("O5_vagueness"); // no context
  });
});

describe("V3.5: the two new paths coexist and the unmodified Decision Engine handles the richer candidate set", () => {
  it("both O4 and O5 fire on the shared regression fixture; Decision Engine (untouched) still selects exactly one", () => {
    const observed = observe({ transcript: REGRESSION_FIXTURE });
    const cands = generateOpportunities({ observation_set: observed, context: BEHAVIORAL });
    const firedIds = cands.map((c) => c.opportunity_id);
    expect(firedIds).toContain("O4_ownership_hiding");
    expect(firedIds).toContain("O5_vagueness");
    expect(cands.length).toBeGreaterThanOrEqual(4); // O3_unquantified_result, O4, O5, O7 all present

    const decision = decide({ candidates: cands, coaching_state: "flowing" });
    expect(decision.decision_type).toBe("coach_one");
    expect(decision.selected).not.toBeNull();
    // every fired candidate is accounted for: either selected or rejected with a reason
    const accounted = [decision.selected!.opportunity.opportunity_id, ...decision.reasoning.rejected.map((r) => r.opportunity_id)].sort();
    expect(accounted).toEqual([...firedIds].sort());
    for (const r of decision.reasoning.rejected) {
      expect(r.rejected_by_rule.length).toBeGreaterThan(0);
      expect(r.reason.length).toBeGreaterThan(0);
    }
  });
});
