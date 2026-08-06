/**
 * Detectors — one pure function per candidate opportunity.
 * Each returns a Detection (evidence + confidence) or null. No ranking anywhere.
 *
 * Confidence discipline: derived from the confidences of the underlying
 * observations and the strength of the rule. Absence-based detections over
 * LOW-confidence heuristics (the 0.5-cap STAR keyword signals) are themselves
 * capped low — in production the LLM Listen stage's structural map raises
 * these; here we stay honest about what keyword absence can prove.
 */
import {
  InEvidence, InObservation, ObservationSetInput, OpportunityContext,
  OpportunityEvidence, OpportunityId,
} from "./types";
import { DetectorConfig } from "./registry";

export interface Detection {
  opportunity_id: OpportunityId;
  evidence: OpportunityEvidence;
  confidence: number;
}

const obsOf = (set: ObservationSetInput, type: string): InObservation | undefined =>
  set.observations.find((o) => o.observation_type === type);

const spansOf = (o: InObservation | undefined, max = 6): InEvidence[] =>
  o ? o.evidence.slice(0, max) : [];

const clamp = (n: number) => Math.max(0.05, Math.min(1, Math.round(n * 100) / 100));

const ev = (
  spans: InEvidence[],
  cited: string[],
  metrics: OpportunityEvidence["metrics_cited"],
  absent: string[] = []
): OpportunityEvidence => ({
  spans, observation_types_cited: cited, metrics_cited: metrics, absent_signals: absent,
});

const STRUCTURE_TYPES = [
  "structure_situation_marker", "structure_task_marker",
  "structure_action_marker", "structure_result_marker",
] as const;

// ------------------------------------------------------------------ O2

export function detectRamble(set: ObservationSetInput, cfg: DetectorConfig): Detection | null {
  const { word_count } = set.metrics;
  if (word_count < cfg.ramble_min_words) return null;
  const present = STRUCTURE_TYPES.filter((t) => obsOf(set, t));
  if (present.length >= cfg.ramble_max_structure_marker_types) return null;

  const trailing = obsOf(set, "trailing_off");
  const absent = STRUCTURE_TYPES.filter((t) => !obsOf(set, t));
  // base 0.55 (absence over 0.5-conf heuristics), +0.1 trailing corroboration,
  // + up to 0.15 scaled by word excess
  const excess = Math.min((word_count - cfg.ramble_min_words) / cfg.ramble_min_words, 1);
  const confidence = clamp(0.55 + (trailing ? 0.1 : 0) + 0.15 * excess);

  return {
    opportunity_id: "O2_structureless_ramble",
    confidence,
    evidence: ev(
      spansOf(trailing),
      trailing ? ["trailing_off"] : [],
      [{ metric: "word_count", value: word_count, comparator: ">=", reference: cfg.ramble_min_words }],
      absent
    ),
  };
}

// ------------------------------------------------------------------ O3 (two variants)

export function detectMissingResult(set: ObservationSetInput): Detection | null {
  const marker = obsOf(set, "structure_result_marker");
  const finalR = obsOf(set, "result_in_final_sentence");
  if (marker || finalR) return null;
  // pure absence over 0.5-conf heuristics → capped at 0.5
  const metricsCited: OpportunityEvidence["metrics_cited"] =
    set.metrics.quantified_span_count === 0
      ? [{ metric: "quantified_span_count", value: 0, comparator: "==", reference: 0 }]
      : [];
  return {
    opportunity_id: "O3_missing_result",
    confidence: 0.5,
    evidence: ev([], [], metricsCited,
      ["structure_result_marker", "result_in_final_sentence"]),
  };
}

export function detectUnquantifiedResult(set: ObservationSetInput): Detection | null {
  const marker = obsOf(set, "structure_result_marker");
  if (!marker) return null; // that's O3_missing_result's territory
  if (set.metrics.quantified_span_count > 0) return null;
  // result language present (0.5-conf) + quantification absence (0.9-conf detector) → 0.7
  return {
    opportunity_id: "O3_unquantified_result",
    confidence: 0.7,
    evidence: ev(
      spansOf(marker),
      ["structure_result_marker"],
      [{ metric: "quantified_span_count", value: 0, comparator: "==", reference: 0 }],
      ["quantified_span"]
    ),
  };
}

// ------------------------------------------------------------------ O4

export function detectOwnershipHiding(
  set: ObservationSetInput, cfg: DetectorConfig, ctx?: OpportunityContext
): Detection | null {
  const { i_count, we_count, agency_verb_i_count } = set.metrics;

  // ---- existing we-heavy path (UNCHANGED) ----
  if (we_count >= cfg.ownership_min_we) {
    if (agency_verb_i_count > 0) return null;
    const ratio = we_count === 0 ? Infinity : i_count / we_count;
    if (ratio > cfg.ownership_max_i_to_we_ratio) return null;

    const weObs = obsOf(set, "first_person_plural");
    // pronoun counting is 0.95-conf; the INFERENCE (hiding vs honest team talk)
    // is weaker without segment-level attribution → 0.65 base, +0.1 if I≈0
    const confidence = clamp(0.65 + (i_count === 0 ? 0.1 : 0));
    return {
      opportunity_id: "O4_ownership_hiding",
      confidence,
      evidence: ev(
        spansOf(weObs),
        ["first_person_plural"],
        [
          { metric: "we_count", value: we_count, comparator: ">=", reference: cfg.ownership_min_we },
          { metric: "i_count", value: i_count, comparator: "ratio<=", reference: cfg.ownership_max_i_to_we_ratio },
          { metric: "agency_verb_i_count", value: 0, comparator: "==", reference: 0 },
        ],
        ["agency_verb_i"]
      ),
    };
  }

  // ---- V3.5: zero-agency path (additional, does not touch the above) ----
  return detectZeroAgencyOwnership(set, cfg, ctx);
}

/**
 * V3.5 — the most extreme case of invisible ownership: no first-person
 * language of ANY kind (not just "we"-heavy). The existing we-heavy path
 * above requires we_count >= ownership_min_we to even engage, so a fully
 * passive/agentless answer (i_count === 0 && we_count === 0) slipped through
 * untouched. Conservative by construction: requires a real behavioral
 * question (Step 0's ctx.question_type tag — never fires on opinion,
 * motivation, situational, unknown, or missing context) and a minimum
 * word count (ownership_zero_agency_min_words) so short fragments are
 * never flagged.
 */
function detectZeroAgencyOwnership(
  set: ObservationSetInput, cfg: DetectorConfig, ctx?: OpportunityContext
): Detection | null {
  const { i_count, we_count, word_count } = set.metrics;
  if (i_count !== 0 || we_count !== 0) return null;
  if (ctx?.question_type !== "behavioral") return null;
  if (word_count < cfg.ownership_zero_agency_min_words) return null;

  // Conservative: zero agency language of any kind is a cleaner signal than
  // the ratio-based we-heavy path above, but this pattern has no prior
  // real-world validation, so confidence starts at the LOW end of O4's
  // existing 0.65-0.75 range rather than above it (matches this file's own
  // discipline of capping unvalidated absence-based inferences low).
  const confidence = clamp(0.6);

  return {
    opportunity_id: "O4_ownership_hiding",
    confidence,
    evidence: ev(
      [], [],
      [
        { metric: "i_count", value: 0, comparator: "==", reference: 0 },
        { metric: "we_count", value: 0, comparator: "==", reference: 0 },
        { metric: "word_count", value: word_count, comparator: ">=", reference: cfg.ownership_zero_agency_min_words },
      ],
      ["first_person_singular", "first_person_plural", "agency_verb_i"]
    ),
  };
}

// ------------------------------------------------------------------ O5

export function detectVagueness(
  set: ObservationSetInput, cfg: DetectorConfig, ctx?: OpportunityContext
): Detection | null {
  const m = set.metrics;

  // ---- V3.5: below the existing floor, try the zero-specificity path
  // instead of unconditionally bailing. The >=60-word path below this
  // block is otherwise completely UNCHANGED and never runs for these
  // shorter answers, so normal-length behavior is untouched. ----
  if (m.word_count < cfg.vagueness_min_words) {
    return detectZeroSpecificityVagueness(set, cfg, ctx);
  }

  if (m.quantified_span_count > 0 || m.numeric_span_count > 0) return null;

  const hyp = obsOf(set, "hypothetical_marker");
  const hypBoost =
    (hyp && m.hypothetical_marker_count >= cfg.vagueness_min_hypotheticals_boost) ? 0.1 : 0;
  const behavioralBoost = ctx?.question_type === "behavioral" && hypBoost > 0 ? 0.1 : 0;
  const confidence = clamp(0.55 + hypBoost + behavioralBoost);

  return {
    opportunity_id: "O5_vagueness",
    confidence,
    evidence: ev(
      spansOf(hyp),
      hyp ? ["hypothetical_marker"] : [],
      [
        { metric: "quantified_span_count", value: 0, comparator: "==", reference: 0 },
        { metric: "numeric_span_count", value: 0, comparator: "==", reference: 0 },
        { metric: "word_count", value: m.word_count, comparator: ">=", reference: cfg.vagueness_min_words },
      ],
      ["quantified_span", "numeric_span"]
    ),
  };
}

/**
 * V3.5 — very short, zero-specificity answers avoided vagueness detection
 * entirely because they never reached the 60-word floor above: the vaguest
 * possible answers got a pass purely for being brief. This path only
 * engages in the gap below that floor (never overlapping with it) and
 * requires the COMPLETE absence of every existing observation type that
 * genuinely indicates concrete specificity:
 *  - quantified_span / numeric_span: an actual number, percent, or amount.
 *  - structure_action_marker: a stated action-transition phrase ("so I",
 *    "then I", "I decided", ...) — a named action step.
 *  - agency_verb_i: "I" + a specific action verb from the agency lexicon
 *    (redesigned, fixed, proposed, ...) — a named, concrete personal action.
 * Deliberately excluded, with reasons: presence_verb_i ("I helped/was
 * involved") denotes participation without specificity — it's not concrete
 * evidence, and the observation engine's own design already separates it
 * from agency_verb_i for this reason. structure_situation_marker /
 * structure_task_marker / structure_result_marker / result_in_final_sentence
 * are about STAR-shape story structure, not content specificity — a result
 * marker ("as a result... improved") states that a result-shaped clause
 * exists without naming anything concrete about it, which is exactly the
 * unquantified-result gap O3_unquantified_result already covers separately;
 * counting it here would let a shape-only answer dodge the specificity
 * check it's meant to catch. Requires a real behavioral question (Step 0's
 * ctx.question_type tag), never fires on opinion/hypothetical/situational
 * questions, and requires a minimum word count so true fragments are never
 * flagged.
 */
function detectZeroSpecificityVagueness(
  set: ObservationSetInput, cfg: DetectorConfig, ctx?: OpportunityContext
): Detection | null {
  const m = set.metrics;
  if (ctx?.question_type !== "behavioral") return null;
  if (m.word_count < cfg.vagueness_zero_specificity_min_words) return null;
  if (m.quantified_span_count > 0 || m.numeric_span_count > 0) return null;
  if (obsOf(set, "structure_action_marker")) return null;
  if (obsOf(set, "agency_verb_i")) return null;

  // Conservative: no hypothetical-marker corroboration is available at this
  // length (that boost belongs to the >=60-word path, unchanged above), so
  // this sits at the low end of O5's existing confidence range.
  const confidence = clamp(0.5);

  return {
    opportunity_id: "O5_vagueness",
    confidence,
    evidence: ev(
      [], [],
      [
        { metric: "word_count", value: m.word_count, comparator: ">=", reference: cfg.vagueness_zero_specificity_min_words },
        { metric: "quantified_span_count", value: 0, comparator: "==", reference: 0 },
        { metric: "numeric_span_count", value: 0, comparator: "==", reference: 0 },
      ],
      ["quantified_span", "numeric_span", "structure_action_marker", "agency_verb_i"]
    ),
  };
}

// ------------------------------------------------------------------ O7

export function detectWeakClose(set: ObservationSetInput): Detection | null {
  const hedge = obsOf(set, "closing_hedge");
  const trail = obsOf(set, "trailing_off");
  const src = hedge ?? trail;
  if (!src) return null;
  return {
    opportunity_id: "O7_weak_close",
    confidence: clamp(src.confidence * 0.95), // direct single-observation passthrough
    evidence: ev(spansOf(src), [src.observation_type], [], []),
  };
}

// ------------------------------------------------------------------ O8 (context-gated)

export function detectBuriedLede(
  set: ObservationSetInput, cfg: DetectorConfig, ctx?: OpportunityContext
): Detection | null {
  if (!ctx || (ctx.question_type !== "opinion" && ctx.question_type !== "motivation")) return null;
  if (set.metrics.word_count < cfg.lede_min_words) return null;
  const sit = obsOf(set, "structure_situation_marker");
  const openingSpans = sit ? sit.evidence.filter((e) => e.sentence_index === 0) : [];
  if (openingSpans.length === 0) return null;
  // gated + heuristic opener detection → deliberately low confidence
  return {
    opportunity_id: "O8_buried_lede",
    confidence: 0.45,
    evidence: ev(openingSpans, ["structure_situation_marker"],
      [{ metric: "word_count", value: set.metrics.word_count, comparator: ">=", reference: cfg.lede_min_words }],
      []),
  };
}

// ------------------------------------------------------------------ O10

export function detectFillerDensity(set: ObservationSetInput, cfg: DetectorConfig): Detection | null {
  const m = set.metrics;
  if (m.filler_per_minute < cfg.filler_per_minute_threshold) return null;
  const core = obsOf(set, "filler_core");
  const base = 0.8; // core filler detection is 0.95-conf; density inference solid
  const confidence = clamp(m.duration_is_estimated
    ? base * cfg.estimated_duration_confidence_penalty : base);
  return {
    opportunity_id: "O10_filler_density",
    confidence,
    evidence: ev(spansOf(core), core ? ["filler_core"] : [],
      [{ metric: "filler_per_minute", value: m.filler_per_minute, comparator: ">=",
         reference: cfg.filler_per_minute_threshold }],
      []),
  };
}

// ------------------------------------------------------------------ O11

export function detectEmployerNegativity(set: ObservationSetInput): Detection | null {
  const neg = obsOf(set, "employer_negativity");
  if (!neg) return null;
  return {
    opportunity_id: "O11_employer_negativity",
    confidence: clamp(neg.confidence), // passthrough of the observation's own confidence
    evidence: ev(spansOf(neg), ["employer_negativity"], [], []),
  };
}
