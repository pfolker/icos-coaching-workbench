/**
 * Ladder exclusivity — resolves a contradiction that is ONLY possible in
 * THIS package, never in the live Workbench.
 *
 * The real incident: running the CNC case (Atlas Case 003) through RIGHT
 * rendered both "No result stated" (O3_missing_result) and "Outcome could
 * be easier to measure." (O3_unquantified_result) in Coach's Notes at the
 * same time — a direct contradiction (one asserts no result exists, the
 * other asserts a result exists but isn't quantified; both cannot be true).
 *
 * STEP 1 — confirmed mechanism: quickScan() (alpha-workbench/server/proof.ts)
 * maps every id in `firedOpportunityIds` straight to a flag with no
 * mutual-exclusivity check at all:
 *
 *   for (const id of firedOpportunityIds) {
 *     if (id === "O10_filler_density") continue;
 *     const n = FLAG_NOTES[id];
 *     if (n) push(n);
 *   }
 *
 * It has never needed one, because of STEP 2's finding:
 * opportunity-engine/src/detectors.ts's detectMissingResult and
 * detectUnquantifiedResult both read the exact same
 * obsOf(set, "structure_result_marker") lookup on the exact same regex
 * ObservationSet:
 *
 *   detectMissingResult:      if (marker || finalR) return null;
 *   detectUnquantifiedResult: if (!marker) return null;
 *
 * These are direct logical negations of the identical boolean, evaluated
 * on the identical single source. Within one call to generateOpportunities(),
 * it is STRUCTURALLY IMPOSSIBLE for both to fire — this contradiction could
 * never happen in the live Workbench today. It only becomes possible here
 * because evidence-shadow-compare merges TWO INDEPENDENT judgments of
 * whether a result marker exists (regex's keyword scan vs. the Evidence
 * Graph's admitted `outcome` claim) that are free to disagree.
 *
 * STEP 3 — resolution reasoning: when both fire, which should render?
 * Not an unconditional "evidence always wins" rule — there's a real,
 * plausible failure mode where that would be wrong: the Listen Engine is
 * an LLM call, and Atlas Case 007 already established that intent/purpose
 * language ("so we'd catch drift going forward") must NOT be admitted as
 * claim_type "outcome" — a real confirmed result. Nothing prevents a live
 * Listen Engine from mis-tagging aspirational language as "outcome" the
 * way Case 007's correct reading refused to; the Evidence Validator checks
 * grounding and claim_type-enum fit, not "is this genuinely a completed
 * result vs. a stated intention." So an evidence-derived presence claim is
 * not infallible.
 *
 * But between the two SPECIFIC claims in conflict — an ABSENCE claim
 * (regex's "no result marker phrase appeared anywhere") and a PRESENCE
 * claim (an admissibly-grounded, verbatim-quoted `outcome` node) — presence
 * is the structurally stronger claim. Proving a negative from keyword
 * absence only shows the specific phrase pattern didn't appear, never that
 * the underlying concept doesn't exist (exactly what the CNC case
 * demonstrates: "Scrap rate...dropped back to normal" is a real result,
 * just not phrased with a marker regex recognizes). A grounded presence
 * claim, even with the Case-007-style misclassification risk acknowledged,
 * is more informative than an absence heuristic that can only ever fail to
 * find a keyword. This is the same reasoning already used to set the
 * adapter's confidence above regex's absence-detection cap (see
 * src/adapter.ts) applied consistently here: presence beats absence when
 * they contradict for rendering purposes. The risk is named, not hidden —
 * this rule can render a false "needs a number" note if the Listen Engine
 * ever mis-tags aspirational language as an outcome; that risk is accepted
 * and documented, not silently assumed away.
 *
 * SCOPE: this resolves ONLY what gets handed to quickScan() for RENDERING.
 * decide()'s own candidates array is untouched — its tiebreak (confidence
 * 0.8 beats 0.5) already resolves which one gets SELECTED correctly; that
 * was never the bug. The bug was quickScan's uncapped flag loop showing
 * both regardless of what got selected.
 *
 * NOT A ONE-OFF LAB HACK: this table is a rehearsal for a real requirement
 * any future production merge (a real Track A, RFC Stage 2/3) will also
 * need once more than one candidate-producing source can disagree about
 * the same underlying fact. Today it has exactly one entry, because O3 is
 * the only opportunity id with a two-state "ladder" sibling in the real
 * OpportunityId enum (see Step 5 / README.md) — but the shape of the
 * problem (two independent sources, one contract) is general, not specific
 * to O3.
 */

export interface LadderRule {
  name: string;
  /** the id asserting the fact is ABSENT */
  absence_id: string;
  /** the id asserting the fact is PRESENT (but incomplete in some way) */
  presence_id: string;
  reasoning: string;
}

export const LADDER_EXCLUSIVITY_RULES: LadderRule[] = [
  {
    name: "O3 result ladder",
    absence_id: "O3_missing_result",
    presence_id: "O3_unquantified_result",
    reasoning:
      "Structurally mutually exclusive within a single regex pass " +
      "(opportunity-engine/src/detectors.ts: both read the same " +
      "structure_result_marker presence/absence). Only co-occur when a " +
      "regex source and an evidence source disagree about whether a " +
      "result was stated. Presence (a grounded outcome claim) wins for " +
      "rendering: an absence heuristic can only prove a keyword didn't " +
      "appear, never that the concept doesn't exist.",
  },
];

/**
 * SECOND real incident, found on a fresh transcript (a checkout-service
 * outage story), not hypothesized: the fix above has an invariant it can
 * silently break. In the FROZEN, single-source system (quickScan fed
 * candidates.map(id) directly, decide() only ever selects an
 * opportunity_id that was already IN that same candidates array —
 * confirmed by reading decision-engine/src/engine.ts: `pick` is always a
 * reference into the input `candidates` array, never invented), whatever
 * decide() selects as Today's Focus is STRUCTURALLY GUARANTEED to also
 * appear as a rendered flag in quickScan. That guarantee held for BOTH
 * columns in this package too, right up until the first version of
 * `resolveLadderConflictsForRendering` above — the first code in this
 * whole session that filters the id list handed to quickScan WITHOUT
 * consulting what decide() actually selected.
 *
 * Concretely: on the checkout-outage transcript, `O4_ownership_hiding`
 * co-fires and cites `O3_missing_result` as its upstream cause, which
 * promotes `O3_missing_result` to Decision Engine priority class
 * "root_cause" — a classification that outranks everything by fixed
 * hierarchy (blocking > root_cause > mission_aligned > standard...),
 * regardless of confidence. `O3_missing_result` is SELECTED as Today's
 * Focus. But the original fix above unconditionally dropped
 * `O3_missing_result`'s flag ("No result stated") from rendering purely
 * because `O3_unquantified_result` also fired — leaving Coach's Notes with
 * NO flag at all corresponding to the thing actually being coached.
 *
 * Resolution: never suppress the id decide() actually selected this turn,
 * even if that means occasionally re-showing the contradictory pair. This
 * is a deliberate, reasoned trade-off, not an oversight: hiding the
 * explanation for the literal coaching action is a strictly worse failure
 * mode than a visible, already-documented contradiction. Restoring the
 * frozen system's own invariant (selected focus is always explainable by
 * at least one rendered flag) takes priority over "never show a
 * contradiction" — the latter was always a heuristic preference for the
 * common case, not an absolute rule, and this package must not violate a
 * guarantee the ORIGINAL system always held.
 *
 * This does NOT touch decide()'s own candidate pool or selection logic —
 * whether O3_missing_result SHOULD be able to win root_cause priority when
 * an evidence source directly contradicts its own premise is a real, open
 * Decision-Engine-level design question, explicitly out of scope here
 * (Stage 2/3 RFC territory, same as the adapter's flat-confidence finding
 * in README.md Section 6) — named, not silently fixed.
 */

/**
 * Applied to a firedOpportunityIds list BEFORE it's handed to quickScan().
 * For any rule where BOTH ids are present, drops the absence_id — UNLESS
 * the absence_id is exactly the id `decide()` selected as Today's Focus
 * this turn (`selectedOpportunityId`), in which case it is never dropped:
 * the selected focus must always remain explainable by a rendered flag.
 *
 * Safe no-op on any single-source id list: Step 2 confirmed a single
 * regex pass can never produce both ids of any rule here, so there is
 * nothing for this function to do on LEFT's own candidates — confirmed by
 * a dedicated regression test (test/ladderExclusivity.test.ts) rather than
 * asserted from reasoning alone.
 */
export function resolveLadderConflictsForRendering(
  firedOpportunityIds: string[],
  selectedOpportunityId?: string | null
): string[] {
  let ids = firedOpportunityIds;
  for (const rule of LADDER_EXCLUSIVITY_RULES) {
    if (rule.absence_id === selectedOpportunityId) continue;
    if (ids.includes(rule.absence_id) && ids.includes(rule.presence_id)) {
      ids = ids.filter((id) => id !== rule.absence_id);
    }
  }
  return ids;
}
