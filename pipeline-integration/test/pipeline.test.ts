/**
 * PIPELINE INTEGRATION — the alignment-pass proof.
 *
 *   transcript
 *     → observation-engine  observe()                 (Perception: deterministic signals)
 *     → opportunity-engine  generateOpportunities()   (candidates, unranked)
 *     → decision-engine     decide()                  (exactly one, with reasoning)
 *
 * No adapter code exists between stages: outputs are directly assignable
 * inputs by structural typing. That IS the contract being tested.
 */
import { describe, it, expect } from "vitest";
import { observe } from "../../observation-engine/src/index";
import { generateOpportunities } from "../../opportunity-engine/src/index";
import { decide } from "../../decision-engine/src/index";

const WE_HEAVY_RAMBLE =
  "Um, so we had this whole situation with the second op and we kept running parts and " +
  "we tried a bunch of different things and we talked to the team about it and we went " +
  "back and forth for a while and we eventually got it sorted out after we changed some " +
  "things around and we were all pretty happy with how it turned out because we felt like " +
  "we had really gotten somewhere with it and we kept it running like that and, um, we " +
  "showed the other shift how we did it and we moved on to the next job and things were " +
  "better after that and we didn't have the same problem again and everyone was glad and " +
  "we sort of made it part of how we did the changeovers going forward and yeah we just " +
  "kept doing it that way and it stayed fixed for a long time and we never really had to " +
  "go back to it again after that whole stretch and, you know, we were relieved and we " +
  "talked about it in the morning meetings for a while and we brought it up when the new " +
  "people started so they would know about it and we put some notes together about what " +
  "we did and we kept those around in the crib and we referred back to them a couple of " +
  "times when similar stuff came up on the other machines and we felt like it was one of " +
  "those things where we all learned something from going through it together and we got " +
  "better as a group because of it and we kind of leaned on that experience later when " +
  "other problems came up on different jobs and we handled those quicker because of what " +
  "we had been through with this one and we always figured that was worth something to " +
  "the whole department in the long run and we appreciated it. So yeah";

const STRONG_ANSWER =
  "At the time, we had an 8% scrap rate on the second op. My job was to fix the fixturing. " +
  "So I redesigned the clamping and I proposed a new op sequence. " +
  "As a result, scrap went from 8% to 2%, saving about $40,000 a year.";

describe("PIPELINE: transcript → observations → candidates → one decision", () => {
  it("chains with zero adaptation and selects exactly one opportunity", () => {
    // Stage 1: Perception (deterministic signal layer)
    const observations = observe({ transcript: WE_HEAVY_RAMBLE, duration_seconds: 95 });

    // Stage 2: Candidate opportunities (unranked, all fired)
    const candidates = generateOpportunities({
      observation_set: observations,                       // ← direct feed
      context: { question_type: "behavioral", mission_habit_id: "H5" },
    });
    expect(candidates.length).toBeGreaterThanOrEqual(3);   // busy answer, several fire

    // Stage 3: Decision (exactly one)
    const decision = decide({
      candidates,                                          // ← direct feed
      coaching_state: "flowing",
      mission: { habit_id: "H5" },
      learner_model: { habits: { H5: { demonstrated: true, coached_count: 1, verdicts: ["achieved"] } } },
    });

    // exactly ONE selected
    expect(decision.decision_type).toBe("coach_one");
    expect(decision.selected).not.toBeNull();
    const selectedId = decision.selected!.opportunity.opportunity_id;
    expect(candidates.map((c) => c.opportunity_id)).toContain(selectedId);

    // completeness: selected + rejected == every candidate, each rejection reasoned
    const accounted = [selectedId, ...decision.reasoning.rejected.map((r) => r.opportunity_id)].sort();
    expect(accounted).toEqual(candidates.map((c) => c.opportunity_id).sort());
    for (const r of decision.reasoning.rejected) {
      expect(r.rejected_by_rule.length).toBeGreaterThan(0);
      expect(r.reason.length).toBeGreaterThan(0);
    }

    // JA-01 live: root-cause class dominates — co-fired downstream symptoms
    // (weak close, ownership, vagueness) are rejected behind the structural causes
    expect(decision.reasoning.priority_class_applied).toBe("root_cause");
    const o7rej = decision.reasoning.rejected.find((r) => r.opportunity_id === "O7_weak_close")!;
    expect(o7rej.rejected_by_rule).toBe("root_cause_override");

    // JA-07 live: WITHIN the root-cause class, mission alignment is the first
    // tiebreak — O3_missing_result (H5) beats its H2-sibling O2 because the
    // mission is H5. Bias within coachable issues, never fabricated relevance.
    expect(selectedId).toBe("O3_missing_result");
    expect(decision.reasoning.mission_handling).toBe("aligned_selected");

    // contrast: WITHOUT a mission (mission-consistency rule: the same mission
    // must be supplied to BOTH generateOpportunities and decide — alignment is
    // stamped at generation and the tiebreak trusts the stamp), confidence
    // tiebreak gives the ramble instead
    const unstamped = generateOpportunities({
      observation_set: observations, context: { question_type: "behavioral" },
    });
    const noMission = decide({ candidates: unstamped, coaching_state: "flowing" });
    expect(noMission.selected!.opportunity.opportunity_id).toBe("O2_structureless_ramble");

    // evidence integrity survives the WHOLE pipeline: every span the selected
    // opportunity cites is verbatim from the original transcript
    const ev = decision.selected!.opportunity.evidence as {
      spans: { char_start: number; char_end: number; span_text: string }[];
    };
    for (const s of ev.spans) {
      expect(WE_HEAVY_RAMBLE.slice(s.char_start, s.char_end)).toBe(s.span_text);
    }
  });

  it("disengaging state flips the same candidates to a protect-mode quick win (JA-06)", () => {
    const observations = observe({ transcript: WE_HEAVY_RAMBLE, duration_seconds: 95 });
    const candidates = generateOpportunities({
      observation_set: observations, context: { question_type: "behavioral" },
    });
    const decision = decide({ candidates, coaching_state: "disengaging" });
    expect(decision.selected!.opportunity.opportunity_id).toBe("O7_weak_close");
    expect(decision.selected!.priority_class).toBe("protect");
    expect(decision.reasoning.state_gate).toBe("disengaging_protect");
  });

  it("a strong answer flows through to an honest reinforce-only decision", () => {
    const observations = observe({ transcript: STRONG_ANSWER, duration_seconds: 30 });
    const candidates = generateOpportunities({ observation_set: observations });
    expect(candidates).toEqual([]);                        // nothing fires
    const decision = decide({ candidates, coaching_state: "flowing" });
    expect(decision.decision_type).toBe("reinforce_only");
    expect(decision.selected).toBeNull();
  });

  it("the whole chain is deterministic end-to-end", () => {
    const runOnce = () => decide({
      candidates: generateOpportunities({
        observation_set: observe({ transcript: WE_HEAVY_RAMBLE, duration_seconds: 95 }),
        context: { question_type: "behavioral" },
      }),
      coaching_state: "flowing",
    });
    expect(runOnce()).toEqual(runOnce());
  });
});
