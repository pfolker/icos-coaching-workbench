#!/usr/bin/env node
/**
 * CLI: emit a blank Tier 2 scoresheet (all criteria × all corpus cases,
 * every cell "pending") for a named subject, ready for manual/founder
 * scoring. Writes JSON into reports/. This does NOT run a coach — there is
 * no coach yet; it produces the sheet a human fills in.
 *
 * Usage:
 *   npx tsx bin/scoresheet.ts "coaching-runtime narrator @ claude-sonnet-5"
 *   npx tsx bin/scoresheet.ts "<subject>" --historical-only
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { HISTORICAL_FAILURES } from "../src/corpus";
import { AVAILABLE_TRANSCRIPTS } from "../src/manifest";
import { buildBlankScoreSheet, buildReport, reportFilename } from "../src/report";

const here = dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = join(here, "../reports");

function main() {
  const args = process.argv.slice(2);
  const historicalOnly = args.includes("--historical-only");
  const subject = args.find((a) => !a.startsWith("--")) ?? "unspecified-subject";

  const historicalIds = HISTORICAL_FAILURES.map((c) => c.case_id);
  const caseIds = historicalOnly
    ? historicalIds
    : [...historicalIds, ...AVAILABLE_TRANSCRIPTS.filter((t) => !t.used_as_historical_failure).map((t) => t.case_id)];

  const sheets = buildBlankScoreSheet(caseIds);
  const report = buildReport({ subject, sheets });
  const filename = reportFilename(report);
  writeFileSync(join(REPORTS_DIR, filename), JSON.stringify(report, null, 2));

  console.log(`Wrote blank scoresheet: ${filename}`);
  console.log(`Subject: ${subject}`);
  console.log(`Cases: ${caseIds.length} (${historicalIds.length} historical-failure regressions${historicalOnly ? "" : ` + ${caseIds.length - historicalIds.length} additional real transcripts`})`);
  console.log(`All ${report.cases[0]?.scores.length ?? 0} criteria are "pending" — fill in manually, then re-load to aggregate.`);
}

main();
