import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, rmSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createSession, submitAnswer } from "../server/orchestrator";
import { isShadowModeEnabled, buildShadowModeCaseResult, SHADOW_LOG_DIR } from "../server/shadowMode";
import { ShadowCompareResult } from "../../evidence-shadow-compare/src/pipeline";

const here = dirname(fileURLToPath(import.meta.url));

const ANSWER =
  "The second op had a scrap problem and the castings kept warping. " +
  "So I fixed it, and as a result things eventually got under control and everyone was glad. So yeah";

const ENV_KEYS = ["ALPHA_WORKBENCH_SHADOW_MODE", "ANTHROPIC_API_KEY"] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  if (existsSync(SHADOW_LOG_DIR)) rmSync(SHADOW_LOG_DIR, { recursive: true, force: true });
});

describe("Shadow-mode integration — HARD BOUNDARY: rendered output must be byte-identical regardless of the flag", () => {
  it("isShadowModeEnabled() is false by default (Phase 1: deliberate internal test submissions only, never automatic)", () => {
    delete process.env.ALPHA_WORKBENCH_SHADOW_MODE;
    expect(isShadowModeEnabled()).toBe(false);
  });

  it("submitAnswer()'s returned {session, debug} is BYTE-IDENTICAL whether the shadow-mode flag is on or off", () => {
    // No live API key in this test process (deleted below) — this suite
    // never makes a live call, matching every other test file in this
    // project. Shadow mode's own no-key path is exercised and confirmed
    // safe (no throw, no mutation) without any network dependency.
    delete process.env.ANTHROPIC_API_KEY;

    delete process.env.ALPHA_WORKBENCH_SHADOW_MODE;
    const sOff = createSession();
    const resultOff = submitAnswer(sOff.id, ANSWER, 45);

    process.env.ALPHA_WORKBENCH_SHADOW_MODE = "true";
    const sOn = createSession();
    const resultOn = submitAnswer(sOn.id, ANSWER, 45);

    // session ids differ (createSession() mints a fresh random id); strip
    // those before comparing everything else byte-for-byte.
    const strip = (r: typeof resultOff) => {
      const clone = JSON.parse(JSON.stringify(r));
      delete clone.session.id;
      delete clone.debug.events; // event log carries session-scoped ids/timestamps only
      return clone;
    };
    expect(strip(resultOn)).toEqual(strip(resultOff));

    // specifically confirm the learner-facing surfaces this task's hard
    // boundary names explicitly:
    expect(resultOn.session.quick_scan).toEqual(resultOff.session.quick_scan);
    expect(resultOn.session.move).toEqual(resultOff.session.move);
    expect(resultOn.debug.selected).toEqual(resultOff.debug.selected);
    expect(resultOn.debug.decision_reasoning).toEqual(resultOff.debug.decision_reasoning);
  });

  it("shadow mode enabled + no API key: no log file is written, no throw, real response still returned synchronously", () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.ALPHA_WORKBENCH_SHADOW_MODE = "true";
    const s = createSession();
    expect(() => submitAnswer(s.id, ANSWER, 45)).not.toThrow();
    // the fire-and-forget task's no-key branch returns synchronously
    // before any file I/O — confirmed by checking immediately, not after
    // a delay (there is nothing async left to wait for on this path).
    expect(existsSync(SHADOW_LOG_DIR)).toBe(false);
  });

  it("submitAnswer() never awaits the shadow pass: returns before any async work could complete, even in principle", () => {
    // Cannot force a live call in this offline suite, but we CAN prove the
    // call site itself is fire-and-forget by construction: submitAnswer is
    // a synchronous function (no `async`, no returned Promise) whose
    // return value does not depend on shadowMode.ts's exported Promise at
    // all — confirmed structurally, not just by timing.
    const src = readFileSync(join(here, "../server/orchestrator.ts"), "utf8");
    expect(src).toMatch(/runShadowPass\([^)]*\)\.catch\(/);
    expect(src).not.toMatch(/await runShadowPass/);
  });
});

describe("buildShadowModeCaseResult — pure function, unit-tested against constructed ShadowCompareResult shapes", () => {
  function fakeResult(overrides: Partial<ShadowCompareResult>): ShadowCompareResult {
    const base: ShadowCompareResult = {
      transcript: "example transcript",
      mode: "live",
      left: {
        candidates: [{ opportunity_id: "O5_vagueness" } as any],
        decision: {
          decision_type: "coach_one",
          selected: { opportunity: { opportunity_id: "O5_vagueness" } as any, intervention_type: "I1_direct_instruction", priority_class: "standard" },
          reasoning: { explanation: ["regex picked O5_vagueness"] } as any,
        } as any,
        ladder_conflicts_resolved: [],
        quick_scan: {},
      },
      right: {
        evidence_graph: { nodes: [], edges: [], non_admissible: [] },
        adapter_candidates: [{
          opportunity_id: "O3_unquantified_result",
          evidence: { spans: [{ sentence_index: -1, char_start: -1, char_end: -1, span_text: "we eliminated the issue completely" }] },
        } as any],
        adapter_candidates_deduped: [],
        merged_candidates: [
          { opportunity_id: "O5_vagueness" } as any,
          { opportunity_id: "O3_unquantified_result" } as any,
        ],
        candidate_suppressions: [],
        final_candidates: [
          { opportunity_id: "O5_vagueness" } as any,
          { opportunity_id: "O3_unquantified_result" } as any,
        ],
        decision: {
          decision_type: "coach_one",
          selected: { opportunity: { opportunity_id: "O3_unquantified_result" } as any, intervention_type: "I1_direct_instruction", priority_class: "standard" },
          reasoning: {
            explanation: ["intervention fork on H5: supply → I1_direct_instruction"],
            rejected: [{ opportunity_id: "O5_vagueness", rejected_by_rule: "one_insight_rule", reason: "one coaching moment per turn; outranked in tiebreak" }],
          } as any,
        } as any,
        ladder_conflicts_resolved: [],
        quick_scan: {},
      },
      unmapped_opportunity_ids: [],
    };
    return { ...base, ...overrides };
  }

  it("agree=true when both sides select the same opportunity_id (including both reinforce_only, i.e. both null)", () => {
    const r = fakeResult({
      right: {
        ...fakeResult({}).right,
        decision: { decision_type: "coach_one", selected: { opportunity: { opportunity_id: "O5_vagueness" } as any, intervention_type: "I1_direct_instruction", priority_class: "standard" }, reasoning: { explanation: [] } as any } as any,
      },
    });
    const cr = buildShadowModeCaseResult("case_a", r);
    expect(cr.metrics.agree).toBe(true);
    expect(cr.metrics.divergence).toBeNull();
    expect(cr.metrics.final_recommendation).toEqual({ source: "agree", reason: "both sides selected O5_vagueness" });
  });

  it("agree=false: divergence carries decide()'s REAL explanation AND the specific rejected-reason for the diverging id, verbatim — not a re-derived guess", () => {
    const r = fakeResult({});
    const cr = buildShadowModeCaseResult("case_b", r);
    expect(cr.metrics.agree).toBe(false);
    expect(cr.metrics.regex_selected_id).toBe("O5_vagueness");
    expect(cr.metrics.evidence_selected_id).toBe("O3_unquantified_result");
    expect(cr.metrics.divergence).toEqual({
      regex_only_ids: ["O5_vagueness"],
      evidence_only_ids: ["O3_unquantified_result"],
      reason: "intervention fork on H5: supply → I1_direct_instruction; " +
        "O5_vagueness rejected by one_insight_rule (one coaching moment per turn; outranked in tiebreak)",
    });
    expect(cr.metrics.supporting_evidence).toEqual(["we eliminated the issue completely"]);
    expect(cr.metrics.final_recommendation.source).toBe("evidence");
  });

  it("final_recommendation is 'uncertain', NOT 'evidence', when regex's winning pick is unrelated to the O3 ladder (real checkout-outage shape: a root_cause escalation from an unmapped id like O4_ownership_hiding) — evidence picks O3_unquantified_result but that's not mechanically enough to recommend it", () => {
    const r = fakeResult({
      left: {
        ...fakeResult({}).left,
        decision: {
          decision_type: "coach_one",
          selected: { opportunity: { opportunity_id: "O4_ownership_hiding" } as any, intervention_type: "I1_direct_instruction", priority_class: "root_cause" },
          reasoning: { explanation: ["root-cause override"], rejected: [] } as any,
        } as any,
      },
    });
    const cr = buildShadowModeCaseResult("case_uncertain", r);
    expect(cr.metrics.regex_selected_id).toBe("O4_ownership_hiding");
    expect(cr.metrics.evidence_selected_id).toBe("O3_unquantified_result");
    expect(cr.metrics.agree).toBe(false);
    expect(cr.metrics.final_recommendation.source).toBe("uncertain");
    expect(cr.metrics.final_recommendation.reason).toContain("Decision-Engine-level question");
  });

  it("both sides reinforce_only counts as agreement (null === null), not a false divergence", () => {
    const r = fakeResult({
      left: { ...fakeResult({}).left, decision: { decision_type: "reinforce_only", selected: null, reasoning: { explanation: [] } as any } as any },
      right: { ...fakeResult({}).right, decision: { decision_type: "reinforce_only", selected: null, reasoning: { explanation: [] } as any } as any },
    });
    const cr = buildShadowModeCaseResult("case_c", r);
    expect(cr.metrics.regex_selected_id).toBeNull();
    expect(cr.metrics.evidence_selected_id).toBeNull();
    expect(cr.metrics.agree).toBe(true);
  });

  it("transcript_hash is deterministic for the same transcript and differs for different ones", () => {
    const a = buildShadowModeCaseResult("x", fakeResult({ transcript: "same text" }));
    const b = buildShadowModeCaseResult("y", fakeResult({ transcript: "same text" }));
    const c = buildShadowModeCaseResult("z", fakeResult({ transcript: "different text" }));
    expect(a.metrics.transcript_hash).toBe(b.metrics.transcript_hash);
    expect(a.metrics.transcript_hash).not.toBe(c.metrics.transcript_hash);
  });

  it("REAL FINDING (validation corpus): agree=true can hide a genuine O3-ladder divergence — regex_o3_pick/candidate_level_agreement surface it even when the final selection matches", () => {
    // reproduces the real atlas_005/atlas_009/checkout_outage shape: regex
    // picks O3_missing_result (promoted to root_cause via O4_ownership_hiding
    // co-firing), the adapter independently found a real unquantified
    // outcome (O3_unquantified_result) — but O4's root_cause override wins
    // on BOTH sides regardless, so the FINAL selection agrees even though
    // the underlying O3 candidate pools do not.
    const r = fakeResult({
      left: {
        ...fakeResult({}).left,
        candidates: [
          { opportunity_id: "O3_missing_result" } as any,
          { opportunity_id: "O4_ownership_hiding" } as any,
        ],
        decision: {
          decision_type: "coach_one",
          selected: { opportunity: { opportunity_id: "O3_missing_result" } as any, intervention_type: "I1_direct_instruction", priority_class: "root_cause" },
          reasoning: { explanation: [], rejected: [] } as any,
        } as any,
      },
      right: {
        ...fakeResult({}).right,
        decision: {
          decision_type: "coach_one",
          selected: { opportunity: { opportunity_id: "O3_missing_result" } as any, intervention_type: "I1_direct_instruction", priority_class: "root_cause" },
          reasoning: { explanation: [], rejected: [] } as any,
        } as any,
      },
    });
    const cr = buildShadowModeCaseResult("case_masked", r);
    expect(cr.metrics.agree).toBe(true); // final selections match
    expect(cr.metrics.regex_o3_pick).toBe("O3_missing_result");
    expect(cr.metrics.candidate_level_agreement).toBe(false); // but the underlying pools genuinely disagree
  });

  it("REAL FINDING (validation corpus): the adapter's silence cannot correct a regex false-positive O3_missing_result when the outcome IS already quantified — candidate_level_agreement surfaces this too", () => {
    // reproduces the real new_sales_retention shape: regex's own
    // detectMissingResult fired purely on marker-phrase absence (it never
    // checks quantified_span_count at all — confirmed by reading
    // opportunity-engine/src/detectors.ts), even though a real, quantified
    // outcome exists. The adapter correctly finds the outcome IS
    // quantity-bound and returns NO candidate (silence, not a positive
    // "confirmed measurable" assertion — that state doesn't exist in the
    // O3 ladder) — so nothing in the merged pool challenges regex's wrong
    // claim, and agree=true masks this too.
    const r = fakeResult({
      left: {
        ...fakeResult({}).left,
        candidates: [{ opportunity_id: "O3_missing_result" } as any],
        decision: {
          decision_type: "coach_one",
          selected: { opportunity: { opportunity_id: "O3_missing_result" } as any, intervention_type: "I1_direct_instruction", priority_class: "standard" },
          reasoning: { explanation: [], rejected: [] } as any,
        } as any,
      },
      right: {
        ...fakeResult({}).right,
        adapter_candidates: [], // the ladder resolved cleanly: quantified, nothing to assert
        merged_candidates: [{ opportunity_id: "O3_missing_result" } as any],
        decision: {
          decision_type: "coach_one",
          selected: { opportunity: { opportunity_id: "O3_missing_result" } as any, intervention_type: "I1_direct_instruction", priority_class: "standard" },
          reasoning: { explanation: [], rejected: [] } as any,
        } as any,
      },
    });
    const cr = buildShadowModeCaseResult("case_silent_miss", r);
    expect(cr.metrics.agree).toBe(true);
    expect(cr.metrics.regex_o3_pick).toBe("O3_missing_result");
    expect(cr.metrics.evidence_candidate_ids).toEqual([]);
    expect(cr.metrics.candidate_level_agreement).toBe(false); // null (adapter silent) !== "O3_missing_result"
  });

  it("MILESTONE 3: candidate_suppressions flows through from ShadowCompareResult.right.candidate_suppressions verbatim", () => {
    const r = fakeResult({
      right: {
        ...fakeResult({}).right,
        candidate_suppressions: [
          { opportunity_id: "O5_vagueness", rule_name: "O5 specificity suppression", reasoning: "5 specificity claims, 2 edges" },
        ],
      },
    });
    const cr = buildShadowModeCaseResult("case_suppressed", r);
    expect(cr.metrics.candidate_suppressions).toEqual([
      { opportunity_id: "O5_vagueness", rule_name: "O5 specificity suppression" },
    ]);
  });
});
