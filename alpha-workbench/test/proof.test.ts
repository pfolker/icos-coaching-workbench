import { describe, it, expect } from "vitest";
import { advance, createSession, debugView, goDeeper, lockIn, publicView, recordClaim, recordPick, submitAnswer, submitRetry } from "../server/orchestrator";
import { notebookBullets, quickScan, metricsDelta } from "../server/proof";
import { observe } from "../../observation-engine/src/index";
import { generateOpportunities, CandidateOpportunity } from "../../opportunity-engine/src/index";
import { FLAG_NOTES } from "../server/categoryMap";
import * as founderCase from "../../coaching-runtime/src/founderCase";
import * as case003 from "../../evidence-benchmark/src/case003Fixture";

const V1 =
  "The second op had a scrap problem and the castings kept warping. " +
  "As a result it eventually got under control and things improved and everyone was glad. So yeah";
const V2 =
  "The second op had a scrap problem and the castings kept warping. " +
  "I redesigned the clamping, and as a result scrap went from 8% to 2% for the rest of the run.";

describe("Proof payload after retry (v3.2)", () => {
  it("carries both transcripts, only genuinely changed metrics, and evidence-grounded notebooks", () => {
    const s = createSession();
    submitAnswer(s.id, V1, 45);
    const r = submitRetry(s.id, V2, 30);
    const p = r.session.proof!;
    expect(p.v1_transcript).toBe(V1);
    expect(p.v2_transcript).toBe(V2);
    // metrics delta: measurable results changed; unchanged metrics are absent
    const labels = p.metrics_delta.map((m) => m.label);
    expect(labels).toContain("Measurable results");
    const results = p.metrics_delta.find((m) => m.label === "Measurable results")!;
    expect(results.from).toBe("0");
    expect(Number(results.to)).toBeGreaterThan(0);
    for (const m of p.metrics_delta) expect(m.from).not.toBe(m.to); // only changes shown
    // verdict is NOT in the learner payload; their pick is the verdict moment
    expect(JSON.stringify(r.session.comparison)).not.toContain("verdict");
    // notebooks: uncapped (V3.2), still memory-phrased and non-empty
    expect(p.notebook_a.length).toBeGreaterThan(0);
    expect(p.notebook_b.length).toBeGreaterThan(0);
    expect(p.notebook_a.join(" ").toLowerCase()).toMatch(/worked out, somehow|nothing specific|not how it ended/);
    expect(p.notebook_b.join(" ")).toContain("8%");
  });
});

describe("Coach's Notes (Quick Scan V3.2): observations, never coaching, grouped by category", () => {
  it("gives category-grouped checks and flags derived from real observations", () => {
    const s = createSession();
    const r = submitAnswer(s.id, V1, 45);
    const scan = r.session.quick_scan!;
    // V1 has no filler: DELIVERY hidden (Decision A). V1 is also the V3.5
    // zero-agency/zero-specificity regression fixture (i_count: 0, we_count: 0,
    // no quantified/numeric span, no structure_action_marker, no agency_verb_i)
    // answered on a behavioral question, so CREDIBILITY now carries the two
    // V3.5 flags (O4_ownership_hiding, O5_vagueness) instead of the neutral
    // "checked, nothing found" note — real concerns exist here, correctly.
    expect(Object.keys(scan).sort()).toEqual(["CREDIBILITY", "IMPACT", "STORY"]);
    expect(scan.DELIVERY).toBeUndefined();
    expect(scan.STORY!.some((e) => e.polarity === "good" && e.label === "Reaches a result")).toBe(true);
    expect(scan.CREDIBILITY!.every((e) => e.polarity === "flag")).toBe(true);
    expect(scan.CREDIBILITY!.map((e) => e.label).sort()).toEqual([
      "No specifics",
      "Your contribution is hard to separate from the team's.",
    ]);
    const allEntries = Object.values(scan).flat();
    expect(allEntries.map((e) => e.label).join(" ")).toMatch(/Outcome could be easier to measure|stronger closing/);
    // observations, not coaching: no imperatives, no dishonesty framing
    // (plain descriptive possessives like "your role" in the CREDIBILITY
    // neutral note are fine; "your " is not banned wholesale here because
    // Decision B's approved copy uses it descriptively, not as an imperative)
    // O3_unquantified_result copy fix: its explanation now quotes the
    // learner's OWN words verbatim (see proof.ts's quickScan()) — V1's real
    // outcome sentence happens to contain "improved" ("...things improved
    // and everyone was glad."), which is the user's own past-tense word, not
    // product-voice coaching language. The banned-word check below is about
    // the product's OWN template voice, so it must exclude quoted spans.
    const all = allEntries.map((e) => [e.label, e.explanation].filter(Boolean).join(" ")).join(" ")
      .replace(/'[^']*'/g, "").toLowerCase();
    for (const banned of ["you should", "try ", "improve", "next time", "lying", "dishonest"]) {
      expect(all).not.toContain(banned);
    }
    // flagged/neutral entries with an explanation are marked expandable; self-explanatory ones are not
    for (const e of allEntries) {
      if (e.explanation) expect(e.needs_expand).toBe(true);
    }
  });
  it("a strong answer scans clean: no flags, no manufactured DELIVERY, CREDIBILITY carries a real positive not the neutral filler", () => {
    const strong = "At the time we had an 8% scrap rate. I redesigned the clamping. As a result, scrap went from 8% to 2%.";
    const scan = quickScan(observe({ transcript: strong, duration_seconds: 20 }), []);
    expect(scan.DELIVERY).toBeUndefined();
    const allEntries = Object.values(scan).flat();
    expect(allEntries.filter((e) => e.polarity === "flag")).toEqual([]);
    expect(allEntries.map((e) => e.label).join(" ")).toContain("8%");
    expect(allEntries.some((e) => e.label === "Clear personal ownership")).toBe(true);
    // a real positive fired in CREDIBILITY, so the neutral note must NOT also be padded in
    expect(scan.CREDIBILITY!.some((e) => e.polarity === "neutral")).toBe(false);
  });
  it("does not manufacture observations to hit a count: a clean short answer can scan with just a few entries", () => {
    const clean = "I redesigned the clamping. As a result, scrap went from 8% to 2%.";
    const scan = quickScan(observe({ transcript: clean, duration_seconds: 10 }), []);
    const allEntries = Object.values(scan).flat();
    expect(allEntries.length).toBeGreaterThan(0);
    expect(allEntries.length).toBeLessThan(6);
    expect(scan.DELIVERY).toBeUndefined();
  });
  it("DELIVERY appears only when real filler evidence exists, and is never a positive", () => {
    const fillerHeavy = "Um, so, like, I, uh, redesigned the clamping, you know, and, um, scrap went from 8% to 2%.";
    const scan = quickScan(observe({ transcript: fillerHeavy, duration_seconds: 20 }), []);
    expect(scan.DELIVERY).toBeDefined();
    expect(scan.DELIVERY!.every((e) => e.polarity === "flag")).toBe(true);
  });
});

describe("NOTEBOOK GROUNDING INVARIANT: never invents, never flatters", () => {
  const fixtures = [V1, V2,
    "We tried some things and it was fine I guess",
    "My old boss was a nightmare but I fixed the process myself and saved $40,000 a year.",
    "At the time we ran fifty parts. I proposed a new sequence. As a result setup dropped from 3 hours to 45 minutes.",
  ];
  it("every number in every bullet exists verbatim in the source transcript", () => {
    for (const t of fixtures) {
      const bullets = notebookBullets(observe({ transcript: t, duration_seconds: 30 }));
      const note = bullets.join(" ");
      for (const m of note.matchAll(/\$?\d[\d,]*(?:\.\d+)?%?/g)) {
        expect(t, `note "${note}" invented "${m[0]}"`).toContain(m[0]);
      }
    }
  });
  it("a red-flag answer produces a red-flag memory; a numberless answer never gains numbers", () => {
    const negNote = notebookBullets(observe({ transcript: fixtures[3]!, duration_seconds: 20 })).join(" ");
    expect(negNote).toContain("the complaint about a previous employer");
    const vagueNote = notebookBullets(observe({ transcript: fixtures[2]!, duration_seconds: 15 })).join(" ");
    expect(vagueNote).not.toMatch(/\d/);
  });
});

describe("V3.7 fix: notebookBullets() no longer contradicts structural evidence it already has", () => {
  const RETRY_WITH_TASK_MARKER =
    "One problem that stands out happened on one of our automated manufacturing lines. " +
    "We started seeing parts getting pushed away during the deburring process instead of being deburred correctly. " +
    "At first everyone thought it was a program issue, but after checking the part straightness with an indicator before and after the deburring process, I was able to see the part had been moving.\n\n" +
    "This pointed to a gripper issue. The grippers were not doing an adequate job holding the part and I needed to come up with a way of locking it in and prevent it from moving.\n\n" +
    "I modified the part being machined slightly by machining two locating divots into the casting, since we were engraving the part anyway I didn't need customer approval for that. I then redesigned the gripper pads with a conical profile so they locked into those divots every cycle.\n\n" +
    "After the change, the part stayed rigid during deburring, the brushing process became consistent, and we eliminated the issue completely. " +
    "It also improved overall throughput because operators no longer had to stop and inspect parts that had been pushed out of position.\n\n" +
    "That project reminded me that sometimes the best automation solution isn't changing the robot program-it's changing the mechanical design so the process becomes repeatable.";

  it("[required] the exact retry text (structure_task_marker newly present, quantified_span_count 0) no longer shows the false negative", () => {
    const set = observe({ transcript: RETRY_WITH_TASK_MARKER });
    expect(set.metrics.quantified_span_count).toBe(0);
    expect(set.observations.some((o) => o.observation_type === "structure_task_marker")).toBe(true);
    const bullets = notebookBullets(set);
    expect(bullets).not.toContain("nothing specific enough to write down");
  });

  it("the bullet still fires normally when neither marker is present and there's truly nothing specific", () => {
    const plain = "We had a problem on the line and it took a good while to sort out but eventually we got it running again and everyone felt a lot better about the whole situation honestly, and it was a real relief for the whole group after all the back and forth about what was even going on with it in the first place.";
    const set = observe({ transcript: plain });
    expect(set.metrics.quantified_span_count).toBe(0);
    expect(set.observations.some((o) => o.observation_type === "structure_task_marker" || o.observation_type === "structure_action_marker")).toBe(false);
    expect(notebookBullets(set)).toContain("nothing specific enough to write down");
  });
});

describe("Beats 1 and 4: pick and claim", () => {
  it("records the learner's judgment and their one-line claim", () => {
    const s = createSession();
    submitAnswer(s.id, V1, 45);
    submitRetry(s.id, V2, 30);
    let r = recordPick(s.id, "v2");
    expect(r.session.proof!.picked_version).toBe("v2");
    expect(r.debug.events.some((e) => e.type === "LEARNER_PICKED" && e.detail.includes("agreement"))).toBe(true);
    r = recordClaim(s.id, "I put the actual number in and stopped talking after it.");
    expect(r.session.proof!.claim).toContain("actual number");
    expect(() => recordClaim(s.id, "   ")).toThrow();
  });
});

describe("Beat 5 / Go Deeper: the retry becomes the answer; one insight holds", () => {
  it("re-coaches THIS answer at the next priority, iteration incremented", () => {
    const s = createSession();
    submitAnswer(s.id, V1, 45);
    const first = debugView(s).selected!.opportunity.opportunity_id;
    submitRetry(s.id, V2 + " So yeah", 30); // fixes the number, reintroduces a weak close
    const r = goDeeper(s.id);
    expect(r.session.state).toBe("COACHED");
    expect(r.session.proof).toBeNull(); // fresh loop on this answer
    expect(r.session.move!.insight).not.toBeNull(); // exactly one insight, again
    const second = r.debug.selected!.opportunity.opportunity_id;
    expect(second).not.toBe(first); // next-highest priority, not the same drum
    expect(r.debug.events.some((e) => e.type === "GO_DEEPER" && e.detail.includes("iteration 2"))).toBe(true);
  });
  it("a genuinely finished answer goes deeper into reinforce_only, honestly", () => {
    const s = createSession();
    submitAnswer(s.id, V1, 45);
    submitRetry(s.id, V2, 30);
    const r = goDeeper(s.id);
    // strong V2: either a small real opportunity or an honest nothing-left
    expect(["coach_one", "reinforce_only"]).toContain(r.session.move!.move_type);
  });
});

describe("Beat 5 / Lock It In and Your Lines (Thursday)", () => {
  it("a locked repetition is kept, and the summary hands the lines back", () => {
    const s = createSession();
    submitAnswer(s.id, V1, 45);
    submitRetry(s.id, V2, 30);
    recordClaim(s.id, "I used the actual number.");
    let r = lockIn(s.id, V2);
    expect(r.debug.events.some((e) => e.type === "LOCKED_IN")).toBe(true);
    expect(r.debug.events.some((e) => e.type === "LINE_KEPT")).toBe(true);
    r = advance(s.id); // Q2
    submitAnswer(s.id, V2, 30); // strong → reinforce_only
    advance(s.id); // Q3
    submitAnswer(s.id, V1, 45);
    r = advance(s.id); // skip retry → summary
    const lines = r.session.summary!.your_lines;
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]!.line).toContain("8% to 2%");
    expect(lines[0]!.claim).toContain("actual number");
  });
});

describe("metrics delta sanity", () => {
  it("identical answers produce an empty delta", () => {
    const a = observe({ transcript: V1, duration_seconds: 30 });
    expect(metricsDelta(a, observe({ transcript: V1, duration_seconds: 30 }))).toEqual([]);
  });
});

describe("O3_unquantified_result copy fix: quote the specific outcome sentence, never the generic paragraph", () => {
  it("[NAMED REGRESSION CASE — founder's actual retry] a magnitude word ('eliminated'/'completely') present in the FULL quote but past the 100-char truncation boundary must still switch to the magnitude-aware wording, never the contradictory 'no sense of scale yet' text", () => {
    const set = observe({ transcript: founderCase.TRANSCRIPT });
    const candidates = generateOpportunities({ observation_set: set, context: { question_type: "behavioral" } });
    expect(candidates.some((c) => c.opportunity_id === "O3_unquantified_result")).toBe(true);
    // confirm the raw regex evidence really is just the bare keyword, so this
    // test is actually proving the sentence-lookup fix, not a no-op
    const raw = candidates.find((c) => c.opportunity_id === "O3_unquantified_result")!;
    expect(raw.evidence.spans[0]!.span_text).toBe("eliminated");

    const scan = quickScan(set, candidates.map((c) => c.opportunity_id), candidates);
    const flag = scan.IMPACT!.find((e) => e.label === "Outcome could be easier to measure.")!;
    // full resolved quote (pre-truncation) really does contain both magnitude
    // words, past the 100-char cut — confirming this test would have caught
    // the real bug (truncation silently determining the branch)
    const fullQuote = "After the change, the part stayed rigid during deburring, the brushing process became consistent, and we eliminated the issue completely.";
    expect(fullQuote.slice(0, 100)).not.toMatch(/completely|eliminated/);
    expect(fullQuote).toMatch(/completely|eliminated/);

    expect(flag.explanation).toBe(
      "You said: 'After the change, the part stayed rigid during deburring, the brushing process became consistent,…' — that already tells the interviewer it fully worked. A number or percentage would make the scale even sharper for someone comparing candidates."
    );
    expect(flag.explanation).not.toContain("no sense of scale yet");
    // label is unchanged — only the explanation carries the quote
    expect(flag.label).toBe(FLAG_NOTES.O3_unquantified_result!.label);
  });

  it("[required, CNC / Atlas Case 003] the Evidence-Graph-adapter shape (sentence_index -1, real full-clause span_text) quotes verbatim with no truncation needed (63 chars)", () => {
    const set = observe({ transcript: case003.TRANSCRIPT });
    // UPDATED (Work Order: Close Remaining Dimensional-Language Gaps): CNC's
    // transcript ends "...dropped back to normal within a day.", and
    // "dropped" is now a recognized STRUCTURE_MARKERS.result keyword, so the
    // regex path DOES now fire a structure_result_marker for this transcript
    // (it didn't when this test was first written). That's orthogonal to
    // what this test actually checks, though: quickScan is called directly
    // below with a manually-constructed adapter-shaped candidate, not with
    // candidates generated from `set` — so its render doesn't depend on
    // whether the regex side also happens to observe something here. Kept
    // as a documented, accurate statement of current behavior rather than a
    // stale assumption, not as a precondition the assertions below rely on.
    expect(set.observations.some((o) => o.observation_type === "structure_result_marker")).toBe(true);
    const adapterShapedCandidate: CandidateOpportunity = {
      opportunity_id: "O3_unquantified_result",
      related_habits: ["H5"],
      evidence: {
        spans: [{ sentence_index: -1, char_start: -1, char_end: -1, span_text: "Scrap rate on that fixture dropped back to normal within a day." }],
        observation_types_cited: ["evidence_graph:outcome"],
        metrics_cited: [],
        absent_signals: ["quantity_binding"],
      },
      confidence: 0.8,
      growth_potential: "high",
      mission_alignment: "no_mission",
      dependencies: { habit_prerequisites: ["H1", "H2", "H4"], upstream_candidates_cofired: [] },
      readiness: { allowed_states: ["flowing", "struggling", "disengaging"] },
    };

    const scan = quickScan(set, ["O3_unquantified_result"], [adapterShapedCandidate]);
    const flag = scan.IMPACT!.find((e) => e.label === "Outcome could be easier to measure.")!;
    expect(flag.explanation).toBe(
      "You said: 'Scrap rate on that fixture dropped back to normal within a day.' — that's a real result, but there's no sense of scale yet. A number, a percentage, or a before-and-after comparison would help the interviewer picture how much actually changed."
    );
  });

  it("truncation breaks at a word boundary and appends an ellipsis, never mid-word", () => {
    const longQuote = "a".repeat(40) + " " + "b".repeat(40) + " " + "c".repeat(40); // 122 chars total
    const candidate: CandidateOpportunity = {
      opportunity_id: "O3_unquantified_result",
      related_habits: [],
      evidence: {
        spans: [{ sentence_index: -1, char_start: -1, char_end: -1, span_text: longQuote }],
        observation_types_cited: [], metrics_cited: [], absent_signals: [],
      },
      confidence: 0.8, growth_potential: "high", mission_alignment: "no_mission",
      dependencies: { habit_prerequisites: [], upstream_candidates_cofired: [] },
      readiness: { allowed_states: ["flowing", "struggling", "disengaging"] },
    };
    const set = observe({ transcript: "placeholder transcript for this test." });
    const scan = quickScan(set, ["O3_unquantified_result"], [candidate]);
    const flag = scan.IMPACT!.find((e) => e.label === "Outcome could be easier to measure.")!;
    // 100-char cut (a-run 0-39, space, b-run 41-80, space, c-run 82-121)
    // lands inside the "c" run; must back off to the space before it, never
    // split a word, and end with the ellipsis character
    expect(flag.explanation).toContain(`'${"a".repeat(40)} ${"b".repeat(40)}…'`);
    expect(flag.explanation).not.toContain("c".repeat(40));
  });

  it("no evidence resolvable falls back to the exact static explanation (defensive; should not occur in practice)", () => {
    const set = observe({ transcript: V1 });
    const scan = quickScan(set, ["O3_unquantified_result"], []);
    const flag = scan.IMPACT!.find((e) => e.label === "Outcome could be easier to measure.")!;
    expect(flag.explanation).toBe(FLAG_NOTES.O3_unquantified_result!.explanation);
  });

  it("O3_missing_result's flag is byte-unchanged", () => {
    const noResult = "We had a problem on the line and everyone talked about it for a while.";
    const set = observe({ transcript: noResult });
    const candidates = generateOpportunities({ observation_set: set, context: { question_type: "behavioral" } });
    const scan = quickScan(set, candidates.map((c) => c.opportunity_id), candidates);
    const flag = Object.values(scan).flat().find((e) => e.label === "No result stated");
    if (flag) {
      expect(flag.explanation).toBe(FLAG_NOTES.O3_missing_result!.explanation);
    }
  });

  it("Today's Focus source (FLAG_NOTES.O3_unquantified_result itself) is untouched — still the general template", () => {
    expect(FLAG_NOTES.O3_unquantified_result!.explanation).toBe(
      "Give the interviewer a clearer sense of how much changed. A number works well, but a before-and-after comparison, timeframe, frequency, or concrete operational result can work too."
    );
  });
});
