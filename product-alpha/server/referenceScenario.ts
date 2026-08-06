/**
 * The ONE fully-validated reference scenario for Product Alpha (per the
 * founder directive's Data Source section — "resolved, do not
 * reinterpret"). Every string below is real, already-produced text: no
 * live LLM call, no Decision Engine/Observation Engine import, no
 * computation happens in this package at request time or anywhere else in
 * product-alpha. This file is the ONLY place that data lives, and it is
 * literal, hardcoded, and cross-checked byte-for-byte against its source
 * in test/referenceScenario.test.ts.
 *
 * Provenance, per string:
 *
 *  - QUESTION: the Product Experience Specification v1.1's own Screen A
 *    wireframe example question, reused verbatim rather than invented,
 *    since it already fits this transcript's content (a difficult
 *    technical problem) and keeps the wording traceable to the frozen
 *    document instead of to my own judgment.
 *
 *  - FIRST_TAKE.transcript: evidence-runtime/fixtures/case001.ts's
 *    TRANSCRIPT constant — the founder's real original answer. Verified
 *    fresh from disk, not from memory, immediately before this file was
 *    written.
 *
 *  - RETRY.transcript: coaching-runtime/src/founderCase.ts's TRANSCRIPT
 *    constant — the founder's real retry text (this is the "founder_retry"
 *    / "flagship" transcript central to Milestone 3). Verified fresh from
 *    disk, not from memory, immediately before this file was written.
 *
 *  - FIRST_TAKE.coachesNotes / todaysFocus: NOT present in Milestone 3's
 *    milestone3BeforeAfter.mjs capture (that script only ran founder_retry,
 *    atlas_003, atlas_007). Per the founder's explicit resolution to the
 *    data-pairing question raised before this file was written: generated
 *    by re-running the exact same frozen, already-validated pipeline
 *    (runShadowCompare -> quickScan, with Milestone 3's O5 suppression
 *    applied, fixture mode, zero live calls) against case001's transcript
 *    and fixture — the identical mechanism every other "captured" data
 *    point in this project came from. Shown to the founder in full before
 *    being wired in here; no mismatch was found (both first-take and retry
 *    resolve to the same corrected Today's Focus, and the retry's
 *    quick_scan shows one real, additional affirmed STORY item that the
 *    first take lacks).
 *
 *  - RETRY.coachesNotes / todaysFocus: milestone3BeforeAfter.mjs's actual
 *    printed output for "FLAGSHIP: founder_retry", PROPOSED (shadow-mode,
 *    O5 suppression applied) branch — re-run fresh immediately before this
 *    file was written to confirm it verbatim, not recalled from memory.
 *
 *  - IMPACT.explanation (both FIRST_TAKE and RETRY), re-captured TWICE after
 *    the O3_unquantified_result copy fix (alpha-workbench/server/proof.ts's
 *    quickScan()): first for the base quote-interpolation fix, then again
 *    for the magnitude-word correction (a real, confirmed bug — the full
 *    quote contains "eliminated"/"completely," but both fall past the
 *    100-char truncation point, so the FIRST capture's wording ("there's no
 *    sense of scale yet") directly contradicted language actually present
 *    in the full quote; the magnitude check now runs against the
 *    untruncated quote before display truncation is applied, per
 *    proof.ts's MAGNITUDE_WORDS check). Both fixtures resolve to the SAME
 *    quoted sentence ("After the change, the part stayed rigid during
 *    deburring, the brushing process became consistent,…") because that
 *    exact sentence is verbatim-identical between case001's and
 *    founderCase's transcripts, and both hit the magnitude branch for the
 *    same reason. todaysFocus.explanation is deliberately UNCHANGED — it
 *    still reads FLAG_NOTES.O3_unquantified_result's static, general text
 *    directly, by design, so the flag and Today's Focus no
 *    longer read as the identical paragraph repeated. Re-captured via the
 *    same frozen pipeline (fixture mode, zero live calls) immediately
 *    after the fix landed, not hand-edited.
 *
 *  - LOCK_IN.acknowledgment: the Spec's Stage 7 requires "one specific,
 *    factual line naming what actually changed" -- not generic praise, and
 *    NOT necessarily a claim that the retry resolved Today's Focus's
 *    specific ask (it didn't: both quick_scans still carry the same
 *    unresolved "outcome could be easier to measure" IMPACT flag -- the
 *    founder's real retry never adds a number). The one real, verifiable
 *    difference between the two captured quick_scans is that the retry's
 *    STORY section gained one additional affirmed item -- "Clearly states
 *    the task or role" -- that the first take's STORY section does not
 *    have. That is the single grounded, quotable fact used here. Per
 *    Design Principles v0.1 #1 (ground everything) and #4 (silence over an
 *    unearned claim), this line does NOT claim the quantification gap was
 *    closed, because it wasn't.
 */

export interface QuickScanItem {
  polarity: "good" | "flag" | "neutral";
  label: string;
  explanation?: string;
  /** carried through verbatim from the real quick_scan payload; unused by
   *  this package's own rendering (Screen B always shows the explanation),
   *  kept only so the provenance test can compare byte-for-byte. */
  needs_expand?: boolean;
}

export interface QuickScan {
  STORY?: QuickScanItem[];
  IMPACT?: QuickScanItem[];
  CREDIBILITY?: QuickScanItem[];
}

export interface TodaysFocus {
  label: string;
  explanation: string;
}

export const QUESTION =
  "Tell me about a time you solved a difficult problem at work.";

export const FIRST_TAKE = {
  transcript:
    "One problem that stands out happened on one of our automated manufacturing lines. " +
    "We started seeing parts getting pushed away during the deburring process instead of being cleaned correctly. " +
    "At first everyone thought it was a programming issue, but after watching the machine run I realized the robot was actually applying force in a way that allowed the casting to move.\n\n" +
    "I spent time watching the process, talking with the operators, and looking at how the fixture contacted the part. " +
    "I realized we were grabbing onto a rough casting surface that wasn't locating the part consistently. " +
    "Instead of trying to solve it in software, I modified the fixture by machining two locating divots into the face of the part and redesigned the gripper pads with a conical profile so they locked into those divots every cycle.\n\n" +
    "After the change, the part stayed rigid during deburring, the brushing process became consistent, and we eliminated the issue completely. " +
    "It also improved overall throughput because operators no longer had to stop and inspect parts that had been pushed out of position.\n\n" +
    "That project reminded me that sometimes the best automation solution isn't changing the robot program—it's changing the mechanical design so the process becomes repeatable.",
  coachesNotes: {
    STORY: [
      { polarity: "good", label: "Clearly introduces the situation", needs_expand: false },
      { polarity: "good", label: "Reaches a result", needs_expand: false },
    ],
    IMPACT: [
      {
        polarity: "flag",
        label: "Outcome could be easier to measure.",
        explanation:
          "You said: 'After the change, the part stayed rigid during deburring, the brushing process became consistent,…' — that already tells the interviewer it fully worked. A number or percentage would make the scale even sharper for someone comparing candidates.",
        needs_expand: true,
      },
    ],
    CREDIBILITY: [
      {
        polarity: "neutral",
        label: "Checked — no credibility concerns detected.",
        explanation: "Nothing about your role or the surrounding details raised a concern here.",
        needs_expand: true,
      },
    ],
  } satisfies QuickScan,
  todaysFocus: {
    label: "Outcome could be easier to measure.",
    explanation:
      "Give the interviewer a clearer sense of how much changed. A number works well, but a before-and-after comparison, timeframe, frequency, or concrete operational result can work too.",
  } satisfies TodaysFocus,
};

export const RETRY = {
  transcript:
    "One problem that stands out happened on one of our automated manufacturing lines. " +
    "We started seeing parts getting pushed away during the deburring process instead of being deburred correctly. " +
    "At first everyone thought it was a program issue, but after checking the part straightness with an indicator before and after the deburring process, I was able to see the part had been moving.\n\n" +
    "This pointed to a gripper issue. The grippers were not doing an adequate job holding the part and I needed to come up with a way of locking the part in and prevent it from moving.\n\n" +
    "I modified the part being machined slightly by machining two locating divots into the casting, since we were engraving the part anyway I didn't need customer approval for that. I then redesigned the gripper pads with a conical profile so they locked into those divots every cycle.\n\n" +
    "After the change, the part stayed rigid during deburring, the brushing process became consistent, and we eliminated the issue completely. It also improved overall throughput because operators no longer had to stop and inspect parts that had been pushed out of position.\n\n" +
    "That project reminded me that sometimes the best automation solution isn't changing the robot program—it's changing the mechanical design so the process becomes repeatable.",
  coachesNotes: {
    STORY: [
      { polarity: "good", label: "Clearly introduces the situation", needs_expand: false },
      { polarity: "good", label: "Clearly states the task or role", needs_expand: false },
      { polarity: "good", label: "Reaches a result", needs_expand: false },
    ],
    IMPACT: [
      {
        polarity: "flag",
        label: "Outcome could be easier to measure.",
        explanation:
          "You said: 'After the change, the part stayed rigid during deburring, the brushing process became consistent,…' — that already tells the interviewer it fully worked. A number or percentage would make the scale even sharper for someone comparing candidates.",
        needs_expand: true,
      },
    ],
    CREDIBILITY: [
      {
        polarity: "neutral",
        label: "Checked — no credibility concerns detected.",
        explanation: "Nothing about your role or the surrounding details raised a concern here.",
        needs_expand: true,
      },
    ],
  } satisfies QuickScan,
};

export const LOCK_IN = {
  acknowledgment: "You named your role clearly this time — the retry states directly what the grippers weren't doing, instead of leaving that implied.",
};

export const NEXT_QUESTION_MARKER = "question 2 of 3";
