#!/usr/bin/env node
/**
 * CLI: run the Structured Coach v0.1 LIVE against the two hard-gate
 * historical failures (HF-001, HF-002), score the gate criteria, and persist
 * a Tier 2 report recording the provider + model (item 2).
 *
 * Makes real Anthropic calls (2 per repeat). Refuses to run without a key
 * rather than fabricating output.
 *
 * Usage:
 *   npx tsx bin/run-coach.ts                          1 run per gate
 *   npx tsx bin/run-coach.ts --repeats=2              2 runs per gate (stability read)
 *   npx tsx bin/run-coach.ts --model=claude-sonnet-5  explicit model id
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { hasLiveApiKey } from "../../coaching-runtime/src/coachProvider";
import { runBothHardGates } from "../src/coachRun";
import { buildReport, reportFilename, CaseScoreSheet } from "../src/report";
import { CRITERIA, ScoreValue } from "../src/criteria";

const REPORTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../reports");

function scoreSheetFor(hfCaseId: string, gateCriterion: string, gatePass: boolean, note: string): CaseScoreSheet {
  return {
    case_id: hfCaseId,
    scores: CRITERIA.map((c) => ({
      criterion_id: c.id,
      score: (c.id === gateCriterion ? (gatePass ? 3 : 0) : "pending") as ScoreValue,
      note: c.id === gateCriterion ? note : undefined,
    })),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const repeats = Number(args.find((a) => a.startsWith("--repeats="))?.split("=")[1] ?? "1");
  const model = args.find((a) => a.startsWith("--model="))?.split("=")[1] ?? "claude-sonnet-5";

  if (!hasLiveApiKey()) {
    console.error("NO_API_KEY: ANTHROPIC_API_KEY is not configured (env or evidence-runtime/.env). Refusing to run — not fabricating coach output.");
    process.exit(1);
  }

  console.log(`Running Structured Coach v0.1 — model: ${model}, repeats: ${repeats} (${repeats * 2} live calls)`);
  const report = await runBothHardGates({ model, repeats });

  // aggregate per HF case across repeats: the gate passes only if EVERY run passed
  const byCase = new Map<string, typeof report.runs>();
  for (const r of report.runs) {
    const arr = byCase.get(r.hf_case_id) ?? [];
    arr.push(r);
    byCase.set(r.hf_case_id, arr);
  }

  const sheets: CaseScoreSheet[] = [];
  for (const [hfId, runs] of byCase) {
    const gatePass = runs.every((r) => r.gate_pass_signal);
    const crit = runs[0]!.hard_gate_criterion;
    const note = runs.map((r, i) => `run${i + 1}[move=${r.teaching_move}, fallback=${r.fallback_used}, grounding=${r.grounding_passed}]: "${r.final_text}" — ${r.signal_reason}`).join(" || ");
    sheets.push(scoreSheetFor(hfId, crit, gatePass, note));
  }

  const built = buildReport({ subject: `structured-coach v0.1 @ ${report.provider}/${model}`, sheets, provider: report.provider, model });
  const filename = reportFilename(built);
  writeFileSync(join(REPORTS_DIR, filename), JSON.stringify({ report: built, gate_runs: report.runs }, null, 2));

  console.log(`\n=== HARD-GATE RESULTS (provider=${report.provider}, model=${model}) ===`);
  for (const r of report.runs) {
    console.log(`\n[${r.hf_case_id} / case ${r.fixture_case} / ${r.hard_gate_criterion}] move=${r.teaching_move} fallback=${r.fallback_used} guardrail=${r.guardrail_passed} grounding=${r.grounding_passed}`);
    console.log(`  raw:   "${r.raw_message}"`);
    console.log(`  final: "${r.final_text}"`);
    console.log(`  gate:  ${r.gate_pass_signal ? "PASS" : "FAIL"} — ${r.signal_reason}`);
  }
  console.log(`\nBOTH GATES (signal): ${report.both_gates_pass_signal ? "PASS" : "FAIL"}`);
  console.log(`Wrote ${filename}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
