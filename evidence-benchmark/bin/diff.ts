#!/usr/bin/env node
/**
 * CLI: structured diff between two persisted Report files.
 *
 * Usage:
 *   npx tsx bin/diff.ts reports/report_A.json reports/report_B.json
 */
import { readFileSync } from "node:fs";
import { diffReports } from "../src/diff";
import { Report } from "../src/report";

function main() {
  const [pathA, pathB] = process.argv.slice(2);
  if (!pathA || !pathB) {
    console.error("Usage: bin/diff.ts <report_a.json> <report_b.json>");
    process.exit(1);
  }
  const a = JSON.parse(readFileSync(pathA, "utf-8")) as Report;
  const b = JSON.parse(readFileSync(pathB, "utf-8")) as Report;
  const result = diffReports(a, b);
  console.log(JSON.stringify(result, null, 2));
}

main();
