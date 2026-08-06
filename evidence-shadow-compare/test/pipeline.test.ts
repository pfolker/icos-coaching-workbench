import { describe, it, expect } from "vitest";
import { runShadowCompare } from "../src/pipeline";
import { KNOWN_CASES, findKnownCase } from "../src/knownCases";

describe("Shadow-compare pipeline — fixture mode (no live calls), all real numbers confirmed by direct script run first", () => {
  it("MILESTONE 3, THE FLAGSHIP FIX: LEFT still selects O5_vagueness (unmodified regex, unchanged); RIGHT now correctly flips to O3_unquantified_result — O5 is suppressed pre-decide(), so its root_cause priority can no longer override a merely-ADDED competing candidate the way it did in Milestones 1-2", async () => {
    const c = findKnownCase("founder")!;
    const r = await runShadowCompare({ transcript: c.transcript, mode: "fixture", fixture: c.fixture });
    expect(r.left.decision.decision_type).toBe("coach_one");
    expect(r.left.decision.selected!.opportunity.opportunity_id).toBe("O5_vagueness");
    expect(r.right.decision.decision_type).toBe("coach_one");
    expect(r.right.decision.selected!.opportunity.opportunity_id).toBe("O3_unquantified_result");
    expect(r.right.candidate_suppressions).toEqual([
      { opportunity_id: "O5_vagueness", rule_name: "O5 specificity suppression", reasoning: expect.any(String) },
    ]);
    // real duplicate case: regex AND the adapter both independently produce
    // O3_unquantified_result here — confirm the collision is deduped, not
    // double-counted. merged_candidates (pre-suppression) still shows this;
    // final_candidates (post-suppression) is what actually reached decide().
    expect(r.right.adapter_candidates_deduped).toEqual(["O3_unquantified_result"]);
    expect(r.right.merged_candidates.filter((x) => x.opportunity_id === "O3_unquantified_result")).toHaveLength(1);
    expect(r.right.final_candidates.map((x) => x.opportunity_id)).toEqual(["O3_unquantified_result"]);
    // the Evidence Graph itself carries the real contrast (rich, concrete
    // claims) — and now it actually changes the Decision Engine's pick.
    expect(r.right.evidence_graph.nodes.length).toBeGreaterThanOrEqual(12);
    // no O3_missing_result anywhere in this case's merged pool, so the
    // ladder-exclusivity fix has nothing to resolve here — confirms the fix
    // is scoped to the real conflict, not a blanket suppression:
    expect(r.right.ladder_conflicts_resolved).toEqual([]);
  });

  it("CNC stress-test case (Atlas Case 003): the merged pool correctly includes only O3_unquantified_result — no ladder conflict for this case anymore, since 'dropped' is now a recognized result marker (Work Order: Close Remaining Dimensional-Language Gaps)", async () => {
    const c = findKnownCase("cnc")!;
    const r = await runShadowCompare({ transcript: c.transcript, mode: "fixture", fixture: c.fixture });
    expect(r.left.decision.selected!.opportunity.opportunity_id).toBe("O5_vagueness");
    expect(r.right.decision.selected!.opportunity.opportunity_id).toBe("O3_unquantified_result");
    // UPDATED (Work Order: Close Remaining Dimensional-Language Gaps): this
    // test originally exercised the ladder-exclusivity fix using CNC's real,
    // historical incident -- CNC's transcript ends "...dropped back to
    // normal within a day.", and "dropped" was not yet a recognized
    // STRUCTURE_MARKERS.result keyword, so the regex side found NO result
    // marker at all, producing O3_missing_result in merged_candidates
    // alongside the adapter's O3_unquantified_result -- a genuine ladder
    // conflict that this test confirmed got resolved for rendering.
    // "dropped" is now recognized (a separate, later work order's fix), so
    // the regex side correctly finds a result marker for this transcript
    // too; detectMissingResult() no longer fires (a marker now exists), and
    // O3_missing_result never enters the pool -- there is no conflict left
    // to resolve for THIS case. The ladder-exclusivity mechanism itself
    // remains covered by the "thin fixture" case below, which still
    // produces the real conflict and still passes.
    expect(r.right.merged_candidates.map((x) => x.opportunity_id)).toEqual(
      expect.arrayContaining(["O3_unquantified_result", "O5_vagueness"])
    );
    expect(r.right.merged_candidates.map((x) => x.opportunity_id)).not.toContain("O3_missing_result");
    expect(r.right.ladder_conflicts_resolved).toEqual([]);
    // STORY now correctly shows real good notes (both structure_result_marker
    // and result_in_final_sentence fire) instead of disappearing entirely:
    expect(r.right.quick_scan.STORY).toBeDefined();
    expect(r.right.quick_scan.STORY?.every((n) => n.polarity === "good")).toBe(true);
    expect(r.right.quick_scan.IMPACT?.some((n) => n.label.startsWith("Outcome could be easier"))).toBe(true);
  });

  it("thin fixture answer: the merged pool ALSO flips to O3_unquantified_result — a real, reported limitation (README Section 6), not a correct read; same ladder conflict as CNC, also resolved for rendering", async () => {
    const c = findKnownCase("thin")!;
    const r = await runShadowCompare({ transcript: c.transcript, mode: "fixture", fixture: c.fixture });
    expect(r.left.decision.selected!.opportunity.opportunity_id).toBe("O3_missing_result");
    expect(r.right.decision.selected!.opportunity.opportunity_id).toBe("O3_unquantified_result");
    // O5_vagueness (arguably the MORE correct read for a genuinely thin
    // answer) is still present in the pool, just outranked in tiebreak by
    // the adapter's flat 0.8 confidence:
    expect(r.right.merged_candidates.some((x) => x.opportunity_id === "O5_vagueness")).toBe(true);
    // this case ALSO has both ends of the O3 ladder in merged_candidates
    // (O3_missing_result from regex, O3_unquantified_result from the
    // adapter) — confirm the same contradiction is resolved here too, not
    // just in the CNC case that originally surfaced it.
    expect(r.right.ladder_conflicts_resolved).toEqual(["O3_missing_result"]);
    expect(r.right.quick_scan.STORY).toBeUndefined();
  });

  it("checkout-outage case (real, user-supplied): O4_ownership_hiding promotes O3_missing_result to root_cause priority, which gets SELECTED despite the Evidence Graph showing two real outcome claims — the second incident that motivated protecting the selected focus from suppression", async () => {
    const c = findKnownCase("checkout-outage")!;
    const r = await runShadowCompare({ transcript: c.transcript, mode: "fixture", fixture: c.fixture });
    expect(r.left.decision.reasoning.priority_class_applied).toBe("root_cause");
    expect(r.left.decision.selected!.opportunity.opportunity_id).toBe("O3_missing_result");
    // UNCHANGED from LEFT: root_cause priority outranks confidence tiebreak
    // entirely, so the merged pool's higher-confidence O3_unquantified_result
    // never even reaches a tiebreak here (unlike CNC/thin):
    expect(r.right.decision.reasoning.priority_class_applied).toBe("root_cause");
    expect(r.right.decision.selected!.opportunity.opportunity_id).toBe("O3_missing_result");
    expect(r.right.decision.reasoning.rejected.some(
      (rj) => rj.opportunity_id === "O3_unquantified_result" && rj.rejected_by_rule === "one_insight_rule"
    )).toBe(true);
    // THE FIX: both ladder ends are present in merged_candidates (real
    // contradiction exists), but because O3_missing_result IS the selected
    // focus this turn, it must NOT be dropped from rendering — otherwise
    // Coach's Notes would contain no flag at all explaining Today's Focus.
    expect(r.right.merged_candidates.map((x) => x.opportunity_id)).toContain("O3_unquantified_result");
    expect(r.right.ladder_conflicts_resolved).toEqual([]);
    expect(r.right.quick_scan.STORY?.some((n) => n.label === "No result stated")).toBe(true);
    expect(r.right.quick_scan.IMPACT?.some((n) => n.label.startsWith("Outcome could be easier"))).toBe(true);
  });

  it("all four known cases run end to end without throwing, in both modes' shape (fixture here; live is exercised separately)", async () => {
    expect(KNOWN_CASES).toHaveLength(4);
    for (const c of KNOWN_CASES) {
      const r = await runShadowCompare({ transcript: c.transcript, mode: "fixture", fixture: c.fixture });
      expect(r.transcript).toBe(c.transcript);
      expect(r.unmapped_opportunity_ids).toHaveLength(7);
    }
  });

  it("fixture mode without a fixture throws a clear error rather than fabricating one", async () => {
    await expect(runShadowCompare({ transcript: "arbitrary pasted text", mode: "fixture" }))
      .rejects.toThrow(/requires a known case/);
  });

  it("LEFT and RIGHT quickScan both come from the identical rendering function — no divergent copy exists anywhere in this package", async () => {
    // CNC no longer works for this proof as of Milestone 3: O5_vagueness is
    // now suppressed pre-decide() on RIGHT for that case (3 specificity
    // claims, real edges), so "No specifics" no longer fires on RIGHT at
    // all — using "thin" instead, where O5 legitimately does NOT get
    // suppressed on either side (0 specificity claims), so the same flag
    // still fires on both, still proving shared rendering code.
    const c = findKnownCase("thin")!;
    const r = await runShadowCompare({ transcript: c.transcript, mode: "fixture", fixture: c.fixture });
    const leftLabel = r.left.quick_scan.CREDIBILITY?.find((n) => n.label === "No specifics");
    const rightLabel = r.right.quick_scan.CREDIBILITY?.find((n) => n.label === "No specifics");
    expect(leftLabel).toBeDefined();
    expect(rightLabel).toBeDefined();
    expect(leftLabel!.explanation).toBe(rightLabel!.explanation);
  });

  it("MILESTONE 3: O5_vagueness suppression has NOT changed CNC's rendering proof — it changed WHAT fires, confirmed separately here", async () => {
    const c = findKnownCase("cnc")!;
    const r = await runShadowCompare({ transcript: c.transcript, mode: "fixture", fixture: c.fixture });
    expect(r.right.candidate_suppressions.map((s) => s.opportunity_id)).toEqual(["O5_vagueness"]);
    expect(r.right.quick_scan.CREDIBILITY?.some((n) => n.label === "No specifics")).toBe(false);
  });
});
