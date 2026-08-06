/**
 * Benchmark runner — ICOS Evaluation System Design v0.1, Section 3/6.
 * Reads evidence-runtime's Listen Engine + evidence-validator's real
 * validateEvidence() for each case; never modifies either. Fixture mode
 * defaults to all 10 Atlas cases (deterministic, free, always safe). Live
 * mode is hard-guarded to the 3-case subset already proven live-tested
 * (001, 002, 009) and never runs unless explicitly requested.
 */
import { validateEvidence } from "../../evidence-validator/src/index";
import { materializeSourceSpans, ListenEngineRawOutput } from "../../evidence-runtime/src/modelOutput";
import { runListenEngineFixture, runListenEngineLive } from "../../evidence-runtime/src/listenEngine";
import { FIXTURE_CASES } from "../../evidence-runtime/fixtures/index";
import * as case003Fixture from "./case003Fixture";
import { GROUND_TRUTH, GROUND_TRUTH_BY_ID } from "./groundTruth";
import { scoreCase } from "./scorer";
import { buildReport, EvidenceCaseResult, PipelineMode, Report } from "./report";

export const ALL_CASE_IDS: readonly string[] = GROUND_TRUTH.map((c) => c.case_id);
export const LIVE_ALLOWED_CASE_IDS: readonly string[] = ["001", "002", "009"];

function getFixtureRaw(caseId: string): ListenEngineRawOutput {
  if (caseId === "003") return case003Fixture.LISTEN_ENGINE_FIXTURE;
  const found = FIXTURE_CASES.find((c) => c.case_id === caseId);
  if (!found) throw new Error(`No evidence-runtime fixture exists for case ${caseId}.`);
  return found.fixture;
}

export interface RunBenchmarkOptions {
  mode: PipelineMode;
  /** Defaults to all 10 cases for fixture mode; REQUIRED (and validated) for live mode. */
  caseIds?: string[];
}

export async function runBenchmark(opts: RunBenchmarkOptions): Promise<Report> {
  const { mode } = opts;
  const caseIds = opts.caseIds ?? (mode === "fixture" ? [...ALL_CASE_IDS] : [...LIVE_ALLOWED_CASE_IDS]);

  if (mode === "live") {
    const disallowed = caseIds.filter((id) => !LIVE_ALLOWED_CASE_IDS.includes(id));
    if (disallowed.length > 0) {
      throw new Error(
        `Live mode is scoped to cases ${LIVE_ALLOWED_CASE_IDS.join(", ")} only (Design v0.1 Step 3 boundary). ` +
        `Refusing to run live against: ${disallowed.join(", ")}.`
      );
    }
  }

  const cases: EvidenceCaseResult[] = [];
  let model: string | null = null;

  for (const caseId of caseIds) {
    const gt = GROUND_TRUTH_BY_ID.get(caseId);
    if (!gt) throw new Error(`No ground truth exists for case ${caseId}.`);

    const listenResult = mode === "fixture"
      ? runListenEngineFixture(getFixtureRaw(caseId))
      : await runListenEngineLive(gt.transcript);

    if (listenResult.mode === "live") model = listenResult.meta.model;

    const validatorInput = materializeSourceSpans(gt.transcript, listenResult.raw);
    const validatorOutput = validateEvidence(validatorInput);
    const metrics = scoreCase(gt, gt.transcript, listenResult.raw.class_a_proposals, validatorOutput);

    cases.push({ case_id: caseId, tier: "evidence", metrics });
  }

  return buildReport({ tier: "evidence", pipeline_mode: mode, model, cases });
}
