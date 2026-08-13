#!/usr/bin/env node
/**
 * CLI: run the SOD v0.1 experiment.
 *
 * Makes real Anthropic calls — RUNS_PER_CASE per case, across 4 primary and 4
 * control cases. Refuses to run without a key rather than fabricating output.
 * Each run is recorded separately; nothing is averaged across cases.
 *
 * Also records, per case, what the EXISTING mechanisms say (deterministic
 * opportunity + habit, structured Teaching Move, readiness) so the comparison
 * in the report is computed, not narrated.
 *
 * Usage:
 *   npx tsx bin/run-experiment.ts
 *   npx tsx bin/run-experiment.ts --model=claude-sonnet-5
 *   npx tsx bin/run-experiment.ts --tag=revision-1     label for a re-run condition
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CALIBRATION_CASES_BY_ID } from "../../coaching-calibration/src/corpus";
import { runDeterministicCoach } from "../../coaching-calibration/src/deterministicCoach";
import { validateEvidence } from "../../evidence-validator/src/index";
import { materializeSourceSpans } from "../../evidence-runtime/src/modelOutput";
import { buildEvidenceGraph } from "../../evidence-runtime/src/evidenceGraph";
import { selectTeachingMove } from "../../coaching-runtime/src/teachingMove";
import { computeResultReadiness } from "../../coaching-runtime/src/structuredCoach";
import { hasLiveApiKey } from "../../coaching-runtime/src/coachProvider";
import { OPPORTUNITY_COPY } from "../../conversation-engine/src/registry";
import { runSod, SOD_DEFAULT_MODEL, SodResult } from "../src/detector";
import { PRIMARY_CASES, CONTROL_CASES, RUNS_PER_CASE } from "../src/experiment";
import { SOD_SYSTEM_PROMPT } from "../src/sodPrompt";

const REPORTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../reports");

const arg = (name: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

function existingMechanisms(caseId: string) {
  const c = CALIBRATION_CASES_BY_ID.get(caseId)!;
  const det = runDeterministicCoach(c.transcript);
  const graph = buildEvidenceGraph(validateEvidence(materializeSourceSpans(c.transcript, c.fixture)));
  const move = selectTeachingMove(graph);
  const opp = det.selected_opportunity;
  return {
    graph,
    label: c.label,
    domain: c.domain,
    transcript: c.transcript,
    deterministic_candidates: det.candidate_ids,
    deterministic_selected_opportunity: opp,
    deterministic_habit: opp && OPPORTUNITY_COPY[opp] ? OPPORTUNITY_COPY[opp]!.habit_id : null,
    structured_teaching_move: move.type,
    structured_readiness_has_meaningful_result: computeResultReadiness(graph),
  };
}

async function main() {
  if (!hasLiveApiKey()) {
    console.error("No ANTHROPIC_API_KEY — refusing to run. SOD makes real calls; it does not simulate them.");
    process.exit(1);
  }
  const model = arg("model") ?? SOD_DEFAULT_MODEL;
  const conditionTag = arg("tag") ?? "revision-0";

  const cases = [
    ...PRIMARY_CASES.map((p) => ({ kind: "primary" as const, case_id: p.case_id, spec: p })),
    ...CONTROL_CASES.map((c) => ({ kind: "control" as const, case_id: c.case_id, spec: c })),
  ];

  const results: Record<string, unknown>[] = [];

  for (const c of cases) {
    const mech = existingMechanisms(c.case_id);
    const runs: SodResult[] = [];
    for (let i = 1; i <= RUNS_PER_CASE; i++) {
      process.stderr.write(`[${c.kind}] ${c.case_id} run ${i}/${RUNS_PER_CASE} ... `);
      const r = await runSod({ case_id: c.case_id, graph: mech.graph, model });
      runs.push(r);
      process.stderr.write(
        `${r.no_text_block ? "VOID (no text block)" : r.observations.map((o) => o.tag).join(",") || "(none)"}` +
          `${r.rejected.length ? ` [rejected ${r.rejected.length}]` : ""}\n`,
      );
    }
    results.push({
      kind: c.kind,
      case_id: c.case_id,
      label: mech.label,
      domain: mech.domain,
      spec: c.spec,
      existing_mechanisms: {
        deterministic_candidates: mech.deterministic_candidates,
        deterministic_selected_opportunity: mech.deterministic_selected_opportunity,
        deterministic_habit: mech.deterministic_habit,
        structured_teaching_move: mech.structured_teaching_move,
        structured_readiness_has_meaningful_result: mech.structured_readiness_has_meaningful_result,
      },
      sod_input: runs[0]!.input,
      runs: runs.map((r, i) => ({
        run: i + 1,
        observations: r.observations,
        rejected: r.rejected,
        parse_failed: r.parse_failed,
        no_text_block: r.no_text_block,
        raw_response: r.raw_response,
        meta: r.meta,
      })),
    });
  }

  const report = {
    experiment: "sod_v0.1",
    condition: conditionTag,
    prompt_revision: conditionTag === "revision-0" ? 0 : 1,
    timestamp: new Date().toISOString(),
    provider: "anthropic",
    model,
    runs_per_case: RUNS_PER_CASE,
    /** the seam exposes no temperature knob, so runs use the provider default — real sampling variance is what is being measured */
    sampling: "provider default (CoachProvider exposes no temperature parameter)",
    system_prompt: SOD_SYSTEM_PROMPT,
    results,
  };

  mkdirSync(REPORTS_DIR, { recursive: true });
  const file = join(REPORTS_DIR, `sod_v0.1_${conditionTag}_${model}_${report.timestamp.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(`\nwrote ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
