/**
 * Evidence Runtime Prototype — full 8-stage pipeline for one transcript.
 *
 * Stages 1-4 (new): Transcript -> Prototype Listen Engine -> materialize
 * source_spans -> evidence-validator (real, unmodified validation logic,
 * plus the one additive `admitted_by` field) -> Validated Evidence Graph.
 *
 * Stages 5-8 (existing, unmodified): the same raw transcript run through
 * runExistingEngines() (Observation -> Opportunity -> Decision ->
 * Conversation), computed completely independently of Stages 1-4. THERE IS
 * NO ADAPTER. Stage 5's ObservationSet is not derived from Stage 4's
 * Evidence Graph in any way — this function would produce byte-identical
 * Stage 5-8 output even if Stages 1-4 were deleted.
 */
import { validateEvidence } from "../../evidence-validator/src/index";
import type { ValidatorOutput } from "../../evidence-validator/src/index";
import { ListenEngineResult } from "./listenEngine";
import { materializeSourceSpans } from "./modelOutput";
import { buildEvidenceGraph, EvidenceGraph } from "./evidenceGraph";
import { ExistingEnginesOutput, runExistingEngines } from "./existingEngines";

export interface PipelineResult {
  case_id: string;
  transcript: string;
  listen_engine: ListenEngineResult;
  validator_output: ValidatorOutput;
  evidence_graph: EvidenceGraph;
  existing_engines: ExistingEnginesOutput;
}

export function runPipeline(case_id: string, transcript: string, listenResult: ListenEngineResult): PipelineResult {
  const validatorInput = materializeSourceSpans(transcript, listenResult.raw);
  const validator_output = validateEvidence(validatorInput);
  const evidence_graph = buildEvidenceGraph(validator_output);
  const existing_engines = runExistingEngines(transcript);

  return {
    case_id,
    transcript,
    listen_engine: listenResult,
    validator_output,
    evidence_graph,
    existing_engines,
  };
}
