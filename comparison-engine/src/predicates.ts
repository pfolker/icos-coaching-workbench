/**
 * Predicates — the deterministic core.
 * Verdicts come from per-opportunity success rules over the RETRY
 * observations, with the ORIGINAL metrics as the baseline for relative rules.
 * Copy never decides; these do.
 */
import {
  BankedFlaw, DimensionEvidence, ObservationIn, ObservationSetIn, SourcedSpan, Verdict,
} from "./types";
import { ComparisonConfig, OPP_META } from "./registry";

const obsOf = (s: ObservationSetIn, type: string): ObservationIn | undefined =>
  s.observations.find((o) => o.observation_type === type);

/** Minimal shape non-numeric-gain checking actually needs — deliberately
 * narrower than ObservationSetIn so callers outside this package (e.g.
 * alpha-workbench's Interviewer's Notebook) can pass their own local
 * observation-set shape without needing to satisfy this module's full type. */
interface ObservationsOnly {
  observations: { observation_type: string }[];
}
const hasObsType = (s: ObservationsOnly, type: string) => s.observations.some((o) => o.observation_type === type);

/**
 * Non-numeric structural specificity gained in the retry vs. the original.
 * Shared by O5_vagueness's own verdict below AND alpha-workbench's
 * Interviewer's Notebook (proof.ts) — both learner-facing surfaces read
 * "did this get better" off this ONE computation now, not two independently
 * maintained checks that merely happened to agree (the exact bug this was
 * extracted to close: the Notebook previously used a presence-anywhere
 * check while this verdict used newly-present-in-retry, and they disagreed
 * on a real founder answer as a result).
 */
export function nonNumericStructureGained(original: ObservationsOnly, retry: ObservationsOnly): {
  taskGained: boolean; actionGained: boolean; gained: boolean;
} {
  const taskGained = hasObsType(retry, "structure_task_marker") && !hasObsType(original, "structure_task_marker");
  const actionGained = hasObsType(retry, "structure_action_marker") && !hasObsType(original, "structure_action_marker");
  return { taskGained, actionGained, gained: taskGained || actionGained };
}

const spans = (s: ObservationSetIn, type: string, source: "original" | "retry", max = 3): SourcedSpan[] =>
  (obsOf(s, type)?.evidence ?? []).slice(0, max).map((e) => ({ ...e, source }));

/** Resolve a span to its full sentence (trailing punctuation trimmed), verbatim. */
export function sentenceSpan(
  set: ObservationSetIn, span: SourcedSpan
): SourcedSpan {
  const s = set.sentences[span.sentence_index];
  if (!s) return span;
  let end = s.char_end;
  let text = s.text;
  while (text.length > 1 && /[.!?]$/.test(text)) { text = text.slice(0, -1); end--; }
  return { sentence_index: s.index, char_start: s.char_start, char_end: end, span_text: text, source: span.source };
}

export interface VerdictResult {
  verdict: Verdict;
  retry_evidence: DimensionEvidence;
  original_evidence: DimensionEvidence;
  /** best retry span to quote in reinforcement, sentence-resolved */
  retry_quote: SourcedSpan | null;
  summary: string;
}

const metricPair = (o: ObservationSetIn, r: ObservationSetIn, m: keyof ObservationSetIn["metrics"] & string) =>
  ({ metric: m, original: Number(o.metrics[m] ?? 0), retry: Number(r.metrics[m] ?? 0) });

export function judge(
  opportunityId: string,
  original: ObservationSetIn,
  retry: ObservationSetIn,
  cfg: ComparisonConfig
): VerdictResult {
  const O = original, R = retry;
  const base = (verdict: Verdict, summary: string, over: Partial<VerdictResult> = {}): VerdictResult => ({
    verdict, summary,
    retry_evidence: { spans: [], metrics_cited: [], absent_signals: [] },
    original_evidence: { spans: [], metrics_cited: [], absent_signals: [] },
    retry_quote: null,
    ...over,
  });

  switch (opportunityId) {
    case "O3_unquantified_result": {
      const quant = spans(R, "quantified_span", "retry");
      const bare = spans(R, "numeric_span", "retry");
      const pair = metricPair(O, R, "quantified_span_count");
      if (quant.length > 0) {
        const q = sentenceSpan(R, quant[0]!);
        return base("achieved", `quantified_span_count ${pair.original} -> ${pair.retry}`, {
          retry_evidence: { spans: quant, metrics_cited: [pair], absent_signals: [] },
          original_evidence: { spans: spans(O, "structure_result_marker", "original"), metrics_cited: [pair], absent_signals: ["quantified_span"] },
          retry_quote: q,
        });
      }
      if (bare.length > 0) {
        return base("partial", "bare numeral appeared; no unit or magnitude framing yet", {
          retry_evidence: { spans: bare, metrics_cited: [metricPair(O, R, "numeric_span_count")], absent_signals: ["quantified_span"] },
          original_evidence: { spans: [], metrics_cited: [], absent_signals: ["quantified_span", "numeric_span"] },
        });
      }
      return base("not_yet", "no quantification in retry", {
        retry_evidence: { spans: [], metrics_cited: [pair], absent_signals: ["quantified_span", "numeric_span"] },
        original_evidence: { spans: [], metrics_cited: [], absent_signals: ["quantified_span"] },
      });
    }

    case "O3_missing_result": {
      const marker = spans(R, "structure_result_marker", "retry");
      const finalR = obsOf(R, "result_in_final_sentence");
      const quant = spans(R, "quantified_span", "retry");
      if (marker.length > 0 || finalR || quant.length > 0) {
        const src = marker[0] ?? quant[0] ?? null;
        return base("achieved", "result signal present in retry", {
          retry_evidence: { spans: [...marker, ...quant].slice(0, 3), metrics_cited: [], absent_signals: [] },
          original_evidence: { spans: [], metrics_cited: [], absent_signals: ["structure_result_marker", "result_in_final_sentence"] },
          retry_quote: src ? sentenceSpan(R, src) : null,
        });
      }
      return base("not_yet", "still no result signal in retry", {
        retry_evidence: { spans: [], metrics_cited: [], absent_signals: ["structure_result_marker", "result_in_final_sentence", "quantified_span"] },
        original_evidence: { spans: [], metrics_cited: [], absent_signals: ["structure_result_marker"] },
      });
    }

    case "O2_structureless_ramble": {
      const wc = metricPair(O, R, "word_count");
      const types = ["structure_situation_marker", "structure_task_marker", "structure_action_marker", "structure_result_marker"];
      const oTypes = types.filter((t) => obsOf(O, t)).length;
      const rTypes = types.filter((t) => obsOf(R, t)).length;
      const stillRambles = wc.retry >= cfg.ramble_min_words && rTypes < 2;
      if (!stillRambles) {
        return base("achieved", `word_count ${wc.original} -> ${wc.retry}; structure marker types ${oTypes} -> ${rTypes}`, {
          retry_evidence: { spans: types.flatMap((t) => spans(R, t, "retry", 1)), metrics_cited: [wc], absent_signals: [] },
          original_evidence: { spans: [], metrics_cited: [wc], absent_signals: [] },
        });
      }
      const dropped = wc.retry <= wc.original * (1 - cfg.ramble_word_drop_partial);
      if (dropped || rTypes > oTypes) {
        return base("partial", `word_count ${wc.original} -> ${wc.retry}; marker types ${oTypes} -> ${rTypes}`, {
          retry_evidence: { spans: [], metrics_cited: [wc], absent_signals: [] },
          original_evidence: { spans: [], metrics_cited: [wc], absent_signals: [] },
        });
      }
      return base("not_yet", `word_count ${wc.original} -> ${wc.retry}; still unstructured`, {
        retry_evidence: { spans: [], metrics_cited: [wc], absent_signals: types },
        original_evidence: { spans: [], metrics_cited: [wc], absent_signals: types },
      });
    }

    case "O4_ownership_hiding": {
      const agency = spans(R, "agency_verb_i", "retry");
      const iPair = metricPair(O, R, "i_count");
      if (agency.length > 0) {
        return base("achieved", `agency_verb_i 0 -> ${agency.length}; i_count ${iPair.original} -> ${iPair.retry}`, {
          retry_evidence: { spans: agency, metrics_cited: [iPair, metricPair(O, R, "agency_verb_i_count")], absent_signals: [] },
          original_evidence: { spans: spans(O, "first_person_plural", "original"), metrics_cited: [iPair], absent_signals: ["agency_verb_i"] },
          retry_quote: sentenceSpan(R, agency[0]!),
        });
      }
      if (iPair.retry > iPair.original) {
        return base("partial", `i_count ${iPair.original} -> ${iPair.retry}; agency verbs still absent`, {
          retry_evidence: { spans: spans(R, "first_person_singular", "retry"), metrics_cited: [iPair], absent_signals: ["agency_verb_i"] },
          original_evidence: { spans: [], metrics_cited: [iPair], absent_signals: ["agency_verb_i"] },
        });
      }
      return base("not_yet", "ownership language unchanged", {
        retry_evidence: { spans: [], metrics_cited: [iPair], absent_signals: ["agency_verb_i"] },
        original_evidence: { spans: [], metrics_cited: [iPair], absent_signals: ["agency_verb_i"] },
      });
    }

    case "O5_vagueness": {
      const quant = spans(R, "quantified_span", "retry");
      const bare = spans(R, "numeric_span", "retry");
      if (quant.length > 0) {
        return base("achieved", `quantified_span_count 0 -> ${quant.length}`, {
          retry_evidence: { spans: quant, metrics_cited: [metricPair(O, R, "quantified_span_count")], absent_signals: [] },
          original_evidence: { spans: [], metrics_cited: [], absent_signals: ["quantified_span", "numeric_span"] },
          retry_quote: sentenceSpan(R, quant[0]!),
        });
      }
      if (bare.length > 0) {
        return base("partial", "bare specifics appeared", {
          retry_evidence: { spans: bare, metrics_cited: [], absent_signals: ["quantified_span"] },
          original_evidence: { spans: [], metrics_cited: [], absent_signals: ["quantified_span"] },
        });
      }
      // V3.7 fix: O5's own coaching ask ("name the machine, the week, the
      // part") never requires a number, but this verdict used to check only
      // quantified_span/numeric_span — contradicting O5's own copy. Widened
      // ONLY the not_yet/partial boundary (achieved stays numeric-only,
      // unchanged above): a structure_task_marker or structure_action_marker
      // that is NEW in the retry (absent in the original) counts as
      // non-numeric narrative specificity gained. "New to the retry" matches
      // the comparison pattern already used elsewhere in this function
      // (O2's rTypes > oTypes, O4's iPair.retry > iPair.original) rather
      // than a bare presence check, so a marker the original already had
      // doesn't get miscredited as improvement. V3.9: this computation now
      // lives in the exported nonNumericStructureGained() so alpha-workbench's
      // Notebook reads the same fact instead of a second, independent check.
      const { taskGained, actionGained, gained } = nonNumericStructureGained(O, R);
      if (gained) {
        const gainedType = taskGained ? "structure_task_marker" : "structure_action_marker";
        return base("partial", `${gainedType} newly present in retry (non-numeric specificity gained)`, {
          retry_evidence: { spans: spans(R, gainedType, "retry"), metrics_cited: [], absent_signals: ["quantified_span", "numeric_span"] },
          original_evidence: { spans: [], metrics_cited: [], absent_signals: ["quantified_span", "numeric_span"] },
        });
      }
      return base("not_yet", "still no verifiable specifics", {
        retry_evidence: { spans: [], metrics_cited: [], absent_signals: ["quantified_span", "numeric_span"] },
        original_evidence: { spans: [], metrics_cited: [], absent_signals: ["quantified_span", "numeric_span"] },
      });
    }

    case "O7_weak_close": {
      const hedge = obsOf(R, "closing_hedge");
      const trail = obsOf(R, "trailing_off");
      const oHad = (obsOf(O, "closing_hedge") ? 1 : 0) + (obsOf(O, "trailing_off") ? 1 : 0);
      const rHas = (hedge ? 1 : 0) + (trail ? 1 : 0);
      if (rHas === 0) {
        const last = R.sentences[R.sentences.length - 1];
        const q: SourcedSpan | null = last
          ? sentenceSpan(R, { sentence_index: last.index, char_start: last.char_start, char_end: last.char_end, span_text: last.text, source: "retry" })
          : null;
        return base("achieved", "no weak-close signals in retry", {
          retry_evidence: { spans: q ? [q] : [], metrics_cited: [], absent_signals: ["closing_hedge", "trailing_off"] },
          original_evidence: { spans: spans(O, "closing_hedge", "original") .concat(spans(O, "trailing_off", "original")), metrics_cited: [], absent_signals: [] },
          retry_quote: q,
        });
      }
      if (rHas < oHad) {
        return base("partial", "one weak-close signal cleared, one remains", {
          retry_evidence: { spans: spans(R, hedge ? "closing_hedge" : "trailing_off", "retry"), metrics_cited: [], absent_signals: [] },
          original_evidence: { spans: [], metrics_cited: [], absent_signals: [] },
        });
      }
      return base("not_yet", "weak close persists", {
        retry_evidence: { spans: spans(R, hedge ? "closing_hedge" : "trailing_off", "retry"), metrics_cited: [], absent_signals: [] },
        original_evidence: { spans: [], metrics_cited: [], absent_signals: [] },
      });
    }

    case "O8_buried_lede": {
      const sit = obsOf(R, "structure_situation_marker");
      const inS0 = sit?.evidence.some((e) => e.sentence_index === 0) ?? false;
      return inS0
        ? base("not_yet", "opener still situational", {
            retry_evidence: { spans: spans(R, "structure_situation_marker", "retry", 1), metrics_cited: [], absent_signals: [] },
            original_evidence: { spans: [], metrics_cited: [], absent_signals: [] },
          })
        : base("achieved", "opener no longer situational", {
            retry_evidence: { spans: [], metrics_cited: [], absent_signals: ["structure_situation_marker@s0"] },
            original_evidence: { spans: spans(O, "structure_situation_marker", "original", 1), metrics_cited: [], absent_signals: [] },
          });
    }

    case "O10_filler_density": {
      const f = metricPair(O, R, "filler_per_minute");
      if (f.retry < cfg.filler_per_minute_threshold) {
        return base("achieved", `filler_per_minute ${f.original} -> ${f.retry}`, {
          retry_evidence: { spans: [], metrics_cited: [f], absent_signals: [] },
          original_evidence: { spans: spans(O, "filler_core", "original"), metrics_cited: [f], absent_signals: [] },
        });
      }
      if (f.retry <= f.original * (1 - cfg.filler_drop_partial)) {
        return base("partial", `filler_per_minute ${f.original} -> ${f.retry}`, {
          retry_evidence: { spans: [], metrics_cited: [f], absent_signals: [] },
          original_evidence: { spans: [], metrics_cited: [f], absent_signals: [] },
        });
      }
      return base("not_yet", `filler_per_minute ${f.original} -> ${f.retry}`, {
        retry_evidence: { spans: spans(R, "filler_core", "retry"), metrics_cited: [f], absent_signals: [] },
        original_evidence: { spans: [], metrics_cited: [f], absent_signals: [] },
      });
    }

    case "O11_employer_negativity": {
      const oNeg = obsOf(O, "employer_negativity");
      const rNeg = obsOf(R, "employer_negativity");
      const oCount = oNeg?.evidence.length ?? 0;
      const rCount = rNeg?.evidence.length ?? 0;
      if (rCount === 0) {
        return base("achieved", `employer_negativity ${oCount} -> 0`, {
          retry_evidence: { spans: [], metrics_cited: [], absent_signals: ["employer_negativity"] },
          original_evidence: { spans: spans(O, "employer_negativity", "original"), metrics_cited: [], absent_signals: [] },
        });
      }
      if (rCount < oCount) {
        return base("partial", `employer_negativity ${oCount} -> ${rCount}`, {
          retry_evidence: { spans: spans(R, "employer_negativity", "retry"), metrics_cited: [], absent_signals: [] },
          original_evidence: { spans: [], metrics_cited: [], absent_signals: [] },
        });
      }
      return base("not_yet", `employer_negativity ${oCount} -> ${rCount}`, {
        retry_evidence: { spans: spans(R, "employer_negativity", "retry"), metrics_cited: [], absent_signals: [] },
        original_evidence: { spans: [], metrics_cited: [], absent_signals: [] },
      });
    }

    default:
      return base("not_yet", `unknown opportunity ${opportunityId}; conservative verdict`, {});
  }
}

/**
 * Silent flaw banking (JA-05): NEW problems in the retry, relative to the
 * original, excluding the coached opportunity itself. Never learner-facing.
 */
export function bankNewFlaws(
  selectedId: string,
  original: ObservationSetIn,
  retry: ObservationSetIn,
  cfg: ComparisonConfig
): BankedFlaw[] {
  const out: BankedFlaw[] = [];
  const add = (opportunity_id: string, evidence: SourcedSpan[], confidence: number, note: string) => {
    if (opportunity_id === selectedId) return;
    const meta = OPP_META[opportunity_id];
    if (!meta) return;
    out.push({ opportunity_id, habit_id: meta.habit_id, evidence, confidence, note });
  };

  const newly = (type: string) => !obsOf(original, type) && !!obsOf(retry, type);

  if (newly("closing_hedge") || newly("trailing_off")) {
    const type = obsOf(retry, "closing_hedge") ? "closing_hedge" : "trailing_off";
    add("O7_weak_close", spans(retry, type, "retry"), 0.7, `new ${type} appeared in retry`);
  }
  if (newly("employer_negativity")) {
    add("O11_employer_negativity", spans(retry, "employer_negativity", "retry"), 0.6, "employer negativity appeared in retry");
  }
  const qO = Number(original.metrics.quantified_span_count ?? 0);
  const qR = Number(retry.metrics.quantified_span_count ?? 0);
  if (qO > 0 && qR === 0) {
    add("O3_unquantified_result", [], 0.6, `quantification lost in retry (${qO} -> 0)`);
  }
  const fO = Number(original.metrics.filler_per_minute ?? 0);
  const fR = Number(retry.metrics.filler_per_minute ?? 0);
  if (fR >= cfg.filler_per_minute_threshold && fR >= fO * (1 + cfg.banked_filler_rise)) {
    add("O10_filler_density", spans(retry, "filler_core", "retry"), 0.6, `filler rose ${fO} -> ${fR}`);
  }
  return out;
}
