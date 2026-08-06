/**
 * Per-case comparison: run BOTH coaches on the same case and return their
 * outputs side by side. The deterministic coach is free; the structured coach
 * makes one live Narrator call (its evidence graph is built from the case's
 * Listen fixture, so no live Listen call is needed).
 *
 * This produces the raw material the founder calibrates against. It computes
 * NO score and NO preference — those are the founder's, recorded separately.
 */
import { validateEvidence } from "../../evidence-validator/src/index";
import { materializeSourceSpans } from "../../evidence-runtime/src/modelOutput";
import { buildEvidenceGraph } from "../../evidence-runtime/src/evidenceGraph";
import { runStructuredCoach } from "../../coaching-runtime/src/structuredCoach";
import { AnthropicCoachProvider, CoachProvider } from "../../coaching-runtime/src/coachProvider";
import { runDeterministicCoach } from "./deterministicCoach";
import { CalibrationCase } from "./corpus";

export interface ComparisonResult {
  case_id: string;
  label: string;
  domain: string;
  transcript: string;
  deterministic: {
    coaching_text: string;
    selected_opportunity: string | null;
    intervention_type: string | null;
    decision_type: string;
    degraded: boolean;
  };
  structured: {
    final_text: string;
    raw_message: string;
    teaching_move: string;
    fallback_used: boolean;
    guardrail_passed: boolean;
    grounding_passed: boolean;
    provider: string;
    model: string;
  };
}

export async function runComparison(
  c: CalibrationCase,
  opts?: { provider?: CoachProvider; model?: string },
): Promise<ComparisonResult> {
  const det = runDeterministicCoach(c.transcript);

  const graph = buildEvidenceGraph(validateEvidence(materializeSourceSpans(c.transcript, c.fixture)));
  const s = await runStructuredCoach({
    graph,
    provider: opts?.provider ?? new AnthropicCoachProvider(),
    model: opts?.model ?? "claude-sonnet-5",
  });

  return {
    case_id: c.id,
    label: c.label,
    domain: c.domain,
    transcript: c.transcript,
    deterministic: {
      coaching_text: det.coaching_text,
      selected_opportunity: det.selected_opportunity,
      intervention_type: det.intervention_type,
      decision_type: det.decision_type,
      degraded: det.degraded,
    },
    structured: {
      final_text: s.final_text,
      raw_message: s.raw_message,
      teaching_move: s.teaching_move.type,
      fallback_used: s.fallback_used,
      guardrail_passed: s.guardrail.passed,
      grounding_passed: s.grounding.passed,
      provider: s.provider,
      model: s.model,
    },
  };
}
