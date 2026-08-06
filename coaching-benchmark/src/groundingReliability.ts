/**
 * Grounding-system reliability metric (Phase 2, item 5) — HF-006.
 *
 * This tests `grounding.ts`'s OWN behavior, independently of the coach and
 * NOT folded into the coach's pass/fail. HF-006 is the false-positive class:
 * a coarse lexical grounding check can flag legitimate paraphrase/connector
 * words as if fabricated. So the metric here is deliberately two-sided and
 * reported honestly (not rigged to zero — the residual false-positive
 * tendency IS the finding):
 *   - fabrication detection rate: does grounding still catch genuinely
 *     ungrounded named entities (the HF-001 class)? Must stay high.
 *   - false-positive rate: how often does grounding flag a legitimate
 *     paraphrase of real evidence? Reported as-is.
 *
 * Evidence is Case 001's real Evidence Graph node quotes, so the stem match
 * is against real evidence, not a toy.
 */
import { groundingCheck } from "../../coaching-runtime/src/grounding";
import { validateEvidence } from "../../evidence-validator/src/index";
import { materializeSourceSpans } from "../../evidence-runtime/src/modelOutput";
import { buildEvidenceGraph } from "../../evidence-runtime/src/evidenceGraph";
import * as case001 from "../../evidence-runtime/fixtures/case001";

export type ProbeLabel = "legitimate_paraphrase" | "fabrication";

export interface GroundingProbe {
  id: string;
  label: ProbeLabel;
  message: string;
  note?: string;
  /** true for probes that deliberately demonstrate the concrete-entity approach's
   * OWN new failure class (a fabricated tool absent from the curated vocabulary).
   * Kept on record, NOT tuned away — excluded from the required-detection rate so
   * the known cases stay honest while the limitation stays visible. */
  demonstrates_limitation?: boolean;
}

export interface GroundingProbeResult extends GroundingProbe {
  passed: boolean;
  ungrounded_terms: string[];
  /** did grounding do the right thing? legit→pass, fabrication→flag */
  correct: boolean;
}

export interface GroundingReliabilityReport {
  evidence_source: string;
  evidence_quote_count: number;
  probe_count: number;
  legitimate_count: number;
  fabrication_count: number;
  false_positive_count: number;
  false_positive_rate: number;
  /** detection over REQUIRED fabrications only (excludes deliberate limitation demos) */
  required_fabrication_detected_count: number;
  required_fabrication_count: number;
  required_fabrication_detection_rate: number;
  /** documented-limitation probes that were MISSED (the concrete-entity approach's own new failure class) */
  known_limitation_misses: GroundingProbeResult[];
  results: GroundingProbeResult[];
}

/** Case 001's real node quotes — what grounding checks against. */
export function case001EvidenceQuotes(): string[] {
  const graph = buildEvidenceGraph(validateEvidence(materializeSourceSpans(case001.TRANSCRIPT, case001.LISTEN_ENGINE_FIXTURE)));
  return graph.nodes.map((n) => n.quote);
}

/**
 * The probe set. Legitimate paraphrases lean on the documented Round-2
 * false-positive words (examining/source/inconsistency/suspected/rather/…) —
 * the exact ones that once false-fired. Fabrications inject a concrete named
 * tool absent from Case 001 (the HF-001 "indicator" class).
 */
export const GROUNDING_PROBES: GroundingProbe[] = [
  {
    id: "P1",
    label: "legitimate_paraphrase",
    message:
      "You named the fix: two locating divots machined into the part and a conical gripper profile, after realizing the robot was applying force that let the casting move on a rough casting surface.",
    note: "the corrected Case 001 message; documented as passing grounding after the fix",
  },
  {
    id: "P2",
    label: "legitimate_paraphrase",
    message:
      "You described examining how the fixture contacted the part, and pointed to the casting surface as the source of the inconsistency rather than the programming issue everyone first suspected.",
    note: "paraphrase built from the Round-2 false-positive vocabulary",
  },
  {
    id: "P3",
    label: "fabrication",
    message: "You used an indicator to check the part before and after the process.",
    note: "the actual HF-001 fabrication — 'indicator' appears nowhere in Case 001",
  },
  {
    id: "P4",
    label: "fabrication",
    message: "You measured the divots with a laser micrometer to confirm the tolerance.",
    note: "a different invented tool absent from Case 001",
  },
  // P5/P6 — the ACTUAL Phase 2 structured-coach live HF-001 raw messages that
  // grounding false-fired on ("investigative" / "noticing"). Kept verbatim as
  // permanent probes so the curated set can never again miss this real live
  // class: after the narrow grounding-tuning fix they must PASS; if they ever
  // regress to FLAG, that is a real signal, not noise. See LESSON below.
  {
    id: "P5",
    label: "legitimate_paraphrase",
    message:
      "You described a clear investigative path — watching the process, talking with operators, and examining the fixture contact — that led you from \"everyone thought it was a programming issue\" to identifying that the casting wasn't being located consistently, and then to a specific mechanical fix (the locating divots and conical gripper pads).",
    note: "Phase 2 live HF-001 run 1 — false-fired on 'investigative' before the fix",
  },
  {
    id: "P6",
    label: "legitimate_paraphrase",
    message:
      "You laid out a clear diagnostic path here — from noticing everyone assumed a programming issue, to watching the process and fixture contact yourself, to identifying that the casting wasn't locating consistently, and then tracing that all the way through to a mechanical fix with the divots and conical gripper pads.",
    note: "Phase 2 live HF-001 run 2 — false-fired on 'noticing' before the fix",
  },
  {
    id: "P7",
    label: "fabrication",
    demonstrates_limitation: true,
    message: "You aligned the part with a theodolite before running the process.",
    note: "NEW FAILURE CLASS of the concrete-entity approach: 'theodolite' is a real fabricated instrument absent from Case 001, but it is NOT in the curated vocabulary, so it is MISSED. Kept as an honest record, not tuned away by adding the word.",
  },
];

/**
 * PERMANENT LESSON (do not delete once the fix "looks clean"):
 * In Phase 2 the curated probe set above reported a grounding false-positive
 * rate of 0.00, while the structured coach's REAL live HF-001 output had a
 * false-positive rate of ~1.00 (it false-fired on 'investigative'/'noticing'
 * every run). Curated testing missed a real class the live model reached for.
 * P5/P6 exist so that gap stays visible in the benchmark itself, not just in a
 * one-time report. The general limitation — coarse lexical grounding needs
 * ongoing tuning against live output — is not "solved" by adding two words.
 */
export const CURATED_VS_LIVE_LESSON =
  "Phase 2: curated grounding FP rate 0.00 vs live FP ~1.00 (investigative/noticing). Curated sets miss classes live models reach for; lexical grounding needs ongoing live tuning.";

export function runGroundingReliability(probes: GroundingProbe[] = GROUNDING_PROBES): GroundingReliabilityReport {
  const evidence = case001EvidenceQuotes();
  const results: GroundingProbeResult[] = probes.map((p) => {
    const g = groundingCheck(p.message, evidence);
    const correct = p.label === "legitimate_paraphrase" ? g.passed : !g.passed;
    return { ...p, passed: g.passed, ungrounded_terms: g.ungrounded_terms, correct };
  });

  const legit = results.filter((r) => r.label === "legitimate_paraphrase");
  const fab = results.filter((r) => r.label === "fabrication");
  const requiredFab = fab.filter((r) => !r.demonstrates_limitation);
  const false_positive_count = legit.filter((r) => !r.passed).length;
  const required_fabrication_detected_count = requiredFab.filter((r) => !r.passed).length;
  const known_limitation_misses = fab.filter((r) => r.demonstrates_limitation && r.passed);

  return {
    evidence_source: "Case 001 evidence graph node quotes",
    evidence_quote_count: evidence.length,
    probe_count: results.length,
    legitimate_count: legit.length,
    fabrication_count: fab.length,
    false_positive_count,
    false_positive_rate: legit.length === 0 ? 0 : false_positive_count / legit.length,
    required_fabrication_detected_count,
    required_fabrication_count: requiredFab.length,
    required_fabrication_detection_rate: requiredFab.length === 0 ? 1 : required_fabrication_detected_count / requiredFab.length,
    known_limitation_misses,
    results,
  };
}
