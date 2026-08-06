/**
 * Coach's Notes — Category Map (V3.2)
 *
 * Data only, Workbench-presentation layer. No detection, selection, or
 * intervention logic lives here; that stays in the frozen engines. This
 * module exists because proof.ts previously hardcoded a flat FLAG_LABELS
 * dict (opportunity_id → short string) and had no equivalent table for the
 * positive ("good") signals, which were inlined ad hoc inside quickScan().
 *
 * Every entry here is keyed off a stable engine-emitted id:
 *  - the nine Opportunity Engine `opportunity_id` values (flags)
 *  - the Observation Engine `observation_type` values used for positives
 *    (quickScan reads these directly; see proof.ts Step 0 findings)
 *
 * Categories (STORY / CREDIBILITY / IMPACT / DELIVERY) group opportunities by
 * what they actually evaluate, not by which engine produced them:
 *  - STORY:       does the answer have a shape (situation → task → action →
 *                 result) and does it land on that result?
 *  - CREDIBILITY: does this sound like it happened to THIS person specifically
 *                 (ownership, participant-only detail, how hard moments are told)?
 *  - IMPACT:      is the result, once reached, measurable?
 *  - DELIVERY:    how the answer is executed out loud (fluency, filler).
 */

export type NoteCategory = "STORY" | "CREDIBILITY" | "IMPACT" | "DELIVERY";
export type NotePolarity = "good" | "flag" | "neutral";

export interface NoteEntry {
  category: NoteCategory;
  polarity: NotePolarity;
  /** static learner-facing label; entries with a computed label omit this */
  label?: string;
  /** 1-2 sentences, teach don't scold; omitted when the label is self-explanatory */
  explanation?: string;
  needsExpand: boolean;
}

/** Flags: keyed by Opportunity Engine `opportunity_id`. All nine, in registry order. */
export const FLAG_NOTES: Record<string, NoteEntry> = {
  O2_structureless_ramble: {
    category: "STORY", polarity: "flag", label: "Story wandered",
    explanation: "The story runs as one long stretch, so a listener has no situation, task, action, or result to hold onto.",
    needsExpand: true,
  },
  O3_missing_result: {
    category: "STORY", polarity: "flag", label: "No result stated",
    explanation: "The work gets described, but the story stops short of saying what happened because of it.",
    needsExpand: true,
  },
  // V3.2 Decision C: was "Result has no number". This is specifically the
  // case where a result IS stated but carries no measure of it (distinct
  // from O3_missing_result above, where no result exists at all).
  //
  // Copy fix: this entry's `explanation` below is now ONLY the general
  // template — used verbatim for Today's Focus wherever that's assembled,
  // and as quickScan()'s own fallback when no quote resolves. Coach's
  // Notes' actual IMPACT flag no longer uses this string directly:
  // proof.ts's quickScan() interpolates the specific triggering outcome
  // sentence into a different, quote-bearing explanation at render time
  // (see quickScan()'s unquantifiedResultExplanation()/
  // resolveUnquantifiedResultQuote()), so the flag and Today's Focus no
  // longer read as the identical paragraph repeated. This entry itself
  // stays byte-unchanged on purpose — it's the one place general/fallback
  // copy for this id lives.
  O3_unquantified_result: {
    category: "IMPACT", polarity: "flag", label: "Outcome could be easier to measure.",
    explanation: "Give the interviewer a clearer sense of how much changed. A number works well, but a before-and-after comparison, timeframe, frequency, or concrete operational result can work too.",
    needsExpand: true,
  },
  // V3.3 copy pass: was "Team voice (we > I)" — a symbol a learner had to
  // interpret. Plain language now; explanation moved from restating the
  // label to the reason it matters (WHY_IT_MATTERS.H3 in conversation-
  // engine's registry.ts covers the hiring stakes, so this stays practical).
  O4_ownership_hiding: {
    category: "CREDIBILITY", polarity: "flag", label: "Your contribution is hard to separate from the team's.",
    explanation: "When every action is framed as \"we,\" it's hard for an interviewer to point to anything specific that was yours.",
    needsExpand: true,
  },
  O5_vagueness: {
    category: "CREDIBILITY", polarity: "flag", label: "No specifics",
    explanation: "A concrete detail, a tool, a constraint, a specific moment, helps a listener picture this as something that happened to you.",
    needsExpand: true,
  },
  // V3.3 copy pass: was "Trailed off at the end". Paired with the STORY
  // positives below (GOOD_NOTES.structure_result_marker /
  // result_in_final_sentence) — this can fire alongside "Reaches a result"
  // (a result was stated somewhere, but the final line still faded), which
  // used to read as a contradiction ("Story has an ending" + "Trailed off
  // at the end" together). "Finish with..." reads as the next step after
  // reaching a result, not a contradiction of it.
  O7_weak_close: {
    category: "STORY", polarity: "flag", label: "Finish with a stronger closing",
    explanation: "The last line is the one people remember most, and this one faded rather than landing on the result.",
    needsExpand: true,
  },
  O8_buried_lede: {
    category: "STORY", polarity: "flag", label: "Answer arrived late",
    explanation: "Leading with the answer up front reads as clearer thinking than building up to it.",
    needsExpand: true,
  },
  O10_filler_density: {
    // Superseded at render time by the computed FILLER_COUNT_NOTE below
    // (proof.ts has always shown a live count here rather than this static
    // label; kept for category completeness and so this map is a true
    // inventory of all nine opportunity ids).
    category: "DELIVERY", polarity: "flag", label: "Heavy filler",
    needsExpand: false,
  },
  O11_employer_negativity: {
    category: "CREDIBILITY", polarity: "flag", label: "Negative about a past employer",
    explanation: "How a hard moment gets described reads as a preview of how you'd talk about this team down the line.",
    needsExpand: true,
  },
};

/**
 * Positives: keyed by the Observation Engine signal that triggers them.
 * None of these come from an opportunity_id; the Opportunity Engine only
 * ever detects problems (see proof.ts Step 0 findings) so every "good" entry
 * here is a Workbench-only reading of the raw observation set.
 *
 * V3.2 Decision A: there is deliberately no DELIVERY entry in this table.
 * Positive delivery recognition (e.g. "clean pacing," "no filler") would
 * require reliable evidence that the input was actually spoken aloud —
 * confidently rewarding "no filler" on a TYPED answer would be rewarding
 * typing, not delivery. No such spoken-input evidence exists anywhere in
 * this pipeline today (see the V3.1 investigation, Check E: no modality
 * flag exists on ObservationInput/ObservationSet, and duration_seconds is
 * an optional, unverified client-supplied number regardless of input
 * source). Do not add a DELIVERY entry here until that evidence exists;
 * manufacturing one now would be exactly the kind of unsupported positive
 * observation this table exists to prevent. See DELIVERY_HIDDEN_WHEN_EMPTY
 * below and proof.ts's quickScan() for how the category is hidden instead.
 */
export const GOOD_NOTES: Record<string, NoteEntry> = {
  quantified_span: {
    category: "IMPACT", polarity: "good", label: "Measurable result",
    needsExpand: false,
  },
  // V3.3 copy pass: was "Owns the actions (I-statements)" — read as a
  // grammar note, not a strength. "Clear personal ownership" says what it's
  // worth, not what it's made of.
  agency_verb_i: {
    category: "CREDIBILITY", polarity: "good", label: "Clear personal ownership",
    needsExpand: false,
  },
  // V3.3 copy pass: three-way STORY relationship resolved (was "Story has
  // an ending" / "Ended on the result", which read as near-duplicates, and
  // "Story has an ending" specifically contradicted FLAG_NOTES.O7_weak_close's
  // old "Trailed off at the end" when both fired together — a routine case,
  // since a result can be stated anywhere in an answer whose actual last
  // line still fades). The two now form a deliberate ladder instead:
  //  - "Reaches a result" = a result was stated somewhere (structure_result_marker).
  //  - "Finishes on the result" = stronger: the LAST sentence IS that result,
  //    with no closing hedge or trailing-off (result_in_final_sentence, gated
  //    accordingly in proof.ts — unchanged logic, this is copy only).
  // The two can appear together (a genuine strong close) without repeating
  // each other, and "Reaches a result" can appear alongside the flag
  // "Finish with a stronger closing" without contradicting it: you stated a
  // result, you just didn't finish on it.
  structure_result_marker: {
    category: "STORY", polarity: "good", label: "Reaches a result",
    needsExpand: false,
  },
  result_in_final_sentence: {
    category: "STORY", polarity: "good", label: "Finishes on the result",
    needsExpand: false,
  },
  // V3.6: three existing structural signals that already fire in the
  // Observation Engine but never reached any Coach's Note before this.
  // Same STAR arc STORY already tracks via structure_result_marker /
  // result_in_final_sentence above — situation/task/action are the other
  // three quarters of it. Wording is deliberately scoped to exactly what
  // each keyword regex checks (observation-engine/src/lexicons.ts's
  // STRUCTURE_MARKERS), not to any judgment the 0.5-confidence keyword
  // heuristic doesn't make: these confirm a scene-setting / role-stating /
  // action-transition PHRASE was present, not that the situation is clearly
  // a problem, that the task was well-defined, or that the action was any
  // good — those are judgments the engine's own confidence_basis
  // ("keyword heuristic only") explicitly disclaims.
  structure_situation_marker: {
    category: "STORY", polarity: "good", label: "Clearly introduces the situation",
    needsExpand: false,
  },
  structure_task_marker: {
    category: "STORY", polarity: "good", label: "Clearly states the task or role",
    needsExpand: false,
  },
  structure_action_marker: {
    category: "STORY", polarity: "good", label: "Clearly marks the action",
    needsExpand: false,
  },
};

/**
 * Computed entry: filler count is a live number, not a static label.
 * Preserves proof.ts's original "${count} filler words" behavior, now data-
 * driven through this map instead of an inline template string.
 *
 * This remains DELIVERY's only possible entry (flag only, never good — see
 * GOOD_NOTES comment above). When it doesn't fire, proof.ts omits the
 * DELIVERY key entirely rather than rendering an empty header
 * (V3.2 Decision A: DELIVERY_HIDDEN_WHEN_EMPTY).
 */
export const FILLER_COUNT_NOTE = {
  category: "DELIVERY" as NoteCategory,
  polarity: "flag" as NotePolarity,
  needsExpand: false,
  label: (count: number): string => `${count} filler words`,
};

/**
 * V3.2 Decision B: CREDIBILITY neutral state.
 *
 * Shown when all three CREDIBILITY detectors (O4_ownership_hiding,
 * O5_vagueness, O11_employer_negativity — confirmed against the category
 * assignments above) ran and none fired. This is a "checked, found
 * nothing" state, not a strength: render it as a distinct third visual
 * state, never as a ✓ success claim.
 *
 * Investigation finding (V3.2): all nine Opportunity Engine detectors,
 * including these three, run unconditionally and to completion every time
 * generateOpportunities() is called; there is no per-detector skip,
 * suppression, or degradation path (opportunity-engine/src/engine.ts calls
 * every detector unguarded, and the function only ever throws on
 * structurally invalid input, before any detector runs, or returns a
 * complete candidate list). "Suppression" in this codebase is a Decision
 * Engine concept applied to already-fired candidates (which one becomes
 * Today's Focus), not an Opportunity Engine concept applied to whether a
 * detector executed. Consequently proof.ts needs no guard against a
 * "skipped/degraded" state before showing this neutral note — that state
 * does not exist. quickScan() is only ever called after a successful
 * generateOpportunities() call (orchestrator.ts's compute-then-commit: a
 * thrown error aborts before quickScan runs), so reaching quickScan at all
 * already guarantees all three detectors executed.
 */
export const CREDIBILITY_NEUTRAL_NOTE: NoteEntry = {
  category: "CREDIBILITY",
  polarity: "neutral",
  label: "Checked — no credibility concerns detected.",
  // V3.3 copy pass: was "...did not trigger any credibility warnings..." —
  // "trigger" and "warnings" are systems language, not something a coach
  // would say out loud.
  explanation: "Nothing about your role or the surrounding details raised a concern here.",
  needsExpand: true,
};

export const CATEGORY_ORDER: NoteCategory[] = ["STORY", "CREDIBILITY", "IMPACT", "DELIVERY"];
