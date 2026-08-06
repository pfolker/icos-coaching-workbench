/**
 * V3.7 — O5_vagueness verdict widened at the not_yet/partial boundary only.
 * O3_unquantified_result's judge() case is explicitly out of scope and must
 * stay byte-unchanged (see the required regression test at the bottom).
 */
import { describe, it, expect } from "vitest";
import { observe } from "../../observation-engine/src/index";
import { compareRetry } from "../src/engine";
import { ComparisonInput } from "../src/types";

// ---------------- the real founder-evaluation fixtures ----------------
const FIRST_TAKE =
  "One problem that stands out happened on one of our automated manufacturing lines. " +
  "We started seeing parts getting pushed away during the deburring process instead of being cleaned correctly. " +
  "At first everyone thought it was a programming issue, but after watching the machine run I realized the robot was actually applying force in a way that allowed the casting to move.\n\n" +
  "I spent time watching the process, talking with the operators, and looking at how the fixture contacted the part. " +
  "I realized we were grabbing onto a rough casting surface that wasn't locating the part consistently. " +
  "Instead of trying to solve it in software, I modified the fixture by machining two locating divots into the face of the part and redesigned the gripper pads with a conical profile so they locked into those divots every cycle.\n\n" +
  "After the change, the part stayed rigid during deburring, the brushing process became consistent, and we eliminated the issue completely. " +
  "It also improved overall throughput because operators no longer had to stop and inspect parts that had been pushed out of position.\n\n" +
  "That project reminded me that sometimes the best automation solution isn't changing the robot program-it's changing the mechanical design so the process becomes repeatable.";

const RETRY_TASK_MARKER =
  "One problem that stands out happened on one of our automated manufacturing lines. " +
  "We started seeing parts getting pushed away during the deburring process instead of being deburred correctly. " +
  "At first everyone thought it was a program issue, but after checking the part straightness with an indicator before and after the deburring process, I was able to see the part had been moving.\n\n" +
  "This pointed to a gripper issue. The grippers were not doing an adequate job holding the part and I needed to come up with a way of locking it in and prevent it from moving.\n\n" +
  "I modified the part being machined slightly by machining two locating divots into the casting, since we were engraving the part anyway I didn't need customer approval for that. I then redesigned the gripper pads with a conical profile so they locked into those divots every cycle.\n\n" +
  "After the change, the part stayed rigid during deburring, the brushing process became consistent, and we eliminated the issue completely. " +
  "It also improved overall throughput because operators no longer had to stop and inspect parts that had been pushed out of position.\n\n" +
  "That project reminded me that sometimes the best automation solution isn't changing the robot program-it's changing the mechanical design so the process becomes repeatable.";

const buildInput = (
  retry: string, original: string, opportunityId: string, patternKey = "make_me_believe", habitId = "H4"
): ComparisonInput => ({
  original_transcript: original,
  retry_transcript: retry,
  original_observation_set: observe({ transcript: original, duration_seconds: 60 }),
  retry_observation_set: observe({ transcript: retry, duration_seconds: 60 }),
  decision: {
    decision_type: "coach_one",
    selected: {
      opportunity: { opportunity_id: opportunityId, related_habits: [habitId], evidence: {} },
      intervention_type: "I1_direct_instruction",
      priority_class: "root_cause",
    },
    reasoning: { mission_handling: "no_mission", rejected: [] },
  },
  coaching_move: {
    retry_instruction: { copy: "placeholder", pattern_key: patternKey },
    refs: { opportunity_id: opportunityId, intervention_type: "I1_direct_instruction", habit_id: habitId },
  },
  mission: null,
});

describe("V3.7 required test 1: genuine number in retry -> still achieved (regression, unchanged)", () => {
  it("O5_vagueness with a real quantified span in the retry stays achieved", () => {
    const original = "We had a process problem on the line and it took a while to sort out but eventually we got it running smoothly again for everyone involved on the team.";
    const retryWithNumber = "We had a process problem on the line and as a result scrap dropped from 8% to 2% after we sorted it out for the team.";
    const c = compareRetry(buildInput(retryWithNumber, original, "O5_vagueness"));
    expect(c.verdict).toBe("achieved");
  });
});

describe("V3.7 required test 2: the real retry text (task-marker newly present, no number) -> now partial", () => {
  it("matches live founder-evaluation behavior", () => {
    const first = observe({ transcript: FIRST_TAKE });
    const retry = observe({ transcript: RETRY_TASK_MARKER });
    expect(first.metrics.quantified_span_count).toBe(0);
    expect(retry.metrics.quantified_span_count).toBe(0);
    expect(retry.metrics.numeric_span_count).toBe(0);
    expect(first.observations.some((o) => o.observation_type === "structure_task_marker")).toBe(false);
    expect(retry.observations.some((o) => o.observation_type === "structure_task_marker")).toBe(true);

    const c = compareRetry(buildInput(RETRY_TASK_MARKER, FIRST_TAKE, "O5_vagueness"));
    expect(c.verdict).toBe("partial");
    expect(c.reinforcement.copy).toContain("Some real detail made it in");
  });

  it("also recognizes a newly-gained structure_action_marker the same way", () => {
    const original = "We had a quality problem on the line and it took a while to sort out but eventually we got it running smoothly again for everyone on the team involved.";
    const retryActionMarker = "We had a quality problem on the line and so I dug into it and eventually we got it running smoothly again for everyone on the team involved.";
    const o = observe({ transcript: original });
    const r = observe({ transcript: retryActionMarker });
    expect(o.observations.some((x) => x.observation_type === "structure_action_marker")).toBe(false);
    expect(r.observations.some((x) => x.observation_type === "structure_action_marker")).toBe(true);
    expect(r.metrics.quantified_span_count).toBe(0);
    expect(r.metrics.numeric_span_count).toBe(0);

    const c = compareRetry(buildInput(retryActionMarker, original, "O5_vagueness"));
    expect(c.verdict).toBe("partial");
  });
});

describe("V3.7 required test 3: no new number, no new structural marker -> remains not_yet (regression)", () => {
  it("a retry that doesn't actually improve still says so", () => {
    const original = "We had a process problem on the line and it took a while to sort out but eventually we got it running smoothly again for everyone involved on the team.";
    const retryNoImprovement = "We had a process problem on the line and it took quite a while to sort out but eventually we got it running smoothly again for everyone involved on the whole team.";
    const c = compareRetry(buildInput(retryNoImprovement, original, "O5_vagueness"));
    expect(c.verdict).toBe("not_yet");
  });

  it("a structural marker present in BOTH original and retry (not newly gained) does not count as improvement", () => {
    const original = "My job was to fix the process problem on the line and it took a while to sort out but eventually we got it running smoothly for the team.";
    const retrySameMarker = "My job was to fix the process problem on the line and it took quite a while to sort out but eventually we got it running smoothly for the whole team.";
    const o = observe({ transcript: original });
    const r = observe({ transcript: retrySameMarker });
    expect(o.observations.some((x) => x.observation_type === "structure_task_marker")).toBe(true);
    expect(r.observations.some((x) => x.observation_type === "structure_task_marker")).toBe(true);
    const c = compareRetry(buildInput(retrySameMarker, original, "O5_vagueness"));
    expect(c.verdict).toBe("not_yet");
  });
});

describe("V3.7 required test 4 (critical): O3_unquantified_result is UNCHANGED — still requires a number", () => {
  it("the same structural-but-non-numeric improvement does NOT move O3's verdict off not_yet", () => {
    const first = observe({ transcript: FIRST_TAKE });
    const retry = observe({ transcript: RETRY_TASK_MARKER });
    // sanity: same non-numeric structural gain as required test 2, just graded as O3 this time
    expect(first.observations.some((o) => o.observation_type === "structure_task_marker")).toBe(false);
    expect(retry.observations.some((o) => o.observation_type === "structure_task_marker")).toBe(true);
    expect(retry.metrics.quantified_span_count).toBe(0);

    const c = compareRetry(buildInput(RETRY_TASK_MARKER, FIRST_TAKE, "O3_unquantified_result", "end_on_a_number", "H5"));
    expect(c.verdict).toBe("not_yet");
    expect(c.improvement_summary).toBe("no quantification in retry");
  });
});
