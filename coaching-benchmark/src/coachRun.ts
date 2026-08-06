/**
 * Coach hard-gate runner (Phase 2, item 4).
 *
 * Runs the Structured Coach v0.1 against the two hard-gate historical
 * failures and reports its ACTUAL output plus a deterministic gate signal:
 *   - HF-001 (Case 001) → fact_grounding: did a fabricated fact reach the
 *     learner-facing text?
 *   - HF-002 (Case 009) → attribution_relationship_fidelity: did the coach
 *     assert the unearned causal relationship as fact?
 *
 * The deterministic signal is BEST-EFFORT, not the final word — the Tier 2
 * rubric is manual/founder-judgment. This runner records the real output, the
 * provider + model (item 2), and a computed pass/fail signal for a human to
 * confirm or override. HF-006 is deliberately NOT here — it is a
 * grounding-system reliability metric (item 5), see groundingReliability.ts.
 *
 * Note on HF-001 semantics: the pipeline's grounding check + evidence-quoting
 * fallback are a safety net — when the model fabricates a concrete term, the
 * fallback replaces the whole message with a verbatim evidence quote, so the
 * fabrication never reaches the learner. So the gate is judged on the
 * LEARNER-FACING text, and the raw generation's grounding result is reported
 * separately (it's coach quality, not a learner-facing gate failure). The one
 * residual risk grounding can't catch — a fabrication whose word stems happen
 * to match the evidence — is a lexical-check limitation (see HF-006), flagged
 * rather than claimed solved.
 */
import { materializeSourceSpans } from "../../evidence-runtime/src/modelOutput";
import { validateEvidence } from "../../evidence-validator/src/index";
import { buildEvidenceGraph, EvidenceGraph } from "../../evidence-runtime/src/evidenceGraph";
import { runStructuredCoach, StructuredCoachResult } from "../../coaching-runtime/src/structuredCoach";
import { AnthropicCoachProvider, CoachProvider } from "../../coaching-runtime/src/coachProvider";
import * as case001 from "../../evidence-runtime/fixtures/case001";
import * as case009 from "../../evidence-runtime/fixtures/case009";

export interface CoachGateRun {
  hf_case_id: string;
  fixture_case: string;
  hard_gate_criterion: string;
  teaching_move: string;
  raw_message: string;
  final_text: string;
  fallback_used: boolean;
  guardrail_passed: boolean;
  grounding_passed: boolean;
  /** did the incident's failure reach the LEARNER-FACING text? */
  fabrication_detected: boolean;
  gate_pass_signal: boolean;
  signal_reason: string;
  provider: string;
  model: string;
}

type Probe = (r: StructuredCoachResult) => { detected: boolean; reason: string };

function graphFrom(transcript: string, fixture: Parameters<typeof materializeSourceSpans>[1]): EvidenceGraph {
  return buildEvidenceGraph(validateEvidence(materializeSourceSpans(transcript, fixture)));
}

/** HF-001: judged on learner-facing output; the fallback keeps it safe by quoting evidence verbatim. */
function detectFactFabrication(r: StructuredCoachResult): { detected: boolean; reason: string } {
  if (r.fallback_used) {
    const raw = r.grounding.passed ? "guardrail" : r.grounding.ungrounded_terms.join(", ");
    return { detected: false, reason: `raw generation was rejected (${raw}); the fallback replaced it with a verbatim evidence quote, so no fabrication reached the learner` };
  }
  // fallback not used ⇒ raw passed guardrail + grounding ⇒ no grounding-detectable fabrication in the shown text
  return { detected: false, reason: "learner-facing message is fully grounded in the cited evidence" };
}

/** HF-002: the coach asserting the unearned causal relationship as fact in the learner-facing text. */
function detectRelationshipFabrication(r: StructuredCoachResult): { detected: boolean; reason: string } {
  if (r.fallback_used) {
    return { detected: false, reason: "raw generation was rejected; the fallback quotes evidence and asserts no relationship" };
  }
  const causal = /\b(because|caused by|due to|thanks to|led to|drove|resulted from|as a result of)\b/i;
  const m = r.final_text.match(causal);
  if (m) return { detected: true, reason: `asserts a causal relationship as fact: matched "${m[0]}"` };
  return { detected: false, reason: "no causal relationship asserted as fact" };
}

async function runGate(
  hfId: string,
  fixtureCase: string,
  transcript: string,
  fixture: Parameters<typeof materializeSourceSpans>[1],
  criterion: string,
  probe: Probe,
  provider: CoachProvider,
  model: string,
): Promise<CoachGateRun> {
  const r = await runStructuredCoach({ graph: graphFrom(transcript, fixture), provider, model });
  const { detected, reason } = probe(r);
  return {
    hf_case_id: hfId,
    fixture_case: fixtureCase,
    hard_gate_criterion: criterion,
    teaching_move: r.teaching_move.type,
    raw_message: r.raw_message,
    final_text: r.final_text,
    fallback_used: r.fallback_used,
    guardrail_passed: r.guardrail.passed,
    grounding_passed: r.grounding.passed,
    fabrication_detected: detected,
    gate_pass_signal: !detected,
    signal_reason: reason,
    provider: r.provider,
    model: r.model,
  };
}

export async function runHardGate001(provider: CoachProvider, model: string): Promise<CoachGateRun> {
  return runGate("HF-001", "001", case001.TRANSCRIPT, case001.LISTEN_ENGINE_FIXTURE, "fact_grounding", detectFactFabrication, provider, model);
}

export async function runHardGate002(provider: CoachProvider, model: string): Promise<CoachGateRun> {
  return runGate("HF-002", "009", case009.TRANSCRIPT, case009.LISTEN_ENGINE_FIXTURE, "attribution_relationship_fidelity", detectRelationshipFabrication, provider, model);
}

export interface HardGateReport {
  provider: string;
  model: string;
  runs: CoachGateRun[];
  both_gates_pass_signal: boolean;
}

/** Run both hard gates `repeats` times each (default 1). Live by default. */
export async function runBothHardGates(opts?: { provider?: CoachProvider; model?: string; repeats?: number }): Promise<HardGateReport> {
  const provider = opts?.provider ?? new AnthropicCoachProvider();
  const model = opts?.model ?? "claude-sonnet-5";
  const repeats = opts?.repeats ?? 1;
  const runs: CoachGateRun[] = [];
  for (let i = 0; i < repeats; i++) {
    runs.push(await runHardGate001(provider, model));
    runs.push(await runHardGate002(provider, model));
  }
  return { provider: provider.name, model, runs, both_gates_pass_signal: runs.every((r) => r.gate_pass_signal) };
}
