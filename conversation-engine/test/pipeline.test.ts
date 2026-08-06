/**
 * FULL PIPELINE — four packages, zero adapters:
 *   transcript → observe → generateOpportunities → decide → generateCoachingMove
 * Proof points 1–6 of the integration directive, each asserted explicitly.
 */
import { describe, it, expect } from "vitest";
import { observe } from "../../observation-engine/src/index";
import { generateOpportunities } from "../../opportunity-engine/src/index";
import { decide } from "../../decision-engine/src/index";
import { generateCoachingMove, OPPORTUNITY_COPY } from "../src/index";
import type { CopyGenerator } from "../src/types";
import { templateGenerator } from "../src/generator";

const RAMBLE =
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

const STRONG =
  "At the time, we had an 8% scrap rate on the second op. My job was to fix the fixturing. " +
  "So I redesigned the clamping and I proposed a new op sequence. " +
  "As a result, scrap went from 8% to 2%, saving about $40,000 a year.";

function runChain(transcript: string, mission: { habit_id: string } | null) {
  const observations = observe({ transcript, duration_seconds: 120 });
  const candidates = generateOpportunities({
    observation_set: observations,
    context: { question_type: "behavioral", ...(mission ? { mission_habit_id: mission.habit_id } : {}) },
  });
  const decision = decide({
    candidates, coaching_state: "flowing", mission,
    learner_model: { habits: { H5: { demonstrated: true, coached_count: 1, verdicts: ["achieved"] } } },
  });
  const move = generateCoachingMove({
    decision, observation_set: observations, transcript, coaching_state: "flowing", mission,
  });
  return { observations, candidates, decision, move };
}

describe("PROOF 1+6: one transcript flows through all four packages; final move complete", () => {
  it("zero adapter code, and the CoachingMove contains every mandated section", () => {
    const { decision, move } = runChain(RAMBLE, { habit_id: "H5" });
    expect(decision.decision_type).toBe("coach_one");
    // recognition, insight, why, retry, verification: all present
    expect(move.recognition.copy.length).toBeGreaterThan(0);
    expect(move.insight!.copy.length).toBeGreaterThan(0);
    expect(move.why_it_matters!.copy.length).toBeGreaterThan(0);
    expect(move.retry_instruction!.copy.length).toBeGreaterThan(0);
    expect(move.verification.passed).toBe(true);
    expect(move.verification.degraded).toBe(false);
    expect(move.verification.checks.map((c) => c.check)).toContain("quote_grounding");
  });
});

describe("PROOF 2: the Conversation Engine uses only the selected decision", () => {
  it("refs match the decision's selection; retry belongs to it; elicit branch honored", () => {
    const { decision, move } = runChain(RAMBLE, { habit_id: "H5" });
    const selectedId = decision.selected!.opportunity.opportunity_id;
    expect(selectedId).toBe("O3_missing_result"); // reconciliation: mission tiebreak among root causes
    expect(move.refs.opportunity_id).toBe(selectedId);
    expect(move.retry_instruction!.pattern_key).toBe(OPPORTUNITY_COPY[selectedId]!.retry_pattern_key);
    // learner model says H2... selected primary habit is H2 (O3_missing) → supply branch;
    // intervention type recorded on the move matches the decision, not reinvented
    expect(move.refs.intervention_type).toBe(decision.selected!.intervention_type);
  });
});

describe("PROOF 3: rejected opportunities never appear in learner-facing copy", () => {
  it("no rejected candidate's signature phrase reaches the card", () => {
    const { decision, move } = runChain(RAMBLE, { habit_id: "H5" });
    expect(decision.reasoning.rejected.length).toBeGreaterThanOrEqual(3);
    const copy = [move.mission_line, move.recognition.copy, move.insight?.copy,
      move.why_it_matters?.copy, move.retry_instruction?.copy].join(" ").toLowerCase();
    for (const r of decision.reasoning.rejected) {
      const sig = OPPORTUNITY_COPY[r.opportunity_id]?.signature;
      if (sig) expect(copy).not.toContain(sig.toLowerCase());
    }
  });
});

describe("PROOF 4: every quote is grounded in the transcript", () => {
  it("all quoted spans and all quoted phrases are verbatim", () => {
    const { move } = runChain(RAMBLE, { habit_id: "H5" });
    for (const s of [...move.recognition.quoted_spans, ...(move.insight?.quoted_spans ?? [])]) {
      expect(RAMBLE.slice(s.char_start, s.char_end)).toBe(s.span_text);
    }
    const copy = [move.recognition.copy, move.insight?.copy ?? ""].join("\n");
    for (const m of copy.matchAll(/"([^"]+)"/g)) {
      expect(RAMBLE).toContain(m[1]!);
    }
  });
  it("a strong answer flows to reinforce_only with grounded recognition", () => {
    const { decision, move } = runChain(STRONG, null);
    expect(decision.decision_type).toBe("reinforce_only");
    expect(move.move_type).toBe("reinforce_only");
    expect(move.recognition.downgraded).toBe(false); // quantified span exists → real quote
    for (const s of move.recognition.quoted_spans) {
      expect(STRONG.slice(s.char_start, s.char_end)).toBe(s.span_text);
    }
    expect(move.insight).toBeNull();
    expect(move.advance_copy!.length).toBeGreaterThan(0);
  });
});

describe("PROOF 5: degraded fallback still produces safe coaching, end to end", () => {
  it("a hallucinating generator on the REAL chain ships the safe fallback instead", () => {
    const observations = observe({ transcript: RAMBLE, duration_seconds: 120 });
    const candidates = generateOpportunities({
      observation_set: observations, context: { question_type: "behavioral" },
    });
    const decision = decide({ candidates, coaching_state: "flowing" });
    const hallucinating: CopyGenerator = (ctx) => {
      const c = templateGenerator(ctx);
      c.insight!.copy += ' You told me "we cut scrap from 12% to 3% in six weeks" which was excellent.';
      return c;
    };
    const move = generateCoachingMove(
      { decision, observation_set: observations, transcript: RAMBLE, coaching_state: "flowing" },
      hallucinating
    );
    expect(move.verification.degraded).toBe(true);
    expect(move.verification.passed).toBe(true);
    const copy = JSON.stringify(move);
    expect(copy).not.toContain("12%");
    expect(copy).not.toContain("six weeks");
    // still real coaching: correct retry for the actually-selected opportunity
    const selectedId = decision.selected!.opportunity.opportunity_id;
    expect(move.retry_instruction!.pattern_key).toBe(OPPORTUNITY_COPY[selectedId]!.retry_pattern_key);
  });
});

describe("end-to-end determinism", () => {
  it("the full four-package chain is reproducible", () => {
    expect(runChain(RAMBLE, { habit_id: "H5" }).move)
      .toEqual(runChain(RAMBLE, { habit_id: "H5" }).move);
  });
});
