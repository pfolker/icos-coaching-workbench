import { describe, it, expect } from "vitest";
import { decide } from "../src/engine";
import { CandidateOpportunity, DecisionInput, LearnerModel } from "../src/types";

// ---------- candidate fixture builder (mirrors opportunity-engine output) ----------
const cand = (
  id: string, habits: string[], over: Partial<CandidateOpportunity> = {}
): CandidateOpportunity => ({
  opportunity_id: id,
  related_habits: habits,
  evidence: { spans: [], observation_types_cited: [], metrics_cited: [], absent_signals: [] },
  confidence: 0.7,
  growth_potential: "high",
  mission_alignment: "no_mission",
  dependencies: { habit_prerequisites: [], upstream_candidates_cofired: [] },
  readiness: { allowed_states: ["flowing", "struggling", "disengaging"] },
  ...over,
});

const O2 = () => cand("O2_structureless_ramble", ["H2"]);
const O7 = (over: Partial<CandidateOpportunity> = {}) =>
  cand("O7_weak_close", ["H9"], {
    growth_potential: "low",
    dependencies: { habit_prerequisites: ["H1", "H2", "H8"],
      upstream_candidates_cofired: ["O2_structureless_ramble"] },
    ...over,
  });
const O3U = (over: Partial<CandidateOpportunity> = {}) =>
  cand("O3_unquantified_result", ["H5"], {
    dependencies: { habit_prerequisites: ["H1", "H2", "H4"], upstream_candidates_cofired: [] },
    ...over,
  });
const O10 = () => cand("O10_filler_density", ["H10"], {
  growth_potential: "low",
  readiness: { allowed_states: ["flowing"] },
  dependencies: { habit_prerequisites: ["H1", "H2", "H7"], upstream_candidates_cofired: [] },
});

const model = (habits: LearnerModel["habits"]): LearnerModel => ({ habits });
const run = (i: Partial<DecisionInput>) =>
  decide({ candidates: [], coaching_state: "flowing", ...i });

// ---------- JA-01: root-cause override ----------
describe("JA-01 root-cause override", () => {
  it("selects the cause; rejects co-fired symptoms with the override rule", () => {
    const d = run({ candidates: [O2(), O7()] });
    expect(d.decision_type).toBe("coach_one");
    expect(d.selected!.opportunity.opportunity_id).toBe("O2_structureless_ramble");
    expect(d.selected!.priority_class).toBe("root_cause");
    const rej = d.reasoning.rejected.find((r) => r.opportunity_id === "O7_weak_close")!;
    expect(rej.rejected_by_rule).toBe("root_cause_override");
    expect(rej.reason).toContain("O2_structureless_ramble");
    expect(d.reasoning.judgment_case_refs).toContain("JA-01");
  });
});

// ---------- JA-02 / JA-03: knowledge-check fork ----------
describe("JA-02/03 knowledge-check fork", () => {
  it("supply branch (I1) when habit never demonstrated", () => {
    const d = run({
      candidates: [O3U()],
      learner_model: model({ H5: { demonstrated: false, coached_count: 0, verdicts: [] } }),
    });
    expect(d.selected!.intervention_type).toBe("I1_direct_instruction");
    expect(d.reasoning.knowledge_check.branch).toBe("supply");
    expect(d.reasoning.judgment_case_refs).toContain("JA-02");
  });
  it("elicit branch (I3) when habit previously demonstrated", () => {
    const d = run({
      candidates: [O3U()],
      learner_model: model({ H5: { demonstrated: true, coached_count: 2, verdicts: ["achieved"] } }),
    });
    expect(d.selected!.intervention_type).toBe("I3_elicitation");
    expect(d.reasoning.judgment_case_refs).toContain("JA-03");
  });
  it("conservative supply default when learner model is absent", () => {
    const d = run({ candidates: [O3U()] });
    expect(d.selected!.intervention_type).toBe("I1_direct_instruction");
    expect(d.reasoning.knowledge_check.basis).toMatch(/conservative/);
  });
});

// ---------- JA-04: Pattern-C reframe escalation ----------
describe("JA-04 belief-blocker escalation", () => {
  it("selects I7 reframe on pattern_c_flag for a belief-blocked habit; never a third I1", () => {
    const o4 = cand("O4_ownership_hiding", ["H3"], {
      readiness: { allowed_states: ["flowing", "struggling"] },
    });
    const d = run({
      candidates: [o4],
      learner_model: model({ H3: {
        demonstrated: true, coached_count: 3,
        verdicts: ["achieved", "not_yet", "not_yet"], pattern_c_flag: true } }),
    });
    expect(d.selected!.intervention_type).toBe("I7_reframe");
    expect(d.reasoning.knowledge_check.pattern_c_applied).toBe(true);
    expect(d.reasoning.judgment_case_refs).toContain("JA-04");
  });
});

// ---------- JA-06: overload precedence ----------
describe("JA-06 disengaging → protect mode", () => {
  it("picks the gentlest winnable ask and records the precedence", () => {
    const d = run({ candidates: [O2(), O7(), O3U()], coaching_state: "disengaging" });
    expect(d.selected!.opportunity.opportunity_id).toBe("O7_weak_close"); // protect preference
    expect(d.selected!.priority_class).toBe("protect");
    expect(d.reasoning.state_gate).toBe("disengaging_protect");
    expect(d.reasoning.judgment_case_refs).toContain("JA-06");
  });
  it("state-gates flowing-only candidates out in struggling, with rejection reasons", () => {
    const d = run({ candidates: [O10(), O3U()], coaching_state: "struggling" });
    expect(d.selected!.opportunity.opportunity_id).toBe("O3_unquantified_result");
    const rej = d.reasoning.rejected.find((r) => r.opportunity_id === "O10_filler_density")!;
    expect(rej.rejected_by_rule).toBe("state_gate");
    expect(d.reasoning.state_gate).toBe("struggling_soften");
  });
});

// ---------- JA-07: mission fallback ----------
describe("JA-07 mission handling", () => {
  it("prefers mission-aligned candidates when present", () => {
    const aligned = O3U({ mission_alignment: "aligned" });
    const other = cand("O5_vagueness", ["H4"], { mission_alignment: "unaligned" });
    const d = run({ candidates: [other, aligned], mission: { habit_id: "H5" } });
    expect(d.selected!.opportunity.opportunity_id).toBe("O3_unquantified_result");
    expect(d.reasoning.mission_handling).toBe("aligned_selected");
  });
  it("falls back without fabricating relevance when nothing serves the mission", () => {
    const d = run({
      candidates: [cand("O5_vagueness", ["H4"], { mission_alignment: "unaligned" })],
      mission: { habit_id: "H5" },
    });
    expect(d.selected!.opportunity.opportunity_id).toBe("O5_vagueness");
    expect(d.reasoning.mission_handling).toBe("mission_fallback");
    expect(d.reasoning.judgment_case_refs).toContain("JA-07");
  });
});

// ---------- reinforce-only ----------
describe("reinforce-only", () => {
  it("empty candidate set → explicit reinforce_only decision, never a forced pick", () => {
    const d = run({ candidates: [] });
    expect(d.decision_type).toBe("reinforce_only");
    expect(d.selected).toBeNull();
    expect(d.reasoning.judgment_case_refs).toContain("JA-05");
  });
});

// ---------- contract invariants ----------
describe("CONTRACT invariants", () => {
  const busy = () => [O2(), O7(), O3U(), O10()];
  it("selects exactly one; selected + rejected account for EVERY candidate", () => {
    const d = run({ candidates: busy() });
    expect(d.decision_type).toBe("coach_one");
    const all = busy().map((c) => c.opportunity_id).sort();
    const accounted = [
      d.selected!.opportunity.opportunity_id,
      ...d.reasoning.rejected.map((r) => r.opportunity_id),
    ].sort();
    expect(accounted).toEqual(all);
  });
  it("evidence passes through untouched", () => {
    const marked = O3U({ evidence: { marker: "UNTOUCHED-7743" } as unknown as CandidateOpportunity["evidence"] });
    const d = run({ candidates: [marked] });
    expect((d.selected!.opportunity.evidence as { marker: string }).marker).toBe("UNTOUCHED-7743");
  });
  it("emits no coaching copy or learner-facing language", () => {
    const json = JSON.stringify(run({ candidates: busy() })).toLowerCase();
    for (const banned of ["you should", "try to", "your answer", "next time", "great job", "improve your"]) {
      expect(json).not.toContain(banned);
    }
  });
  it("is deterministic", () => {
    expect(run({ candidates: busy() })).toEqual(run({ candidates: busy() }));
  });
  it("rejects invalid input with the shared error taxonomy", () => {
    try {
      decide({ candidates: [O2()], coaching_state: "panicking" as never });
      expect.unreachable("should have thrown");
    } catch (e: unknown) {
      expect((e as { code: string }).code).toBe("INPUT_INVALID");
    }
  });
});
