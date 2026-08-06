import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { generateOpportunities } from "../src/engine";
import { REGISTRY } from "../src/registry";
import { InObservation, ObservationSetInput } from "../src/types";

const span = (i = 0, s = 0, e = 4, t = "text") =>
  ({ sentence_index: i, char_start: s, char_end: e, span_text: t });
const obs = (type: string, value: number | boolean, conf = 0.8, spans = [span()]): InObservation =>
  ({ observation_type: type, value, evidence: spans, confidence: conf, confidence_basis: "fixture" });

/** A busy answer: long, unstructured, we-heavy, unquantified, hedged close, filler-dense, negative. */
const busySet = (): ObservationSetInput => ({
  schema_version: "1.0",
  sentences: [{ index: 0, text: "x", char_start: 0, char_end: 1, word_count: 1 }],
  observations: [
    obs("trailing_off", true, 0.8),
    obs("closing_hedge", true, 0.85, [span(0, 0, 7, "So yeah")]),
    obs("first_person_plural", 6, 0.95),
    obs("filler_core", 12, 0.95),
    obs("employer_negativity", 1, 0.6, [span(0, 0, 5, "toxic")]),
    obs("hypothetical_marker", 3, 0.75),
  ],
  metrics: {
    word_count: 420, sentence_count: 9, duration_seconds: 180, duration_is_estimated: false,
    filler_core_count: 12, filler_soft_count: 0, filler_per_minute: 4, hedge_marker_count: 0,
    i_count: 1, we_count: 6, agency_verb_i_count: 0, presence_verb_i_count: 0,
    quantified_span_count: 0, numeric_span_count: 0, hypothetical_marker_count: 3,
  },
});

describe("CONTRACT: exact field set — nothing else", () => {
  it("every candidate has exactly id + the seven mandated fields", () => {
    for (const c of generateOpportunities({ observation_set: busySet() })) {
      expect(Object.keys(c).sort()).toEqual([
        "confidence", "dependencies", "evidence", "growth_potential",
        "mission_alignment", "opportunity_id", "readiness", "related_habits",
      ]);
      expect(Object.keys(c.dependencies).sort()).toEqual(
        ["habit_prerequisites", "upstream_candidates_cofired"]);
      expect(Object.keys(c.readiness)).toEqual(["allowed_states"]);
    }
  });
  it("payload contains no prioritization or coaching vocabulary", () => {
    const json = JSON.stringify(generateOpportunities({ observation_set: busySet() })).toLowerCase();
    for (const banned of ["priority", "rank", "severity", "selected", "score",
      "you should", "recommend", "coach", "improve your"]) {
      expect(json).not.toContain(banned);
    }
  });
});

describe("CONTRACT: no prioritization", () => {
  it("output order is registry order, never confidence order", () => {
    const out = generateOpportunities({ observation_set: busySet() });
    const registryOrder = REGISTRY.map((r) => r.opportunity_id);
    const outOrder = out.map((c) => c.opportunity_id);
    expect(outOrder).toEqual(registryOrder.filter((id) => outOrder.includes(id)));
    // and confidences are demonstrably NOT sorted in this fixture
    const confs = out.map((c) => c.confidence);
    const sorted = [...confs].sort((a, b) => b - a);
    expect(confs).not.toEqual(sorted);
  });
  it("emits ALL fired candidates — no selection, no suppression", () => {
    const idsOut = generateOpportunities({ observation_set: busySet() }).map((c) => c.opportunity_id);
    // structure problem AND delivery-polish candidates coexist; suppression is downstream
    expect(idsOut).toContain("O2_structureless_ramble");
    expect(idsOut).toContain("O7_weak_close");
    expect(idsOut).toContain("O4_ownership_hiding");
    expect(idsOut).toContain("O5_vagueness");
    expect(idsOut).toContain("O11_employer_negativity");
    expect(idsOut.length).toBeGreaterThanOrEqual(5);
  });
});

describe("mission alignment", () => {
  it("no context mission → no_mission; otherwise aligned/unaligned by habit membership", () => {
    const none = generateOpportunities({ observation_set: busySet() });
    expect(new Set(none.map((c) => c.mission_alignment))).toEqual(new Set(["no_mission"]));

    const withMission = generateOpportunities({
      observation_set: busySet(), context: { mission_habit_id: "H2" },
    });
    const o2 = withMission.find((c) => c.opportunity_id === "O2_structureless_ramble")!;
    const o7 = withMission.find((c) => c.opportunity_id === "O7_weak_close")!;
    expect(o2.mission_alignment).toBe("aligned");
    expect(o7.mission_alignment).toBe("unaligned");
  });
});

describe("dependencies", () => {
  it("carries habit DAG prerequisites and co-fired upstream candidates", () => {
    const out = generateOpportunities({ observation_set: busySet() });
    const weakClose = out.find((c) => c.opportunity_id === "O7_weak_close")!;
    // H9 ← H2, H8 (and transitively H1)
    expect(weakClose.dependencies.habit_prerequisites).toEqual(["H1", "H2", "H8"]);
    // the ramble (H2) fired this turn → upstream co-fired for the close
    expect(weakClose.dependencies.upstream_candidates_cofired)
      .toContain("O2_structureless_ramble");
    // root-ish candidates have no upstream co-fired
    const ramble = out.find((c) => c.opportunity_id === "O2_structureless_ramble")!;
    expect(ramble.dependencies.upstream_candidates_cofired).toEqual([]);
  });
});

describe("determinism & validation", () => {
  it("same input → deep-equal output", () => {
    expect(generateOpportunities({ observation_set: busySet() }))
      .toEqual(generateOpportunities({ observation_set: busySet() }));
  });
  it("rejects invalid input with the shared error taxonomy", () => {
    try {
      // @ts-expect-error deliberate bad input
      generateOpportunities({ observation_set: null });
      expect.unreachable("should have thrown");
    } catch (e: any) {
      expect(e.code).toBe("INPUT_INVALID");
      expect(e.retryable).toBe(false);
    }
  });
  it("clean strong answers produce zero candidates", () => {
    const clean: ObservationSetInput = {
      ...busySet(),
      observations: [
        obs("structure_result_marker", 1, 0.5),
        obs("agency_verb_i", 2, 0.7),
      ],
      metrics: {
        ...busySet().metrics,
        word_count: 120, i_count: 5, we_count: 2, agency_verb_i_count: 2,
        quantified_span_count: 2, filler_per_minute: 1, hypothetical_marker_count: 0,
      },
    };
    expect(generateOpportunities({ observation_set: clean })).toEqual([]);
  });
});

// ---------- live pipeline compatibility (runs when sibling package present) ----------
const SIBLING_PATH = new URL("../../observation-engine/src/index.ts", import.meta.url).pathname;
describe.skipIf(!existsSync(SIBLING_PATH))(
  "PIPELINE: observation-engine output feeds directly in", () => {
  it("observe() → generateOpportunities() with no adaptation layer", async () => {
    const { observe } = await import("../../observation-engine/src/index");
    const transcript =
      "Um, so we had this whole situation with the second op and we kept running parts and " +
      "we tried a bunch of different things and we talked to the team about it and we went " +
      "back and forth for a while and we eventually got it sorted out after we changed some " +
      "things around and we were all pretty happy with how it turned out because we felt like " +
      "we had really gotten somewhere with it and we kept it running like that and, um, we " +
      "showed the other shift how we did it and we moved on to the next job and things were " +
      "better after that and we didn't have the same problem again and everyone was glad and " +
      "we sort of made it part of how we did the changeovers going forward and yeah we just " +
      "kept doing it that way and it stayed fixed for a long time and we never really had to " +
      "go back to it again after that whole stretch and, you know, we were relieved. So yeah";
    const set = observe({ transcript, duration_seconds: 95 });
    const out = generateOpportunities({ observation_set: set, context: { question_type: "behavioral" } });
    const idsOut = out.map((c) => c.opportunity_id);
    expect(idsOut).toContain("O4_ownership_hiding");
    expect(idsOut).toContain("O7_weak_close");
    expect(idsOut).toContain("O5_vagueness");
    // every span the candidates cite is verbatim from the transcript
    for (const c of out) for (const ev of c.evidence.spans) {
      expect(transcript.slice(ev.char_start, ev.char_end)).toBe(ev.span_text);
    }
  });
});

describe("dependencies — antisymmetry guard", () => {
  it("mutual prerequisite edges cancel (O3_missing ↔ O5 must not demote each other)", () => {
    const s = busySet(); // fires both O3_missing (H2,H5) and O5 (H4)
    const out = generateOpportunities({ observation_set: s });
    const o3 = out.find((c) => c.opportunity_id === "O3_missing_result")!;
    const o5 = out.find((c) => c.opportunity_id === "O5_vagueness")!;
    expect(o3.dependencies.upstream_candidates_cofired).not.toContain("O5_vagueness");
    expect(o5.dependencies.upstream_candidates_cofired).not.toContain("O3_missing_result");
    // strict upstream edges survive: O7 (H9) still cites O2 (H2)
    const o7 = out.find((c) => c.opportunity_id === "O7_weak_close")!;
    expect(o7.dependencies.upstream_candidates_cofired).toContain("O2_structureless_ramble");
  });
});
