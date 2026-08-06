#!/usr/bin/env node
/**
 * CLI: run the Tier 1 Evidence Benchmark and persist a Report.
 *
 * Usage:
 *   npx tsx bin/run.ts                    fixture mode, all 10 Atlas cases (default, safe)
 *   npx tsx bin/run.ts --live              live mode, the 3-case subset only (001, 002, 009)
 *   npx tsx bin/run.ts --live --cases=001  live mode, a further-narrowed subset of the allowed 3
 *
 * Live mode NEVER runs unless --live is passed explicitly. There is no
 * environment variable or config file that can silently enable it.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runBenchmark, LIVE_ALLOWED_CASE_IDS } from "../src/runner";
import { reportFilename } from "../src/report";
import { hasLiveApiKey } from "../../evidence-runtime/src/listenEngine";

const here = dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = join(here, "../reports");

async function main() {
  const args = process.argv.slice(2);
  const live = args.includes("--live");
  const casesArg = args.find((a) => a.startsWith("--cases="));
  const requestedCases = casesArg ? casesArg.slice("--cases=".length).split(",").map((s) => s.trim()) : undefined;

  if (live && !hasLiveApiKey()) {
    console.error(
      "NO_API_KEY: --live was requested but ANTHROPIC_API_KEY is not configured " +
      "(env or evidence-runtime/.env). Refusing to run live mode. Not falling back to fixture output."
    );
    process.exit(1);
  }

  const mode = live ? "live" : "fixture";
  console.log(`Running Tier 1 Evidence Benchmark — mode: ${mode}${live ? ` (scoped to: ${(requestedCases ?? LIVE_ALLOWED_CASE_IDS).join(", ")})` : " (all 10 cases)"}`);

  const report = await runBenchmark({ mode, caseIds: requestedCases });

  const filename = reportFilename(report);
  const outPath = join(REPORTS_DIR, filename);
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(`\nWrote ${filename}`);
  console.log(`Cases: ${report.cases.length} | Class A recall avg: ${report.aggregate.class_a_recall_avg.toFixed(3)} | ` +
    `claim_type agreement avg: ${report.aggregate.claim_type_agreement_avg.toFixed(3)} | ` +
    `Class B recall avg: ${report.aggregate.class_b_recall_avg.toFixed(3)} | ` +
    `additions: ${report.aggregate.total_additions} | ` +
    `Class C hard-fail: ${report.aggregate.class_c_hard_fail_all_passed ? "PASSED" : `FAILED (${report.aggregate.class_c_hard_fail_failures.join(", ")})`}`);

  if (!report.aggregate.class_c_hard_fail_all_passed) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
